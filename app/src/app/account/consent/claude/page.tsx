"use client";

// 「米国の Claude に送る同意」（個人情報保護法 28条1項。規則17条2項の3つ＝国の名前・その国の制度の要約・相手の措置を出す）。
// 記録を残す同意とは別の画面にする。
import { Btn } from "@/components/ui";
import { ConsentScreen } from "@/components/settings/ConsentScreen";
import { Box } from "@/components/settings/account-ui";
import { CLAUDE_US } from "@/components/settings/consent-texts";

const List = ({ items }: { items: readonly string[] }) => (
  <ul className="flex list-disc flex-col gap-2 pl-5 text-base">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ul>
);

export default function ClaudeConsent() {
  return (
    <ConsentScreen
      kind="claude_us"
      title="記録の文字を、米国の Claude に送ってよいですか"
      lead="話した事・撮った紙を手帳の欄に分ける時、文字を米国の会社のAI（Claude）に送ります。送り先が外国なので、記録を残す同意とは別に伺います。"
      after={(next) => (
        <Btn href={next ?? "/"} full>
          手帳へ
        </Btn>
      )}
    >
      <Box title="送り先の国">
        <p className="text-base">
          <strong>{CLAUDE_US.country}</strong>
        </p>
        <p className="text-base">相手: {CLAUDE_US.company}</p>
      </Box>
      <Box title="何を送るか">
        <List items={CLAUDE_US.what} />
      </Box>
      <Box title="米国の個人情報を守る仕組み（要約）">
        <List items={CLAUDE_US.system} />
        <a href={CLAUDE_US.pdf} target="_blank" rel="noreferrer" className="text-base font-semibold text-sky underline underline-offset-2">
          {CLAUDE_US.pdfLabel}（PDF）
        </a>
      </Box>
      <Box title="Anthropic がとっている措置">
        <List items={CLAUDE_US.measures} />
        <div className="flex flex-col gap-1">
          {CLAUDE_US.measuresLinks.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="text-base text-sky underline underline-offset-2">
              {l.label}（英語）
            </a>
          ))}
        </div>
      </Box>
      <Box title="同意しないと？">
        <p className="text-base">文字にまとめる処理は動きません。手で入れる・見る・書き出すは、そのまま使えます。いつでも同意し直せます。</p>
      </Box>
    </ConsentScreen>
  );
}
