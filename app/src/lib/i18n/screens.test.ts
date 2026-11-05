// 訳し終えた画面に、t() の外の日本語が残っていない事（2026-11-05 多言語化 (d)・統括の頼み (2)）。
// 見方: 画面の部品の字を TypeScript の構文木で読む（組み立ても試しのサーバも要らない。残った所を「ファイル:行」で出す）。
// - 訳し終えた画面は DONE に足す（UX の③が1つ仕上がるごとに。ファイル・末尾が / の置き場・「ファイル#名前」で1つの宣言だけ）
// - 見る事: ① t() の外に日本語の字が無い（画面の字・属性・式・差し込む値。比べる・case・型・鍵の名前・console・探すだけの呼び出しは除く）
//   ② t() の鍵は辞書に zh と en がある（定数を渡す t(TRIAL_BANNER) も、定数の字を引いて確かめる）
//   ③ 鍵の {n} を渡している・鍵に ${…} やつなぎ（+）を使わない（辞書の鍵と合わなくなる）
//   ④ モジュールの頭で t() を呼ばない（言葉が決まる前に1回だけ評価され、日本語のまま固まる。訳し終えたかに関わらず全部の部品）
// - 除く物: 用語集の窓口の言葉（並べる日本語）と、「// 訳さない: 理由」を付けた所（その行と次の行・注の付いた宣言の中）
// - データの表（{ label: "いま" }・["…"]）と頭の定数の字は、辞書の鍵なら通す（描く所で t(x.label) と訳す形）。
//   描く所で t() を通しているかは、値が変数になると読めない（頭の定数を {TRIAL_BODY} とそのまま出す所だけは拾う）
// - 体験の筋（PATH）の残りをファイルごとに数える（UX の残りの目安）:
//   I18N_LEFT=1 npx vitest run src/lib/i18n/screens.test.ts --silent=false
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { AREAS } from "./dicts";
import { GLOSSARY } from "./glossary";

const SRC = path.join(process.cwd(), "src");

/** 訳し終えた画面（src/ からの道）。UX の③が1つ仕上がるごとに足す */
const DONE: readonly string[] = [
  "components/Welcome.tsx", // 入口の1枚（多言語化③の1・9424bad）
  "components/Shell.tsx", // 上の帯と下のタブ
  "components/today/StagePicker.tsx", // 時期の札
  // 言葉の切り替え（LangSwitch.tsx）は、言葉の名前をそれぞれの言葉で書く。LABEL と SHORT に「// 訳さない: …」を付けてから足す
];

/** 体験の筋（③）。I18N_LEFT=1 で残りを数える */
const PATH: readonly string[] = [
  "components/Welcome.tsx", // 入口の1枚
  "app/start/page.tsx", // はじめの画面
  "components/Shell.tsx", // 上の帯と下のタブ
  "components/LangSwitch.tsx",
  "components/Techo.tsx", // いま（手帳の読み込み）
  "components/today/", // いま
  "components/ask/", // 手帳に聞く
  // 健診（components/visit/・app/visit/）は、健診の凍結が解ける 11/5 15:00 の後に足す
];

type Dict = Readonly<Record<string, { zh?: string; en?: string }>>;
interface Finding {
  file: string;
  line: number;
  text: string;
  why: string;
}

const DICT: Dict = Object.assign({}, ...Object.values(AREAS));
const JA = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const MARK = /(?:\/\/|\/\*|\{\/\*)\s*訳さない/;
/** 用語集の窓口の言葉（訳した画面でも日本語を並べる。長い言葉から外す） */
const COUNTER = GLOSSARY.filter((g) => g.counter)
  .flatMap((g) => [g.ja, ...(g.jaAlt ?? [])])
  .sort((a, b) => b.length - a.length);
const japanese = (s: string) => JA.test(COUNTER.reduce((x, w) => x.split(w).join(""), s));
const slotNames = (s: string) => [...new Set([...s.matchAll(/\{(\w+)(?::[^|{}]*\|[^{}]*)?\}/g)].map((m) => m[1]))];

const LOGICAL = new Set([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.QuestionQuestionToken]);
const COMPARE = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken]);
/** 字の並びを探す・比べる・切るだけの呼び出し（最初の引数は画面に出さない） */
const LOOKUP = new Set(["includes", "startsWith", "endsWith", "indexOf", "lastIndexOf", "has", "get", "delete", "split", "match", "matchAll", "search", "replace", "replaceAll", "localeCompare"]);
/** 値をデータとして持つ属性（画面に出さない） */
const DATA_ATTRS = new Set(["key", "value", "id", "name", "role", "htmlFor", "href", "src", "type", "lang"]);

