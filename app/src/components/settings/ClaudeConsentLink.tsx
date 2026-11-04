"use client";

// 米国の Claude に送る同意がまだの時、その場で「読んで決める」へつなぐ（自分の手帳の入口 2026-11-04）。
// 同意は世帯を作った時に続けて聞かず、初めて話す・撮る・聞く時に、要る所で聞く。
// 出す時: サーバの失敗の文が ConsentRequiredError の時（error）か、送る前に同意がまだと分かった時（need）。
import type { ReactNode } from "react";
import { Btn } from "../ui";
import { useFamily } from "../FamilyProvider";
import { CLAUDE_CONSENT_MARK, isClaudeConsentError } from "@/lib/claude-consent-flow";

export { CLAUDE_CONSENT_MARK };

export function ClaudeConsentLink({
  error,
  need,
  lead,
  back,
  onGo,
  waitMother,
}: {
  error?: string | null;
  /** 送る前に、同意がまだと分かっている */
  need?: boolean;
  /** 案内の文を、その場に合わせて言い換える（無ければ既定の文） */
  lead?: ReactNode;
  back: string;
  /** 「読んで決める」を押した時（戻った時に続きをするための控えなど） */
  onGo?: () => void;
  /** まだ手帳に入っていないママの分が要る（母の分は母本人だけが押す。押しても進めないので、ママを招く道へ） */
  waitMother?: boolean;
}) {
  const { family } = useFamily();
  if (!need && !isClaudeConsentError(error)) return null;
  if (waitMother)
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-sky-soft px-4 py-3">
        <p className="text-base">ママが手帳に入って同意すると、話す・撮る・手帳に聞くが使えます（ママの記録の同意は、ママ本人だけが押せます）。予定表・やる事は、今のまま使えます。</p>
        <Btn href={`/invite/new?familyId=${encodeURIComponent(family.id)}`} full>
          ママを手帳に入れる
        </Btn>
      </div>
    );
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-sky-soft px-4 py-3">
      <p className="text-base">
        {lead ?? (
          <>
            手帳の欄に分けるには、<b>米国の Claude に送る同意</b>が要ります。何を送るかは、次の画面に書いてあります。
          </>
        )}
      </p>
      <span onClickCapture={onGo} className="contents">
        <Btn href={`/account/consent/claude?familyId=${encodeURIComponent(family.id)}&next=${encodeURIComponent(back)}`} full>
          読んで決める
        </Btn>
      </span>
    </div>
  );
}
