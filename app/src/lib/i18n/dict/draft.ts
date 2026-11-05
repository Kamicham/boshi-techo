// 辞書: やる事を開いた時の動き（components/MilestoneActions.tsx のボタンと、components/draft/ の下書き・町の窓口の調べ・待つ間の表示）。
// 書き方は lib/i18n/index.ts の頭。言葉は lib/i18n/glossary.ts にそろえる。同じ鍵を2つの場所に置かない（ほかの辞書にある鍵は、そちらを使う:
// 下書きの呼び名・宛先・下書き・{m}月{d}日 は today.ts、件名・本文 は ask.ts、なぜ？ は now.ts、米国の Claude に送る同意・（{x}） は core.ts、
// 残しています…・入れています…・やめる・{n}秒 は album.ts）。
// 勤め先・役所あての文書（下書きの宛先・件名・本文と、その【 】の欄の名前）と、窓口・持ち物の名前（町のページから取った物）は日本語のまま出す。
import type { Entries } from "..";

export default {
  // ── 下書きのボタン（MilestoneActions）。{noun} は下書きの呼び名（today.ts の「職場へのメール」など）、{word} は家族の印 ──
  "{noun}を作る": { zh: "写{noun}", en: "Make the {noun}" },
  "{noun}を見る": { zh: "查看{noun}", en: "View the {noun}" },
  "{noun}を見る（✓ {word}）": { zh: "查看{noun}（✓ {word}）", en: "View the {noun} (✓ {word})" },
  "{noun}を閉じる": { zh: "收起{noun}", en: "Close the {noun}" },
  /** 手帳に聞くの答え（answers.ts）でも、このボタンを「看看去哪里」「See where to go」と呼ぶ */
  どこへ行くか見る: { zh: "看看去哪里", en: "See where to go" },
  行き先を閉じる: { zh: "收起去处", en: "Close where to go" },
  /** 読み上げの札（{title} は予定の一言、{label} はボタンの札） */
  "{title}の{label}": { zh: "{title}：{label}", en: "{title}: {label}" },

  // ── 下書きの種類（lib/drafts.ts の DraftKind。値は日本語のまま持ち、札に描く時に訳す）と、家族が付ける印（DraftPanel の doneWord） ──
  メール: { zh: "邮件", en: "Email" },
  記入メモ: { zh: "填写备忘", en: "Fill-in memo" },
  質問リスト: { zh: "问题清单", en: "Question list" },
  頼み文: { zh: "拜托的话", en: "Request" },
  送った: { zh: "已发送", en: "Sent" },
  書いた: { zh: "已填写", en: "Filled in" },
  聞いた: { zh: "已问过", en: "Asked" },
  使った: { zh: "已使用", en: "Used" },

  // ── 担当でない人が開いた時（DraftPanel の HandTo）。{name} は担当の人の呼び名 ──
  "{name}の名前と職場で書いています。": { zh: "草稿是按{name}的名字和工作单位写的。", en: "This is written with {name}'s name and workplace." },
  "{name}に LINE で頼む ›": { zh: "用 LINE 拜托{name} ›", en: "Ask {name} on LINE ›" },
  /** LINE で担当の人へ渡す文（{title} は予定の題） */
  "「{title}」の下書きを、手帳に用意したよ。手帳で開いて、確かめてから使ってね。": {
    zh: "“{title}”的草稿已经在手册里准备好了。在手册里打开，确认一下再用吧。",
    en: "The draft for “{title}” is ready in the handbook. Open it there and check it before you use it.",
  },

  // ── 下書きを待つ間（Working に渡す行） ──
  前に作った下書きを開いています: { zh: "正在打开之前写好的草稿", en: "Opening the draft you made earlier" },
  下書きを書いています: { zh: "正在写草稿", en: "Writing the draft" },
  期限と町の調べに合わせています: { zh: "正在按期限和查到的当地信息调整", en: "Fitting it to the deadline and your town's info" },
  "分からない所を【 】にしています（もう少し）": { zh: "正在把不清楚的地方留成【 】（快好了）", en: "Leaving unknown parts as 【 】 (almost done)" },
  "できたら、ここに宛先・件名・本文が出ます": { zh: "写好后，收件人、主题和正文会显示在这里", en: "When it's ready, the recipient, subject, and body will show here" },

  // ── 同意の前で止まった時（DraftConsent）。{consent} は core.ts の「米国の Claude に送る同意」（太字で差し込む） ──
  "下書きを書くには、{consent}が要ります。読んで決めて戻ると、そのまま書きます。": {
    zh: "要写草稿，需要{consent}。阅读并决定后回来，就会接着写。",
    en: "To write the draft, the handbook needs your {consent}. Read it, decide, and come back, and it will go right on writing.",
  },

  // ── 下書きの中身（DraftBody・EditFields） ──
  "✓ {word}・{date}": { zh: "✓ {word} · {date}", en: "✓ {word} · {date}" },
  "{name}さんから送る文": { zh: "{name}要发送的内容", en: "For {name} to send" },
  "{name}さんから使うメモ": { zh: "{name}要用的备忘", en: "Memo for {name} to use" },
  宛名: { zh: "收件人名称", en: "Recipient name" },
  メールアドレス: { zh: "邮箱地址", en: "Email address" },
  出す先: { zh: "提交到", en: "Submit to" },
  見出し: { zh: "标题", en: "Title" },
  /** サーバの一言（lib/drafts.ts の mailHint。町の名前入り）。画面が形を見て、この鍵で引く */
  "宛先は{city}のページで（問い合わせのフォームやメールアドレス）": {
    zh: "收件人请在{city}的网页上查找（咨询表单或邮箱地址）",
    en: "Find the recipient on {city}'s website (an inquiry form or email address)",
  },
  "「{word}」を外す": { zh: "取消“{word}”", en: "Unmark “{word}”" },
  文を直す: { zh: "修改文字", en: "Edit the text" },
  作り直す: { zh: "重新写", en: "Rewrite" },
  直した文を残す: { zh: "保存修改后的文字", en: "Save the edited text" },
  送る前に確かめる事: { zh: "发送前要确认的事", en: "Check before sending" },
  "「{word}」は家族の印です。手帳からは何も送りません。印を付けると、この事も済みになります（外すと戻ります）。": {
    zh: "“{word}”是家人自己做的标记。手册不会发送任何东西。做了标记，这件事也会算作完成（取消标记就会恢复）。",
    en: "“{word}” is your family's own mark. The handbook doesn't send anything. Marking it also marks this task as done (unmarking undoes that).",
  },
  "町の調べに合わせて書きました。": { zh: "已按查到的当地信息来写。", en: "Written to match what was looked up for your town." },

  // ── 空欄を埋める（BlankFields）。欄の名前は文書の【 】の言葉なので、日本語のまま ──
  "空欄を埋める（{n}か所）": { zh: "填写空白（{n}处）", en: "Fill in the blanks ({n})" },
  "会社名・名前などは、次の下書きから自動で入ります": {
    zh: "公司名称、姓名等，从下一份草稿起会自动填入",
    en: "Things like your company and your name will fill in automatically from the next draft on",
  },
  覚えます: { zh: "会记住", en: "Saved for next time" },
  "{n}か所を埋める": { zh: "填入{n}处", en: "Fill in {n} {n:blank|blanks}" },
  埋める: { zh: "填入", en: "Fill in" },
  // 欄の入れ方の例（入れた値は勤め先・病院あての日本語の文書に入る。中文・English は、何を入れる欄かが分かる例に）
  "例: ○○株式会社": { zh: "例：○○株式会社", en: "e.g. ○○ Co., Ltd." },
  "例: 営業部": { zh: "例：营业部", en: "e.g. Sales" },
  "例: 山田": { zh: "例：山田", en: "e.g. Yamada" },
  "例: 人事部 佐藤": { zh: "例：人事部 佐藤", en: "e.g. HR, Sato" },
  "例: ○○レディースクリニック": { zh: "例：○○妇产科诊所", en: "e.g. ○○ Women's Clinic" },
  "例: 佐藤 翔太": { zh: "例：佐藤 翔太", en: "e.g. Shota Sato" },

  // ── 町の窓口の調べ（LocalPanel）。{city} は町の名前（日本語のまま。窓口で使う）。窓口・持ち物・期限の中身は、町のページから取った日本語 ──
  "{city}での手続き": { zh: "在{city}办的手续", en: "Paperwork in {city}" },
  "{city}の公式サイトを探しています": { zh: "正在查找{city}的官方网站", en: "Looking for {city}'s official website" },
  見つけたページを読み比べています: { zh: "正在对比阅读找到的网页", en: "Reading and comparing the pages it found" },
  "窓口・持ち物・期限を拾っています": { zh: "正在整理窗口、要带的东西和期限", en: "Picking out the counter, what to bring, and the deadline" },
  "短く整えています（もう少し）": { zh: "正在整理得简短些（快好了）", en: "Making it short and clear (almost done)" },
  "できたら、ここに「どこへ・何を持って」が出ます": { zh: "查好后，这里会显示“去哪里、带什么”", en: "When it's ready, where to go and what to bring will show here" },
  どこへ: { zh: "去哪里", en: "Where to go" },
  何を持って: { zh: "带什么", en: "What to bring" },
  いつまで: { zh: "期限", en: "Deadline" },
  // 家族へ LINE・共有で渡す文の行
  "どこへ: {where}": { zh: "去哪里：{where}", en: "Where to go: {where}" },
  "持ち物: {items}": { zh: "要带的东西：{items}", en: "What to bring: {items}" },
  "いつまで: {deadline}": { zh: "期限：{deadline}", en: "Deadline: {deadline}" },
  "ネットで出す・町だけの事": { zh: "网上办理、当地特有的事", en: "Online, and your town's own rules" },
  "ネットで: {online}": { zh: "网上：{online}", en: "Online: {online}" },
  "{city}だけの事: {extras}": { zh: "{city}特有的事：{extras}", en: "Only in {city}: {extras}" },
  "出典・確かめる事": { zh: "出处、要确认的事", en: "Sources and what to check" },
  "窓口のくわしい事: {where}": { zh: "窗口的详细情况：{where}", en: "Counter details: {where}" },
  "期限のくわしい事: {deadline}": { zh: "期限的详细情况：{deadline}", en: "Deadline details: {deadline}" },
  "出典のページが取れませんでした。窓口で確かめてください。": {
    zh: "没能取得出处网页。请到窗口确认。",
    en: "Couldn't get the source pages. Please check at the counter.",
  },
  役所のページ: { zh: "政府网页", en: "Official page" },
  "{date}に調べた・制度は変わる事があります": { zh: "{date}查询 · 制度可能会有变化", en: "Looked up on {date} · Rules may change" },
  調べ直す: { zh: "重新查", en: "Look up again" },

  // ── 失敗の行（Working の ErrorLine） ──
  /**
   * やり直すの「もう一度」。「もう一度」だけの鍵は一冊の映画（book.ts の「Watch again」）が持つので、空の {retry} を付けた鍵で訳を分ける
   * （日本語は前と同じ。lib/i18n/milestone-words.ts の childWord と同じやり方）
   */
  "もう一度{retry}": { zh: "再试一次{retry}", en: "Try again{retry}" },
} satisfies Entries;
