// 録音を文字にする（自宅の GPU の機械で動く asr/server.py を呼ぶ）。
// 音声は家のネットワークの外に出ない。
import "server-only";
import http from "node:http";
import { publicOn } from "./trial-cookie";

export interface Transcript {
  text: string;
  /** 文字起こしの機械が無い環境（審査員の手元など）で、用意したデモの文を返した時 */
  demo?: boolean;
  segments: { start: number; end: number; text: string }[];
  duration: number;
  elapsed: number;
}

/** 1時間の録音でも待てるよう、fetch（返事の頭まで300秒で切れる）ではなく http で送る */
function post(url: URL, headers: Record<string, string>, payload: Buffer, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method: "POST", headers: { ...headers, "content-length": String(payload.length) } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error("文字起こしが時間内に終わりませんでした")));
    req.on("error", reject);
    req.end(payload);
  });
}

/** 機械が無い時に返すデモの文（健診は用意した健診の会話、ひとことは短い記録） */
const DEMO_NOTE = "今日は夜に胎動をたくさん感じた。お腹が少し張ったので、早めに横になった。";

export async function transcribe(audio: Buffer, prompt?: string, kind: "visit" | "note" = "note"): Promise<Transcript> {
  const base = process.env.ASR_URL;
  // 体験版（公開版）は声を文字にしない（だれの声も、文字起こしの機械へ送らない。2026-11-05）
  if (!base || publicOn()) {
    // 審査員がリポジトリを手元で動かしても、健診の1日を最後まで試せるようにする
    const { DEMO_TRANSCRIPT } = await import("@/components/visit/demoTranscript");
    const text = kind === "visit" ? DEMO_TRANSCRIPT : DEMO_NOTE;
    return { text, segments: [{ start: 0, end: 1, text }], duration: 0, elapsed: 0, demo: true };
  }
  const headers: Record<string, string> = { "content-type": "application/octet-stream" };
  // 専門用語の聞き取りを助けるヒント（日本語は 16 進にして送る）
  if (prompt) headers["x-prompt"] = Buffer.from(prompt.slice(0, 400), "utf8").toString("hex");
  const r = await post(new URL("/transcribe", base), headers, audio, 30 * 60_000);
  if (r.status !== 200) throw new Error(`文字起こしに失敗しました（${r.status}）`);
  return JSON.parse(r.body) as Transcript;
}

export async function asrReady(): Promise<boolean> {
  const url = process.env.ASR_URL;
  if (!url) return false;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}
