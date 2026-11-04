// 「米国の Claude に送る同意」の「何を送るか」は、実際に送っている物と同じにする（2026-11-05 UX・見直しの C12）。
// それまでの文は「送るのは文字だけ」「氏名・住所は送りません」で、撮った紙の写真・家族の呼び名・病院と職場を送っている事実と違っていた。
// 版（CONSENT_VERSION）を上げて取り直す日は統括が決める（ここでは版を見ない）。
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLAUDE_US } from "./consent-texts";

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
