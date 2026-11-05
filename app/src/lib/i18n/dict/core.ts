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
  /** 人の名前に付ける「さん」（中文・English は名前だけ） */
  "{name}さん": { zh: "{name}", en: "{name}" },
  赤ちゃん: { zh: "宝宝", en: "the baby" },
  わが家: { zh: "我家", en: "Our family" },
  作る: { zh: "创建", en: "Create" },
  /** 通信の失敗（components/ui.tsx の plainError。どの画面でも出る） */
  通信できませんでした: { zh: "无法连接网络", en: "Couldn't connect" },

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
