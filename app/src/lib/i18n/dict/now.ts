// 辞書: 「いま」の画面の本体（components/Techo.tsx の今やる1つ・ほかに今やる事・近づいたら・済んだ事・静かにする家族の今日）と、
// どの画面でも使う部品（components/ui.tsx・components/countdown.ts の あと◯日）と、週数の帯（lib/week-band.ts）。
// 書き方は lib/i18n/index.ts の頭。静かにする家族の今日（死産・赤ちゃんの入院）の文は、言い換えずに意味をそのまま訳す
import type { Entries } from "..";

export default {
  // ── 済んだの印・ありがとう ──
  "{n}つを済んだにしました": { zh: "已将{n}件事标记为完成", en: "Marked {n} {n:item|items} as done" },
  "「{title}」を済んだにしました": { zh: "已将“{title}”标记为完成", en: "Marked “{title}” as done" },
  "ありがとうを、まだ送れていません（{reason}）": { zh: "“谢谢”还没能发送出去（{reason}）", en: "Your thanks hasn't been sent yet ({reason})" },
  "済んだの印を、まだ保存できていません": { zh: "“完成”的标记还没能保存", en: "Couldn't save the “done” mark yet" },
  "押した印は元に戻しました。電波のある所で、もう一度押してください。": {
    zh: "已撤回刚才的标记。请在有信号的地方再按一次。",
    en: "We undid that mark. Please tap it again where you have a signal.",
  },
  "済んだの印を、読み込めませんでした": { zh: "无法读取“完成”的标记", en: "Couldn't load the “done” marks" },
  "記録は消えていません。電波のある所で、もう一度読んでください。": {
    zh: "记录没有丢失。请在有信号的地方重新读取。",
    en: "Your records are safe. Please reload where you have a signal.",
  },
  もう一度読む: { zh: "重新读取", en: "Reload" },
  もどす: { zh: "撤回", en: "Undo" },
  済んだ事: { zh: "已完成的事", en: "Done" },

  // ── 済んだの意味の一言（lib/done-words.ts。{c} は子どもの名前か「赤ちゃん」。English は {c} を文の頭に置かない＝the baby が小文字のため） ──
  "母子手帳が、{c}の最初の持ち物になりました": {
    zh: "母子健康手册，成了{c}拥有的第一件东西",
    en: "The Maternal and Child Health Handbook is now {c}'s very first belonging",
  },
  "出産のお金は、健康保険から産院へ直接払われます": {
    zh: "分娩的费用，会由健康保险直接支付给产科医院",
    en: "The cost of the birth is paid straight from your health insurance to the maternity clinic",
  },
  "{c}の名前が、戸籍にのります": { zh: "{c}的名字，会登记到户籍（戸籍）上", en: "The family register (戸籍) will now list {c}'s name" },
  "{c}が、健康保険に入ります": { zh: "{c}会加入健康保险", en: "Health insurance will now cover {c}" },
  "{c}の児童手当は、申し込んだ月の次の月の分からです": {
    zh: "{c}的儿童补贴（児童手当），从申请的下一个月开始算",
    en: "The child allowance (児童手当) for {c} counts from the month after you applied",
  },
  "町の保健師さんに、{c}が生まれた事が届きます": { zh: "当地的保健师会收到{c}出生的消息", en: "The local public health nurse will hear that {c} was born" },
  "町の保健師さんたちが、{c}に会いに来てくれました": { zh: "当地的保健师来看望{c}了", en: "The local public health nurses came to see {c}" },
  "1か月、おつかれさまでした": { zh: "1个月了，辛苦了", en: "You made it through the first month. Well done" },
  "3〜4か月、おつかれさまでした": { zh: "3到4个月了，辛苦了", en: "You made it to 3 to 4 months. Well done" },
  "9〜10か月、おつかれさまでした": { zh: "9到10个月了，辛苦了", en: "You made it to 9 to 10 months. Well done" },
  "1歳6か月、おつかれさまでした": { zh: "1岁6个月了，辛苦了", en: "You made it to 18 months. Well done" },
  "{c}の予防接種が、始まりました": { zh: "{c}的预防接种开始了", en: "Immunizations for {c} have begun" },
  "ここまでの育休、おつかれさまでした": { zh: "这段时间的育儿休假，辛苦了", en: "Well done on your childcare leave so far" },
  手帳で済み: { zh: "已在手册中完成", en: "Done in the handbook" },

  // ── 今やる1つ ──
  "{name}さんが今やる事はありません": { zh: "{name}现在没有要做的事", en: "Nothing for {name} to do right now" },
  "体を休めてください。": { zh: "请好好休息。", en: "Please get some rest." },
  "いま、いちばん先の事": { zh: "现在最先要做的事", en: "First thing to do now" },
  "いま、いちばん先の事（{who}の番）": { zh: "现在最先要做的事（轮到{who}）", en: "First thing to do now ({who}'s turn)" },
  "（{who}の番）": { zh: "（轮到{who}）", en: " ({who}'s turn)" },
  次の妊婦健診を予約する: { zh: "预约下一次孕妇健康检查", en: "Book the next prenatal checkup" },
  "国の目安では今ごろです。病院で日を言われていたら、そちらに合わせてください。": {
    zh: "按国家的标准，大约是现在。如果医院已经告诉你日期，请以医院为准。",
    en: "By the national guideline, it's about now. If the hospital gave you a date, go with that.",
  },
  "国の目安ではあと{n}日ごろです。病院で日を言われていたら、そちらに合わせてください。": {
    zh: "按国家的标准，大约还有{n}天。如果医院已经告诉你日期，请以医院为准。",
    en: "By the national guideline, it's in about {n} {n:day|days}. If the hospital gave you a date, go with that.",
  },
  "国の目安では今ごろです。病院で日を言われていたら、そちらに合わせてください": {
    zh: "按国家的标准，大约是现在。如果医院已经告诉你日期，请以医院为准",
    en: "By the national guideline, it's about now. If the hospital gave you a date, go with that",
  },
  予約した日を入れる: { zh: "填写预约的日期", en: "Enter the booked date" },
  "119・#8000・手当の手順": { zh: "119、#8000、急救步骤", en: "119, #8000, first-aid steps" },

  // ── ほかに今やる事・近づいたら ──
  ほかに今やる事: { zh: "现在还要做的事", en: "Other things to do now" },
  今日ごろ: { zh: "大约今天", en: "Around today" },
  "あと{n}日ごろ": { zh: "大约还有{n}天", en: "In about {n} {n:day|days}" },
  次の健診: { zh: "下一次检查", en: "Next checkup" },
  近づいたら出す事: { zh: "临近时会显示的事", en: "Coming up later" },
  "近づいたら、ここに出します": { zh: "临近时，会显示在这里", en: "These will show here when they get close" },
  "ほかに{n}件あります": { zh: "另外还有{n}件", en: "{n} more" },
  健診と予防接種: { zh: "健康检查和预防接种", en: "Checkups and immunizations" },

  // ── 今やる事が無い日（Calm） ──
  "{lead}次は 授かったら、「{what}」。近づいたら、ここの一番上に出します。": {
    zh: "{lead}下一件是怀孕后的“{what}”。临近时，会显示在这里的最上面。",
    en: "{lead}Next, once you're pregnant: “{what}”. When it gets close, it'll show at the top here.",
  },
  "{lead}次は 生まれたら、「{what}」。近づいたら、ここの一番上に出します。": {
    zh: "{lead}下一件是出生后的“{what}”。临近时，会显示在这里的最上面。",
    en: "{lead}Next, after the birth: “{what}”. When it gets close, it'll show at the top here.",
  },
  "{lead}次は {date}ごろから、「{what}」。近づいたら、ここの一番上に出します。": {
    zh: "{lead}下一件从{date}前后开始：“{what}”。临近时，会显示在这里的最上面。",
    en: "{lead}Next, from around {date}: “{what}”. When it gets close, it'll show at the top here.",
  },
  授かったら: { zh: "怀孕后", en: "Once pregnant" },
  生まれたら: { zh: "出生后", en: "After the birth" },
  "{date}ごろから": { zh: "{date}前后开始", en: "From around {date}" },

  // ── 1000日の線 ──
  "妊娠から2歳までを、歩き終えたところ": { zh: "已经走完了从怀孕到2岁的这段路", en: "You've walked all the way from pregnancy to age two" },
  "妊娠から2歳までの{pct}%のところ": { zh: "从怀孕到2岁，已走过{pct}%", en: "{pct}% of the way from pregnancy to age two" },
  妊娠: { zh: "妊娠", en: "Pregnancy" },

  // ── 週数の帯（lib/week-band.ts） ──
  "{name}の予定日まで あと{n}日": { zh: "离{name}的预产期还有{n}天", en: "{n} {n:day|days} until {name}'s due date" },
  "今日が{name}の予定日": { zh: "今天是{name}的预产期", en: "Today is {name}'s due date" },
  "{name}の予定日のころ": { zh: "{name}的预产期前后", en: "Around {name}'s due date" },
  "予定日まであと{n}日": { zh: "离预产期还有{n}天", en: "{n} {n:day|days} until the due date" },
  今日が予定日: { zh: "今天是预产期", en: "Today is the due date" },
  予定日のころ: { zh: "预产期前后", en: "Around the due date" },
  "1000日を一緒に歩きました": { zh: "一起走过了1000天", en: "We walked the 1,000 days together" },

  // ── 静かにする家族の今日（死産・赤ちゃんの入院）。言い換えずに ──
  "今は、何もしなくて大丈夫です": { zh: "现在，什么都不用做也没关系", en: "Right now, you don't need to do anything" },
  "手帳の予定とお知らせは止めています。記録はそのまま残っています。": {
    zh: "手册的日程和通知已经暂停。记录都还保留着。",
    en: "The handbook's schedule and notifications are paused. Your records are all still here.",
  },
  "今は赤ちゃんと、ご自分の体を一番に。手帳の予定とお知らせは止めています。": {
    zh: "现在请把宝宝和你自己的身体放在第一位。手册的日程和通知已经暂停。",
    en: "Right now, put your baby and your own body first. The handbook's schedule and notifications are paused.",
  },
  "要る手続き（今日でなくて大丈夫です）": { zh: "需要办的手续（不必今天办）", en: "Paperwork you'll need (it doesn't have to be today)" },
  "妊娠12週を過ぎてからの時は、7日以内に役所へ死産の届け出があります。多くは病院が書類を用意し、家族の代わりの人が出せます。": {
    zh: "如果是在妊娠12周以后，需要在7天以内向区政府提交死产申报（死産届）。多数情况下由医院准备文件，也可以请人代替家人提交。",
    en: "If it was after 12 weeks of pregnancy, a stillbirth notification (死産届) is filed at the city office within 7 days. In most cases the hospital prepares the papers, and someone can file it on the family's behalf.",
  },
  "妊娠12週（85日）を過ぎてからの時は、出産育児一時金と、働いている人は産後の休業の対象です。健康保険と職場に聞いてください。": {
    zh: "如果是在妊娠12周（85天）以后，可以领取分娩育儿一次性补贴（出産育児一時金）；有工作的人也可以休产后假。请向健康保险和工作单位咨询。",
    en: "If it was after 12 weeks (85 days) of pregnancy, you can receive the Childbirth and Childcare lump-sum grant (出産育児一時金), and if you work, you can take postpartum leave. Please ask your health insurance and your workplace.",
  },
  "分からない事は、病院の相談の窓口（医療ソーシャルワーカー）に聞けます。": {
    zh: "不明白的事，可以问医院的咨询窗口（医疗社工）。",
    en: "For anything you're unsure about, you can ask the hospital's consultation desk (a medical social worker).",
  },
  "出生届は、生まれた日から14日以内です。赤ちゃんが入院中でも出せます。家族が代わりに出せます。": {
    zh: "出生登记（出生届）要在出生之日起14天以内提交。宝宝在住院也可以提交，家人可以代为提交。",
    en: "The birth registration (出生届) is due within 14 days of the birth. You can file it even while the baby is in the hospital, and a family member can file it for you.",
  },
  "入院の費用を助ける制度（養育医療）があります。病院の相談の窓口（医療ソーシャルワーカー）に聞いてください。": {
    zh: "有帮助支付住院费用的制度（養育医療）。请问医院的咨询窗口（医疗社工）。",
    en: "There's a program that helps with hospital costs (養育医療). Please ask the hospital's consultation desk (a medical social worker).",
  },
  "健診や予防接種の時期は、退院の時に病院と相談して決めます。": {
    zh: "健康检查和预防接种的时间，出院时和医院商量决定。",
    en: "When to do checkups and immunizations is decided with the hospital at discharge.",
  },
  いつもの今日の画面を見る: { zh: "查看平常的“今天”页面", en: "See the usual Today screen" },
  静かにするのをやめる: { zh: "取消安静模式", en: "Turn off quiet mode" },

  // ── どの画面でも使う部品（components/ui.tsx） ──
  "期限は{date}でした": { zh: "期限是{date}", en: "It was due {date}" },
  くわしく: { zh: "详细", en: "Details" },
  "なぜ？": { zh: "为什么？", en: "Why?" },
  "{n}件": { zh: "{n}件", en: "{n} {n:item|items}" },
  コピー: { zh: "复制", en: "Copy" },
  コピーしました: { zh: "已复制", en: "Copied" },
  "【 】が{n}か所": { zh: "有{n}处【 】要填", en: "{n} {n:blank|blanks} 【 】 to fill" },
  全部見る: { zh: "查看全部", en: "See all" },
  "共有…": { zh: "分享…", en: "Share…" },
  全部コピー: { zh: "全部复制", en: "Copy all" },
  共有できませんでした: { zh: "无法分享", en: "Couldn't share" },
  メールで開く: { zh: "用邮件打开", en: "Open in email" },
  "LINE で送る": { zh: "用 LINE 发送", en: "Send with LINE" },
  カレンダーに入れる: { zh: "加入日历", en: "Add to calendar" },
  地図で開く: { zh: "在地图中打开", en: "Open in maps" },

  // ── あと◯日（components/countdown.ts） ──
  今日から: { zh: "今天开始", en: "Starts today" },
  あしたから: { zh: "明天开始", en: "Starts tomorrow" },
  "{n}日後から": { zh: "{n}天后开始", en: "Starts in {n} {n:day|days}" },
  今からでもできます: { zh: "现在也还来得及", en: "You can still do it now" },
  今日まで: { zh: "今天截止", en: "Due today" },
  あしたまで: { zh: "明天截止", en: "Due tomorrow" },
  "あと{n}日": { zh: "还有{n}天", en: "{n} {n:day|days} left" },
} satisfies Entries;
