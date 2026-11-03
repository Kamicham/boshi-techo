// 小さな zip の書き手（部品を足さずに Node の zlib だけで作る）。
// 1つずつ deflate で縮めて並べ、最後に目次（central directory）を付ける。名前は UTF-8（日本語のファイル名が化けない）。
// 4GB を超える物（zip64）は扱わない（世帯の書き出しの大きさでは足りる）。
import { crc32, deflateRawSync } from "node:zlib";

export type ZipEntry = { name: string; data: Buffer | Uint8Array | string; date?: Date };

function dosTime(d: Date): { time: number; date: number } {
  const y = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export function zip(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const seen = new Set<string>();
  for (const e of entries) {
    let name = e.name.replace(/^\/+/, "").replace(/\\/g, "/");
    if (!name || name.split("/").some((s) => s === "..")) throw new Error("zip に入れられない名前です");
    // 同じ名前は後ろに番号を付ける
    for (let i = 2; seen.has(name); i++) name = name.replace(/(\.[^./]+)?$/, (ext) => `-${i}${ext}`);
    seen.add(name);
    const raw = typeof e.data === "string" ? Buffer.from(e.data, "utf8") : Buffer.from(e.data);
    const packed = deflateRawSync(raw);
    // 縮まない物（写真など）はそのまま入れる
    const store = packed.length >= raw.length;
    const body = store ? raw : packed;
    const crc = crc32(raw) >>> 0;
    const nameBuf = Buffer.from(name, "utf8");
    const { time, date } = dosTime(e.date ?? new Date());

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // 必要な版
    local.writeUInt16LE(0x0800, 6); // 名前は UTF-8
    local.writeUInt16LE(store ? 0 : 8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4); // 作った版
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(store ? 0 : 8, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(seen.size, 8);
  end.writeUInt16LE(seen.size, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cdBuf, end]);
}

/** CSV の1欄（" と改行と , を含む時は囲む） */
export function csvCell(v: unknown): string {
  const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
