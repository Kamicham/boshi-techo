"use client";

// 「米国の Claude に送る同意」（個人情報保護法 28条1項。規則17条2項の3つ＝国の名前・その国の制度の要約・相手の措置を出す）。
// 記録を残す同意とは別の画面にする。
// 字は画面の言葉で出す（t()。辞書は lib/i18n/dict/account.ts。同意の文は日本語が正本）
import { Btn } from "@/components/ui";
import { ConsentScreen } from "@/components/settings/ConsentScreen";
import { Box } from "@/components/settings/account-ui";
import { CLAUDE_US } from "@/components/settings/consent-texts";
import { t } from "@/lib/i18n";

const List = ({ items }: { items: readonly string[] }) => (
  <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
    {items.map((s) => (
      <li key={s}>{t(s)}</li>
    ))}
  </ul>
);

export default function ClaudeConsent() {
  return (
    <ConsentScreen
      kind="claude_us"
      title={t("記録の文字と写真を、米国の Claude に送ってよいですか")}
      lead={t(
        "手帳が書く・答える・分ける時（話す・撮る・健診のまとめ・手帳に聞く・下書き・気づき・一冊）、記録の文字や写真を米国の会社のAI（Claude）に送ります。送り先が外国なので、記録を残す同意とは別に伺います。",
      )}
      after={(next) => (
        <Btn href={next ?? "/"} full>
          {t("手帳へ")}
        </Btn>
      )}
    >
      <Box title={t("送り先の国")}>
        <p className="text-base">
          <strong>{t(CLAUDE_US.country)}</strong>
        </p>
        <p className="text-base">{t("相手: {company}", { company: t(CLAUDE_US.company) })}</p>
      </Box>
      <Box title={t("何を送るか")}>
        <List items={CLAUDE_US.what} />
      </Box>
      <Box title={t("米国の個人情報を守る仕組み（要約）")}>
        <List items={CLAUDE_US.system} />
        <a href={CLAUDE_US.pdf} target="_blank" rel="noreferrer" className="text-base font-semibold text-sky underline underline-offset-2">
          {t("{label}（PDF）", { label: t(CLAUDE_US.pdfLabel) })}
        </a>
      </Box>
      <Box title={t("Anthropic がとっている措置")}>
        <List items={CLAUDE_US.measures} />
        <div className="flex flex-col gap-1">
          {CLAUDE_US.measuresLinks.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="text-base text-sky underline underline-offset-2">
              {t("{label}（英語）", { label: l.label })}
            </a>
          ))}
        </div>
      </Box>
      <Box title={t("同意しないと？")}>
        <p className="text-base">{t("止まる物: 話す・撮るの振り分け、健診のまとめ、下書き、気づき、一冊。手帳に聞くは、予定表と使い方で答えられる問いだけに答えます。")}</p>
        <p className="text-base">
          {t("そのまま使える物: 予定表と期限、急ぎの時、手で入れる・見る・書き出す、町の窓口の調べ（Claude に送るのは町と手続きの名前だけで、家族の記録は送りません）。")}
        </p>
        <p className="text-base">{t("記録の本人（ママ・子など）のうち1人でも同意していない・撤回すると、この手帳の Claude の仕事は全部止まります。いつでも同意し直せます。")}</p>
      </Box>
    </ConsentScreen>
  );
}
