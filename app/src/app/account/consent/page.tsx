"use client";

// はじめの「記録を残す同意」（個人情報保護法 20条2項・PHR 指針 3.2(2)②）。米国の Claude に送る同意は別の画面（./claude）。
import { Btn, Fold, Why } from "@/components/ui";
import { ConsentScreen } from "@/components/settings/ConsentScreen";
import { Box } from "@/components/settings/account-ui";
import { RECORD_HONEST, RECORD_PURPOSES } from "@/components/settings/consent-texts";
import { canInvitePartner, invitePartnerHref, inviteeWord, RECORD_PROMISES } from "@/lib/consent-screen";

export default function RecordConsent() {
  return (
    <ConsentScreen
      kind="record"
      title="この手帳に、記録を残してよいですか"
      lead="健診の結果や手帳の写真は、とても大事な情報（要配慮個人情報）なので、残す前に本人の同意をいただきます。"
      after={(next, familyId, detail) => (
        <Box title="できました">
          <Btn href={next ?? "/"} full>
            手帳を開く
          </Btn>
          {/* 次の一手を2つ（UX 2026-11-04）: 招けるのは household:admin だけ（/api/account/invite）。まだパートナーがいない時だけ出す */}
          <div className="flex flex-col gap-2">
            {canInvitePartner(detail) && (
              <Btn href={invitePartnerHref(familyId)} kind="secondary" full>
                {inviteeWord(detail)}を手帳に入れる（招待のリンクを送る）
              </Btn>
            )}
            <Btn href="/capture" kind="secondary" full>
              次の健診で先生に聞きたい事を、ひと言話してみる
            </Btn>
          </div>
          {/* 米国の Claude に送る同意は、ここで続けて聞かず、初めて話す・撮る・聞く時に要る所で聞く（自分の手帳の入口 2026-11-04） */}
          <p className="text-sm text-muted">
            話した事・撮った紙を手帳の欄に分ける時は、Claude（手帳が文を読み分ける AI。米国の会社のもの）に文字を送ります。その「米国の Claude に送る同意」は、初めて話す・撮る時に伺います。
          </p>
        </Box>
      )}
    >
      {/* 守っている事を先に3行（版の外の画面の言葉。今のコードで本当にそうなっている事だけ。lib/consent-screen.ts） */}
      <Box title="守っている事">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
          {RECORD_PROMISES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Box>
      {/* 版のある要点（同意の本文）。正直に書く「まだ暗号にしていない事」も含めて、隠さずこの並びのまま見せる。使い方の全部は折り畳みの中 */}
      <Box title="要点">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
          <li>{RECORD_PURPOSES[0]}</li>
          {RECORD_HONEST.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Box>
      <Fold title="使い方の全部">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
          {RECORD_PURPOSES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Fold>
      <Why label="同意しないと？">
        <p>同意しない本人の記録は残しません。デモの家族（作った家族）は、ログインせずに見られます。</p>
        <p>同意は、アカウントの画面から同じ手軽さで撤回できます。撤回の前に残した記録は、本人の分を消すボタンで消せます。</p>
      </Why>
    </ConsentScreen>
  );
}
