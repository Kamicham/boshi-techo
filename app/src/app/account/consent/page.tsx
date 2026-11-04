"use client";

// はじめの「記録を残す同意」（個人情報保護法 20条2項・PHR 指針 3.2(2)②）。米国の Claude に送る同意は別の画面（./claude）。
import { Btn, Fold, Why } from "@/components/ui";
import { ConsentScreen } from "@/components/settings/ConsentScreen";
import { Box } from "@/components/settings/account-ui";
import { RECORD_HONEST, RECORD_PURPOSES } from "@/components/settings/consent-texts";

export default function RecordConsent() {
  return (
    <ConsentScreen
      kind="record"
      title="この手帳に、記録を残してよいですか"
      lead="健診の結果や手帳の写真は、とても大事な情報（要配慮個人情報）なので、残す前に本人の同意をいただきます。"
      after={(next) => (
        <Box title="できました">
          <Btn href={next ?? "/"} full>
            手帳を開く
          </Btn>
          {/* 米国の Claude に送る同意は、ここで続けて聞かず、初めて話す・撮る・聞く時に要る所で聞く（自分の手帳の入口 2026-11-04） */}
          <p className="text-sm text-muted">話した事・撮った紙を手帳の欄に分ける時に使う「米国の Claude に送る同意」は、初めて話す・撮る時に伺います。</p>
        </Box>
      )}
    >
      {/* 要点を先に（ここだけ読めば決められる）。使い方の全部は折り畳みの中（同じ画面・同じ文） */}
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
