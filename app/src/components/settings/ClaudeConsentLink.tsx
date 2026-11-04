"use client";

// 米国の Claude に送る同意がまだの時、その場で「読んで決める」へつなぐ（自分の手帳の入口 2026-11-04）。
// 同意は世帯を作った時に続けて聞かず、初めて話す・撮る・聞く時に、要る所で聞く。
import { Btn } from "../ui";
import { useFamily } from "../FamilyProvider";

/** サーバの ConsentRequiredError の文（lib/claude.ts）に入っている言葉 */
export const CLAUDE_CONSENT_MARK = "米国の Claude に送る同意";

export function ClaudeConsentLink({ error, back }: { error: string | null | undefined; back: string }) {
  const { family } = useFamily();
  if (!error || !error.includes(CLAUDE_CONSENT_MARK)) return null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-sky-soft px-4 py-3">
      <p className="text-base">
        手帳の欄に分けるには、<b>米国の Claude に送る同意</b>が要ります。送るのは文字だけで、名前・住所は送りません。
      </p>
      <Btn href={`/account/consent/claude?familyId=${encodeURIComponent(family.id)}&next=${encodeURIComponent(back)}`} full>
        読んで決める
      </Btn>
    </div>
  );
}
