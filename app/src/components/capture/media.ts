// 録音と写真の下ごしらえ（画面側）

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
