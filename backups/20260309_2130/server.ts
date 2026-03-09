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
import "dotenv/config";
import sharp from "sharp";
import { promises as fs } from "fs";
import fsSync from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

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
      const { lat, lng, key, heading, pitch } = req.query;
      let url = `https://maps.googleapis.com/maps/api/streetview?location=${lat},${lng}&size=600x400&key=${key}`;
      if (heading) url += `&heading=${heading}`;
      if (pitch) url += `&pitch=${pitch}`;

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

      // Helper to ensure we have raw base64 even if input is a URL or local path
      const ensureRawBase64 = async (src: string) => {
        if (!src) return "";
        if (src.startsWith("data:image")) return cleanBase64(src);

        try {
          if (src.startsWith("http")) {
            const resp = await fetch(src);
            const buffer = await resp.arrayBuffer();
            return Buffer.from(buffer).toString('base64');
          } else {
            // Ensure local path in public directory is correctly resolved
            const cleanSrc = src.startsWith('/') ? src.substring(1) : src;
            const possiblePaths = [
              path.join(__dirname, 'public', cleanSrc),
              path.join(process.cwd(), 'public', cleanSrc),
              path.join(__dirname, cleanSrc)
            ];

            for (const localPath of possiblePaths) {
              console.log(`[AI-Photo] Checking local path: ${localPath}`);
              if (fsSync.existsSync(localPath)) {
                return fsSync.readFileSync(localPath).toString('base64');
              }
            }
            console.warn(`[AI-Photo] Local file not found in any of: ${possiblePaths.join(', ')}`);
          }
        } catch (e) {
          console.error(`[AI-Photo] ensureRawBase64 failed for ${src}:`, e);
        }
        return src; // Fallback - will likely cause error in Gemini if not valid b64
      };

      // 배경화면이 URL인 경우 서버에서 직접 fetch하여 base64로 변환
      let bgBase64 = backgroundImage;
      if (backgroundImage.startsWith('http') || backgroundImage.startsWith('/api/')) {
        try {
          const isInternal = backgroundImage.startsWith('/api/');
          const fullUrl = isInternal
            ? `http://localhost:3000${backgroundImage}`
            : backgroundImage;

          console.log(`[AI-Photo] Fetching background from: ${fullUrl}`);
          const resp = await fetch(fullUrl);

          if (isInternal) {
            const data = await resp.json() as { base64: string };
            bgBase64 = data.base64;
          } else {
            const buffer = await resp.arrayBuffer();
            bgBase64 = Buffer.from(buffer).toString('base64');
          }
        } catch (e) {
          console.error("[AI-Photo] Background fetch failed:", e);
        }
      }

      console.log("[AI-Photo] Generating combined travel photo with Gemini 3.1 Flash Image Preview (Nano Banana 2)...");

      const [finalUserPhotoB64, finalLunaPhotoB64] = await Promise.all([
        ensureRawBase64(userPhoto),
        ensureRawBase64(lunaPhoto)
      ]);

      // Using gemini-3.1-flash-image-preview (Nano Banana 2) for superior image synthesis
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are a world-class travel photographer. I will provide three images:
1. **The Background**: A specific travel location (Street View).
2. **User**: A photo of the traveler.
3. **Luna**: A photo of the travel companion.

