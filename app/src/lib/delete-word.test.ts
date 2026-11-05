// 消す前の確かめの言葉（lib/delete-word.ts）。画面の言葉で打てて、サーバへはいつも「消す」を送る事
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DELETE_WORD, deleteConfirmed, deleteWordShown } from "./delete-word";
import { setLocale } from "./i18n";
import { DICTS } from "./i18n/dicts";

const read = (f: string) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

describe("消す前の確かめの言葉", () => {
  it("日本語: 「消す」と打つ（前と同じ）", () => {
    expect(deleteWordShown()).toBe("消す");
    expect(deleteConfirmed("消す")).toBe(true);
    expect(deleteConfirmed(" 消す ")).toBe(true);
    for (const s of ["", "けす", "消", "delete"]) expect(deleteConfirmed(s), s).toBe(false);
  });

  it("中文・English: 画面の言葉で打てる。「消す」と打っても通す", () => {
    // 画面の言葉はブラウザでだけ決まる（lib/i18n の setLocale）ので、この試験の間だけ window を置く
    vi.stubGlobal("window", {});
    try {
      setLocale("zh", DICTS.zh);
      expect(deleteWordShown()).toBe("删除");
      expect(deleteConfirmed("删除")).toBe(true);
      expect(deleteConfirmed("消す")).toBe(true);
      for (const s of ["", "删", "delete"]) expect(deleteConfirmed(s), s).toBe(false);
      setLocale("en", DICTS.en);
      expect(deleteWordShown()).toBe("delete");
      for (const s of ["delete", "Delete", " DELETE ", "消す"]) expect(deleteConfirmed(s), s).toBe(true);
      for (const s of ["", "del", "删除"]) expect(deleteConfirmed(s), s).toBe(false);
    } finally {
      setLocale("ja", {});
      vi.unstubAllGlobals();
    }
  });

  it("画面はサーバへ「消す」（DELETE_WORD）を送り、打った字はそのまま送らない。サーバは「消す」で比べる", () => {
    expect(DELETE_WORD).toBe("消す");
    const page = read("app/account/page.tsx");
    expect(page.match(/confirm: DELETE_WORD/g)).toHaveLength(2);
    expect(page).toMatch(/disabled=\{busy \|\| !deleteConfirmed\(confirm\)\}/);
    expect(page).not.toMatch(/confirm !== "消す"/);
    for (const f of ["app/api/account/household/route.ts", "app/api/account/subject/route.ts"]) expect(read(f), f).toMatch(/b\.confirm !== "消す"/);
  });
});
