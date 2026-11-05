// 辞書: 急ぎの時（app/emergency/）と合言葉の画面（app/unlock/・/api/unlock）。書き方は lib/i18n/index.ts の頭
//
// 安全の文は言い換えずに訳す（直訳寄り。番号・時間・数はそのまま。体の判断をする言い方を足さない）。
// 公の訳にそろえた所（2026-11-05 に PDF の本文で確かめた）:
// - こども家庭庁「外国語版の母子健康手帳」R5（https://mchbook.cfa.go.jp/category03/index.php の R5_CN_240301.pdf・R5_EN_240301.pdf）:
//   「出血や破水…」と「また、つわりで…」の中文（国の様式 R8 の「医師など」に合わせて「医生等」）、「退院時の記録」の欄の名
//   （中文「出院时的记录」・English「Condition at Time of Hospital Discharge」。家族の手に紙の外国語版があれば、同じ名で探せる）、
//   手当の言葉（中文の 击打背部・心肺复苏・急救队）。English の2文は、公の訳が「すぐに」を落とし（つわりの文）、
//   「おなかの強い張り」を bloated stomach としている（出血の文）ので、直訳寄りにした
// - 消防庁「救急車利用マニュアル」中文版（https://www.fdma.go.jp/publication/portal/items/portal002_chinese.pdf）:
//   「けいれんが止まらない」＝痉挛不止・「反応が無い」＝没有反应・#7119＝急救安心中心
// 引用の訳は、言葉のままではなく訳なので、「言葉のまま」「そのまま引いて」は「引自」「（中文为翻译）」「(translated)」と訳す。
// 「: …」「は、…」「、…」「。」で始まる鍵は、太字・リンクの前後で文を分けた物（日本語の画面を前と1字も変えないため。HelpPlaces と同じ形）。
// #7119 の受付の時間（lib/emergency-lines.ts の hours）は、表の日本語を鍵にして画面で t() で引く。
import type { Entries } from "..";

