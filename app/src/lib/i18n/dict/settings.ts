// 辞書: わが家の設定（app/settings/page.tsx）と、家族の状況の問い（components/settings/SituationForm.tsx）。書き方は lib/i18n/index.ts の頭
// 保存する値（役の「母」「パートナー」・働き方など）は日本語のまま残し、出す時だけ訳す。都道府県・市区町村の名前は日本語のまま。
// - ほかの辞書にある鍵は、そちらを使う（母・パートナー・ママ・あなたの番 は today.ts、生まれた日・パパ は memories.ts、出産予定日・都道府県・市区町村・いる・いない は start.ts、
//   呼び名 は techo.ts、子ども は album.ts、わが家 は core.ts、なぜ？ は now.ts、どこへ行くか見る は draft.ts）
// - 町は zh「市区町村」・en「town」、役所は zh「市区町村政府」・en「city office」、窓口は zh「窗口」・en「desk」、上の子は zh「大孩子」・en「older child」、
//   保育園は zh「保育园」・en「daycare」、作った家族は zh「虚构的家庭」・en「fictional family」（milestones.ts・shell.ts とそろえる）
// - 町の名前は日本語で入れてもらう（窓口の調べ・県の番号の表が日本語の名前で引く）。中文・English の例と説明には「日文で・in Japanese」を添える
// - 名前の例（そうた・はるくん）は、中文は中国語の呼び名、English はローマ字にする（draft.ts の欄の例と同じ考え）
import type { Entries } from "..";

