// 短い1行を、文節に近いまとまりの間でだけ折る（lib/phrase.ts・デモの会話が見つけた⑧・2026-11-06）。
// まとまりは折らない箱（white-space: nowrap）に入れ、間に折ってよい印（<wbr>）を置く。iPhone の Safari でも効く。
// 長すぎるまとまり（PHRASE_MAX 字より長い）は箱に入れない（中でも折れる＝はみ出さない）。
// 日本語の画面で、ひらがなを含む文だけを分ける（中文・English と、ひらがなの無い文は、そのまま）。
// 画面の字（textContent）は、全角の空白が半角になる所のほかは変わらない（<wbr> は字を持たない）ので、字で探す試験やなりきりの道具はそのまま動く。
// 付ける親には className="phrase"（app/globals.css。日本語の時は、まとまりの外でも字と字の間で折らない）
import { Fragment } from "react";
import { currentLang } from "@/lib/i18n";
import { PHRASE_MAX, phraseChunks } from "@/lib/phrase";

const SPACE = /^\s+$/;

export function Phrase({ text }: { text: string }) {
  if (currentLang() !== "ja" || !/\p{Script=Hiragana}/u.test(text)) return <>{text}</>;
  const parts = phraseChunks(text);
  return (
    <>
      {parts.map((p, i) => {
        // 空白は半角の空白で描き、後ろに折ってよい印を置く。全角の空白「　」は、Safari が keep-all の時その後で折らず
        // （「ひなたへ　1歳までの／日々」）、行の終わりに残ると、真ん中に寄せた題が左に寄る（一冊の表紙の TitleLines と同じく半角で描く）
        if (SPACE.test(p))
          return (
            <Fragment key={i}>
              {p.replace(/\u3000/g, " ")}
              <wbr />
            </Fragment>
          );
        const next = parts[i + 1];
        return (
          <Fragment key={i}>
            {[...p].length <= PHRASE_MAX ? <span className="whitespace-nowrap">{p}</span> : p}
            {next !== undefined && !SPACE.test(next) && <wbr />}
          </Fragment>
        );
      })}
    </>
  );
}
