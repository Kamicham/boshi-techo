// 辞書: 健診の結果の画面（components/visit/Results.tsx の、次の健診の日の1問＝NextCheck の外の字）。書き方は lib/i18n/index.ts の頭。
// 2026-11-05 夜: UX が訳した（統括と全体監査の OK。NextCheck.tsx と dict/visit.ts は全体監査の物なので、ここに置く）。
// Claude がまとめた健診の中身・録音から聞こえた言葉（引用）は訳さずにそのまま出す（機械の聞き取りを、訳でさらに変えない）。
// 「家族に送る」は today.ts、括弧（「{text}」・（{x}））は core.ts の鍵を使う
import type { Entries } from "..";

export default {
  今日のまとめ: { zh: "今天的总结", en: "Today's summary" },
  "{date}のまとめ": { zh: "{date}的总结", en: "Summary for {date}" },
  全部読む: { zh: "阅读全文", en: "Read all" },
  録れていない所: { zh: "没录上的部分", en: "Parts that weren't recorded" },
  // 畳んだ箱は3つ（題が重ならないように）
  先生の話: { zh: "医生讲的内容", en: "What the doctor talked about" },
  聞いた事と答え: { zh: "问过的事和回答", en: "What you asked and the answers" },
  次までに: { zh: "下次之前", en: "Before next time" },
  "「{term}」って？": { zh: "“{term}”是什么？", en: "What does “{term}” mean?" },
  録音の文字: { zh: "录音的文字", en: "Recording transcript" },
  "録音の文字（{time}）": { zh: "录音的文字（{time}）", en: "Recording transcript ({time})" },
  "機械が聞き取った文です。聞き間違いが含まれることがあります。": {
    zh: "这是机器听写的文字，可能有听错的地方。",
    en: "This text was transcribed by a machine and may contain mistakes.",
  },
  "文字で渡された会話です。": { zh: "这是以文字形式给出的对话。", en: "This conversation was given as text." },
  "答えは録れていません。次に聞けます": { zh: "回答没有录上。下次可以再问", en: "The answer wasn't recorded. You can ask next time" },
  次に聞く事: { zh: "下次要问的事", en: "To ask next time" },
  "意味が残った所です。次の健診の「聞く事」に自動で入ります。": {
    zh: "这些是意思还没弄清楚的地方。会自动加到下次检查的“要问的事”里。",
    en: "These are points that are still unclear. They're added to “Questions” for your next checkup automatically.",
  },
} satisfies Entries;