export default {
  // ── わが家の設定の上と、保存の知らせ ──
  保存しました: { zh: "已保存", en: "Saved" },
  "まだ保存できていません。入れた事は画面に残っています（{reason}）": {
    zh: "还没能保存。填写的内容还留在页面上（{reason}）",
    en: "Not saved yet. What you entered is still on the screen ({reason})",
  },
  "保存しています…": { zh: "正在保存…", en: "Saving…" },
  "あなたは？": { zh: "你是哪一位？", en: "Which one are you?" },
  "わたしは{name}": { zh: "我是{name}", en: "I'm {name}" },
  いま見ている見本の家族の中から選びます: { zh: "从正在看的示例家庭的成员中选择", en: "Choose from the sample family you're viewing" },
  "体験版では、自分の家族の手帳はまだ作れません（作った家族の写しを触れます）。": {
    zh: "体验版还不能创建自己家的手册（可以试用虚构家庭的副本）。",
    en: "In the trial, you can't make your own family's handbook yet (you can try a copy of a fictional family).",
  },
  "いま見ているのは見本の家族です。": { zh: "现在看的是示例家庭。", en: "You're viewing the sample family." },
  自分の手帳を作る: { zh: "创建自己的手册", en: "Make your own handbook" },
  メールに届く6桁の数字で入ります: { zh: "用发到邮箱的6位数字登录", en: "Sign in with a 6-digit code sent to your email" },
  いま見ているのは見本の家族: { zh: "现在看的是示例家庭", en: "Viewing the sample family" },
  うちの手帳を作る: { zh: "创建我家的手册", en: "Make your family's handbook" },
  "作ると、わが家の手帳が始まります": { zh: "创建后，我家的手册就开始了", en: "Once it's made, your family's handbook begins" },
  "わが家の予定日・町・家族を入れる": { zh: "填写我家的预产期、所在市区町村和家人", en: "Enter your family's due date, town, and members" },
  "わが家に切り替えると、わが家の分が出ます": { zh: "切换到“我家”，就会显示我家的内容", en: "Switch to “Our family” to see your family's information" },
  "入れると、わが家の手帳が始まります": { zh: "填写后，我家的手册就开始了", en: "Once you enter it, your family's handbook begins" },
  わが家に切り替えて入れる: { zh: "切换到“我家”并填写", en: "Switch to “Our family” and enter" },

  // ── 1 いつ生まれる・生まれた日と呼び名 ──
  "いつ生まれる予定？": { zh: "预计什么时候出生？", en: "When is the baby due?" },
  生まれた日と呼び名: { zh: "出生日期和称呼", en: "Birth date and nickname" },
  生まれる前の事: { zh: "出生前的事", en: "Before the birth" },
  おなかの赤ちゃんの呼び名: { zh: "肚子里宝宝的称呼", en: "Nickname for the baby on the way" },
  "生まれたら、生まれた日もここで入れます": { zh: "出生后，出生日期也在这里填写", en: "After the birth, enter the birth date here too" },
  赤ちゃんの呼び名: { zh: "宝宝的称呼", en: "Baby's nickname" },
  "例: そうた": { zh: "例：乐乐", en: "e.g. Sota" },
  おなかの子: { zh: "肚子里的宝宝", en: "Baby on the way" },

  // ── 2 住んでいる町（町の名前の例「奈良県」「上牧町」は日本語のまま＝画面の「訳さない」の注） ──
  "住んでいる町は？": { zh: "住在哪个市区町村？", en: "Which city or town do you live in?" },
  "町の制度を、その町の物で調べます": {
    zh: "会按所在市区町村自己的制度来查（地名请用日文填写）",
    en: "We look up your own town's programs (enter the names in Japanese)",
  },
  "引っ越した日（転入届などの期限を、この日から数えます）": {
    zh: "搬家的日期：迁入申报（転入届）等手续的期限，从这一天开始算",
    en: "Moving date: deadlines for the moving-in notification (転入届) and other paperwork count from this day",
  },
  引っ越した日: { zh: "搬家的日期", en: "Moving date" },
  "町の名前を直しただけ（引っ越していない）": { zh: "只是改了地名（没有搬家）", en: "I only corrected the town name (didn't move)" },

  // ── 3 家族 ──
  "家族は？": { zh: "家里有谁？", en: "Who's in your family?" },
  "{child}から見た呼び名（任意・手紙と一冊で）": {
    zh: "{child}怎么称呼这个人（选填，用在信和成长书里）",
    en: "What {child} calls this person (optional; used in letters and the book)",
  },
  "例: ママ・パパ・かあちゃん": { zh: "例：妈妈、爸爸、妈咪", en: "e.g. Mom, Dad, Mama" },
  家族を足す: { zh: "添加家人", en: "Add a family member" },

  // ── 4 家族の形と保存 ──
  "家族の形は？": { zh: "家庭情况是怎样的？", en: "What's your family's situation?" },
  "答えると、うちに関係ない予定を出さなくなります。わからない所は、そのままで大丈夫です": {
    zh: "回答后，就不会显示和你家无关的日程。不知道的地方，空着也没关系",
    en: "Once you answer, plans that don't apply to your family won't be shown. It's fine to leave anything you don't know as it is",
  },
  // 役の名前は、アカウントの画面の札（account.ts の 持ち主＝所有者／Owner・共同の管理＝共同管理者／Co-manager・読むだけ＝只能查看／View only）と同じ言葉に
  "読むだけの役なので、家族の形は見るだけです。直すのはうちの手帳の持ち主・共同の管理の人です": {
    zh: "你的角色是“只能查看”，所以家庭情况只能查看。可以修改的是这本手册的所有者和共同管理者",
    en: "Your role is “View only”, so you can only view the family's situation. The handbook's owner or a co-manager can change it",
  },
  "作った家族（シミュレーション）の家族の形は、ここでは見るだけです。保存は「わが家」だけできます": {
    zh: "虚构的家庭（模拟）的家庭情况，在这里只能查看。只有“我家”可以保存",
    en: "A fictional family's (simulation) situation can only be viewed here. Only “Our family” can be saved",
  },
  "生まれた日・町・家族の形を保存する": { zh: "保存出生日期、所在市区町村和家庭情况", en: "Save the birth date, town, and family situation" },
  "予定日・町・家族の形を保存する": { zh: "保存预产期、所在市区町村和家庭情况", en: "Save the due date, town, and family situation" },
  "保存すると「いつもの場所と人」を入れられます": { zh: "保存后，就能填写“常用的地方和人”", en: "Once saved, you can enter “Usual places and people”" },

  // ── アカウントと同意（くわしくはアカウントの画面）・入れた事はどこに？ ──
  アカウントと同意: { zh: "账户和同意", en: "Account and consent" },
  "同意の確かめと撤回・家族を招く・書き出す・消すは、ここから": {
    zh: "确认或撤回同意、邀请家人、导出、删除，都从这里进入",
    en: "Check or withdraw consent, invite family, export, and delete from here",
  },
  "ログインすると、うちの手帳・同意・家族の招待が使えます": {
    zh: "登录后，就能使用我家的手册、同意和邀请家人",
    en: "Sign in to use your family's handbook, consent, and family invitations",
  },
  アカウントの画面へ: { zh: "前往账户页面", en: "Go to account" },
  "ログイン・アカウントを作る": { zh: "登录／创建账户", en: "Sign in / Create an account" },
  "入れた事はどこに？": { zh: "填写的内容存在哪里？", en: "Where is what you enter kept?" },
  "うちの手帳の中だけに置きます。氏名・住所の番地は入れなくて大丈夫です。": {
    zh: "只保存在我家的手册里。不用填写姓名和住址的门牌号。",
    en: "It's kept only in your family's handbook. You don't need to enter full names or street addresses.",
  },
  "この機械の中だけに置きます。氏名・住所の番地は入れなくて大丈夫です。": {
    zh: "只保存在这台机器里。不用填写姓名和住址的门牌号。",
    en: "It's kept only on this machine. You don't need to enter full names or street addresses.",
  },

  // ── 5 いつもの場所と人（KeepForm）。病院・会社・窓口の名前は家族が入れたまま ──
  いつもの場所と人: { zh: "常用的地方和人", en: "Usual places and people" },
  "一度入れると、次から自動で使います": { zh: "填一次，以后就会自动使用", en: "Enter it once, and it's used automatically from then on" },
  通う病院: { zh: "常去的医院", en: "Your hospital" },
  病院の名前: { zh: "医院名称", en: "Hospital name" },
  病院の電話: { zh: "医院电话", en: "Hospital phone" },
  電話: { zh: "电话", en: "Phone" },
  かける: { zh: "拨打", en: "Call" },
  "病院の中の案内: {date}に撮った物があります": { zh: "医院内的指引：已有{date}拍的照片", en: "Directions inside the hospital: photo taken {date}" },
  次の健診で撮り直せます: { zh: "下次健康检查时可以重拍", en: "You can retake it at the next checkup" },
  "健診の日に病院の中の案内を撮っておくと、次から迷わずに行けます": {
    zh: "在健康检查那天拍下医院内的指引，下次就不会迷路了",
    en: "Take photos of the directions inside the hospital on checkup day, and you won't get lost next time",
  },
  "{who}の職場": { zh: "{who}的工作单位", en: "{who}'s workplace" },
  "職場の欄が1つだった時に入れた職場は、{who}の職場として読んでいます。{other}の職場だった時は、ここで直してください": {
    zh: "以前只有一个工作单位栏时填写的工作单位，现在当作{who}的工作单位。如果那是{other}的工作单位，请在这里修改",
    en: "A workplace entered back when there was only one workplace field is now read as {who}'s. If it was {other}'s, please fix it here",
  },
  ほかの人: { zh: "其他人", en: "someone else" },
  "{who}の会社名": { zh: "{who}的公司名称", en: "{who}'s company name" },
  会社名: { zh: "公司名称", en: "Company name" },
  "職場に伝える時に使う欄（あとででよい）": { zh: "告诉工作单位时用的栏（以后再填也可以）", en: "Fields for telling your workplace (can wait)" },
  "{who}の上司の名前": { zh: "{who}的上司姓名", en: "{who}'s manager's name" },
  上司の名前: { zh: "上司姓名", en: "Manager's name" },
  "{who}の上司のメール": { zh: "{who}的上司邮箱", en: "{who}'s manager's email" },
  上司のメール: { zh: "上司邮箱", en: "Manager's email" },
  役所の窓口: { zh: "市区町村政府的窗口", en: "City office desk" },
  "前の町（{town}）の窓口です。下書きと予定の場所には使いません。新しい町の窓口に直すか、手続きの「どこへ行くか見る」で覚え直します": {
    zh: "这是之前所在市区町村（{town}）的窗口，不会用作草稿和日程的地点。请改成新市区町村的窗口，或者在手续里点“看看去哪里”重新记住",
    en: "This is the desk in your previous town ({town}). It won't be used for drafts or event locations. Change it to your new town's desk, or tap “See where to go” on a task to save it again",
  },
  窓口の名前: { zh: "窗口名称", en: "Desk name" },
  "例: 町役場 こども課": { zh: "例：町政府 儿童科", en: "e.g. Town hall, Children's Division" },
  窓口の場所: { zh: "窗口地点", en: "Desk location" },
  "場所（カレンダーに入れるため）": { zh: "地点（用于加入日历）", en: "Location (for your calendar)" },
  場所と人を保存する: { zh: "保存地方和人", en: "Save places and people" },
  // 【会社名】【上司の名前】は、日本語で作る下書きの欄の名前（draft.ts の頭）なので、括弧で並べる
  "職場あての下書きの【会社名】【上司の名前】が、書く人の職場で最初から埋まります（パートナーの育休の申し出は、パートナーの職場で）。": {
    zh: "写给工作单位的草稿里的公司名和上司姓名（【会社名】【上司の名前】），会一开始就用写的人的工作单位填好（伴侣申请育儿休假时，用伴侣的工作单位）。",
    en: "In drafts to a workplace, the company name and manager's name (【会社名】【上司の名前】) are filled in from the writer's workplace from the start (for the partner's childcare leave request, from the partner's workplace).",
  },
  "役所の窓口と病院は、予定をカレンダーに入れる時の場所に入ります。": {
    zh: "市区町村政府的窗口和医院，会在把日程加入日历时作为地点填入。",
    en: "The city office desk and hospital are used as the location when you add events to your calendar.",
  },
  "欄を空にして「場所と人を保存する」を押すと、その事は消えます。": {
    zh: "把栏清空后点“保存地方和人”，那一项就会删除。",
    en: "Empty a field and tap “Save places and people” to remove it.",
  },

  // ── 家族の形の問い（SituationForm）。選びの言葉は保存する値（lib/situation.ts）で、出す時だけ訳す ──
  "わからない・答えない": { zh: "不知道／不回答", en: "Not sure / Skip" },
  "ママの働き方（妊娠中）": { zh: "妈妈的工作方式（怀孕期间）", en: "Mom's work (during pregnancy)" },
  "会社員・公務員": { zh: "公司职员／公务员", en: "Employee / public servant" },
  "パート・派遣": { zh: "兼职／派遣", en: "Part-time / temp" },
  "自営・フリー": { zh: "个体经营／自由职业", en: "Self-employed / freelance" },
  仕事なし: { zh: "没有工作", en: "Not working" },
  出産で辞める: { zh: "因生孩子辞职", en: "Quitting for the birth" },
  "ママが仕事に戻りたい時期（保育園の申し込みの時期が決まります）": {
    zh: "妈妈想回去工作的时间（这会决定申请保育园的时间）",
    en: "When Mom wants to go back to work (this decides when to apply for daycare)",
  },
  "1歳になるまでに": { zh: "1岁之前", en: "Before age 1" },
  "1歳を過ぎてから": { zh: "1岁以后", en: "After age 1" },
  "育休は原則1歳まで。1歳を過ぎてからは、保育園に入れなかった時に延ばせます（育児・介護休業法）": {
    zh: "育儿休假原则上到孩子1岁为止。1岁以后，如果进不了保育园，可以延长（《育儿·护理休假法》（育児・介護休業法））",
    en: "Childcare leave lasts until the child turns 1, as a rule. After that, it can be extended if you can't get a daycare spot (Child Care and Family Care Leave Act, 育児・介護休業法)",
  },
  パートナーの働き方: { zh: "伴侣的工作方式", en: "Partner's work" },
  パートナーの育休: { zh: "伴侣的育儿休假", en: "Partner's childcare leave" },
  // パートナーの育休を取るか（LEAVES）
  取る: { zh: "会休", en: "Taking it" },
  取らない: { zh: "不休", en: "Not taking it" },
  未定: { zh: "还没定", en: "Undecided" },
  "パートナーの育休の長さ（生まれて8週の間に）": {
    zh: "伴侣育儿休假的长度（出生后8周内）",
    en: "Length of the partner's childcare leave (within 8 weeks of the birth)",
  },
  "14日未満": { zh: "不到14天", en: "Under 14 days" },
  "2週間〜1か月": { zh: "2周到1个月", en: "2 weeks to 1 month" },
  "1か月以上": { zh: "1个月以上", en: "1 month or more" },
  "14日以上だと、2025年4月からの給付の上乗せの条件の1つに届きます（雇用保険法）": {
    zh: "休14天以上，就满足2025年4月起补贴加发的条件之一（《雇用保险法》（雇用保険法））",
    en: "14 days or more meets one of the conditions for the extra benefit that started in April 2025 (Employment Insurance Act, 雇用保険法)",
  },
  "一緒に育てる人を「家族は？」で足すと、その人の働き方も聞きます": {
    zh: "在“家里有谁？”里添加一起养育孩子的人，也会问那个人的工作方式",
    en: "Add the person raising the child with you under “Who's in your family?”, and we'll ask about their work too",
  },
  "ママかパートナーは公務員？（公務員だと、児童手当の申し込み先が町ではなく職場になります）": {
    zh: "妈妈或伴侣是公务员吗？如果是公务员，儿童补贴（児童手当）就不是向市区町村申请，而是向工作单位申请",
    en: "Is Mom or the partner a public servant? If so, the child allowance (児童手当) is applied for at the workplace, not the city",
  },
  はい: { zh: "是", en: "Yes" },
  いいえ: { zh: "不是", en: "No" },
  "赤ちゃんの保険証は、どれになりそう？": { zh: "宝宝的健康保险证可能会是哪一种？", en: "Which health insurance card will the baby likely get?" },
  親の勤め先の保険: { zh: "父母工作单位的保险", en: "Insurance through a parent's employer" },
  "国民健康保険（町の保険）": { zh: "国民健康保险（市区町村的保险）", en: "National Health Insurance (the city's plan)" },
  "上の子は？": { zh: "有大孩子吗？", en: "Any older children?" },
  "生まれる前の事（妊娠中の働き方・生まれた子の数・里帰り）": {
    zh: "出生前的事（怀孕期间的工作方式、生了几个孩子、回乡分娩）",
    en: "Before the birth (work during pregnancy, number of babies, going home to give birth)",
  },
  // 生まれる前の問い（生まれる子の数・里帰り出産）
  "生まれる子は何人？": { zh: "会生几个孩子？", en: "How many babies?" },
  "1人": { zh: "1个", en: "One" },
  双子: { zh: "双胞胎", en: "Twins" },
  三つ子: { zh: "三胞胎", en: "Triplets" },
  "里帰り出産は？": { zh: "要回乡分娩吗？", en: "Giving birth in your hometown?" },
  // 里帰り出産をするか（「要回乡分娩吗？」に答える形）
  する: { zh: "要", en: "Yes" },
  しない: { zh: "不要", en: "No" },
  "里帰り先の町（実家のある所）": { zh: "回乡分娩地（老家所在的市区町村）", en: "Your hometown (where your family home is)" },
  里帰り先の都道府県: { zh: "回乡分娩地的都道府县", en: "Prefecture of your hometown" },
  里帰り先の市区町村: { zh: "回乡分娩地的市区町村", en: "City or town of your hometown" },
  // 入力の欄が狭いので短く（中文の括弧は半角）
  "例: 鹿児島県": { zh: "用日文(鹿児島県)", en: "In Japanese (鹿児島県)" },
  "例: 霧島市": { zh: "用日文(霧島市)", en: "In Japanese (霧島市)" },
  "里帰り先の町の赤ちゃん訪問・受診券の扱い・出生届を出せる所を、その町のページで調べます": {
    zh: "会在回乡分娩地的市区町村官网上，查询新生儿访问、检查券的用法，以及可以提交出生登记（出生届）的地方",
    en: "We look up, on that town's official website, the newborn home visit, how checkup vouchers work, and where you can submit the birth registration (出生届)",
  },
  住む町に戻る時期: { zh: "回到居住地的时间", en: "When you'll return to your town" },
  // 戻る時期（SATOGAERI_BACKS。basis.ts の根拠の文の訳とそろえる）
  "1か月健診のあと": { zh: "满月儿健康检查之后", en: "After the one-month checkup" },
  産後2か月ごろ: { zh: "产后2个月左右", en: "Around 2 months after the birth" },
  それより長く: { zh: "比这更久", en: "Longer than that" },

  // ── 赤ちゃんの事で伝えたい事（静かにする。now.ts と同じく、言い換えずに） ──
  "赤ちゃんの事で、伝えたい事がある時": { zh: "关于宝宝，有想告诉我们的事时", en: "If there's something you want us to know about the baby" },
  "選ぶと、今日の画面の日数・週数・お知らせを止めて、静かにします。手帳の記録は消えません。いつでもここで戻せます。": {
    zh: "选择后，“今天”页面的天数、周数和通知都会停下来，变得安静。手册里的记录不会消失。随时可以在这里恢复。",
    en: "If you choose one, the Today screen's day and week counts and notifications stop, and things go quiet. Your handbook records won't be deleted. You can switch back here anytime.",
  },
  赤ちゃんが入院している: { zh: "宝宝正在住院", en: "The baby is in the hospital" },
  つらい別れがあった: { zh: "经历了痛苦的离别", en: "We've had a painful loss" },
  いつもの画面に戻す: { zh: "恢复平常的页面", en: "Back to the usual screen" },

  // ── 上の子（OlderKids） ──
  "上の子の生まれた日を入れると、上の子の健診・予防接種も「いま」に一緒に出します。園に通っていれば、育休中も通い続けられるかの確かめも出します。": {
    zh: "填写大孩子的出生日期后，大孩子的健康检查和预防接种也会一起显示在“今天”里。如果大孩子在上保育园或幼儿园，还会提醒你确认育儿休假期间能否继续上园。",
    en: "Enter your older child's birth date, and their checkups and immunizations will also show up in “Today”. If they go to daycare or kindergarten, we'll also remind you to check whether they can keep going during your childcare leave.",
  },
  上の子: { zh: "大孩子", en: "Older child" },
  "上の子 {n}人目": { zh: "第{n}个大孩子", en: "Older child {n}" },
  "（年と月）": { zh: "（年和月）", en: " (year and month)" },
  "年と月だけで答える（日は1日として数えます）": { zh: "只填年和月（日按1号算）", en: "Answer with just the year and month (counted as the 1st)" },
  "呼び名（なくても大丈夫）": { zh: "称呼（不填也没关系）", en: "Nickname (optional)" },
  "例: はるくん": { zh: "例：豆豆", en: "e.g. Haru" },
  // 日中は ［保育園・幼稚園・家・小学校］（OLDER_CARES）
  日中は: { zh: "白天在", en: "During the day" },
  保育園: { zh: "保育园", en: "Daycare" },
  幼稚園: { zh: "幼儿园", en: "Kindergarten" },
  家: { zh: "家里", en: "At home" },
  小学校: { zh: "小学", en: "Elementary school" },
  この子を外す: { zh: "移除这个孩子", en: "Remove this child" },
  上の子をもう1人足す: { zh: "再添加一个大孩子", en: "Add another older child" },
  上の子の生まれた日を入れる: { zh: "填写大孩子的出生日期", en: "Enter an older child's birth date" },
} satisfies Entries;
