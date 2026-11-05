// 辞書: 予定（lib/milestones.ts の MILESTONES と、scheduleFor が家族の形で変える言い方・lib/older.ts の上の子の予定）の
// 見出し（plain）・一言（hint）・正式な言い方（title）。描く時は lib/i18n/milestone-words.ts の msWords() を通す。
// 法の根拠の長い文（basis）は、まだ訳さない（日本語のまま出る）。
// 書き方は lib/i18n/index.ts の頭。言葉は lib/i18n/glossary.ts にそろえる。同じ鍵を2つの場所に置かない（core.ts などにある鍵は、そちらを使う）
// - 窓口で日本語を言う言葉（用語集の counter と、届け・給付の名前）は、見出しに日本語を括弧で並べる（提交出生登记（出生届））
// - 金額・日数・週数・法の期限は1字も変えない。体の判断・医療の助言を足さない
// - 町（区市町村）は zh「市区町村」・en「city」、役所は zh「市区町村政府」・en「city office」、里帰り先は zh「回乡分娩地」・en「your hometown」、
//   上の子は zh「大孩子」・en「older child」、保育園は zh「保育园」・en「daycare」、ハローワークは zh「公共职业安定所」・en「Hello Work」
// - 「済んだ」のボタンは zh “完成”・en "Done" で引く
// - 名前・人数・町・上の子の呼び方の入る言い方は、いちばん下の「差し込みの鍵」（msWords が形を見て引く）
import type { Entries } from "..";

