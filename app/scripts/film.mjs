#!/usr/bin/env node
// 動画集（約2分・720p）を Mac の ffmpeg で書き出す。台本は一冊の film（lib/book.ts。Claude は写真の文字だけを見て書いた）。
// - 写真はゆっくり寄る動き（zoompan）、つなぎは xfade（FFmpeg Filters ドキュメント 2025）
// - 日本語の字幕と表紙・結びの板は、HTML を Playwright（Chromium）で PNG にして重ねる（ffmpeg の書体の問題を避ける）
// - 曲は付けない（権利のはっきりした物を選ぶまで）
// - 写真は書き出しの間だけ一時フォルダ（自分だけが読める）に置き、終わったら消す。外へは送らない
//
// 使い方:
//   node scripts/film.mjs --base http://localhost:3100 --family sim-01 [--today 2027-09-01] [--out 置き場/film.mp4]
//     一冊（GET /api/book）と写真（GET /api/media/<id>?v=view）をアプリから読む。
//     ログインの要る世帯は、Cookie を環境変数 BOSHI_FILM_COOKIE に入れる（命令の引数に秘密を書かない）。
//   node scripts/film.mjs --test [--out 置き場/film-test.mp4]
//     作った色の板3枚で、短い動画（約7秒）を作って確かめる（本物の写真は使わない）。
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FFMPEG = fs.existsSync("/opt/homebrew/bin/ffmpeg") ? "/opt/homebrew/bin/ffmpeg" : "ffmpeg";
const FFPROBE = fs.existsSync("/opt/homebrew/bin/ffprobe") ? "/opt/homebrew/bin/ffprobe" : "ffprobe";
const W = 1280;
const H = 720;
const FPS = 30;
const FADE = 0.6;
const MAX_SEC = 120;

function args() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith("--")) continue;
    const k = a[i].slice(2);
    const v = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : "1";
    o[k] = v;
  }
  return o;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// style="…" の中に入れるので、書体の名前は一重の引用符で囲む
const FONT = `'Hiragino Maru Gothic ProN', 'Hiragino Sans', 'Noto Sans JP', sans-serif`;

/** 字幕（透明の板・下に文字）と、表紙・結びの板（不透明）を PNG にする */
async function renderCards(cards, dir) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    const out = [];
    for (const [i, c] of cards.entries()) {
      const file = path.join(dir, `card-${String(i).padStart(3, "0")}.png`);
      const html =
        c.kind === "caption"
          ? `<html><body style="margin:0;width:${W}px;height:${H}px;background:transparent;display:flex;align-items:flex-end;justify-content:center;font-family:${FONT}">
               <div style="margin-bottom:56px;max-width:1080px;padding:14px 28px;border-radius:14px;background:rgba(0,0,0,.42);color:#fff;font-size:38px;line-height:1.5;text-align:center;font-weight:700">${esc(c.text)}</div></body></html>`
          : `<html><body style="margin:0;width:${W}px;height:${H}px;background:#fbfaf6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;font-family:${FONT};color:#2b2a33">
               ${c.eyebrow ? `<div style="font-size:24px;letter-spacing:.4em;color:#c2557a">${esc(c.eyebrow)}</div>` : ""}
               <div style="font-size:60px;font-weight:700;max-width:1100px;text-align:center;line-height:1.4">${esc(c.text)}</div>
               ${c.sub ? `<div style="font-size:30px;color:#6a6876;max-width:1000px;text-align:center;line-height:1.6">${esc(c.sub)}</div>` : ""}
               ${c.note ? `<div style="position:absolute;bottom:28px;font-size:20px;color:#6a6876">${esc(c.note)}</div>` : ""}</body></html>`;
      await page.setContent(html);
      await page.screenshot({ path: file, omitBackground: c.kind === "caption" });
      out.push(file);
    }
    return out;
  } finally {
    await browser.close();
  }
}

