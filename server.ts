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
import fs from "fs/promises";
import { existsSync, readFileSync } from "fs"; // 동기 메서드 보관
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin (Firestore & Storage)
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "luna-travel-luna"; 
// [긴급 수정] 실제 존재하는 버킷 이름을 우선 사용하도록 환경 변수 체크 강화
const GCS_BUCKET_NAME = process.env.GCS_BUCKET || "luna-travel-luna-source-bucket"; 

try {
  admin.initializeApp({
    projectId: GCP_PROJECT_ID,
    storageBucket: GCS_BUCKET_NAME
  });
} catch (e) {
  console.error("[Firebase] Init failed:", e);
}

const db = admin.firestore();
const bucket = admin.storage().bucket();
const SETTINGS_COLLECTION = "luna_app";
const SETTINGS_DOC = "global_state";

/**
 * 환경 감지 및 이미지 저장 유틸리티
 * 클라우드 환경(GCS 사용 가능)이면 GCS로, 로컬 환경(권한 없음)이면 로컬 FS로 저장합니다.
 */
async function saveImage(buffer: Buffer, fileName: string, contentType: string, folder: "uploads" | "photos" = "uploads") {
  const isCloud = process.env.NODE_ENV === 'production';
  
  if (isCloud || process.env.K_SERVICE) {
    try {
      const file = bucket.file(`${folder}/${fileName}`);
      await file.save(buffer, {
        metadata: { contentType },
        resumable: false // 작은 파일이므로 resumable 비활성화
      });
      
      // [보완] 명시적으로 공개 권한 부여 (버킷 정책이 Uniform이 아닐 경우 필수)
      try {
        await file.makePublic();
      } catch (e) {
        console.warn(`[Cloud] makePublic failed for ${fileName}, but continuing...`);
      }

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${folder}/${fileName}`;
      console.log(`[Cloud] Saved to GCS: ${publicUrl}`);
      return publicUrl;
    } catch (error) {
      console.error("[Cloud] CRITICAL: GCS Upload failed.", error);
      // 전문가 조언: Cloud Run에서는 로컬 저장이 의미가 없으므로 에러를 던져서 상위에서 처리하게 함
      throw new Error(`GCS Upload Failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Local/Fallback logic
  const localPath = path.join(__dirname, "public", folder, fileName);
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, buffer);
  console.log(`[Local] Saved to FS: ${folder}/${fileName}`);
  return `/${folder}/${fileName}`;
}

/**
 * Firestore 우선, 실패 시 로컬 파일(db.json)에서 데이터를 가져옵니다.
 * [영속성 강화]: 로컬 파일 및 GCS(Google Cloud Storage) 버킷을 모두 스캔하여 사진첩을 자동 복구합니다.
 */
async function getDB() {
  let data: any = {};
  const isCloud = process.env.NODE_ENV === 'production';
  
  try {
    const doc = await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).get();
    if (doc.exists) {
      data = doc.data() || {};
    }
  } catch (e) {}
  
  if (Object.keys(data).length === 0) {
    try {
      const fileContent = await fs.readFile("db.json", "utf-8");
      data = JSON.parse(fileContent);
      console.log("[DB] Loaded from local fallback db.json");
    } catch (e) {
      data = { chat_histories: {}, photo_histories: {}, bookmarks: [] };
    }
  }

  // --- 사진첩 자동 복구 (Self-Healing: Local FS & GCS) ---
  data.photo_histories = data.photo_histories || data.photoHistories || {};
  let wasModified = false;

  const processFileName = (file: string, publicUrl: string) => {
    const parts = file.split('_');
    if (parts.length < 3) return;
    
    const key = parts[0]; // luna-1, luna-2, luna-3, custom 등
    const timestampStr = parts[parts.length - 1].split('.')[0];
    const timestamp = parseInt(timestampStr);
    if (isNaN(timestamp)) return;

    data.photo_histories[key] = data.photo_histories[key] || [];
    const existingIndex = data.photo_histories[key].findIndex((p: any) => p.id === timestampStr);

    if (existingIndex >= 0) {
      // 이미 존재하는데 URL이 로컬 경로(/photos/...)이고 현재 전달된게 GCS 경로라면 업데이트
      if (data.photo_histories[key][existingIndex].url.startsWith('/photos/') && publicUrl.startsWith('http')) {
        data.photo_histories[key][existingIndex].url = publicUrl;
        wasModified = true;
        console.log(`[Healing] Updated ${timestampStr} to GCS URL: ${publicUrl}`);
      }
    } else {
      // 아예 없는 경우 새로 추가
      const photoObj = {
        id: timestampStr,
        url: publicUrl,
        locationName: parts.slice(1, -1).join(' ').replace(/_/g, ' '),
        personaKey: key,
        timestamp: timestamp
      };
      data.photo_histories[key].push(photoObj);
      wasModified = true;
    }
  };

  // 1. 로컬 파일 스캔 (개발 환경 우선)
  try {
    const photosDir = path.join(__dirname, "public", "photos");
    const localFiles = await fs.readdir(photosDir);
    localFiles.forEach(f => processFileName(f, `/photos/${f}`));
  } catch (e) {
    // console.warn("[Recovery] Local photo scan failed (Normal in cloud):", e.message);
  }

  // 2. GCS 버킷 스캔 (Cloud 환경 필수)
  if (isCloud) {
    try {
      console.log("[Recovery] Scanning GCS bucket for missing indices...");
      const [gcsFiles] = await bucket.getFiles({ prefix: 'photos/' });
      gcsFiles.forEach(file => {
        const nameOnly = file.name.replace('photos/', '');
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
        processFileName(nameOnly, publicUrl);
      });
    } catch (e: any) {
      console.warn("[Recovery] GCS scan failed:", e.message);
    }
  }

  if (wasModified) {
    // 캐릭터별 최신순 정렬
    Object.keys(data.photo_histories).forEach(k => {
      data.photo_histories[k].sort((a: any, b: any) => b.timestamp - a.timestamp);
    });
    console.log("[Recovery] Rebuilt photo histories. Persisting results to DB...");
    
    // [전문가 제안 반영] 힐링된 결과를 DB에 즉시 영구 저장하여 인스턴스 재시작 시 엑박 재발 방지
    try {
      // 순환 참조 방지를 위해 saveDB가 아닌 최소한의 Firestore 업데이트 직접 수행
      await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).update({
        photo_histories: data.photo_histories
      });
      console.log("[Recovery] Successfully persisted healed data to Firestore.");
    } catch (e) {
      console.error("[Recovery] Failed to persist healed data:", e);
    }
  }

  return data;
}