export default {
  // ── いちばん上 ──
  "‹ 今日へ": { zh: "‹ 回到今天", en: "‹ Today" },
  "電波が無くても開けます": { zh: "没有信号也能打开", en: "Opens even without a signal" },

  // ── 電話の段（119・#8000・#7119） ──
  "119 にかける": { zh: "拨打 119", en: "Call 119" },
  "命が危ないと思ったら、迷わずこちら": { zh: "如果觉得有生命危险，请毫不犹豫地拨打这个号码", en: "If you think a life is in danger, call this number without hesitation" },
  "息をしていない・反応が無い・けいれんが止まらない。手当のしかたも電話で教えてもらえます": {
    zh: "没有呼吸、没有反应、痉挛不止。急救的方法，电话里也会告诉你",
    en: "Not breathing, not responding, seizures that won't stop. They will also tell you over the phone how to give first aid",
  },
  "#8000 に聞く": { zh: "向 #8000 咨询", en: "Ask #8000" },
  "子どもの事で、救急車を呼ぶか迷う時はまずこちら。夜や休みの日に、小児科の先生や看護師さんに聞けます": {
    zh: "孩子的事，拿不准要不要叫救护车时，先打这个号码。晚上或休息日，可以向儿科医生或护士咨询",
    en: "For your child: if you're not sure whether to call an ambulance, call this number first. At night and on days off, you can ask a pediatrician or nurse",
  },
  "#7119 に聞く": { zh: "向 #7119 咨询", en: "Ask #7119" },
  "大人の体（ママ）の事で、救急車を呼ぶか迷う時": {
    zh: "大人（妈妈）的身体问题，拿不准要不要叫救护车时",
    en: "For an adult's body (Mom): if you're not sure whether to call an ambulance",
  },
  "この町からは {tel} にかけます": { zh: "在这个市町村，请拨打 {tel}", en: "From this town, call {tel}" },
  "受付: {hours}": { zh: "受理时间：{hours}", en: "Hours: {hours}" },
  "声で話せない時": { zh: "无法用声音交谈时", en: "If you can't talk by voice" },
  ": 文字で119に通報できる「NET119」（前もって住む町の消防本部に登録が要ります）と、手話や文字で110・119にもつながる「電話リレーサービス」（24時間）があります。": {
    zh: "：有可以用文字向119报警的“NET119”（需要事先在所住市区町村的消防本部登记），以及用手语或文字也能接通110和119的“电话中继服务”（24小时）。",
    en: ": There is “NET119,” which lets you report to 119 by text (you need to register in advance with the fire department where you live), and the “phone relay service,” which also connects you to 110 and 119 using sign language or text (24 hours).",
  },
  "手当の手順は、この下にあります ↓": { zh: "急救步骤在下面 ↓", en: "First-aid steps are below ↓" },

  // ── #7119 の受付の時間（lib/emergency-lines.ts の表。24時間の地域は出さない） ──
  "毎日 午後6時〜翌午前8時": { zh: "每天晚上6点至次日早上8点", en: "every day 6 p.m. to 8 a.m. the next day" },
  "毎日 午後7時〜翌午前8時": { zh: "每天晚上7点至次日早上8点", en: "every day 7 p.m. to 8 a.m. the next day" },
  "毎日 午後6時〜翌午前8時（春の大型連休・年末年始は24時間）": {
    zh: "每天晚上6点至次日早上8点（黄金周和年末年初24小时）",
    en: "every day 6 p.m. to 8 a.m. the next day (24 hours during Golden Week and the year-end and New Year holidays)",
  },
  "月〜金は午後6時〜翌午前8時・土日祝は24時間": {
    zh: "周一至周五晚上6点至次日早上8点，周六、周日和节假日24小时",
    en: "Monday to Friday 6 p.m. to 8 a.m. the next day; Saturdays, Sundays, and holidays 24 hours",
  },
  "月〜金は午後4時〜翌午前10時・土日祝は午前10時〜翌午前10時": {
    zh: "周一至周五下午4点至次日上午10点，周六、周日和节假日上午10点至次日上午10点",
    en: "Monday to Friday 4 p.m. to 10 a.m. the next day; Saturdays, Sundays, and holidays 10 a.m. to 10 a.m. the next day",
  },
  "月〜土は午後6時〜翌午前8時・日祝と年末年始は24時間": {
    zh: "周一至周六晚上6点至次日早上8点，周日、节假日和年末年初24小时",
    en: "Monday to Saturday 6 p.m. to 8 a.m. the next day; Sundays, holidays, and the year-end and New Year holidays 24 hours",
  },
  "平日は午後7時〜翌午前8時・土日祝と年末年始は午前8時〜翌午前8時": {
    zh: "工作日晚上7点至次日早上8点，周六、周日、节假日和年末年初早上8点至次日早上8点",
    en: "weekdays 7 p.m. to 8 a.m. the next day; Saturdays, Sundays, holidays, and the year-end and New Year holidays 8 a.m. to 8 a.m. the next day",
  },
  "平日は午後7時〜翌午前9時・土曜は午後1時〜翌午前9時・日祝は午前9時〜翌午前9時": {
    zh: "工作日晚上7点至次日上午9点，周六下午1点至次日上午9点，周日和节假日上午9点至次日上午9点",
    en: "weekdays 7 p.m. to 9 a.m. the next day; Saturdays 1 p.m. to 9 a.m. the next day; Sundays and holidays 9 a.m. to 9 a.m. the next day",
  },
  "平日・土曜は午後7時〜翌朝8時・日祝は午前8時〜翌朝8時（お盆・年末年始を含む）": {
    zh: "工作日和周六晚上7点至次日早上8点，周日和节假日早上8点至次日早上8点（包括盂兰盆节和年末年初）",
    en: "weekdays and Saturdays 7 p.m. to 8 a.m. the next day; Sundays and holidays 8 a.m. to 8 a.m. the next day (including Obon and the year-end and New Year holidays)",
  },

  // 「#」の番号につながらない時（ChokeOrder.tsx の AltCall）の文と読み上げは、today の鍵（頼れる所と同じ）を使う

  // ── このページの中（飛び先の札） ──
  "このページの中": { zh: "本页内容", en: "On this page" },
  "のどに詰まった": { zh: "喉咙卡住了", en: "Choking" },
  "反応が無い・息をしていない": { zh: "没有反应、没有呼吸", en: "Not responding, not breathing" },
  "泣きやまない": { zh: "哭个不停", en: "Won't stop crying" },
  "妊娠中・産後のママの体": { zh: "怀孕期间和产后妈妈的身体", en: "Mom's body during pregnancy and after birth" },
  "下の手当は、「救急蘇生法の指針2025（市民用）」（消防庁が2026年10月に全国の消防へ通知）と、日本蘇生協議会の「JRC蘇生ガイドライン2025」の要点です。アプリが判断した物ではありません。": {
    zh: "下面的急救方法，是“急救复苏法指南2025（市民用）”（消防厅于2026年10月通知全国消防部门）和日本复苏协议会“JRC复苏指南2025”的要点。不是本应用自己判断的内容。",
    en: "The first aid below sums up the key points of the “Guidelines for Emergency Resuscitation 2025 (for citizens)” (sent by the Fire and Disaster Management Agency to fire departments nationwide in October 2026) and the Japan Resuscitation Council's “JRC Resuscitation Guidelines 2025.” It is not something the app decided.",
  },

  // ── のどに物が詰まった（窒息） ──
  "のどに物が詰まった": { zh: "喉咙卡住了东西", en: "Something stuck in the throat" },
  "窒息（ちっそく）": { zh: "窒息", en: "Choking" },
  "せきができる・泣ける時": { zh: "能咳嗽、能哭的时候", en: "If the child can cough or cry" },
  "は、せきを続けさせます。口の中に見える物だけを取ります。指で奥を探ると、もっと奥へ押し込むことがあります。": {
    zh: "，让孩子继续咳嗽。只取出嘴里看得见的东西。用手指往深处掏，可能会把东西推得更深。",
    en: ", let them keep coughing. Remove only what you can see in the mouth. Feeling deep inside with a finger can push the object further in.",
  },
  "声が出ない・息ができない・顔色が悪くなってきた時は、大声で人を呼び、119を頼みます。一人で頼める人がいない時は、119より先に、下の取り出す手当を始めます。": {
    zh: "发不出声音、无法呼吸、脸色变差时，要大声呼叫旁人，请人拨打119。如果只有你一个人、没有可以拜托的人，就在拨打119之前，先开始下面取出异物的急救。",
    en: "If they can't make a sound, can't breathe, or their color is getting worse, shout for help and ask someone to call 119. If you are alone with no one to ask, start the steps below to get the object out before calling 119.",
  },
  "1歳になる前の赤ちゃん": { zh: "未满1岁的婴儿", en: "Babies under 1 year old" },
  "1歳を過ぎた子": { zh: "1岁以上的孩子", en: "Children over 1 year old" },
  "{name}は1歳を過ぎているので、「1歳を過ぎた子」を先に出しています。": {
    zh: "{name}已经1岁以上了，所以先显示“1岁以上的孩子”。",
    en: "{name} is over 1 year old, so “Children over 1 year old” is shown first.",
  },
  "お子さんは1歳を過ぎているので、「1歳を過ぎた子」を先に出しています。": {
    zh: "你的孩子已经1岁以上了，所以先显示“1岁以上的孩子”。",
    en: "Your child is over 1 year old, so “Children over 1 year old” is shown first.",
  },
  // 太字の見出し（背中をたたく・胸を押す は窒息と心肺蘇生の両方で使う。English の Push on the chest は両方に合う言い方）
  "背中をたたく": { zh: "击打背部", en: "Back blows" },
  "胸を押す": { zh: "按压胸部", en: "Push on the chest" },
  "お腹を突き上げる": { zh: "向上挤压腹部", en: "Abdominal thrusts" },
  ": 赤ちゃんをうつぶせにして片腕に乗せ、手であごを支えて、頭を体より低くします。手のひらの付け根で、背中の真ん中（肩甲骨〈けんこうこつ〉の間＝かたの ほねの あいだ）を強く5回ほどたたきます。": {
    zh: "：让婴儿趴着，放在你的一只手臂上，用手托住下巴，让头低于身体。用手掌根部，在背部正中（两块肩胛骨之间）用力击打5次左右。",
    en: ": Lay the baby face down along one arm, support the jaw with your hand, and keep the head lower than the body. With the heel of your hand, strike firmly about 5 times in the middle of the back (between the shoulder blades).",
  },
  ": あお向けにして頭を低くし、胸の真ん中（左右の乳首を結ぶ線の真ん中あたり）を、片手の手のひらの付け根で強く5回ほど押します。": {
    zh: "：让婴儿仰躺，头放低，用一只手的手掌根部，在胸部正中（两侧乳头连线的中点附近）用力按压5次左右。",
    en: ": Turn the baby face up with the head low, and with the heel of one hand, push firmly about 5 times on the middle of the chest (around the middle of the line between the nipples).",
  },
  "出てくるか、ぐったりするまで、1と2をくり返します。お腹を突き上げる方法は、赤ちゃんにはしません。": {
    zh: "重复1和2，直到异物出来，或婴儿变得瘫软。向上挤压腹部的方法，不能用在婴儿身上。",
    en: "Repeat 1 and 2 until the object comes out or the baby goes limp. Do not use abdominal thrusts on babies.",
  },
  ": 背中の真ん中（かたの ほねの あいだ）を、手のひらの付け根で強く5回ほどたたきます。": {
    zh: "：用手掌根部，在背部正中（两块肩胛骨之间）用力击打5次左右。",
    en: ": With the heel of your hand, strike firmly about 5 times in the middle of the back (between the shoulder blades).",
  },
  ": 出てこなければ、後ろから抱えるように腕を回し、片手でにぎりこぶしを作って、おへその少し上に当てます。もう片方の手でこぶしを包み、手前の上の方へ、すばやく5回ほど突き上げます。": {
    zh: "：如果还出不来，从背后环抱孩子，一只手握拳，放在肚脐稍上方。用另一只手包住拳头，朝自己身前偏上的方向，快速向上挤压5次左右。",
    en: ": If it doesn't come out, wrap your arms around the child from behind, make a fist with one hand, and place it just above the belly button. Cover the fist with your other hand and thrust quickly toward you and upward about 5 times.",
  },
  "出てくるか、ぐったりするまで、1と2をくり返します。": {
    zh: "重复1和2，直到异物出来，或孩子变得瘫软。",
    en: "Repeat 1 and 2 until the object comes out or the child goes limp.",
  },
  "ぐったりして反応が無くなったら": { zh: "如果变得瘫软、没有了反应", en: "If they go limp and stop responding" },
  "、すぐに下の「心肺蘇生」へ。お腹を突き上げた時は、出てきても病院で診てもらいます。": {
    zh: "，请马上做下面的“心肺复苏”。如果做过向上挤压腹部，即使异物出来了，也要去医院检查。",
    en: ", go straight to “CPR” below. If you used abdominal thrusts, have the child seen at a hospital even if the object came out.",
  },

  // ── 反応が無い・息をしていない（心肺蘇生） ──
  "心肺蘇生（しんぱいそせい）": { zh: "心肺复苏", en: "CPR (cardiopulmonary resuscitation)" },
  "反応を見る": { zh: "确认反应", en: "Check for a response" },
  ": 肩をたたいて大きな声で呼びます（赤ちゃんは足の裏をたたく）。": {
    zh: "：拍打肩膀，大声呼唤（婴儿则拍打脚底）。",
    en: ": Tap the shoulders and call out loudly (for a baby, tap the soles of the feet).",
  },
  "人を呼ぶ": { zh: "呼叫旁人", en: "Call for help" },
  ": 反応が無ければ、大声で人を呼び、119 と AED を頼みます。一人なら、スマホをスピーカーにして119。話しながら手当を始めます。": {
    zh: "：如果没有反应，大声呼叫旁人，请人拨打119并拿来AED。如果只有你一个人，就用手机免提拨打119，一边通话一边开始急救。",
    en: ": If there's no response, shout for help and ask someone to call 119 and bring an AED. If you're alone, call 119 on speakerphone and start first aid while you talk.",
  },
  "息を見る": { zh: "确认呼吸", en: "Check breathing" },
  ": 胸とお腹が動いているかを10秒以内で見ます。ふだんどおりの息が無い・分からない時は、すぐに次へ。": {
    zh: "：在10秒以内，看胸部和腹部有没有起伏。没有正常呼吸或判断不了时，马上进行下一步。",
    en: ": Within 10 seconds, look to see whether the chest and belly are moving. If there's no normal breathing, or you can't tell, go straight to the next step.",
  },
  ": 胸の真ん中を、胸の厚みの3分の1が沈むくらい強く、1分に100〜120回の速さで、休まず押します。赤ちゃんは片手の手のひらの付け根で（左右の乳首を結ぶ線の真ん中あたり）。子どもは両手で（体が小さければ片手でも）。": {
    zh: "：在胸部正中用力按压，深度约为胸部厚度的1/3，速度为每分钟100～120次，不要停。婴儿用一只手的手掌根部（两侧乳头连线的中点附近）。儿童用双手（身体小的话也可以用一只手）。",
    en: ": Push on the middle of the chest hard enough to press it down about 1/3 of its depth, at 100 to 120 times a minute, without stopping. For a baby, use the heel of one hand (around the middle of the line between the nipples). For a child, use both hands (or one hand if the child is small).",
  },
  "息を吹き込む": { zh: "人工呼吸", en: "Rescue breaths" },
  ": やり方を習った人は、押す30回ごとに息を2回。できなければ、押すことだけを続けます。": {
    zh: "：学过方法的人，每按压30次，吹气2次。做不到的话，就只持续按压。",
    en: ": If you've been trained, give 2 breaths after every 30 pushes. If you can't, just keep pushing.",
  },
  "AED が来たら": { zh: "AED 送到后", en: "When the AED arrives" },
  ": ふたを開けて電源を入れ、声の案内のとおりに。小学校に上がる前の子は、未就学児用のパッドかモード（前の呼び名は小児用）があれば使います。無ければ大人用で代わりにします（赤ちゃんは体が小さいので、胸と背中に貼ります）。": {
    zh: "：打开盖子，接通电源，按照语音提示操作。上小学之前的孩子，如果有学龄前儿童用的电极片或模式（以前叫“儿童用”），就使用它。没有的话，就用成人用的代替（婴儿身体小，所以贴在胸部和背部）。",
    en: ": Open the lid, turn it on, and follow the voice instructions. For a child who hasn't started elementary school, use preschool pads or a preschool mode (formerly called “pediatric”) if there is one. If not, use the adult pads instead (a baby's body is small, so place them on the chest and the back).",
  },
  "救急隊に代わるまで、押すのを続けます。": { zh: "继续按压，直到急救队接手。", en: "Keep pushing until the ambulance crew takes over." },

  // ── 赤ちゃんが泣きやまない時（題・#8000 の行・0120-189-783 の行と、引用の一部は today の鍵） ──
  "こども家庭庁「赤ちゃんが泣きやまない」の言葉のまま": {
    zh: "引自儿童家庭厅“宝宝哭个不停”（中文为翻译）",
    en: "Quoted from the Children and Families Agency's “Baby won't stop crying” (translated)",
  },
  // lib/cautions.ts の CRY_LINES のうち、気をつける事の札に出ない文（札に出る文は today にある）
  "泣かれてイライラしても、当然のことです。": { zh: "被宝宝的哭声弄得烦躁，也是理所当然的。", en: "It's only natural to feel irritated when your baby cries." },
  "しかし、ピークが過ぎれば、泣きはだんだん収まってきます。": { zh: "但是，过了高峰期，哭闹就会慢慢平息下来。", en: "But once the peak has passed, the crying gradually settles down." },
  "まず、赤ちゃんが欲しがっていると思うものをたしかめてみましょう。": { zh: "首先，确认一下宝宝可能想要的东西吧。", en: "First, try checking for what you think your baby might want." },
  "ミルクをあげる・おむつを替える・抱っこをする": { zh: "喂奶、换尿布、抱一抱", en: "give milk, change the diaper, hold them" },
  "また、高熱が出ていたり、心配であれば、医療機関を受診しましょう。": {
    zh: "另外，如果发高烧，或者你感到担心，就去医疗机构就诊吧。",
    en: "Also, if your baby has a high fever, or if you are worried, see a doctor at a medical facility.",
  },
  "ページの数字は、こども家庭庁のページにあるガイドブック「赤ちゃんが泣きやまない」（制作 厚生労働省）のページです。": {
    zh: "页码是儿童家庭厅网页上的指南手册“宝宝哭个不停”（厚生劳动省制作）的页码。",
    en: "The page numbers are those of the guidebook “Baby won't stop crying” (produced by the Ministry of Health, Labour and Welfare) on the Children and Families Agency's website.",
  },

  // ── 妊娠中・産後のママの体（ChokeOrder.tsx の MamaUrgent） ──
  "妊娠中の体の急ぎ": { zh: "怀孕期间身体的紧急情况", en: "Urgent body problems during pregnancy" },
  "産後の体の急ぎ": { zh: "产后身体的紧急情况", en: "Urgent body problems after birth" },
  "出血・熱・強い痛み・息苦しさなど、ママの体の事で心配な時": {
    zh: "出血、发烧、剧烈疼痛、呼吸困难等，妈妈的身体有让人担心的情况时",
    en: "When you're worried about Mom's body, such as bleeding, fever, severe pain, or trouble breathing",
  },
  // 国の様式 p.6。中文は外国語版の母子健康手帳（R5）の訳のまま。English は直訳寄り（公の訳は「強い張り」を bloated stomach としている）
  "出血や破水、おなかの強い張りや痛み、胎動の減少を感じたら、すぐに医療機関を受診しましょう。": {
    zh: "如有出血、破水、很强的腹部紧张感或感到疼痛、胎动减少时，应立即就诊。",
    en: "If you notice bleeding, your water breaking, strong tightening or pain in your belly, or fewer movements from your baby, see a doctor at a medical facility right away.",
  },
  // 国の様式 p.5。中文は外国語版の母子健康手帳（R5）の訳（R8 の「医師など」に合わせて「医生等」）。English は直訳寄り（公の訳は「すぐに」を落としている）
  "また、つわりで衰弱がひどいとき、イライラや動悸がはげしく、不安感が強いとき、今まであった胎動を感じなくなったときは、すぐに医師などに相談しましょう。": {
    zh: "此外，因妊娠反应而变得极度虚弱时；强烈烦躁或心悸时；感到强烈不安时；原本正常的胎动突然感觉不到时，请立即向医生等咨询。",
    en: "Also, if morning sickness has made you very weak, if your irritability or palpitations are intense and you feel very anxious, or if you no longer feel the baby movements you used to feel, consult a doctor or other professional right away.",
  },
  "（母子手帳・国の様式）": {
    zh: "（母子健康手册（母子手帳）的国家规定格式）",
    en: " (Maternal and Child Health Handbook (母子手帳), national standard form)",
  },
  "かかっている産院に電話します（夜間も）。": { zh: "打电话给你就诊的产科医院（夜间也可以）。", en: "Call your maternity clinic (even at night)." },
  "お産をした産院に電話します（夜間も）。どうするかは、電話で産院が教えてくれます。": {
    zh: "打电话给你分娩的医院（夜间也可以）。该怎么做，医院会在电话里告诉你。",
    en: "Call the clinic where you gave birth (even at night). The clinic will tell you over the phone what to do.",
  },
  "体の事で心配な時は、かかっている産院（お産をした産院）に電話します（夜間も）。どうするかは、電話で産院が教えてくれます。": {
    zh: "身体有让人担心的情况时，打电话给你就诊的产科医院（分娩的医院）（夜间也可以）。该怎么做，医院会在电话里告诉你。",
    en: "If you're worried about your body, call your maternity clinic (the clinic where you gave birth) (even at night). The clinic will tell you over the phone what to do.",
  },
  // 「退院時の記録」は外国語版の母子健康手帳（R5）の欄の名（中文 出院时的记录・English Condition at Time of Hospital Discharge）
  "番号は、診察券や産院の書類で探せます。": { zh: "号码可以在就诊卡或产科医院的文件上找到。", en: "You can find the number on your patient card or the clinic's paperwork." },
  "番号は、母子手帳の「退院時の記録」の欄や、診察券で探せます。": {
    zh: "号码可以在母子健康手册（母子手帳）的“出院时的记录”栏或就诊卡上找到。",
    en: "You can find the number in the “Condition at Time of Hospital Discharge” section of the Maternal and Child Health Handbook (母子手帳), or on your patient card.",
  },
  "番号は、診察券や産院からもらった書類、母子手帳の「退院時の記録」の欄で探せます。": {
    zh: "号码可以在就诊卡、产科医院给的文件，或母子健康手册（母子手帳）的“出院时的记录”栏中找到。",
    en: "You can find the number on your patient card, in the paperwork from the clinic, or in the “Condition at Time of Hospital Discharge” section of the Maternal and Child Health Handbook (母子手帳).",
  },
  "{name}に電話": { zh: "打电话给{name}", en: "Call {name}" },
  "かかっている産院": { zh: "你就诊的产科医院", en: "your maternity clinic" },
  // ページの下に出す時の一言（119・#7119 のリンクの前後で分けた）。English は「迷わず」を don't hesitate to call にして、番号を後ろに置く
  "命が危ないと思ったら、迷わず": { zh: "如果觉得有生命危险，请毫不犹豫地拨打", en: "If you think a life is in danger, don't hesitate to call" },
  "救急車を呼ぶか迷う時は": { zh: "拿不准要不要叫救护车时，请拨打", en: "If you're not sure whether to call an ambulance, call" },
  "。": { zh: "。", en: ". " },

  // ── ページの下（このページについて・なぜ？（出典）） ──
  "このページは、手当の要点を短くまとめた物です。手当は、消防署などの救命講習で一度体で覚えておくのがいちばんです。": {
    zh: "本页简要汇总了急救的要点。急救方法，最好在消防署等举办的救命讲习中亲手学一次。",
    en: "This page is a short summary of the key points of first aid. The best way to learn first aid is to practice it once, hands-on, at a lifesaving course held by a fire station or others.",
  },
  "なぜ？（出典）": { zh: "为什么？（出处）", en: "Why? (Sources)" },
  "日本救急医療財団「救急蘇生法の指針2025（市民用）」と日本蘇生協議会「JRC蘇生ガイドライン2025」を元に、消防庁が全国の消防へ出した通知（消防救第385号・2026年10月23日）の「主に市民が行う一次救命処置」から、言葉を短くしました。2025年版で、赤ちゃんの胸を押すのは指2本から片手の手のひらの付け根に変わり、1歳を過ぎた子の窒息は背中をたたくのが先になりました。": {
    zh: "以日本急救医疗财团“急救复苏法指南2025（市民用）”和日本复苏协议会“JRC复苏指南2025”为基础，消防厅向全国消防部门发出了通知（消防救第385号，2026年10月23日）。本页从其中的“主要由市民实施的基础生命支持”缩短了文字。在2025年版中，按压婴儿胸部从用2根手指改为用一只手的手掌根部；1岁以上的孩子窒息时，改为先击打背部。",
    en: "We shortened the wording of “Basic life support performed mainly by citizens” from the notice the Fire and Disaster Management Agency sent to fire departments nationwide (notice 消防救第385号, October 23, 2026), based on the Japan Foundation for Emergency Medicine's “Guidelines for Emergency Resuscitation 2025 (for citizens)” and the Japan Resuscitation Council's “JRC Resuscitation Guidelines 2025.” In the 2025 edition, pushing on a baby's chest changed from 2 fingers to the heel of one hand, and for choking in children over 1, back blows now come first.",
  },
  "紙の母子健康手帳の「子どもの事故の手当」のページ（こども家庭庁 任意様式 2026年1月15日版 73〜75ページ）は、2025年版より前の書き方です。原文はそれぞれのページで読めます。": {
    zh: "纸质母子健康手册（母子健康手帳）中“儿童事故的急救”那几页（儿童家庭厅 任意样式 2026年1月15日版 第73～75页），是按2025年版之前的写法写的。原文可以在各个出处的网页上阅读。",
    en: "The “First aid for children's accidents” pages in the paper Maternal and Child Health Handbook (母子健康手帳) (Children and Families Agency optional pages, January 15, 2026 edition, pp. 73–75) are written as before the 2025 edition. You can read the originals on each source page.",
  },
  // 出典の一覧（page.tsx の SOURCES の label。並べる区切りも訳す）
  "消防庁の通知（救急蘇生法の指針2025）": {
    zh: "消防厅的通知（急救复苏法指南2025）",
    en: "Fire and Disaster Management Agency notice (Guidelines for Emergency Resuscitation 2025)",
  },
  "JRC蘇生ガイドライン2025": { zh: "JRC复苏指南2025", en: "JRC Resuscitation Guidelines 2025" },
  "こども家庭庁 母子健康手帳について": {
    zh: "儿童家庭厅 关于母子健康手册（母子健康手帳）",
    en: "Children and Families Agency, About the Maternal and Child Health Handbook (母子健康手帳)",
  },
  "厚生労働省 #8000": { zh: "厚生劳动省 #8000", en: "Ministry of Health, Labour and Welfare, #8000" },
  "消防庁 #7119": { zh: "消防厅 #7119", en: "Fire and Disaster Management Agency, #7119" },
  "消防庁 救急受診ガイド": { zh: "消防厅 急救就诊指南", en: "Fire and Disaster Management Agency, Emergency Consultation Guide" },
  "消防庁 救急車を上手に使いましょう": { zh: "消防厅 正确使用救护车", en: "Fire and Disaster Management Agency, Use Ambulances Wisely" },
  "こども家庭庁 赤ちゃんが泣きやまない": { zh: "儿童家庭厅 宝宝哭个不停", en: "Children and Families Agency, Baby won't stop crying" },
  "消防庁 NET119": { zh: "消防厅 NET119", en: "Fire and Disaster Management Agency, NET119" },
  "電話リレーサービス": { zh: "电话中继服务", en: "Phone relay service" },
  " ・ ": { zh: "、", en: ", " },
  "#8000 は、厚生労働省の「子ども医療電話相談事業」で、都道府県が行っています（つながる時間は都道府県ごとに違います）。": {
    zh: "#8000 是厚生劳动省的“儿童医疗电话咨询事业”，由各都道府县运营（接通时间因都道府县而异）。",
    en: "#8000 is the Ministry of Health, Labour and Welfare's “children's medical phone consultation service,” run by each prefecture (hours differ by prefecture).",
  },
  "「#8000」「#7119」のように「#」の入った番号は、電話によっては、画面のボタンからかからない事があります。そのため、すぐ下に、わが家の県の窓口のふつうの番号を添えています（#8000 は厚生労働省の実施状況の表〈2026年5月22日現在〉の「一般ダイヤル回線」の番号、#7119 は消防庁の一覧の「♯7119 又は」の後の番号）。": {
    zh: "像“#8000”“#7119”这样带“#”的号码，有的电话从画面上的按钮可能拨不出去。所以在按钮的正下方，附上了你家所在都道府县的窗口的普通号码（#8000 是厚生劳动省实施情况表〈截至2026年5月22日〉中“一般拨号线路”的号码，#7119 是消防厅一览表中写在“♯7119 或”后面的号码）。",
    en: "Numbers with “#” in them, like “#8000” and “#7119,” may not dial from the on-screen button on some phones. So right below the button, we add the regular number for your prefecture's line (for #8000, the number in the “general dial line” column of the Ministry of Health, Labour and Welfare's implementation table as of May 22, 2026; for #7119, the number after “♯7119 or” in the Fire and Disaster Management Agency's list).",
  },
  "#7119 は、消防庁の「救急安心センター事業」で、救急車を呼ぶか・今すぐ病院へ行くかを迷う時に相談できます。2026年10月の一覧では42の地域が行っていて、三重・島根・佐賀・宮崎・鹿児島はまだ無く、北海道・愛知・和歌山は一部の町だけです。このページは、わが家の住む町にある時だけ出します（町は、わが家の情報の都道府県と市区町村から）。": {
    zh: "#7119 是消防厅的“急救安心中心事业”，在拿不准要不要叫救护车、要不要马上去医院时，可以打电话咨询。根据2026年10月的一览表，有42个地区在实施；三重、岛根、佐贺、宫崎、鹿儿岛还没有，北海道、爱知、和歌山只有部分市町村有。本页只在你家所住的地方有 #7119 时才显示（地方根据你家信息中的都道府县和市区町村判断）。",
    en: "#7119 is the Fire and Disaster Management Agency's “Emergency Safety Center” service, which you can call when you're not sure whether to call an ambulance or go to a hospital right away. As of the October 2026 list, 42 areas offer it; Mie, Shimane, Saga, Miyazaki, and Kagoshima do not have it yet, and in Hokkaido, Aichi, and Wakayama only some towns do. This page shows it only when it's available where your family lives (the town comes from the prefecture and city in your family's information).",
  },
  "119 の例（息をしていない・反応が無い・けいれんが止まらない）は、消防庁の「救急受診ガイド」と「救急車を上手に使いましょう」の言葉です。ほかにも命が危ないと思ったら、迷わず119です。ママの体の札の引用は、母子健康手帳の国の様式（こども家庭庁）の言葉です。泣きやまない時の札は、こども家庭庁のページ「赤ちゃんが泣きやまない」の言葉をそのまま引いています。": {
    zh: "119 的例子（没有呼吸、没有反应、痉挛不止）用的是消防厅“急救就诊指南”和“正确使用救护车”中的说法。其他情况也一样，只要觉得有生命危险，就请毫不犹豫地拨打119。妈妈身体卡片中的引文，出自母子健康手册（母子健康手帳）的国家规定格式（儿童家庭厅）。宝宝哭个不停时的卡片，引用的是儿童家庭厅网页“宝宝哭个不停”的原文（中文为翻译）。",
    en: "The 119 examples (not breathing, not responding, seizures that won't stop) are in the words of the Fire and Disaster Management Agency's “Emergency Consultation Guide” and “Use Ambulances Wisely.” In other cases too, if you think a life is in danger, call 119 without hesitation. The quotes on Mom's body card come from the national standard form of the Maternal and Child Health Handbook (母子健康手帳) (Children and Families Agency). The crying card quotes the Children and Families Agency page “Baby won't stop crying” as written (translated here).",
  },
  "NET119 は、声での119番が難しい人が、スマホの画面から文字で通報できる仕組みです（消防庁。2026年4月で全国719の消防本部のうち677本部。使う前に住む町の消防本部への登録が要ります）。電話リレーサービスは、法律にもとづく公共の仕組みで、通訳の人が手話や文字と声をつないでくれます（24時間。110・119・118にもかけられます）。": {
    zh: "NET119 是让难以用声音拨打119的人，能用手机画面以文字报警的系统（消防厅。截至2026年4月，全国719个消防本部中有677个可用。使用前需要在所住市区町村的消防本部登记）。电话中继服务是依法设立的公共系统，由翻译人员把手语或文字和声音连接起来（24小时，也能拨打110、119、118）。",
    en: "NET119 lets people who can't easily call 119 by voice report an emergency in text from a smartphone screen (Fire and Disaster Management Agency; 677 of 719 fire departments nationwide as of April 2026; register with your local fire department before using it). The phone relay service is a public system based on law: interpreters connect sign language or text with voice (24 hours; you can also call 110, 119, and 118).",
  },

  // ── 合言葉の画面（app/unlock/）と、その口（/api/unlock の断り。route() を通らないので口が tFor で訳す） ──
  "家族の合言葉": { zh: "家庭口令", en: "Family passphrase" },
  "この手帳は家族だけが開けます。教えてもらった合言葉を入れてください（この端末では1年間聞きません）。": {
    zh: "这本手册只有家人才能打开。请输入家人告诉你的口令（这台设备1年内不会再问）。",
    en: "Only your family can open this handbook. Enter the passphrase you were given (this device won't ask again for 1 year).",
  },
  "合言葉": { zh: "口令", en: "Passphrase" },
  "確かめています…": { zh: "正在确认…", en: "Checking…" },
  "開く": { zh: "打开", en: "Open" },
  "通信できませんでした。電波のある所でもう一度押してください": { zh: "无法连接网络。请在有信号的地方再点一次", en: "Couldn't connect. Please tap again where you have a signal" },
  "合言葉が違います": { zh: "口令不对", en: "That passphrase isn't right" },
  "何度も違ったので、10分ほど待ってからもう一度入れてください": {
    zh: "错误次数太多，请等10分钟左右再输入",
    en: "Too many wrong tries. Please wait about 10 minutes and try again",
  },

  // ── 急ぎの時の画面で引く、ほかの画面と同じ鍵（2026-11-05 に today.ts から移した。訳は前のまま）──
  // この画面は作る時に1回だけ組み立てる（通信が無くても開けるよう）ので、根の layout はクッキーを読めず日本語の辞書で描く。
  // 画面の側で端末の言葉を読み、lib/i18n/emergency-dict.ts（core.ts とこの辞書の分だけ）で描き直す（app/emergency/EmergencyLang.tsx）。
  // そのため、この画面で引く鍵は、今日の画面の札・頼れる所と同じ鍵もここに置く（試験 emergency-dict.test.ts）。
  電話する: { zh: "打电话", en: "Call" },
  "赤ちゃんが泣きやまない時": { zh: "宝宝哭个不停时", en: "When your baby won't stop crying" },
  "子どもの事で、受診するか迷う時（夜や休みの日）": { zh: "孩子的事拿不准要不要就医时（晚上或休息日）", en: "When you're unsure whether your child needs to see a doctor (nights and days off)" },
  "「出産や子育てに悩んだ時は、こちらにお電話ください。」（こども家庭庁・無料）": {
    zh: "“生育或育儿有烦恼时，请拨打这个电话。”（儿童家庭厅，免费）",
    en: "“If you are struggling with childbirth or raising a child, please call here.” (Children and Families Agency, free)",
  },
  "{instead} につながらない時は、{tel}（{where}の窓口）にかける": { zh: "{instead} 打不通时，拨打 {tel}（{where}的窗口）", en: "If {instead} doesn't connect, call {tel} ({where} line)" },
  つながらない時は: { zh: "打不通时", en: "If it doesn't connect:" },
  妊娠中: { zh: "孕期", en: "Pregnancy" },
  "赤ちゃんが泣いても、誰が悪いわけでもないのです。": { zh: "宝宝哭，并不是谁的错。", en: "When a baby cries, it is no one's fault." },
  "これまでの研究で、関わり方によらず生後1-2か月に泣きのピークがあることがわかりました。": { zh: "以往的研究发现，无论怎样照顾，宝宝的哭闹都会在出生后1-2个月时达到高峰。", en: "Research so far has found that crying peaks at 1-2 months after birth, no matter how the baby is cared for." },
  "いろいろ試しても泣きやまない。それでも問題ありません。": { zh: "试了各种办法还是哭个不停。即使这样也没有问题。", en: "You try all sorts of things, and the crying still won't stop. Even so, that's not a problem." },
  "その時は、赤ちゃんを安全な場所に寝かせて、その場を離れましょう。": { zh: "这时，把宝宝放在安全的地方躺好，离开那里吧。", en: "When that happens, lay your baby down in a safe place and step away." },
  "そして自分がリラックスしましょう。": { zh: "然后让自己放松一下吧。", en: "Then let yourself relax." },
  "少ししたら、戻って赤ちゃんの様子を確認しましょう。": { zh: "过一会儿，再回去看看宝宝的情况吧。", en: "After a little while, go back and check on your baby." },
  "無理に泣きやませようと激しく揺さぶらないでください。": { zh: "请不要为了强行让宝宝停止哭泣而剧烈摇晃宝宝。", en: "Please do not shake your baby violently to try to force them to stop crying." },
  "また、泣き声が周囲に聞こえないようにと赤ちゃんの口をふさがないでください。": { zh: "另外，请不要为了不让周围听到哭声而捂住宝宝的嘴。", en: "Also, please do not cover your baby's mouth to keep others from hearing the crying." },
} satisfies Entries;