type Names = { t: Set<string>; tFor: Set<string> };
type Kind = "key" | "joinedKey" | "data" | "jsx" | "table" | "vars" | "other";

const parsed = new Map<string, ts.SourceFile>();
function parse(abs: string, code = fs.readFileSync(abs, "utf8")): ts.SourceFile {
  const hit = parsed.get(abs);
  if (hit && hit.text === code) return hit;
  const sf = ts.createSourceFile(abs, code, ts.ScriptTarget.Latest, true, abs.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  parsed.set(abs, sf);
  return sf;
}

/** t と tFor の名前（import { t as x }・const x = useT() も） */
function namesOf(sf: ts.SourceFile): Names {
  const names: Names = { t: new Set(["t"]), tFor: new Set(["tFor"]) };
  const walk = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && /(^|\/)i18n(\/dicts)?$/.test(n.moduleSpecifier.text)) {
      const b = n.importClause?.namedBindings;
      if (b && ts.isNamedImports(b))
        for (const el of b.elements) {
          const orig = (el.propertyName ?? el.name).text;
          if (orig === "t") names.t.add(el.name.text);
          if (orig === "tFor") names.tFor.add(el.name.text);
        }
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isCallExpression(n.initializer) && ts.isIdentifier(n.initializer.expression) && n.initializer.expression.text === "useT")
      names.t.add(n.name.text);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return names;
}

/** t(…) なら鍵の位置（t は 0・tFor は 1） */
function keyAt(call: ts.CallExpression, names: Names): number | null {
  if (!ts.isIdentifier(call.expression)) return null;
  if (names.t.has(call.expression.text)) return 0;
  if (names.tFor.has(call.expression.text)) return 1;
  return null;
}

const unwrap = (n: ts.Node): ts.Node => {
  let x = n;
  while (x.parent && (ts.isParenthesizedExpression(x.parent) || ts.isAsExpression(x.parent) || ts.isSatisfiesExpression(x.parent) || ts.isNonNullExpression(x.parent))) x = x.parent;
  return x;
};
const isDataAttr = (a: ts.JsxAttribute) => {
  const name = a.name.getText();
  return DATA_ATTRS.has(name) || name.startsWith("data-");
};

