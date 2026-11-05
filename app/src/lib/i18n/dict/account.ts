// 辞書: アカウント（app/account/page.tsx）・ログイン（app/login/）・招待（app/invite/）・同意の画面（components/settings/ConsentScreen.tsx・consent-texts.ts・account-ui.tsx）。
// 書き方は lib/i18n/index.ts の頭。同意の文は日本語が正本（consent-texts.ts の版）。訳は言い換えず、約束を足しも減らしもしない。
// - 重ならないよう、ほかの辞書の言葉を使う所: 母・ママ・パートナー（today.ts）・わが家・（{x}）・「{text}」（core.ts）・あなた・消す（album.ts）・メール（draft.ts）・LINE で送る（now.ts）・記録しています…（ask.ts）・消しています…・呼び名（techo.ts）・確かめています…（emergency.ts）・
//   手帳を開く・ママ（母）・{date}まで（start.ts）・アカウント（answers.ts）・妊娠{w}週（techo.ts）・アカウントと同意・アカウントの画面へ・ログイン・アカウントを作る・
//   入れた事はどこに？・あなたは？・赤ちゃんの呼び名・おなかの子（settings.ts）
// - 法律の名: 個人情報保護法は公の英語名（Act on the Protection of Personal Information）。中文は公の名が無いので日本語を括弧で添える。
//   要配慮個人情報は公の英語名（special care-required personal information）。個人情報保護委員会の調査の題は公の訳が無いので、日本語の題を括弧で添える
// - 画面の札の名前は、ほかの辞書にそろえる（話す・撮る → 说·拍／Talk · Snap、一冊 → 成长书／Book、手帳に聞く → 问手册／Ask the handbook、読み取る → 读取／Read）
import type { Entries } from "..";

