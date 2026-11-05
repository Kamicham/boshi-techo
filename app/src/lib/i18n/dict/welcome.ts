// 辞書: 入口の1枚と「ほかの時期を見る」（components/Welcome.tsx）。時期の札（today/StagePicker.tsx・stages.ts）は監査の凍結が解けてから。
// 書き方は lib/i18n/index.ts の頭。決めた一言「読む手帳から、一緒に動く手帳へ」は、言い換えずに意味をそのまま
import type { Entries } from "..";

export default {
  見ていた手帳に戻る: { zh: "回到刚才看的手册", en: "Back to the handbook" },
  "母子手帳を、再発明する": { zh: "重新发明母子健康手册", en: "Reinventing the Maternal and Child Health Handbook" },
  "読む手帳から、": { zh: "从用来读的手册，", en: "From a handbook you read," },
  "一緒に動く手帳へ。": { zh: "到和你一起行动的手册。", en: "to one that moves with you." },
  "妊娠から2歳までの1000日。手帳が先に動いて、やる事を調べて用意します。家族の手は、赤ちゃんのために。": {
    zh: "从怀孕到2岁的1000天。手册先行一步，替你查好要做的事，提前准备好。家人的双手，留给宝宝。",
    en: "The 1,000 days from pregnancy to age two. The handbook moves first: it looks up what needs doing and gets it ready. Your hands stay free for the baby.",
  },
  // 手帳がする事3つ
  "手続きは、先に用意": { zh: "手续，提前准备好", en: "Paperwork, ready ahead" },
  "町の窓口・持ち物・書く事のメモを、期限の前に手帳が作っておく": {
    zh: "期限之前，手册会先写好备忘：去区政府哪个窗口、带什么、填什么",
    en: "Before each deadline, the handbook prepares a note: which city office counter, what to bring, what to fill in",
  },
  "健診は、聞く事から": { zh: "健康检查，从提问开始", en: "Checkups start with your questions" },
  "話した気がかりを、先生への質問にして健診の日に出す": {
    zh: "把你说出的担心整理成问医生的问题，在检查当天拿出来",
    en: "Worries you've spoken become questions for the doctor, ready on checkup day",
  },
  "2歳の日に、一冊": { zh: "2岁那天，成为一本书", en: "A book on the second birthday" },
  "話した事・撮った写真が、子どもへ語りかける本になる": {
    zh: "说过的话、拍过的照片，变成一本对孩子说话的书",
    en: "What you said and the photos you took become a book that speaks to your child",
  },
  // 見本の家族で触ってみる
  "見本の家族の手帳で、触ってみる": { zh: "用示例家庭的手册试一试", en: "Try a sample family's handbook" },
  "{names}と{child}（{city}・作った家族）。時期を選ぶと、その日の手帳が開きます。": {
    zh: "{names}，还有{child}（{city}，虚构的家庭）。选一个时期，就会打开那一天的手册。",
    en: "{names}, with {child} ({city}; a fictional family). Pick a stage to open the handbook on that day.",
  },
  "手帳を開いています…": { zh: "正在打开手册…", en: "Opening the handbook…" },
  "{banner}。あなただけの写しで、7日で消えます。本物の記録は書かないでください。": {
    zh: "{banner}。这是只属于你的副本，7天后会删除。请不要写入真实的记录。",
    en: "{banner}. This copy is yours alone and is deleted after 7 days. Please don't enter real records.",
  },
  "作った家族です。本物の記録は書かないでください。": { zh: "这是虚构的家庭。请不要写入真实的记录。", en: "This is a fictional family. Please don't enter real records." },
  // 扉
  入口: { zh: "入口", en: "Ways in" },
  自分の手帳を始める: { zh: "开始使用自己的手册", en: "Start your own handbook" },
  "3つ答える": { zh: "回答3个问题", en: "Answer 3 questions" },
  "家族に「入れて」と言われた人は、合言葉で入る ›": { zh: "家人邀请你加入的话，用口令进入 ›", en: "Invited by your family? Enter with the passphrase ›" },
  // ほかの時期を見る（上の帯の札から）
  見本の家族のほかの時期を見る: { zh: "查看示例家庭的其他时期", en: "See the sample family at other stages" },
  ほかの時期を見る: { zh: "查看其他时期", en: "See other stages" },
  だれの画面で見るか: { zh: "用谁的页面看", en: "Whose screen to view" },
  "{name}の画面": { zh: "{name}的页面", en: "{name}'s screen" },
  "見本の家族（{names}）の1000日の、どの日の手帳を見るか。": {
    zh: "要看示例家庭（{names}）1000天里哪一天的手册。",
    en: "Which day of the sample family's ({names}) 1,000 days to view.",
  },
} satisfies Entries;
