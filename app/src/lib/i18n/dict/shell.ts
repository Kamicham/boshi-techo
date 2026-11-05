// 辞書: 画面の枠（components/Shell.tsx の上の帯・下のタブ・録音中の知らせ・アカウントの1行）と、体験版の言葉（lib/trial-words.ts）。
// 書き方は lib/i18n/index.ts の頭。短い共通の言葉（急ぎの時・わが家・（{x}））は core.ts
import type { Entries } from "..";

export default {
  // 上の帯
  見ている手帳: { zh: "正在看的手册", en: "Handbook you're viewing" },
  "デモ（作った家族）: {names}": { zh: "演示（虚构的家庭）：{names}", en: "Demo (fictional family): {names}" },
  "はじめの画面へ戻る（説明と時期の一覧）": { zh: "回到首页（说明和时期一览）", en: "Back to the start screen (what this is, and the list of stages)" },
  はじめの画面: { zh: "首页", en: "Start screen" },
  あなたの手帳: { zh: "你的手册", en: "Your handbook" },
  見本: { zh: "示例", en: "Sample" },
  ほかの時期: { zh: "其他时期", en: "Other stages" },
  // 下のタブ（lib/app-guide.ts の TABS）
  画面の切り替え: { zh: "切换页面", en: "Switch screens" },
  いま: { zh: "今天", en: "Today" },
  "話す・撮る・打つ": { zh: "说·拍·写", en: "Talk · Snap · Type" },
  手帳: { zh: "手册", en: "Handbook" },
  一冊: { zh: "成长书", en: "Book" },
  "録音中です。ほかの画面へ移ると録音が止まるので、終わるまでこの画面のままにしてください": {
    zh: "正在录音。切换到其他页面会停止录音，录完之前请留在这个页面",
    en: "Recording. Going to another screen stops the recording, so please stay on this screen until you finish",
  },
  // アカウントの1行
  "はじめに「記録を残す同意」をしてください": { zh: "请先完成“同意保存记录”", en: "First, please agree to keeping records" },
  同意の画面へ: { zh: "去同意页面", en: "Go to consent" },
  "自分の手帳は、3つの質問に答えると作れます": { zh: "回答3个问题，就能创建自己的手册", en: "Answer 3 questions to make your own handbook" },
  // 体験版（lib/trial-words.ts）
  "体験版です。家族はすべて作った家族で、今は AI（Claude）を呼ばず、前に Claude が書いた一冊と見本の答えで動いています": {
    zh: "这是体验版。所有家庭都是虚构的。现在不调用 AI（Claude），而是用 Claude 之前写好的成长书和示例回答来运行",
    en: "This is a trial version. Every family here is fictional. It isn't calling the AI (Claude) right now; it runs on a book Claude wrote earlier and on sample answers",
  },
  "体の判断はしません。気になる事は、産院・小児科・#8000（子どもの医療電話相談）へ。": {
    zh: "本应用不对身体状况做判断。有担心的事，请联系分娩医院、儿科，或儿童医疗咨询热线（#8000）。",
    en: "This app doesn't judge anything about your body. If something worries you, contact your maternity clinic, a pediatrician, or the Children's Medical Hotline (#8000).",
  },
  "開いた端末の住所（IP）を、写しと一緒に7日まで残します（使い過ぎを止めるため）。": {
    zh: "为防止过度使用，打开本页的设备地址（IP）会和副本一起保存，最长7天。",
    en: "To prevent overuse, we keep the address (IP) of the device that opened this, together with your copy, for up to 7 days.",
  },
} satisfies Entries;