export default {
  // ── 共通の部品（components/settings/account-ui.tsx） ──
  // ログインの失敗（authMessage。Better Auth の英語の文はそのまま出さない）
  "コードが違います。メールのコードをもう一度確かめてください": { zh: "验证码不对。请再确认一下邮件里的验证码", en: "That code isn't right. Please check the code in your email again" },
  "コードの期限（5分）が切れました。もう一度コードを送ってください": {
    zh: "验证码已过期（有效期5分钟）。请重新发送验证码",
    en: "The code has expired (it lasts 5 minutes). Please send a new code",
  },
  "3回まちがえたので、このコードは使えなくなりました。もう一度コードを送ってください": {
    zh: "已经输错3次，这个验证码不能再用了。请重新发送验证码",
    en: "The code was entered wrong 3 times, so it can't be used anymore. Please send a new code",
  },
  メールの形が違います: { zh: "邮箱地址的格式不对", en: "That email address doesn't look right" },
  "続けて押されたので、少し待ってからもう一度押してください": { zh: "点得太频繁了，请稍等一下再点", en: "Too many tries in a row. Please wait a little and tap again" },
  "このサーバでは、アカウントの仕組みをまだ動かしていません": { zh: "这个服务器还没有启用账户功能", en: "Accounts aren't turned on for this server yet" },
  // 本人と役の言葉（SUBJECT_WORD・ROLE_WORD。保存する値は日本語のまま、出す所で訳す。母・パートナーは today.ts）
  子: { zh: "孩子", en: "Child" },
  持ち主: { zh: "所有者", en: "Owner" },
  共同の管理: { zh: "共同管理者", en: "Co-manager" },
  読むだけ: { zh: "只能查看", en: "View only" },
  "作った家族（ログインなし）": { zh: "虚构的家庭（未登录）", en: "Fictional family (not signed in)" },

  // ── 同意の画面の共通部分（components/settings/ConsentScreen.tsx） ──
  "{who}・あなた": { zh: "{who}·你", en: "{who} · you" },
  "同意しました。アカウントの画面から、いつでも撤回できます": { zh: "已同意。随时可以在账户页面撤回", en: "You've agreed. You can withdraw at any time from the account screen" },
  "同意: {name}": { zh: "同意：{name}", en: "Consent: {name}" },
  だれの分に同意しますか: { zh: "为谁同意？", en: "Who are you agreeing for?" },
  "同意済み（{date}）": { zh: "已同意（{date}）", en: "Agreed ({date})" },
  // 子の分を誰が押すか（lib/consent-screen.ts の childConsentLine が返す4つの文）
  "子の分は、親のあなたが代わりに同意します": { zh: "孩子的部分，由作为父母的你代为同意", en: "As the parent, you agree on behalf of the child" },
  "おなかの子の分は、親のあなたが代わりに同意します": { zh: "肚子里的宝宝的部分，由作为父母的你代为同意", en: "As the parent, you agree on behalf of the baby on the way" },
  "子の分は、世帯の持ち主・共同の管理の人が代わりに同意します": {
    zh: "孩子的部分，由家庭的所有者或共同管理者代为同意",
    en: "The household's owner or a co-manager agrees on behalf of the child",
  },
  "おなかの子の分は、世帯の持ち主・共同の管理の人が代わりに同意します": {
    zh: "肚子里的宝宝的部分，由家庭的所有者或共同管理者代为同意",
    en: "The household's owner or a co-manager agrees on behalf of the baby on the way",
  },
  "本人にこの画面を見せて、本人が決めてから押してください": { zh: "请把这个页面给本人看，由本人决定后再点", en: "Please show this screen to the person and let them decide before you tap" },
  "ママが手帳に入った時に、ママ本人が押します": { zh: "妈妈加入手册后，由妈妈本人来点", en: "Mom taps this herself when she joins the handbook" },
  本人がログインして押します: { zh: "由本人登录后来点", en: "The person signs in and taps this themselves" },
  "{who}の分は、本人（子は管理の人）が押すまで、手帳の上に同意の案内が出ます。同意のない本人の記録を、サーバの側で止める仕組みは準備中です。": {
    zh: "{who}：在本人（孩子则由管理的人）点同意之前，手册上方会显示同意的提示。在服务器一侧停止保存未同意者记录的功能还在准备中。",
    en: "For {who}, a notice about consent appears at the top of the handbook until each person (or, for a child, a household manager) agrees. A way for the server to stop keeping the records of people who haven't agreed is still in preparation.",
  },
  "読んだうえで、同意する": { zh: "已阅读，同意", en: "I've read this and agree" },
  "押せる本人の分は、もう同意しています。": { zh: "你能点的人都已经同意了。", en: "Everyone you can agree for has already agreed." },
  "同意しない（アカウントの画面へ）": { zh: "不同意（去账户页面）", en: "Don't agree (go to the account screen)" },
  // 中文・English の画面だけ、同意の文のすぐ下に出す（統括 2026-11-05。日本語の画面には出さない）
  "日本語の文が正本です。この訳は参考です。": { zh: "以日文原文为准，本译文仅供参考。", en: "The Japanese text is the official version. This translation is provided for reference." },

  // ── 同意の文（components/settings/consent-texts.ts。版は CONSENT_VERSION。日本語の文が変わると鍵が外れ、日本語のまま出る＝訳も同じ時に直す） ──
  記録を残す: { zh: "保存记录", en: "Keep records" },
  "米国の Claude に送る": { zh: "发送给美国的 Claude", en: "Send to Claude in the US" },
  家族に見せる: { zh: "给家人看", en: "Show to family" },
  // はじめの「記録を残す同意」の使い方の要点（RECORD_PURPOSES）
  "妊娠から子が3歳になるまでの健診・手続き・成長の記録を、この世帯の中に残します": {
    zh: "从怀孕到孩子满3岁为止的健康检查、手续和成长的记录，保存在这个家庭里",
    en: "Records of checkups, paperwork, and growth, from pregnancy until the child turns 3, are kept within this household",
  },
  "記録から、次にやる手続きや健診の予定を出します": {
    zh: "根据记录，显示接下来要办的手续和健康检查的日程",
    en: "The records are used to show the paperwork to do next and the checkup schedule",
  },
  "写真・録音のファイルは、世帯ごとの鍵で暗号にしてから置きます": {
    zh: "照片和录音文件，会先用每个家庭各自的密钥加密，然后再保存",
    en: "Photo and audio files are encrypted with a separate key for each household before they are stored",
  },
  "世帯に招いた家族も、記録を見られます（招いた祖父母などには、手帳のママの頁と健診の記録を見せません。ただし今は、話した記録や一冊などには母の記録も入ります。見せる範囲を選ぶ仕組みは準備中です）": {
    zh: "邀请加入这个家庭的家人也能看到记录（不会给受邀的祖父母等看手册里妈妈的页面和健康检查的记录。不过目前，说话留下的记录和成长书等里面也包含妈妈的记录。选择给对方看哪些内容的功能还在准备中）",
    en: "Family members invited to the household can also see the records (invited grandparents and others aren't shown Mom's pages in the handbook or the checkup records. For now, though, things like records made by talking and the Book also include the mother's records. A way to choose what to show is still in preparation)",
  },
  "体の判断はしません。気になる事は、産院・小児科・#8000 につなぎます": {
    zh: "手册不对身体状况做判断。有担心的事，会引导你联系产科医院、儿科或儿童医疗咨询热线（#8000）",
    en: "The handbook doesn't make judgments about your body. For anything that worries you, it connects you with your maternity clinic, a pediatrician, or the Children's Medical Hotline (#8000)",
  },
  // 記録の同意で正直に書く、今できていない事（RECORD_HONEST）
  "暗号にしているのは写真・録音のファイルだけです。記録の文字（健診の結果など）は、まだ暗号にしていません": {
    zh: "加密的只有照片和录音文件。记录的文字（健康检查的结果等）还没有加密",
    en: "Only photo and audio files are encrypted. The text of records (such as checkup results) is not encrypted yet",
  },
  "いつでも、アカウントの画面から書き出し・撤回・消すができます": {
    zh: "随时可以在账户页面导出、撤回或删除",
    en: "You can export, withdraw, or delete at any time from the account screen",
  },
  // 米国の Claude に送る同意（CLAUDE_US。規則17条2項の3つ＝国の名前・制度の要約・相手の措置）
  "アメリカ合衆国（米国）": { zh: "美利坚合众国（美国）", en: "United States of America (US)" },
  "Anthropic, PBC（Claude を作っている会社）": { zh: "Anthropic, PBC（开发 Claude 的公司）", en: "Anthropic, PBC (the company that makes Claude)" },
  "どの仕事でも: 家族の名前（手帳に入れた呼び名）・予定日と生まれた日・住む町": {
    zh: "所有功能：家人的名字（在手册里填写的称呼）、预产期和出生日期、居住的城市",
    en: "Every task: family members' names (the names entered in the handbook), the due date and birth date, and the town you live in",
  },
  "話す・撮る: 話した事・書いた事の文字と、撮った紙・手帳のページの写真（「読み取る」を選んだ1枚。手帳の欄に分けるため。声そのものは送りません）": {
    zh: "说·拍：说过的话和写下的内容的文字，以及拍下的纸张和手册页面的照片（选择“读取”的那一张。用于分到手册的各栏里。声音本身不会发送）",
    en: "Talk · Snap: the text of what you said or wrote, and photos of papers or handbook pages (the one photo you chose to “Read”, to sort it into the handbook's sections. Your voice itself is not sent)",
  },
  "健診: 録音の書き起こしの文字（まとめて、手帳に入れる候補を作るため。文字にするのは手帳の機械で、声そのものは送りません）と、案内図・受付票の写真（その日に回る順を作るため）": {
    zh: "健康检查：录音转写出的文字（用于整理，并生成要写进手册的候选内容。转成文字的是手册自己的机器，声音本身不会发送），以及院内指引图和挂号单的照片（用于安排当天要去的顺序）",
    en: "Checkups: the transcribed text of recordings (to summarize it and suggest what to add to the handbook. The handbook's own machine turns speech into text, and your voice itself is not sent), and photos of hospital maps and reception slips (to plan the order of where to go that day)",
  },
  "手帳に聞く: 問いと30日分の会話、最近の記録（12件まで）、手帳のページの新しい記録（健診の値など、ページごとに3件まで）、予定と次の健診": {
    zh: "问手册：问题和30天内的对话、最近的记录（最多12条）、手册各页的新记录（健康检查的数值等，每页最多3条）、日程和下一次健康检查",
    en: "Ask the handbook: your question and the last 30 days of conversation, recent records (up to 12), new records on the handbook pages (such as checkup measurements, up to 3 per page), and the schedule and next checkup",
  },
  "手帳に聞く・下書き・気づきでは、ほかに: 手紙に書く名前・家族の形（働き方・上の子など）・覚えておいた病院（名前と電話）と職場（会社名・部署・上司・人事）": {
    zh: "问手册、草稿和手册注意到的事，另外还有：写在信里的名字、家庭情况（工作方式、大孩子等）、记下的医院（名称和电话）和工作单位（公司名称、部门、上司、人事）",
    en: "For Ask the handbook, drafts, and the handbook's notices, also: names to put in letters, your family's situation (such as work and older children), and the hospital (name and phone) and workplace (company name, department, manager, HR) the handbook remembers",
  },
  "一冊: 記録の文字・写真の日付と一言・声の題と最初の一文の文字（写真と声そのものは送りません）": {
    zh: "成长书：记录的文字、照片的日期和一句话说明、声音的标题和第一句话的文字（照片和声音本身不会发送）",
    en: "Book: the text of records, photo dates and captions, and the titles and first sentences of voice recordings as text (photos and voices themselves are not sent)",
  },
  "アルバムの写真は、本人が「この1枚を見せる」と選んだ時だけ、その1枚を送ります（位置の情報を消してから）": {
    zh: "相册里的照片，只在本人选择“展示这一张”时，才发送那一张（先删除位置信息）",
    en: "An album photo is sent only when the person chooses “Show this one”, and only that photo (after its location data is removed)",
  },
  "手帳が覚えていない物（住所の番地・マイナンバー・保険証の番号）は、手帳からは送りません。ただし、話した事・撮った紙に書いてあれば、その文字や写真はそのまま送ります": {
    zh: "手册没有记住的东西（住址的门牌号、个人编号、保险证的号码），不会从手册发送。但是，如果说的话或拍下的纸上写着这些，那些文字和照片会原样发送",
    en: "Things the handbook doesn't keep (the street number in your address, your My Number, insurance card numbers) are not sent from the handbook. However, if they are in what you say or on a paper you photograph, that text or photo is sent as it is",
  },
  "米国には、日本の個人情報保護法のような、全体をまとめた連邦の法律はありません": {
    zh: "美国没有像日本《个人信息保护法》（個人情報保護法）那样统一全面的联邦法律",
    en: "The US has no single comprehensive federal law like Japan's Act on the Protection of Personal Information",
  },
  "医療（HIPAA）・子ども（COPPA）など分野ごとの連邦の法律と、カリフォルニア州（CCPA）など州ごとの法律で守られています": {
    zh: "个人信息由医疗（HIPAA）、儿童（COPPA）等各领域的联邦法律，以及加利福尼亚州（CCPA）等各州的法律保护",
    en: "Personal information is protected by federal laws for specific fields, such as healthcare (HIPAA) and children (COPPA), and by state laws, such as California's (CCPA)",
  },
  "連邦取引委員会（FTC）が、約束と違う・不公正な取り扱いを取り締まります": {
    zh: "联邦贸易委员会（FTC）负责查处与承诺不符或不公正的处理",
    en: "The Federal Trade Commission (FTC) acts against handling that differs from what was promised or is unfair",
  },
  "個人情報保護委員会「外国における個人情報の保護に関する制度等の調査（米国）」": {
    zh: "日本个人信息保护委员会《外国个人信息保护制度等调查（美国）》（原文：個人情報保護委員会「外国における個人情報の保護に関する制度等の調査（米国）」）",
    en: "Personal Information Protection Commission of Japan, “Survey on personal information protection systems in other countries (United States)” (original title: 個人情報保護委員会「外国における個人情報の保護に関する制度等の調査（米国）」)",
  },
  "API で送った内容を、Claude の学習には使いません（Anthropic の Commercial Terms）": {
    zh: "通过 API 发送的内容，不会用于训练 Claude（Anthropic 的 Commercial Terms）",
    en: "Content sent through the API is not used to train Claude (Anthropic's Commercial Terms)",
  },
  "API の入力と出力は、30日以内に Anthropic の側で消えます（Anthropic Privacy Center）": {
    zh: "API 的输入和输出，会在30天内从 Anthropic 那边删除（Anthropic Privacy Center）",
    en: "API inputs and outputs are deleted on Anthropic's side within 30 days (Anthropic Privacy Center)",
  },
  通信は暗号にして送ります: { zh: "通信会加密后发送", en: "Communications are encrypted when sent" },
  // 子の分（CHILD_NOTE。法定代理人は個人情報保護法の英訳と同じ legal representative）
  "子の分は、親が法定代理人として同意します。子が大きくなったら、子が自分で決め直せるよう、本人ごとに分けて残します。": {
    zh: "孩子的部分，由父母作为法定代理人同意。为了让孩子长大后能自己重新决定，同意会按每个人分开保存。",
    en: "For a child, a parent agrees as the child's legal representative. Consent is kept separately for each person, so the child can decide again for themselves when they're older.",
  },
  // 招待で母が選ぶ「見せる項目」（SHARE_ITEMS）と続柄（RELATIONS。ママ・パートナーは today.ts）
  "母の手帳の記録（妊娠中の経過など）": { zh: "妈妈的手册记录（怀孕期间的经过等）", en: "Mother's handbook records (such as how the pregnancy went)" },
  母の健診の記録: { zh: "妈妈的健康检查记录", en: "Mother's checkup records" },
  母の写真: { zh: "妈妈的照片", en: "Mother's photos" },
  祖父母: { zh: "祖父母", en: "Grandparents" },
  そのほかの家族: { zh: "其他家人", en: "Other family" },

  // ── 記録を残す同意（app/account/consent/page.tsx。「守っている事」は lib/consent-screen.ts の RECORD_PROMISES＝版の外の言葉） ──
  "この手帳に、記録を残してよいですか": { zh: "可以在这本手册里保存记录吗？", en: "May the handbook keep records?" },
  "健診の結果や手帳の写真は、とても大事な情報（要配慮個人情報）なので、残す前に本人の同意をいただきます。": {
    zh: "健康检查的结果和手册的照片是非常重要的信息（需要特别注意的个人信息，日文：要配慮個人情報），所以在保存之前，要先征得本人的同意。",
    en: "Checkup results and photos of the handbook are very important information (special care-required personal information), so we ask for each person's own consent before keeping them.",
  },
  できました: { zh: "完成了", en: "All set" },
  "ママを手帳に入れる（招待のリンクを送る）": { zh: "邀请妈妈加入手册（发送邀请链接）", en: "Add Mom to the handbook (send an invitation link)" },
  "パートナーを手帳に入れる（招待のリンクを送る）": { zh: "邀请伴侣加入手册（发送邀请链接）", en: "Add your partner to the handbook (send an invitation link)" },
  "次の健診で先生に聞きたい事を、ひと言話してみる": { zh: "试着说一句下次健康检查时想问医生的事", en: "Try saying one thing you'd like to ask the doctor at your next checkup" },
  "手帳が書く・答える・分ける時（話す・撮る・手帳に聞く・下書きなど）は、Claude（手帳が文を読み分ける AI。米国の会社のもの）に記録の文字や写真を送ります。その「米国の Claude に送る同意」は、初めて使う時に、その場で伺います。": {
    zh: "手册在写、回答、分类时（说·拍、问手册、草稿等），会把记录的文字和照片发送给 Claude（手册用来读懂和分类文字的 AI，属于美国的公司）。这项“同意发送给美国的 Claude”，会在第一次使用时当场询问。",
    en: "When the handbook writes, answers, or sorts things (Talk · Snap, Ask the handbook, drafts, and so on), it sends the text of records and photos to Claude (the AI the handbook uses to read and sort text, made by a US company). We'll ask for this “consent to send data to Claude in the US” right then, the first time you use one of these.",
  },
  守っている事: { zh: "我们的承诺", en: "Our promises" },
  "見られるのは、あなたと、あなたが招いた家族だけです（招いた祖父母などには、手帳のママの頁と健診の記録を見せません。ただし今は、話した記録や一冊などには母の記録も入ります。見せる範囲を選ぶ仕組みは準備中です）": {
    zh: "能看到的只有你和你邀请的家人（不会给受邀的祖父母等看手册里妈妈的页面和健康检查的记录。不过目前，说话留下的记录和成长书等里面也包含妈妈的记录。选择给对方看哪些内容的功能还在准备中）",
    en: "Only you and the family members you invite can see it (invited grandparents and others aren't shown Mom's pages in the handbook or her checkup records. For now, though, things like records made by talking and the Book also include the mother's records. A way to choose what to show is still in preparation)",
  },
  "写真と録音（声）は、世帯ごとの鍵で暗号にして置きます（文字の記録の暗号化は準備中です）": {
    zh: "照片和录音（声音）会用每个家庭各自的密钥加密后保存（文字记录的加密还在准备中）",
    en: "Photos and recordings (voices) are stored encrypted with a separate key for each household (encrypting text records is still in preparation)",
  },
  "いつでも、アカウントの画面から書き出せます。あなたの写真と声は、いつでも消せます（文字の記録を本人の分だけ消す仕組みは準備中です）": {
    zh: "随时可以在账户页面导出。你的照片和声音随时都能删除（只删除本人那部分文字记录的功能还在准备中）",
    en: "You can export at any time from the account screen. You can delete your photos and voices at any time (a way to delete only one person's text records is still in preparation)",
  },
  要点: { zh: "要点", en: "Key points" },
  使い方の全部: { zh: "全部用途", en: "All the ways records are used" },
  "同意しないと？": { zh: "如果不同意？", en: "What if you don't agree?" },
  "同意がまだの間は、手帳の上に同意の案内が出ます。同意のない本人の記録を、サーバの側で止める仕組みは準備中です。デモの家族（作った家族）は、ログインせずに見られます。": {
    zh: "还没有同意的期间，手册上方会显示同意的提示。在服务器一侧停止保存未同意者记录的功能还在准备中。演示家庭（虚构的家庭）不用登录也能看。",
    en: "Until you agree, a notice about consent appears at the top of the handbook. A way for the server to stop keeping the records of people who haven't agreed is still in preparation. The demo family (a fictional family) can be viewed without signing in.",
  },
  "同意は、アカウントの画面から同じ手軽さで撤回できます。撤回の前に残した写真と声は、本人の分を消すボタンで消せます（文字の記録を本人の分だけ消す仕組みは準備中です）。": {
    zh: "同意可以在账户页面同样轻松地撤回。撤回之前保存的照片和声音，可以用删除本人部分的按钮删除（只删除本人那部分文字记录的功能还在准备中）。",
    en: "You can withdraw consent from the account screen just as easily. Photos and voices kept before withdrawing can be deleted with the button for deleting that person's data (a way to delete only one person's text records is still in preparation).",
  },

  // ── 米国の Claude に送る同意（app/account/consent/claude/page.tsx） ──
  "記録の文字と写真を、米国の Claude に送ってよいですか": { zh: "可以把记录的文字和照片发送给美国的 Claude 吗？", en: "May the handbook send the text of your records and photos to Claude in the US?" },
  "手帳が書く・答える・分ける時（話す・撮る・健診のまとめ・手帳に聞く・下書き・気づき・一冊）、記録の文字や写真を米国の会社のAI（Claude）に送ります。送り先が外国なので、記録を残す同意とは別に伺います。": {
    zh: "手册在写、回答、分类时（说·拍、健康检查的总结、问手册、草稿、手册注意到的事、成长书），会把记录的文字和照片发送给美国公司的 AI（Claude）。因为发送到国外，所以和“同意保存记录”分开询问。",
    en: "When the handbook writes, answers, or sorts things (Talk · Snap, checkup summaries, Ask the handbook, drafts, the handbook's notices, and the Book), it sends the text of records and photos to a US company's AI (Claude). Because they go to another country, we ask about this separately from the consent to keep records.",
  },
  手帳へ: { zh: "去手册", en: "Go to the handbook" },
  送り先の国: { zh: "发送到的国家", en: "Destination country" },
  "相手: {company}": { zh: "对方：{company}", en: "Recipient: {company}" },
  何を送るか: { zh: "发送什么", en: "What is sent" },
  "米国の個人情報を守る仕組み（要約）": { zh: "美国保护个人信息的制度（摘要）", en: "How personal information is protected in the US (summary)" },
  "{label}（PDF）": { zh: "{label}（PDF，日文）", en: "{label} (PDF, in Japanese)" },
  "Anthropic がとっている措置": { zh: "Anthropic 采取的措施", en: "Measures Anthropic takes" },
  // 英語のページへのリンク（English の画面では「英語」と添えない）
  "{label}（英語）": { zh: "{label}（英文）", en: "{label}" },
  "止まる物: 話す・撮るの振り分け、健診のまとめ、下書き、気づき、一冊。手帳に聞くは、予定表と使い方で答えられる問いだけに答えます。": {
    zh: "会停止的：说·拍的分类、健康检查的总结、草稿、手册注意到的事、成长书。问手册只回答用日程表和使用方法就能回答的问题。",
    en: "What stops: sorting in Talk · Snap, checkup summaries, drafts, the handbook's notices, and the Book. Ask the handbook answers only questions it can answer from the schedule and the how-to guide.",
  },
  "そのまま使える物: 予定表と期限、急ぎの時、手で入れる・見る・書き出す、町の窓口の調べ（Claude に送るのは町と手続きの名前だけで、家族の記録は送りません）。": {
    zh: "照常能用的：日程表和期限、紧急情况、手动输入、查看、导出、查询市区町村的窗口（发送给 Claude 的只有市区町村和手续的名称，不会发送家人的记录）。",
    en: "What still works: the schedule and deadlines, Emergency, entering, viewing, and exporting by hand, and looking up your town's offices (only the town and the names of the paperwork are sent to Claude, not your family's records).",
  },
  "記録の本人（ママ・子など）のうち1人でも同意していない・撤回すると、この手帳の Claude の仕事は全部止まります。いつでも同意し直せます。": {
    zh: "记录涉及的人（妈妈、孩子等）中，只要有1个人没有同意或撤回了同意，这本手册里 Claude 的工作就会全部停止。随时可以重新同意。",
    en: "If even one person in the records (Mom, a child, and so on) hasn't agreed or withdraws, all of Claude's work in this handbook stops. You can agree again at any time.",
  },

  // ── アカウントの画面（app/account/page.tsx） ──
  "このサーバでは、アカウントの仕組みをまだ動かしていません。": { zh: "这个服务器还没有启用账户功能。", en: "Accounts aren't turned on for this server yet." },
  "ログインしていません。いまは作った家族（デモ）を見ています。": { zh: "你还没有登录。现在看的是虚构的家庭（演示）。", en: "You're not signed in. You're looking at a fictional family (demo)." },
  世帯: { zh: "家庭", en: "Household" },
  "まだ自分の世帯がありません。作ると、家族の手帳が始まります。招待を受けた人は、招待のリンクを開いてください。": {
    zh: "你还没有自己的家庭。创建后，家人的手册就开始了。收到邀请的人，请打开邀请链接。",
    en: "You don't have a household yet. Create one to start your family's handbook. If you were invited, please open the invitation link.",
  },
  世帯を作る: { zh: "创建家庭", en: "Create a household" },
  どの世帯の: { zh: "哪个家庭", en: "Which household" },
  "いま見ているのは作った家族（デモ）です。同意の画面の動きを試せます。本物の家族の記録はここにはありません。": {
    zh: "现在看的是虚构的家庭（演示）。可以试试同意页面是怎么运作的。这里没有真实家庭的记录。",
    en: "You're looking at a fictional family (demo). You can try out how the consent screens work. No real family's records are here.",
  },
  // あなた（パスキー・ログアウト）
  "パスキーを登録できませんでした。メールのコードでは、いつでも入れます": { zh: "无法注册通行密钥。用邮件验证码随时都能登录", en: "Couldn't register a passkey. You can always sign in with an email code" },
  "登録しました。次から顔認証で入れます": { zh: "已注册。下次起可以用人脸识别登录", en: "Registered. Next time, you can sign in with face recognition" },
  "パスキー: {n}台の端末に登録しています": { zh: "通行密钥：已在{n}台设备上注册", en: "Passkeys: registered on {n} {n:device|devices}" },
  パスキーはまだ登録していません: { zh: "还没有注册通行密钥", en: "No passkey registered yet" },
  この端末にパスキーを登録: { zh: "在这台设备上注册通行密钥", en: "Register a passkey on this device" },
  ログアウト: { zh: "退出登录", en: "Sign out" },
  "ログアウトすると、この端末に覚えた家族の一覧も消えます。": { zh: "退出登录后，这台设备上记住的家庭列表也会清除。", en: "Signing out also clears the list of families saved on this device." },
  // 本人ごとの同意と撤回
  "{who}の「{what}」を撤回しました": { zh: "已撤回{who}的“{what}”", en: "Withdrew “{what}” for {who}" },
  "同意（{date}）": { zh: "已同意（{date}）", en: "Agreed ({date})" },
  同意していません: { zh: "未同意", en: "Not agreed" },
  "撤回しています…": { zh: "正在撤回…", en: "Withdrawing…" },
  撤回する: { zh: "撤回", en: "Withdraw" },
  読んで同意する: { zh: "阅读并同意", en: "Read and agree" },
  本人ごとの同意: { zh: "每个人的同意", en: "Consent for each person" },
  "見られる本人がいません。": { zh: "没有你能查看的人。", en: "There's no one here you can view." },
  親が代わりに同意: { zh: "由父母代为同意", en: "A parent agrees for them" },
  "撤回すると？": { zh: "撤回后会怎样？", en: "What happens if you withdraw?" },
  "「記録を残す」を撤回すると、手帳の上に同意の案内がまた出ます。同意のない本人の記録を、サーバの側で止める仕組みは準備中です。撤回の前に残した写真と声は、下の「消す」から本人の分を消せます（文字の記録を本人の分だけ消す仕組みは準備中です）。": {
    zh: "撤回“保存记录”后，手册上方会再次显示同意的提示。在服务器一侧停止保存未同意者记录的功能还在准备中。撤回之前保存的照片和声音，可以在下面的“删除”里删除这个人的部分（只删除本人那部分文字记录的功能还在准备中）。",
    en: "If you withdraw “Keep records”, the notice about consent appears at the top of the handbook again. A way for the server to stop keeping the records of people who haven't agreed is still in preparation. Photos and voices kept before withdrawing can be deleted for that person under “Delete” below (a way to delete only one person's text records is still in preparation).",
  },
  "「米国の Claude に送る」を撤回すると、その本人の分は Claude に送りません。送った分の Anthropic の側の写しは、30日以内に消えます。": {
    zh: "撤回“发送给美国的 Claude”后，这个人的部分就不再发送给 Claude。已经发送的部分在 Anthropic 那边的副本，会在30天内删除。",
    en: "If you withdraw “Send to Claude in the US”, that person's data isn't sent to Claude. Copies of what was already sent are deleted on Anthropic's side within 30 days.",
  },
  // 同意の履歴
  同意の履歴: { zh: "同意的记录", en: "Consent history" },
  本人: { zh: "本人", en: "Person" },
  "・{what}（版 {version}）": { zh: "·{what}（版本 {version}）", en: " · {what} (version {version})" },
  "同意 {date}": { zh: "同意 {date}", en: "Agreed {date}" },
  "→ 撤回 {date}": { zh: "→ 撤回 {date}", en: "→ withdrawn {date}" },
  有効: { zh: "有效", en: "Active" },
  // 家族（仲間と招待）
  "家族（世帯の仲間）": { zh: "家人（家庭成员）", en: "Family (household members)" },
  "（あなた）": { zh: "（你）", en: " (you)" },
  返事待ちの招待: { zh: "等待回复的邀请", en: "Invitations awaiting a reply" },
  "{email}・{who}・{date}まで": { zh: "{email}·{who}·{date}之前", en: "{email} · {who} · until {date}" },
  取り消す: { zh: "取消", en: "Cancel" },
  家族を招く: { zh: "邀请家人", en: "Invite family" },
  "招くのは、世帯の持ち主と共同の管理の人です。": { zh: "能邀请家人的，是家庭的所有者和共同管理者。", en: "Only the household's owner and co-managers can invite." },
  // 書き出す
  書き出す: { zh: "导出", en: "Export" },
  "記録（JSON と CSV）・家族の設定・同意の履歴・写真と録音の原本を、1つの zip で受け取れます。": {
    zh: "可以把记录（JSON 和 CSV）、家庭的设置、同意的记录、照片和录音的原件，作为1个 zip 文件下载。",
    en: "You can download your records (JSON and CSV), family settings, consent history, and the original photos and recordings as one zip file.",
  },
  "zip を受け取る": { zh: "下载 zip", en: "Download zip" },
  "紙の母子手帳の並びで見たい時は、「手帳」→「一冊」から印刷して PDF にできます。": {
    zh: "想按纸质母子健康手册的顺序查看时，可以在“手册”→“成长书”里打印成 PDF。",
    en: "To see it in the same order as the paper Maternal and Child Health Handbook, print it to PDF from “Handbook” → “Book”.",
  },
  // 消す（確かめの言葉は画面の言葉で打ってもらい、サーバへはいつも「消す」を送る＝lib/delete-word.ts。{word} は 消す・删除・delete）
  "{who}の分": { zh: "{who}的数据", en: "Data for {who}" },
  "世帯の全部（家族全員の分）": { zh: "整个家庭（全体家人的数据）", en: "The whole household (everyone's data)" },
  消しました: { zh: "已删除", en: "Deleted" },
  "消す前に、上の「zip を受け取る」で書き出しておくと安心です。消した物は戻せません。": {
    zh: "删除之前，先用上面的“下载 zip”导出，会更安心。删除的东西无法恢复。",
    en: "Before deleting, it's safer to export with “Download zip” above. Deleted data can't be restored.",
  },
  何を消しますか: { zh: "要删除什么？", en: "What do you want to delete?" },
  選んでください: { zh: "请选择", en: "Choose one" },
  "記録・写真・録音・同意・世帯の鍵を、まとめて消します。鍵を消すので、残ったファイルも読めなくなります": {
    zh: "会一起删除记录、照片、录音、同意和家庭的密钥。因为删除了密钥，剩下的文件也无法读取",
    en: "Deletes records, photos, recordings, consents, and the household's key all together. Because the key is deleted, any files left behind can't be read either",
  },
  "その本人の記録・写真・録音・同意・代理の印を消します。本人の付いていない世帯全体の記録は残ります": {
    zh: "删除这个人的记录、照片、录音、同意和代理标记。没有标明本人、属于整个家庭的记录会保留",
    en: "Deletes that person's records, photos, recordings, consents, and proxy marks. Household-wide records that aren't tied to a person are kept",
  },
  "Claude に送った分の Anthropic の側の写しは、30日以内に自動で消えます": {
    zh: "已经发送给 Claude 的部分在 Anthropic 那边的副本，会在30天内自动删除",
    en: "Copies of what was sent to Claude are deleted automatically on Anthropic's side within 30 days",
  },
  "サーバのバックアップに残る写しは、バックアップが入れ替わるまで残ります（日数はまだ決めていません）": {
    zh: "服务器备份里的副本，会一直保留到备份被替换为止（天数还没有决定）",
    en: "Copies in the server's backups remain until those backups are replaced (the number of days hasn't been decided yet)",
  },
  "確かめのため「{word}」と入れてください": { zh: "为了确认，请输入“{word}”", en: "To confirm, type “{word}”" },

  // ── 世帯を作る（app/account/new/page.tsx。あなたは？・赤ちゃんの呼び名・おなかの子・入れた事はどこに？は settings.ts） ──
  "先にログインしてください。": { zh: "请先登录。", en: "Please sign in first." },
  "世帯は、家族の手帳の入れ物です。あとから家族を招けます。": { zh: "家庭是存放家人手册的地方。之后可以邀请家人。", en: "A household holds your family's handbook. You can invite family later." },
  "ママ（母）の呼び名": { zh: "妈妈（母亲）的称呼", en: "Name for Mom (mother)" },
  "例: はるか": { zh: "例：佳佳", en: "e.g. Haruka" },
  パートナーの呼び名: { zh: "伴侣的称呼", en: "Name for your partner" },
  "（いなければ空のまま）": { zh: "（没有的话就空着）", en: " (leave blank if none)" },
  "例: けんた": { zh: "例：阿健", en: "e.g. Kenta" },
  "世帯の名前（家族だけに見えます）": { zh: "家庭的名称（只有家人能看到）", en: "Household name (only your family sees it)" },
  "作っています…": { zh: "正在创建…", en: "Creating…" },
  "この世帯の中だけに置きます。氏名・住所の番地は入れなくて大丈夫です。": {
    zh: "只保存在这个家庭里。不填写姓名全名和住址的门牌号也没关系。",
    en: "It's kept only within this household. You don't need to enter full names or street numbers.",
  },
  "写真・録音のファイルは、世帯ごとの鍵で暗号にしてから置きます。": {
    zh: "照片和录音文件，会先用每个家庭各自的密钥加密，然后再保存。",
    en: "Photo and audio files are encrypted with a separate key for each household before they are stored.",
  },

  // ── ログイン（app/login/page.tsx） ──
  "コードを送れませんでした。メールを確かめて、もう一度押してください": { zh: "验证码发送失败。请确认邮箱地址后再点一次", en: "Couldn't send the code. Please check your email address and tap again" },
  "{email} にコードを送りました。5分のうちに入れてください": { zh: "验证码已发送到 {email}。请在5分钟内输入", en: "We sent a code to {email}. Please enter it within 5 minutes" },
  "入れませんでした。コードを確かめてください": { zh: "登录失败。请确认验证码", en: "Couldn't sign in. Please check the code" },
  "パスキーを登録できませんでした。あとでアカウントの画面からもできます": { zh: "无法注册通行密钥。之后也可以在账户页面注册", en: "Couldn't register a passkey. You can also do it later from the account screen" },
  "パスキーで入れませんでした。メールのコードで入ってください": { zh: "无法用通行密钥登录。请用邮件验证码登录", en: "Couldn't sign in with a passkey. Please sign in with an email code" },
  ログイン: { zh: "登录", en: "Sign in" },
  "このサーバでは、アカウントの仕組みをまだ動かしていません。いまは今までどおり使えます。": {
    zh: "这个服务器还没有启用账户功能。现在可以照常使用。",
    en: "Accounts aren't turned on for this server yet. You can keep using it as before.",
  },
  手帳に戻る: { zh: "回到手册", en: "Back to the handbook" },
  入りました: { zh: "已登录", en: "You're signed in" },
  "メールに届く6桁のコードで入ります。はじめての人は、そのままアカウントができます。": {
    zh: "用发到邮箱的6位验证码登录。第一次使用的人，会直接创建账户。",
    en: "Sign in with a 6-digit code sent to your email. If it's your first time, your account is created right away.",
  },
  "送っています…": { zh: "正在发送…", en: "Sending…" },
  コードを送る: { zh: "发送验证码", en: "Send code" },
  パスキーを登録した端末なら: { zh: "如果是注册过通行密钥的设备", en: "On a device with a registered passkey" },
  "パスキー（顔認証）で入る": { zh: "用通行密钥（人脸识别）登录", en: "Sign in with a passkey (face recognition)" },
  メールに届いた6桁のコード: { zh: "发到邮箱的6位验证码", en: "The 6-digit code sent to your email" },
  入る: { zh: "登录", en: "Sign in" },
  コードをもう一度送る: { zh: "重新发送验证码", en: "Send the code again" },
  メールを直す: { zh: "修改邮箱", en: "Change email" },
  "次から、顔認証（パスキー）だけで入れるようにしますか？": { zh: "下次起，要设成只用人脸识别（通行密钥）就能登录吗？", en: "Would you like to sign in with just face recognition (a passkey) from now on?" },
  "登録しています…": { zh: "正在注册…", en: "Registering…" },
  パスキーを登録する: { zh: "注册通行密钥", en: "Register a passkey" },
  あとで: { zh: "以后再说", en: "Later" },
  "登録しなくても、いつでもメールのコードで入れます": { zh: "不注册也没关系，随时都能用邮件验证码登录", en: "Even without registering, you can always sign in with an email code" },
  "メールのリンクで入らないのは？": { zh: "为什么不用邮件里的链接登录？", en: "Why not sign in with an email link?" },
  "iPhone のホーム画面に置いたアプリと Safari では、ログインの札が別々です。リンクで入ると Safari だけが入った状態になるので、コードを入れる形にしています。": {
    zh: "iPhone 主屏幕上的应用和 Safari 的登录凭证是分开的。用链接登录的话，只有 Safari 会处于登录状态，所以改成了输入验证码的方式。",
    en: "On iPhone, the app on your Home Screen and Safari keep separate sign-ins. Signing in with a link would sign in only Safari, so we use a code instead.",
  },
  "コードは5分で切れ、3回まちがえると使えなくなります。": { zh: "验证码5分钟后失效，输错3次就不能再用。", en: "Codes expire after 5 minutes and stop working after 3 wrong tries." },
  ログインせずにデモを見る: { zh: "不登录，先看演示", en: "See the demo without signing in" },
  家族の合言葉で入る: { zh: "用家庭口令进入", en: "Enter with the family passphrase" },

  // ── 招待を受ける（app/invite/[id]/page.tsx） ──
  // サーバが組む見出し（lib/invite-words.ts の inviteHeadline）を、呼び名と時期に分けて組み直す。呼び名の無い時の「ご家族」
  "{who}から、母子手帳への招待です": { zh: "{who}邀请你加入母子健康手册", en: "An invitation from {who} to the Maternal and Child Health Handbook" },
  "{who}から、{period}の母子手帳への招待です": { zh: "{who}邀请你加入母子健康手册（{period}）", en: "An invitation from {who} to the Maternal and Child Health Handbook ({period})" },
  ご家族: { zh: "你的家人", en: "your family" },
  // 入ると何ができるか（inviteCanLines）
  やる事を二人で分けられます: { zh: "可以两个人分担要做的事", en: "You can split the to-dos between the two of you" },
  "あなたの番の手続き（育休など）を、手帳が先に用意します": { zh: "轮到你办的手续（育儿休假等），手册会提前准备好", en: "The handbook prepares your share of the paperwork (such as childcare leave) ahead of time" },
  "健診の日と、先生に聞く事が見られます": { zh: "可以看到健康检查的日子和要问医生的事", en: "You can see checkup dates and questions for the doctor" },
  手帳の記録と子の写真を見られます: { zh: "可以看到手册的记录和孩子的照片", en: "You can see the handbook's records and the child's photos" },
  "みんなの章に、写真・声・手紙を足せます": { zh: "可以在“大家的篇章”里添加照片、声音和信", en: "You can add photos, voices, and letters to Everyone's chapter" },
  "記録を足す・直すはできません": { zh: "不能添加或修改记录", en: "You can't add or edit records" },
  "招待されたメール（{email}）に届くコードで入ります。": { zh: "用发到受邀邮箱（{email}）的验证码登录。", en: "You'll sign in with a code sent to the invited email ({email})." },
  "招待されたメールに届くコードで入ります。": { zh: "用发到受邀邮箱的验证码登录。", en: "You'll sign in with a code sent to the invited email." },
  メールのコードで入る: { zh: "用邮件验证码登录", en: "Sign in with an email code" },
  // 受ける画面の「見られる物」（inviteSeeLine の3つの文）と、母が選んだ項目の注（inviteMotherItemsLine と同じ文）
  "手帳の全部（母の記録も）を見て、足して、家族を招けます": {
    zh: "可以查看手册的全部内容（包括妈妈的记录），添加记录，邀请家人",
    en: "You can see everything in the handbook (including the mother's records), add to it, and invite family",
  },
  "見られる物: 子の手帳の記録と、子の写真・声（手帳のママの頁と健診は見えません。話した記録や一冊などには、今は母の記録も入ります。記録を足す・直すはできません）": {
    zh: "能看到的：孩子的手册记录，以及孩子的照片和声音（看不到手册里妈妈的页面和健康检查。说话留下的记录和成长书等里面，目前也包含妈妈的记录。不能添加或修改记录）",
    en: "What you can see: the child's handbook records and the child's photos and voices (not Mom's pages in the handbook or the checkups. For now, things like records made by talking and the Book also include the mother's records. You can't add or edit records)",
  },
  "見られる物: 子の手帳の記録と、子と母の写真・声（手帳のママの頁と健診は見えません。話した記録や一冊などには、今は母の記録も入ります。記録を足す・直すはできません）": {
    zh: "能看到的：孩子的手册记录，以及孩子和妈妈的照片和声音（看不到手册里妈妈的页面和健康检查。说话留下的记录和成长书等里面，目前也包含妈妈的记录。不能添加或修改记录）",
    en: "What you can see: the child's handbook records and the photos and voices of the child and the mother (not Mom's pages in the handbook or the checkups. For now, things like records made by talking and the Book also include the mother's records. You can't add or edit records)",
  },
  "母が選んだ{items}だけを見せる仕組みは準備中です": { zh: "只显示妈妈选择的{items}的功能还在准备中", en: "Showing only what the mother chose ({items}) is still in preparation" },
  "受けています…": { zh: "正在接受…", en: "Accepting…" },
  招待を受ける: { zh: "接受邀请", en: "Accept the invitation" },
  "いま {email} で入っています。招待されたメールが違う時は、アカウントの画面からログアウトして入り直してください。": {
    zh: "现在登录的是 {email}。如果受邀的邮箱不是这个，请在账户页面退出登录，再重新登录。",
    en: "You're signed in as {email}. If the invitation went to a different email, sign out on the account screen and sign in again.",
  },
  // iPhone の画面の名前は、iPhone の言葉の札にそろえる（Add to Home Screen・添加到主屏幕）
  "iPhone では、先にホーム画面に追加": { zh: "在 iPhone 上，请先添加到主屏幕", en: "On iPhone, add it to your Home Screen first" },
  "Safari の共有ボタンから「ホーム画面に追加」": { zh: "在 Safari 的共享按钮里选“添加到主屏幕”", en: "In Safari, tap the Share button, then “Add to Home Screen”" },
  "ホーム画面のアプリでこのリンクを開き直す（または、アプリの中でメールのコードで入る）": {
    zh: "在主屏幕的应用里重新打开这个链接（或者在应用里用邮件验证码登录）",
    en: "Open this link again in the app on your Home Screen (or sign in with an email code inside the app)",
  },
  "ホーム画面に置いたアプリと Safari では、ログインが別々です。ふだん使うのはホーム画面のアプリなので、そちらで入ってください。": {
    zh: "放在主屏幕上的应用和 Safari 的登录是分开的。平时用的是主屏幕上的应用，所以请在那里登录。",
    en: "The app on your Home Screen and Safari have separate sign-ins. You'll usually use the Home Screen app, so please sign in there.",
  },

  // ── 家族を招く（app/invite/new/page.tsx。家族を招くはアカウントの画面と同じ鍵） ──
  "招く世帯がありません。先に世帯を作ってください。": { zh: "没有可以邀请家人加入的家庭。请先创建家庭。", en: "There's no household to invite people to. Please create a household first." },
  招待のリンクができました: { zh: "邀请链接已经做好了", en: "Your invitation link is ready" },
  "この文を、そのまま相手に送ってください。{date}まで（48時間）使えます。": {
    zh: "请把这段文字直接发给对方。在{date}之前（48小时内）有效。",
    en: "Send this message to them as is. It works until {date} (48 hours).",
  },
  // 相手にそのまま送る文と、その題（母子手帳への招待）は dict/invite-share.ts（送る文の言葉を、画面の言葉と別に選ぶため）
  // 送る文の言葉（日本語・中文・English。言葉の名前は LANG_NAMES で、それぞれの言葉で書く）
  送る文の言葉: { zh: "发送内容的语言", en: "Language of the message" },
  "相手がリンクを開くと、この言葉の画面で開きます（相手は画面の上で変えられます）。": {
    zh: "对方打开链接时，页面也会用这种语言显示（对方可以在页面上方切换）。",
    en: "When they open the link, the page opens in this language (they can change it at the top of the page).",
  },
  文をコピー: { zh: "复制文字", en: "Copy the message" },
  "ほかのアプリで送る…": { zh: "用其他应用发送…", en: "Send with another app…" },
  リンクだけを送る時: { zh: "只发送链接时", en: "To send only the link" },
  招待のリンク: { zh: "邀请链接", en: "Invitation link" },
  だれを: { zh: "邀请谁", en: "Who to invite" },
  "共同の管理: 記録を見て、足して、家族を招けます": { zh: "共同管理者：可以查看、添加记录，也可以邀请家人", en: "Co-manager: can see and add records, and invite family" },
  "読むだけ: 子の手帳の記録と写真・声を見られます（手帳のママの頁と健診は見えません。話した記録や一冊などには、今は母の記録も入ります）。足す・直すはできません": {
    zh: "只能查看：可以看到孩子的手册记录、照片和声音（看不到手册里妈妈的页面和健康检查。说话留下的记录和成长书等里面，目前也包含妈妈的记录）。不能添加或修改",
    en: "View only: can see the child's handbook records, photos, and voices (not Mom's pages in the handbook or the checkups. For now, things like records made by talking and the Book also include the mother's records). Can't add or edit",
  },
  "相手のメール（このメールのコードで入った人だけが受けられます）": {
    zh: "对方的邮箱（只有用这个邮箱的验证码登录的人才能接受）",
    en: "Their email (only someone who signs in with a code sent to this email can accept)",
  },
  "母の記録から、見せる物": { zh: "从妈妈的记录里，给对方看的内容", en: "What to show from the mother's records" },
  "何も選ばなければ、写真と声は子の分だけを見せます。母の写真を選ぶと、母の写真と声も見せます。母の手帳の頁と健診の記録は、今は見せません（選べるようにする仕組みは準備中です）。話した記録や一冊などには、今は母の記録も入ります。": {
    zh: "什么都不选的话，照片和声音只给对方看孩子的部分。选择妈妈的照片后，妈妈的照片和声音也会给对方看。妈妈的手册页面和健康检查的记录，目前不给对方看（让你可以选择的功能还在准备中）。说话留下的记录和成长书等里面，目前也包含妈妈的记录。",
    en: "If you choose nothing, only the child's photos and voices are shown. If you choose the mother's photos, the mother's photos and voices are shown too. The mother's handbook pages and checkup records aren't shown for now (a way to choose them is still in preparation). For now, things like records made by talking and the Book also include the mother's records.",
  },
  "（今は見せません）": { zh: "（目前不给对方看）", en: " (not shown for now)" },
  "母の記録を見せる範囲は、母本人が選びます。この招待では、写真と声は子の分だけを見せます（手帳のママの頁と健診は見せません。話した記録や一冊などには、今は母の記録も入ります）。": {
    zh: "给对方看妈妈的哪些记录，由妈妈本人选择。这个邀请里，照片和声音只给对方看孩子的部分（不给对方看手册里妈妈的页面和健康检查。说话留下的记录和成长书等里面，目前也包含妈妈的记录）。",
    en: "The mother chooses what of her records to show. With this invitation, only the child's photos and voices are shown (Mom's pages in the handbook and the checkups aren't shown. For now, things like records made by talking and the Book also include the mother's records).",
  },
  招待のリンクを作る: { zh: "生成邀请链接", en: "Create the invitation link" },
  "なぜメールのコードで受けるの？": { zh: "为什么要用邮件验证码接受？", en: "Why accept with an email code?" },
  "リンクを他の人に転送されても、招待したメールの持ち主でなければ受けられないようにするためです。": {
    zh: "这是为了即使链接被转发给别人，不是受邀邮箱的主人也无法接受。",
    en: "So that even if the link is forwarded to someone else, only the owner of the invited email can accept it.",
  },
} satisfies Entries;
