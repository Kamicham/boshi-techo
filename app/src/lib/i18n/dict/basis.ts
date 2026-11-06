// 辞書: 予定の「なぜ？」の根拠の文（lib/milestones.ts・lib/money.ts の basis。画面は msWords(t.basis) で引く）。書き方は lib/i18n/index.ts の頭
// 法律・制度の名前は日本語を括弧で並べる（窓口で見せる・調べる時に使うため）
// - 法の根拠なので、意味を言い換えない・足さない・削らない。数・日数・週・金額・年・条の番号はそのまま。「近似」「目安」「町ごとに違う」の断りも訳す
//   （近似は zh「估算」・en「approximate」、目安は zh「参考」・en「Guideline」）
// - 法令の名前: 中文は《》でくくり、字が日本語と違えば日本語の正式な名前を括弧で並べる（《劳动基准法》（労働基準法）第65条第1款）。
//   English は英語の名前の後に日本語を括弧で並べる（Labor Standards Act (労働基準法), Article 65, Paragraph 1）。
//   条・項・号・枝番号は 中文「第65条第1款」「第10条第1项」「第6条之3」、English「Article 65, Paragraph 1」「Article 10, Item 1」「Article 6-3」
// - 用語集（glossary.ts）の言葉はその訳。町は zh「市区町村」・en「city」、役所は zh「市区町村政府」・en「city office」（dict/milestones.ts と同じ）
// - いくつもの根拠に付く同じ一文（予防接種の受ける所・保育園の申し込み・里帰りから戻った後）は、下の定数で1か所に書く
// - 家族の形で後ろに足す一文（paidDef・adjust）は、いちばん下の「{basis}」の鍵（milestone-words.ts の BASIS_TAILS が形を見て引く）
import type { Entries } from "..";

/** 予防接種の受ける所（lib/milestones.ts の VAX_WHERE。予防接種の根拠の後ろに付く） */
const VAX = {
  ja: "受ける所は、町が決めた小児科などの医療機関（役所ではない。BCG は町の保健センターでの集団接種の町もある）。遅れても、定期接種の対象の年齢の中なら公費で受けられる。迷ったら町の保健センターに聞く",
  zh: "接种地点是市区町村指定的儿科等医疗机构（不是市区町村政府。也有市区町村在保健中心集体接种卡介苗（BCG））。即使晚了，只要在定期接种（定期接種）的对象年龄之内，就可以公费接种。拿不准时，请问市区町村的保健中心",
  en: "Vaccinations are given at medical institutions your city designates, such as pediatric clinics (not at the city office; some cities give BCG as a group vaccination at the city health center). Even if you're late, it's publicly funded as long as your child is within the eligible age for routine immunization (定期接種). If you're unsure, ask your city's health center",
};
/** 保育園の申し込みの根拠（lib/milestones.ts の DAYCARE_BASIS） */
const DAYCARE = {
  ja: "子ども・子育て支援法第19条・第20条（保育の必要性の認定）・児童福祉法第24条（町が保育所の利用を調整する）。4月入園の一斉の申し込みは、前の年の秋〜冬（10〜12月の締切が多い）。締切・書類・点数のつけ方は町ごとに違うので、町で確かめる",
  zh: "《儿童及育儿支援法》（子ども・子育て支援法）第19条、第20条（保育必要性的认定）、《儿童福祉法》（児童福祉法）第24条（由市区町村调整保育所的使用）。4月入园的统一申请在前一年的秋季到冬季（截止日期多在10～12月）。截止日期、文件、计分方法各市区町村不同，所以请向市区町村确认",
  en: "Act on Child and Childcare Support (子ども・子育て支援法), Articles 19 and 20 (certification of the need for childcare); Child Welfare Act (児童福祉法), Article 24 (the city coordinates the use of daycare centers). The joint application for April entry is in the fall to winter of the previous year (deadlines are often in October to December). Deadlines, documents, and how points are scored vary by city, so check with your city",
};
/** 里帰りから住む町に戻った後の段取り（lib/milestones.ts の satogaeri-return の根拠の後ろ半分） */
const BACK = {
  ja: "戻ったら住む町の保健センターに連絡し、赤ちゃん訪問と乳幼児健診の案内を受ける（母子保健法第11条・第12条・児童福祉法第6条の3第4項）。車で戻るならチャイルドシートが要る（道路交通法第71条の3第3項）。かかりつけの小児科は住む町で探しておく",
  zh: "回来后联系居住地市区町村的保健中心，听取婴儿上门访问和婴幼儿健康检查的说明（《母子保健法》第11条、第12条，《儿童福祉法》（児童福祉法）第6条之3第4款）。如果开车回来，需要儿童安全座椅（《道路交通法》第71条之3第3款）。在居住地提前找好常去的儿科",
  en: "Once back, contact your city's health center and get information on the baby home visit and the health checkup for infants and young children (Maternal and Child Health Act (母子保健法), Articles 11 and 12; Child Welfare Act (児童福祉法), Article 6-3, Paragraph 4). If you return by car, you need a car seat (Road Traffic Act (道路交通法), Article 71-3, Paragraph 3). Find a regular pediatrician in your city ahead of time",
};