export default {
  // ───────── 妊娠中 ─────────
  "妊娠の届出と母子健康手帳の受け取り": {
    zh: "申报怀孕，领取母子健康手册",
    en: "Pregnancy notification and getting the Maternal and Child Health Handbook",
  },
  "役所に妊娠を届ける": { zh: "向市区町村政府申报怀孕", en: "Report your pregnancy to the city office" },
  "母子手帳と健診の補助券。面談で支援給付の1回目も": {
    zh: "领取母子健康手册和健康检查补助券。面谈时也可以申请第1次支援给付",
    en: "You get the Maternal and Child Health Handbook and checkup vouchers. You can also apply for the 1st support benefit at the interview",
  },

  "里帰り先の産院に、お産の予約をする": { zh: "在回乡分娩地的分娩医院预约分娩", en: "Book your delivery at a maternity clinic in your hometown" },
  "里帰り先の産院を予約する": { zh: "预约回乡分娩地的分娩医院", en: "Book a maternity clinic in your hometown" },
  "早めに。多くの産院は妊娠中期までに予約が要ります": {
    zh: "要尽早。很多分娩医院需要在妊娠中期之前预约",
    en: "Do it early. Many clinics need a booking by mid-pregnancy",
  },

  "職場に妊娠を伝え、産休・育休の段取りを相談する": {
    zh: "告诉工作单位你怀孕了，商量产前产后休假和育儿休假的安排",
    en: "Tell work about your pregnancy and talk through plans for maternity leave and childcare leave",
  },
  "職場に妊娠を伝える": { zh: "告诉工作单位你怀孕了", en: "Tell work about your pregnancy" },
  "産休・育休の段取りを一緒に決めます": { zh: "一起决定产前产后休假和育儿休假的安排", en: "Plan your maternity leave and childcare leave together" },

  "退職の日を職場と決める（産休を取ってからか・出産手当金を受け取れるかも確かめる）": {
    zh: "和工作单位决定离职日期（也要确认是否先休产前产后休假，以及能否领取分娩补贴）",
    en: "Set your last day with work (also check whether to take maternity leave first and whether you can get the maternity allowance)",
  },
  "退職の日を職場と決める": { zh: "和工作单位决定离职日期", en: "Set your last day with work" },
  "産休の前か後かで、受け取れるお金が変わります": {
    zh: "在产前产后休假之前还是之后离职，能领取的钱会不一样",
    en: "Leaving before or after maternity leave changes the money you can receive",
  },

  "パートナーの育休（産後パパ育休）を職場に相談する": {
    zh: "伴侣和工作单位商量产后爸爸育儿休假（産後パパ育休）",
    en: "Your partner talks with work about childcare leave at birth (産後パパ育休)",
  },
  "パートナーの育休を職場に伝える": { zh: "向工作单位提出伴侣的育儿休假", en: "Tell work about your partner's childcare leave" },
  "産後すぐ休むなら、予定日の2週間前までに": {
    zh: "如果产后马上休假，要在预产期2周前提出",
    en: "For leave right after the birth, tell them by 2 weeks before the due date",
  },

  "国民年金の産前産後期間の保険料免除を届け出る": {
    zh: "申报国民年金产前产后期间的保险费免除",
    en: "Apply for the National Pension premium exemption for the period around childbirth",
  },
  "国民年金の産前産後の免除を届ける": { zh: "申报国民年金的产前产后免除", en: "Apply for the National Pension exemption around childbirth" },
  "予定日の6か月前から届けられます": { zh: "从预产期6个月前起可以申报", en: "You can apply from 6 months before the due date" },

  "国民健康保険の産前産後期間の保険料の減額（免除）を届け出る": {
    zh: "申报国民健康保险产前产后期间的保险费减免（免除）",
    en: "Apply for the National Health Insurance premium reduction (exemption) for the period around childbirth",
  },
  "国保の産前産後の減額を届ける": { zh: "申报国民健康保险的产前产后减免", en: "Apply for the National Health Insurance reduction around childbirth" },
  "国保に入っている人。予定日の6か月前から": {
    zh: "适用于加入国民健康保险的人。从预产期6个月前起",
    en: "For people on National Health Insurance. From 6 months before the due date",
  },

  "出産の入院中、上の子を見てもらう先を決める（一時保育・ファミリー・サポート・祖父母）": {
    zh: "决定分娩住院期间由谁照看大孩子（临时保育、家庭支援中心、祖父母）",
    en: "Decide who looks after your older child while you're in the hospital for the birth (temporary childcare, Family Support, grandparents)",
  },
  "入院中の上の子の預け先を決める": { zh: "决定住院期间把大孩子托给谁", en: "Decide who looks after your older child during your hospital stay" },
  "夜中の陣痛の時に見る人も。一時保育は登録が要ります": {
    zh: "也要安排半夜阵痛时照看的人。临时保育需要先登记",
    en: "Also someone for labor in the middle of the night. Temporary childcare needs registration",
  },

  "育休中も上の子が保育園に通い続けられるか、町の決まりを確かめて申請する": {
    zh: "确认市区町村的规定，看育儿休假期间大孩子能否继续上保育园，并提出申请",
    en: "Check your city's rules on whether your older child can keep going to daycare during childcare leave, and apply",
  },
  "上の子の保育園を育休中も続ける申請": { zh: "申请育儿休假期间让大孩子继续上保育园", en: "Apply to keep your older child in daycare during childcare leave" },
  "続けられる期間と申請の期限は町ごとに違います。生まれる前に確かめると安心": {
    zh: "能继续的期间和申请期限，各市区町村不同。在宝宝出生前确认会更安心",
    en: "How long and the application deadline vary by city. Checking before the birth gives peace of mind",
  },

  "入院中と産後1か月の、上の子の送り迎えの担当を決める": {
    zh: "决定住院期间和产后1个月由谁接送大孩子",
    en: "Decide who handles your older child's drop-off and pick-up during your hospital stay and for 1 month after the birth",
  },
  "上の子の送り迎えの担当を決める": { zh: "决定由谁接送大孩子", en: "Decide who does your older child's drop-off and pick-up" },
  "入院中と、産後しばらくの分。決めておくと当日あわてません": {
    zh: "包括住院期间和产后一段时间。提前决定好，当天就不会慌",
    en: "For your hospital stay and a while after the birth. Deciding now saves a rush on the day",
  },

  "赤ちゃん訪問を里帰り先で受けたい事を、住む町に伝える": {
    zh: "告诉居住地的市区町村，你希望在回乡分娩地接受婴儿上门访问",
    en: "Tell your city you'd like the baby home visit in your hometown",
  },
  "里帰り先での訪問を頼む": { zh: "申请在回乡分娩地接受上门访问", en: "Ask for the home visit in your hometown" },
  "住む町から、里帰り先の町へ頼んでもらえます": {
    zh: "居住地的市区町村可以替你向回乡分娩地的市区町村提出请求",
    en: "Your city can ask the city in your hometown for you",
  },

  "里帰り先の町で、赤ちゃん訪問の受け方・妊婦健診の受診券の扱い・出生届を出せる所を確かめる": {
    zh: "向回乡分娩地的市区町村确认：婴儿上门访问怎么接受、孕妇健康检查的检查券怎么用、出生登记可以在哪里提交",
    en: "Check with the city in your hometown: how the baby home visit works, how prenatal checkup vouchers are handled, and where you can submit the birth registration",
  },
  "里帰り先の町で確かめる": { zh: "向回乡分娩地的市区町村确认", en: "Check with the city in your hometown" },
  "訪問の受け方・受診券・出生届の窓口": {
    zh: "上门访问怎么接受、检查券、出生登记的窗口",
    en: "The home visit, checkup vouchers, and where to submit the birth registration",
  },

  "妊婦のための支援給付の2回目を申請する（町の面談を受けて、おなかの子の数を届ける）": {
    zh: "申请第2次孕妇支援给付（在市区町村接受面谈，申报腹中宝宝的人数）",
    en: "Apply for the 2nd support benefit for pregnant women (have the city interview and report how many babies you're expecting)",
  },
  "支援給付の2回目を申請する": { zh: "申请第2次支援给付", en: "Apply for the 2nd support benefit" },
  "予定日の8週前から。1人5万円の目安（町で確かめる）": {
    zh: "从预产期8周前起。每人约5万日元（请向市区町村确认）",
    en: "From 8 weeks before the due date. About 50,000 yen per baby (check with your city)",
  },

  "RSウイルスの母子免疫ワクチン（妊婦の定期接種）を受けるか、健診で相談する": {
    zh: "在健康检查时商量是否接种RS病毒母婴免疫疫苗（孕妇的定期接种）",
    en: "At a checkup, talk about whether to get the maternal RSV vaccine (a routine vaccination for pregnant women)",
  },
  "RSウイルスのワクチンを相談する": { zh: "商量RS病毒疫苗", en: "Talk about the RSV vaccine" },
  "28〜36週に1回。受けるかは健診で": { zh: "在28～36周接种1次。是否接种，在健康检查时商量", en: "1 dose, between weeks 28 and 36. Talk it over at a checkup" },

  "産後ケアの申し込み方を町で確かめる（泊まり・通い・家に来てもらう）": {
    zh: "向市区町村确认产后护理的申请方法（住宿、日间、上门）",
    en: "Check with your city how to apply for postpartum care (overnight stays, day visits, or home visits)",
  },
  "産後ケアの申し込み方を確かめる": { zh: "确认产后护理的申请方法", en: "Check how to apply for postpartum care" },
  "出産後1年まで。泊まり・通い・訪問": { zh: "产后1年内可以使用。有住宿、日间、上门几种", en: "Up to 1 year after the birth. Overnight stays, day visits, or home visits" },

  "出産育児一時金の直接支払制度の書類を産院で出す": {
    zh: "在分娩医院提交分娩育儿一次性补贴直接支付制度的文件",
    en: "Submit the direct payment forms for the Childbirth and Childcare lump-sum grant at your maternity clinic",
  },
  "出産のお金の書類を産院に出す": { zh: "向分娩医院提交分娩费用的文件", en: "Hand in the birth payment forms at your clinic" },
  "退院の時に大きなお金を払わずにすみます": { zh: "这样出院时就不用支付一大笔钱", en: "So you don't have to pay a large sum when you leave the hospital" },

  "産休・育休のお金の手続きを、勤め先にまとめて頼む（出産手当金・保険料の免除・育児休業給付・振込の口座）": {
    zh: "把产前产后休假和育儿休假的补贴手续一起委托给工作单位（分娩补贴、保险费免除、育儿休假补贴、收款账户）",
    en: "Ask your employer to handle all the money paperwork for maternity leave and childcare leave (maternity allowance, premium exemption, childcare leave benefit, bank account for payments)",
  },
  "産休・育休のお金の手続きを職場に頼む": {
    zh: "请工作单位办理产前产后休假和育儿休假的补贴手续",
    en: "Ask work to handle the money paperwork for maternity leave and childcare leave",
  },
  "出産手当金・保険料の免除・育休の給付。産休の前に": {
    zh: "分娩补贴、保险费免除、育儿休假的补贴。在产前产后休假之前",
    en: "Maternity allowance, premium exemption, childcare leave pay. Before maternity leave",
  },

  "パートナーの育休を、生まれて8週の間に通算14日以上にするか決める（出生後休業支援給付の上乗せ）": {
    zh: "决定伴侣的育儿休假是否在出生后8周内累计14天以上（出生后休假支援补贴的追加）",
    en: "Decide whether your partner takes 14 or more days of childcare leave in total within 8 weeks of the birth (the post-birth leave support benefit top-up)",
  },
  "パートナーの育休の日数を決める": { zh: "决定伴侣育儿休假的天数", en: "Decide how many days of childcare leave your partner takes" },
  "14日以上で、賃金の13%の上乗せ（最大28日分）": { zh: "休14天以上，追加工资的13%（最多28天）", en: "14 days or more adds 13% of wages (up to 28 days)" },

  "産前休業が始められる（予定日の6週前）": { zh: "可以开始产前休假（预产期前6周）", en: "You can start maternity leave before the birth (6 weeks before the due date)" },
  "産休に入れる": { zh: "可以开始产前产后休假", en: "You can start maternity leave" },
  "予定日も入れて6週。予定日の41日前から休めます": {
    zh: "包括预产期在内共6周。从预产期前41天起可以休假",
    en: "6 weeks, counting the due date. You can take leave from 41 days before the due date",
  },

  "退職したら、母の健康保険を切り替える（家族の扶養・国民健康保険・任意継続のどれか）": {
    zh: "离职后，切换母亲的健康保险（家人的被抚养人、国民健康保险、任意继续，选其一）",
    en: "After leaving your job, switch the mother's health insurance (a family member's dependent, National Health Insurance, or voluntary continuation)",
  },
  "母の健康保険を切り替える": { zh: "切换母亲的健康保险", en: "Switch the mother's health insurance" },
  "辞めた次の日から。国保なら14日以内に届けます": {
    zh: "从离职第二天起。加入国民健康保险的话，要在14天以内申报",
    en: "From the day after you leave. For National Health Insurance, register within 14 days",
  },

  // ───────── 生まれてから ─────────
  "出生届を出す": { zh: "提交出生登记（出生届）", en: "Submit the birth registration (出生届)" },
  "生まれた日から14日以内": { zh: "从出生当天起14天以内", en: "Within 14 days from the day of birth" },

  "児童手当を申請する": { zh: "申请儿童补贴", en: "Apply for the child allowance" },
  "児童手当を申し込む": { zh: "申请儿童补贴（児童手当）", en: "Apply for the child allowance (児童手当)" },
  "生まれた日の翌日から15日以内に出すと、翌月分から受け取れます": {
    zh: "在出生第二天起15天以内申请，就能从下个月起领取",
    en: "Apply within 15 days from the day after the birth to receive it from the next month",
  },

  "児童手当の額を変える届けを出す（額改定の請求）": {
    zh: "提交变更儿童补贴金额的申请（额度变更请求）",
    en: "Submit a request to change the child allowance amount (amount revision claim)",
  },
  "児童手当の額を変える届けを出す": { zh: "申请变更儿童补贴（児童手当）的金额", en: "Request a change to the child allowance (児童手当) amount" },
  "上の子の手当に足します。15日以内に": { zh: "加到大孩子的补贴里。15天以内办理", en: "It's added to your older child's allowance. Within 15 days" },

  "赤ちゃんを健康保険に入れる": { zh: "给宝宝加入健康保险", en: "Enroll the baby in health insurance" },
  "赤ちゃんの保険証を作る": { zh: "办理宝宝的健康保险证", en: "Get the baby's health insurance card" },
  "1か月健診までに": { zh: "在满月儿健康检查之前", en: "By the one-month checkup" },

  "子ども医療費助成の受給者証を申請する": {
    zh: "申请小儿医疗费补助的受给者证",
    en: "Apply for the recipient certificate for the medical expense subsidy for children",
  },
  "子どもの医療費助成を申し込む": { zh: "申请小儿医疗费补助", en: "Apply for the medical expense subsidy for children" },
  "病院代の助成が受けられます": { zh: "看病的费用可以获得补助", en: "You can get help with medical bills" },

  "児童扶養手当を申請する（ひとり親の家庭）": { zh: "申请儿童抚养津贴（单亲家庭）", en: "Apply for the child rearing allowance (single-parent families)" },
  "児童扶養手当を申し込む": { zh: "申请儿童抚养津贴（児童扶養手当）", en: "Apply for the child rearing allowance (児童扶養手当)" },
  "申し込んだ次の月の分から。早めに": { zh: "从申请后的下个月起发放。尽早申请", en: "Paid from the month after you apply. Apply early" },

  "ひとり親家庭等医療費助成を申請する": { zh: "申请单亲家庭等医疗费补助", en: "Apply for the medical expense subsidy for single-parent families" },
  "ひとり親の医療費助成を申し込む": { zh: "申请单亲家庭的医疗费补助", en: "Apply for the single-parent medical subsidy" },
  "親と子の病院代の助成。町ごとに中身が違います": { zh: "补助父母和孩子看病的费用。内容各市区町村不同", en: "Help with medical bills for parent and child. Details vary by city" },

  "出生連絡票（新生児訪問の申し込み）を出す": { zh: "提交出生联络单（申请新生儿访问）", en: "Send the birth notification card (to request a newborn home visit)" },
  "出生連絡票を出す": { zh: "提交出生联络单（出生連絡票）", en: "Send the birth notification card (出生連絡票)" },
  "保健師さんが家に来てくれます": { zh: "保健师会到家里来访", en: "A public health nurse will visit your home" },

  "低出生体重児の届出（2500g 未満で生まれた子）": { zh: "低出生体重儿申报（出生时不足2500g的孩子）", en: "Low birth weight notification (for a baby born under 2500g)" },
  "小さく生まれた子の届けを出す": { zh: "为出生时较小的宝宝提交申报", en: "Report a baby born small" },
  "生まれた時の体重が2500g未満の時。住む町に届けます": {
    zh: "出生体重不足2500g时。向居住地的市区町村申报",
    en: "When the birth weight was under 2500g. Report to your city",
  },

  "未熟児養育医療の給付を申請する（入院が要る、小さく生まれた子の医療費）": {
    zh: "申请未熟儿养育医疗给付（需要住院的、出生时较小的宝宝的医疗费）",
    en: "Apply for premature baby medical care benefits (medical costs for a baby born small who needs hospital care)",
  },
  "養育医療を申し込む": { zh: "申请养育医疗（養育医療）", en: "Apply for premature baby medical care (養育医療)" },
  "入院中の医療費の助成。病院で書類をもらいます": {
    zh: "补助住院期间的医疗费。在医院领取文件",
    en: "Help with medical costs during the hospital stay. Get the forms at the hospital",
  },

  "職場に出産の報告と育休の開始を伝える": { zh: "向工作单位报告分娩，并告知育儿休假的开始", en: "Tell work about the birth and the start of your childcare leave" },
  "職場に生まれた事を伝える": { zh: "告诉工作单位宝宝出生了", en: "Tell work the baby is born" },
  "育休の始まりも一緒に": { zh: "同时告知育儿休假的开始", en: "Also when your childcare leave starts" },

  "パートナーの職場に出産の報告をする（扶養・育休の届けの入口）": {
    zh: "向伴侣的工作单位报告分娩（办理被抚养人和育儿休假申报的第一步）",
    en: "Report the birth to your partner's workplace (the first step for dependent and childcare leave paperwork)",
  },
  "パートナーの職場に生まれた事を伝える": { zh: "告诉伴侣的工作单位宝宝出生了", en: "Tell your partner's work the baby is born" },
  "赤ちゃんを扶養に入れる・育休の届けの入口です": {
    zh: "这是把宝宝加入被抚养人、申报育儿休假的第一步",
    en: "The first step to add the baby as a dependent and to file for childcare leave",
  },

  "産婦健診（産後2週間ごろ）を受ける": { zh: "接受产妇健康检查（产后2周左右）", en: "Get the postpartum checkup for mothers (around 2 weeks after the birth)" },
  "産婦健診（産後2週間）を受ける": { zh: "接受产妇健康检查（产后2周）", en: "Get the postpartum checkup for mothers (2 weeks after the birth)" },
  "健診の券は町ごと。赤ちゃんの便の色も見る": {
    zh: "检查券各市区町村不同。也看看宝宝大便的颜色",
    en: "Checkup vouchers vary by city. Also look at the color of the baby's stool",
  },

  "1か月健診": { zh: "满月儿健康检查", en: "One-month checkup" },
  "ママの産婦健診も一緒に。便色カードも": {
    zh: "妈妈的产妇健康检查也一起做。还有大便颜色卡",
    en: "Mom has her postpartum checkup for mothers at the same visit. The stool color card too",
  },

  "乳児家庭全戸訪問（こんにちは赤ちゃん訪問）": { zh: "婴儿家庭全户访问（“你好宝宝”访问）", en: 'Home visits to every family with a baby (the "Hello Baby" visit)' },
  "赤ちゃん訪問を受ける": { zh: "接受婴儿上门访问", en: "Have a home visit for the baby" },
  "町の人が家に来てくれます": { zh: "市区町村的工作人员会到家里来访", en: "Someone from the city will visit your home" },

  "里帰り先で補助券が使えなかった妊婦健診の分を、住む町に申請する（償還払い）": {
    zh: "回乡分娩地无法使用补助券的孕妇健康检查费用，向居住地的市区町村申请（事后报销）",
    en: "Apply to your city for prenatal checkups in your hometown where the vouchers couldn't be used (reimbursement)",
  },
  "里帰り先の健診代を申請する": { zh: "申请报销回乡分娩地的检查费", en: "Claim your hometown checkup costs" },
  "補助券が使えない所の分は、後から町に申請します。期限は町ごと（1年以内が多い）": {
    zh: "不能使用补助券的检查费，事后向市区町村申请。期限各市区町村不同（多为1年以内）",
    en: "For places where vouchers can't be used, apply to your city afterward. Deadlines vary by city (often within 1 year)",
  },

  "住む町に戻る日の段取りを組む（保健センターへの連絡・小児科・チャイルドシート）": {
    zh: "安排回到居住地那天的事（联系保健中心、儿科、儿童安全座椅）",
    en: "Plan the day you return to your city (contacting the health center, a pediatrician, a car seat)",
  },
  "戻る日の段取りを組む": { zh: "安排回来那天的事", en: "Plan the day you return" },
  "保健センターへ連絡・チャイルドシート": { zh: "联系保健中心、儿童安全座椅", en: "Contact the health center; car seat" },

  "生後2か月の予防接種（B型肝炎・ロタウイルス・小児用肺炎球菌・五種混合の1回目）": {
    zh: "出生后2个月的预防接种（乙型肝炎、轮状病毒、小儿肺炎球菌、五联疫苗的第1次）",
    en: "Immunizations at 2 months old (1st doses of hepatitis B, rotavirus, pediatric pneumococcal, and 5-in-1)",
  },
  "予防接種を始める": { zh: "开始预防接种", en: "Start immunizations" },
  "生後2か月から。小児科などに予約します": { zh: "从出生后2个月起。向儿科等预约", en: "From 2 months old. Book with a pediatrician or other clinic" },

  "生後3か月の予防接種（B型肝炎・ロタウイルス・小児用肺炎球菌・五種混合の2回目）": {
    zh: "出生后3个月的预防接种（乙型肝炎、轮状病毒、小儿肺炎球菌、五联疫苗的第2次）",
    en: "Immunizations at 3 months old (2nd doses of hepatitis B, rotavirus, pediatric pneumococcal, and 5-in-1)",
  },
  "予防接種の2回目": { zh: "第2次预防接种", en: "2nd round of immunizations" },
  "1回目から4週ほどあけて。小児科などで": { zh: "距第1次约4周。在儿科等接种", en: "About 4 weeks after the 1st. At a pediatrician or other clinic" },

  "3〜4か月健診": { zh: "3～4个月健康检查", en: "3–4 month checkup" },
  "町から案内が届きます": { zh: "市区町村会寄来通知", en: "Your city will send you a notice" },

  "生後4か月の予防接種（小児用肺炎球菌・五種混合の3回目。ロタは種類による）": {
    zh: "出生后4个月的预防接种（小儿肺炎球菌、五联疫苗的第3次。轮状病毒视种类而定）",
    en: "Immunizations at 4 months old (3rd doses of pediatric pneumococcal and 5-in-1; rotavirus depends on the type)",
  },
  "予防接種の3回目": { zh: "第3次预防接种", en: "3rd round of immunizations" },
  "肺炎球菌・五種混合。ロタは3回の種類だけ": { zh: "肺炎球菌、五联疫苗。轮状病毒只有3次型才接种", en: "Pneumococcal and 5-in-1. Rotavirus only for the 3-dose type" },

  "保育園の情報を集め、見学の予約をする": { zh: "收集保育园的信息，预约参观", en: "Gather information on daycares and book visits" },
  "保育園を調べて、見学を申し込む": { zh: "了解保育园，申请参观", en: "Look into daycares and sign up for visits" },
  "申し込みの時期は町ごとに違います": { zh: "申请时间各市区町村不同", en: "Application timing varies by city" },

  "保育園の利用を申し込む（4月入園の一斉の申し込み・保育の必要性の認定）": {
    zh: "申请使用保育园（4月入园的统一申请、保育必要性的认定）",
    en: "Apply for daycare (the joint application for April entry and certification of the need for childcare)",
  },
  "保育園を申し込む": { zh: "申请保育园", en: "Apply for daycare" },
  "4月入園は前の年の秋〜冬に申し込みます。締切は町ごと": {
    zh: "4月入园要在前一年的秋季到冬季申请。截止日期各市区町村不同",
    en: "For April entry, apply in the fall or winter of the year before. Deadlines vary by city",
  },

  "保育園の申し込みに要る就労証明書を、職場に頼む": {
    zh: "请工作单位开具申请保育园所需的在职证明",
    en: "Ask work for the proof of employment needed for the daycare application",
  },
  "ママの就労証明書を職場に頼む": { zh: "请工作单位开妈妈的在职证明（就労証明書）", en: "Ask work for Mom's proof of employment (就労証明書)" },
  "保育園の申し込みに要ります。職場が書くので早めに": {
    zh: "申请保育园时需要。由工作单位填写，所以要尽早",
    en: "Needed for the daycare application. Work fills it in, so ask early",
  },

  "保育園の申し込みに要る就労証明書を、パートナーの職場に頼む": {
    zh: "请伴侣的工作单位开具申请保育园所需的在职证明",
    en: "Ask your partner's workplace for the proof of employment needed for the daycare application",
  },
  "パートナーの就労証明書を頼む": { zh: "请开伴侣的在职证明（就労証明書）", en: "Ask for your partner's proof of employment (就労証明書)" },
  "パートナーの分も要ります。職場が書くので早めに": {
    zh: "伴侣的那份也需要。由工作单位填写，所以要尽早",
    en: "Your partner's is needed too. Their work fills it in, so ask early",
  },

  "保育園の結果が届いたら、復職の日を職場と決める": {
    zh: "收到保育园的结果后，和工作单位决定复职日期",
    en: "When the daycare results arrive, set your return date with work",
  },
  "復職の日を職場と決める": { zh: "和工作单位决定复职日期", en: "Set your return date with work" },
  "入園の日と慣らし保育に合わせて決めます": { zh: "配合入园日期和适应期保育来决定", en: "Match it to the daycare start date and the settling-in period" },

  "出産手当金の申請書の、医師の証明の欄を産院で書いてもらう": {
    zh: "请分娩医院填写分娩补贴申请书上的医师证明栏",
    en: "Have your maternity clinic fill in the doctor's section of the maternity allowance application",
  },
  "出産手当金の書類に医師の証明をもらう": {
    zh: "在分娩补贴（出産手当金）的文件上请医生证明",
    en: "Get a doctor's certification on the maternity allowance (出産手当金) form",
  },
  "入院中か1か月健診で。用紙は勤め先から": {
    zh: "在住院期间或满月儿健康检查时。表格向工作单位领取",
    en: "During your hospital stay or at the one-month checkup. The form comes from your employer",
  },

  "出産手当金を申請する（勤め先を通して健康保険へ）": {
    zh: "申请分娩补贴（通过工作单位向健康保险申请）",
    en: "Apply for the maternity allowance (through your employer, to your health insurance)",
  },
  "出産手当金を申請する": { zh: "申请分娩补贴（出産手当金）", en: "Apply for the maternity allowance (出産手当金)" },
  "産後56日を過ぎたら。振込は申請から1〜2か月ほど": {
    zh: "产后56天过后。申请后约1～2个月到账",
    en: "After 56 days postpartum. Payment arrives about 1–2 months after you apply",
  },

  "育児休業給付の初回の申請を、勤め先に頼む（その後は2か月ごと）": {
    zh: "请工作单位办理育儿休假补贴的首次申请（之后每2个月一次）",
    en: "Ask your employer to file the 1st childcare leave benefit application (then every 2 months)",
  },
  "育休の給付の初回の申請を頼む": { zh: "请工作单位办理育儿休假补贴的首次申请", en: "Ask work to file your 1st childcare leave benefit claim" },
  "勤め先がハローワークへ。期限は育休の4か月目の月末": {
    zh: "由工作单位向公共职业安定所申请。期限是育儿休假第4个月的月底",
    en: "Your employer files it with Hello Work. The deadline is the end of the 4th month of childcare leave",
  },

  "パートナーの育休の給付（産後パパ育休の出生時育児休業給付）を、勤め先に申請してもらう": {
    zh: "请伴侣的工作单位申请育儿休假的补贴（産後パパ育休的出生时育儿休假补贴）",
    en: "Have your partner's employer apply for their childcare leave pay (the childcare leave benefit at birth for 産後パパ育休)",
  },
  "パートナーの育休の給付を申請してもらう": { zh: "请伴侣的工作单位申请育儿休假补贴", en: "Have your partner's employer apply for the childcare leave benefit" },
  "生まれて8週を過ぎてから。勤め先がハローワークへ": {
    zh: "出生8周过后。由工作单位向公共职业安定所申请",
    en: "After 8 weeks from the birth. The employer files it with Hello Work",
  },

  "育休の181日目から、育児休業給付が賃金の67%から50%に下がる。その前の月に家計を見ておく": {
    zh: "从育儿休假第181天起，育儿休假补贴从工资的67%降到50%。在那之前的一个月看看家里的收支",
    en: "From day 181 of childcare leave, the childcare leave benefit drops from 67% to 50% of wages. Look over your household budget the month before",
  },
  "育休の給付が下がる前に家計を見る": { zh: "在育儿休假补贴减少之前看看家里的收支", en: "Look over your budget before childcare leave pay drops" },
  "育休が半年を超える時。181日目から67%が50%に": {
    zh: "育儿休假超过半年时。从第181天起由67%变为50%",
    en: "If childcare leave goes past half a year. From day 181, 67% becomes 50%",
  },

  "時短で仕事に戻るなら、育児時短就業給付（時短の間の賃金の10%）を勤め先に頼む": {
    zh: "如果以缩短工时的方式复职，请工作单位申请育儿短时工作补贴（缩短工时期间工资的10%）",
    en: "If you go back on shorter hours, ask your employer for the short-hours childcare benefit (10% of wages during shorter hours)",
  },
  "時短で戻るなら時短の給付を頼む": { zh: "如果缩短工时复职，申请短时工作补贴", en: "Going back on shorter hours? Ask for the short-hours benefit" },
  "子が2歳になるまで。勤め先がハローワークへ": {
    zh: "到孩子满2岁为止。由工作单位向公共职业安定所申请",
    en: "Until your child turns 2. Your employer files it with Hello Work",
  },

  "出産育児一時金の差額を、健康保険に申請する（直接支払で、出産の費用が一時金より少なかった時）": {
    zh: "向健康保险申请分娩育儿一次性补贴的差额（使用直接支付、分娩费用低于补贴时）",
    en: "Claim the difference from the Childbirth and Childcare lump-sum grant from your health insurance (if you used direct payment and the birth cost less than the grant)",
  },
  "一時金の差額を申請する": { zh: "申请一次性补贴的差额", en: "Claim the lump-sum grant difference" },
  "費用が一時金より少なかった時だけ。明細書で見る": { zh: "只在费用低于一次性补贴时。看明细单确认", en: "Only if the cost was less than the grant. Check the itemized bill" },

  "出産の年の医療費を、医療費控除として確定申告する（妊婦健診の自己負担・通院の交通費も入る）": {
    zh: "把分娩那一年的医疗费作为医疗费扣除，进行确定申报（孕妇健康检查的自付部分、去医院的交通费也算在内）",
    en: "File a tax return to claim the medical expense deduction for the birth year (includes what you paid for prenatal checkups and travel to appointments)",
  },
  "医療費控除を申告する": { zh: "申报医疗费扣除（医療費控除）", en: "Claim the medical expense deduction (医療費控除)" },
  "出産の翌年2/16〜3/15。領収書を残す": { zh: "分娩的第二年2/16～3/15。保留好收据", en: "2/16–3/15 of the year after the birth. Keep your receipts" },

  "保育園に入れなかった時: 保留の通知を受け取り、育休を1歳6か月まで延ばす事を職場に申し出る": {
    zh: "没能进保育园时：领取保留通知，向工作单位申请把育儿休假延长到孩子1岁6个月",
    en: "If you don't get a daycare spot: get the waitlist notice and tell work you're extending childcare leave to 1 year 6 months",
  },
  "入れなかった時、育休の延長を申し出る": { zh: "没能入园时，申请延长育儿休假", en: "No spot? Ask to extend childcare leave" },
  "入れた時は「済んだ」を。1歳の誕生日の2週間前まで": {
    zh: "如果入园了，就点“完成”。在1岁生日的2周前提出",
    en: 'If you got a spot, tap "Done". By 2 weeks before the 1st birthday',
  },

  "1歳6か月でも入れなかった時: もう一度申し込み、育休を2歳まで延ばす事を職場に申し出る": {
    zh: "到1岁6个月仍没能入园时：再申请一次，并向工作单位申请把育儿休假延长到2岁",
    en: "If there's still no spot at 1 year 6 months: apply again and tell work you're extending childcare leave to age 2",
  },
  "2回目の育休の延長を申し出る": { zh: "申请第2次延长育儿休假", en: "Ask for the 2nd childcare leave extension" },
  "入れた時は「済んだ」を。1歳6か月の2週間前まで": {
    zh: "如果入园了，就点“完成”。在1岁6个月的2周前提出",
    en: 'If you got a spot, tap "Done". By 2 weeks before 1 year 6 months',
  },

  "入園が決まったら: 慣らし保育の送り迎えの担当を決め、病児保育に登録しておく": {
    zh: "确定入园后：决定适应期保育由谁接送，并提前登记病儿保育",
    en: "Once daycare is set: decide who handles drop-off and pick-up during settling-in, and register for sick-child care",
  },
  "慣らし保育と病児保育の準備": { zh: "准备适应期保育和病儿保育", en: "Get ready for settling-in and sick-child care" },
  "慣らし保育は1〜2週間ほどが多い。病児保育は登録が要ります": {
    zh: "适应期保育多为1～2周左右。病儿保育需要先登记",
    en: "Settling-in often takes about 1–2 weeks. Sick-child care needs registration",
  },

  "BCG の予防接種": { zh: "卡介苗（BCG）预防接种", en: "BCG vaccination" },
  "BCG を受ける": { zh: "接种卡介苗（BCG）", en: "Get the BCG vaccine" },
  "生後5〜8か月が目安。1歳になる前に": { zh: "一般在出生后5～8个月。在满1岁之前", en: "Usually at 5–8 months old. Before age 1" },

  "B型肝炎の予防接種（3回目）": { zh: "乙型肝炎预防接种（第3次）", en: "Hepatitis B vaccination (3rd dose)" },
  "B型肝炎の3回目を受ける": { zh: "接种第3次乙型肝炎疫苗", en: "Get the 3rd hepatitis B shot" },
  "1回目から139日以上あけて。生後7〜8か月ごろ": { zh: "距第1次间隔139天以上。出生后7～8个月左右", en: "At least 139 days after the 1st. Around 7–8 months old" },

  "9〜10か月健診": { zh: "9～10个月健康检查", en: "9–10 month checkup" },
  "多くの町で。受け方は町ごとに違います": { zh: "很多市区町村都有。接受方式各市区町村不同", en: "In many cities. How it works varies by city" },

  "1歳の予防接種（麻しん風しん（MR）・水ぼうそう（水痘）・小児用肺炎球菌の追加）": {
    zh: "1岁的预防接种（麻疹风疹（MR）、水痘、小儿肺炎球菌加强针）",
    en: "Immunizations at age 1 (measles-rubella (MR), chickenpox (varicella), pediatric pneumococcal booster)",
  },
  "1歳の予防接種": { zh: "1岁的预防接种", en: "Immunizations at age 1" },
  "1歳になったら早めに。麻しん風しん（MR）・水ぼうそう（水痘）など": {
    zh: "满1岁后尽早接种。麻疹风疹（MR）、水痘等",
    en: "Soon after turning 1. Measles-rubella (MR), chickenpox (varicella), and others",
  },

  "五種混合の追加（4回目）": { zh: "五联疫苗加强针（第4次）", en: "5-in-1 booster (4th dose)" },
  "五種混合の追加を受ける": { zh: "接种五联疫苗加强针", en: "Get the 5-in-1 booster" },
  "3回目から6か月以上あけて。1歳から1歳半ごろ": { zh: "距第3次间隔6个月以上。1岁到1岁半左右", en: "At least 6 months after the 3rd. Around age 1 to 1.5" },

  "1歳6か月健診": { zh: "1岁6个月健康检查", en: "Checkup at 1 year 6 months" },
  "1歳半健診": { zh: "1岁半健康检查", en: "1.5-year checkup" },

  "水ぼうそう（水痘）の予防接種（2回目）": { zh: "水痘预防接种（第2次）", en: "Chickenpox (varicella) vaccination (2nd dose)" },
  "水ぼうそう（水痘）の2回目を受ける": { zh: "接种第2次水痘疫苗", en: "Get the 2nd chickenpox (varicella) shot" },
  "1回目から6〜12か月あけて": { zh: "距第1次间隔6～12个月", en: "6–12 months after the 1st" },

  // ───────── 早く生まれた時 ─────────
  "パートナーの育休（産後パパ育休）の始まりを早める申し出をする（予定日より早く生まれた時）": {
    zh: "申请提前伴侣育儿休假（産後パパ育休）的开始日（宝宝比预产期早出生时）",
    en: "Ask to move up the start of your partner's childcare leave (産後パパ育休) (when the baby comes before the due date)",
  },
  "パートナーの育休の始まりを早める": { zh: "提前伴侣育儿休假的开始日", en: "Move up the start of your partner's childcare leave" },
  "1回だけ早められます。申し出は早める日の1週間前までが原則": {
    zh: "只能提前1次。原则上要在新开始日的1周前提出",
    en: "It can be moved up only once. As a rule, ask by 1 week before the new start date",
  },

  // ───────── 町を変えた時 ─────────
  "新しい町に転入届を出す": { zh: "向新住址的市区町村提交迁入申报", en: "Submit the moving-in notification to your new city" },
  "転入届を出す": { zh: "提交迁入申报（転入届）", en: "Submit the moving-in notification (転入届)" },
  "引っ越した日から14日以内に。新しい町の役所へ": { zh: "从搬家当天起14天以内。到新住址的市区町村政府办理", en: "Within 14 days of moving. At your new city office" },

  "児童手当を、新しい町に申し込む（認定の請求）": { zh: "向新住址的市区町村申请儿童补贴（认定请求）", en: "Apply for the child allowance in your new city (certification claim)" },
  "児童手当を新しい町に申し込む": { zh: "向新住址的市区町村申请儿童补贴（児童手当）", en: "Apply for the child allowance (児童手当) in your new city" },
  "引っ越した日の翌日から15日以内に": { zh: "从搬家第二天起15天以内", en: "Within 15 days from the day after you move" },

  "妊婦健診の受診券（補助券）を、新しい町で受け取る": { zh: "在新住址的市区町村领取孕妇健康检查的检查券（补助券）", en: "Get prenatal checkup vouchers from your new city" },
  "妊婦健診の券を新しい町で受け取る": { zh: "在新住址的市区町村领取孕妇健康检查（妊婦健診）的检查券", en: "Get prenatal checkup (妊婦健診) vouchers from your new city" },
  "次の健診の前に。替え方は町ごとに違います": { zh: "在下次检查之前。更换方法各市区町村不同", en: "Before your next checkup. How to switch varies by city" },

  "子どもの医療費の受給者証（医療証）を、新しい町で申し込む": {
    zh: "在新住址的市区町村申请儿童医疗费的受给者证（医疗证）",
    en: "Apply for your child's medical expense recipient certificate (medical card) in your new city",
  },
  "子どもの医療証を新しい町で申し込む": { zh: "在新住址的市区町村申请儿童医疗证", en: "Apply for your child's medical card in your new city" },
  "医療証は住む町が出します。1か月を目安に": { zh: "医疗证由居住地的市区町村发放。以1个月为目标", en: "Your city issues the medical card. Aim for about 1 month" },

  // ───────── 1000日の先 ─────────
  "3歳児健診": { zh: "3岁儿童健康检查", en: "3-year-old checkup" },
  "町から案内が届きます。目や耳の検査もあります": { zh: "市区町村会寄来通知。也有眼睛和耳朵的检查", en: "Your city will send you a notice. There are eye and ear tests too" },
  "日本脳炎の予防接種（1期の初回2回）": { zh: "日本脑炎预防接种（第1期初次2次）", en: "Japanese encephalitis vaccination (phase 1, first 2 doses)" },
  "日本脳炎の予防接種を受ける": { zh: "接受日本脑炎预防接种", en: "Get the Japanese encephalitis vaccination" },
  "標準は3歳で2回。6〜28日あけて": { zh: "标准是在3岁时接种2次。间隔6～28天", en: "Usually 2 doses at age 3, 6–28 days apart" },
  "日本脳炎の予防接種（1期の追加）": { zh: "日本脑炎预防接种（第1期加强）", en: "Japanese encephalitis vaccination (phase 1 booster)" },
  "日本脳炎の追加を受ける": { zh: "接种日本脑炎加强针", en: "Get the Japanese encephalitis booster" },
  "標準は4歳。初回の2回目からおよそ1年あけて": { zh: "标准是在4岁。距初次的第2次约间隔1年", en: "Usually at age 4. About 1 year after the 2nd initial dose" },
  "麻しん風しん（MR）の予防接種（2期）": { zh: "麻疹风疹（MR）预防接种（第2期）", en: "Measles-rubella (MR) vaccination (phase 2)" },
  "麻しん風しん（MR）の2期を受ける": { zh: "接种第2期麻疹风疹（MR）疫苗", en: "Get the phase 2 measles-rubella (MR) vaccine" },
  "小学校に入る前の1年間（年長の4月〜3月）": {
    zh: "上小学前的1年（幼儿园大班的4月～3月）",
    en: "The year before elementary school (April to March of the last preschool year)",
  },

  // ───────── 家族の形で変わる言い方（lib/milestones.ts の adjust）─────────
  // ひとり親
  "出産後1年まで。町の家事の手伝いも": { zh: "产后1年内可以使用。也可以问问市区町村的家务帮助", en: "Up to 1 year after the birth. Ask about city help with housework too" },
  // 双子など
  "産前休業が始められる（双子などは予定日の14週前）": {
    zh: "可以开始产前休假（双胞胎等为预产期前14周）",
    en: "You can start maternity leave before the birth (14 weeks before the due date for twins or more)",
  },
  "双子などは予定日も入れて14週。予定日の97日前から": {
    zh: "双胞胎等包括预产期在内共14周。从预产期前97天起",
    en: "For twins or more, 14 weeks counting the due date. From 97 days before the due date",
  },
  "出産手当金・保険料の免除・育休の給付。産休（双子などは14週前から）の前に": {
    zh: "分娩补贴、保险费免除、育儿休假的补贴。在产前产后休假（双胞胎等从14周前开始）之前",
    en: "Maternity allowance, premium exemption, childcare leave pay. Before maternity leave (from 14 weeks before for twins or more)",
  },
  "産休（双子などは14週前から）の前か後かで、受け取れるお金が変わります": {
    zh: "在产前产后休假（双胞胎等从14周前开始）之前还是之后离职，能领取的钱会不一样",
    en: "Leaving before or after maternity leave (from 14 weeks before for twins or more) changes the money you can receive",
  },
  // 早く生まれた・パートナーの育休の長さがわからない
  "予定日から8週を過ぎてから。勤め先がハローワークへ": {
    zh: "从预产期起8周过后。由工作单位向公共职业安定所申请",
    en: "After 8 weeks from the due date. The employer files it with Hello Work",
  },
  "予定日の2週前までに。14日以上で給付の上乗せ": {
    zh: "在预产期2周前提出。休14天以上，补贴会追加",
    en: "By 2 weeks before the due date. 14 days or more adds a benefit top-up",
  },
  // 保育園に預けて働く家族
  "申し込みの前に。時期と締切は町ごとに違います": { zh: "在申请之前。时间和截止日期各市区町村不同", en: "Before you apply. Timing and deadlines vary by city" },
  // 里帰り
  "予定日の8週前から。里帰り中の受け方は町に聞く": {
    zh: "从预产期8周前起。回乡分娩期间怎么申请，问居住地的市区町村",
    en: "From 8 weeks before the due date. Ask your city how it works while you're in your hometown",
  },
  "14日以内。里帰り先の役所でも出せます": {
    zh: "14天以内。也可以在回乡分娩地的市区町村政府提交",
    en: "Within 14 days. You can also submit it at the city office in your hometown",
  },
  "県の中は受診券が使える事が多い。使えなかった分だけ": {
    zh: "同一都道府县内多数可以使用检查券。只申请没能使用的部分",
    en: "Vouchers often work within the same prefecture. Only for the ones you couldn't use",
  },
  "里帰り先の産院で受けてから戻る家族が多い": {
    zh: "很多家庭会在回乡分娩地的分娩医院做完检查再回来",
    en: "Many families have it at the hometown clinic before coming back",
  },
  // 赤ちゃんが国保に入る・公務員
  "国保は役所に14日以内。出生届と同じ日に": {
    zh: "国民健康保险要在14天以内到市区町村政府办理。和出生登记同一天办",
    en: "For National Health Insurance, go to the city office within 14 days. The same day as the birth registration",
  },
  "公務員は勤め先に申請。15日以内に": { zh: "公务员向工作单位申请。15天以内", en: "Public servants apply through their employer. Within 15 days" },

  // ───────── 上の子（lib/older.ts）─────────
  "もう受けていたら「済んだ」を押してください": { zh: "如果已经做过了，请点“完成”", en: 'If it\'s already done, tap "Done"' },

  // ───────── 差し込みの鍵（msWords が形を見て引く）─────────
  // パートナーの呼び名の入る見出し（adjust: 「パートナーの…」の頭を、6字までの呼び名に変える）
  "{name}の育休を職場に伝える": { zh: "向工作单位提出{name}的育儿休假", en: "Tell work about {name}'s childcare leave" },
  "{name}の職場に生まれた事を伝える": { zh: "告诉{name}的工作单位宝宝出生了", en: "Tell {name}'s work the baby is born" },
  "{name}の就労証明書を頼む": { zh: "请开{name}的在职证明（就労証明書）", en: "Ask for {name}'s proof of employment (就労証明書)" },
  "{name}の育休の日数を決める": { zh: "决定{name}育儿休假的天数", en: "Decide how many days of childcare leave {name} takes" },
  "{name}の育休の給付を申請してもらう": { zh: "请{name}的工作单位申请育儿休假补贴", en: "Have {name}'s employer apply for the childcare leave benefit" },
  "{name}の育休の始まりを早める": { zh: "提前{name}育儿休假的开始日", en: "Move up the start of {name}'s childcare leave" },
  // 双子など（人数）
  "{what}（{n}人分）": { zh: "{what}（{n}人份）", en: "{what} (for {n} {n:baby|babies})" },
  "{what}（おなかの子{n}人分）": { zh: "{what}（腹中宝宝{n}人份）", en: "{what} (for the {n} {n:baby|babies} you're expecting)" },
  "予定日の8週前から。{n}人分（1人5万円の目安）": {
    zh: "从预产期8周前起。{n}人份（每人约5万日元）",
    en: "From 8 weeks before the due date. For {n} {n:baby|babies} (about 50,000 yen each)",
  },
  // 里帰り（町の名前）
  "14日以内。{city}・{there}・本籍地で出せる": {
    zh: "14天以内。可以在{city}、{there}或户籍所在地（本籍地）提交",
    en: "Within 14 days. You can submit it in {city}, {there}, or your registered domicile (本籍地)",
  },
  "里帰り先の町（{city}）で、赤ちゃん訪問の受け方・妊婦健診の受診券の扱い・出生届を出せる所を確かめる": {
    zh: "向回乡分娩地的市区町村（{city}）确认：婴儿上门访问怎么接受、孕妇健康检查的检查券怎么用、出生登记可以在哪里提交",
    en: "Check with the city in your hometown ({city}): how the baby home visit works, how prenatal checkup vouchers are handled, and where you can submit the birth registration",
  },
  // 上の子の呼び方（「上の子」「上の子2」。「上の子」だけの鍵は持たず、{n} を空にして引く＝msWords の childWord）
  "上の子{n}": { zh: "大孩子{n}", en: "Older child {n}" },
  // 上の子の正式な言い方（上の子（2024年12月生まれ）の3歳児健診）と、年月だけの生まれた日の印
  "{name}（{year}年{month}月生まれ）の{what}": { zh: "{name}（{year}年{month}月出生）：{what}", en: "{name} (born {month}/{year}): {what}" },
  "{what}（月の1日で数えた目安）": { zh: "{what}（按当月1日估算）", en: "{what} (estimated from the 1st of the month)" },
  // 上の子の見出し（olderPlain: 呼び方＋「の」＋もとの見出しから「を受ける」を外した物）
  "{name}の産婦健診（産後2週間）": { zh: "{name}：产妇健康检查（产后2周）", en: "{name}: postpartum checkup for mothers (2 weeks after the birth)" },
  "{name}の1か月健診": { zh: "{name}：满月儿健康检查", en: "{name}: one-month checkup" },
  "{name}の赤ちゃん訪問": { zh: "{name}：婴儿上门访问", en: "{name}: baby home visit" },
  "{name}の予防接種を始める": { zh: "{name}：开始预防接种", en: "{name}: start immunizations" },
  "{name}の予防接種の2回目": { zh: "{name}：第2次预防接种", en: "{name}: 2nd round of immunizations" },
  "{name}の3〜4か月健診": { zh: "{name}：3～4个月健康检查", en: "{name}: 3–4 month checkup" },
  "{name}の予防接種の3回目": { zh: "{name}：第3次预防接种", en: "{name}: 3rd round of immunizations" },
  "{name}のBCG": { zh: "{name}：卡介苗（BCG）", en: "{name}: BCG vaccine" },
  "{name}のB型肝炎の3回目": { zh: "{name}：第3次乙型肝炎疫苗", en: "{name}: 3rd hepatitis B shot" },
  "{name}の9〜10か月健診": { zh: "{name}：9～10个月健康检查", en: "{name}: 9–10 month checkup" },
  "{name}の1歳の予防接種": { zh: "{name}：1岁的预防接种", en: "{name}: immunizations at age 1" },
  "{name}の五種混合の追加": { zh: "{name}：五联疫苗加强针", en: "{name}: 5-in-1 booster" },
  "{name}の1歳半健診": { zh: "{name}：1岁半健康检查", en: "{name}: 1.5-year checkup" },
  "{name}の水ぼうそう（水痘）の2回目": { zh: "{name}：第2次水痘疫苗", en: "{name}: 2nd chickenpox (varicella) shot" },
  "{name}の3歳児健診": { zh: "{name}：3岁儿童健康检查", en: "{name}: 3-year-old checkup" },
  "{name}の日本脳炎の予防接種": { zh: "{name}：日本脑炎预防接种", en: "{name}: Japanese encephalitis vaccination" },
  "{name}の日本脳炎の追加": { zh: "{name}：日本脑炎加强针", en: "{name}: Japanese encephalitis booster" },
  "{name}の麻しん風しん（MR）の2期": { zh: "{name}：第2期麻疹风疹（MR）疫苗", en: "{name}: phase 2 measles-rubella (MR) vaccine" },

  // ── 予防接種の打てる最短日の一言（lib/vax-next.ts。サーバは頼みの言葉で組み、画面は「打てる最短日: {date}（{note}）」に入れる） ──
  "{date}の{vaccine}{dose}回目から中{n}日": {
    zh: "{date}打的{vaccine}第{dose}次之后，中间隔满{n}天",
    en: "{n} full {n:day|days} after dose {dose} of {vaccine} on {date}",
  },
  "{date}の{vaccine}{dose}回目から{n}か月": {
    zh: "{date}打的{vaccine}第{dose}次之后{n}个月",
    en: "{n} {n:month|months} after dose {dose} of {vaccine} on {date}",
  },
  B型肝炎: { zh: "乙型肝炎", en: "hepatitis B" },
  小児用肺炎球菌: { zh: "小儿肺炎球菌", en: "pediatric pneumococcal" },
  五種混合: { zh: "五联疫苗", en: "5-in-1" },
  水ぼうそう: { zh: "水痘", en: "chickenpox" },
  日本脳炎: { zh: "日本脑炎", en: "Japanese encephalitis" },
  "公費で受けられる年齢（{date}まで）を過ぎる見込み。小児科・保健センターに確かめる": {
    zh: "预计会超过可以公费接种的年龄（到{date}为止）。请向儿科或保健中心确认",
    en: "Likely to pass the age for publicly funded shots (until {date}). Check with a pediatrician or the health center",
  },

  // ── お金が届いたか確かめる（lib/money.ts の paidDef。lib/i18n/milestone-words.ts の形で引く）。「児童手当」は「いま」の辞書（today.ts）の訳を使う ──
  "{what}が届いたか確かめる（届く時期を過ぎたら{ask}に確かめる）": {
    zh: "确认{what}是否到账（过了应到的时间还没到，就向{ask}确认）",
    en: "Check whether {what} has arrived (if it's past the expected time, check with {ask})",
  },
  "{what}が届いたか見る": { zh: "看看{what}到账了没有", en: "See whether {what} has arrived" },
  "届いたら「済んだ」。まだなら{ask}に": { zh: "到账了就点“完成了”。还没到的话，问{ask}", en: "Once it arrives, tap “Done”. If not, ask {ask}" },
  支援給付の2回目: { zh: "第2次孕妇支援给付（妊婦のための支援給付）", en: "the 2nd support benefit for pregnant women (妊婦のための支援給付)" },
  出産手当金: { zh: "分娩补贴（出産手当金）", en: "the maternity allowance (出産手当金)" },
  育休の給付の初回: { zh: "第一笔育儿休假补贴（育児休業給付）", en: "the first childcare leave benefit (育児休業給付)" },
  育休の給付: { zh: "育儿休假补贴（育児休業給付）", en: "the childcare leave benefit (育児休業給付)" },
  パートナーの育休の給付: { zh: "伴侣的育儿休假补贴（育児休業給付）", en: "your partner's childcare leave benefit (育児休業給付)" },
  児童手当の最初の振込: { zh: "第一笔儿童补贴（児童手当）", en: "the first child allowance payment (児童手当)" },
  一時金の差額: { zh: "分娩育儿一次性补贴（出産育児一時金）的差额", en: "the difference from the lump-sum grant (出産育児一時金)" },
  医療費控除の還付: { zh: "医疗费扣除（医療費控除）的退税", en: "the refund from the medical expense deduction (医療費控除)" },
  町の窓口: { zh: "市区町村的窗口", en: "your city office" },
  勤め先か健康保険: { zh: "工作单位或健康保险", en: "your employer or health insurance" },
  勤め先かハローワーク: { zh: "工作单位或公共职业安定所（ハローワーク）", en: "your employer or Hello Work (ハローワーク)" },
  パートナーの勤め先: { zh: "伴侣的工作单位", en: "your partner's employer" },
  健康保険: { zh: "健康保险", en: "your health insurance" },
  税務署: { zh: "税务署（税務署）", en: "the tax office (税務署)" },
} satisfies Entries;
