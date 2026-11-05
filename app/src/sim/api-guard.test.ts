// 関所の書き忘れを見つける試験: app/src/app/api/**/route.ts（健診の録音 visit を除く）を読み、どの口も
// 「withHousehold（セッション → 世帯 → 権限）」か、理由つきの公開の口を通る事を、コードの文字で確かめる（設計 ⑨の「関所の書き忘れ」）。
//
// 決まり:
//   1) 書き出している処理（GET・POST など）の1つずつが、withHousehold を呼ぶ（同じファイルか、近くの _lib・shared の関数を通してもよい）
//      family の一覧や世帯を作る口のように、世帯を指さない口は requireAccount / currentAccount でもよい（familyId を受け取らない時だけ）
//   2) 古い関所 requireFamily（家族の id を信じるだけ）を使わない
//   3) 公開の口（下の PUBLIC）は、理由と、その口が守るべき印（文字）を持つ
// 健診の録音（api/visit/**）は 11/5 の健診が済むまで触らない約束なので、ここでは数えない（関所は 11/5 の後に主担当が足す）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "app", "api");

/** 公開の口: ログインなしで通してよい理由と、中に必ず有るべき文字（守りの印） */
const PUBLIC: Record<string, { why: string; must: RegExp[] }> = {
  "auth/[...all]/route.ts": { why: "ログインそのもの（Better Auth。コード・パスキー・招待は Better Auth が確かめる）", must: [/authReady\(/] },
  "sim/login/route.ts": { why: "シミュレーションのサーバ（BOSHI_SIM=1）だけの仮のログイン。本番では中身を読まずに 404", must: [/process\.env\.BOSHI_SIM\s*!==\s*"1"/, /status:\s*404/] },
  "unlock/route.ts": { why: "合言葉の門（11/5 の後に外す。記録には触らない）", must: [] },
  "media/file/route.ts": { why: "期限つきの URL（署名を確かめてから置き場の鍵に戻す）", must: [/keyFromSignedUrl\(|verifySignedPath\(/] },
  "health/route.ts": { why: "見張りの口（fly.toml の checks・15秒ごと）。記録に触らず、動いている事と置き場の空きだけを返す。門は札を配らない", must: [/dataFree\(/] },
};

function walk(d: string): string[] {
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : e.name === "route.ts" ? [p] : [];
  });
}

const rel = (p: string) => path.relative(API, p).split(path.sep).join("/");
const routes = walk(API).filter((p) => !rel(p).startsWith("visit/"));

/** コメントと文字列の中の「withHousehold」で騙されないよう、コメントを外す（文字列はそのまま。呼び出しの形で見る） */
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/** route が読む近くのファイル（./ と ../ と @/app/api/ の、api の下にある物。そこからさらに読む物も） */
function localImports(file: string, src: string, seen = new Set<string>([file])): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/from\s+["']((?:\.{1,2}|@\/app\/api)\/[^"']+)["']/g)) {
    const spec = m[1].startsWith("@/") ? path.join(API, m[1].slice("@/app/api/".length)) : path.resolve(path.dirname(file), m[1]);
    for (const c of [spec + ".ts", spec + ".tsx", path.join(spec, "index.ts")]) {
      if (!c.startsWith(API) || !fs.existsSync(c) || seen.has(c)) continue;
      seen.add(c);
      out.push(c, ...localImports(c, fs.readFileSync(c, "utf8"), seen));
    }
  }
  return out;
}