/** 字の並びがどこに入っているか（画面に出る所か、データか） */
function kindOf(node: ts.Node, names: Names): { kind: Kind; call?: ts.CallExpression; at?: number } {
  let n = node;
  let joined = ts.isTemplateExpression(node);
  for (let p = n.parent; p; n = p, p = p.parent) {
    if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isSatisfiesExpression(p) || ts.isNonNullExpression(p) || ts.isTypeAssertionExpression(p)) continue;
    if (ts.isConditionalExpression(p) && n !== p.condition) continue;
    if (ts.isBinaryExpression(p) && LOGICAL.has(p.operatorToken.kind)) continue;
    if ((ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.PlusToken) || ts.isTemplateSpan(p) || ts.isTemplateExpression(p)) {
      joined = true;
      continue;
    }
    if (ts.isCallExpression(p)) {
      const i = p.arguments.indexOf(n as ts.Expression);
      const at = keyAt(p, names);
      if (at !== null) return i === at ? { kind: joined ? "joinedKey" : "key", call: p, at } : { kind: "other" };
      const c = p.expression;
      if (ts.isPropertyAccessExpression(c) && ((ts.isIdentifier(c.expression) && c.expression.text === "console") || (LOOKUP.has(c.name.text) && i === 0))) return { kind: "data" };
      return { kind: "other" };
    }
    if (ts.isNewExpression(p)) return { kind: ["RegExp", "Set"].includes(p.expression.getText()) ? "data" : "other" };
    if (ts.isPropertyAccessExpression(p)) return { kind: p.expression === n && LOOKUP.has(p.name.text) ? "data" : "other" };
    if ((ts.isBinaryExpression(p) && COMPARE.has(p.operatorToken.kind)) || ts.isCaseClause(p)) return { kind: "data" };
    if (ts.isPropertyAssignment(p)) {
      if (p.name === n) return { kind: "data" };
      const obj = unwrap(p.parent);
      const call = obj.parent;
      if (call && ts.isCallExpression(call)) {
        const at = keyAt(call, names);
        if (at !== null && call.arguments[at + 1] === obj) return { kind: "vars" };
      }
      return { kind: joined ? "other" : "table" };
    }
    if (ts.isComputedPropertyName(p) || (ts.isElementAccessExpression(p) && p.argumentExpression === n)) return { kind: "data" };
    if (ts.isArrayLiteralExpression(p)) {
      const arr = unwrap(p);
      const up = arr.parent;
      if (up && ((ts.isPropertyAccessExpression(up) && LOOKUP.has(up.name.text)) || (ts.isNewExpression(up) && up.expression.getText() === "Set"))) return { kind: "data" };
      return { kind: joined ? "other" : "table" };
    }
    if (ts.isVariableDeclaration(p)) {
      // 頭の定数（const BANNER = "…"）は、辞書の鍵なら通す（描く所で t(BANNER)）
      const top = ts.isVariableDeclarationList(p.parent) && p.parent.flags & ts.NodeFlags.Const && ts.isVariableStatement(p.parent.parent) && ts.isSourceFile(p.parent.parent.parent);
      return { kind: top && !joined ? "table" : "other" };
    }
    if (ts.isJsxAttribute(p)) return { kind: isDataAttr(p) ? "data" : "jsx" };
    if (ts.isJsxExpression(p)) return { kind: p.parent && ts.isJsxAttribute(p.parent) && isDataAttr(p.parent) ? "data" : "jsx" };
    if (ts.isTypeNode(p) || ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return { kind: "data" };
    return { kind: "other" };
  }
  return { kind: "other" };
}

/** 頭の定数（const X = "…"）の字と、「訳さない」の注が付いているか。import した定数は、その部品を読んで引く（@/ と ./ だけ） */
function constOf(sf: ts.SourceFile, name: string, depth = 0): { text: string; marked: boolean } | null {
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st) && st.declarationList.flags & ts.NodeFlags.Const)
      for (const d of st.declarationList.declarations)
        if (ts.isIdentifier(d.name) && d.name.text === name && d.initializer && (ts.isStringLiteral(d.initializer) || ts.isNoSubstitutionTemplateLiteral(d.initializer)))
          return { text: d.initializer.text, marked: marked(sf, d.initializer, sf.getLineAndCharacterOfPosition(d.initializer.getStart(sf)).line) };
    if (depth < 2 && ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) {
      const el = st.importClause.namedBindings.elements.find((e) => e.name.text === name);
      if (!el) continue;
      const spec = st.moduleSpecifier.text;
      const base = spec.startsWith("@/") ? path.join(SRC, spec.slice(2)) : spec.startsWith(".") ? path.join(path.dirname(sf.fileName), spec) : null;
      const file = base && [".ts", ".tsx", "/index.ts"].map((x) => base + x).find((f) => fs.existsSync(f));
      return file ? constOf(parse(file), (el.propertyName ?? el.name).text, depth + 1) : null;
    }
  }
  return null;
}

