// 辞書: どの画面にも出る言葉（いくつもの画面で使う短い言葉と、lib/api.ts の route()・body()・formAfterGate() の API の言葉）。
// 書き方は lib/i18n/index.ts の頭。言葉の選び方は lib/i18n/glossary.ts（母子保健の言葉は外国語版の母子健康手帳が正）。
// 中文の呼びかけは「你」（アプリの近い言い方。役所の文の「您」にしない）。English は短く、やさしい言い方で。
import type { Entries } from "..";

export default {
  // ── いくつもの画面で使う短い言葉（同じ鍵を2つの場所に置かない＝試験が見る）──
  急ぎの時: { zh: "紧急情况", en: "Emergency" },
  閉じる: { zh: "关闭", en: "Close" },
  /** 名前・時期を括弧で添える（English は半角の括弧と空き） */
  "（{x}）": { zh: "（{x}）", en: " ({x})" },
  /** 引用を括弧で包む（中文・English は “ ”。2026-11-05 today.ts から移した＝急ぎの時の画面の辞書にも入るよう） */
  "「{text}」": { zh: "“{text}”", en: "“{text}”" },
  /** 人の名前に付ける「さん」（中文・English は名前だけ） */
  "{name}さん": { zh: "{name}", en: "{name}" },
  赤ちゃん: { zh: "宝宝", en: "the baby" },
  わが家: { zh: "我家", en: "Our family" },
  作る: { zh: "创建", en: "Create" },
  /** 通信の失敗（components/ui.tsx の plainError。どの画面でも出る） */
  通信できませんでした: { zh: "无法连接网络", en: "Couldn't connect" },
  /** components/FamilyProvider.tsx の api() の失敗（どの画面でも出る） */
  "通信できませんでした。電波を確かめて、もう一度押してください": {
    zh: "无法连接网络。请检查信号后再点一次",
    en: "Couldn't connect. Please check your signal and tap again",
  },
  "うまくいきませんでした（{status}）": { zh: "没有成功（{status}）", en: "Something went wrong ({status})" },
  // 米国の Claude に送る同意（components/settings/ClaudeConsentLink.tsx・下書き・話す撮る）。
  // サーバの断りの全文（lib/claude-consent-flow.ts の CONSENT_REQUIRED_TEXT）は辞書に入れない: route() が訳すと、
  // 画面の見分け（isClaudeConsentError は日本語の「米国の Claude に送る同意」を探す）が外れる。全文は画面に出さず、見分けて下の札を出す
  "米国の Claude に送る同意": { zh: "同意发送给美国的 Claude", en: "consent to send data to Claude in the US" },
  "手帳の欄に分けるには、{consent}が要ります。何を送るかは、次の画面に書いてあります。": {
    zh: "要分到手册的各栏里，需要{consent}。要发送什么，写在下一个页面上。",
    en: "To sort this into the handbook's sections, the handbook needs your {consent}. The next screen explains what is sent.",
  },
  "ママが手帳に入って同意すると、話す・撮る・手帳に聞くが使えます（ママの記録の同意は、ママ本人だけが押せます）。予定表・やる事は、今のまま使えます。": {
    zh: "妈妈加入手册并同意后，就能使用“说·拍·写”和“问手册”（妈妈记录的同意，只有妈妈本人能点）。日程表和要做的事，现在照样能用。",
    en: "Once Mom joins the handbook and agrees, Talk · Snap · Type and Ask the handbook become available (only Mom can agree for her own records). The schedule and to-dos work as they do now.",
  },
  ママを手帳に入れる: { zh: "邀请妈妈加入手册", en: "Add Mom to the handbook" },
  読んで決める: { zh: "阅读后决定", en: "Read and decide" },

  // ── API の言葉 ──
  "Claude が混み合っています。少し待ってもう一度": {
    zh: "Claude 目前繁忙，请稍后再试",
    en: "Claude is busy right now. Please wait a moment and try again",
  },
  "いま Claude につながりません。手帳の予定と記録はそのまま使えます": {
    zh: "现在无法连接 Claude。手册里的日程和记录可以照常使用",
    en: "Can't reach Claude right now. Your schedule and records in the handbook still work as usual",
  },
  "Claude の呼び出しに失敗しました（{status}）": {
    zh: "调用 Claude 失败（{status}）",
    en: "Couldn't reach Claude ({status})",
  },
  うまくいきませんでした: {
    zh: "没有成功",
    en: "Something went wrong",
  },
  送られた内容が読めません: {
    zh: "无法读取发送的内容",
    en: "Couldn't read what was sent",
  },
  家族の指定が食い違っています: {
    zh: "指定的家庭不一致",
    en: "The family specified doesn't match",
  },
} satisfies Entries;
