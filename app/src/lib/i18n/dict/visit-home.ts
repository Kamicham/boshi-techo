// 辞書: 健診のタブ（app/visit/page.tsx・components/visit/Briefing.tsx・demoTranscript.ts）と lib/visit.ts の画面に出る言葉。書き方は lib/i18n/index.ts の頭。
// 2026-11-05 夜: 健診の画面の訳（UX が2体に分けて訳す。全体監査の dict/visit.ts とは別のファイル）。
// 先生の言葉・録音から聞こえた言葉は訳さない（機械の聞き取りを、訳でさらに変えない）。病院あての1枚は日本語のまま描く（LocaleScope）
// - 言葉は健診の記録の辞書（visit-record.ts）にそろえる: 健診＝健康检查／checkup・まとめ＝总结／summary・整理＝整理／organize。
//   受診券＝检查券／checkup vouchers（milestones.ts）。町＝市区町村／city
// - ほかの辞書の鍵を使う所: 次の健診（now.ts）・{label}の健診・明日 {time} 健診ほか・・（today.ts）・健診（answers.ts）・読む・消す・直す・やめる・残す（album.ts）・
//   見る（today.ts）・日付・入れる・気がかり（capture.ts）・時刻（visit.ts）・聞きたい事を書く（ask.ts）・あと{n}日（now.ts）・妊娠{w}週（techo.ts）・
//   赤ちゃん（core.ts）。lib/visit.ts の段の名前（着く・案内・録音）・持ち物の名前・「持ち物 {n}」・状態の「録音中」・呼び名の「妊娠の前」・
//   「読み込んでいます…」「デモ」は visit-record.ts の鍵
import type { Entries } from "..";

