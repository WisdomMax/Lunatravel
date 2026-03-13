FROM node:20-slim

WORKDIR /app

# sharp 의존성 및 캔버스 관련 라이브러리 설치 (필요시)
RUN apt-get update && apt-get install -y     python3     make     g++     && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

# Vite 빌드 (SPA인 경우)
RUN npm run build

# Port 8080은 Cloud Run의 기본값
EXPOSE 8080

CMD ["node", "dist/server.js"]