/** 写真1枚の場面（ゆっくり寄る＋字幕） */
async function photoClip(img, cap, sec, out, i) {
  const frames = Math.round(sec * FPS);
  // 偶数番は寄る・奇数番は少し引く（単調にしない）
  const z = i % 2 === 0 ? `min(zoom+0.0007,1.15)` : `if(eq(on,0),1.15,max(zoom-0.0007,1.0))`;
  const vf =
    `[0:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},` +
    `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${W}x${H}:fps=${FPS},setsar=1[bg];` +
    `[bg][1:v]overlay=0:0,format=yuv420p[v]`;
  await run(FFMPEG, ["-v", "error", "-y", "-i", img, "-i", cap, "-filter_complex", vf, "-map", "[v]", "-frames:v", String(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", String(FPS), out], {
    maxBuffer: 16 * 1024 * 1024,
  });
}

/** 板だけの場面（表紙・結び） */
async function cardClip(card, sec, out) {
  await run(FFMPEG, ["-v", "error", "-y", "-loop", "1", "-t", String(sec), "-i", card, "-vf", `scale=${W}:${H},format=yuv420p,setsar=1`, "-r", String(FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", out]);
}

/** 場面を xfade でつなぐ */
async function join(clips, secs, out) {
  if (clips.length === 1) {
    fs.copyFileSync(clips[0], out);
    return;
  }
  const inputs = clips.flatMap((c) => ["-i", c]);
  const parts = [];
  let prev = "[0:v]";
  let offset = 0;
  for (let i = 1; i < clips.length; i++) {
    offset += secs[i - 1] - FADE;
    const label = i === clips.length - 1 ? "[v]" : `[x${i}]`;
    parts.push(`${prev}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}${label}`);
    prev = label;
  }
  await run(FFMPEG, ["-v", "error", "-y", ...inputs, "-filter_complex", parts.join(";"), "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], {
    maxBuffer: 16 * 1024 * 1024,
  });
}

/**
 * 台本から動画を作る。scenes: [{ img, caption, sec }]。title・end は板の文字
 * 合わせて MAX_SEC（2分）まで（それより後の写真は落とす）
 */
export async function makeFilm({ scenes, title, end, out, note }) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-film-"));
  fs.chmodSync(work, 0o700);
  try {
    const kept = [];
    let total = 3 + 3;
    for (const s of scenes) {
      if (total + s.sec > MAX_SEC) break;
      kept.push(s);
      total += s.sec;
    }
    const cards = [
      { kind: "board", eyebrow: "1000 日 の 記 録", text: title.text, sub: title.sub, note },
      ...kept.map((s) => ({ kind: "caption", text: s.caption })),
      { kind: "board", text: end.text, sub: end.sub, note },
    ];
    const pngs = await renderCards(cards, work);
    const clips = [];
    const secs = [];
    await cardClip(pngs[0], 3, path.join(work, "c-000.mp4"));
    clips.push(path.join(work, "c-000.mp4"));
    secs.push(3);
    for (const [i, s] of kept.entries()) {
      const f = path.join(work, `c-${String(i + 1).padStart(3, "0")}.mp4`);
      await photoClip(s.img, pngs[i + 1], s.sec, f, i);
      clips.push(f);
      secs.push(s.sec);
      process.stdout.write(`\r場面 ${i + 1}/${kept.length}`);
    }
    process.stdout.write("\n");
    const last = path.join(work, "c-end.mp4");
    await cardClip(pngs[pngs.length - 1], 3, last);
    clips.push(last);
    secs.push(3);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await join(clips, secs, out);
    return { out, scenes: kept.length, sec: secs.reduce((a, b) => a + b, 0) - FADE * (secs.length - 1) };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

async function probe(file) {
  const { stdout } = await run(FFPROBE, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file]);
  const j = JSON.parse(stdout);
  return { w: j.streams?.[0]?.width, h: j.streams?.[0]?.height, sec: Number(j.format?.duration) };
}

const ymd = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");

/** 試験: 作った色の板3枚（横・縦・正方形）で短く作り、大きさと長さを確かめる */
async function test(o) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-film-test-"));
  try {
    const shapes = [
      ["pink", "640x480"],
      ["skyblue", "480x800"],
      ["wheat", "600x600"],
    ];
    const scenes = [];
    for (const [i, [c, s]] of shapes.entries()) {
      const img = path.join(tmp, `p${i}.jpg`);
      await run(FFMPEG, ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=${c}:s=${s}`, "-frames:v", "1", img]);
      scenes.push({ img, sec: 2, caption: ["おなかにいた日々", "生まれた日・はじめまして", "はじめての一年"][i] });
    }
    const out = o.out ?? path.join(tmp, "film-test.mp4");
    const r = await makeFilm({ scenes, title: { text: "試験の一本", sub: "作った板だけ" }, end: { text: "おわり" }, out, note: "試験（作った画像）" });
    const p = await probe(out);
    const want = 3 + 2 * 3 + 3 - FADE * 4;
    const ok = p.w === W && p.h === H && Math.abs(p.sec - want) < 0.5;
    console.log(`${ok ? "OK" : "NG"}: ${p.w}x${p.h}・${p.sec.toFixed(2)}秒（見込み ${want.toFixed(2)}秒）・場面 ${r.scenes} → ${out}`);
    if (!o.out) fs.rmSync(out, { force: true });
    if (!ok) process.exitCode = 1;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** アプリから一冊と写真を読んで作る */
async function fromApp(o) {
  const base = (o.base ?? "http://localhost:3100").replace(/\/+$/, "");
  const fid = o.family;
  if (!fid) throw new Error("--family が要ります");
  const headers = process.env.BOSHI_FILM_COOKIE ? { cookie: process.env.BOSHI_FILM_COOKIE } : {};
  const q = new URLSearchParams({ familyId: fid, ...(o.today ? { today: o.today } : {}) });
  const r = await fetch(`${base}/api/book?${q}`, { headers });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `一冊を読めませんでした（${r.status}）`);
  const book = j.book;
  if (!book) throw new Error("まだ一冊がありません（一冊の画面で作ってから）");
  let film = Array.isArray(book.film) ? book.film : [];
  if (!film.length) film = (book.chapters ?? []).flatMap((ch) => (ch.photos ?? []).map((p) => ({ mediaId: p.mediaId, sec: 4, caption: p.line || ch.title })));
  if (!film.length) throw new Error("動画集に使う写真がありません（アルバムに写真を残して、一冊を作り直す）");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-film-photos-"));
  fs.chmodSync(tmp, 0o700);
  try {
    const scenes = [];
    for (const [i, x] of film.entries()) {
      const res = await fetch(`${base}/api/media/${encodeURIComponent(x.mediaId)}?familyId=${encodeURIComponent(fid)}&v=view`, { headers });
      if (!res.ok) continue; // 消した写真は飛ばす
      const img = path.join(tmp, `p${String(i).padStart(3, "0")}.jpg`);
      fs.writeFileSync(img, Buffer.from(await res.arrayBuffer()), { mode: 0o600 });
      scenes.push({ img, sec: Math.min(6, Math.max(3, Number(x.sec) || 4)), caption: x.caption ?? "" });
    }
    if (!scenes.length) throw new Error("写真を読めませんでした");
    const dataDir = process.env.BOSHI_DATA_DIR ?? path.join(APP, "sim-data");
    const out = o.out ?? path.join(dataDir, "exports", `film-${fid}-${ymd()}.mp4`);
    const closing = String(book.closing ?? "").split(/(?<=。)/)[0] || "またね";
    const made = fid === "demo-sato" || fid.startsWith("sim-") || fid.startsWith("pop-");
    const r2 = await makeFilm({
      scenes,
      title: { text: book.title ?? "1000日の記録", sub: `${book.childName ?? ""}へ` },
      end: { text: closing },
      out,
      note: made ? "AI で作った家族と写真です" : undefined,
    });
    console.log(`できました: ${r2.out}（場面 ${r2.scenes}・約${Math.round(r2.sec)}秒）`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const o = args();
(o.test ? test(o) : fromApp(o)).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