const GUARD = /\bwithHousehold\s*\(/;
const ACCOUNT = /\b(requireAccount|currentAccount)\s*\(/;

/** 関数ごとの本文（function NAME / const NAME = … から、次の宣言まで） */
function declarations(src: string): { name: string; body: string }[] {
  const decl = /(?:^|\n)(?:export\s+)?(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*=)/g;
  const marks = [...src.matchAll(decl)].map((m) => ({ at: m.index ?? 0, name: m[1] ?? m[2] }));
  return marks.map((m, i) => ({ name: m.name, body: src.slice(m.at, marks[i + 1]?.at ?? src.length) }));
}

const callOf = (name: string) => new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\s*\\(`);

/**
 * 関所を呼ぶ関数の名前（関所を直に呼ぶ関数と、その関数を呼ぶ関数を、増えなくなるまでたどる）。
 * ほかの処理から呼ばれると、その処理も守られている（例: familyFor → householdFor → withHousehold）
 */
function guardFunctions(srcs: string[], guard: RegExp): string[] {
  const decls = srcs.flatMap(declarations);
  const names = new Set<string>();
  for (let grew = true; grew; ) {
    grew = false;
    for (const d of decls) {
      if (names.has(d.name)) continue;
      if (guard.test(d.body) || [...names].some((n) => n !== d.name && callOf(n).test(d.body))) {
        names.add(d.name);
        grew = true;
      }
    }
  }
  return [...names];
}

/** 書き出している処理ごとの本文（export const GET = … / export async function GET / export { handle as GET }） */
function handlers(src: string): { method: string; body: string }[] {
  const out: { method: string; body: string }[] = [];
  const re = /(?:^|\n)export\s+(?:const\s+(GET|POST|PUT|PATCH|DELETE)\s*=|(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b)/g;
  const marks = [...src.matchAll(re)].map((m) => ({ at: m.index ?? 0, method: m[1] ?? m[2] }));
  const next = (at: number) => {
    // 次の上の段の宣言（export・function・const など）まで。後ろに書いた別の関数を、この処理の本文に数えない
    const r = /\n(?:export\s|async\s+function\s|function\s|const\s|let\s|type\s|interface\s|class\s)/g;
    r.lastIndex = at + 1;
    const m = r.exec(src);
    return m ? m.index : src.length;
  };
  for (const m of marks) out.push({ method: m.method, body: src.slice(m.at, next(m.at)) });
  // export { handle as GET, handle as POST }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const mm = /^\s*([A-Za-z_$][\w$]*)\s+as\s+(GET|POST|PUT|PATCH|DELETE)\s*$/.exec(part);
      if (mm) out.push({ method: mm[2], body: `${mm[1]}()` });
    }
  }
  return out;
}

type Verdict = { route: string; ok: boolean; problems: string[] };

function check(file: string): Verdict {
  const r = rel(file);
  const src = stripComments(fs.readFileSync(file, "utf8"));
  const problems: string[] = [];

  const pub = PUBLIC[r];
  if (pub) {
    for (const re of pub.must) if (!re.test(src)) problems.push(`公開の口なのに、守りの印 ${re} が無い`);
    if (/\brequireFamily\s*\(/.test(src)) problems.push("古い関所 requireFamily を使っている");
    return { route: r, ok: problems.length === 0, problems };
  }

  if (/\brequireFamily\s*\(/.test(src)) problems.push("古い関所 requireFamily（家族の id を信じるだけ）を使っている → withHousehold に替える");

  const near = localImports(file, src).map((p) => stripComments(fs.readFileSync(p, "utf8")));
  const EITHER = new RegExp(`${GUARD.source}|${ACCOUNT.source}`);
  // 関所を呼ぶ関数（このファイル・近くのファイル）。世帯の関所と、アカウントだけの関所を分けて持つ
  const hhGuards = guardFunctions([src, ...near], GUARD);
  const anyGuards = guardFunctions([src, ...near], EITHER);
  const calls = (body: string, re: RegExp, names: string[]) => re.test(body) || names.some((g) => callOf(g).test(body));

  const hs = handlers(src);
  if (!hs.length) problems.push("書き出している処理（GET・POST など）が見つからない");
  for (const h of hs) {
    // familyId を受け取る処理は、世帯の関所（withHousehold）が要る。受け取らない処理（世帯を作る・招待を見る）はアカウントの関所でもよい
    const takesFamily = /\bfamilyId\b/.test(h.body);
    const ok = takesFamily ? calls(h.body, GUARD, hhGuards) : calls(h.body, EITHER, anyGuards);
    if (!ok) problems.push(`${h.method} が ${takesFamily ? "withHousehold" : "withHousehold か requireAccount"} を通っていない`);
  }
  return { route: r, ok: problems.length === 0, problems };
}

describe("関所の書き忘れ（api/**/route.ts を読む。visit は 11/5 の後）", () => {
  it("route.ts が見つかる（数えそこねていない）", () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  it("公開の口の一覧に、無くなった route が残っていない（一覧は実際の道だけ）", () => {
    // media/file は写真の担当が作る口。まだ無い時は飛ばす
    const stale = Object.keys(PUBLIC).filter((k) => k !== "media/file/route.ts" && !fs.existsSync(path.join(API, k)));
    expect(stale).toEqual([]);
  });

  it("どの口も withHousehold か、理由つきの公開の口を通る", () => {
    const bad = routes.map(check).filter((v) => !v.ok);
    expect(bad.map((v) => `${v.route}: ${v.problems.join("／")}`)).toEqual([]);
  });

  it("試験の道具が正しく見分ける（関所の無い口・古い関所・公開の口の印の欠け）", () => {
    // 見分けの自己確かめ: 一時ファイルではなく、文字で組んだ見本に同じ関数をかける
    const fake = (src: string) => {
      const p = path.join(API, "__fake__", "route.ts");
      const s = stripComments(src);
      const hs = handlers(s);
      const guards = guardFunctions([s], GUARD);
      return { p, hs, ok: hs.every((h) => GUARD.test(h.body) || guards.some((g) => callOf(g).test(h.body))) };
    };
    expect(fake(`export const GET = route(async (req) => { const ctx = await withHousehold(req, id, "record:read"); });`).ok).toBe(true);
    expect(fake(`export const GET = route(async (req) => { return list(id); });`).ok).toBe(false);
    // コメントの中の withHousehold では通らない
    expect(fake(`// withHousehold を呼ぶ\nexport const GET = route(async (req) => { return list(id); });`).ok).toBe(false);
    // 片方だけ守っている
    expect(fake(`export const GET = route(async (req) => { await withHousehold(req, id, "record:read"); });\nexport const POST = route(async (req) => { put(id); });`).ok).toBe(false);
    // 近くの関数を通す
    expect(fake(`async function ctxOf(req) { return withHousehold(req, id, "record:read"); }\nexport const GET = route(async (req) => { const c = await ctxOf(req); });`).ok).toBe(true);
    // 関数を2段たどる（familyFor → householdFor → withHousehold）
    expect(fake(`async function householdFor(req, id) { return withHousehold(req, id, "record:read"); }\nasync function familyFor(req, id) { const h = await householdFor(req, id); return h; }\nexport const GET = route(async (req) => { await familyFor(req, id); });`).ok).toBe(true);
    // export { handle as GET }
    expect(fake(`async function handle(req) { await withHousehold(req, id, "record:read"); }\nexport { handle as GET, handle as POST };`).ok).toBe(true);
    expect(fake(`async function handle(req) { return list(id); }\nexport { handle as GET };`).ok).toBe(false);
  });
});
