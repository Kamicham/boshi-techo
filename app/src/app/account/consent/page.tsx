"use client";

// はじめの「記録を残す同意」（個人情報保護法 20条2項・PHR 指針 3.2(2)②）。米国の Claude に送る同意は別の画面（./claude）。
// 字は画面の言葉で出す（t()。辞書は lib/i18n/dict/account.ts。同意の文は日本語が正本）
import { Btn, Fold, Why } from "@/components/ui";
import { ConsentScreen } from "@/components/settings/ConsentScreen";
import { Box } from "@/components/settings/account-ui";
import { RECORD_HONEST, RECORD_PURPOSES } from "@/components/settings/consent-texts";
import { canInvitePartner, invitePartnerHref, inviteeWord, RECORD_PROMISES } from "@/lib/consent-screen";
import { t } from "@/lib/i18n";

export default function RecordConsent() {
  return (
    <ConsentScreen
      kind="record"
      title={t("この手帳に、記録を残してよいですか")}
      lead={t("健診の結果や手帳の写真は、とても大事な情報（要配慮個人情報）なので、残す前に本人の同意をいただきます。")}
      after={(next, familyId, detail) => (
        <Box title={t("できました")}>
          <Btn href={next ?? "/"} full>
            {t("手帳を開く")}
          </Btn>
          {/* 次の一手を2つ（UX 2026-11-04）: 招けるのは household:admin だけ（/api/account/invite）。まだパートナーがいない時だけ出す */}
          <div className="flex flex-col gap-2">
            {canInvitePartner(detail) && (
              <Btn href={invitePartnerHref(familyId)} kind="secondary" full>
                {inviteeWord(detail) === "ママ" ? t("ママを手帳に入れる（招待のリンクを送る）") : t("パートナーを手帳に入れる（招待のリンクを送る）")}
              </Btn>
            )}
            <Btn href="/capture" kind="secondary" full>
              {t("次の健診で先生に聞きたい事を、ひと言話してみる")}
            </Btn>
          </div>
          {/* 米国の Claude に送る同意は、ここで続けて聞かず、初めて話す・撮る・聞く時に要る所で聞く（自分の手帳の入口 2026-11-04） */}
          <p className="text-sm text-muted">
            {t(
              "手帳が書く・答える・分ける時（話す・撮る・手帳に聞く・下書きなど）は、Claude（手帳が文を読み分ける AI。米国の会社のもの）に記録の文字や写真を送ります。その「米国の Claude に送る同意」は、初めて使う時に、その場で伺います。",
            )}
          </p>
        </Box>
      )}
    >
      {/* 守っている事を先に3行（版の外の画面の言葉。今のコードで本当にそうなっている事だけ。lib/consent-screen.ts） */}
      <Box title={t("守っている事")}>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
          {RECORD_PROMISES.map((s) => (
            <li key={s}>{t(s)}</li>
          ))}
        </ul>
      </Box>
      {/* 版のある要点（同意の本文）。正直に書く「まだ暗号にしていない事」も含めて、隠さずこの並びのまま見せる。使い方の全部は折り畳みの中 */}
      <Box title={t("要点")}>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
          <li>{t(RECORD_PURPOSES[0])}</li>
          {RECORD_HONEST.map((s) => (
            <li key={s}>{t(s)}</li>
          ))}
        </ul>
      </Box>
      <Fold title={t("使い方の全部")}>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
          {RECORD_PURPOSES.map((s) => (
            <li key={s}>{t(s)}</li>
          ))}
        </ul>
      </Fold>
      {/* 今のコードで本当にそうなっている事だけ（2026-11-05 に確かめ直した）: 同意がまだの間は手帳の上に案内が出るが、サーバは記録を止めない。
          本人の分を消す（purgeSubject）は本人の付いた行（写真・声・同意）だけで、文字の記録には本人が付かないので残る（lib/consent-screen.ts の注） */}
      <Why label={t("同意しないと？")}>
        <p>{t("同意がまだの間は、手帳の上に同意の案内が出ます。同意のない本人の記録を、サーバの側で止める仕組みは準備中です。デモの家族（作った家族）は、ログインせずに見られます。")}</p>
        <p>{t("同意は、アカウントの画面から同じ手軽さで撤回できます。撤回の前に残した写真と声は、本人の分を消すボタンで消せます（文字の記録を本人の分だけ消す仕組みは準備中です）。")}</p>
      </Why>
    </ConsentScreen>
  );
}
