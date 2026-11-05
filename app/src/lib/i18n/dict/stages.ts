// 辞書: 見本の家族の時期の札（components/today/stages.ts の言葉。描くのは today/StagePicker.tsx の stageWords）。
// 札の言葉は、その日の1画面目に出る事と合わせてある（UX の見直し C36）。訳も、その日の画面の言葉とそろえる
import type { Entries } from "..";

export default {
  妊娠8週: { zh: "妊娠8周", en: "8 weeks pregnant" },
  妊娠28週: { zh: "妊娠28周", en: "28 weeks pregnant" },
  妊娠37週: { zh: "妊娠37周", en: "37 weeks pregnant" },
  生まれた翌日: { zh: "出生第二天", en: "The day after birth" },
  生後2か月: { zh: "出生后2个月", en: "2 months old" },
  "1歳の誕生日": { zh: "1岁生日", en: "First birthday" },
  "2歳": { zh: "2岁", en: "Age two" },
  "母子手帳をもらう・最初の届け出": { zh: "领取母子健康手册，办理最初的申报", en: "Get the Maternal and Child Health Handbook; the first notifications" },
  "産休・育休のお金の手続き・次の健診の予約": {
    zh: "产前产后休假和育儿休假的补贴手续，预约下次检查",
    en: "Paperwork for maternity leave and childcare leave pay; booking the next checkup",
  },
  "生まれたら、ここから（押すと生まれた日へ）": { zh: "宝宝出生后，从这里开始（点一下就到出生那天）", en: "When the baby arrives, start here (tap to jump to the birth)" },
  "出生届・14日以内の手続き": { zh: "出生登记，以及14天以内要办的手续", en: "Birth registration and the paperwork due within 14 days" },
  "{what}。{n}週早く生まれて、手帳が予定を組み直した日": {
    zh: "{what}。提前{n}周出生，手册重新安排日程的那天",
    en: "{what}. Born {n} {n:week|weeks} early: the day the handbook rearranged the plan",
  },
  "{what}。予定と違う日に生まれて、手帳が予定を組み直した日": {
    zh: "{what}。没有在预产期出生，手册重新安排日程的那天",
    en: "{what}. Born on a different day than expected: the day the handbook rearranged the plan",
  },
  "初めての予防接種・児童手当が届いたか": { zh: "第一次预防接种，儿童补贴到账了吗", en: "First immunizations; has the child allowance arrived?" },
  "おなかにいた頃の手紙が開く・この1年の一冊": { zh: "怀孕时写的信可以打开了，还有这一年的成长书", en: "Letters written during pregnancy open; this year's book" },
  "1000日の記録から、子どもへの一冊": { zh: "用1000天的记录，做成给孩子的一本书", en: "A book for your child, made from 1,000 days of records" },
  "もしも: {what}": { zh: "如果：{what}", en: "What if: {what}" },
  引っ越した: { zh: "搬家了", en: "You moved" },
  "手帳が気づいて、予定を組み直す": { zh: "手册发现变化，重新安排日程", en: "The handbook notices and rearranges the plan" },
  "1000日のどこでも（{label}）": { zh: "1000天里的任何一天（{label}）", en: "Any day in the 1,000 days ({label})" },
} satisfies Entries;
