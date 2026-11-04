// 映画の音楽（自作のオルゴール）の音符と、それを WAV に書く道具。
// 画面の映画（app/book/film/music.ts・Web Audio）と書き出す動画（lib/film-render.ts）が同じ音符を使う。外の曲・管理曲は使わない。
// 和音は C → G → Am → F を繰り返し、8分音符ごとに分散和音を1音ずつ。小節の頭に低い音。小さな部屋の響き（短い遅れ2つ）。

export const BPM = 64;
export const CHORDS = [
  [72, 76, 79, 84], // C
  [71, 74, 79, 83], // G
  [69, 72, 76, 81], // Am
  [65, 69, 72, 77], // F
];
export const PATTERN = [0, 2, 1, 3, 2, 1, 0, 2];
export const BASS = [48, 43, 45, 41];
/** ふだんの大きさと、声が流れる間の大きさ */
export const LEVEL = 0.5;
export const DUCK_LEVEL = 0.12;

export const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/**
 * total 秒のオルゴールを 16bit・1チャンネルの WAV にする。spans（声が流れる間）は小さくし、始まりは2秒で上げ、終わりは3秒で下げる。
 * 純粋な計算だけ（同じ引数なら同じ中身）。
 */
export function renderMusicWav(total: number, spans: readonly { from: number; to: number }[] = [], rate = 44100): Buffer {
  const n = Math.max(1, Math.round(total * rate));
  const dry = new Float32Array(n);
  const beat = 60 / BPM / 2;
  const note = (f: number, at: number, vol: number, len: number, kind: "triangle" | "sine") => {
    const s0 = Math.round(at * rate);
    const s1 = Math.min(n, Math.round((at + len) * rate));
    const k = Math.log(0.0001 / vol) / len; // 指数で消えていく
    for (let i = s0; i < s1; i++) {
      const t = (i - s0) / rate;
      const env = t < 0.008 ? (vol * t) / 0.008 : vol * Math.exp(k * (t - 0.008));
      const ph = f * t;
      const base = kind === "sine" ? Math.sin(2 * Math.PI * ph) : 4 * Math.abs(ph - Math.floor(ph + 0.5)) - 1;
      dry[i] += env * (base + 0.12 * Math.sin(2 * Math.PI * 4 * ph));
    }
  };
  for (let step = 0, at = 0.2; at < total; step++, at += beat) {
    const bar = Math.floor(step / PATTERN.length) % CHORDS.length;
    const pos = step % PATTERN.length;
    note(hz(CHORDS[bar][PATTERN[pos]]), at, 0.16, 2.2, "triangle");
    if (pos === 0) note(hz(BASS[bar]), at, 0.1, 3.5, "sine");
  }
  // 大きさ（始まり・声の間・終わり）を先に掛けてから響きを足す（画面の Web Audio と同じ順）
  const level = (t: number) => {
    let g = LEVEL;
    for (const s of spans) {
      // 0.8秒かけて下げ、終わったら0.8秒かけて戻す
      if (t >= s.from && t <= s.to) g = Math.min(g, DUCK_LEVEL + (LEVEL - DUCK_LEVEL) * Math.max(0, 1 - (t - s.from) / 0.8));
      else if (t > s.to && t < s.to + 0.8) g = Math.min(g, DUCK_LEVEL + ((LEVEL - DUCK_LEVEL) * (t - s.to)) / 0.8);
    }
    const fadeIn = Math.min(1, t / 2);
    const fadeOut = Math.min(1, Math.max(0, (total - t) / 3));
    return g * fadeIn * fadeOut;
  };
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = dry[i] * level(i / rate);
  // 小さな部屋の響き: 0.19秒と0.31秒の遅れ（戻り 0.35）を 0.25 で足す
  const wet = new Float32Array(n);
  for (const d of [0.19, 0.31]) {
    const lag = Math.round(d * rate);
    const line = new Float32Array(n);
    for (let i = 0; i < n; i++) line[i] = (i >= lag ? out[i - lag] + 0.35 * line[i - lag] : 0);
    for (let i = 0; i < n; i++) wet[i] += line[i];
  }
  const pcm = Buffer.alloc(44 + n * 2);
  pcm.write("RIFF", 0);
  pcm.writeUInt32LE(36 + n * 2, 4);
  pcm.write("WAVE", 8);
  pcm.write("fmt ", 12);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(1, 22);
  pcm.writeUInt32LE(rate, 24);
  pcm.writeUInt32LE(rate * 2, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write("data", 36);
  pcm.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, out[i] + 0.25 * wet[i]));
    pcm.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return pcm;
}
