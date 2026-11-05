// 辞書: 思い出の言葉のうち lib の側の物（lib/media-shared.ts の時期・節目・声の録り方と題、lib/letters-shared.ts の手紙の開く日、
// lib/film-plan.ts の映画の言葉、lib/book-intro.ts の一冊の最初の箱）。画面の字は album.ts・book.ts。
// 書き方は lib/i18n/index.ts の頭。共通の短い言葉（閉じる・赤ちゃん・（{x}））は core、「1歳の誕生日」は stages の物を使う。
// - 時期と節目の名前は保存する値（日本語）のまま持ち、出す時だけ訳す。サーバ（一冊を書く Claude への頼み・動画の組み立て）はいつも日本語。
// - お七夜・お宮参り・お食い初めは日本の行事なので、名前を写さずに、何をする日かが分かる言い方にする（一般の訳）。
// - 中文は简体字・呼びかけは「你」。訳に「・」を残さない（区切りは lib/memory-words.ts の dot()）。
import type { Entries } from "..";

export default {
  // ── 時期（一冊の4つの章・アルバムの見出し。lib/media-shared.ts の PERIODS）──
  おなかにいた日々: { zh: "在肚子里的日子", en: "Days in the womb" },
  生まれた日: { zh: "出生当天", en: "Day of birth" },
  はじめての一年: { zh: "第一年", en: "The first year" },
  二歳までの一年: { zh: "到两岁的一年", en: "The year until age two" },

  // ── アルバムの月の見出し（monthGroupOf）──
  生まれて1週間: { zh: "出生后第一周", en: "First week after birth" },
  生まれて1か月まで: { zh: "出生后到满月", en: "Until 1 month old" },
  "{head}（{date}〜）": { zh: "{head}（{date}起）", en: "{head} (from {date})" },
  "{label}のころ": { zh: "{label}前后", en: "around {label}" },

  // ── 写真の節目（PHOTO_MILESTONES。「1歳の誕生日」は stages）──
  お七夜: { zh: "七夜礼", en: "Seventh-night celebration" },
  今日はお七夜です: { zh: "今天是七夜礼", en: "Today is the seventh-night celebration" },
  お七夜のころです: { zh: "七夜礼前后", en: "It's around the seventh-night celebration" },
  生まれた日から数えて7日目: { zh: "从出生当天算起的第7天", en: "The 7th day, counting the day of birth as day 1" },
  お宮参り: { zh: "初次参拜神社", en: "First shrine visit" },
  お宮参りのころです: { zh: "差不多是初次参拜神社的时候了", en: "It's about time for the first shrine visit" },
  "生後1か月ごろ。日取りは家族や地域で決めます": { zh: "出生后1个月左右。日子由家人或当地习俗来定", en: "Around 1 month old. Families and regions choose the day" },
  お食い初め: { zh: "百日初食礼", en: "First-meal ceremony" },
  今日はお食い初めの日です: { zh: "今天是百日初食礼", en: "Today is the first-meal ceremony" },
  お食い初めのころです: { zh: "差不多是百日初食礼的时候了", en: "It's about time for the first-meal ceremony" },
  生まれた日から数えて100日目: { zh: "从出生当天算起的第100天", en: "The 100th day, counting the day of birth as day 1" },
  ハーフバースデー: { zh: "半岁生日", en: "Half birthday" },
  今日でハーフバースデーです: { zh: "今天满半岁了", en: "Today is the half birthday" },
  ハーフバースデーのころです: { zh: "差不多满半岁了", en: "It's around the half birthday" },
  生後6か月: { zh: "出生后6个月", en: "6 months old" },
  今日は1歳の誕生日です: { zh: "今天是1岁生日", en: "Today is the first birthday" },
  "1歳の誕生日のころです": { zh: "差不多是1岁生日了", en: "It's around the first birthday" },
  "1歳6か月": { zh: "1岁6个月", en: "1 year 6 months" },
  今日で1歳6か月です: { zh: "今天满1岁6个月了", en: "Today marks 1 year 6 months" },
  "1歳6か月のころです": { zh: "差不多1岁6个月了", en: "It's around 1 year 6 months" },
  "2歳の誕生日": { zh: "2岁生日", en: "Second birthday" },
  今日は2歳の誕生日です: { zh: "今天是2岁生日", en: "Today is the second birthday" },
  "2歳の誕生日のころです": { zh: "差不多是2岁生日了", en: "It's around the second birthday" },

  // ── 声の録り方（VOICE_MOMENTS）と、声の題（voiceTitle。保存する題はサーバが日本語で作る。画面では、作ったままの題だけ訳す）──
  おなかに話しかける: { zh: "对肚子说话", en: "Talk to the bump" },
  生まれる前のあなたへ: { zh: "给出生前的你", en: "To you, before you're born" },
  寝る前のひとこと: { zh: "睡前的一句话", en: "A word at bedtime" },
  今日のおやすみ: { zh: "今天的晚安", en: "Today's good night" },
  名前を呼ぶ: { zh: "呼唤名字", en: "Call their name" },
  "はじめて・何度でも": { zh: "第一次，以及每一次", en: "The first time, and every time" },
  "{who}から おなかへ": { zh: "{who}对肚子说的话", en: "{who}, to the bump" },
  おなかへ: { zh: "对肚子说的话", en: "To the bump" },
  "{who}から おやすみ": { zh: "{who}的晚安", en: "Good night from {who}" },
  おやすみ: { zh: "晚安", en: "Good night" },
  "{who}から 名前を呼んだ声": { zh: "{who}呼唤名字的声音", en: "{who} calling your name" },
  名前を呼んだ声: { zh: "呼唤名字的声音", en: "Calling your name" },
  "{who}から {to}へ": { zh: "{who}对{to}说的话", en: "From {who} to {to}" },
  "{who}から の声": { zh: "{who}的声音", en: "{who}'s voice" },
  の声: { zh: "声音", en: "Voice" },
  /** 宛名（一冊の表紙「ひなたへ」・声の題・映画の題） */
  "{name}へ": { zh: "给{name}", en: "To {name}" },
  /** みんなの章の声（minnaVoiceLabel）・手紙に添えた声 */
  "{name}の声": { zh: "{name}的声音", en: "{name}'s voice" },
  "（{n}秒）": { zh: "（{n}秒）", en: " ({n}s)" },

  // ── 手紙の開く日（lib/letters-shared.ts の LETTER_OPENS・opensLine・openedNewsLine）──
  小学校に入る春: { zh: "上小学的那个春天", en: "Spring of starting elementary school" },
  "10歳の誕生日": { zh: "10岁生日", en: "10th birthday" },
  "20歳の誕生日": { zh: "20岁生日", en: "20th birthday" },
  日を選ぶ: { zh: "选择日期", en: "Pick a date" },
  封をしない: { zh: "不封存", en: "Don't seal" },
  "1歳の誕生日に": { zh: "在1岁生日", en: "on the first birthday" },
  小学校に入る春に: { zh: "在上小学的那个春天", en: "in the spring of starting elementary school" },
  "10歳の誕生日に": { zh: "在10岁生日", en: "on the 10th birthday" },
  "20歳の誕生日に": { zh: "在20岁生日", en: "on the 20th birthday" },
  "{when}（{day}）開きます": { zh: "{when}（{day}）开启", en: "Opens {when} ({day})" },
  "{day}に開きます": { zh: "{day}开启", en: "Opens on {day}" },
  いつでも読めます: { zh: "随时都能读", en: "Can be read anytime" },
  おなかにいた頃の手紙が開きました: { zh: "怀孕时写的信打开了", en: "A letter from the pregnancy has opened" },
  "{n}年前の手紙が開きました": { zh: "{n}年前的信打开了", en: "A letter from {n} {n:year|years} ago has opened" },
  封をした手紙が開きました: { zh: "封存的信打开了", en: "A sealed letter has opened" },

  // ── 映画（lib/film-plan.ts）──
  "{name}から": { zh: "来自{name}", en: "From {name}" },
  "{a}に書いて、{b}に開いた手紙": { zh: "{a}写下、{b}打开的信", en: "A letter written on {a}, opened on {b}" },
  "{a}に書いた手紙": { zh: "{a}写的信", en: "A letter written on {a}" },

  // ── 一冊の最初の箱（lib/book-intro.ts）──
  "{child}への一冊": { zh: "给{child}的成长书", en: "A book for {child}" },
  記録を本にまとめる: { zh: "把记录整理成书", en: "Turn your records into a book" },
  "この体験版では Claude を呼ばないので、ここでは本を作りません。見本の家族の妊娠30週・生後2か月・1歳・2歳の日で、前に Claude がこの家族の記録から書いた一冊を読めます": {
    zh: "这个体验版不调用 Claude，所以这里不会制作书。在示例家庭怀孕30周、出生后2个月、1岁、2岁的那几天，可以读到 Claude 之前根据这个家庭的记录写好的成长书",
    en: "This trial doesn't call Claude, so no book is made here. On the sample family's days at 30 weeks pregnant, 2 months old, 1 year old and 2 years old, you can read the books Claude wrote earlier from this family's records",
  },
  "2歳の日の一冊を読む ›": { zh: "读2岁那天的成长书 ›", en: "Read the book from age 2 ›" },
  "{child}に渡す、一冊の本": { zh: "送给{child}的一本书", en: "A book to give to {child}" },
  "話した事・撮った写真・家族の声がたまると、ここで本の形にまとめられます。いまは{n}件": {
    zh: "说过的话、拍过的照片、家人的声音积累起来后，就可以在这里整理成书。现在有{n}条",
    en: "Once the things you've said, the photos you've taken and your family's voices add up, you can turn them into a book here. So far: {n}",
  },
  最初の1つを残す: { zh: "留下第一条", en: "Keep your first one" },
  "話す・撮るで足す": { zh: "用“说·拍”来添加", en: "Add with Talk · Snap" },
  "見本の家族の記録を入れると、本の形にまとめられます": { zh: "加入示例家庭的记录后，就可以整理成书", en: "Add the sample family's records to turn them into a book" },
  見本の記録を入れる: { zh: "加入示例记录", en: "Add sample records" },
  "{n}件の記録を、AI（Claude）が時期ごとの章に分けて、本の形にまとめます（数分かかります）。画面で読めて、何度でも作り直せます": {
    zh: "AI（Claude）会把{n}条记录按时期分成章节，整理成书（需要几分钟）。可以在屏幕上读，也可以随时重新制作",
    en: "The AI (Claude) sorts your {n} {n:record|records} into chapters by stage and turns them into a book (it takes a few minutes). You can read it on screen and remake it as often as you like",
  },
  本にまとめてみる: { zh: "整理成书试试", en: "Make it into a book" },
  "見本の家族の一冊を読む ›": { zh: "读示例家庭的成长书 ›", en: "Read the sample family's book ›" },
  /** サーバが返す文（lib/book.ts の makeBook。lib/api.ts の route() が頼みの言葉で訳す） */
  "この日までの見本の一冊は、まだありません。見本の家族の妊娠30週・生後2か月・1歳・2歳の日で、前に Claude が書いた一冊を読めます": {
    zh: "截至这一天的示例成长书还没有。在示例家庭怀孕30周、出生后2个月、1岁、2岁的那几天，可以读到 Claude 之前写好的成长书",
    en: "There's no sample book up to this day yet. You can read the books Claude wrote earlier on the sample family's days at 30 weeks pregnant, 2 months old, 1 year old and 2 years old",
  },
} satisfies Entries;
