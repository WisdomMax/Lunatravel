# 🏆 Google Hackathon: Luna Travel Submission Guide
**Google Gemini Hackathon 2026 Submission**

---

## 🌍 [English] Submission Strategy
To maximize your chances at the Google Hackathon, highlight the technological depth and innovation of **Luna Travel**.

### 🔹 Key Tech Proofs
1. **Gemini 2.5 Live (Multimodal)**: High-speed real-time interaction loop for natural dialogue and map control.
2. **Gemini 3.1 Flash (Image Synthesis)**: Specialized pipeline using **Gemini 3.1** (Nano Banana) for professional-grade DSLR photo synthesis blending Street View and portraits.
3. **Advanced State Management**: Managing isolated memories for 4 distinct personas using Gemini 3.1 Flash-Lite.
4. **Hybrid Persistence Strategy**: Dual-syncing between local `db.json` and Cloud Firestore to ensure memory permanence and character-specific isolation.
5. **Natural Audio Loop**: Seamless end-to-end voice interaction (User Audio -> Gemini Live -> TTS -> Voice Output).

### 🔹 Resilience Story (Critical Features)
- **Character Isolation**: 4 distinct personalities (Luna 1-3, Custom) managed via an 1100-line React Context.
- **Connection Stability**: Overcame network instability with a robust Node.js Proxy and heartbeat logic.
- **Self-healing Assets**: Automatic GCS path recovery for persistent photo links.

---

## 🇰🇷 [Korean] 제출 전략 가이드

### 📝 핵심 기술 포인트
1. **완전한 실시간 멀티모달**: Gemini 2.5 Live를 통한 제로 레이턴시 수준의 음성 교감.
2. **지능형 추억 합성**: 스트리트뷰 배경과 사용자 사진을 고화질로 합성하는 독자적 파이프라인.
3. **캐릭터 격리 기억**: 4명의 캐릭터가 각각 다른 기억을 갖는 정교한 상태 관리 시스템.

---

## 🏗️ Architecture Layout
| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | Google Maps SDK | Real-time map & POI interaction |
| **AI Engine** | Gemini 2.5 Live / Flash | Dialogue & Photo Synthesis |
| **Storage** | Google Cloud Storage | AI-generated Asset Cloud Storage |
| **Database** | Google Firestore | Real-time Character State Sync |

---

## 🏁 Final Checklist
- [ ] **GitHub Repo**: Dual-language README included.
- [ ] **Demo Video**: Showcasing real-time conversation and photo synthesis.
- [ ] **Live URL**: Service verified on Cloud Run: [https://luna-travel-513687662188.asia-northeast3.run.app](https://luna-travel-513687662188.asia-northeast3.run.app)
