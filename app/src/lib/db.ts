// 家族の記録を置く小さなデータベース（SQLite）。
// 置き場は app/data/（git の対象外）。本物の家族の記録は公開リポジトリに入らない。
import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

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
 * - wisdom: 窓口の知恵（⑥）
 * - book: 一冊（⑦）
 * - profile: わが家の設定
 * - plan: 家族の役割分担（④）
 */
export type DocType = "record" | "visit" | "local" | "draft" | "done" | "wisdom" | "book" | "profile" | "plan";

export interface Doc<T = Record<string, unknown>> {
  id: string;
  familyId: string;
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
