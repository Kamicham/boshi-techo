// 「米国の Claude に送る同意」の「何を送るか」は、実際に送っている物と同じにする（2026-11-05 UX・見直しの C12）。
// それまでの文は「送るのは文字だけ」「氏名・住所は送りません」で、撮った紙の写真・家族の呼び名・病院と職場を送っている事実と違っていた。
// 版（CONSENT_VERSION）は 2026-11-05 に record・claude_us とも上げた（統括）。ここでは、文を本当の事にそろえた版より前へ戻らない事を見る。
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLAUDE_US, CONSENT_VERSION, RECORD_HONEST, RECORD_PURPOSES } from "./consent-texts";

const what = CLAUDE_US.what.join("\n");

describe("米国の Claude に送る同意の「何を送るか」", () => {
  it("事実と違う約束を戻さない", () => {
    expect(what).not.toMatch(/氏名・住所は送りません|名前・住所は送りません|送るのは文字だけ/);
  });

  it("送る物の種類が載っている（写真・家族の名前・病院・職場・会話・記録）", () => {
    for (const w of ["撮った紙・手帳のページの写真", "家族の名前", "病院（名前と電話）", "職場（会社名・部署・上司・人事）", "30日分の会話", "最近の記録", "住む町"]) expect(what).toContain(w);
  });

  it("仕事ごとに書く（話す・撮る・健診・手帳に聞く・下書き・気づき・一冊）", () => {
    for (const w of ["話す・撮る", "健診", "手帳に聞く", "下書き", "気づき", "一冊"]) expect(what).toContain(w);
  });

  it("送らない物も正直に書く（声そのもの・アルバムの写真は選んだ1枚だけ・話した事に書いてあればそのまま送る）", () => {
    expect(what).toContain("声そのものは送りません");
    expect(what).toContain("「この1枚を見せる」と選んだ時だけ");
    expect(what).toContain("話した事・撮った紙に書いてあれば、その文字や写真はそのまま送ります");
  });
});

describe("同意の案内の文（画面）に、事実と違う約束が無い", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const files = [
    "components/settings/ClaudeConsentLink.tsx",
    "components/ask/AskSheet.tsx",
    "components/album/VoiceKeeper.tsx",
    "app/account/consent/page.tsx",
    "app/account/consent/claude/page.tsx",
  ];
  it.each(files)("%s", (f) => {
    const src = fs.readFileSync(path.join(root, f), "utf8");
    expect(src).not.toMatch(/名前・住所は送りません|送るのは問いの文字だけ|送るのは文字だけで|文字にせず、声のまま|AI（Claude）には送りません。文字にするのは手帳の機械だけ/);
  });

  it("送り先を「手帳の中の AI」と書かない（米国の会社の AI に送っている）", () => {
    for (const f of ["components/capture/CaptureScreen.tsx", "lib/claude.ts"]) {
      expect(fs.readFileSync(path.join(root, f), "utf8")).not.toMatch(/手帳の中の ?AI/);
    }
  });

  it("同意の画面に、同意しない時に止まる物と使える物と、1人でも同意していないと止まる事が書いてある", () => {
    const src = fs.readFileSync(path.join(root, "app/account/consent/claude/page.tsx"), "utf8");
    expect(src).toContain("止まる物:");
    expect(src).toContain("そのまま使える物:");
    expect(src).toContain("1人でも同意していない");
  });
});

describe("記録の同意の文が、今のコードでできる事を越えない（UX の訳で見つかった食い違い・統括）", () => {
  const root = path.resolve(import.meta.dirname, "../..");

  it("使い方の要点に「見せると決めた範囲だけを見せる」と書かない（見せる範囲は、まだ選べない）", () => {
    const all = RECORD_PURPOSES.join("\n");
    expect(all).not.toMatch(/見せると決めた範囲|選んだ範囲だけ/);
    expect(all).toContain("見せる範囲を選ぶ仕組みは準備中です");
  });

  it.each(["components/settings/ConsentScreen.tsx", "app/account/page.tsx", "app/account/consent/page.tsx"])(
    "%s に、押すまで・撤回の後は「記録を残さない」と書かない（同意のない本人の記録を、サーバで止める所はまだ無い）",
    (f) => {
      const text = fs.readFileSync(path.join(root, f), "utf8");
      expect(text).not.toMatch(/記録は残しません/);
    },
  );

  it("文を本当の事にそろえた版（2026-11-05）より前へ、版を戻さない", () => {
    expect(CONSENT_VERSION.record >= "2026-11-05").toBe(true);
    expect(CONSENT_VERSION.claude_us >= "2026-11-05").toBe(true);
  });
});

describe("健診の録音を「暗号にしている」と書かない（2026-11-06 全体監査。健診の録音は、まだ素のファイルで置く）", () => {
  const root = path.resolve(import.meta.dirname, "../..");

  it("健診の録音を暗号にしていない間は、同意の文と世帯を作る画面にそう書く（暗号にしたら、この試験と文を一緒に直す）", () => {
    const visitServer = fs.readFileSync(path.join(root, "app/api/visit/_lib/server.ts"), "utf8");
    expect(visitServer).not.toContain("sealForHousehold");
    expect(RECORD_HONEST).toContain("健診の録音と、記録の文字（健診の結果など）は、まだ暗号にしていません");
    expect([...RECORD_PURPOSES, ...RECORD_HONEST].join("\n")).not.toMatch(/写真・録音のファイル/);
    const page = fs.readFileSync(path.join(root, "app/account/new/page.tsx"), "utf8");
    expect(page).toContain("健診の録音は、まだ暗号にしていません");
    expect(page).not.toContain("写真・録音のファイル");
  });

  it("文を直した版（2026-11-06）より前へ、記録の同意の版を戻さない", () => {
    expect(CONSENT_VERSION.record >= "2026-11-06").toBe(true);
  });
});
