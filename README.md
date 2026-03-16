# 🌌 Luna Travel: AI Travel Companion
**Google Gemini Hackathon 2026 Submission**

---

## 🌍 [English] Project Overview
Luna Travel is an emotional AI companion service that combines the **Gemini 2.5 Multimodal Live API** with **Google Maps**. Beyond just providing information, it offers a new experience of traveling the world virtually, having real-time conversations, and capturing memories through AI-synthesized photos.

## 🏗️ System Architecture
![Luna Travel Architecture](./architecture_diagram.png)

## 🛠️ Technical Stack (Tech Proof)
Our project deeply utilizes Google's latest tech stack:

### 1. AI & Multimodal Engine
- **Gemini 2.5 Live (Multimodal)**: High-speed real-time interaction loop for natural dialogue and map control.
- **Gemini 3.1 Flash (Image Synthesis)**: Specialized pipeline using **Gemini 3.1** (Nano Banana) for professional-grade DSLR photo synthesis blending Street View and portraits.
- **Gemini 3.1 Flash Lite**: Advanced persona management and character-specific isolation.

### 2. Map & Geospatial
- **Google Maps JavaScript API**: Real-time location tracking and POI integration.
- **Street View Static API**: High-resolution background data for AI photo synthesis.

### 3. Backend & Infrastructure
- **Google Cloud Run**: Serverless container hosting for high scalability.
- **Google Cloud Storage (GCS)**: Persistent storage and serving for AI-generated photos.
- **Google Cloud TTS**: Neural voice implementation for character identity.
- **Firebase / Firestore**: Real-time synchronization of character-specific memories and settings.

---

## 🔍 Technical Evidence: Key Files & Logic
For the hackathon judges, here are the direct links to the core logic implementing Google's technologies:

### 1. Gemini Multimodal Live API Implementation
- **[geminiLiveService.ts](./src/services/geminiLiveService.ts)**: Core service for handling bidirectional WebSocket audio streaming and tool orchestration.
- **[server.ts L300-L450](./server.ts)**: Node.js secure proxy with custom **Heartbeat logic** and API key management for Gemini Live.

### 2. Intelligent Image Synthesis Pipeline
- **[server.ts L510-L650](./server.ts)**: The primary pipeline for **Gemini 3.1 Flash** DSLR-quality photo synthesis, blending Street View backdrops and user portraits.
- **[TravelContext.tsx (takeTravelPhoto)](./src/context/TravelContext.tsx)**: Logic for triggering photogenic moments and managing asset metadata.

### 3. Real-time Map & Persona State Management
- **[TravelContext.tsx](./src/context/TravelContext.tsx)**: A comprehensive state manager (1100+ lines) handling **Character Isolation** (Luna 1-3) and **Hybrid Persistence** (Local <-> Firestore).
- **[StreetViewCanvas.tsx](./src/components/StreetViewCanvas.tsx)**: Deep integration of Google Maps SDK and Street View Static API for immersive visuals.

### 4. Self-healing & Cloud Resilience
- **[server.ts (Self-healing logic)](./server.ts)**: Automated routine to restore broken asset links from GCS upon server startup.
- **[.gitignore](./.gitignore)**: Security reinforcement to ensure no API keys or local DBs are exposed.

---

## 🧪 Validation & Reproduction
### 1. Build Check
- `npm run build` generates the `dist` folder without errors (Vite v6 optimized).
### 2. Verification
- **Real-time**: WebSocket connection to `api/ws-gemini` for <200ms latency audio response.
- **Synthesis**: Photos are generated using Gemini 2.5 Flash and saved directly to GCS.

---

## 🇰🇷 [Korean] 프로젝트 개요
Luna Travel은 **Gemini 2.5 Multimodal Live API**와 **Google Maps**를 결합하여, 실시간으로 대화하며 함께 세계를 여행하는 감성적인 AI 동반자 서비스입니다.

### 🛠️ 기술 스택
- **AI Engine**: Gemini 2.5 Live (실시간 인터랙션), **Gemini 3.1 Flash** (고화질 이미지 합성)
- **Maps Ecosystem**: Google Maps JS SDK, Street View Static API 연동
- **Core Infra**: Google Cloud Run, Cloud Storage, Firestore (Hybrid Persistence)

### 🚀 실행 방법 (How to Run)
1. `npm install`
2. `.env` 파일에 `VITE_GEMINI_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY` 설정
3. `npm run dev` (Local) / `npm run build` (Build)

---

## 📸 Demo & Walkthrough
Detailed screenshots and recordings: [walkthrough.md](./walkthrough.md)
Final Deployment: [https://luna-travel-q5ojdxnhqq-du.a.run.app](https://luna-travel-q5ojdxnhqq-du.a.run.app)
