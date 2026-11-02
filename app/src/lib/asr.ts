// 録音を文字にする（自宅の GPU の機械で動く asr/server.py を呼ぶ）。
// 音声は家のネットワークの外に出ない。
import "server-only";

export interface Transcript {
  text: string;
  segments: { start: number; end: number; text: string }[];
  duration: number;
  elapsed: number;
}

export async function transcribe(audio: Buffer, prompt?: string): Promise<Transcript> {
  const url = process.env.ASR_URL;
  if (!url) throw new Error("文字起こしの機械が設定されていません（ASR_URL）");
  const headers: Record<string, string> = { "content-type": "application/octet-stream" };
  // 専門用語の聞き取りを助けるヒント（日本語は 16 進にして送る）
  if (prompt) headers["x-prompt"] = Buffer.from(prompt.slice(0, 400), "utf8").toString("hex");
  const r = await fetch(`${url}/transcribe`, { method: "POST", headers, body: new Uint8Array(audio) });
  if (!r.ok) throw new Error(`文字起こしに失敗しました（${r.status}）`);
  return (await r.json()) as Transcript;
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
