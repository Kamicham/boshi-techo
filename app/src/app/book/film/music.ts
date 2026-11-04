// 映画の音楽: 端末の中で鳴らす自作のオルゴール（Web Audio）。外の曲・管理曲は使わない（著作権の心配が無い）。
// 和音は C → G → Am → F を繰り返し、1拍ごとに分散和音を1音ずつ。声が流れる間は小さくする（duck）。

const BPM = 64;
// 和音（MIDI の音の高さ）。オルゴールらしく高い音域で
const CHORDS = [
  [72, 76, 79, 84], // C
  [71, 74, 79, 83], // G
  [69, 72, 76, 81], // Am
  [65, 69, 72, 77], // F
];
const PATTERN = [0, 2, 1, 3, 2, 1, 0, 2];
const BASS = [48, 43, 45, 41];

const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class MusicBox {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextAt = 0;

  start() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2);
    // 小さな部屋の響き（短い遅れを2つ重ねる）
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    for (const t of [0.19, 0.31]) {
      const d = ctx.createDelay(1);
      d.delayTime.value = t;
      const fb = ctx.createGain();
      fb.gain.value = 0.35;
      master.connect(d);
      d.connect(fb);
      fb.connect(d);
      d.connect(wet);
    }
    wet.connect(ctx.destination);
    master.connect(ctx.destination);
    this.master = master;
    this.step = 0;
    this.nextAt = ctx.currentTime + 0.2;
    this.timer = setInterval(() => this.schedule(), 100);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const beat = 60 / BPM / 2; // 8分音符
    while (this.nextAt < ctx.currentTime + 0.4) {
      const bar = Math.floor(this.step / PATTERN.length) % CHORDS.length;
      const chord = CHORDS[bar];
      const pos = this.step % PATTERN.length;
      this.note(hz(chord[PATTERN[pos]]), this.nextAt, 0.16, 2.2);
      if (pos === 0) this.note(hz(BASS[bar]), this.nextAt, 0.1, 3.5, "sine");
      this.nextAt += beat;
      this.step++;
    }
  }

  private note(f: number, at: number, vol: number, len: number, type: OscillatorType = "triangle") {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    // オルゴールの金属っぽさ（2オクターブ上を少し）
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = f * 4;
    const g2 = ctx.createGain();
    g2.gain.value = 0.12;
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(this.master!);
    o.start(at);
    o2.start(at);
    o.stop(at + len + 0.05);
    o2.stop(at + len + 0.05);
  }

  /** 声が流れる間は小さく（true）、終わったら戻す（false） */
  duck(on: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(this.master.gain.value, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(on ? 0.12 : 0.5, ctx.currentTime + 0.8);
  }

  fadeOut(sec: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setValueAtTime(this.master.gain.value, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0, ctx.currentTime + sec);
    setTimeout(() => this.stop(), sec * 1000 + 200);
  }

  pause() {
    void this.ctx?.suspend();
  }
  resume() {
    void this.ctx?.resume();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
  }
}
