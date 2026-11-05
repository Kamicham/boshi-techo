// 見本の家族（佐藤家・すべて作った家族）が話す・撮るで残した記録（lib/capture.ts の seedItems の20件）の題と本文の訳（多言語化⑤・2026-11-05）。
// 鍵は日本語の文そのもの（sample-books.ts・sample-media.ts と同じ形）。
// AREAS（lib/i18n/dicts.ts）には入れない＝画面の辞書に送らない。/api/capture の GET が頼みの言葉で、作った記録（seed）の題と本文を
// 差し替える（lib/sample-records-i18n.ts）。元の種は変えず、日本語の時は1字も変わらない。Claude に渡す記録は日本語のまま。
// 見本の一冊の辞書と画面の辞書に同じ文がある物（名前を「ひなた」に決めた・寝返りした・1歳の誕生日）は、ここに入れずにそちらから引く
// （鍵を2か所に置かない）。
// 訳は Claude Code が書いた（API は呼んでいない）。決め事は sample-books.ts の頭と同じ:
// - 名前: 中文は日本語のまま（ひなた・翔太・和子・ひなちゃん）、English はローマ字（Hinata・Shota・Kazuko・Hina-chan）。子の性は決めつけない
// - 呼び名: パパ＝爸爸／Dad（赤ちゃんの言葉は Dada）、ばあば＝外婆／Grandma。赤ちゃんの言葉「まんま」は中文も仮名のまま、English は manma。
//   「わんわん」は中文の幼児語の 汪汪、English は wanwan
// - 制度と窓口の言葉は用語集（lib/i18n/glossary.ts）にそろえ、窓口で使う言葉（母子健康手帳・出生届・保険証・受診票）は日本語を括弧で並べる。
//   区役所＝区政府／ward office、産院＝产科医院／maternity clinic（急ぎの時の画面と同じ）、慣らし保育＝适应期保育／settling-in period（予定の名前と同じ）
// - 「（デモ用の例）」は、作った予定である事の印なので訳しても残す
// 試験は lib/sample-records-i18n.test.ts（20件の題と本文のすべてに訳がある・数・名前・仮名・日本の字体）
import type { Entries } from "..";

