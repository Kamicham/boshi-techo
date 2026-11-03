"use client";

// はじめの「記録を残す同意」（個人情報保護法 20条2項・PHR 指針 3.2(2)②）。米国の Claude に送る同意は別の画面（./claude）。
import { Btn, Why } from "@/components/ui";
import { ConsentScreen } from "@/components/settings/ConsentScreen";
import { Box } from "@/components/settings/account-ui";
import { RECORD_HONEST, RECORD_PURPOSES } from "@/components/settings/consent-texts";

export default function RecordConsent() {
  return (
    <ConsentScreen
      kind="record"
      title="この手帳に、記録を残してよいですか"
      lead="健診の結果・受診の記録・手帳のページの写真は、とても大事な情報（要配慮個人情報）です。残す前に、本人の同意をいただきます。"
      after={(next, familyId) => (
        <Box title="次に、もう1つ（あとでも大丈夫）">
          <p className="text-base">話した事や撮った紙を、手帳の欄に分けるのに、米国の Claude（AI）を使います。送るかどうかは、別の画面で決めます。</p>
          <Btn href={`/account/consent/claude?familyId=${encodeURIComponent(familyId)}${next ? `&next=${encodeURIComponent(next)}` : ""}`} full>
            読んで決める
          </Btn>
          <Btn href={next ?? "/"} kind="secondary" full>
            あとで
          </Btn>
        </Box>
      )}
    >
      <Box title="何に使うか">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
          {RECORD_PURPOSES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Box>
      <Box title="正直にお伝えする事">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
          {RECORD_HONEST.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Box>
      <Why label="同意しないと？">
        <p>同意しない本人の記録は残しません。デモの家族（作った家族）は、ログインせずに見られます。</p>
        <p>同意は、アカウントの画面から同じ手軽さで撤回できます。撤回の前に残した記録は、本人の分を消すボタンで消せます。</p>
      </Why>
    </ConsentScreen>
  );
}
