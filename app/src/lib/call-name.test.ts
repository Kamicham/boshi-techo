// 子どもから見た呼び名（lib/call-name.ts）の試験。作った家族だけ（Claude は呼ばない）。
import { describe, expect, it } from "vitest";
import { callNameField, childView, cleanCallName } from "./call-name";
import { DEMO_FAMILY } from "./demo-family";

describe("子どもから見た呼び名", () => {
  it("整える: 前後の空白を取り、10字まで。空・文字でない物は無し", () => {
    expect(cleanCallName(" かあちゃん ")).toBe("かあちゃん");
    expect(cleanCallName("あいうえおかきくけこさし")).toBe("あいうえおかきくけこ");
    expect(cleanCallName("  ")).toBeUndefined();
    expect(cleanCallName(undefined)).toBeUndefined();
    expect(cleanCallName(3)).toBeUndefined();
    expect(callNameField(" パパ ")).toEqual({ callName: "パパ" });
    expect(callNameField("")).toEqual({});
  });

  it("手紙・一冊・映画の言い方: 呼び名がある人は「ママ（美咲）」、無い人・家族の外の人は名前だけ", () => {
    expect(childView(DEMO_FAMILY, "美咲")).toBe("ママ（美咲）");
    expect(childView(DEMO_FAMILY, "翔太")).toBe("パパ（翔太）");
    // 招いた人（家族の一人ではない）は書いた名前のまま
    expect(childView(DEMO_FAMILY, "おばあちゃん")).toBe("おばあちゃん");
    // 呼び名が名前と同じなら1つだけ
    expect(childView({ members: [{ id: "a", name: "かあちゃん", role: "母", callName: "かあちゃん" }] }, "かあちゃん")).toBe("かあちゃん");
  });

  it("11/4 までの形の家族（呼び名の欄が無い）は、今までどおり名前だけ。役から「ママ」「パパ」を決めつけない", () => {
    const old = { members: DEMO_FAMILY.members.map((m) => ({ id: m.id, name: m.name, role: m.role })) };
    expect(childView(old, "美咲")).toBe("美咲");
    expect(childView(old, "翔太")).toBe("翔太");
  });
});
