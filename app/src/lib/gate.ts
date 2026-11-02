// 合言葉の門: 公開の住所から開いた人は、合言葉を入れるまで手帳を見られない。
// 合言葉は .env.local の BOSHI_PASSCODE（無ければ門は開いたまま＝手元の開発用）。
export const GATE_COOKIE = "boshi_key";

/** 合言葉から cookie に入れる値を作る（合言葉そのものは cookie に置かない） */
export async function gateToken(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`boshi-techo:${passcode}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
