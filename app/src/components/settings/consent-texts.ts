// 同意の画面の文と版（画面とサーバの両方が読む）。
// 文を変えた時は版を上げる（前の版の同意は履歴に残り、画面は新しい版でもう一度聞く）。
// 法律の助言ではなく、設計の要件（個人情報保護法 20条2項・28条1項・規則17条2項、PHR 指針 3.2(2)）に沿って書いた画面の文。

export const CONSENT_VERSION = {
  record: "2026-11-03",
  claude_us: "2026-11-03",
} as const;

export type ScreenConsentKind = keyof typeof CONSENT_VERSION;

export const CONSENT_NAME: Record<"record" | "claude_us" | "share", string> = {
  record: "記録を残す",
  claude_us: "米国の Claude に送る",
  share: "家族に見せる",
};

/** はじめの「記録を残す同意」で見せる、使い方の要点（利用目的） */
export const RECORD_PURPOSES = [
  "妊娠から子が3歳になるまでの健診・手続き・成長の記録を、この世帯の中に残します",
  "記録から、次にやる手続きや健診の予定を出します",
  "写真・録音のファイルは、世帯ごとの鍵で暗号にしてから置きます",
  "世帯に招いた家族には、見せると決めた範囲だけを見せます",
  "体の判断はしません。気になる事は、産院・小児科・#8000 につなぎます",
] as const;

/** 記録の同意で正直に書く、今できていない事 */
export const RECORD_HONEST = [
  "暗号にしているのは写真・録音のファイルだけです。記録の文字（健診の結果など）は、まだ暗号にしていません",
  "いつでも、アカウントの画面から書き出し・撤回・消すができます",
] as const;

/** 米国の Claude に送る同意（規則17条2項の3つ: 国の名前・制度の要約・相手の措置） */
export const CLAUDE_US = {
  country: "アメリカ合衆国（米国）",
  company: "Anthropic, PBC（Claude を作っている会社）",
  what: [
    "話した事・撮った紙から起こした文字を、手帳の欄に分けるため",
    "健診の録音の書き起こしを、まとめて手帳に入れる候補を作るため",
    "送るのは文字だけです。写真は、本人が「この1枚を見せる」と選んだ時だけ、その1枚を送ります",
    "氏名・住所は送りません。家族は「母」「子」などの役の名前に置き換えます",
  ],
  system: [
    "米国には、日本の個人情報保護法のような、全体をまとめた連邦の法律はありません",
    "医療（HIPAA）・子ども（COPPA）など分野ごとの連邦の法律と、カリフォルニア州（CCPA）など州ごとの法律で守られています",
    "連邦取引委員会（FTC）が、約束と違う・不公正な取り扱いを取り締まります",
  ],
  pdf: "https://www.ppc.go.jp/files/pdf/USA_report.pdf",
  pdfLabel: "個人情報保護委員会「外国における個人情報の保護に関する制度等の調査（米国）」",
  measures: [
    "API で送った内容を、Claude の学習には使いません（Anthropic の Commercial Terms）",
    "API の入力と出力は、30日以内に Anthropic の側で消えます（Anthropic Privacy Center）",
    "通信は暗号にして送ります",
  ],
  measuresLinks: [
    { label: "Anthropic Commercial Terms", href: "https://www.anthropic.com/legal/commercial-terms" },
    { label: "Anthropic Privacy Center", href: "https://privacy.claude.com/en/articles/7996866" },
  ],
} as const;

/** 子の分は、親が法定代理人として同意する（通則ガイドライン 2-16・Q&A 1-62） */
export const CHILD_NOTE = "子の分は、親が法定代理人として同意します。子が大きくなったら、子が自分で決め直せるよう、本人ごとに分けて残します。";

/** 招待で母が選ぶ「見せる項目」（既定は子の記録だけ＝何も選ばない） */
export const SHARE_ITEMS = [
  { id: "techo", label: "母の手帳の記録（妊娠中の経過など）" },
  { id: "visit", label: "母の健診の記録" },
  { id: "photo", label: "母の写真" },
] as const;

export type ShareItem = (typeof SHARE_ITEMS)[number]["id"];

// 「ママ」は、パートナーが始めた手帳に母を招く時だけ出す（UX 2026-11-04）
export const RELATIONS = ["ママ", "パートナー", "祖父母", "そのほかの家族"] as const;
export type Relation = (typeof RELATIONS)[number];
