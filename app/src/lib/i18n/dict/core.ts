// 辞書: どの画面にも出る API の言葉（lib/api.ts の route()・body()・formAfterGate()）。
// 書き方は lib/i18n/index.ts の頭。言葉の選び方は lib/i18n/glossary.ts（母子保健の言葉は外国語版の母子健康手帳が正）
import type { Entries } from "..";

export default {
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
