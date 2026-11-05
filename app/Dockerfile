# 公開版（だれでも体験できる手帳・BOSHI_PUBLIC=1）の像。Fly.io の東京で1台動かし、記録は /data の容量に置く。
# 中身は作った家族の写しだけ（lib/trial.ts）。本物の家族の記録・鍵は .dockerignore で入れない。
# ハッカソンの間は ANTHROPIC_API_KEY を入れない（体験版は Claude を呼ばない＝lib/claude.ts）。秘密は BETTER_AUTH_SECRET と BOSHI_KEK の2つで、
# fly secrets で入れる（像にもリポジトリにも書かない・命令の引数にも載せない）。
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# 画面の上の「体験版です」の1行は、組み立てる時に入る
ENV NEXT_PUBLIC_BOSHI_PUBLIC=1 NEXT_TELEMETRY_DISABLED=1
# 組み立ては3回までやり直す。書体（next/font/google）を Fly の組み立ての機械から取る所が、時々失敗する
# （2026-11-05、Fly で5回中2回・CI でも 25f7ba9 で1回。「An error occurred in next/font. TypeError: Cannot read properties of null」。やり直すと通る）
RUN for i in 1 2 3; do npm run build && break; [ "$i" = 3 ] && exit 1; echo "組み立てが落ちたので、20秒後にやり直します（${i}回目）"; sleep 20; done && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
# 映画を動画にする（lib/film-render.ts）: ffmpeg と、字幕を画像にする時の日本語の字体（丸ゴシックが無い時は Noto Sans CJK）
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-noto-cjk && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 BOSHI_PUBLIC=1 BOSHI_DATA_DIR=/data PORT=8080
COPY --from=build /app ./
EXPOSE 8080
CMD ["npx", "next", "start", "-p", "8080", "-H", "0.0.0.0"]