**Objective**: Synthesize these into a single, high-end, masterpiece travel photo.
**CRITICAL REQUIREMENTS**:
- **Absolute Background Preservation**: Keep the background image's structure, buildings, and landmarks EXACTLY as they are. DO NOT change the background's identity.
- **Cinematic Quality Enhancement**: Improve the background's clarity, texture, and lighting to match a professional 8K DSLR photo (35mm lens, f/1.8).
- **Natural Integration**: Place both the User and Luna naturally into the foreground or middle ground of the scene. Match the lighting, shadows, and color temperature of the subjects perfectly to the background.
- **Realistic Style**: The final output must look like a real, unedited camera shot, not like a sticker mashup.
- **Output**: Return only the final image data.`
              },
              { inlineData: { mimeType: "image/jpeg", data: cleanBase64(bgBase64) } },
              { inlineData: { mimeType: "image/jpeg", data: finalUserPhotoB64 } },
              { inlineData: { mimeType: "image/jpeg", data: finalLunaPhotoB64 } }
            ]
          }
        ]
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (part: any) => part.inlineData?.mimeType?.startsWith("image/")
      );

      if (imagePart?.inlineData?.data) {
        const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');

        // 장소명을 포함한 안전한 파일명 생성
        const safeLocationName = (req.body.locationName || 'Travel')
          .replace(/[/\\?%*:|"<>]/g, '-') // 특수문자 제거
          .replace(/\s+/g, '_')           // 공백을 언더바로 변경
          .substring(0, 30);              // 길이 제한

        const fileName = `${safeLocationName}_${Date.now()}.jpg`;
        const filePath = path.join(__dirname, 'public', 'photos', fileName);

        // JPG로 저장 (품질 90)
        await sharp(imageBuffer)
          .jpeg({ quality: 90 })
          .toFile(filePath);

        // db.json에 기록
        const settings = JSON.parse(await fs.readFile("db.json", "utf-8"));
        const newPhoto = {
          id: Date.now().toString(),
          url: `/photos/${fileName}`,
          timestamp: Date.now()
        };
        settings.photos = settings.photos || [];
        settings.photos.push(newPhoto);
        await fs.writeFile("db.json", JSON.stringify(settings, null, 2));

        res.json({ base64: imagePart.inlineData.data, url: newPhoto.url });
      } else {
        console.warn("[AI-Photo] No image part in response, checking text response:", response.text);
        res.status(500).json({ error: "No image generated", message: response.text });
      }
    } catch (e: any) {
      console.error("[AI-Photo] Failed:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // 북마크 추가 API
  app.post("/api/bookmarks", async (req, res) => {
    try {
      const { bookmark } = req.body;
      const settings = JSON.parse(await fs.readFile("db.json", "utf-8"));
      settings.bookmarks = settings.bookmarks || [];

      // 이미 같은 장소가 있는지 확인 (이름과 위치 기준)
      const exists = settings.bookmarks.some((b: any) =>
        b.name === bookmark.name &&
        Math.abs(b.location.lat - bookmark.location.lat) < 0.0001
      );

      if (!exists) {
        settings.bookmarks.push({
          ...bookmark,
          id: `bookmark-${Date.now()}`
        });
        await fs.writeFile("db.json", JSON.stringify(settings, null, 2));
      }
      res.json({ success: true, bookmarks: settings.bookmarks });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 북마크 삭제 API
  app.post("/api/delete-bookmark", async (req, res) => {
    try {
      const { bookmarkId } = req.body;
      const settings = JSON.parse(await fs.readFile("db.json", "utf-8"));
      settings.bookmarks = (settings.bookmarks || []).filter((b: any) => b.id !== bookmarkId);
      await fs.writeFile("db.json", JSON.stringify(settings, null, 2));
      res.json({ success: true, bookmarks: settings.bookmarks });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- 데이터베이스(JSON) 관리 API ---
  const DB_PATH = path.join(__dirname, "db.json");

  // DB 읽기 헬퍼
  const getDB = () => {
    try {
      if (!fsSync.existsSync(DB_PATH)) return {};
      return JSON.parse(fsSync.readFileSync(DB_PATH, "utf-8"));
    } catch (e) {
      console.error("[DB] Read error:", e);
      return {};
    }
  };

  // DB 쓰기 헬퍼
  const saveDB = (data: any) => {
    try {
      const current = getDB();
      fsSync.writeFileSync(DB_PATH, JSON.stringify({ ...current, ...data }, null, 2));
    } catch (e) {
      console.error("[DB] Save error:", e);
    }
  };

  app.get("/api/settings", (req, res) => {
    res.json(getDB());
  });

  app.post("/api/settings", (req, res) => {
    saveDB(req.body);
    res.json({ success: true, data: getDB() });
  });

  // 이미지 업로드 API (DB 연동형)
  app.post("/api/upload-image", async (req, res) => {
    try {
      const { image, name, type } = req.body; // type: 'user' | 'luna'
      if (!image) return res.status(400).json({ error: "No image provided" });

      const cleanBase64 = image.includes(",") ? image.split(",")[1] : image;
      const buffer = Buffer.from(cleanBase64, 'base64');
      const fileName = `${Date.now()}_${name || 'upload'}.webp`;
      const uploadDir = path.join(__dirname, "public", "uploads");

      if (!fsSync.existsSync(uploadDir)) fsSync.mkdirSync(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, fileName);

      // sharp를 사용하여 실제 WebP로 변환 및 압축 (품질 80%)
      await sharp(buffer)
        .webp({ quality: 80 })
        .toFile(filePath);

      const url = `/uploads/${fileName}`;
      console.log(`[Server] Image converted/saved as WebP: ${fileName} as ${type}`);

      // DB에 자동 기록
      if (type === 'user') saveDB({ user_photo: url });
      if (type === 'luna') saveDB({ luna_photo: url, luna_custom_photo: url });

      res.json({ url });
    } catch (e: any) {
      console.error("[Upload] Failed:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Google Cloud TTS API
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voiceName = "ko-KR-Neural2-A", speakingRate = 1.0, pitch = 0 } = req.body;
      // Google Cloud TTS는 일반적으로 GCP 범용 키를 사용하므로 지도 API 키를 재사용합니다
      const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.VITE_GEMINI_API_KEY;

      if (!apiKey) throw new Error("API Key missing");
      const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

      const payload = {
        input: { text },
        voice: { languageCode: "ko-KR", name: voiceName },
        audioConfig: { audioEncoding: "MP3", speakingRate, pitch }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.text();
        throw new Error(`TTS API Error: ${errData}`);
      }

      const data = await response.json();
      res.json({ audioContent: data.audioContent });
    } catch (e: any) {
      console.error("[TTS] Failed:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
    // Vite 모드에서도 public/uploads 서빙 보장
    app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Luna-Proxy] Listening on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
