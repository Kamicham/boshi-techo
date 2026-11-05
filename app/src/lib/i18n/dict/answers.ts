// 辞書: 「手帳に聞く」のサーバの言葉（app/api/ask/route.ts の断り・lib/ask/agent.ts と tools.ts の状態の行・
// lib/ask/rule-answer.ts の決まりの答え・lib/samples.ts の見本の答え・lib/ask/bridge.ts の急ぎの橋・lib/app-guide.ts の画面の地図）。
// サーバは頼みの言葉で withLang（lib/i18n）に包んで組む。状態の行・断り・ボタンの札は、画面が t() で引く（前に残った会話の札も訳せる）。
// 急ぎの橋と心の危機の文は、言い換えずに意味をそのまま訳す（弱めない・強めない）。番号と相談先の名前は日本語を括弧で並べる。
import type { Entries } from "..";

export default {
  // ── 断り（app/api/ask/route.ts） ──
  聞きたい事が空です: { zh: "请写下想问的事", en: "Please type your question" },
  "長すぎます（2000字まで）": { zh: "太长了（最多2000字）", en: "That's too long (2,000 characters at most)" },
  "前の問いに答えています。少し待ってください": { zh: "正在回答上一个问题，请稍等", en: "Still answering your last question. Please wait a moment" },
  "答えを作れませんでした。少し待ってもう一度聞いてください": {
    zh: "没能生成回答。请稍等一下，再问一次",
    en: "Couldn't put an answer together. Please wait a moment and ask again",
  },

  // ── 状態の行（答えを作っている間） ──
  考えています: { zh: "正在思考", en: "Thinking" },
  まとめています: { zh: "正在整理", en: "Putting it together" },
  答えを確かめています: { zh: "正在核对回答", en: "Checking the answer" },
  予定を見ています: { zh: "正在查看日程", en: "Looking at the schedule" },
  手帳を見ています: { zh: "正在查看手册", en: "Looking at the handbook" },
  "公式のページを調べています（20〜40秒）": { zh: "正在查官方网页（20到40秒）", en: "Checking official pages (20 to 40 seconds)" },
  "うまくまとめられませんでした。もう一度、聞き方を変えて聞いてください。": {
    zh: "没能整理好回答。请换个问法，再问一次。",
    en: "Couldn't put that together well. Please try asking in a different way.",
  },
  "{city}の調べ済みのページを見ています": { zh: "正在查看已查过的{city}页面", en: "Looking at pages already checked for {city}" },
  "{city}の公式ページを調べています（30秒〜1分）": { zh: "正在查{city}的官方网页（30秒到1分钟）", en: "Checking {city}'s official pages (30 seconds to 1 minute)" },
  // 道具の既定の札（Claude が札を書かなかった時。画面が t() で引く）
  その画面へ: { zh: "前往该页面", en: "Go to that screen" },
  相手: { zh: "对方", en: "Recipient" },
  // 押した後の一言（app/api/ask/act/route.ts）と断り
  "✓ もう済んでいます": { zh: "✓ 已经完成了", en: "✓ Already done" },
  "✓ 記録に残しました（話す・撮るの「これまでの記録」）": {
    zh: "✓ 已保存为记录（在“说·拍·写”的“以往的记录”里）",
    en: "✓ Saved as a record (under “Past records” in Talk · Snap · Type)",
  },
  "✓ 記録に残しました（話す・撮るの「これまでの記録」）。手帳のページに入る物は、手帳のタブで OK を待っています": {
    zh: "✓ 已保存为记录（在“说·拍·写”的“以往的记录”里）。要记进手册页面的内容，正在“手册”页面等你点 OK",
    en: "✓ Saved as a record (under “Past records” in Talk · Snap · Type). Items for the handbook pages are waiting for your OK in the Handbook tab",
  },
  "✓ {child}の次の健診で聞く事に足しました（健診のタブの「{child}の健診・予防接種」に並びます）": {
    zh: "✓ 已加到{child}下次检查要问的事里（会列在检查页面的“{child}的健康检查和预防接种”中）",
    en: "✓ Added to the questions for {child}'s next checkup (listed under “{child}'s checkups and immunizations” on the Checkups screen)",
  },
  "✓ もう{child}の次の健診で聞く事に並んでいます（同じ文は2回足しません）": {
    zh: "✓ 已经在{child}下次检查要问的事里了（同样的内容不会加两次）",
    en: "✓ Already in the questions for {child}'s next checkup (the same text isn't added twice)",
  },
  "✓ ママの次の健診で聞く事に足しました（健診のタブの「聞く事」に並びます）": {
    zh: "✓ 已加到妈妈下次检查要问的事里（会列在检查页面的“要问的事”中）",
    en: "✓ Added to the questions for Mom's next checkup (listed under “Questions” on the Checkups screen)",
  },
  "✓ もうママの健診で聞く事に並んでいます（同じ文は2回足しません）": {
    zh: "✓ 已经在妈妈检查要问的事里了（同样的内容不会加两次）",
    en: "✓ Already in the questions for Mom's checkup (the same text isn't added twice)",
  },
  "✓ 「{label}」を済みにしました（今日の画面の「済んだ事」から戻せます）": {
    zh: "✓ 已将“{label}”标记为完成（可以在“今天”页面的“已完成的事”里撤回）",
    en: "✓ Marked “{label}” as done (you can undo it under “Done” on the Today screen)",
  },
  どの動きか読めません: { zh: "无法识别是哪个操作", en: "Couldn't tell which action this is" },
  "その動きが見つかりません。窓を開き直してください": { zh: "找不到这个操作。请重新打开窗口", en: "Couldn't find that action. Please reopen the window" },
  この動きはここでは行いません: { zh: "这个操作不在这里进行", en: "This action isn't done here" },
  // 急ぎの時、通う産院の電話のボタン（Claude を使う家族）
  "{name}に電話（夜間も）": { zh: "打电话给{name}（夜间也可以）", en: "Call {name} (even at night)" },
  通う産院: { zh: "常去的分娩医院", en: "your maternity hospital" },

  // ── 決まりの答え（lib/ask/rule-answer.ts）。日付は予定表の写しの字を画面の言葉に直して差し込む ──
  "（手帳の予定表から。Claude は使っていません）": {
    zh: "（来自手册的日程表，没有使用 Claude）",
    en: "(From the handbook's schedule. Claude wasn't used.)",
  },
  "この画面（{name}）でできる事:": { zh: "在这个页面（{name}）可以做的事：", en: "What you can do on this screen ({name}):" },
  "いまやる事は{n}つです。": { zh: "现在要做的事有{n}件。", en: "There {n:is|are} {n} {n:thing|things} to do now." },
  "ほかに{n}つ（「いま」の画面にあります）": { zh: "另外还有{n}件（在“今天”页面上）", en: "{n} more (on the Today screen)" },
  "始める前に目安が過ぎた事: {list}（済んでいなければ、今からでもできます。「いま」の画面で、済んでいるかを聞いています）": {
    zh: "开始用手册之前就已过了参考时间的事：{list}（如果还没办，现在也来得及。“今天”页面会问你是否已经办好）",
    en: "Things whose suggested time passed before you started: {list} (if they aren't done, you can still do them now. The Today screen asks whether they're done)",
  },
  "（国の目安。病院で日を言われていたら、そちらに合わせてください）": {
    zh: "（国家的参考时间。如果医院已经告诉你日期，请以医院为准）",
    en: " (national guideline. If the hospital gave you a date, go with that)",
  },
  "押すと、その事の窓口調べ・書く事のメモが開きます。": {
    zh: "点一下，就会打开这件事的窗口信息和填写备忘。",
    en: "Tap one to open where to go and notes on what to fill in.",
  },
  "今すぐやる事はありません。": { zh: "现在没有马上要做的事。", en: "Nothing to do right now." },
  "ほかに今すぐやる事はありません。": { zh: "除此之外，现在没有马上要做的事。", en: "Nothing else to do right now." },
  "次は「{title}」で、{date}からです。近づいたら、「いま」の画面に出します。": {
    zh: "下一件是“{title}”，从{date}开始。临近时，会显示在“今天”页面上。",
    en: "Next is “{title}”, from {date}. When it gets close, it'll show on the Today screen.",
  },
  "次は、授かったら「{title}」です。近づいたら、「いま」の画面に出します。": {
    zh: "下一件是怀孕后的“{title}”。临近时，会显示在“今天”页面上。",
    en: "Next, once you're pregnant: “{title}”. When it gets close, it'll show on the Today screen.",
  },
  "次は、生まれたら「{title}」です。近づいたら、「いま」の画面に出します。": {
    zh: "下一件是出生后的“{title}”。临近时，会显示在“今天”页面上。",
    en: "Next, after the birth: “{title}”. When it gets close, it'll show on the Today screen.",
  },
  "予定表の、次の健診と予防接種です。": {
    zh: "这是日程表上接下来的健康检查和预防接种。",
    en: "Here are the next checkups and immunizations on the schedule.",
  },
  "日付は国の目安です。病院で日を言われていたら、そちらに合わせてください。": {
    zh: "日期是国家的参考时间。如果医院已经告诉你日期，请以医院为准。",
    en: "Dates follow the national guideline. If the hospital gave you a date, go with that.",
  },
  "予定表にある、関係する事です。": { zh: "这是日程表上相关的事。", en: "Here's what's related on the schedule." },
  "押すと、窓口・持ち物・書く事のメモが開きます。町ごとに違う所は、窓口に確かめてください。": {
    zh: "点一下，就会打开窗口、要带的东西和填写的备忘。各地不同的地方，请向窗口确认。",
    en: "Tap one to open notes on where to go, what to bring, and what to fill in. Where it differs by town, please check with the office.",
  },
  "期限 {date}": { zh: "期限 {date}", en: "Due {date}" },
  "目安 {date}": { zh: "参考 {date}", en: "Around {date}" },
  "{date}から": { zh: "{date}开始", en: "From {date}" },
  "（あと{n}日）": { zh: "（还有{n}天）", en: " ({n} {n:day|days} left)" },
  "（{n}日過ぎた）": { zh: "（已过{n}天）", en: " ({n} {n:day|days} ago)" },

  // ── 見本の答え（lib/samples.ts・lib/trial-words.ts）。体験版と鍵の無い見本の家族で出る ──
  "（見本の答え）": { zh: "（示例回答）", en: "(Sample answer)" },
  "この体験版では Claude を呼ばず、見本の答えを出しています。": {
    zh: "这个体验版不调用 Claude，显示的是示例回答。",
    en: "This trial doesn't call Claude, so it shows sample answers.",
  },
  "今日の体験で Claude を使える上限に達したので、見本の答えにしました。明日はここを Claude が書きます。": {
    zh: "今天体验中可以使用 Claude 的额度已经用完，所以改成了示例回答。明天这里会由 Claude 来写。",
    en: "Today's limit for using Claude in the trial has been reached, so this is a sample answer. Tomorrow, Claude will write this part.",
  },
  "Claude の鍵を入れると、ここを Claude が書きます。": {
    zh: "填入 Claude 的密钥后，这里会由 Claude 来写。",
    en: "Once a Claude key is added, Claude will write this part.",
  },
  "この家族の予定・記録・町を道具で見てから答え、記録・健診で聞く事・その画面へ行くボタンを添えます。": {
    zh: "平时会先用工具查看这个家庭的日程、记录和所在的城市再回答，并附上记录、检查时要问的事，以及前往相应页面的按钮。",
    en: "Normally, it checks this family's schedule, records, and town with its tools before answering, and adds buttons to save a record, add a question for the checkup, or open the right screen.",
  },
  "見本のあいだも、予定表・期限・急ぎの時の連絡先はそのまま使えます。": {
    zh: "在示例回答期间，日程表、期限和紧急时的联系方式也照常可以使用。",
    en: "Even with sample answers, the schedule, deadlines, and emergency contacts work as usual.",
  },

  // ── 急ぎの橋（lib/ask/bridge.ts）。言い換えずに ──
  "今すぐ、かかりつけの産院へ電話してください（夜間も）。命が危ないと思ったら、迷わず119。": {
    zh: "请现在就打电话给你常去的分娩医院（夜间也可以）。如果觉得有生命危险，请毫不犹豫地拨打119。",
    en: "Call your maternity hospital right now (even at night). If you think a life is in danger, call 119 without hesitation.",
  },
  "今すぐ電話してください。命が危ないと思ったら、迷わず119。救急車を呼ぶか迷う時は、子どもの事はかかりつけか #8000、ママの体はかかりつけの産院へ（夜間も）。": {
    zh: "请现在就打电话。如果觉得有生命危险，请毫不犹豫地拨打119。拿不准要不要叫救护车时，孩子的事请找常看的医生或拨打 #8000，妈妈的身体请找常去的分娩医院（夜间也可以）。",
    en: "Call right now. If you think a life is in danger, call 119 without hesitation. If you're not sure whether to call an ambulance, call your child's regular doctor or #8000 about your child, or the maternity hospital about Mom's body (even at night).",
  },
  "#8000 につながらない時の県の番号は、急ぎの時の画面にあります。": {
    zh: "如果打不通 #8000，各县的号码在“紧急情况”页面上。",
    en: "If #8000 doesn't connect, your prefecture's number is on the Emergency screen.",
  },
  "母子手帳の便色カードには「{note}」と書いてあります。": {
    zh: "母子健康手册的大便颜色卡上写着：“{note}”",
    en: "The stool color card in the Maternal and Child Health Handbook says: “{note}”",
  },
  // 便色カードの全文。答えでは「母子手帳の便色カードには「{note}」と…」の中に入るので、中の引用は ‘ ’（日本語の『』と同じ入れ子）
  "『1番～3番に近い色だと思う』『4番～7番だったのが1番～3番に近くなった』どちらかが当てはまるときは、胆道閉鎖症などの病気の可能性がありますので、1日も早く小児科医、小児外科医等の診察を受けてください。生後4か月くらいまでは、うんちの色に注意が必要です。生後2週を過ぎても皮膚や白目(しろめ)が黄色い場合、おしっこが濃い黄色の場合にも、すぐに医師等に相談しましょう。":
    {
      zh: "‘我觉得颜色接近1号到3号’‘原来是4号到7号，现在变得接近1号到3号’，只要符合其中一项，就有可能是胆道闭锁症等疾病，请尽早到儿科医生、小儿外科医生等处就诊。出生后4个月左右以前，要注意大便的颜色。出生满2周后，如果皮肤或眼白仍然发黄，或者小便是深黄色，也请马上向医生等咨询。",
      en: "If either ‘I think the color is close to No. 1 to 3’ or ‘It was No. 4 to 7 but has become close to No. 1 to 3’ applies, it may be a disease such as biliary atresia, so see a pediatrician, pediatric surgeon, or similar doctor as soon as possible. Until about 4 months after birth, pay attention to the color of the stool. If the skin or the whites of the eyes are still yellow after 2 weeks of age, or if the urine is dark yellow, also consult a doctor right away.",
    },
  "迷う時は #8000。": { zh: "拿不准时，请拨打 #8000。", en: "If you're unsure, call #8000." },
  "話してくれてありがとう。ひとりで抱えなくていいです。今すぐ危ない時は110番。DV相談＋は24時間、電話で話せます（通話料はかかりません）。": {
    zh: "谢谢你说出来。你不必一个人承受。如果现在就有危险，请拨打110。家暴咨询＋（DV相談＋）24小时都可以打电话倾诉（不收通话费）。",
    en: "Thank you for telling me. You don't have to carry this alone. If you're in danger right now, call 110. DV Soudan Plus (DV相談＋) takes calls 24 hours a day (the call is free).",
  },
  "話してくれてありがとう。ひとりで抱えなくていいです。今すぐ、電話の相談先にかけてください。命が危ないと思ったら119。": {
    zh: "谢谢你说出来。你不必一个人承受。请现在就打电话给咨询窗口。如果觉得有生命危险，请拨打119。",
    en: "Thank you for telling me. You don't have to carry this alone. Please call one of the phone helplines now. If you think a life is in danger, call 119.",
  },
  // ボタンの札（画面が t() で引く）
  急ぎの時を開く: { zh: "打开紧急情况页面", en: "Open Emergency" },
  命が危ない時は119: { zh: "有生命危险时拨打119", en: "119 if a life is in danger" },
  "子どもの事で迷う時 #8000": { zh: "孩子的事拿不准时 #8000", en: "#8000 if you're unsure about your child" },
  "子どもの急な病気の相談 #8000": { zh: "孩子突发疾病咨询 #8000", en: "#8000 for sudden illness in children" },
  便色カードを開く: { zh: "打开大便颜色卡", en: "Open the stool color card" },
  "DV相談＋（24時間）": { zh: "家暴咨询＋（DV相談＋，24小时）", en: "DV Soudan Plus (DV相談＋, 24 hours)" },
  今すぐ危ない時は110: { zh: "现在就有危险时拨打110", en: "110 if you're in danger now" },
  こころの健康相談統一ダイヤル: { zh: "心理健康咨询统一热线（こころの健康相談統一ダイヤル）", en: "Mental health helpline (こころの健康相談統一ダイヤル)" },
  "よりそいホットライン（24時間）": { zh: "Yorisoi 热线（よりそいホットライン，24小时）", en: "Yorisoi Hotline (よりそいホットライン, 24 hours)" },
  "児童相談所 相談専用ダイヤル": { zh: "儿童咨询所咨询专线（児童相談所 相談専用ダイヤル）", en: "Child guidance center helpline (児童相談所 相談専用ダイヤル)" },

  // ── 画面の地図（lib/app-guide.ts の SCREENS。決まりの答え「この画面では何ができる？」が名前と最初の4行を出す） ──
  健診: { zh: "健康检查", en: "Checkups" },
  アルバム: { zh: "相册", en: "Album" },
  アカウント: { zh: "账户", en: "Account" },
  わが家の設定: { zh: "我家的设置", en: "Family settings" },
  "一番上に「次にやる事」が大きく出る。窓口・持ち物・書く事のメモは、手帳が先に用意して「いま、いちばん先の事」の箱に入れる。2つ目からは「ほかに今やる事」に1行ずつ": {
    zh: "最上面会大大地显示“接下来要做的事”。窗口、要带的东西和填写的备忘，手册会先准备好，放进“现在最先要做的事”的框里。第2件以后，会在“现在还要做的事”里一行一行列出",
    en: "The next thing to do shows up large at the top. The handbook prepares notes on where to go, what to bring, and what to fill in ahead of time, and puts them in the “First thing to do now” box. From the second item on, each gets one line under “Other things to do now”",
  },
  "やる事のカードの「どこへ行くか見る」で、住んでいる町の窓口・持ち物・期限を公式ページから取ってくる": {
    zh: "在待办卡片上点“看看去哪里”，会从官方网页取来你所在城市的窗口、要带的东西和期限",
    en: "Tap “See where to go” on a task card to pull your town's office, what to bring, and the deadline from official pages",
  },
  "やる事のカードの「下書きを作る」「記入メモを作る」などで、職場へのメール・役所の書類の記入メモを作る（宛先・件名・本文をコピーでき、メール・LINE で開ける。送るのは家族）": {
    zh: "在待办卡片上点“写草稿”“做填写备忘”等，可以写给工作单位的邮件、政府文件的填写备忘（收件人、主题、正文都能复制，也能用邮件或 LINE 打开。发送由家人自己来）",
    en: "Use “Write a draft”, “Make filling-in notes”, and similar buttons on a task card to make emails to your workplace and notes for filling in city office forms (you can copy the recipient, subject, and body, and open them in email or LINE. Your family does the sending)",
  },
  "済んだら「済んだ」を押す。間違えたら「済んだ事」を開いて「戻す」": {
    zh: "办完了就点“办完了”。点错了，就打开“已完成的事”，点“撤回”",
    en: "When something's done, tap “Done”. If you made a mistake, open “Done” and tap “Undo”",
  },
  "次の健診の日と時刻を入れる（予約の日）": { zh: "填写下次检查的日期和时间（预约的日子）", en: "Enter the date and time of your next checkup (the booked day)" },
  "「先生に聞きたい事」に書いておくと、健診の日の「今日聞く事」に並ぶ": {
    zh: "写在“想问医生的事”里，检查当天就会排在“今天要问的事”里",
    en: "Anything you write under “Questions for the doctor” is listed under “Today's questions” on the checkup day",
  },
  "健診の日は、着く → 受付・院内の道案内 → 診察の録音（先生の了承を取ってから）→ 帰り道にまとめを読む → 家族に送る、の順に1段ずつ出る": {
    zh: "检查当天，会按“到达 → 挂号和院内指引 → 诊察录音（先征得医生同意）→ 回家路上看总结 → 发给家人”的顺序，一步一步显示",
    en: "On checkup day, it shows one step at a time: arrive → reception and directions inside the hospital → record the exam (after the doctor agrees) → read the summary on the way home → send it to family",
  },
  "院内の案内図や受付票を撮ると、次から道案内を撮らずに出す": {
    zh: "拍下院内的指示图或挂号单，下次不用再拍，也能显示路线指引",
    en: "Photograph the hospital's floor map or reception slip once, and directions show next time without another photo",
  },
  "話す・撮る・打つ、楽な方で入れてよい（どれで入れても同じ手帳になる）": {
    zh: "说、拍、写，用哪种方便都可以（不管用哪种，都会记进同一本手册）",
    en: "Talk, snap, or type, whichever is easiest (it all goes into the same handbook)",
  },
  "大きな「話す」を押している間だけ録音（指を離すと送る）。話した事が日付つきの記録と予定になる": {
    zh: "只在按住大的“说”按钮时录音（松开手指就会发送）。说的内容会变成带日期的记录和日程",
    en: "Recording runs only while you hold the big “Talk” button (let go to send). What you say becomes dated records and plans",
  },
  "「撮る」で役所の通知・健診の結果の紙・母子手帳のページを撮ると、期限や記録を読み取る": {
    zh: "用“拍”拍下政府的通知、检查结果的纸、母子健康手册的页面，就会读取期限和记录",
    en: "Use “Snap” to photograph a city office notice, a checkup results sheet, or a page of the Maternal and Child Health Handbook, and it reads the deadlines and records",
  },
  "「打つ」で、健診の体重・血圧（生まれた後は子の体重・身長）・体温・ひとこと・予定と期限を、その場で打てる。週数などは先に入っている。打った物は AI を通さず、そのまま手帳に入る": {
    zh: "用“写”，可以当场输入检查时的体重、血压（出生后是孩子的体重和身高）、体温、一句话、日程和期限。孕周等已经先填好了。输入的内容不经过 AI，直接记进手册",
    en: "Use “Type” to enter checkup weight and blood pressure (after the birth, the child's weight and height), temperature, a short note, plans, and deadlines on the spot. Things like the week of pregnancy are already filled in. What you type goes straight into the handbook without passing through AI",
  },
  "紙の母子手帳と同じ並び（妊娠 → 出産 → 新生児 → 成長 → 接種 → つなぐ）。上の丸いボタンで部へ飛べる": {
    zh: "和纸质的母子健康手册顺序相同（妊娠 → 分娩 → 新生儿 → 成长 → 接种 → 衔接）。用上面的圆形按钮可以跳到各个部分",
    en: "Same order as the paper Maternal and Child Health Handbook (pregnancy → birth → newborn → growth → immunizations → handoff). The round buttons at the top jump to each part",
  },
  "一番上の「見てから OK してください」: 話した・撮った記録の候補。紙の手帳と見比べ、日付を確かめて「OK」で記録になる": {
    zh: "最上面的“请看过后再点 OK”：是说的、拍的记录的候选。和纸质手册对照，确认日期后点“OK”，就成为记录",
    en: "“Check, then tap OK” at the very top: candidate records from what you said or photographed. Compare with the paper handbook, check the date, and tap “OK” to make it a record",
  },
  "成長は発育曲線に点が打たれる。便色カードは国の7色から家族が番号を選ぶ": {
    zh: "成长会标在发育曲线上。大便颜色卡由家人从国家规定的7种颜色中选择编号",
    en: "Growth is plotted on the growth curve. On the stool color card, your family picks a number from the national 7 colors",
  },
  "予防接種の控え（接種日・ワクチン・ロット・医療機関）が並ぶ": {
    zh: "列出预防接种的记录（接种日期、疫苗、批号、医疗机构）",
    en: "Your immunization records (date, vaccine, lot number, clinic) are listed",
  },
  "1000日の記録と気持ちの記録が、ページをめくれる一冊になる（子どもへの贈り物）": {
    zh: "1000天的记录和心情的记录，会变成一本可以翻页的书（送给孩子的礼物）",
    en: "Your 1,000 days of records and feelings become a book you can page through (a gift for your child)",
  },
  "残した写真から、章ごとの写真と表紙をアプリが選ぶ（Claude に渡すのは写真の説明の文字だけ）": {
    zh: "应用会从保存的照片中，为每一章和封面挑选照片（交给 Claude 的只有照片的文字说明）",
    en: "From the photos you kept, the app picks photos for each chapter and the cover (only text descriptions of the photos go to Claude)",
  },
  "「印刷用（A5・PDF）」で、紙に刷れる形で開く": { zh: "用“打印用（A5、PDF）”，以可以印在纸上的形式打开", en: "“For printing (A5, PDF)” opens it in a form you can print on paper" },
  "残した写真が、一冊と同じ4つの時期・月ごとに並ぶ。各月の「この1枚」が大きく出る": {
    zh: "保存的照片会按和成长书相同的4个时期、按月排列。每个月的“这一张”会大大地显示",
    en: "Kept photos are arranged by month in the same 4 stages as the book. Each month's “This one” shows large",
  },
  "写真を開くと、★（この1枚にする）・一言・隠す・ゴミ箱へ、ができる。ゴミ箱は30日で消える": {
    zh: "打开照片后，可以★（设为“这一张”）、写一句话、隐藏、移到回收站。回收站里的照片30天后删除",
    en: "Open a photo to ★ (make it “This one”), add a note, hide it, or move it to the trash. The trash empties after 30 days",
  },
  "お七夜・お宮参り・お食い初めなどの節目は、撮った日から自動で結ぶ": {
    zh: "第七夜（お七夜）、初次参拜神社（お宮参り）、百日宴（お食い初め）等重要日子，会根据拍摄日期自动关联",
    en: "Milestones like Oshichiya (7th night), Omiyamairi (first shrine visit), and Okuizome (first meal) are linked automatically from the date taken",
  },
  "写真の位置の情報（GPS）は受け取った時に消している": { zh: "照片的位置信息（GPS）在收到时就已删除", en: "Location data (GPS) in photos is removed when we receive them" },
  "ログイン（メールに届く6桁のコード・パスキー）と、世帯を作る": {
    zh: "登录（用发到邮箱的6位验证码或通行密钥），以及创建家庭",
    en: "Sign in (with a 6-digit code sent by email, or a passkey) and create your household",
  },
  "記録を残す同意・米国の Claude に送る同意を、本人ごとに確かめ、撤回する": {
    zh: "每个人分别确认或撤回“同意保存记录”和“同意发送给美国的 Claude”",
    en: "Each person confirms or withdraws consent to keeping records and to sending data to Claude in the US",
  },
  "家族（パートナー・祖父母）を招く。見せる範囲を選べる": { zh: "邀请家人（伴侣、祖父母）。可以选择给他们看的范围", en: "Invite family (partner, grandparents). You can choose what they see" },
  "世帯の記録と写真をまとめて書き出す（zip）。本人の分・世帯の分を消す": {
    zh: "把家庭的记录和照片一起导出（zip）。删除个人的部分或整个家庭的部分",
    en: "Export the household's records and photos together (zip). Delete your own data or the whole household's",
  },
  "出産予定日・生まれた日・子の呼び名・住んでいる町（都道府県・市区町村）を入れる": {
    zh: "填写预产期、出生日期、孩子的称呼和所住的城市（都道府县、市区町村）",
    en: "Enter the due date, birth date, what you call your child, and your town (prefecture and city)",
  },
  "家族の形（働き方・育休・上の子・双子・里帰り）を問いに1つずつ答える。分からない所は空のままでよい": {
    zh: "一个一个回答关于家庭情况（工作方式、育儿休假、大孩子、双胞胎、回老家分娩）的问题。不知道的地方空着也可以",
    en: "Answer questions one at a time about your family's situation (work, childcare leave, older children, twins, going home to give birth). You can leave anything you don't know blank",
  },
  "この端末を使う人（ママ・パートナー）を選ぶ": { zh: "选择使用这台设备的人（妈妈、伴侣）", en: "Choose who uses this device (Mom or partner)" },
  "いつもの場所と人（通う病院と電話・職場と上司のメール・役所の窓口）を入れると、下書きや案内で自動で使う": {
    zh: "填入常用的地方和人（常去的医院和电话、工作单位和上司的邮箱、政府的窗口），写草稿和指引时会自动使用",
    en: "Enter your usual places and people (your hospital and its phone number, your workplace and your boss's email, the city office counter), and they're used automatically in drafts and guidance",
  },
  "命が危ないと思ったら、迷わず119。救急車を呼ぶか迷う時は、子どもは #8000、ママの体は産院": {
    zh: "如果觉得有生命危险，请毫不犹豫地拨打119。拿不准要不要叫救护车时，孩子的事打 #8000，妈妈的身体找分娩医院",
    en: "If you think a life is in danger, call 119 without hesitation. If you're not sure whether to call an ambulance: #8000 for your child, the maternity hospital for Mom's body",
  },
  "のどに物が詰まった時（窒息）・反応が無い時（心肺蘇生）の手当の順番": {
    zh: "喉咙卡住东西时（窒息）、没有反应时（心肺复苏）的急救步骤",
    en: "First-aid steps for when something is stuck in the throat (choking) or there's no response (CPR)",
  },
  "電波が無くても開ける": { zh: "没有信号也能打开", en: "Opens even without a signal" },
} satisfies Entries;
