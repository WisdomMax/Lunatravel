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

  console.log(`[Aura-Proxy] Starting server on ${PORT}...`);

  // Upgrade handler
  httpServer.prependListener("upgrade", (request, socket, head) => {
    const url = request.url || "";
    if (url.includes("/api/ws-gemini")) {
      console.log(`[Aura-Proxy] Upgrading connection for: ${url}`);
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  // Proxy logic
  wss.on("connection", (clientWs) => {
    console.log("[Aura-Proxy] Client connection opened");
    const apiKey = process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      console.error("[Aura-Proxy] API Key missing!");
      clientWs.send(JSON.stringify({ error: { message: "API Key Missing on Server" } }));
      clientWs.close();
      return;
    }

    const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    console.log("[Aura-Proxy] Connecting to Gemini v1alpha...");
    const geminiWs = new WebSocket(geminiUrl);

    const messageQueue: any[] = [];
    let isUpstreamReady = false;

    geminiWs.on("open", () => {
      console.log("[Aura-Proxy] Connected to Gemini UPSTREAM");
      isUpstreamReady = true;
      // Flush queued messages
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        console.log("[Aura-Proxy] Flushing queued message to Gemini");
        geminiWs.send(msg);
      }
    });

    geminiWs.on("message", (data) => {
      // Forward all messages from Gemini to Client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data.toString());
      }
    });

    geminiWs.on("error", (err) => {
      console.error("[Aura-Proxy] Upstream ERROR:", err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: { message: `Upstream connection error: ${err.message}` } }));
      }
    });

    geminiWs.on("close", (code, reason) => {
      const reasonStr = reason.toString();
      console.warn(`[Aura-Proxy] Upstream CLOSED. Code: ${code}, Reason: ${reasonStr}`);
      if (clientWs.readyState === WebSocket.OPEN) {
        if (code !== 1000) {
          clientWs.send(JSON.stringify({ error: { message: `Gemini closed: ${reasonStr || 'Internal error'}` } }));
        }
        clientWs.close();
      }
    });

    clientWs.on("message", (data) => {
      if (isUpstreamReady && geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.send(data.toString());
      } else {
        console.log("[Aura-Proxy] Queueing client message (Upstream not ready)");
        messageQueue.push(data.toString());
      }
    });

    clientWs.on("close", () => {
      console.log("[Aura-Proxy] Client connection closed");
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
    console.log(`[Aura-Proxy] Listening on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