/**
 * Firestore와 로컬 파일(db.json) 모두에 데이터를 저장합니다.
 * [격리 강화]: 루트의 history, photos 필드를 제거하여 캐릭터 간 데이터 혼선을 방지합니다.
 */
async function saveDB(updates: any) {
  const currentData = await getDB();
  
  // 1. 업데이트할 데이터 준비 (camelCase -> snake_case 통일 및 데이터 보호)
  const newData = { ...currentData };

  // 명시적 필드 업데이트
  Object.keys(updates).forEach(key => {
    // 보호 로직: 히스토리나 사진첩이 이미 존재하는데 빈 값이 들어오면 무시 (유실 방지)
    const val = updates[key];
    const targetKey = (key === 'chatHistories' || key === 'chat_histories') ? 'chat_histories' : 
                      (key === 'photoHistories' || key === 'photo_histories') ? 'photo_histories' : null;

    if (targetKey) {
      // 1. 서버에 이미 데이터가 있는가?
      const existingMap = newData[targetKey] || {};
      
      // 2. 새로 들어온 데이터가 유효한가? (객체이며, 최소 하나 이상의 키에 데이터가 있는가)
      const hasContent = val && typeof val === 'object' && Object.keys(val).some(k => Array.isArray(val[k]) && val[k].length > 0);
      
      // 3. 서버엔 데이터가 있는데, 들어온 건 비어있다면 -> 덮어쓰기 거부 (유실 방지!)
      if (Object.keys(existingMap).length > 0 && !hasContent) {
        console.warn(`[SaveDB] Blocked wiping ${targetKey} with empty data.`);
        return;
      }
      
      // 4. 안전하다면 병합 또는 업데이트
      newData[targetKey] = { ...existingMap, ...val };
      return;
    }
    
    // 일반 필드 업데이트
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    newData[snakeKey] = val;
  });

  const lunaSelection = newData.luna_selection || "luna-1";
  const storageKey = lunaSelection === "custom" ? "custom" : lunaSelection;

  // 보관함 자동 마이그레이션 (루트 데이터 보호)
  newData.photo_histories = newData.photo_histories || {};
  newData.chat_histories = newData.chat_histories || {};

  if (newData.photos && newData.photos.length > 0) {
    if (!newData.photo_histories[storageKey] || newData.photo_histories[storageKey].length === 0) {
      newData.photo_histories[storageKey] = newData.photos;
      console.log(`[Migration] Migrated ${newData.photos.length} photos to ${storageKey}`);
    }
  }

  // 중복 데이터 및 호환성 필드 정리 (camelCase 필드만 제거하여 Firestore 깔끔하게 유지)
  const fieldsToRemove = [
    'history', 'photos', 
    'lunaSelection', 'lunaPhoto', 'lunaName', 'customType',
    'chatHistories', 'photoHistories', 'lunaPhotos', 'bgmVolume'
  ];
  fieldsToRemove.forEach(f => delete newData[f]);

  try {
    // Firestore에는 merge: false로 설정하여 위에서 명시적으로 처리한 구조가 그대로 반영되게 함
    await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).set(newData);
  } catch (e) {
    console.error("[Firebase] Save failed:", e);
  }
  
  try {
    await fs.writeFile("db.json", JSON.stringify(newData, null, 2));
  } catch (e) {
    console.error("[Local] Save failed:", e);
  }
}

