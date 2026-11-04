// 声を残すの録り方の並び: 「おなかに話しかける」は妊娠中だけ。生まれた後は今の声が先頭
import { describe, expect, it } from "vitest";
import { voiceMomentsFor } from "./media-shared";

const ids = (b: string | undefined, today: string) => voiceMomentsFor(b, today).map((m) => m.id);

describe("voiceMomentsFor", () => {
  it("生まれた日が無い（妊娠中）は、おなかへを先頭に3つ", () => {
    expect(ids(undefined, "2026-11-04")).toEqual(["belly", "bedtime", "name"]);
  });
  it("生まれた日が今日より先（予定の日を入れた形）も妊娠中として扱う", () => {
    expect(ids("2026-12-01", "2026-11-04")).toEqual(["belly", "bedtime", "name"]);
  });
  it("生まれた日の当日から後は、おなかへを出さず、寝る前のひとことが先頭", () => {
    expect(ids("2026-11-04", "2026-11-04")).toEqual(["bedtime", "name"]);
    expect(ids("2025-05-01", "2026-11-04")).toEqual(["bedtime", "name"]);
  });
});
