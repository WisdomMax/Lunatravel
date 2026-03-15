# 🌌 Luna Travel: AI Travel Companion
**Google Gemini Hackathon 2026 Submission**

---

## 🌍 [English] Project Overview
Luna Travel is an emotional AI companion service that combines the **Gemini 2.5 Multimodal Live API** with **Google Maps**. Beyond just providing information, it offers a new experience of traveling the world virtually, having real-time conversations, and capturing memories through AI-synthesized photos.

## 🛠️ Technical Stack (Tech Proof)
Our project deeply utilizes Google's latest tech stack:

### 1. AI & Multimodal Engine
- **Gemini 2.5 Live**: High-quality real-time audio streaming and multimodal interaction.
- **Gemini 2.5 Flash**: High-performance image synthesis pipeline combining Street View and user photos.
- **Gemini 2.5 Flash Lite**: Persona refinement and system instruction expansion.

### 2. Map & Geospatial
- **Google Maps JavaScript API**: Real-time location tracking and POI integration.
- **Street View Static API**: High-resolution background data for AI photo synthesis.

### 3. Backend & Infrastructure
- **Google Cloud Run**: Serverless container hosting for high scalability.
- **Google Cloud Storage (GCS)**: Persistent storage and serving for AI-generated photos.
- **Google Cloud TTS**: Neural voice implementation for character identity.
- **Firebase / Firestore**: Real-time synchronization of character-specific memories and settings.

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
- **AI**: Gemini 2.5 Live (실시간 대화), Gemini 2.5 Flash (이미지 합성)
- **Maps**: 위치 추적 및 스트리트뷰 연동
- **Infra**: Google Cloud Run, Cloud Storage, Firestore (실시간 동기화)

### 🚀 실행 방법 (How to Run)
1. `npm install`
2. `.env` 파일에 `VITE_GEMINI_API_KEY`, `VITE_GOOGLE_MAPS_API_KEY` 설정
3. `npm run dev` (Local) / `npm run build` (Build)

---

## 📸 Demo & Walkthrough
Detailed screenshots and recordings: [walkthrough.md](./walkthrough.md)
Final Deployment: [https://luna-travel-q5ojdxnhqq-du.a.run.app](https://luna-travel-q5ojdxnhqq-du.a.run.app)
