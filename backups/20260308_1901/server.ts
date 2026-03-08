/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer } from "http";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const PORT = Number(process.env.PORT) || 3000;

  console.log(`[Luna-Proxy] Starting server on ${PORT}...`);

  // Upgrade handler
  httpServer.prependListener("upgrade", (request, socket, head) => {
    const url = request.url || "";
    if (url.includes("/api/ws-gemini")) {
      console.log(`[Luna-Proxy] Upgrading connection for: ${url}`);
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  // Proxy logic
  wss.on("connection", (clientWs) => {
    console.log("[Luna-Proxy] Client connection opened");
    const apiKey = process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      console.error("[Luna-Proxy] API Key missing!");
      clientWs.send(JSON.stringify({ error: { message: "API Key Missing on Server" } }));
      clientWs.close();
      return;
    }

    // Use the official v1beta BidiGenerateContent endpoint (Proven reliable for 2.5-flash-native)
    const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    console.log(`[Luna-Proxy] Connecting to Gemini v1beta (BidiGenerateContent)... KeyLength: ${apiKey.length}`);
    const geminiWs = new WebSocket(geminiUrl);

    const messageQueue: any[] = [];
    let isUpstreamReady = false;

    geminiWs.on("open", () => {
      console.log("[Luna-Proxy] Connected to Gemini UPSTREAM");
      isUpstreamReady = true;
      // Flush queued messages
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        console.log("[Luna-Proxy] Flushing queued message to Gemini");
        geminiWs.send(msg);
      }
    });

    geminiWs.on("message", (data) => {
      const msg = data.toString();
      // Only log a snippet to avoid flooding
      if (msg.includes("error")) {
        console.error("[Luna-Proxy] Gemini Error Message:", msg);
      } else if (!msg.includes("audio")) {
        console.log("[Luna-Proxy] From Gemini:", msg.substring(0, 200));
      }

      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(msg);
      }
    });

    geminiWs.on("error", (err) => {
      console.error("[Luna-Proxy] Upstream ERROR:", err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: { message: `Upstream connection error: ${err.message}` } }));
      }
    });

    geminiWs.on("close", (code, reason) => {
      const reasonStr = reason.toString();
      console.warn(`[Luna-Proxy] Upstream CLOSED. Code: ${code}, Reason: ${reasonStr}`);
      if (clientWs.readyState === WebSocket.OPEN) {
        if (code !== 1000) {
          clientWs.send(JSON.stringify({ error: { message: `Gemini closed: ${reasonStr || 'Internal error'}` } }));
        }
        clientWs.close();
      }
    });

    clientWs.on("message", (data) => {
      let messageStr = data.toString();
      console.log("[Luna-Proxy] Client Message:", messageStr);
      // Forward everything faithfully to MultimodalLiveService
      if (isUpstreamReady && geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.send(messageStr);
      } else {
        console.log("[Luna-Proxy] Queueing client message (Upstream not ready)");
        messageQueue.push(messageStr);
      }
    });

    clientWs.on("close", () => {
      console.log("[Luna-Proxy] Client connection closed");
      if (geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.close();
      }
    });
  });

  // Existing API routes
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
  app.get("/api/streetview", async (req, res) => {
    try {
      const { lat, lng, key } = req.query;
      const url = `https://maps.googleapis.com/maps/api/streetview?location=${lat},${lng}&size=600x400&key=${key}`;
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      res.json({ base64: Buffer.from(buffer).toString("base64") });
    } catch (e) {
      res.status(500).send("StreetView Proxy Failed");
    }
  });

  // Vite
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Luna-Proxy] Listening on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
