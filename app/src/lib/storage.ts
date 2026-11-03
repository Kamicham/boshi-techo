// ファイルの置き場を切り替える口（StorageDriver）。手元のディスク（local・既定）と S3 互換（s3）の2つ。
// - BOSHI_STORAGE=local|s3 で切り替える。s3 は BOSHI_S3_* の環境変数（下の s3FromEnv）
// - 鍵（key）は必ずサーバで mediaKey() などから組む。画面から来たパスは使わない
// - 中身はここでは暗号化しない。put の前に lib/crypto.ts の sealForHousehold で暗号化してから渡す
// 置き場の形（ディスクでも S3 でも同じ）:
//   households/<hid>/<subject>/<kind>/<yyyy>/<id>[/<variant>]   … 写真・動画・紙・録音
//   households/<hid>/export/<yyyy-mm-dd>.zip                    … 書き出し（期限つき）
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { DATA_DIR, type MediaKind } from "./db";
import { requireSecret } from "./secrets";

export interface StorageDriver {
  readonly name: "local" | "s3";
  put(key: string, body: Buffer | Uint8Array, meta?: { contentType?: string }): Promise<void>;
  /** 無ければ null */
  get(key: string): Promise<Buffer | null>;
  exists(key: string): Promise<boolean>;
  /** その鍵そのものと、その下（`<prefix>/…`）を全部消す。世帯ごと・本人ごとにまとめて消せる */
  delete(prefix: string): Promise<void>;
  /** その鍵と、その下にある鍵の一覧 */
  list(prefix: string): Promise<string[]>;
  /** 期限つきで渡す URL。local はアプリの /api/media/file?k=…（verifySignedPath で確かめる）、s3 は署名つき URL */
  signedUrl(key: string, ttlSec: number): Promise<string>;
}

// ───────── 鍵の組み立て ─────────

const SEG = /^[A-Za-z0-9_-]{1,128}$/;
const KEY = /^households\/[A-Za-z0-9_-]{1,128}(\/[A-Za-z0-9_.-]{1,128})*$/;

function seg(v: string, what: string): string {
  if (typeof v !== "string" || !SEG.test(v)) throw new Error(`置き場の鍵に使えない${what}です`);
  return v;
}

/** 鍵の形を確かめる（households/ で始まる・.. を含まない）。違えば例外 */
export function assertKey(key: string): string {
  const k = key.replace(/\/+$/, "");
  if (!KEY.test(k) || k.split("/").some((s) => s === "." || s === "..")) throw new Error("置き場の鍵の形が違います");
  return k;
}

export function householdPrefix(householdId: string): string {
  return `households/${seg(householdId, "世帯の id")}`;
}

/** 本人がいない（世帯全体の）ファイルは shared の下に置く */
export function subjectPrefix(householdId: string, subjectId: string | null): string {
  return `${householdPrefix(householdId)}/${subjectId ? seg(subjectId, "本人の id") : "shared"}`;
}

const KINDS: readonly MediaKind[] = ["photo", "video", "scan", "audio"];

/**
 * 写真・録音の置き場の鍵: households/<hid>/<subject>/<kind>/<yyyy>/<id>[/<variant>]
 * - date は撮った日などの ISO 文字列（年だけ使う）。無ければ今の年
 * - variant は1つのファイルに複数の形がある時（orig・view・thumb・poster など）
 */
export function mediaKey(p: {
  householdId: string;
  subjectId: string | null;
  kind: MediaKind;
  id: string;
  date?: string | null;
  variant?: string;
}): string {
  if (!KINDS.includes(p.kind)) throw new Error("置き場の鍵に使えない種類です");
  const y = /^(\d{4})/.exec(p.date ?? "")?.[1] ?? String(new Date().getFullYear());
  const base = `${subjectPrefix(p.householdId, p.subjectId)}/${p.kind}/${y}/${seg(p.id, "id")}`;
  return p.variant ? `${base}/${seg(p.variant, "形の名前")}` : base;
}

