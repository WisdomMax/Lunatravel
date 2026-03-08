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
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' })); // Base64 이미지 수신을 위해 용량 증가
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

  // AI Travel Photo Generation
  app.post("/api/generate-travel-photo", async (req, res) => {
    try {
      const { backgroundImage, userPhoto, lunaPhoto } = req.body;
      const apiKey = process.env.VITE_GEMINI_API_KEY;

      if (!apiKey) throw new Error("API Key missing");
      const ai = new GoogleGenAI({ apiKey });

      // Helper to convert base64 (with data:image/... prefix) to raw base64
      const cleanBase64 = (b64: string) => b64.includes(",") ? b64.split(",")[1] : b64;

      console.log("[AI-Photo] Generating combined travel photo...");

      // Using gemini-2.0-flash-exp (or whichever model supports image generation/editing)
      // Note: Nano Banana 2 might require specific prompt or model configuration
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Here are three reference images:\n1. A background travel location (Street View).\n2. A photo of a specific person (user).\n3. A photo of an AI character named 'Luna'.\n\nPlease create a single, high-quality, cinematic travel photo. Synthesize them so that both the user and Luna are naturally standing in the background location, looking like they are traveling together and posing for a candid shot. Maintain high character consistency for both subjects. The output should be only the final synthesized image."
              },
              { inlineData: { mimeType: "image/jpeg", data: cleanBase64(backgroundImage) } },
              { inlineData: { mimeType: "image/jpeg", data: cleanBase64(userPhoto) } },
              { inlineData: { mimeType: "image/jpeg", data: cleanBase64(lunaPhoto) } }
            ]
          }
        ]
      });

      // Gemini 2.0 can return images in parts if configured, but often it might describe or we expect an image part
      // If the model supports direct image generation as a response:
      const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

      if (imagePart?.inlineData) {
        res.json({ base64: imagePart.inlineData.data });
      } else {
        // Fallback or error if no image returned
        console.warn("[AI-Photo] No image part in response, might be text only:", response.text);
        res.status(500).json({ error: "No image generated", message: response.text });
      }
    } catch (e: any) {
      console.error("[AI-Photo] Failed:", e);
      res.status(500).json({ error: e.message });
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
