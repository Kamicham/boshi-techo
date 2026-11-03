// 家族の記録を置く小さなデータベース（SQLite）。
// 置き場は app/data/（git の対象外）。本物の家族の記録は公開リポジトリに入らない。
import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { HttpError } from "./http-error";

export const DATA_DIR = process.env.BOSHI_DATA_DIR ?? path.join(process.cwd(), "data");

let db: Database.Database | null = null;

function open(): Database.Database {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(path.join(DATA_DIR, "boshi.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      type TEXT NOT NULL,
      date TEXT,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS docs_family_type ON docs(family_id, type, date);
  `);
  return db;
}

/**
 * 記録の種類。機能ごとに自分の type を使う。
 * - record: 話した・撮った記録（①）
 * - visit: 健診（⑤）
 * - local: 町の制度の調べ結果（②）
 * - draft: 下書き（③）
 * - done: 済んだ事（milestone id）
 * - book: 一冊（⑦）
 * - profile: わが家の設定
 * - plan: 家族の役割分担（④）
 * - advice: 参謀の気づき（④。きっかけの鍵ごと）
 * - ask: 記録を作る時の聞き返し（答えるまで残す。①）
 */
export type DocType = "record" | "visit" | "local" | "draft" | "done" | "book" | "profile" | "plan" | "advice" | "techo" | "chat" | "ask";

export interface Doc<T = Record<string, unknown>> {
  id: string;
  familyId: string;
  /** 記録の持ち主の本人（subjects.id）。空なら世帯全体の物。forHousehold から読んだ時だけ入る */
  subjectId?: string | null;
  type: DocType;
  date: string | null;
  data: T;
  createdAt: string;
  updatedAt: string;
}

type Row = { id: string; family_id: string; type: DocType; date: string | null; data: string; created_at: string; updated_at: string };

function toDoc<T>(r: Row): Doc<T> {
  return { id: r.id, familyId: r.family_id, type: r.type, date: r.date, data: JSON.parse(r.data) as T, createdAt: r.created_at, updatedAt: r.updated_at };
}

export function put<T>(familyId: string, type: DocType, data: T, opts: { id?: string; date?: string | null } = {}): Doc<T> {
  const now = new Date().toISOString();
  const id = opts.id ?? randomUUID();
  open()
    .prepare(
      `INSERT INTO docs (id, family_id, type, date, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET date = excluded.date, data = excluded.data, updated_at = excluded.updated_at`,
    )
    .run(id, familyId, type, opts.date ?? null, JSON.stringify(data), now, now);
  return get<T>(id)!;
}

export function get<T>(id: string): Doc<T> | null {
  const r = open().prepare(`SELECT * FROM docs WHERE id = ?`).get(id) as Row | undefined;
  return r ? toDoc<T>(r) : null;
}

/** 中身の一部を書き換える */
export function patch<T extends object>(id: string, partial: Partial<T>): Doc<T> | null {
  const cur = get<T>(id);
  if (!cur) return null;
  return put<T>(cur.familyId, cur.type, { ...cur.data, ...partial }, { id, date: cur.date });
}

export function list<T>(familyId: string, type: DocType, opts: { limit?: number } = {}): Doc<T>[] {
  const rows = open()
    .prepare(`SELECT * FROM docs WHERE family_id = ? AND type = ? ORDER BY COALESCE(date, created_at) DESC, created_at DESC LIMIT ?`)
    .all(familyId, type, opts.limit ?? 500) as Row[];
  return rows.map((r) => toDoc<T>(r));
}

export function remove(id: string): void {
  open().prepare(`DELETE FROM docs WHERE id = ?`).run(id);
}

/** 家族ごとのファイル置き場（録音など）。app/data/files/<家族>/ */
export function filesDir(familyId: string, ...sub: string[]): string {
  const dir = path.join(DATA_DIR, "files", familyId.replace(/[^a-zA-Z0-9_-]/g, ""), ...sub.map((s) => s.replace(/[^a-zA-Z0-9_.-]/g, "")));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ───────── 家族ごとのアカウント（世帯・本人・同意・写真の台帳・世帯の鍵） ─────────
//
// 表は「初めて使う時」に作る（ensureAccountSchema）。今までの docs だけを使う道（健診の録音など）は、
// この表が無くても今のまま動く。
//
// わが家・本番の置き場（BOSHI_DATA_DIR を指定しない＝app/data/）では、BOSHI_ACCOUNTS=1 を入れるまで表を作らない。
// 開発サーバ（3000番）と本番（3210番）は同じ app/data/boshi.db を開いているので、試しに叩いただけで
// わが家の DB の形が変わらないようにするため（11/5 の健診の後に、主担当が写しで試してから入れる）。

/** 今開いている DB（Better Auth に同じファイルを渡すため） */
export function database(): Database.Database {
  return open();
}

/** BOSHI_DATA_DIR を指定していない＝わが家・本番の置き場（app/data/） */
export function isHomeDataDir(): boolean {
  return !process.env.BOSHI_DATA_DIR;
}

let accountSchemaReady = false;

/** アカウントの表を作る（何度呼んでもよい）。わが家の置き場では BOSHI_ACCOUNTS=1 の時だけ */
export function ensureAccountSchema(): Database.Database {
  const d = open();
  if (accountSchemaReady) return d;
  if (isHomeDataDir() && process.env.BOSHI_ACCOUNTS !== "1") {
    throw new HttpError(503, "アカウントの仕組みは、わが家の置き場ではまだ動かしていません（BOSHI_DATA_DIR を分けた所で試す）");
  }
  d.exec(`
    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,                       -- Better Auth の organization の id と同じ（デモは demo-sato）
      kind TEXT NOT NULL CHECK (kind IN ('real','demo','sim')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('mother','child','partner')),
      name TEXT NOT NULL DEFAULT '',
      account_id TEXT,                           -- 本人がログインする時だけ（Better Auth の user.id）
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS subjects_household ON subjects(household_id);
    CREATE TABLE IF NOT EXISTS proxies (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      account_id TEXT NOT NULL,                  -- 代理として見る人（Better Auth の user.id）
      subject_id TEXT NOT NULL,                  -- 見せる本人
      basis TEXT NOT NULL CHECK (basis IN ('legal','voluntary')),  -- 法定代理・任意代理
      scope TEXT NOT NULL DEFAULT '["*"]',       -- 見せる項目の一覧（JSON）。"*" は全部
      created_at TEXT NOT NULL,
      UNIQUE (account_id, subject_id)
    );
    CREATE INDEX IF NOT EXISTS proxies_household ON proxies(household_id, account_id);
    CREATE TABLE IF NOT EXISTS consents (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('record','claude_us','share')),
      version TEXT NOT NULL,
      granted_at TEXT NOT NULL,
      revoked_at TEXT,
      by_account TEXT
    );
    CREATE INDEX IF NOT EXISTS consents_subject ON consents(subject_id, kind);
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      subject_id TEXT,
      kind TEXT NOT NULL CHECK (kind IN ('photo','video','scan','audio')),
      storage_key TEXT NOT NULL,                 -- mediaKey() でサーバが組んだ置き場の鍵
      mime TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      iv TEXT,                                   -- AES-256-GCM（base64）
      tag TEXT,
      taken_at TEXT,
      taken_at_from TEXT,                        -- exif | file | upload | manual
      sha256 TEXT,                               -- 暗号にする前の中身の sha256（二重に入れない・照合）
      data TEXT NOT NULL DEFAULT '{}',
      trashed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS media_household ON media(household_id, kind, taken_at);
    CREATE INDEX IF NOT EXISTS media_sha ON media(household_id, sha256);
    CREATE TABLE IF NOT EXISTS household_keys (
      household_id TEXT PRIMARY KEY,
      wrapped_dek TEXT NOT NULL,                 -- BOSHI_KEK で包んだ世帯のデータ鍵
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id TEXT NOT NULL,
      account_id TEXT,
      action TEXT NOT NULL,                      -- 例: claude.send / media.view / household.delete
      target TEXT,
      detail TEXT,                               -- JSON
      at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS audit_household ON audit(household_id, at);
  `);
  const cols = d.prepare(`PRAGMA table_info(docs)`).all() as { name: string }[];
  if (!cols.some((c) => c.name === "subject_id")) d.exec(`ALTER TABLE docs ADD COLUMN subject_id TEXT`);
  d.exec(`CREATE INDEX IF NOT EXISTS docs_family_subject ON docs(family_id, subject_id)`);
  accountSchemaReady = true;
  return d;
}

// ───────── 世帯の中だけに触れる DB（forHousehold） ─────────

export type MediaKind = "photo" | "video" | "scan" | "audio";
export type TakenAtFrom = "exif" | "file" | "upload" | "manual";

/** 写真・録音のファイルを指す行 */
export interface MediaRow<T = Record<string, unknown>> {
  id: string;
  householdId: string;
  subjectId: string | null;
  kind: MediaKind;
  storageKey: string;
  mime: string;
  bytes: number;
  iv: string | null;
  tag: string | null;
  takenAt: string | null;
  takenAtFrom: TakenAtFrom | null;
  sha256: string | null;
  data: T;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type MediaDbRow = {
  id: string; household_id: string; subject_id: string | null; kind: MediaKind; storage_key: string; mime: string; bytes: number;
  iv: string | null; tag: string | null; taken_at: string | null; taken_at_from: TakenAtFrom | null; sha256: string | null;
  data: string; trashed_at: string | null; created_at: string; updated_at: string;
};

function toMedia<T>(r: MediaDbRow): MediaRow<T> {
  return {
    id: r.id, householdId: r.household_id, subjectId: r.subject_id, kind: r.kind, storageKey: r.storage_key, mime: r.mime, bytes: r.bytes,
    iv: r.iv, tag: r.tag, takenAt: r.taken_at, takenAtFrom: r.taken_at_from, sha256: r.sha256, data: JSON.parse(r.data) as T,
    trashedAt: r.trashed_at, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export type NewMedia<T = Record<string, unknown>> = {
  id?: string;
  subjectId: string | null;
  kind: MediaKind;
  storageKey: string;
  mime: string;
  bytes: number;
  iv?: string | null;
  tag?: string | null;
  takenAt?: string | null;
  takenAtFrom?: TakenAtFrom | null;
  sha256?: string | null;
  data?: T;
};

export type MediaPatch<T = Record<string, unknown>> = Partial<Pick<MediaRow<T>, "subjectId" | "takenAt" | "takenAtFrom" | "trashedAt">> & {
  /** data は今の中身に重ねる（浅く） */
  data?: Partial<T>;
};

type DocRow = Row & { subject_id?: string | null };

function toScopedDoc<T>(r: DocRow): Doc<T> {
  return { ...toDoc<T>(r), subjectId: r.subject_id ?? null };
}

export interface HouseholdDb {
  readonly householdId: string;
  /** この世帯の記録だけを id で引く。ほかの世帯の id なら null */
  get<T>(id: string): Doc<T> | null;
  list<T>(type: DocType, opts?: { limit?: number; subjectId?: string | null }): Doc<T>[];
  /** 書く。同じ id がほかの世帯にあれば 404（上書きしない） */
  put<T>(type: DocType, data: T, opts?: { id?: string; date?: string | null; subjectId?: string | null }): Doc<T>;
  patch<T extends object>(id: string, partial: Partial<T>): Doc<T> | null;
  /** 消した時 true。ほかの世帯の id なら何もしないで false */
  remove(id: string): boolean;
  media: {
    insert<T>(m: NewMedia<T>): MediaRow<T>;
    get<T>(id: string, opts?: { includeTrashed?: boolean }): MediaRow<T> | null;
    list<T>(opts?: { kind?: MediaKind; subjectId?: string | null; includeTrashed?: boolean; limit?: number }): MediaRow<T>[];
    /** 同じ中身（sha256）が既にあれば、その行（二重に入れない） */
    findBySha<T>(sha256: string): MediaRow<T> | null;
    patch<T>(id: string, p: MediaPatch<T>): MediaRow<T> | null;
    /** 行を消す（ファイルは呼ぶ側が storage.delete で消す） */
    remove(id: string): boolean;
    /** ゴミ箱に入って days 日を過ぎた行 */
    trashedBefore<T>(isoDate: string): MediaRow<T>[];
  };
}

/**
 * 世帯の中だけに触れる DB。すべての読み書きを family_id（household_id）で絞る。
 * - visibleSubjects を渡すと、本人の付いた記録は、その本人の分だけを返す（本人の無い記録＝世帯全体の物は返す）
 * 新しいコードは docs に直に触らず、必ずこれ（か withHousehold の ctx.db）を通す。
 */
export function forHousehold(householdId: string, opts: { visibleSubjects?: readonly string[] } = {}): HouseholdDb {
  if (typeof householdId !== "string" || !householdId) throw new HttpError(404, "見つかりません");
  const d = ensureAccountSchema();
  const hid = householdId;
  const visible = opts.visibleSubjects ? new Set(opts.visibleSubjects) : null;
  const canSee = (subjectId: string | null | undefined) => !visible || !subjectId || visible.has(subjectId);
  const canSeeMedia = (subjectId: string | null) => !visible || !subjectId || visible.has(subjectId);

  const getDoc = <T>(id: string): Doc<T> | null => {
    const r = d.prepare(`SELECT * FROM docs WHERE family_id = ? AND id = ?`).get(hid, id) as DocRow | undefined;
    if (!r || !canSee(r.subject_id)) return null;
    return toScopedDoc<T>(r);
  };

  const putDoc = <T>(type: DocType, data: T, o: { id?: string; date?: string | null; subjectId?: string | null } = {}): Doc<T> => {
    if (o.subjectId && !canSee(o.subjectId)) throw new HttpError(404, "見つかりません");
    const now = new Date().toISOString();
    const id = o.id ?? randomUUID();
    const cur = d.prepare(`SELECT family_id, subject_id FROM docs WHERE id = ?`).get(id) as { family_id: string; subject_id: string | null } | undefined;
    if (cur && (cur.family_id !== hid || !canSee(cur.subject_id))) throw new HttpError(404, "見つかりません");
    const res = d
      .prepare(
        `INSERT INTO docs (id, family_id, type, date, data, created_at, updated_at, subject_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET date = excluded.date, data = excluded.data, updated_at = excluded.updated_at,
           subject_id = COALESCE(excluded.subject_id, docs.subject_id)
         WHERE docs.family_id = excluded.family_id`,
      )
      .run(id, hid, type, o.date ?? null, JSON.stringify(data), now, now, o.subjectId ?? null);
    if (res.changes === 0) throw new HttpError(404, "見つかりません"); // 同じ id がほかの世帯にある
    return getDoc<T>(id)!;
  };

  const getMedia = <T>(id: string, o: { includeTrashed?: boolean } = {}): MediaRow<T> | null => {
    const r = d.prepare(`SELECT * FROM media WHERE household_id = ? AND id = ?`).get(hid, id) as MediaDbRow | undefined;
    if (!r || !canSeeMedia(r.subject_id)) return null;
    if (r.trashed_at && !o.includeTrashed) return null;
    return toMedia<T>(r);
  };

  return {
    householdId: hid,
    get: getDoc,
    list<T>(type: DocType, o: { limit?: number; subjectId?: string | null } = {}) {
      const rows = (
        o.subjectId !== undefined
          ? d
              .prepare(
                `SELECT * FROM docs WHERE family_id = ? AND type = ? AND subject_id IS ? ORDER BY COALESCE(date, created_at) DESC, created_at DESC LIMIT ?`,
              )
              .all(hid, type, o.subjectId, o.limit ?? 500)
          : d
              .prepare(`SELECT * FROM docs WHERE family_id = ? AND type = ? ORDER BY COALESCE(date, created_at) DESC, created_at DESC LIMIT ?`)
              .all(hid, type, o.limit ?? 500)
      ) as DocRow[];
      return rows.filter((r) => canSee(r.subject_id)).map((r) => toScopedDoc<T>(r));
    },
    put: putDoc,
    patch<T extends object>(id: string, partial: Partial<T>) {
      const cur = getDoc<T>(id);
      if (!cur) return null;
      return putDoc<T>(cur.type, { ...cur.data, ...partial }, { id, date: cur.date });
    },
    remove(id: string) {
      if (!getDoc(id)) return false;
      return d.prepare(`DELETE FROM docs WHERE family_id = ? AND id = ?`).run(hid, id).changes > 0;
    },
    media: {
      insert<T>(m: NewMedia<T>) {
        if (m.subjectId && !canSeeMedia(m.subjectId)) throw new HttpError(404, "見つかりません");
        if (!m.storageKey.startsWith(`households/${hid}/`)) throw new Error("storage_key が世帯の置き場の外です（mediaKey() で組む）");
        const now = new Date().toISOString();
        const id = m.id ?? randomUUID();
        d.prepare(
          `INSERT INTO media (id, household_id, subject_id, kind, storage_key, mime, bytes, iv, tag, taken_at, taken_at_from, sha256, data, trashed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        ).run(
          id, hid, m.subjectId, m.kind, m.storageKey, m.mime, m.bytes, m.iv ?? null, m.tag ?? null, m.takenAt ?? null,
          m.takenAtFrom ?? null, m.sha256 ?? null, JSON.stringify(m.data ?? {}), now, now,
        );
        return getMedia<T>(id)!;
      },
      get: getMedia,
      list<T>(o: { kind?: MediaKind; subjectId?: string | null; includeTrashed?: boolean; limit?: number } = {}) {
        const where = ["household_id = ?"];
        const args: unknown[] = [hid];
        if (o.kind) {
          where.push("kind = ?");
          args.push(o.kind);
        }
        if (o.subjectId !== undefined) {
          where.push("subject_id IS ?");
          args.push(o.subjectId);
        }
        if (!o.includeTrashed) where.push("trashed_at IS NULL");
        args.push(o.limit ?? 2000);
        const rows = d
          .prepare(`SELECT * FROM media WHERE ${where.join(" AND ")} ORDER BY COALESCE(taken_at, created_at) DESC, created_at DESC LIMIT ?`)
          .all(...args) as MediaDbRow[];
        return rows.filter((r) => canSeeMedia(r.subject_id)).map((r) => toMedia<T>(r));
      },
      findBySha<T>(sha256: string) {
        const r = d.prepare(`SELECT * FROM media WHERE household_id = ? AND sha256 = ? AND trashed_at IS NULL LIMIT 1`).get(hid, sha256) as
          | MediaDbRow
          | undefined;
        return r && canSeeMedia(r.subject_id) ? toMedia<T>(r) : null;
      },
      patch<T>(id: string, p: MediaPatch<T>) {
        const cur = getMedia<T>(id, { includeTrashed: true });
        if (!cur) return null;
        if (p.subjectId && !canSeeMedia(p.subjectId)) throw new HttpError(404, "見つかりません");
        const next = {
          subject_id: p.subjectId !== undefined ? p.subjectId : cur.subjectId,
          taken_at: p.takenAt !== undefined ? p.takenAt : cur.takenAt,
          taken_at_from: p.takenAtFrom !== undefined ? p.takenAtFrom : cur.takenAtFrom,
          trashed_at: p.trashedAt !== undefined ? p.trashedAt : cur.trashedAt,
          data: JSON.stringify(p.data ? { ...cur.data, ...p.data } : cur.data),
        };
        d.prepare(
          `UPDATE media SET subject_id = ?, taken_at = ?, taken_at_from = ?, trashed_at = ?, data = ?, updated_at = ? WHERE household_id = ? AND id = ?`,
        ).run(next.subject_id, next.taken_at, next.taken_at_from, next.trashed_at, next.data, new Date().toISOString(), hid, id);
        return getMedia<T>(id, { includeTrashed: true });
      },
      remove(id: string) {
        if (!getMedia(id, { includeTrashed: true })) return false;
        return d.prepare(`DELETE FROM media WHERE household_id = ? AND id = ?`).run(hid, id).changes > 0;
      },
      trashedBefore<T>(isoDate: string) {
        const rows = d.prepare(`SELECT * FROM media WHERE household_id = ? AND trashed_at IS NOT NULL AND trashed_at < ?`).all(hid, isoDate) as MediaDbRow[];
        return rows.map((r) => toMedia<T>(r));
      },
    },
  };
}