/** 「// 訳さない: 理由」がその行・前の行・包む宣言の頭にあるか */
function marked(sf: ts.SourceFile, node: ts.Node, line: number): boolean {
  const lines = sf.text.split("\n");
  if (MARK.test(lines[line] ?? "") || MARK.test(lines[line - 1] ?? "")) return true;
  for (let a: ts.Node | undefined = node; a && !ts.isSourceFile(a); a = a.parent)
    for (const r of ts.getLeadingCommentRanges(sf.text, a.getFullStart()) ?? []) if (MARK.test(sf.text.slice(r.pos, r.end))) return true;
  return false;
}

/** 部品1つを読む（only を渡すと、その名前の頭の宣言だけ） */
function scan(file: string, sf: ts.SourceFile, dict: Dict, only?: string): Finding[] {
  const names = namesOf(sf);
  const out: Finding[] = [];
  const inDict = (k: string) => Boolean(dict[k]?.zh && dict[k]?.en);
  const add = (node: ts.Node, text: string, why: string) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
    if (!marked(sf, node, line)) out.push({ file, line: line + 1, text: text.replace(/\s+/g, " ").trim().slice(0, 40), why });
  };
  const checkKey = (node: ts.Node, key: string, call: ts.CallExpression, at: number) => {
    if (japanese(key) && !inDict(key)) add(node, key, "辞書に無い鍵（zh・en の画面で日本語のまま出る）");
    const need = slotNames(key);
    const vars = call.arguments[at + 1];
    if (!need.length || (vars && !ts.isObjectLiteralExpression(vars))) return;
    if (vars && ts.isObjectLiteralExpression(vars) && vars.properties.some(ts.isSpreadAssignment)) return;
    const have = new Set((vars && ts.isObjectLiteralExpression(vars) ? vars.properties : []).map((p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : "")));
    const lack = need.filter((x) => !have.has(x));
    if (lack.length) add(node, key, `{${lack.join("}・{")}} を渡していない（画面に {${lack[0]}} のまま出る）`);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      if (japanese(node.text)) add(node, node.text, "画面の字が t() の外");
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const text = ts.isTemplateExpression(node) ? node.head.text + node.templateSpans.map((s) => `…${s.literal.text}`).join("") : node.text;
      const { kind, call, at } = kindOf(node, names);
      if (kind === "key" && call && at !== undefined) checkKey(node, text, call, at);
      else if (kind === "joinedKey") {
        if (JA.test(text)) add(node, text, "鍵に ${…} やつなぎ（+）を使わない（{名前} で差し込む）");
      } else if (kind === "vars") {
        if (japanese(text)) add(node, text, "差し込む値も t() で訳す");
      } else if (kind === "table") {
        if (!inDict(text) && japanese(text)) add(node, text, "t() の外（データの表・定数なら、辞書の鍵にして描く所で t() で訳す）");
      } else if (kind === "jsx") {
        if (japanese(text)) add(node, text, "画面の字が t() の外");
      } else if (kind === "other" && japanese(text)) add(node, text, "t() の外");
      if (ts.isTemplateExpression(node)) for (const s of node.templateSpans) visit(s.expression);
      return;
    }
    // t(定数) は定数の字を鍵として引く。{定数} とそのまま出す所は、日本語の定数なら拾う
    if (ts.isCallExpression(node)) {
      const at = keyAt(node, names);
      const arg = at === null ? undefined : node.arguments[at];
      if (at !== null && arg && ts.isIdentifier(arg)) {
        const c = constOf(sf, arg.text);
        if (c) checkKey(arg, c.text, node, at);
      }
    }
    if (ts.isJsxExpression(node) && node.expression && ts.isIdentifier(node.expression) && !(node.parent && ts.isJsxAttribute(node.parent) && isDataAttr(node.parent))) {
      const c = constOf(sf, node.expression.text);
      if (c && !c.marked && japanese(c.text)) add(node, c.text, `定数 ${node.expression.text} の日本語が t() の外`);
    }
    ts.forEachChild(node, visit);
  };
  const declares = (st: ts.Statement) =>
    (ts.isVariableStatement(st) && st.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === only)) ||
    ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name?.text === only);
  for (const st of sf.statements) if (!only || declares(st)) visit(st);
  return out;
}