export default {
  // ── 一番上の「今やる1つ」（app/visit/page.tsx）──
  /** 母以外（パートナー・祖父母）が開いた時の、だれの健診か */
  ママの健診: { zh: "妈妈的健康检查", en: "Mom's checkup" },
  "準備しています…": { zh: "正在准备…", en: "Getting ready…" },
  今日の健診を始める: { zh: "开始今天的健康检查", en: "Start today's checkup" },
  "今日が健診の日なら、先生の話を録る": { zh: "如果今天是健康检查的日子，就录下医生的话", en: "If today is your checkup, record what the doctor says" },
  /** カレンダーへ渡す題（{label} は「妊娠28週」などの呼び名） */
  "健診（{label}）": { zh: "健康检查（{label}）", en: "Checkup ({label})" },
  "今日・{label}": { zh: "今天 · {label}", en: "Today · {label}" },
  "{date}・{label}": { zh: "{date} · {label}", en: "{date} · {label}" },
  今日の健診を続ける: { zh: "继续今天的健康检查", en: "Continue today's checkup" },
  続ける: { zh: "继续", en: "Continue" },
  健診のまとめを読む: { zh: "看健康检查的总结", en: "Read the checkup summary" },
  "前回の健診・{date}・{label}": { zh: "上次健康检查 · {date} · {label}", en: "Last checkup · {date} · {label}" },
  前回の健診のまとめ: { zh: "上次健康检查的总结", en: "Last checkup's summary" },
  /** {whose} は「ママの健診」の訳 */
  "{whose}の次の日は、まだ入っていません。入ると、ここに出ます": {
    zh: "{whose}的下次日期还没有填。填好后会显示在这里",
    en: "The next date for {whose} isn't in yet. Once it's entered, it will show here",
  },
  "次の日は、まだ入っていません。入ると、ここに出ます": { zh: "下次的日期还没有填。填好后会显示在这里", en: "The next date isn't in yet. Once it's entered, it will show here" },
  次の健診の日を入れる: { zh: "填写下次健康检查的日期", en: "Enter the next checkup date" },
  次の健診の日: { zh: "下次健康检查的日期", en: "Next checkup date" },

  // ── 見本の家族の札とデモの健診 ──
  デモの家族を見ています: { zh: "正在看演示家庭", en: "You're viewing the demo family" },
  わが家に切り替える: { zh: "切换到“我家”", en: "Switch to “Our family”" },
  わが家を作る: { zh: "创建“我家”", en: "Create “Our family”" },
  "作っています…（30秒ほど）": { zh: "正在生成…（约30秒）", en: "Making it… (about 30 seconds)" },
  "デモの健診のまとめを見る（{n}週）": { zh: "查看演示的健康检查总结（{n}周）", en: "See a demo checkup summary ({n} {n:week|weeks})" },

  // ── 先生に聞く事・これまでの健診 ──
  "今日、先生に聞く事": { zh: "今天要问医生的事", en: "To ask the doctor today" },
  先生に聞く事: { zh: "要问医生的事", en: "To ask the doctor" },
  /** 聞く事の札（前回の健診の質問から持ち越した物） */
  前回: { zh: "上次", en: "Last time" },
  "「{text}」を消す": { zh: "删除“{text}”", en: "Delete “{text}”" },
  "例: 夜に足がつって目が覚める": { zh: "例：夜里腿抽筋，会疼醒", en: "e.g. Leg cramps wake me up at night" },
  足す: { zh: "添加", en: "Add" },
  先生に聞きたい事: { zh: "想问医生的事", en: "What you want to ask the doctor" },
  "足しました（先生に聞く事 {n}件）。続けて書けます": {
    zh: "已添加（要问医生的事 {n}件）。可以接着写",
    en: "Added ({n} {n:question|questions} for the doctor). You can keep writing",
  },
  妊娠中に気になっていた事: { zh: "怀孕期间担心过的事", en: "What was on your mind during pregnancy" },
  "生まれる前に足した物です。今も聞きたい事は、上の「聞く事」に書き直してください。": {
    zh: "这些是出生前添加的。现在还想问的，请重新写到上面的“要问医生的事”里。",
    en: "These were added before the birth. If you still want to ask, write it again in “To ask the doctor” above.",
  },
  これまでの健診: { zh: "以往的健康检查", en: "Past checkups" },

  // ── 赤ちゃんの健診・予防接種（app/visit/page.tsx の BabyCheckups・BabyRow）──
  "赤ちゃんの健診・予防接種": { zh: "宝宝的健康检查和预防接种", en: "Baby's checkups and immunizations" },
  "{name}の健診・予防接種": { zh: "{name}的健康检查和预防接种", en: "{name}'s checkups and immunizations" },
  "1000日の間の健診と予防接種は、ひととおり過ぎました": {
    zh: "1000天里的健康检查和预防接种，都已经过去了",
    en: "The checkups and immunizations of the 1000 days have all passed",
  },
  "ほかの健診・予防接種": { zh: "其他健康检查和预防接种", en: "Other checkups and immunizations" },
  "次の健診で聞く事（{n}）": { zh: "下次健康检查时要问的事（{n}）", en: "To ask at the next checkup ({n})" },
  "受ける所は、町が決めた小児科など。日と場所は町の案内で確かめてください": {
    zh: "接受的地方是市区町村指定的儿科等。日期和地点请看市区町村的通知确认",
    en: "They're done at places your city designates, such as pediatric clinics. Check the date and place in your city's notice",
  },
  /**
   * 札: 始まりまでの日数。「あと{n}日」だけの鍵は期限までの日数の訳（now.ts の「{n} days left」）なので、
   * 空の {start} を付けた鍵で訳を分ける（日本語は同じ。lib/i18n/dict/draft.ts の「もう一度{retry}」と同じやり方）
   */
  "あと{n}日{start}": { zh: "{n}天后{start}", en: "In {n} {n:day|days}{start}" },
  まだ先: { zh: "还早", en: "Not yet" },
  済み: { zh: "已完成", en: "Done" },
  時期を過ぎた: { zh: "已过时期", en: "Time has passed" },
  まだなら: { zh: "如果还没做", en: "If not done yet" },
  受ける時期: { zh: "到时候了", en: "It's time" },
  "{date}から受けられます": { zh: "{date}起可以接受", en: "Available from {date}" },
  "{date}ごろの時期を過ぎています": { zh: "已过了大约{date}的时期", en: "Past the usual time (around {date})" },
  "{date}までの時期を過ぎています": { zh: "已过了{date}之前的时期", en: "Past the period (until {date})" },
  "今受けられます・{date}ごろまでに": { zh: "现在可以接受 · 大约{date}之前", en: "Available now · by around {date}" },
  "今受けられます・{date}まで": { zh: "现在可以接受 · {date}之前", en: "Available now · until {date}" },

  // ── 受診券と次の健診の目安（app/visit/page.tsx の PrenatalBox）──
  受診券と次の健診の目安: { zh: "检查券和下次健康检查的参考日期", en: "Checkup vouchers and the next checkup estimate" },
  /** 見出し。受診券は受付で出す物なので、日本語を括弧で並べる */
  受診券と次の健診: { zh: "检查券（受診券）和下次健康检查", en: "Checkup vouchers (受診券) and the next checkup" },
  "次の健診の目安 {date}ごろ": { zh: "下次健康检查的参考日期：{date}前后", en: "Next checkup: around {date}" },
  "今は国の標準で{interval}。病院が言った日が正です（予約が決まったら上で入れてください）": {
    zh: "目前按国家标准是{interval}。以医院说的日期为准（预约定下来后，请在上面填写）",
    en: "For now this follows the national standard ({interval}). The date your hospital gives is what counts (once your appointment is set, enter it above)",
  },
  /** 国の標準の間隔（lib/prenatal.ts の intervalWord。サーバが日本語で返し、画面で訳す） */
  "4週ごと": { zh: "每4周一次", en: "every 4 weeks" },
  "2週ごと": { zh: "每2周一次", en: "every 2 weeks" },
  毎週: { zh: "每周一次", en: "every week" },
  "受診券 {total} 回中 {used} 回・あと {remaining} 回": {
    zh: "检查券：共{total}次，已用{used}次 · 还剩{remaining}次",
    en: "Vouchers: {used} of {total} used · {remaining} left",
  },
  "回数は国の標準（14回）。町で違う時は直せます": {
    zh: "次数按国家标准（14次）。如果你所在的市区町村不同，可以修改",
    en: "The count follows the national standard (14). If your city's is different, you can change it",
  },
  家族が直した回数: { zh: "家人修改后的次数", en: "Number set by your family" },
  /** 上の1文の後ろに続ける */
  "。券の数を超えた分は自分で払う事が多いので、町で確かめてください": {
    zh: "。超出券数的检查通常要自己付费，请向市区町村确认",
    en: ". Checkups beyond your vouchers are often paid out of pocket, so check with your city",
  },
  券の数を直す: { zh: "修改券数", en: "Change the voucher count" },
  "今日払った額（領収書から。医療費控除や、里帰りの払い戻しに使えます）": {
    zh: "今天付的金额（看收据填写。可用于医疗费扣除，以及回乡分娩后的检查费报销）",
    en: "Amount paid today (from your receipt; useful for the medical expense deduction and for checkup refunds after giving birth in your hometown)",
  },
  "例: 3000": { zh: "例：3000", en: "e.g. 3000" },
  "払った額（円）": { zh: "付的金额（日元）", en: "Amount paid (yen)" },
  /** {yen} は太字の額、{count} は下の「（{n}回分）」 */
  "これまでに払った額 {yen} 円{count}": { zh: "到目前为止付的金额 {yen} 日元{count}", en: "Paid so far: {yen} yen{count}" },
  "（{n}回分）": { zh: "（{n}次）", en: " ({n} {n:payment|payments})" },
  "{yen} 円": { zh: "{yen} 日元", en: "{yen} yen" },

  // ── 前日と当日の声かけ（components/visit/Briefing.tsx）──
  前の日: { zh: "前一天", en: "The day before" },
  今日: { zh: "今天", en: "Today" },
  "書類の名前は、町や病院で少し違います。": { zh: "文件的名称，各市区町村和医院会略有不同。", en: "Document names differ a little by city and hospital." },
  "先生に聞く事 {n}": { zh: "要问医生的事 {n}件", en: "To ask the doctor ({n})" },
  録音のひと言: { zh: "录音前说一句", en: "A word before recording" },
  /** 先生に聞く言葉は、中文・English でも日本語を括弧で並べる（その場で言えるように。visit-record.ts と同じ） */
  "診察の最初に「録音してもいいですか」と聞くと、あとで家族で聞き返せます。": {
    zh: "在诊察一开始问医生“可以录音吗？”（録音してもいいですか），之后就能和家人一起回听。",
    en: "At the start of the exam, ask “May I record this?” (録音してもいいですか). Then your family can listen back later.",
  },

  // ── 健診の状態の札（components/visit/StatusChip.tsx・lib/visit.ts の STATUS_LABEL。録音中は visit-record.ts）──
  /** 「これから」だけの鍵は手帳の見出し（techo.ts の「以后・Coming up」）の訳なので、空の {visit} を付けた鍵で訳を分ける（日本語は同じ） */
  "これから{visit}": { zh: "还没开始{visit}", en: "Not started{visit}" },
  文字起こし中: { zh: "正在转成文字", en: "Transcribing" },
  整理中: { zh: "正在整理", en: "Organizing" },
  できた: { zh: "完成了", en: "Done" },
  うまくいかなかった: { zh: "没有成功", en: "Didn't work" },

  // ── 見本の健診の聞く事（components/visit/demoTranscript.ts の DEMO_AGENDA。保存する見本の字は日本語のまま。出す所で t(a.text) と引く）──
  "夜に足がつって目が覚める。何かできることはある？": {
    zh: "夜里腿抽筋，会疼醒。有什么能做的吗？",
    en: "Leg cramps wake me up at night. Is there anything I can do?",
  },
  "里帰り出産の病院を移る手続きは、いつまでに？": {
    zh: "回乡分娩要转医院，手续最晚什么时候办？",
    en: "Giving birth in your hometown: by when do I need to arrange the hospital transfer?",
  },
} satisfies Entries;