dotenv.config();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' })); // Base64 이미지 수신을 위해 용량 증가
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  dotenv.config({ path: path.join(process.cwd(), '.env') });
  const PORT = Number(process.env.PORT) || 8080; // Cloud Run 기본 포트 대응

  console.log(`[Luna-Server] 🚀 Starting Hackathon Edition on port ${PORT}...`);
  console.log(`[Luna-Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Luna-Server] API Keys Loaded: Gemini:${!!process.env.VITE_GEMINI_API_KEY}, Maps:${!!process.env.VITE_GOOGLE_MAPS_API_KEY}`);

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

  // [안정성] WebSocket 연결 유지를 위한 하트비트 (Cloud Run 타임아웃 방지)
  const interval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 15000); // 15초로 단축 (Cloud Run 연결 유지 강화)

  wss.on("close", () => {
    clearInterval(interval);
  });

  // Proxy logic
  wss.on("connection", (clientWs: any) => {
    clientWs.isAlive = true;
    clientWs.on('pong', () => { clientWs.isAlive = true; });

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

    const upstreamHeartbeat = setInterval(() => {
      if (geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.ping();
      }
    }, 20000);

    geminiWs.on("message", (data: any) => {
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
      clearInterval(upstreamHeartbeat);
    });

    clientWs.on("message", (data: any) => {
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
  // StreetView 이미지 획득을 위한 내부 헬퍼 함수
  async function getStreetViewImageData(query: any) {
    // 프론트엔드에서 키를 못 보냈을 경우를 대비해 서버측 키 우선 사용
    const key = process.env.VITE_GOOGLE_MAPS_API_KEY || query.key;
    
    if (!key) throw new Error("Google Maps API Key is missing on server.");

    let url = `https://maps.googleapis.com/maps/api/streetview?location=${query.lat},${query.lng}&size=600x400&key=${key}`;
    if (query.heading) url += `&heading=${query.heading}`;
    if (query.pitch) url += `&pitch=${query.pitch}`;

    console.log(`[StreetView] Fetching from Google: ${query.lat},${query.lng} (KeyPresent: ${!!key})`);
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`StreetView API failed (${response.status}): ${errorText || response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  }

  app.get("/api/streetview", async (req, res) => {
    try {
      const base64 = await getStreetViewImageData(req.query);
      res.json({ base64 });
    } catch (e: any) {
      console.error("[StreetView] Proxy Error:", e.message);
      res.status(500).send("StreetView Proxy Failed");
    }
  });

  // AI Travel Photo Generation
  app.post("/api/generate-travel-photo", async (req, res) => {
    try {
      const { backgroundImage, userPhoto, lunaPhoto, customPrompt } = req.body;
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
              path.join(process.cwd(), 'public', cleanSrc),
              path.join(process.cwd(), cleanSrc),
              path.join(__dirname, 'public', cleanSrc),
              path.join(__dirname, cleanSrc)
            ];

            for (const localPath of possiblePaths) {
              try {
                // console.log(`[AI-Photo] Checking local path: ${localPath}`);
                await fs.access(localPath);
                const data = await fs.readFile(localPath);
                console.log(`[AI-Photo] Successfully read local file: ${localPath} (${data.length} bytes)`);
                return data.toString('base64');
              } catch (e) {
                // File not found, try next path
              }
            }
            console.warn(`[AI-Photo] Local file not found for ${src} in any of: ${possiblePaths.join(', ')}`);
          }
        } catch (e) {
          console.error(`[AI-Photo] ensureRawBase64 failed for ${src}:`, e);
        }
        return src; // Fallback
      };

      // --- 사진 데이터 준비 프로세스 (철저한 Base64 보장) ---
      let bgBase64 = "";
      try {
        console.log(`[AI-Photo] Processing background: ${backgroundImage.substring(0, 100)}...`);
        if (backgroundImage.startsWith('/api/streetview')) {
          const urlObj = new URL(backgroundImage, `http://localhost:${PORT}`);
          const query = Object.fromEntries(urlObj.searchParams.entries());
          bgBase64 = await getStreetViewImageData(query);
          console.log(`[AI-Photo] SV Internal Success: ${bgBase64.length} bytes`);
        } else if (backgroundImage.startsWith('http')) {
          const resp = await fetch(backgroundImage);
          if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
          const buffer = await resp.arrayBuffer();
          bgBase64 = Buffer.from(buffer).toString('base64');
          console.log(`[AI-Photo] Remote Fetch Success: ${bgBase64.length} bytes`);
        } else if (backgroundImage.startsWith('data:image')) {
          bgBase64 = cleanBase64(backgroundImage);
        } else {
          bgBase64 = await ensureRawBase64(backgroundImage);
        }

        // 최종 데이터 무결성 체크 (JPEG Base64는 /9j/로 시작하므로 경로 문자열과 구분 필요)
        if (!bgBase64 || bgBase64.length < 100 || (bgBase64.length < 500 && (bgBase64.startsWith('http') || bgBase64.startsWith('/api')))) {
          throw new Error(`Invalid base64 payload detected for background. Size: ${bgBase64.length}`);
        }
      } catch (err: any) {
        console.error("[AI-Photo] Background processing CRITICAL ERROR:", err.message);
        return res.status(500).json({ error: "Background processing failed", message: err.message });
      }

      const [finalUserPhotoB64, finalLunaPhotoB64] = await Promise.all([
        ensureRawBase64(userPhoto),
        ensureRawBase64(lunaPhoto)
      ]);

      // 사용자/루나 사진 데이터 유효성 개별 체크 (Base64는 /9j/로 시작할 수 있으므로 단순 / 체크 제거)
      if (!finalUserPhotoB64 || finalUserPhotoB64.length < 100 || (finalUserPhotoB64.length < 500 && finalUserPhotoB64.startsWith('http'))) {
        return res.status(400).json({ error: "Invalid User Photo", message: "User photo is missing or invalid format." });
      }
      if (!finalLunaPhotoB64 || finalLunaPhotoB64.length < 100 || (finalLunaPhotoB64.length < 500 && finalLunaPhotoB64.startsWith('http'))) {
        return res.status(400).json({ error: "Invalid Luna Photo", message: "Luna photo is missing or invalid format." });
      }

      console.log("[AI-Photo] All images validated. Calling Gemini 3.1 Flash for synthesis...");

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
${customPrompt && customPrompt.trim().length > 0 ? `**SPECIAL USER REQUEST (HIGH PRIORITY)**: ${customPrompt}\n` : ''}**CRITICAL REQUIREMENTS**:
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

        const personaKey = req.body.personaKey || 'custom';
        const storageKey = personaKey === 'custom' ? 'custom' : personaKey;
        
        const fileName = `${storageKey}_${safeLocationName}_${Date.now()}.jpg`;

        // JPEG로 변환 (사용자 요청 반영)
        const jpgBuffer = await sharp(imageBuffer)
          .jpeg({ quality: 90 })
          .toBuffer();

        // GCS 또는 로컬로 저장
        const publicUrl = await saveImage(jpgBuffer, fileName, "image/jpeg", "photos");
        console.log(`[AI-Photo] Generated and saved: ${publicUrl}`);

        // 3. 사진을 캐릭터별 격리 저장소에 기록 (snake_case 필드 사용)
        const settings = await getDB();
        
        const newPhoto = {
          id: Date.now().toString(),
          url: publicUrl,
          locationName: req.body.locationName || 'Travel',
          personaKey: personaKey,
          customPrompt: customPrompt || null,
          timestamp: Date.now()
        };

        settings.photo_histories = settings.photo_histories || {};
        settings.photo_histories[storageKey] = settings.photo_histories[storageKey] || [];
        settings.photo_histories[storageKey].unshift(newPhoto); // 최신순

        // [중요] 루트 photos 필드는 더이상 사용하지 않음 (격리 파괴 방지)
        if (settings.photos) delete settings.photos; 

        await saveDB(settings); 

        res.json({ url: newPhoto.url });
      } else {
        console.warn("[AI-Photo] No image part in response. Full response candidates:", JSON.stringify(response.candidates, null, 2));
        const textContent = response.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || "No text explanation provided by AI.";
        res.status(500).json({ error: "No image generated", message: textContent });
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
      const settings = await getDB();
      settings.bookmarks = settings.bookmarks || [];

      // 이미 같은 장소가 있는지 확인
      const exists = settings.bookmarks.some((b: any) =>
        b.name === bookmark.name &&
        Math.abs(b.location.lat - bookmark.location.lat) < 0.0001
      );

      if (!exists) {
        settings.bookmarks.push({
          ...bookmark,
          id: `bookmark-${Date.now()}`
        });
        await saveDB(settings);
      }
      res.json({ success: true, bookmarks: settings.bookmarks });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 사진 삭제 API
  app.post("/api/delete-photo", async (req, res) => {
    try {
      const { photoId } = req.body;
      const settings = await getDB();
      
      if (settings.photo_histories) {
        // 모든 캐릭터(luna-1, luna-2, custom 등)의 사진첩에서 해당 ID를 삭제
        Object.keys(settings.photo_histories).forEach(key => {
          if (Array.isArray(settings.photo_histories[key])) {
            settings.photo_histories[key] = settings.photo_histories[key].filter((p: any) => p.id !== photoId);
          }
        });
        await saveDB(settings);
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error("[Delete-Photo] Failed:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // 북마크 삭제 API
  app.post("/api/delete-bookmark", async (req, res) => {
    try {
      const { bookmarkId } = req.body;
      const settings = await getDB();
      settings.bookmarks = (settings.bookmarks || []).filter((b: any) => b.id !== bookmarkId);
      await saveDB(settings);
      res.json({ success: true, bookmarks: settings.bookmarks });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/settings", async (req, res) => {
    res.json(await getDB());
  });

  app.post("/api/settings", async (req, res) => {
    await saveDB(req.body);
    res.json({ success: true, data: await getDB() });
  });

  // 이미지 업로드 API (DB 연동형)
  app.post("/api/upload-image", async (req, res) => {
    try {
      const { image, name, type } = req.body; 
      if (!image) return res.status(400).json({ error: "No image provided" });

      const cleanBase64 = image.includes(",") ? image.split(",")[1] : image;
      const buffer = Buffer.from(cleanBase64, 'base64');
      
      // 사용자 요청 및 파일명 규칙 반영: JPG로 저장
      const fileName = type === 'user' ? 'user_photo.jpg' : 'luna_custom_photo.jpg';
      
      const jpgBuffer = await sharp(buffer)
        .jpeg({ quality: 95 })
        .toBuffer();

      // GCS 또는 로컬로 저장
      const url = await saveImage(jpgBuffer, fileName, "image/jpeg", "uploads");
      console.log(`[Server] Image saved: ${url} as ${type}`);

      // DB에 자동 기록 (루나의 경우 luna_photos 객체 필드도 함께 업데이트)
      if (type === 'user') await saveDB({ user_photo: url });
      if (type === 'luna') {
        const currentDB = await getDB();
        const lunaPhotos = currentDB.luna_photos || {};
        await saveDB({ 
          luna_photo: url, 
          luna_custom_photo: url,
          luna_photos: { ...lunaPhotos, custom: url } 
        });
      }

      res.json({ url });
    } catch (e: any) {
      console.error("[Upload] Failed:", e);
      res.status(500).json({ error: e.message });
    }
  });
 
  // 캐릭터 페르소나 보강 API (Gemini 2.0 Flash 사용)
  app.post("/api/refine-persona", async (req, res) => {
    try {
      const { prompt, type } = req.body;
      const apiKey = process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const ai = new GoogleGenAI({ apiKey });

      const systemPrompt = `You are an expert AI game writer specializing in character design. 
Your task is to take a brief user prompt describing a travel companion and expand it into a detailed system instruction for an AI agent.
The expanded persona must be LANGUAGE-AGNOSTIC but PERSONALITY-RICH.

Key Rules for Persona Creation:
1. Focus on RELATIONSHIPS & PERSONALITY: Describe how the AI should react and feel (e.g., "Like a devoted daughter", "A blunt best friend", "Cheerful and sweet").
2. DO NOT FORCE SPECIFIC GRAMMAR: Avoid language-specific instructions like "Use polite Korean '-해요체'". Instead, use "Always maintain a polite and respectful tone".
3. DYNAMIC ADDRESSING: If the user indicates a relationship (like "Dad", "Honey", "Brother"), instruct the AI to use the appropriate term in whatever language the user is speaking.
4. Output Language: Return the final detailed system instruction text ONLY in English. (This ensures the model's core reasoning is consistent, while other rules handle the user's language).

Input Details:
- Type: ${type}
- Brief Description: ${prompt}

Output: Return ONLY the final detailed system instruction text in English. Make it warm, immersive, and very specific about characters, emotions, and the special bond with the traveler.`;

      const response = await ai.models.generateContent({
        model: "models/gemini-3.1-flash-lite-preview",
        config: {
          systemInstruction: { parts: [{ text: systemPrompt }] }
        },
        contents: [{ role: 'user', parts: [{ text: `Expand this brief description into a professional AI persona: ${prompt}` }] }]
      });

      const persona = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Failed to generate refined persona guidance.";
      
      console.log(`[Persona-Refine] Refined from "${prompt}" to detailed persona.`);
      res.json({ persona });
    } catch (e: any) {
      console.error("[Persona-Refine] Failed:", e);
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

  // [최후의 보루] 물리 파일 직접 스캔 API: DB 명단이 꼬여도 파일만 있으면 리스트를 쏴줌
  app.get("/api/photos/list", async (req, res) => {
    try {
      const photosDir = path.join(__dirname, "public", "photos");
      const files = await fs.readdir(photosDir);
      
      const photoHistories: Record<string, any[]> = {};
      
      files.forEach(file => {
        if (!file.endsWith('.jpg') && !file.endsWith('.webp')) return;
        const parts = file.split('_');
        if (parts.length < 3) return;
        
        const key = parts[0];
        const timestampStr = parts[parts.length - 1].split('.')[0];
        const locationName = parts.slice(1, -1).join(' ').replace(/_/g, ' ');
        
        const photoObj = {
          id: timestampStr,
          url: `/photos/${file}`,
          locationName: locationName,
          personaKey: key,
          timestamp: parseInt(timestampStr)
        };
        
        photoHistories[key] = photoHistories[key] || [];
        photoHistories[key].push(photoObj);
      });

      // 최신순 정렬
      Object.keys(photoHistories).forEach(k => {
        photoHistories[k].sort((a, b) => b.timestamp - a.timestamp);
      });

      res.json({ photoHistories });
    } catch (e) {
      res.json({ photoHistories: {} });
    }
  });

  // BGM 오디오 파일 목록 조회 API
  app.get("/api/audio-list", async (req, res) => {
    try {
      const audioDir = path.join(__dirname, "public", "assets", "bgm");
      const files = await fs.readdir(audioDir);
      const mp3Files = files
        .filter(file => file.toLowerCase().endsWith(".mp3"))
        .map(file => ({
          name: file.replace(".mp3", ""),
          url: `/assets/bgm/${file}`
        }));
      res.json(mp3Files);
    } catch (e) {
      res.json([]);
    }
  });
  // Vite / Static Assets
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "dist")));
    app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
    app.use("/photos", express.static(path.join(__dirname, "public", "photos")));
    app.use("/assets", express.static(path.join(__dirname, "public", "assets")));
  } else {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
    app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
    app.use("/photos", express.static(path.join(__dirname, "public", "photos")));
    app.use("/assets", express.static(path.join(__dirname, "public", "assets")));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Luna-Proxy] Listening on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
