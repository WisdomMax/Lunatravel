FROM node:20-slim

WORKDIR /app

# sharp 의존성 및 캔버스 관련 라이브러리 설치 (필요시)
RUN apt-get update && apt-get install -y     python3     make     g++     && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

# Vite 빌드 (SPA 프론트엔드 빌드)
RUN npm run build

# 포트 설정
ENV PORT=8080
EXPOSE 8080

# tsx를 사용하여 서버 실행 (dist/server.js가 없는 문제 해결)
# production 모드로 실행하여 dist/ 폴더의 정적 파일을 서빙하도록 함
ENV NODE_ENV=production
CMD ["npx", "tsx", "server.ts"]
