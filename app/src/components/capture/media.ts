// 録音と写真の下ごしらえ（画面側）
import type { ClientMedia } from "@/lib/media-shared";

/** 録音の形式: Chrome は webm、iOS Safari は mp4 */
export function pickAudioType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) if (MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

/** 写真を長い辺 1600px の JPEG（data URL）に縮める */
export async function shrinkPhoto(file: File, maxSide = 1600): Promise<string> {
  let src: CanvasImageSource & { width: number; height: number };
  try {
    src = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    src = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("写真が読めませんでした（HEIC の時は設定で「互換性優先」に）"));
      img.src = URL.createObjectURL(file);
    });
  }
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("写真を縮められませんでした");
  ctx.drawImage(src, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

// ───────── 写真を残す（Claude には送らない。/api/media へ） ─────────

/** 長い辺 maxSide の JPEG（Blob）に縮める。canvas を通るので、位置などのメタデータは付かない */
export async function shrinkToBlob(file: Blob, maxSide: number, quality = 0.85): Promise<Blob> {
  let src: CanvasImageSource & { width: number; height: number };
  let url: string | null = null;
  try {
    src = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    url = URL.createObjectURL(file);
    src = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("写真が読めませんでした"));
      img.src = url!;
    });
  }
  try {
    const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(src.width * scale));
    canvas.height = Math.max(1, Math.round(src.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("写真を縮められませんでした");
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("写真を縮められませんでした"))), "image/jpeg", quality));
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

export interface KeepOptions {
  familyId: string;
  today: string;
  /** 手帳の記録から足した時、その記録の id */
  techoId?: string;
  /** ★を付けて残す */
  star?: boolean;
  caption?: string;
  /** この端末を使っている人の呼び名（★の印・撮った人） */
  by?: string;
}

export interface KeepResult {
  media: ClientMedia;
  duplicate: boolean;
  candidates: { id: string; page: string; title: string; date: string }[];
}

/**
 * 写真を1枚残す。原本と、端末で縮めた画面用（1568px）・一覧用（400px）を一緒に送る。
 * 縮められない形（HEIC を読めないブラウザなど）は原本だけを送り、サーバ（Mac の sips）が作る。
 */
export async function keepPhoto(file: File, o: KeepOptions): Promise<KeepResult> {
  const form = new FormData();
  form.set("familyId", o.familyId);
  form.set("today", o.today);
  form.set("file", file, "original");
  form.set("lastModified", String(file.lastModified || ""));
  if (o.techoId) form.set("techoId", o.techoId);
  if (o.star) form.set("star", "1");
  if (o.caption) form.set("caption", o.caption);
  if (o.by) {
    form.set("by", o.by);
    form.set("who", o.by);
  }
  try {
    form.set("view", await shrinkToBlob(file, 1568), "view.jpg");
    form.set("thumb", await shrinkToBlob(file, 400, 0.8), "thumb.jpg");
  } catch {
    // 縮められなくても原本は送る
  }
  let r: Response;
  try {
    r = await fetch("/api/media", { method: "POST", body: form });
  } catch {
    throw new Error("送れませんでした。電波を確かめて、もう一度");
  }
  const j = (await r.json().catch(() => ({}))) as KeepResult & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `送れませんでした（${r.status}）。もう一度`);
  return j;
}
