# World Explorer - Companion Travel App

구글 맵 스트리트 뷰를 통해 전 세계를 여행하며 컴패니온과 함께하는 웹 애플리케이션입니다.

## 설정 방법

1. Google Cloud Console에서 Google Maps API 키를 발급받습니다.
   - 필수 API: Maps JavaScript API, Places API, Street View Static API
2. 프로젝트 루트에 `.env` 파일을 생성하고 키를 입력합니다.
   ```
   VITE_GOOGLE_MAPS_API_KEY=YOUR_API_KEY_HERE
   ```
3. 라이브러리를 설치합니다.
   ```bash
   npm install
   ```
4. 개발 서버를 실행합니다.
   ```bash
   npm run dev
   ```

## 주요 기능
- **명소 검색**: 상단 검색창에 에펠탑, 뉴욕 타임스퀘어 등을 검색해보세요.
- **컴패니온 상호작용**: 우측 하단의 로봇 캐릭터를 클릭하면 대화를 나눌 수 있습니다.
- **오디오 피드백**: 상호작용 시 즐거운 효과음이 발생합니다.