/** モジュールの頭（関数の外）で呼ぶ t() */
function topLevelT(file: string, sf: ts.SourceFile): Finding[] {
  const names = namesOf(sf);
  const out: Finding[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.t.has(node.expression.text)) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      out.push({ file, line, text: node.getText(sf).slice(0, 40), why: "モジュールの頭で t() を呼ばない（言葉が決まる前に日本語のまま固まる）" });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** DONE・PATH の1行を、読む部品の一覧に（置き場は中の .ts・.tsx。試験は除く） */
function expand(entry: string): { rel: string; only?: string }[] {
  const [rel, only] = entry.split("#");
  const abs = path.join(SRC, rel);
  if (!rel.endsWith("/")) return [{ rel, only }];
  const out: { rel: string }[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push({ rel: path.relative(SRC, p) });
    }
  };
  walk(abs);
  return out;
}

const scanEntry = (entry: string, dict: Dict = DICT) => expand(entry).flatMap(({ rel, only }) => scan(rel, parse(path.join(SRC, rel)), dict, only));
const show = (f: Finding[]) => f.map((x) => `${x.file}:${x.line} 「${x.text}」 ${x.why}`);

describe("訳し終えた画面に、t() の外の日本語が残っていない（UX の③・DONE に足した画面）", () => {
  it("DONE の部品がある（道の書き間違いで、見ないまま通らない）", () => {
    for (const entry of DONE) for (const { rel } of expand(entry)) expect(fs.existsSync(path.join(SRC, rel)), rel).toBe(true);
  });

  it("① t() の外に日本語が無い ② 鍵が辞書にある ③ 差し込みを渡している", () => {
    expect(show(DONE.flatMap((e) => scanEntry(e)))).toEqual([]);
  });

  it("④ モジュールの頭で t() を呼ばない（すべての部品）", () => {
    const files = expand("./").filter(({ rel }) => !rel.startsWith("lib/i18n/") && /i18n|useT\(/.test(fs.readFileSync(path.join(SRC, rel), "utf8")));
    expect(files.length).toBeGreaterThan(0);
    expect(show(files.flatMap(({ rel }) => topLevelT(rel, parse(path.join(SRC, rel)))))).toEqual([]);
  });

  // 残りを数える試験は I18N_LEFT=1 の時だけ作る（ふだんの試験の数と「飛ばした」に入れない）
  if (process.env.I18N_LEFT) it("体験の筋の残り（I18N_LEFT=1 の時だけ）", () => {
    for (const entry of PATH) {
      const left = scanEntry(entry);
      const by = new Map<string, Finding[]>();
      for (const f of left) by.set(f.file, [...(by.get(f.file) ?? []), f]);
      for (const { rel } of expand(entry)) {
        const f = by.get(rel) ?? [];
        console.log(`${DONE.some((d) => rel.startsWith(d.split("#")[0])) ? "済" : "　"} ${rel}: ${f.length}件${f.length ? `（${show(f.slice(0, 3)).join(" ／ ")}）` : ""}`);
      }
    }
  });
});

describe("読み方の確かめ（わざと残した字を見落とさない・データは拾わない）", () => {
  const dict: Dict = {
    いま: { zh: "现在", en: "Now" },
    済んだ: { zh: "完成了", en: "Done" },
    閉じる: { zh: "关闭", en: "Close" },
    "あと{n}日": { zh: "还有{n}天", en: "{n} {n:day|days} left" },
    "{who}の番": { zh: "轮到{who}", en: "{who}'s turn" },
    体験版です: { zh: "这是体验版", en: "This is the trial" },
  };
  const run = (code: string) => scan("x.tsx", parse(path.join(SRC, "__fixture__.tsx"), code), dict).map((f) => `${f.line} ${f.text}: ${f.why}`);

  it("画面の字・属性・式・差し込む値・辞書に無い鍵・渡していない {n}・${…} の鍵を拾う", () => {
    const code = [
      'import { t } from "@/lib/i18n";', // 1
      "export function X({ n, ok }: { n: number; ok: boolean }) {", // 2
      '  const msg = ok ? t("済んだ") : "まだ";', // 3
      "  return (", // 4
      '    <div title="閉じる" aria-label={t("閉じる")} data-x="母">', // 5
      "      済んだ事", // 6
      '      {t("あと{n}日")}', // 7
      '      {t("あと{n}日", { n })}', // 8
      "      {t(`あと${n}日`)}", // 9
      '      {t("辞書に無い")}', // 10
      '      {t("{who}の番", { who: "母" })}', // 11
      '      {ok ? "はい" : null}{msg}', // 12
      "    </div>", // 13
      "  );", // 14
      "}", // 15
    ].join("\n");
    expect(run(code)).toEqual([
      "3 まだ: t() の外",
      "5 閉じる: 画面の字が t() の外",
      "6 済んだ事: 画面の字が t() の外",
      "7 あと{n}日: {n} を渡していない（画面に {n} のまま出る）",
      "9 あと…日: 鍵に ${…} やつなぎ（+）を使わない（{名前} で差し込む）",
      "10 辞書に無い: 辞書に無い鍵（zh・en の画面で日本語のまま出る）",
      "11 母: 差し込む値も t() で訳す",
      "12 はい: 画面の字が t() の外",
    ]);
  });

  it("比べる・case・型・鍵の名前・console・探すだけの呼び出し・データの属性・窓口の言葉・「訳さない」の注・辞書の鍵のデータは通す", () => {
    const code = [
      'import { t as tr } from "@/lib/i18n";',
      'type Role = "母" | "父";',
      'const TABS = [{ href: "/", label: "いま" }];',
      "// 訳さない: 保存する値（出す時に t() で訳す）",
      'const ROLES = [{ role: "母", name: "パートナー" }];',
      'const BANNER = "体験版です";',
      "export function Y({ who }: { who: Role }) {",
      '  if (who === "母") console.log("母を見た");',
      '  switch (who) { case "父": return null; }',
      '  const map: Record<string, number> = { "母": 1 };',
      '  const ok = ["母", "父"].includes(who) && who.startsWith("母") && new Set(["父"]).has(who) && map["母"];',
      '  return <p data-who="母" key="母">{tr("済んだ")}（出生届）{tr(BANNER)}{ok ? tr("いま") : null}</p>; // 訳さない を付けていない行',
      "}",
    ].join("\n");
    expect(run(code)).toEqual([]);
  });

  it("データの表・頭の定数の字が辞書に無ければ拾う。頭の定数を {BANNER} とそのまま出す所も拾う（「訳さない」の注の付いた定数は通す）。t(定数) は定数の字で辞書を引く", () => {
    const code = [
      'import { t } from "@/lib/i18n";',
      'const TABS = [{ label: "いま" }, { label: "手帳" }];',
      'const NOTE = "辞書に無い注";',
      'const BANNER = "体験版です";',
      '// 訳さない: 言葉の名前は、それぞれの言葉で書く',
      'const LABEL = "言葉 / 语言 / Language";',
      "export const Z = () => <p aria-label={LABEL}>{BANNER}{t(NOTE)}</p>;",
    ].join("\n");
    expect(run(code)).toEqual([
      "2 手帳: t() の外（データの表・定数なら、辞書の鍵にして描く所で t() で訳す）",
      "3 辞書に無い注: t() の外（データの表・定数なら、辞書の鍵にして描く所で t() で訳す）",
      "7 体験版です: 定数 BANNER の日本語が t() の外",
      "7 辞書に無い注: 辞書に無い鍵（zh・en の画面で日本語のまま出る）",
    ]);
  });

  it("④ モジュールの頭の t() を拾う（関数・矢印の中は通す）", () => {
    const sf = parse(path.join(SRC, "__fixture2__.tsx"), ['import { t } from "@/lib/i18n";', 'const A = t("いま");', 'const B = () => t("いま");', 'function C() { return t("いま"); }', 'export const D = { label: t("済んだ") };'].join("\n"));
    expect(topLevelT("x.tsx", sf).map((f) => `${f.line} ${f.text}`)).toEqual(['2 t("いま")', '5 t("済んだ")']);
  });
});