/** 書き出しの zip の鍵: households/<hid>/export/<yyyy-mm-dd>.zip */
export function exportKey(householdId: string, day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("日付の形が違います");
  return `${householdPrefix(householdId)}/export/${day}.zip`;
}

// ───────── 期限つきの URL（アプリの道に署名を付ける） ─────────

function urlKey(): Buffer {
  return createHmac("sha256", requireSecret("BETTER_AUTH_SECRET")).update("boshi-techo:signed-url").digest();
}

function sigOf(pathAndQuery: string, exp: number): string {
  return createHmac("sha256", urlKey()).update(`${exp}\n${pathAndQuery}`).digest("hex");
}

/** アプリの道（例: /api/media/<id>?v=thumb）に期限と署名を足す */
export function signPath(pathAndQuery: string, ttlSec: number, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + Math.max(1, Math.floor(ttlSec));
  return `${pathAndQuery}${pathAndQuery.includes("?") ? "&" : "?"}exp=${exp}&sig=${sigOf(pathAndQuery, exp)}`;
}

/** signPath で作った URL か（期限内で、道と問いが書き換えられていないか）を確かめる */
export function verifySignedPath(url: string | URL, now = Date.now()): boolean {
  const u = typeof url === "string" ? new URL(url, "http://local") : url;
  const exp = Number(u.searchParams.get("exp"));
  const sig = u.searchParams.get("sig") ?? "";
  if (!Number.isFinite(exp) || exp * 1000 < now || !/^[0-9a-f]{64}$/.test(sig)) return false;
  const q = new URLSearchParams(u.search);
  q.delete("exp");
  q.delete("sig");
  const rest = q.toString();
  const want = sigOf(`${u.pathname}${rest ? `?${rest}` : ""}`, exp);
  return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(want, "hex"));
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
/** local の signedUrl の k= を鍵に戻す（verifySignedPath を通った後に使う） */
export function keyFromSignedUrl(url: string | URL): string | null {
  const u = typeof url === "string" ? new URL(url, "http://local") : url;
  const k = u.searchParams.get("k");
  if (!k) return null;
  try {
    return assertKey(Buffer.from(k, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// ───────── local: DATA_DIR/households/… ─────────

export function localStorageDriver(root: string = DATA_DIR): StorageDriver {
  const base = path.resolve(root, "households");
  const fileOf = (key: string) => {
    const k = assertKey(key);
    const p = path.resolve(root, k);
    if (p !== base && !p.startsWith(base + path.sep)) throw new Error("置き場の外です");
    return p;
  };
  const walk = (dir: string, out: string[]) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else out.push(path.relative(root, p).split(path.sep).join("/"));
    }
  };
  return {
    name: "local",
    async put(key, body) {
      const p = fileOf(key);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      // 書きかけを読まれないよう、隣に書いてから置き換える
      const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
      fs.writeFileSync(tmp, body, { mode: 0o600 });
      fs.renameSync(tmp, p);
    },
    async get(key) {
      const p = fileOf(key);
      try {
        const st = fs.statSync(p);
        return st.isFile() ? fs.readFileSync(p) : null;
      } catch {
        return null;
      }
    },
    async exists(key) {
      try {
        return fs.statSync(fileOf(key)).isFile();
      } catch {
        return false;
      }
    },
    async delete(prefix) {
      const p = fileOf(prefix);
      if (p === base) throw new Error("置き場の全部は消せません");
      fs.rmSync(p, { recursive: true, force: true });
    },
    async list(prefix) {
      const p = fileOf(prefix);
      const out: string[] = [];
      try {
        const st = fs.statSync(p);
        if (st.isFile()) return [assertKey(prefix)];
        walk(p, out);
      } catch {
        return [];
      }
      return out.filter((k) => !/\.tmp-\d+-\d+$/.test(k)).sort();
    },
    async signedUrl(key, ttlSec) {
      return signPath(`/api/media/file?k=${b64url(assertKey(key))}`, ttlSec);
    },
  };
}

// ───────── s3: S3 互換（AWS S3 東京・Cloudflare R2・Supabase Storage）。SigV4 を自前で書く（部品を足さない） ─────────

export type S3Config = {
  endpoint: string; // 例: https://s3.ap-northeast-1.amazonaws.com / https://<account>.r2.cloudflarestorage.com
  region: string; // 例: ap-northeast-1（R2 は auto）
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** true で https://<endpoint>/<bucket>/<key>（R2・Supabase・MinIO）。false で https://<bucket>.<endpoint>/<key> */
  pathStyle?: boolean;
};

export function s3FromEnv(): S3Config {
  const need = (n: string) => {
    const v = process.env[n];
    if (!v) throw new Error(`BOSHI_STORAGE=s3 には ${n} が要ります`);
    return v;
  };
  return {
    endpoint: need("BOSHI_S3_ENDPOINT"),
    region: process.env.BOSHI_S3_REGION || "auto",
    bucket: need("BOSHI_S3_BUCKET"),
    accessKeyId: need("BOSHI_S3_ACCESS_KEY_ID"),
    secretAccessKey: need("BOSHI_S3_SECRET_ACCESS_KEY"),
    pathStyle: process.env.BOSHI_S3_PATH_STYLE !== "0",
  };
}

const sha256hex = (b: string | Buffer | Uint8Array) => createHash("sha256").update(b).digest("hex");
const hmac = (k: Buffer | string, s: string) => createHmac("sha256", k).update(s, "utf8").digest();
/** AWS の決まりの URI エンコード（A-Z a-z 0-9 - _ . ~ 以外を %XX に） */
const awsEncode = (s: string, keepSlash = false) => {
  const e = encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return keepSlash ? e.replace(/%2F/g, "/") : e;
};
const amzDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function s3Target(c: S3Config, key: string | null) {
  const ep = new URL(c.endpoint);
  const host = c.pathStyle ? ep.host : `${c.bucket}.${ep.host}`;
  const basePath = ep.pathname.replace(/\/+$/, "");
  const objectPath = key == null ? "" : `/${awsEncode(key, true)}`;
  const pathname = c.pathStyle ? `${basePath}/${awsEncode(c.bucket)}${objectPath}` : `${basePath}${objectPath || "/"}`;
  return { origin: `${ep.protocol}//${host}`, host, pathname: pathname || "/" };
}

function canonicalQuery(q: Record<string, string>): string {
  return Object.keys(q)
    .sort()
    .map((k) => `${awsEncode(k)}=${awsEncode(q[k])}`)
    .join("&");
}

function signingKey(c: S3Config, day: string): Buffer {
  return hmac(hmac(hmac(hmac(`AWS4${c.secretAccessKey}`, day), c.region), "s3"), "aws4_request");
}

/** 署名つき URL（GET）。試験で AWS の資料の見本と照らす */
export function s3PresignGet(c: S3Config, key: string, ttlSec: number, now = new Date()): string {
  const t = s3Target(c, key);
  const date = amzDate(now);
  const day = date.slice(0, 8);
  const scope = `${day}/${c.region}/s3/aws4_request`;
  const q: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${c.accessKeyId}/${scope}`,
    "X-Amz-Date": date,
    "X-Amz-Expires": String(Math.min(604800, Math.max(1, Math.floor(ttlSec)))),
    "X-Amz-SignedHeaders": "host",
  };
  const cq = canonicalQuery(q);
  const creq = ["GET", t.pathname, cq, `host:${t.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", date, scope, sha256hex(creq)].join("\n");
  const sig = createHmac("sha256", signingKey(c, day)).update(sts, "utf8").digest("hex");
  return `${t.origin}${t.pathname}?${cq}&X-Amz-Signature=${sig}`;
}

async function s3Fetch(
  c: S3Config,
  method: "GET" | "PUT" | "DELETE" | "HEAD",
  key: string | null,
  opts: { query?: Record<string, string>; body?: Buffer | Uint8Array; contentType?: string } = {},
): Promise<Response> {
  const t = s3Target(c, key);
  const now = new Date();
  const date = amzDate(now);
  const day = date.slice(0, 8);
  const scope = `${day}/${c.region}/s3/aws4_request`;
  const payloadHash = sha256hex(opts.body ?? "");
  const headers: Record<string, string> = { host: t.host, "x-amz-content-sha256": payloadHash, "x-amz-date": date };
  if (opts.contentType) headers["content-type"] = opts.contentType;
  const names = Object.keys(headers).sort();
  const cq = canonicalQuery(opts.query ?? {});
  const creq = [method, t.pathname, cq, names.map((n) => `${n}:${headers[n].trim()}\n`).join(""), names.join(";"), payloadHash].join("\n");
  const sts = ["AWS4-HMAC-SHA256", date, scope, sha256hex(creq)].join("\n");
  const sig = createHmac("sha256", signingKey(c, day)).update(sts, "utf8").digest("hex");
  const { host: _host, ...sendHeaders } = headers;
  void _host;
  return fetch(`${t.origin}${t.pathname}${cq ? `?${cq}` : ""}`, {
    method,
    headers: { ...sendHeaders, authorization: `AWS4-HMAC-SHA256 Credential=${c.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${sig}` },
    body: opts.body ? new Uint8Array(opts.body) : undefined,
  });
}

export function s3StorageDriver(c: S3Config): StorageDriver {
  const exists = async (key: string) => (await s3Fetch(c, "HEAD", assertKey(key))).ok;
  const listAll = async (prefix: string): Promise<string[]> => {
    const out: string[] = [];
    let token: string | undefined;
    do {
      const q: Record<string, string> = { "list-type": "2", prefix };
      if (token) q["continuation-token"] = token;
      const res = await s3Fetch(c, "GET", null, { query: q });
      if (!res.ok) throw new Error(`置き場の一覧を読めませんでした（${res.status}）`);
      const xml = await res.text();
      for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) out.push(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml)?.[1] : undefined;
    } while (token);
    return out;
  };
  return {
    name: "s3",
    async put(key, body, meta) {
      const res = await s3Fetch(c, "PUT", assertKey(key), { body, contentType: meta?.contentType ?? "application/octet-stream" });
      if (!res.ok) throw new Error(`置き場に置けませんでした（${res.status}）`);
    },
    async get(key) {
      const res = await s3Fetch(c, "GET", assertKey(key));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`置き場から読めませんでした（${res.status}）`);
      return Buffer.from(await res.arrayBuffer());
    },
    exists,
    async delete(prefix) {
      const k = assertKey(prefix);
      const keys = [k, ...(await listAll(`${k}/`))];
      for (const key of keys) {
        const res = await s3Fetch(c, "DELETE", key);
        if (!res.ok && res.status !== 404) throw new Error(`置き場から消せませんでした（${res.status}）`);
      }
    },
    async list(prefix) {
      const k = assertKey(prefix);
      const own = (await exists(k)) ? [k] : [];
      return [...own, ...(await listAll(`${k}/`))].sort();
    },
    async signedUrl(key, ttlSec) {
      return s3PresignGet(c, assertKey(key), ttlSec);
    },
  };
}

// ───────── 選ぶ ─────────

let current: StorageDriver | null = null;

/** BOSHI_STORAGE（local・既定 / s3）の置き場 */
export function storage(): StorageDriver {
  if (current) return current;
  const kind = process.env.BOSHI_STORAGE || "local";
  if (kind === "local") current = localStorageDriver();
  else if (kind === "s3") current = s3StorageDriver(s3FromEnv());
  else throw new Error(`BOSHI_STORAGE は local か s3 です（今: ${kind}）`);
  return current;
}
