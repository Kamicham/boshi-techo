# 公開版（だれでも体験できる手帳・BOSHI_PUBLIC=1）の像。Fly.io の東京で1台動かし、記録は /data の容量に置く。
# 中身は作った家族の写しだけ（lib/trial.ts）。本物の家族の記録・鍵は .dockerignore で入れない。
# 秘密（ANTHROPIC_API_KEY・BETTER_AUTH_SECRET・BOSHI_KEK）は fly secrets で入れる（像にもリポジトリにも書かない）。
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# 画面の上の「体験版です」の1行は、組み立てる時に入る
ENV NEXT_PUBLIC_BOSHI_PUBLIC=1 NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 BOSHI_PUBLIC=1 BOSHI_DATA_DIR=/data PORT=8080
COPY --from=build /app ./
EXPOSE 8080
CMD ["npx", "next", "start", "-p", "8080", "-H", "0.0.0.0"]