export default {
  妊娠が分かった: { zh: "知道怀孕了", en: "Found out I'm pregnant" },
  "朝、検査薬で陽性。翔太に伝えたら、しばらく黙ってから「ほんとに？」って。": {
    zh: "早上用验孕棒测出了阳性。告诉翔太后，他沉默了一会儿，才说：“真的吗？”",
    en: "A positive pregnancy test in the morning. When I told Shota, he was quiet for a while, then said, “Really?”",
  },
  つわりで朝ごはんが入らない: { zh: "孕吐，早饭吃不下", en: "Morning sickness: I can't eat breakfast" },
  "朝はほとんど食べられず、夕方に少し楽になる。仕事中もつらい。次の健診で聞く。": {
    zh: "早上几乎吃不下，到傍晚会好受一点。上班时也很难受。下次检查时问问。",
    en: "I can hardly eat in the morning, and it gets a little easier by evening. It's hard at work, too. I'll ask at the next checkup.",
  },
  母子健康手帳を受け取った: { zh: "领到了母子健康手册（母子健康手帳）", en: "Got the Maternal and Child Health Handbook (母子健康手帳)" },
  "区役所で受け取り。妊婦健診の受診票の冊子もいっしょに（写真から要点だけ）。": {
    zh: "在区政府领取。孕妇健康检查的检查券（受診票）册子也一起拿到了（从照片里只记下要点）。",
    en: "Picked it up at the ward office, together with the booklet of prenatal checkup vouchers (受診票). Just the key points from the photo.",
  },
  鹿児島の母に報告した: { zh: "告诉了鹿儿岛的母亲", en: "Told my mom in Kagoshima" },
  "和子さんが電話口で泣いていた。「大きな字で写真を送ってね」と。": {
    zh: "和子在电话那头哭了。她说：“发照片给我哦，字要写大一点。”",
    en: "Kazuko was crying on the phone. “Send me photos, and write in big letters,” she said.",
  },
  初めての胎動: { zh: "第一次胎动", en: "First baby movements" },
  "ソファで休んでいたら、おなかの中でポコッと。泡がはじけるみたいだった。": {
    zh: "在沙发上休息的时候，肚子里“咕嘟”动了一下，像泡泡破掉一样。",
    en: "I was resting on the sofa when I felt a little pop inside my belly, like a bubble bursting.",
  },
  翔太がおなかに話しかけた声: { zh: "翔太对着肚子说话的声音", en: "Shota's voice talking to the bump" },
  "「ひなた、聞こえる？パパだよ。今日は寒かったね」。毎晩の話しかけを録り始めた。": {
    zh: "“ひなた，听得到吗？我是爸爸哦。今天好冷啊。”开始每晚把对宝宝说的话录下来。",
    en: "“Hinata, can you hear me? It's Dad. It was cold today, wasn't it?” Started recording these talks every night.",
  },
  夜に足がつる: { zh: "夜里腿抽筋", en: "Leg cramps at night" },
  "明け方にふくらはぎがつって目が覚める。週に2〜3回。次の健診で聞く。": {
    zh: "天快亮时小腿抽筋，疼得醒过来。一周2到3次。下次检查时问问。",
    en: "Calf cramps wake me up around dawn, 2 to 3 times a week. I'll ask at the next checkup.",
  },
  "二人で候補を出し合って、最後は声に出して呼びやすい名前に。": {
    zh: "两个人一起想了好几个候选，最后选了念出来顺口的名字。",
    en: "We both suggested names, and in the end chose the one that was easiest to call out loud.",
  },
  "両親学級（デモ用の例）": { zh: "双亲讲习班（演示用的例子）", en: "Parenting class (demo example)" },
  "沐浴の練習。翔太が抱っこ役。": { zh: "练习给宝宝洗澡。翔太负责抱宝宝。", en: "Practiced the baby's bath. Shota held the baby." },
  入院の持ち物リスト: { zh: "住院要带的东西清单", en: "List of things to bring for the hospital stay" },
  "産院の案内の紙から: 母子健康手帳・保険証・パジャマ・産褥ショーツなど（写真から要点だけ）。": {
    zh: "摘自产科医院的说明单：母子健康手册（母子健康手帳）、健康保险证（保険証）、睡衣、产褥内裤等（从照片里只记下要点）。",
    en: "From the maternity clinic's handout: Maternal and Child Health Handbook (母子健康手帳), health insurance card (保険証), pajamas, postpartum underwear, and so on. Just the key points from the photo.",
  },
  ひなたが生まれた: { zh: "ひなた出生了", en: "Hinata was born" },
  "予定日より2週間早く。翔太が最初に名前を呼んだら、少しだけ泣き止んだ。": {
    zh: "比预产期早了2周。翔太第一次叫名字的时候，宝宝稍微止住了哭声。",
    en: "2 weeks before the due date. When Shota first called the baby by name, the crying eased a little.",
  },
  出生届を出した: { zh: "提交了出生登记（出生届）", en: "Submitted the birth registration (出生届)" },
  "翔太が区役所へ。14日以内に間に合った。": { zh: "翔太去了区政府。赶上了14天以内的期限。", en: "Shota went to the ward office. Made it within the 14 days." },
  初めて笑った: { zh: "第一次笑了", en: "First smile" },
  "おむつを替えている時に、こちらを見てにこっと。和子さんにすぐ動画を送った。": {
    zh: "换尿布的时候，宝宝看着我笑了一下。马上把视频发给了和子。",
    en: "While I was changing a diaper, the baby looked at me and smiled. I sent a video to Kazuko right away.",
  },
  夕方になるとよく泣く: { zh: "一到傍晚就爱哭", en: "Cries a lot in the evening" },
  "毎日17時ごろから1時間くらい泣き続ける。抱っこで少し落ち着く。次の健診で聞く。": {
    zh: "每天17点左右开始，连着哭1个小时左右。抱着会稍微平静一点。下次检查时问问。",
    en: "Every day from about 17:00, the baby keeps crying for about 1 hour. Holding helps a little. I'll ask at the next checkup.",
  },
  "プレイマットの上で、右にころん。本人もびっくりした顔。": { zh: "在游戏垫上，向右一翻。宝宝自己也一脸吃惊。", en: "On the play mat, a roll to the right. The baby looked surprised, too." },
  ばあばとビデオ通話: { zh: "和外婆视频通话", en: "Video call with Grandma" },
  "和子さんの「ひなちゃん」に手をばたばた。月に一度の約束にした。": {
    zh: "听到和子叫“ひなちゃん”，宝宝挥着小手。约好每个月视频一次。",
    en: "When Kazuko said “Hina-chan,” the baby flapped both arms. We promised to call once a month.",
  },
  "保育園の見学（デモ用の例）": { zh: "参观保育园（演示用的例子）", en: "Daycare visit (demo example)" },
  "家から歩いて10分の園。慣らし保育の期間を聞く。": { zh: "离家步行10分钟的保育园。问问适应期保育要多长时间。", en: "A daycare 10 minutes' walk from home. Ask how long the settling-in period lasts." },
  "初めての「まんま」": { zh: "第一次说“まんま”", en: "First “manma”" },
  "おかゆを見て「まんま」。翔太は「パパ」が先だと思っていた。": {
    zh: "看到粥就说了“まんま”。翔太原以为会先叫“爸爸”。",
    en: "Seeing rice porridge, the baby said “manma.” Shota had thought “Dada” would come first.",
  },
  "一升餅を背負って、3歩だけ歩いた。": { zh: "背着一升年糕，只走了3步。", en: "Carrying the isshō-mochi rice cake on the back, the baby walked just 3 steps." },
  言葉がまだ少ない気がする: { zh: "感觉会说的话还很少", en: "It feels like there aren't many words yet" },
  "話す言葉は「まんま」「わんわん」くらい。1歳6か月健診で聞く。": {
    zh: "会说的只有“まんま”“汪汪”这些。在1岁6个月的健康检查时问问。",
    en: "The only words so far are “manma” and “wanwan.” I'll ask at the 1 year 6 month checkup.",
  },
} satisfies Entries;
