// 辞書: からだの記録（家族の声②・プランの B）。手帳の妊婦健診のページの表と体重の線（components/techo/PregnancyBody.tsx）、
// 発育曲線（components/techo/GrowthLines.tsx・GrowthChart.tsx の足した所）、家で測った物を入れる口、手帳のタブの一番上の1枚。
// 書き方は lib/i18n/index.ts の頭。手帳の欄の名前（体重・週数・身長・頭囲・子宮底長・むくみ・尿糖・体温・測った日）は
// capture.ts の物を使う（同じ鍵を2つの場所に置かない。打つ画面と表で同じ訳になる）。
// - 表の列で capture に無い物（診察月日・腹囲・血圧・尿蛋白）は capture の訳の形にそろえる。診察月日だけは紙の列の名前
//   （こども家庭庁「外国語版の母子健康手帳」R5 の「妊娠中の経過」: Exam Date・检查月日）
// - 評価の言葉（順調・増えすぎ・多い・少ない・注意）は、どの言葉でも使わない
// - 中文は简体字・呼びかけは「你」。訳に「・」を残さない
import type { Entries } from "..";

export default {
  // ── 妊婦健診の表（紙と同じ列の順）──
  診察月日: { zh: "检查月日", en: "Exam date" },
  腹囲: { zh: "腹围", en: "Abdominal circumference" },
  血圧: { zh: "血压", en: "Blood pressure" },
  尿蛋白: { zh: "尿蛋白", en: "Urine protein" },
  "紙の手帳と同じ並び（妊娠中の経過）": { zh: "与纸质手册相同的顺序（妊娠经过）", en: "Same order as the paper handbook (Course of Pregnancy)" },
  "1件ずつ見る・消す": { zh: "逐条查看或删除", en: "See or delete one at a time" },

  // ── 体重の線 ──
  "体重の線。横は妊娠週、点は入れた体重（{n}件）": {
    zh: "体重折线图。横轴是妊娠周数，点是录入的体重（{n}条）",
    en: "Weight line. Across: week of pregnancy. Dots: the weights entered ({n})",
  },
  妊娠週: { zh: "妊娠周", en: "Week of pregnancy" },
  "出産の頃の目安 +{lo}〜{hi}kg": { zh: "到分娩时的参考 +{lo}～{hi}kg", en: "Guide by birth: +{lo}–{hi} kg" },
  "● 健診の日の体重": { zh: "● 健康检查当天的体重", en: "● Weight at checkups" },
  "・ 家で測った体重": { zh: "· 在家测量的体重", en: "· Weight measured at home" },
  "○ 妊娠前の体重": { zh: "○ 妊娠前的体重", en: "○ Weight before pregnancy" },
  "］ 出産の頃の目安": { zh: "] 到分娩时的参考范围", en: "] Guide range by birth" },
  "出産の頃の目安: 個別対応（上限5kgまでが目安）": { zh: "到分娩时的参考：个别应对（以最多增加5kg为参考）", en: "Guide by birth: decided individually (up to about 5 kg)" },
  "線は入れた数字をつないだだけです。気になる事は健診で聞いてください。": {
    zh: "这条线只是把录入的数字连起来而已。有在意的地方，请在健康检查时询问。",
    en: "The line just connects the numbers entered. If anything concerns you, ask at your checkup.",
  },

  // ── 発育曲線（GrowthLines・GrowthChart）──
  "{label}の発育曲線（帯なし）。点は記録（{n}件）": { zh: "{label}的生长曲线（无参考带）。点是记录（{n}条）", en: "{label} growth curve (no band). Dots: records ({n})" },
  "{label}の発育曲線。帯は国の調査の3から97パーセンタイル、線は50パーセンタイル。点は記録（{n}件）": {
    zh: "{label}的生长曲线。带是国家调查的第3至第97百分位，线是第50百分位。点是记录（{n}条）",
    en: "{label} growth curve. Band: 3rd to 97th percentile from the national survey. Line: 50th percentile. Dots: records ({n})",
  },
  "{label}の発育曲線。帯は国の調査の3から97パーセンタイル。点は記録（{n}件）": {
    zh: "{label}的生长曲线。带是国家调查的第3至第97百分位。点是记录（{n}条）",
    en: "{label} growth curve. Band: 3rd to 97th percentile from the national survey. Dots: records ({n})",
  },
  "修正月齢（か月）": { zh: "矫正月龄（月）", en: "Corrected age (months)" },
  "生後（か月）": { zh: "出生后（月）", en: "Age (months)" },
  "帯: 同じ月齢の子の94%が入る幅（3〜97）　線: 50": { zh: "带：同月龄孩子中94%所在的范围（3～97）；线：50", en: "Band: where 94% of children the same age fall (3rd–97th). Line: 50th" },
  "帯: 同じ月齢の子の94%が入る幅（3〜97）": { zh: "带：同月龄孩子中94%所在的范围（3～97）", en: "Band: where 94% of children the same age fall (3rd–97th)" },
  "■ {name}（点線）": { zh: "■ {name}（虚线）", en: "■ {name} (dotted)" },
  "点: わが家の記録（まだありません）": { zh: "点：我家的记录（还没有）", en: "Dots: our records (none yet)" },
  "点: わが家の記録": { zh: "点：我家的记录", en: "Dots: our records" },
  /** 帯の男女がまだ決まっていない時、帯なしの図の下に添える（選ばせない） */
  "帯を見る:": { zh: "查看参考带：", en: "Show band:" },
  男の子: { zh: "男孩", en: "Boy" },
  女の子: { zh: "女孩", en: "Girl" },
  /** 双子などの時、紙から写す数字がどの子の物か */
  どの子の数字か: { zh: "是哪个孩子的数字", en: "Which child" },
  どの子の数字かを選んでください: { zh: "请选择是哪个孩子的数字", en: "Choose which child these numbers are for" },

  // ── 目安の出どころ（畳んでおく）──
  目安の出どころ: { zh: "参考范围的出处", en: "Where the guide comes from" },
  "日本産科婦人科学会「妊娠中の体重増加指導の目安」": { zh: "日本妇产科学会《妊娠期体重增加指导参考》", en: "Japan Society of Obstetrics and Gynecology, “Guide for Weight Gain during Pregnancy”" },
  "{title}（{year}年3月8日）。妊娠前の体重と身長から出した BMI ごとの、出産までに増える量の目安です。赤ちゃんが1人の時の値なので、双子などの時は出していません。週ごとの目安は公に無いので、40週の所に1本だけ置いています。": {
    zh: "{title}（{year}年3月8日）。这是按妊娠前的体重和身高算出的 BMI，分别给出的到分娩为止体重增加量的参考。这是怀1个宝宝时的数值，所以双胞胎等情况不显示。官方没有按周的参考值，所以只在40周的位置放了1个。",
    en: "{title} (March 8, {year}). It's a guide to how much weight is gained by birth, for each BMI worked out from the weight and height before pregnancy. The values are for one baby, so they aren't shown for twins or more. There's no official guide for each week, so it's placed just once, at week 40.",
  },
  "上の文は、表に付いた注の原文です（産婦人科診療ガイドライン産科編 2020 CQ 010。厚生労働省 子母発0331第5号〈2021年3月31日〉の表8）。": {
    zh: "上面是表格所附注释的原文，意思是：“增加量需要严格指导的依据未必充分，应认识到这一点，考虑个人差异，进行宽松的指导。”（産婦人科診療ガイドライン産科編 2020 CQ 010。厚生労働省 子母発0331第5号〈2021年3月31日〉の表8）",
    en: "The line above is the original wording of the note on the table. It means: “The evidence for strictly guiding how much weight is gained is not necessarily sufficient; recognizing this, guide gently, taking individual differences into account.” (産婦人科診療ガイドライン産科編 2020 CQ 010; Ministry of Health, Labour and Welfare notice 子母発0331第5号, March 31, 2021, Table 8)",
  },
} satisfies Entries;