export default {
  // ───────── 妊娠中 ─────────
  "母子保健法第15条（期限の定めはなく、11週までが目安）。届けの時の面談で、妊婦のための支援給付の1回目（妊婦1人に5万円の目安）を申請できる（子ども・子育て支援法の改正・2025年4月から。心拍が確かめられた後。申請の期限は町ごと＝2年が多い。受け取り方は町で確かめる）": {
    zh: "《母子保健法》第15条（没有规定期限，以11周之前为参考标准）。申报时的面谈中，可以申请第1次孕妇支援给付（每位孕妇约5万日元）（《儿童及育儿支援法》（子ども・子育て支援法）的修订，2025年4月起。在确认胎心之后。申请期限由各市区町村规定，多为2年。领取方式请向市区町村确认）",
    en: "Maternal and Child Health Act (母子保健法), Article 15 (there is no set deadline; by week 11 is the guideline). At the interview when you file the notification, you can apply for the 1st support benefit for pregnant women (about 50,000 yen per pregnant woman) (amendment to the Act on Child and Childcare Support (子ども・子育て支援法), from April 2025; after the heartbeat has been confirmed; the application deadline is set by each city, often 2 years; check with your city how you receive it)",
  },
  "目安（予約の締め切りと、何週までに帰るかは産院ごとに違う。里帰り先の産院に確かめる）": {
    zh: "参考标准（预约截止日期，以及要在妊娠几周之前回去，各产科医院不同。请向回乡分娩地的产科医院确认）",
    en: "Guideline (the booking deadline and by which week of pregnancy you should go back vary by maternity clinic; check with the maternity clinic in your hometown)",
  },
  "目安（安定期のころ）": { zh: "参考标准（稳定期前后）", en: "Guideline (around the stable period of pregnancy)" },
  "労働基準法第65条（産前産後休業）・健康保険法第104条（辞めた後も出産手当金を受け取れる条件がある）。条件は入っている健康保険で確かめる": {
    zh: "《劳动基准法》（労働基準法）第65条（产前产后休假）、《健康保险法》（健康保険法）第104条（离职后也有可以领取分娩补贴的条件）。条件请向你加入的健康保险确认",
    en: "Labor Standards Act (労働基準法), Article 65 (maternity leave); Health Insurance Act (健康保険法), Article 104 (there are conditions under which you can still receive the maternity allowance after leaving your job). Check the conditions with the health insurance you're enrolled in",
  },
  "育児・介護休業法第5条（育児休業）・第6条第3項（始める日が申し出の日の翌日から1か月より前の時は、会社が始まりの日を、その1か月を過ぎる日までの間で決められる）。産後パパ育休（出生時育児休業）は別に申し出て、申し出は2週間前まで（第9条の3第3項）。期限の日は、予定日から休む時の目安（予定日の1か月前）。両方取るか・いつから休むかは家族と職場で決める。職場に確かめる": {
    zh: "《育儿·护理休假法》（育児・介護休業法）第5条（育儿休假）、第6条第3款（如果开始日早于申请日次日起1个月，公司可以在满1个月的日子之前指定开始日）。产后爸爸育儿休假（出生时育儿休假・産後パパ育休）另行申请，要在2周前提出（第9条之3第3款）。期限日是从预产期开始休时的大致日期（预产期的1个月前）。是否两种都休、从什么时候开始休，由家人和工作单位商定。请向工作单位确认",
    en: "Child Care and Family Care Leave Act (育児・介護休業法), Article 5 (childcare leave) and Article 6, Paragraph 3 (if the start date is less than 1 month after the day after the request, the employer can set the start date anywhere up to the day that month ends). Childcare leave at birth (出生時育児休業・産後パパ育休) is requested separately, 2 weeks in advance (Article 9-3, Paragraph 3). The date shown is a guideline for leave starting on the due date (1 month before the due date). Decide with your family and work whether to take both and when to start. Check with work",
  },
  "育児・介護休業法（産後パパ育休の申し出は原則2週間前まで。予定日から休むなら予定日の2週間前）": {
    zh: "《育儿·护理休假法》（育児・介護休業法）（产后爸爸育儿休假（産後パパ育休）原则上要在2周前提出申请。如果从预产期开始休，要在预产期的2周前提出）",
    en: "Child Care and Family Care Leave Act (育児・介護休業法) (as a rule, request childcare leave at birth (産後パパ育休) 2 weeks in advance; to take leave from the due date, by 2 weeks before the due date)",
  },
  "国民年金法第88条の2（2019年4月から。予定月の前月から4か月分、双子などは3か月前から6か月分の保険料が免除。予定日の6か月前から届けられ、生まれた後でも届けられる。窓口は役所の国民年金の係。日本年金機構のページで確かめる）": {
    zh: "《国民年金法》第88条之2（2019年4月起。从预产月的前一个月起免除4个月的保险费，双胞胎等从3个月前起免除6个月。从预产期6个月前起可以申报，出生后也可以申报。窗口是市区町村政府的国民年金负责部门。请在日本年金机构（日本年金機構）的网页上确认）",
    en: "National Pension Act (国民年金法), Article 88-2 (from April 2019; premiums are exempted for 4 months starting the month before the expected month of birth, or for 6 months starting 3 months before for twins or more; you can file from 6 months before the due date, and also after the birth; the desk is the National Pension section of the city office; check on the Japan Pension Service (日本年金機構) website)",
  },
  "国民健康保険法施行令の改正（2024年1月から。予定月の前月から4か月分、双子などは3か月前から6か月分の所得割・均等割が減る（0円になるとは限らない）。予定日の6か月前から届けられ、生まれた後でも届けられる。窓口は役所の国保の係）": {
    zh: "《国民健康保险法施行令》（国民健康保険法施行令）的修订（2024年1月起。从预产月的前一个月起4个月，双胞胎等从3个月前起6个月，所得比例部分（所得割）和均等部分（均等割）会减少（不一定减到0日元）。从预产期6个月前起可以申报，出生后也可以申报。窗口是市区町村政府的国民健康保险负责部门）",
    en: "Amendment to the Order for Enforcement of the National Health Insurance Act (国民健康保険法施行令) (from January 2024; the income-based portion (所得割) and per-capita portion (均等割) are reduced for 4 months starting the month before the expected month of birth, or for 6 months starting 3 months before for twins or more (not necessarily to 0 yen); you can file from 6 months before the due date, and also after the birth; the desk is the National Health Insurance section of the city office)",
  },
  "一時預かり事業（児童福祉法第6条の3第7項）・ファミリー・サポート・センター（子ども・子育て支援法第59条の子育て援助活動支援事業）・ショートステイ（子育て短期支援事業）。使える物と登録の仕方は町ごとに違う": {
    zh: "临时保育事业（一時預かり事業）（《儿童福祉法》（児童福祉法）第6条之3第7款）、家庭支援中心（ファミリー・サポート・センター）（《儿童及育儿支援法》（子ども・子育て支援法）第59条规定的育儿援助活动支援事业（子育て援助活動支援事業））、短期托育（育儿短期支援事业（子育て短期支援事業））。可以使用的服务和登记方法，各市区町村不同",
    en: "Temporary childcare program (一時預かり事業) (Child Welfare Act (児童福祉法), Article 6-3, Paragraph 7); Family Support Center (ファミリー・サポート・センター) (the child-rearing assistance activity support program (子育て援助活動支援事業) under the Act on Child and Childcare Support (子ども・子育て支援法), Article 59); short stays (the short-term child-rearing support program (子育て短期支援事業)). What you can use and how to register vary by city",
  },
  "子ども・子育て支援法施行規則第1条の5（保育が必要な理由の1つに「育児休業をする時、すでに保育を使っている子が続けて使う必要がある時」がある）。続けられるか・期間（育休の終わりまで・赤ちゃんが1歳になる年度の終わりまで・上の子の年で分けるなど）・申請の書類と期限は町ごとに違う。町の利用案内で確かめる": {
    zh: "《儿童及育儿支援法施行规则》（子ども・子育て支援法施行規則）第1条之5（需要保育的理由之一是“休育儿休假时，已经在使用保育的孩子需要继续使用”）。能否继续、期间（到育儿休假结束、到宝宝满1岁的那个年度结束、按大孩子的年龄区分等）、申请的文件和期限，各市区町村不同。请看市区町村的保育利用指南确认",
    en: "Regulation for Enforcement of the Act on Child and Childcare Support (子ども・子育て支援法施行規則), Article 1-5 (one of the reasons childcare is needed is “during childcare leave, when a child already using childcare needs to keep using it”). Whether your child can continue, for how long (until the end of the childcare leave, until the end of the fiscal year in which the baby turns 1, or depending on the older child's age, etc.), and the application documents and deadlines vary by city. Check your city's guide to using childcare",
  },
  "法の決まりは無い。母は産後8週まで休業の期間（労働基準法第65条）。入院は出産で数日〜1週間ほどが多い（近似）。送り迎えの担当は家族で決める": {
    zh: "法律上没有规定。母亲到产后8周为止是休假期间（《劳动基准法》（労働基準法）第65条）。分娩住院多为几天到1周左右（估算）。接送由谁负责，由家人决定",
    en: "There is no legal rule. The mother is on leave until 8 weeks after the birth (Labor Standards Act (労働基準法), Article 65). A hospital stay for a birth is often a few days to about 1 week (approximate). The family decides who handles drop-off and pick-up",
  },
  "新生児訪問（母子保健法第11条）・乳児家庭全戸訪問（児童福祉法第6条の3第4項）。里帰り先での訪問は、住む町が里帰り先の町に頼む形が多い。できるかと頼み方は住む町に確かめる": {
    zh: "新生儿访问（《母子保健法》第11条）、婴儿家庭全户访问（乳児家庭全戸訪問）（《儿童福祉法》（児童福祉法）第6条之3第4款）。在回乡分娩地接受访问，多由居住地的市区町村向回乡分娩地的市区町村提出请求。能否接受以及怎么申请，请向居住地的市区町村确认",
    en: "Newborn home visit (Maternal and Child Health Act (母子保健法), Article 11); home visits to every family with a baby (乳児家庭全戸訪問) (Child Welfare Act (児童福祉法), Article 6-3, Paragraph 4). For a visit in your hometown, your city often asks the city in your hometown. Check with your city whether it's possible and how to ask",
  },
  "新生児訪問は町の間で頼める（母子保健法第11条・第19条）。妊婦健診の受診券が里帰り先で使えるかは町ごと（同法第13条・各町の公費負担の決まり）。出生届は住む町・本籍地・生まれた所の役所に出せる（戸籍法第25条・第51条）。調べは里帰り先の町の公式ページで行う": {
    zh: "新生儿访问可以在市区町村之间委托（《母子保健法》第11条、第19条）。孕妇健康检查的检查券能否在回乡分娩地使用，各市区町村不同（同法第13条、各市区町村的公费负担规定）。出生登记可以向居住地、户籍所在地（本籍地）或出生地的市区町村政府提交（《户籍法》（戸籍法）第25条、第51条）。请在回乡分娩地的市区町村官方网页上查询",
    en: "Cities can ask each other to do the newborn home visit (Maternal and Child Health Act (母子保健法), Articles 11 and 19). Whether prenatal checkup vouchers can be used in your hometown depends on the city (Article 13 of the same Act and each city's rules on public funding). The birth registration can be submitted at the office of the city where you live, your registered domicile (本籍地), or where the baby was born (Family Register Act (戸籍法), Articles 25 and 51). Look it up on the official website of the city in your hometown",
  },
  "子ども・子育て支援法の改正（妊婦のための支援給付・2025年4月から）。2回目は出産予定日の8週前の日から申請でき、おなかの子1人につき5万円の目安。町の面談（妊婦等包括相談支援）を受けてから申請する町が多い。申請の期限は8週前の日から2年（秋田市・広島市などの案内で確かめた・2026年）。面談の予約・受け取り方は町で確かめる。流産・死産でも対象": {
    zh: "《儿童及育儿支援法》（子ども・子育て支援法）的修订（孕妇支援给付，2025年4月起）。第2次从预产期8周前那天起可以申请，腹中宝宝每人约5万日元。很多市区町村要求先接受市区町村的面谈（孕妇等综合咨询支援（妊婦等包括相談支援））再申请。申请期限是从8周前那天起2年（根据秋田市、广岛市等的指南确认，2026年）。面谈的预约和领取方式，请向市区町村确认。流产、死产也是对象",
    en: "Amendment to the Act on Child and Childcare Support (子ども・子育て支援法) (support benefit for pregnant women, from April 2025). The 2nd payment can be applied for from the day 8 weeks before the due date, about 50,000 yen per baby you're expecting. Many cities have you apply after the city interview (comprehensive consultation support for pregnant women and others (妊婦等包括相談支援)). The application deadline is 2 years from the day 8 weeks before the due date (checked in guides from Akita City, Hiroshima City, and others, 2026). Check with your city about booking the interview and how you receive it. Miscarriage and stillbirth are also covered",
  },
  "予防接種法の定期接種（2026年度から。接種の時に妊娠28週0日〜36週6日の妊婦に1回。厚生労働省「RSウイルスワクチン」）。母子健康手帳の予防接種の記録にも、妊娠週数を書くRSウイルスの欄がある（府令様式 2026年4月施行版 p.52）。費用・予診票・受けられる医療機関は町ごと。受けるかどうかは産院で相談する": {
    zh: "《预防接种法》（予防接種法）规定的定期接种（定期接種）（2026年度起。对接种时妊娠28周0天～36周6天的孕妇接种1次。厚生劳动省（厚生労働省）“RS病毒疫苗（RSウイルスワクチン）”）。母子健康手册的预防接种记录中，也有填写妊娠周数的RS病毒栏（府令规定的格式，2026年4月施行版，第52页）。费用、预诊单（予診票）、可以接种的医疗机构，各市区町村不同。是否接种，请在产科医院商量",
    en: "Routine immunization (定期接種) under the Immunization Act (予防接種法) (from fiscal 2026; 1 dose for pregnant women who are 28 weeks 0 days to 36 weeks 6 days pregnant at the time of vaccination; Ministry of Health, Labour and Welfare (厚生労働省), “RSV vaccine (RSウイルスワクチン)”). The immunization records in the Maternal and Child Health Handbook also have an RSV section for writing the weeks of pregnancy (Cabinet Office Order form, version effective April 2026, p.52). Costs, the pre-vaccination questionnaire (予診票), and which medical institutions offer it vary by city. Talk with your maternity clinic about whether to get it",
  },
  "母子保健法第17条の2（産後ケア事業。出産後1年を経過しない母と子に、市区町村が行うよう努める。泊まり・通い・家に来てもらう形がある）。使える人・料金・申し込みの時期は町ごと（こども家庭庁「産後ケア事業ガイドライン」2026年3月）。祖父母に頼れない時・ひとりで育てる時は、町の家事・育児の手伝い（子育て世帯訪問支援事業など。児童福祉法の改正で2024年4月から）も同じ窓口で聞ける": {
    zh: "《母子保健法》第17条之2（产后护理事业（産後ケア事業）。对产后未满1年的母亲和孩子，市区町村应努力实施。有住宿、日间、上门几种形式）。可以使用的人、费用、申请时间，各市区町村不同（儿童家庭厅（こども家庭庁）“产后护理事业指南（産後ケア事業ガイドライン）”，2026年3月）。无法依靠祖父母时、独自抚养孩子时，市区町村的家务和育儿帮助（育儿家庭上门支援事业（子育て世帯訪問支援事業）等。根据《儿童福祉法》（児童福祉法）的修订，2024年4月起）也可以在同一个窗口咨询",
    en: "Maternal and Child Health Act (母子保健法), Article 17-2 (postpartum care program (産後ケア事業): cities are to make efforts to provide it to mothers and babies within 1 year after the birth; there are overnight stays, day visits, and home visits). Who can use it, fees, and when to apply vary by city (Children and Families Agency (こども家庭庁), “Postpartum Care Program Guidelines (産後ケア事業ガイドライン)”, March 2026). If you can't rely on grandparents or are raising a child on your own, you can also ask at the same desk about city help with housework and childcare (such as the home visit support program for child-rearing households (子育て世帯訪問支援事業); from April 2024 under an amendment to the Child Welfare Act (児童福祉法))",
  },
  "健康保険法（出産育児一時金。金額と手続きは制度が変わる事があるので、そのつど公式の情報で確かめる）": {
    zh: "《健康保险法》（健康保険法）（分娩育儿一次性补贴。金额和手续可能随制度变化，所以每次都请以官方信息确认）",
    en: "Health Insurance Act (健康保険法) (Childbirth and Childcare lump-sum grant; the amount and procedure can change as the system changes, so check the official information each time)",
  },
  "健康保険法第102条（出産手当金: 産前42日・産後56日の間で休んだ日に、賃金のおよそ3分の2）・健康保険法第159条・厚生年金保険法第81条の2の2（産休中の保険料の免除）・同法第81条の2（育休中の免除。どちらも勤め先が届ける）・雇用保険法第61条の7（育児休業給付: 180日まで賃金の67%・その後50%）。パートでも勤め先の健康保険・雇用保険に入っていれば対象。入っているか・手続きの順は勤め先に確かめる": {
    zh: "《健康保险法》（健康保険法）第102条（分娩补贴：在产前42天、产后56天期间休假的日子，发放工资的约2/3）、《健康保险法》第159条、《厚生年金保险法》（厚生年金保険法）第81条之2之2（产前产后休假期间的保险费免除）、同法第81条之2（育儿休假期间的免除。两者都由工作单位申报）、《雇用保险法》（雇用保険法）第61条之7（育儿休假补贴：180天以内为工资的67%，之后为50%）。即使是兼职，只要加入了工作单位的健康保险和雇用保险，也是对象。是否已加入、手续的顺序，请向工作单位确认",
    en: "Health Insurance Act (健康保険法), Article 102 (maternity allowance: about 2/3 of wages for days off during the 42 days before and 56 days after the birth); Health Insurance Act, Article 159, and Employees' Pension Insurance Act (厚生年金保険法), Article 81-2-2 (premium exemption during maternity leave); Article 81-2 of the same Act (exemption during childcare leave; for both, your employer files); Employment Insurance Act (雇用保険法), Article 61-7 (childcare leave benefit: 67% of wages for up to 180 days, then 50%). Part-time workers are covered too if they're enrolled in their employer's health insurance and employment insurance. Check with your employer whether you're enrolled and the order of the procedures",
  },
  "雇用保険法第61条の10（出生後休業支援給付・2025年4月から。父は子が生まれて8週の間に通算14日以上の育休を取り、母も14日以上の育休を取る時に、28日分まで賃金の13%を上乗せ。母が産後休業中・働いていない時などは、母の条件は要らない）。足りるかは勤め先とハローワークで確かめる": {
    zh: "《雇用保险法》（雇用保険法）第61条之10（出生后休假支援补贴（出生後休業支援給付），2025年4月起。父亲在孩子出生后8周内累计休14天以上的育儿休假，且母亲也休14天以上的育儿休假时，最多28天追加工资的13%。母亲在产后休假中、没有工作等情况下，不需要满足母亲的条件）。是否满足条件，请向工作单位和公共职业安定所（ハローワーク）确认",
    en: "Employment Insurance Act (雇用保険法), Article 61-10 (post-birth leave support benefit (出生後休業支援給付), from April 2025: when the father takes a total of 14 or more days of childcare leave within 8 weeks of the birth and the mother also takes 14 or more days of childcare leave, 13% of wages is added for up to 28 days; when the mother is on postpartum leave, not working, etc., the mother's condition doesn't apply). Check with your employer and Hello Work (ハローワーク) whether you meet the conditions",
  },
  "労働基準法第65条第1項（6週間以内に出産する予定の人は、請求すれば休める。出産の当日は産前に入るので、予定日を含めて6週（42日）と数え、1日目は予定日の41日前。厚生労働省「働く女性の心とからだの応援サイト」の用語辞典で確かめた・2026年11月）。出産手当金の「出産の日以前42日」も、出産の日を入れて数える（健康保険法第102条・協会けんぽ）": {
    zh: "《劳动基准法》（労働基準法）第65条第1款（预计在6周以内分娩的人，提出请求就可以休假。分娩当天算在产前，所以包括预产期在内数6周（42天），第1天是预产期的41天前。根据厚生劳动省（厚生労働省）“支援职业女性身心网站（働く女性の心とからだの応援サイト）”的用语词典确认，2026年11月）。分娩补贴的“分娩日以前42天”，也包括分娩当天计算（《健康保险法》（健康保険法）第102条、协会健保（協会けんぽ））",
    en: "Labor Standards Act (労働基準法), Article 65, Paragraph 1 (a person expected to give birth within 6 weeks can take leave if she requests it; the day of birth counts as before the birth, so 6 weeks (42 days) are counted including the due date, and day 1 is 41 days before the due date; checked in the glossary of the Ministry of Health, Labour and Welfare (厚生労働省) site “Support Site for Working Women's Minds and Bodies (働く女性の心とからだの応援サイト)”, November 2026). For the maternity allowance, “the 42 days on or before the day of birth” are also counted including the day of birth (Health Insurance Act (健康保険法), Article 102; Japan Health Insurance Association (協会けんぽ))",
  },
  "国民健康保険法第9条・同法施行規則第3条（国保は入った日から14日以内に届ける）・健康保険法施行規則第38条（家族の扶養は家族の勤め先へ）・健康保険法第37条（任意継続は辞めた次の日から20日以内）。辞める日で期限が変わるので、日は目安": {
    zh: "《国民健康保险法》（国民健康保険法）第9条、同法施行规则第3条（国民健康保险要在加入之日起14天以内申报）、《健康保险法施行规则》（健康保険法施行規則）第38条（加入家人的被抚养人，向家人的工作单位申请）、《健康保险法》（健康保険法）第37条（任意继续（任意継続）在离职第二天起20天以内）。期限会因离职日期而变，所以日期仅供参考",
    en: "National Health Insurance Act (国民健康保険法), Article 9, and Article 3 of the Regulation for Enforcement of the same Act (for National Health Insurance, file within 14 days of the day you join); Regulation for Enforcement of the Health Insurance Act (健康保険法施行規則), Article 38 (to become a family member's dependent, go through that family member's employer); Health Insurance Act (健康保険法), Article 37 (voluntary continuation (任意継続) within 20 days from the day after you leave). The deadline depends on the day you leave, so the date is a guideline",
  },
  // ───────── 生まれてから ─────────
  "戸籍法第49条（生まれた日を含めて14日以内）・第52条（届け出る人は父か母。父母が結婚していない時は母）。署名した届書を窓口へ持っていくのは、ほかの家族でもよい（使者）。誰が行くかは家族で決める": {
    zh: "《户籍法》（戸籍法）第49条（包括出生当天在内14天以内）、第52条（申报人是父亲或母亲。父母没有结婚时为母亲）。把签好名的申报书（届書）送到窗口的人，也可以是其他家人（使者）。由谁去，由家人决定",
    en: "Family Register Act (戸籍法), Article 49 (within 14 days, counting the day of birth); Article 52 (the person who files is the father or mother; if the parents aren't married, the mother). Another family member can take the signed form (届書) to the counter (as a messenger, 使者). The family decides who goes",
  },
  "児童手当法第8条（生まれた日の翌日から15日以内に申請すると、翌月分から受け取れる）・第4条（受け取るのは父母のうち家計を主に支える人。ふつうは所得の高い方）": {
    zh: "《儿童补贴法》（児童手当法）第8条（在出生第二天起15天以内申请，就能从下个月起领取）、第4条（领取人是父母中主要负担家庭生计的人。一般是所得较高的一方）",
    en: "Child Allowance Act (児童手当法), Article 8 (if you apply within 15 days from the day after the birth, you receive it from the following month); Article 4 (the recipient is whichever parent mainly supports the household, usually the one with the higher income)",
  },
  "児童手当法第9条（額の改定。生まれた日の翌日から15日以内に請求すると、生まれた月の翌月分から増える。過ぎると、請求した月の翌月分から）": {
    zh: "《儿童补贴法》（児童手当法）第9条（金额变更。在出生第二天起15天以内提出请求，就从出生月的下个月起增加。超过的话，从提出请求那个月的下个月起）",
    en: "Child Allowance Act (児童手当法), Article 9 (amount revision; if you file within 15 days from the day after the birth, it increases from the month after the birth month; after that, from the month after the month you file)",
  },
  "1か月健診までが目安": { zh: "以满月儿健康检查之前为参考标准", en: "Guideline: by the one-month checkup" },
  "町の制度（赤ちゃんの保険の資格が分かる物が届いたら）": { zh: "市区町村的制度（收到能证明宝宝保险资格的材料之后）", en: "City program (once you have proof of the baby's insurance coverage)" },
  "児童扶養手当法第6条（認定の請求）・第7条（請求した月の翌月分から。さかのぼらない）。所得の制限がある。窓口は役所": {
    zh: "《儿童抚养津贴法》（児童扶養手当法）第6条（认定请求）、第7条（从提出请求那个月的下个月起。不追溯）。有所得限制。窗口在市区町村政府",
    en: "Child Rearing Allowance Act (児童扶養手当法), Article 6 (certification claim); Article 7 (from the month after the month you file; not retroactive). There is an income limit. The desk is at the city office",
  },
  "都道府県・町の制度（名前・所得の制限・助成の中身は町ごとに違う。窓口は役所。確かめる）": {
    zh: "都道府县和市区町村的制度（名称、所得限制、补助内容各市区町村不同。窗口在市区町村政府。请确认）",
    en: "Prefecture and city programs (the name, income limits, and what the subsidy covers vary by city; the desk is at the city office; check with them)",
  },
  "母子保健法第11条（新生児訪問）": { zh: "《母子保健法》第11条（新生儿访问）", en: "Maternal and Child Health Act (母子保健法), Article 11 (newborn home visit)" },
  "母子保健法第18条（体重が2500g未満の子が生まれた時は、保護者が速やかに住む町に届け出る。期限の日の定めは無い。出生連絡票と一緒に出せる町が多い。出し方は町で確かめる）": {
    zh: "《母子保健法》第18条（体重不足2500g的孩子出生时，监护人要尽快向居住地的市区町村申报。没有规定期限的日期。很多市区町村可以和出生联络单（出生連絡票）一起提交。提交方法请向市区町村确认）",
    en: "Maternal and Child Health Act (母子保健法), Article 18 (when a baby weighing under 2500g is born, the parent or guardian promptly reports it to the city where they live; no deadline date is set; many cities let you submit it with the birth notification card (出生連絡票); check with your city how to submit it)",
  },
  "母子保健法第20条（養育のため入院が要る未熟児の医療の給付。生まれた時の体重が2000g以下か、医師が入院を要すると認めた子が対象。指定の医療機関の医師の意見書が要る。申請の期限と書類は町ごとに違う（入院中に早めに、が多い）。住む町で確かめる）": {
    zh: "《母子保健法》第20条（为养育需要住院的未熟儿的医疗给付（養育医療）。对象是出生时体重在2000g以下，或医生认定需要住院的孩子。需要指定医疗机构医生的意见书。申请期限和文件各市区町村不同（多为住院期间尽早申请）。请向居住地的市区町村确认）",
    en: "Maternal and Child Health Act (母子保健法), Article 20 (medical care benefits for premature babies who need hospitalization for nurturing care (養育医療); eligible babies weighed 2000g or less at birth, or a doctor has recognized that they need hospitalization; a written opinion from a doctor at a designated medical institution is required; the application deadline and documents vary by city (often early, while in the hospital); check with your city)",
  },
  "目安（育休は、始める日の1か月前までに申し出るのが原則＝育児・介護休業法。産後休業の8週のあとに育休を続けるなら、生まれたら早めに伝える）": {
    zh: "参考标准（原则上，育儿休假要在开始日的1个月前提出，依据《育儿·护理休假法》（育児・介護休業法）。如果在8周的产后休假之后接着休育儿休假，宝宝出生后要尽早告知）",
    en: "Guideline (as a rule, childcare leave is requested 1 month before the day it starts, under the Child Care and Family Care Leave Act (育児・介護休業法); if you'll continue into childcare leave after the 8 weeks of postpartum leave, tell them early once the baby is born)",
  },
  "目安（赤ちゃんを健康保険の扶養に入れる届けは、勤め先が5日以内に出す＝健康保険法施行規則第38条。どちらの扶養に入れるかは収入で決まる。勤め先に確かめる）": {
    zh: "参考标准（把宝宝加入健康保险被抚养人的申报，由工作单位在5天以内提交，依据《健康保险法施行规则》（健康保険法施行規則）第38条。加入哪一方的被抚养人，由收入决定。请向工作单位确认）",
    en: "Guideline (the notice to add the baby as a dependent on health insurance is filed by the employer within 5 days, under the Regulation for Enforcement of the Health Insurance Act (健康保険法施行規則), Article 38; whose dependent the baby becomes is decided by income; check with your employer)",
  },
  "母子保健法第13条（市区町村の健康診査）による国の産婦健康診査事業（産後2週間・1か月ごろなど。2017年度から）。行うか・健診の券（受診票）・助成の中身は町ごと。生後4か月ごろまでは、赤ちゃんの便の色を母子健康手帳の便色カードと見比べる（府令様式）": {
    zh: "依据《母子保健法》第13条（市区町村的健康检查）的国家产妇健康检查事业（産婦健康診査事業）（产后2周、1个月左右等。2017年度起）。是否实施、检查券（受診票）、补助内容，各市区町村不同。到出生后4个月左右为止，把宝宝大便的颜色和母子健康手册的大便颜色卡对照（府令规定的格式）",
    en: "The national postpartum checkup for mothers program (産婦健康診査事業) (around 2 weeks and 1 month after the birth, etc.; from fiscal 2017), based on the Maternal and Child Health Act (母子保健法), Article 13 (health checkups by cities). Whether it's offered, the checkup vouchers (受診票), and what the subsidy covers vary by city. Until around 4 months old, compare the color of the baby's stool with the stool color card in the Maternal and Child Health Handbook (Cabinet Office Order form)",
  },
  "国の目安。ママの1か月の健診は、国の産婦健康診査事業（母子保健法第13条。助成の中身は町ごと）。生後4か月ごろまでは、赤ちゃんの便の色を母子健康手帳の便色カードと見比べる（府令様式）": {
    zh: "国家的参考标准。妈妈1个月时的健康检查，属于国家的产妇健康检查事业（産婦健康診査事業）（《母子保健法》第13条。补助内容各市区町村不同）。到出生后4个月左右为止，把宝宝大便的颜色和母子健康手册的大便颜色卡对照（府令规定的格式）",
    en: "National guideline. Mom's 1-month checkup is part of the national postpartum checkup for mothers program (産婦健康診査事業) (Maternal and Child Health Act (母子保健法), Article 13; what the subsidy covers varies by city). Until around 4 months old, compare the color of the baby's stool with the stool color card in the Maternal and Child Health Handbook (Cabinet Office Order form)",
  },
  "児童福祉法（生後4か月まで）": { zh: "《儿童福祉法》（児童福祉法）（到出生后4个月为止）", en: "Child Welfare Act (児童福祉法) (until 4 months old)" },
  "妊婦健康診査の公費負担（母子保健法第13条）。町の外で受けた健診は、後から払い戻す町が多い。申請の期限は町ごとに違い、出産から1年以内（杉並区など）・最後の健診から1年以内（栃木市など）・受けた日から2年以内（船橋市など）がある（2026年に各町のページで確かめた）。期限と書類（領収書・健診の記録）は住む町で確かめる": {
    zh: "孕妇健康检查的公费负担（《母子保健法》第13条）。在居住地以外的市区町村接受的检查，很多市区町村会事后报销。申请期限各市区町村不同，有分娩后1年以内（杉并区等）、最后一次检查后1年以内（栃木市等）、检查当天起2年以内（船桥市等）（2026年在各市区町村的网页上确认）。期限和文件（收据、检查记录），请向居住地的市区町村确认",
    en: "Public funding of prenatal checkups (妊婦健康診査) (Maternal and Child Health Act (母子保健法), Article 13). For checkups taken outside your city, many cities reimburse you afterward. Application deadlines vary by city: within 1 year of the birth (Suginami Ward and others), within 1 year of the last checkup (Tochigi City and others), or within 2 years of the checkup date (Funabashi City and others) (checked on each city's website in 2026). Check the deadline and documents (receipts, checkup records) with your city",
  },
  [`目安（戻る日は、答えてもらった戻る時期から置いた近似。決めていなければ1か月健診のあと＝生後35日ごろ）。${BACK.ja}`]: {
    zh: `参考标准（回来的日期，是根据你回答的回来时间估算的。如果还没决定，按满月儿健康检查之后，即出生后35天左右）。${BACK.zh}`,
    en: `Guideline (the return date is an approximation based on the return timing you gave; if you haven't decided, it's after the one-month checkup, around 35 days old). ${BACK.en}`,
  },
  [`予防接種法（定期接種。五種混合は2024年4月から）。標準は生後2か月から同じ日にまとめて受ける。ロタの1回目は生後14週6日までに受けるのが望ましい。${VAX.ja}`]: {
    zh: `《预防接种法》（予防接種法）（定期接种。五联疫苗从2024年4月起）。标准是从出生后2个月起在同一天一起接种。轮状病毒的第1次最好在出生后14周6天之前接种。${VAX.zh}`,
    en: `Immunization Act (予防接種法) (routine immunization; the 5-in-1 vaccine since April 2024). The standard is to get them together on the same day from 2 months old. The 1st rotavirus dose should preferably be given by 14 weeks 6 days old. ${VAX.en}`,
  },
  [`予防接種法（定期接種）。肺炎球菌・ロタは27日以上、五種混合は20日以上あける。${VAX.ja}`]: {
    zh: `《预防接种法》（予防接種法）（定期接种）。肺炎球菌、轮状病毒间隔27天以上，五联疫苗间隔20天以上。${VAX.zh}`,
    en: `Immunization Act (予防接種法) (routine immunization). Space pneumococcal and rotavirus doses at least 27 days apart, and 5-in-1 doses at least 20 days apart. ${VAX.en}`,
  },
  "町の乳幼児健診（母子保健法第13条。ほとんどの町で行う。日と場所は町ごとに違う）": {
    zh: "市区町村的婴幼儿健康检查（《母子保健法》第13条。几乎所有市区町村都会实施。日期和地点各市区町村不同）",
    en: "Your city's health checkup for infants and young children (Maternal and Child Health Act (母子保健法), Article 13; almost all cities offer it; the date and place vary by city)",
  },
  [`予防接種法（定期接種）。ロタは2回の種類（24週まで）と3回の種類（32週まで）がある。${VAX.ja}`]: {
    zh: `《预防接种法》（予防接種法）（定期接种）。轮状病毒有2次型（到24周为止）和3次型（到32周为止）。${VAX.zh}`,
    en: `Immunization Act (予防接種法) (routine immunization). Rotavirus comes in a 2-dose type (until 24 weeks old) and a 3-dose type (until 32 weeks old). ${VAX.en}`,
  },
  "町ごとに申込の時期が違う": { zh: "申请时间各市区町村不同", en: "Application timing varies by city" },
  [`${DAYCARE.ja}。入る4月は、生後6か月を過ぎて最初の4月で置いた（近似）`]: {
    zh: `${DAYCARE.zh}。入园的4月，设定为过了出生后6个月之后的第一个4月（估算）`,
    en: `${DAYCARE.en}. The April of entry is set to the first April after the baby turns 6 months old (approximate)`,
  },
  [`子ども・子育て支援法施行規則第1条の5（就労を保育の必要性の理由にする時は、働いている事を示す書類が要る。国の標準の様式がある＝こども家庭庁）。${DAYCARE.ja}`]: {
    zh: `《儿童及育儿支援法施行规则》（子ども・子育て支援法施行規則）第1条之5（以工作作为需要保育的理由时，需要证明在工作的文件。儿童家庭厅（こども家庭庁）有国家的标准格式）。${DAYCARE.zh}`,
    en: `Regulation for Enforcement of the Act on Child and Childcare Support (子ども・子育て支援法施行規則), Article 1-5 (when work is the reason childcare is needed, a document showing that you work is required; the Children and Families Agency (こども家庭庁) has a national standard form). ${DAYCARE.en}`,
  },
  [`子ども・子育て支援法施行規則第1条の5（父母それぞれの、働いている事を示す書類が要る）。${DAYCARE.ja}`]: {
    zh: `《儿童及育儿支援法施行规则》（子ども・子育て支援法施行規則）第1条之5（父母双方各自都需要证明在工作的文件）。${DAYCARE.zh}`,
    en: `Regulation for Enforcement of the Act on Child and Childcare Support (子ども・子育て支援法施行規則), Article 1-5 (a document showing that each parent works is required). ${DAYCARE.en}`,
  },
  "育児・介護休業法第5条（育休は原則1歳まで。保育所に入れない時は1歳6か月・2歳まで延ばせる）。結果の届く時期と慣らし保育の長さは町と園ごとに違う。町と職場で確かめる": {
    zh: "《育儿·护理休假法》（育児・介護休業法）第5条（育儿休假原则上到孩子1岁为止。进不了保育所时，可以延长到1岁6个月、2岁）。结果送达的时间和适应期保育的长短，各市区町村和各园不同。请向市区町村和工作单位确认",
    en: "Child Care and Family Care Leave Act (育児・介護休業法), Article 5 (as a rule, childcare leave lasts until age 1; if you can't get a daycare center spot, it can be extended to 1 year 6 months, and to 2 years). When the results arrive and how long settling-in takes vary by city and daycare. Check with your city and your workplace",
  },
  "健康保険法第102条・同法施行規則第84条（出産手当金の申請書には、出産の日などを医師か助産師が証明する欄がある）。出産で辞めた人も、1年以上入っていて辞める日に休んでいれば受け取れる事がある（同法第104条）。勤め先と健康保険に確かめる": {
    zh: "《健康保险法》（健康保険法）第102条、同法施行规则第84条（分娩补贴的申请书上，有由医生或助产师证明分娩日期等的栏目）。因分娩离职的人，如果加入满1年以上并且离职当天在休假中，也有可能领取（同法第104条）。请向工作单位和健康保险确认",
    en: "Health Insurance Act (健康保険法), Article 102, and Article 84 of the Regulation for Enforcement of the same Act (the maternity allowance application has a section where a doctor or midwife certifies the date of birth and other details). People who left their job because of the birth may still receive it if they were enrolled for 1 year or more and were on leave on the day they left (Article 104 of the same Act). Check with your employer and your health insurance",
  },
  "健康保険法第102条（産前42日・産後56日の間で休んだ日に、賃金のおよそ3分の2）・第193条（休んだ日ごとに、その次の日から2年で時効）。振込までの日数は健康保険ごとに違う（1〜2か月ほど＝近似）": {
    zh: "《健康保险法》（健康保険法）第102条（在产前42天、产后56天期间休假的日子，发放工资的约2/3）、第193条（按每个休假日计算，从其第二天起2年后时效届满）。到账所需天数各健康保险不同（约1～2个月，估算）",
    en: "Health Insurance Act (健康保険法), Article 102 (about 2/3 of wages for days off during the 42 days before and 56 days after the birth); Article 193 (for each day off, the right expires 2 years from the following day). How long it takes to be paid varies by health insurer (about 1–2 months, approximate)",
  },
  "雇用保険法第61条の7（育児休業給付: 180日まで賃金の67%・その後50%）・同法施行規則第101条の30（初回の申請は、育休を始めた日から4か月を経過する日の属する月の末日まで。その後は2か月ごと）。育休は産後休業の次の日から始まる形で置いた（近似）": {
    zh: "《雇用保险法》（雇用保険法）第61条之7（育儿休假补贴：180天以内为工资的67%，之后为50%）、同法施行规则第101条之30（首次申请的期限，是从育儿休假开始之日起满4个月那天所在月份的最后一天。之后每2个月一次）。按育儿休假从产后休假的第二天开始来设定（估算）",
    en: "Employment Insurance Act (雇用保険法), Article 61-7 (childcare leave benefit: 67% of wages for up to 180 days, then 50%); Article 101-30 of the Regulation for Enforcement of the same Act (the first application is due by the last day of the month containing the day 4 months have passed since childcare leave began; after that, every 2 months). Set with childcare leave starting the day after postpartum leave (approximate)",
  },
  "雇用保険法第61条の8（出生時育児休業給付: 産後パパ育休の日に、賃金の67%）・同法施行規則第101条の33（生まれた日（予定日より早く生まれた時は予定日）から8週を経過する日の翌日から、その日から2か月を経過する日の属する月の末日まで。産後パパ育休を28日取り終えた時・2回目を終えた時は、その次の日から申請でき、期限もその日から数えるので早まる。厚生労働省「育児休業等給付の内容と支給申請手続」2026年8月改訂版で確かめた・2026年11月）。ふつうの育休だけを取った時は、育児休業給付の申請になる。休みの取り方で日が変わるので、勤め先に確かめる": {
    zh: "《雇用保险法》（雇用保険法）第61条之8（出生时育儿休假补贴（出生時育児休業給付）：产后爸爸育儿休假（産後パパ育休）期间的日子，发放工资的67%）、同法施行规则第101条之33（从出生之日（比预产期早出生时为预产期）起满8周那天的第二天起，到从那天起满2个月那天所在月份的最后一天为止。休完28天的产后爸爸育儿休假时、或第2次休完时，从第二天起就可以申请，期限也从那天起计算，所以会提前。根据厚生劳动省（厚生労働省）“育儿休假等补贴的内容和支付申请手续（育児休業等給付の内容と支給申請手続）”2026年8月修订版确认，2026年11月）。只休了普通的育儿休假时，就是申请育儿休假补贴。日期会因休假方式而变，请向工作单位确认",
    en: "Employment Insurance Act (雇用保険法), Article 61-8 (childcare leave benefit at birth (出生時育児休業給付): 67% of wages for the days of childcare leave at birth (産後パパ育休)); Article 101-33 of the Regulation for Enforcement of the same Act (from the day after 8 weeks have passed since the birth (since the due date if the baby was born before it), until the last day of the month containing the day 2 months after that; once you finish 28 days of childcare leave at birth, or finish the 2nd period, you can apply from the next day, and the deadline is counted from that day too, so it comes earlier; checked in the Ministry of Health, Labour and Welfare (厚生労働省) guide “Childcare Leave and Other Benefits: Details and Application Procedures (育児休業等給付の内容と支給申請手続)”, revised August 2026, as of November 2026). If you took only regular childcare leave, the application is for the childcare leave benefit. Dates change depending on how you take leave, so check with your employer",
  },
  "雇用保険法第61条の7（育児休業給付は、育休を始めて180日までは賃金の67%、181日目から50%）。育休は産後休業の次の日から始まる形で数えた（近似）。手取りの額は勤め先の明細で確かめる": {
    zh: "《雇用保险法》（雇用保険法）第61条之7（育儿休假补贴在育儿休假开始后180天以内为工资的67%，从第181天起为50%）。按育儿休假从产后休假的第二天开始计算（估算）。实际到手的金额，请看工作单位的工资明细确认",
    en: "Employment Insurance Act (雇用保険法), Article 61-7 (the childcare leave benefit is 67% of wages for the first 180 days of childcare leave, and 50% from day 181). Counted with childcare leave starting the day after postpartum leave (approximate). Check your take-home amount on your employer's pay statement",
  },
  "雇用保険法第61条の12（育児時短就業給付・2025年4月から。2歳になるまでの子を育てて時短で働く時、時短の間に払われた賃金の10%まで）。時短で戻るか・受け取れるかは勤め先に確かめる": {
    zh: "《雇用保险法》（雇用保険法）第61条之12（育儿短时工作补贴（育児時短就業給付），2025年4月起。抚养未满2岁的孩子并缩短工时工作时，最多为缩短工时期间所支付工资的10%）。是否以缩短工时复职、能否领取，请向工作单位确认",
    en: "Employment Insurance Act (雇用保険法), Article 61-12 (short-hours childcare benefit (育児時短就業給付), from April 2025: when you work shorter hours while raising a child under 2, up to 10% of the wages paid during the shorter hours). Check with your employer whether you'll return on shorter hours and whether you can receive it",
  },
  "出産育児一時金（健康保険法第101条）。直接支払で産院に払われた額が一時金より少なければ、差額を健康保険に申請する（健康保険から案内が届く所もある）。時効は2年（同法第193条）なので、ここは早めの目安。差額があるかは退院の時の明細書（直接支払の合意文書）で見る": {
    zh: "分娩育儿一次性补贴（《健康保险法》（健康保険法）第101条）。通过直接支付付给产科医院的金额如果低于一次性补贴，就向健康保险申请差额（也有健康保险会寄来通知）。时效是2年（同法第193条），所以这里是较早的参考时间。有没有差额，请看出院时的明细单（直接支付的协议文件）",
    en: "Childbirth and Childcare lump-sum grant (Health Insurance Act (健康保険法), Article 101). If the amount paid to the maternity clinic under direct payment was less than the grant, apply to your health insurance for the difference (some health insurers send a notice). The time limit is 2 years (Article 193 of the same Act), so this is an early guideline. To see whether there's a difference, look at the itemized statement from discharge (the direct payment agreement document)",
  },
  "医療費控除（所得税法第73条）。家族の1年（1月〜12月）の医療費が10万円（所得が少なければ所得の5%）を超えた分。出産の費用は出産育児一時金を引いて数える。妊婦健診の自己負担・通院の交通費も入る（国税庁 No.1124・2025年）。確定申告は翌年2月16日〜3月15日、会社員の還付の申告は1月から5年までできる。控除になるかは税務署の案内で確かめる": {
    zh: "医疗费扣除（医療費控除）（《所得税法》第73条）。家人1年（1月～12月）的医疗费超过10万日元（所得较少时为所得的5%）的部分。分娩费用要减去分娩育儿一次性补贴后计算。孕妇健康检查的自付部分、去医院的交通费也算在内（国税厅（国税庁）No.1124，2025年）。确定申报在第二年的2月16日～3月15日，公司职员的退税申报从1月起5年内都可以办理。能否扣除，请看税务署（税務署）的说明确认",
    en: "Medical expense deduction (医療費控除) (Income Tax Act (所得税法), Article 73). The part of your family's medical costs for the year (January to December) above 100,000 yen (or 5% of income if your income is low). Birth costs are counted after subtracting the Childbirth and Childcare lump-sum grant. Your out-of-pocket costs for prenatal checkups and travel to appointments also count (National Tax Agency (国税庁), No.1124, 2025). The tax return is filed February 16 to March 15 of the following year; company employees can file for a refund from January, for up to 5 years. Check the tax office (税務署) guidance on whether it qualifies",
  },
  "育児・介護休業法第5条第3項（保育所に入れない時は1歳6か月まで延ばせる）・同法施行規則（1歳を過ぎた分の申し出は、始める日の2週間前まで）。育児休業給付の延長は、2025年4月から、保育所の申込書の写し・入れなかった通知（保留の通知）・延長事由の申告書が要る（雇用保険法施行規則・厚生労働省）。町の通知の名前と届く時期は町ごとに違う": {
    zh: "《育儿·护理休假法》（育児・介護休業法）第5条第3款（进不了保育所时，可以延长到1岁6个月）、同法施行规则（1岁以后那部分的申请，要在开始日的2周前提出）。延长育儿休假补贴，从2025年4月起，需要保育所申请书的复印件、没能入园的通知（保留通知，保留の通知）、延长理由的申报书（《雇用保险法施行规则》（雇用保険法施行規則），厚生劳动省（厚生労働省））。市区町村通知的名称和送达时间，各市区町村不同",
    en: "Child Care and Family Care Leave Act (育児・介護休業法), Article 5, Paragraph 3 (if you can't get a daycare center spot, leave can be extended to 1 year 6 months); the Regulation for Enforcement of the same Act (the request for the period after age 1 is due 2 weeks before the start date). From April 2025, extending the childcare leave benefit requires a copy of the daycare center application, the notice that you didn't get a spot (the waitlist notice, 保留の通知), and a declaration of the reason for the extension (Regulation for Enforcement of the Employment Insurance Act (雇用保険法施行規則); Ministry of Health, Labour and Welfare). The name of the city's notice and when it arrives vary by city",
  },
  "育児・介護休業法第5条第4項（1歳6か月でも保育所に入れない時は2歳まで延ばせる）。1歳6か月の時点の申し込みと保留の通知が、もう一度要る（雇用保険法施行規則・2025年4月から）": {
    zh: "《育儿·护理休假法》（育児・介護休業法）第5条第4款（到1岁6个月仍进不了保育所时，可以延长到2岁）。需要再次提交1岁6个月时的申请和保留通知（保留の通知）（《雇用保险法施行规则》（雇用保険法施行規則），2025年4月起）",
    en: "Child Care and Family Care Leave Act (育児・介護休業法), Article 5, Paragraph 4 (if you still can't get a daycare center spot at 1 year 6 months, leave can be extended to 2 years). An application as of 1 year 6 months and a waitlist notice (保留の通知) are needed again (Regulation for Enforcement of the Employment Insurance Act (雇用保険法施行規則), from April 2025)",
  },
  "慣らし保育の長さは園ごと（1〜2週間ほどが多い＝近似）。病児保育（児童福祉法第6条の3第13項の病児保育事業）は、使う前に登録が要る所が多い。町と園で確かめる": {
    zh: "适应期保育的长短各园不同（多为1～2周左右，估算）。病儿保育（《儿童福祉法》（児童福祉法）第6条之3第13款规定的病儿保育事业（病児保育事業））很多地方需要在使用前登记。请向市区町村和保育园确认",
    en: "How long settling-in takes depends on the daycare (often about 1–2 weeks, approximate). Sick-child care (the sick-child care program (病児保育事業) under the Child Welfare Act (児童福祉法), Article 6-3, Paragraph 13) often requires registration before use. Check with your city and the daycare",
  },
  [`予防接種法施行令（対象は1歳になるまで。標準は生後5〜8か月）。${VAX.ja}`]: {
    zh: `《预防接种法施行令》（予防接種法施行令）（对象是到满1岁为止。标准是出生后5～8个月）。${VAX.zh}`,
    en: `Order for Enforcement of the Immunization Act (予防接種法施行令) (eligible until age 1; the standard is 5–8 months old). ${VAX.en}`,
  },
  [`予防接種法施行令第3条（B型肝炎は1歳になるまでに3回。3回目は1回目から139日以上あける）。${VAX.ja}`]: {
    zh: `《预防接种法施行令》（予防接種法施行令）第3条（乙型肝炎在满1岁之前接种3次。第3次距第1次间隔139天以上）。${VAX.zh}`,
    en: `Order for Enforcement of the Immunization Act (予防接種法施行令), Article 3 (hepatitis B: 3 doses before age 1; the 3rd dose at least 139 days after the 1st). ${VAX.en}`,
  },
  "町の乳児健診（母子保健法第13条。行うか・小児科で受けるか集団かは町ごとに違う。町の案内で確かめる）": {
    zh: "市区町村的婴儿健康检查（《母子保健法》第13条。是否实施、在儿科接受还是集体检查，各市区町村不同。请看市区町村的通知确认）",
    en: "Your city's infant health checkup (Maternal and Child Health Act (母子保健法), Article 13; whether it's offered, and whether it's at a pediatric clinic or a group checkup, vary by city; check your city's guide)",
  },
  [`予防接種法施行令（麻しん風しん（MR）の1期は1歳から2歳になるまで。水ぼうそう（水痘）は1歳から3歳になるまでに2回。肺炎球菌の追加は標準で生後12〜15か月。五種混合の追加は3回目から6か月以上あける）。${VAX.ja}`]: {
    zh: `《预防接种法施行令》（予防接種法施行令）（麻疹风疹（MR）第1期是从1岁到满2岁之前。水痘在1岁到满3岁之前接种2次。肺炎球菌加强针的标准是出生后12～15个月。五联疫苗加强针距第3次间隔6个月以上）。${VAX.zh}`,
    en: `Order for Enforcement of the Immunization Act (予防接種法施行令) (measles-rubella (MR) phase 1: from age 1 until age 2; chickenpox (varicella): 2 doses from age 1 until age 3; the pneumococcal booster: standard at 12–15 months old; the 5-in-1 booster: at least 6 months after the 3rd dose). ${VAX.en}`,
  },
  [`予防接種法施行令（五種混合の1期の追加は、3回目から6か月以上あけて。標準は3回目から6〜18か月の間）。${VAX.ja}`]: {
    zh: `《预防接种法施行令》（予防接種法施行令）（五联疫苗第1期加强针，距第3次间隔6个月以上。标准是在第3次之后6～18个月之间）。${VAX.zh}`,
    en: `Order for Enforcement of the Immunization Act (予防接種法施行令) (the phase 1 booster of the 5-in-1 vaccine: at least 6 months after the 3rd dose; the standard is 6–18 months after the 3rd dose). ${VAX.en}`,
  },
  "母子保健法第12条": { zh: "《母子保健法》第12条", en: "Maternal and Child Health Act (母子保健法), Article 12" },
  [`予防接種法施行令第3条（水ぼうそう（水痘）は1歳から3歳になるまでに2回。2回目は1回目から3か月以上、標準は6〜12か月あける）。${VAX.ja}`]: {
    zh: `《预防接种法施行令》（予防接種法施行令）第3条（水痘在1岁到满3岁之前接种2次。第2次距第1次间隔3个月以上，标准是间隔6～12个月）。${VAX.zh}`,
    en: `Order for Enforcement of the Immunization Act (予防接種法施行令), Article 3 (chickenpox (varicella): 2 doses from age 1 until age 3; the 2nd dose at least 3 months after the 1st, with 6–12 months as the standard). ${VAX.en}`,
  },
  // ───────── 早く生まれた時 ─────────
  "育児・介護休業法第7条第1項（予定日より早く生まれた時は、育休の始まりの日を1回だけ早められる＝同法施行規則第10条第1号）・第7条第2項と施行規則第14条（早める日の1週間前より後の申し出は、もとの始まりの日までの間で会社が始まりの日を決められる）。産後パパ育休も同じ（同法第9条の4・施行規則第21条の8・第21条の9）。期限の日は、予定日から休む申し出をしていた時の目安（もとの始まりの日の前日まで）。職場に確かめる": {
    zh: "《育儿·护理休假法》（育児・介護休業法）第7条第1款（比预产期早出生时，育儿休假的开始日可以提前1次，即同法施行规则第10条第1项）、第7条第2款和施行规则第14条（在提前后的日期1周前之后才提出的申请，公司可以在原定开始日之前的期间内决定开始日）。产后爸爸育儿休假（産後パパ育休）也一样（同法第9条之4、施行规则第21条之8、第21条之9）。期限日是以申请过从预产期开始休假为前提的参考标准（到原定开始日的前一天）。请向工作单位确认",
    en: "Child Care and Family Care Leave Act (育児・介護休業法), Article 7, Paragraph 1 (if the baby is born before the due date, the start date of childcare leave can be moved up once; Regulation for Enforcement of the same Act, Article 10, Item 1); Article 7, Paragraph 2 and Article 14 of the Regulation (if the request comes later than 1 week before the moved-up date, the employer can set the start date within the period up to the original start date). The same applies to childcare leave at birth (産後パパ育休) (Article 9-4 of the same Act; Articles 21-8 and 21-9 of the Regulation). The deadline date is a guideline for when you had requested leave from the due date (until the day before the original start date). Check with your workplace",
  },
  // ───────── 町を変えた時 ─────────
  "住民基本台帳法第22条（転入をした日から14日以内に、新しい町の市町村長に届け出る）。前の町には、引っ越す前に転出届を出す（同法第24条）": {
    zh: "《居民基本台账法》（住民基本台帳法）第22条（自迁入之日起14天以内，向新住址的市町村长申报）。在搬家之前，向原住址的市区町村提交迁出申报（転出届）（同法第24条）",
    en: "Basic Resident Register Act (住民基本台帳法), Article 22 (notify the mayor of your new city within 14 days of moving in). Submit a moving-out notification (転出届) to your previous city before you move (Article 24 of the same Act)",
  },
  "児童手当法第8条第3項（住所を変えた後15日以内に請求すれば、引っ越した月の翌月分から途切れずに受け取れる）・同法第7条第1項（認定は住む町の市町村長が行う）。公務員の人が受け取っている時は、勤め先に申し出る（同法第17条）": {
    zh: "《儿童补贴法》（児童手当法）第8条第3款（变更住址后15天以内提出请求，就能从搬家当月的下个月起不间断地领取）、同法第7条第1款（认定由居住地的市町村长进行）。领取人是公务员时，向工作单位申请（同法第17条）",
    en: "Child Allowance Act (児童手当法), Article 8, Paragraph 3 (if you file within 15 days after changing your address, you keep receiving it without a gap, from the month after the month you moved); Article 7, Paragraph 1 of the same Act (certification is done by the mayor of the city where you live). If the recipient is a public servant, apply through their employer (Article 17 of the same Act)",
  },
  "町の運用（妊婦健診の券は住む町が出している。前の町の券の扱いと、新しい町での受け取り方・持ち物は町ごとに違う）。新しい町に確かめる": {
    zh: "市区町村的运作（孕妇健康检查的检查券由居住地的市区町村发放。原住址市区町村的检查券怎么处理，以及在新住址的领取方式和要带的东西，各市区町村不同）。请向新住址的市区町村确认",
    en: "City practice (prenatal checkup vouchers are issued by the city where you live; how your previous city's vouchers are handled, and how to get new ones and what to bring in your new city, vary by city). Check with your new city",
  },
  "町の制度（子どもの医療費の助成は、住む町が決めて出している。申し込みの期限・さかのぼって払い戻せるか・持ち物は町ごとに違う）。新しい町に確かめる": {
    zh: "市区町村的制度（儿童医疗费补助由居住地的市区町村决定并发放。申请期限、能否追溯报销、要带的东西，各市区町村不同）。请向新住址的市区町村确认",
    en: "City program (subsidies for children's medical costs are set and provided by the city where you live; the application deadline, whether you can be reimbursed retroactively, and what to bring vary by city). Check with your new city",
  },
  // ───────── 1000日の先 ─────────
  "母子保健法第12条（満3歳を超え満4歳に達しない子に、町が行う。日と場所は町ごとに違い、3歳〜3歳6か月ごろが多い。町の案内で確かめる）": {
    zh: "《母子保健法》第12条（市区町村为超过满3岁、未满4岁的孩子实施。日期和地点各市区町村不同，多在3岁～3岁6个月左右。请看市区町村的通知确认）",
    en: "Maternal and Child Health Act (母子保健法), Article 12 (cities hold it for children over 3 and under 4 years old; the date and place vary by city, often around 3 years to 3 years 6 months; check your city's guide)",
  },
  [`予防接種法施行令（日本脳炎の1期は生後6か月から7歳6か月になるまで。標準は3歳で初回2回）。生後6か月から受けるよう勧める町もある。${VAX.ja}`]: {
    zh: `《预防接种法施行令》（予防接種法施行令）（日本脑炎第1期是从出生后6个月到满7岁6个月之前。标准是在3岁时接种初次的2次）。也有市区町村建议从出生后6个月起接种。${VAX.zh}`,
    en: `Order for Enforcement of the Immunization Act (予防接種法施行令) (Japanese encephalitis phase 1: from 6 months old until 7 years 6 months old; the standard is the first 2 doses at age 3). Some cities recommend getting it from 6 months old. ${VAX.en}`,
  },
  [`予防接種法施行令（日本脳炎の1期の追加は、初回の2回目からおよそ1年あけて。標準は4歳。7歳6か月になるまで公費）。${VAX.ja}`]: {
    zh: `《预防接种法施行令》（予防接種法施行令）（日本脑炎第1期加强针，距初次的第2次约间隔1年。标准是4岁。到满7岁6个月之前为公费）。${VAX.zh}`,
    en: `Order for Enforcement of the Immunization Act (予防接種法施行令) (Japanese encephalitis phase 1 booster: about 1 year after the 2nd initial dose; the standard is age 4; publicly funded until 7 years 6 months old). ${VAX.en}`,
  },
  [`予防接種法施行令（麻しん風しん（MR）の2期は、小学校に入る前の1年間＝年長の4月1日〜3月31日。入学の年は学校教育法第17条から出す。4月1日生まれは1学年早い）。${VAX.ja}`]: {
    zh: `《预防接种法施行令》（予防接種法施行令）（麻疹风疹（MR）第2期，是上小学前的1年，即幼儿园大班的4月1日～3月31日。入学年份根据《学校教育法》第17条推算。4月1日出生的孩子早1个学年）。${VAX.zh}`,
    en: `Order for Enforcement of the Immunization Act (予防接種法施行令) (measles-rubella (MR) phase 2: the 1 year before entering elementary school, that is, April 1 to March 31 of the last preschool year; the year of school entry is worked out from the School Education Act (学校教育法), Article 17; children born on April 1 are 1 school year ahead). ${VAX.en}`,
  },

  // ───────── 家族の形で置き換わる根拠（lib/milestones.ts の adjust）─────────
  // 保育園に預けて働く家族: 調べる・見学の根拠を、保育園の申し込みの根拠に替える（daycare-research）
  [DAYCARE.ja]: { zh: DAYCARE.zh, en: DAYCARE.en },
  // 赤ちゃんが国保に入る家族（health-insurance）
  "国民健康保険法第9条・同法施行規則第3条（国保に入った日から14日以内に届ける。生まれた子は生まれた日から）": {
    zh: "《国民健康保险法》（国民健康保険法）第9条、同法施行规则第3条（自加入国民健康保险之日起14天以内申报。新生儿从出生之日起加入）",
    en: "National Health Insurance Act (国民健康保険法), Article 9, and Article 3 of the Regulation for Enforcement of the same Act (file within 14 days of joining National Health Insurance; a newborn joins from the day of birth)",
  },
  // 双子など: 産前休業は予定日を含めて14週（maternity-leave）
  "労働基準法第65条第1項（多胎妊娠は、14週間以内に出産する予定の人が、請求すれば休める。出産の当日は産前に入るので、予定日を含めて14週（98日）と数え、1日目は予定日の97日前。厚生労働省「働く女性の心とからだの応援サイト」の用語辞典で確かめた・2026年11月）。出産手当金の「出産の日以前98日」も、出産の日を入れて数える（健康保険法第102条・協会けんぽ）": {
    zh: "《劳动基准法》（労働基準法）第65条第1款（多胎妊娠时，预计在14周以内分娩的人，提出请求就可以休假。分娩当天算在产前，所以包括预产期在内数14周（98天），第1天是预产期的97天前。根据厚生劳动省（厚生労働省）“支援职业女性身心网站（働く女性の心とからだの応援サイト）”的用语词典确认，2026年11月）。分娩补贴的“分娩日以前98天”，也包括分娩当天计算（《健康保险法》（健康保険法）第102条、协会健保（協会けんぽ））",
    en: "Labor Standards Act (労働基準法), Article 65, Paragraph 1 (with a multiple pregnancy, a person expected to give birth within 14 weeks can take leave if she requests it; the day of birth counts as before the birth, so 14 weeks (98 days) are counted including the due date, and day 1 is 97 days before the due date; checked in the glossary of the Ministry of Health, Labour and Welfare (厚生労働省) site “Support Site for Working Women's Minds and Bodies (働く女性の心とからだの応援サイト)”, November 2026). For the maternity allowance, “the 98 days on or before the day of birth” are also counted including the day of birth (Health Insurance Act (健康保険法), Article 102; Japan Health Insurance Association (協会けんぽ))",
  },
  // 里帰り: 戻る日の目安は、戻る時期の答え（lib/situation.ts の SATOGAERI_BACKS）と、決めていない時で変わる（satogaeri-return）
  [`目安（答えてもらった戻る時期（1か月健診のあと）から生後35日ごろに置いた近似）。${BACK.ja}`]: {
    zh: `参考标准（根据你回答的回来时间（“满月儿健康检查之后”），估算为出生后35天左右）。${BACK.zh}`,
    en: `Guideline (an approximation set at around 35 days old, from the return timing you gave (“after the one-month checkup”)). ${BACK.en}`,
  },
  [`目安（答えてもらった戻る時期（産後2か月ごろ）から生後60日ごろに置いた近似）。${BACK.ja}`]: {
    zh: `参考标准（根据你回答的回来时间（“产后2个月左右”），估算为出生后60天左右）。${BACK.zh}`,
    en: `Guideline (an approximation set at around 60 days old, from the return timing you gave (“around 2 months after the birth”)). ${BACK.en}`,
  },
  [`目安（答えてもらった戻る時期（それより長く）から生後90日ごろに置いた近似）。${BACK.ja}`]: {
    zh: `参考标准（根据你回答的回来时间（“比这更久”），估算为出生后90天左右）。${BACK.zh}`,
    en: `Guideline (an approximation set at around 90 days old, from the return timing you gave (“longer than that”)). ${BACK.en}`,
  },
  [`目安（戻る時期を決めていないので、1か月健診のあと＝生後35日ごろに置いた近似）。${BACK.ja}`]: {
    zh: `参考标准（因为还没决定回来的时间，按满月儿健康检查之后，即出生后35天左右估算）。${BACK.zh}`,
    en: `Guideline (since you haven't decided when to return, an approximation set after the one-month checkup, at around 35 days old). ${BACK.en}`,
  },

  // ───────── お金が届いたか確かめる（lib/money.ts の MONEY の basis。paidDef が後ろに一文を足す＝いちばん下の鍵）─────────
  "妊婦のための支援給付（子ども・子育て支援法・2025年4月から）。振込は申請から1〜2か月ほど（町ごとに違う・近似）": {
    zh: "孕妇支援给付（《儿童及育儿支援法》（子ども・子育て支援法），2025年4月起）。申请后约1～2个月到账（各市区町村不同，估算）",
    en: "Support benefit for pregnant women (Act on Child and Childcare Support (子ども・子育て支援法), from April 2025). Payment arrives about 1–2 months after you apply (varies by city; approximate)",
  },
  "出産手当金（健康保険法第102条）。振込は申請から1〜2か月ほど（健康保険ごとに違う・近似）": {
    zh: "分娩补贴（《健康保险法》（健康保険法）第102条）。申请后约1～2个月到账（各健康保险不同，估算）",
    en: "Maternity allowance (Health Insurance Act (健康保険法), Article 102). Payment arrives about 1–2 months after you apply (varies by health insurer; approximate)",
  },
  "育児休業給付（雇用保険法第61条の7）。勤め先がハローワークに申請し、支給が決まってから1週間ほどで振り込まれる（近似）。2025年4月からの出生後休業支援給付（同法第61条の10）も一緒に届く事が多い": {
    zh: "育儿休假补贴（《雇用保险法》（雇用保険法）第61条之7）。由工作单位向公共职业安定所（ハローワーク）申请，决定支付后约1周到账（估算）。2025年4月起的出生后休假支援补贴（出生後休業支援給付）（同法第61条之10）也常常一起到账",
    en: "Childcare leave benefit (Employment Insurance Act (雇用保険法), Article 61-7). Your employer applies to Hello Work (ハローワーク), and the money is paid about 1 week after payment is approved (approximate). The post-birth leave support benefit (出生後休業支援給付), from April 2025 (Article 61-10 of the same Act), often arrives together",
  },
  "出生時育児休業給付・出生後休業支援給付（雇用保険法第61条の8・第61条の10）。支給が決まってから1週間ほどで振り込まれる（近似）": {
    zh: "出生时育儿休假补贴（出生時育児休業給付）、出生后休假支援补贴（出生後休業支援給付）（《雇用保险法》（雇用保険法）第61条之8、第61条之10）。决定支付后约1周到账（估算）",
    en: "Childcare leave benefit at birth (出生時育児休業給付) and post-birth leave support benefit (出生後休業支援給付) (Employment Insurance Act (雇用保険法), Articles 61-8 and 61-10). Paid about 1 week after payment is approved (approximate)",
  },
  "公務員は勤め先に確かめる。児童手当法第8条（申請の月の翌月分から。生まれた日の翌日から15日以内なら生まれた月の翌月分から）。2024年10月から、振込は偶数月の年6回で、前の2か月分（振込の日は町ごと）": {
    zh: "公务员请向工作单位确认。《儿童补贴法》（児童手当法）第8条（从申请月的下个月起。如果在出生第二天起15天以内申请，从出生月的下个月起）。2024年10月起，每年在偶数月到账6次，每次是之前2个月的金额（到账日各市区町村不同）",
    en: "Public servants check with their employer. Child Allowance Act (児童手当法), Article 8 (from the month after the month you apply; if within 15 days from the day after the birth, from the month after the birth month). From October 2024, payments are made 6 times a year in even-numbered months, each covering the previous 2 months (the payment date varies by city)",
  },
  "出産育児一時金（健康保険法第101条）。直接支払で費用が一時金より少なかった時の差額。振込は申請から1〜2か月ほど（近似）": {
    zh: "分娩育儿一次性补贴（《健康保险法》（健康保険法）第101条）。使用直接支付、费用低于一次性补贴时的差额。申请后约1～2个月到账（估算）",
    en: "Childbirth and Childcare lump-sum grant (Health Insurance Act (健康保険法), Article 101). The difference when the cost was less than the grant under direct payment. Payment arrives about 1–2 months after you apply (approximate)",
  },
  "医療費控除（所得税法第73条）。確定申告の還付は、申告から1か月〜1か月半ほど（国税庁・e-Tax はもう少し早い事が多い・近似）": {
    zh: "医疗费扣除（医療費控除）（《所得税法》第73条）。确定申报的退税，在申报后约1个月～1个半月（国税厅（国税庁）。e-Tax 多数会更快一些。估算）",
    en: "Medical expense deduction (医療費控除) (Income Tax Act (所得税法), Article 73). A tax return refund takes about 1 to 1.5 months after filing (National Tax Agency (国税庁); e-Tax is often a little faster; approximate)",
  },

  // ───────── 差し込みの鍵: 根拠の後ろに、家族の形で足す一文（milestone-words.ts の BASIS_TAILS が形を見て、もとの根拠と別々に引く）─────────
  // お金が届いたか確かめる（lib/money.ts の paidDef）
  "{basis}。額は手帳に残さない。届かない時は、遅れの理由を決めつけず確かめ先に聞く": {
    zh: "{basis}。金额不记录在手册里。没有到账时，不要自行断定延迟的原因，请向确认的地方询问",
    en: "{basis}. The amount isn't recorded in the handbook. If it doesn't arrive, ask the place to check with, without assuming why it's late",
  },
  // 双子など: 産休の前のお金の手続き（leave-money-request）
  "{basis}。双子などは産前休業が予定日を含めて14週（労働基準法第65条第1項）なので、目安を8週早めた": {
    zh: "{basis}。双胞胎等的产前休假包括预产期在内为14周（《劳动基准法》（労働基準法）第65条第1款），所以把参考时间提前了8周",
    en: "{basis}. For twins or more, maternity leave before the birth is 14 weeks including the due date (Labor Standards Act (労働基準法), Article 65, Paragraph 1), so the guideline was moved 8 weeks earlier",
  },
  // パートナーの育休の長さがわからない（partner-leave）
  "{basis}。生まれて8週の間に通算14日以上取ると、2025年4月からの出生後休業支援給付で賃金の13%が上乗せされる（雇用保険法第61条の10・最大28日分。母の条件もある）": {
    zh: "{basis}。在出生后8周内累计休14天以上，就会通过2025年4月起的出生后休假支援补贴（出生後休業支援給付）追加工资的13%（《雇用保险法》（雇用保険法）第61条之10，最多28天。对母亲也有条件）",
    en: "{basis}. Taking a total of 14 days or more within 8 weeks of the birth adds 13% of wages through the post-birth leave support benefit (出生後休業支援給付), in place since April 2025 (Employment Insurance Act (雇用保険法), Article 61-10; up to 28 days; there are also conditions for the mother)",
  },
  // 公務員の児童手当（child-allowance・child-allowance-change）
  "{basis}・第17条（公務員は勤め先が払う。独立行政法人の職員などは町へ。勤め先で確かめる）": {
    zh: "{basis}、第17条（公务员由工作单位发放。独立行政法人的职员等向市区町村申请。请向工作单位确认）",
    en: "{basis}; Article 17 (for public servants, the employer pays; staff of incorporated administrative agencies and the like go to the city; check with your employer)",
  },
  // 里帰り: 出生届を出せる所（birth-registration。里帰り先の町がわかる時・わからない時か同じ市）
  "{basis}・第25条・第51条（住所地・本籍地・生まれた所の役所に出せる。どちらに出すかは家族が決める）": {
    zh: "{basis}、第25条、第51条（可以向住址所在地、户籍所在地（本籍地）或出生地的市区町村政府提交。向哪里提交，由家人决定）",
    en: "{basis}; Articles 25 and 51 (it can be submitted at the office of your place of residence, your registered domicile (本籍地), or where the baby was born; the family decides where to submit it)",
  },
  "{basis}・戸籍法第51条（生まれた所の役所でも出せる）": {
    zh: "{basis}、《户籍法》（戸籍法）第51条（也可以向出生地的市区町村政府提交）",
    en: "{basis}; Family Register Act (戸籍法), Article 51 (it can also be submitted at the office where the baby was born)",
  },
  // 里帰り: 同じ県の健診代（satogaeri-checkup-refund）
  "{basis}。同じ都道府県の中は、町の間の取り決めで受診券が使える事が多い（近似。町ごとに違う）": {
    zh: "{basis}。在同一都道府县内，根据市区町村之间的约定，检查券多数可以使用（估算。各市区町村不同）",
    en: "{basis}. Within the same prefecture, checkup vouchers can often be used thanks to agreements between cities (approximate; varies by city)",
  },
  // 仕事に戻りたい時期で、入る4月を置いた（daycare-apply）
  "{basis}。入る4月は、仕事に戻りたい時期（1歳になるまでに）から置いた（近似）": {
    zh: "{basis}。入园的4月，是根据想复职的时间（“满1岁之前”）设定的（估算）",
    en: "{basis}. The April of entry is set from when you want to return to work (“by age 1”) (approximate)",
  },
  "{basis}。入る4月は、仕事に戻りたい時期（1歳を過ぎてから）から置いた（近似）": {
    zh: "{basis}。入园的4月，是根据想复职的时间（“过了1岁之后”）设定的（估算）",
    en: "{basis}. The April of entry is set from when you want to return to work (“after age 1”) (approximate)",
  },
} satisfies Entries;
