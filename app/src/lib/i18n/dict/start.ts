// 辞書: はじめの画面（app/start/page.tsx の「自分の手帳を始める」と3つ答えた後の予告・lib/start-preview.ts）。
// 書き方は lib/i18n/index.ts の頭。町の名前は日本語で入れてもらう（窓口の調べ・県の番号の表が日本語の名前で引くため）
import type { Entries } from "..";

export default {
  // ── 3つの問い ──
  "‹ 戻る": { zh: "‹ 返回", en: "‹ Back" },
  // 「自分の手帳を始める」は入口の1枚と同じ鍵（welcome.ts）
  "3つだけ。答えると、あなたの手帳がその場で動きます。名前やメールは、残す時に。": {
    zh: "只需回答3个问题。回答后，你的手册马上就能用。名字和邮箱，等保存时再填。",
    en: "Just 3 questions. Answer them and your handbook starts working right away. Your name and email can wait until you save it.",
  },
  "1. いつ？": { zh: "1. 什么时候？", en: "1. When?" },
  おなかにいる: { zh: "还在肚子里", en: "Still expecting" },
  もう生まれた: { zh: "已经出生了", en: "Already born" },
  // 「生まれた日」は思い出の辞書（memories.ts）の訳を使う（欄の名前としても読める形）
  出産予定日: { zh: "预产期", en: "Due date" },
  生まれてから2歳までの日を入れてください: { zh: "请填写2岁以内孩子的出生日期", en: "Please enter the birth date of a child up to 2 years old" },
  "今日から先、およそ10か月までの日を入れてください": { zh: "请填写从今天起大约10个月以内的日期", en: "Please enter a date from today up to about 10 months ahead" },
  "2. 住んでいる町": { zh: "2. 居住的城市", en: "2. Your town" },
  "手続きの窓口と、町ごとの制度を出すのに使います": { zh: "用来显示办手续的窗口，以及各地不同的制度", en: "Used to show where to do paperwork and your town's own programs" },
  都道府県: { zh: "都道府县", en: "Prefecture" },
  市区町村: { zh: "市区町村", en: "City or town" },
  "都道府県（例: 埼玉県）": { zh: "都道府县，请用日文填写（例：埼玉県）", en: "Prefecture, in Japanese (e.g. 埼玉県)" },
  "市区町村（例: さいたま市）": { zh: "市区町村，请用日文填写（例：さいたま市）", en: "City or town, in Japanese (e.g. さいたま市)" },
  "3. あなたと家族": { zh: "3. 你和家人", en: "3. You and your family" },
  あなたは: { zh: "你是", en: "You are" },
  "ママ（母）": { zh: "妈妈（母亲）", en: "Mom (mother)" },
  "パパ・パートナー": { zh: "爸爸／伴侣", en: "Dad / partner" },
  "一緒に育てる人は？": { zh: "有一起养育孩子的人吗？", en: "Anyone raising the child with you?" },
  いる: { zh: "有", en: "Yes" },
  いない: { zh: "没有", en: "No" },
  今は答えない: { zh: "暂不回答", en: "Skip for now" },
  "家族のやる事を、誰の番かに分けて出すのに使います。あとから設定で直せます。": {
    zh: "用来把家里要做的事，按轮到谁分开显示。之后可以在设置中修改。",
    en: "Used to show the family's tasks by whose turn it is. You can change this later in settings.",
  },
  "「いない」の時は、ひとり親の家庭の手当・助成の手続きも並べます。あとから設定で直せます。": {
    zh: "选“没有”时，也会列出单亲家庭的补贴和资助手续。之后可以在设置中修改。",
    en: "If you choose “No”, we'll also list allowances and support for single-parent families. You can change this later in settings.",
  },
  手帳を開く: { zh: "打开手册", en: "Open the handbook" },
  "3. を選ぶと開きます": { zh: "选好第3题后就能打开", en: "Answer question 3 to open it" },
  "答えはこの端末の中だけに置きます。まだどこにも送りません。": {
    zh: "答案只保存在这台设备里，还不会发送到任何地方。",
    en: "Your answers stay on this device only. Nothing is sent anywhere yet.",
  },
  "まだ残せていません（{reason}）": { zh: "还没能保存（{reason}）", en: "Couldn't save it yet ({reason})" },

  // ── 3つ答えた後の予告（記録なしの「いま」） ──
  答えを直す: { zh: "修改回答", en: "Edit answers" },
  "{w}週 ・ 予定日まであと{n}日": { zh: "{w}周 · 离预产期还有{n}天", en: "Week {w} · {n} {n:day|days} until the due date" },
  "{place}・2歳までにやる事 {n}件を、手帳が時期ごとに出します": {
    zh: "{place}：到2岁为止要做的{n}件事，手册会按时期显示",
    en: "{place}: the handbook will show the {n} {n:thing|things} to do before age 2, stage by stage",
  },
  始める前に目安が過ぎた事: { zh: "开始用手册前已过了参考时间的事", en: "Things whose suggested time passed before you started" },
  "{more}（下の一覧にあります）": { zh: "{more}（在下面的列表里）", en: "{more} (in the list below)" },
  "残すと、済んでいるかを手帳が聞きます。済んでいれば、押すだけで消えます。": {
    zh: "保存后，手册会问你是否已经办好。办好了的话，点一下就会消失。",
    en: "Once you save, the handbook will ask whether these are done. If they are, one tap clears them.",
  },
  もうすぐ: { zh: "快到了", en: "Coming up" },
  次にやる事: { zh: "接下来要做的事", en: "Next to do" },
  "目安 {date} ごろまでに": { zh: "参考时间 {date} 前后", en: "Aim for around {date}" },
  "期限 {date} まで": { zh: "期限 {date} 之前", en: "Due by {date}" },
  "{date}まで": { zh: "{date}之前", en: "By {date}" },
  "残すと、手帳が{city}の窓口・持ち物を調べて、書く事のメモまで作っておきます": {
    zh: "保存后，手册会查好{city}的窗口和要带的东西，连填写备忘也会准备好",
    en: "Once you save, the handbook looks up {city}'s office and what to bring, and even prepares notes on what to fill in",
  },
  "今週は、何もしなくて大丈夫": { zh: "这周什么都不用做也没关系", en: "Nothing you need to do this week" },
  "次に動くのは「{what}」（{when}）。近づいたら、手帳が一番上に出します。": {
    zh: "下一件要做的是“{what}”（{when}）。临近时，手册会把它显示在最上面。",
    en: "Next up is “{what}” ({when}). When it gets close, the handbook will put it at the top.",
  },
  このあと: { zh: "接下来", en: "Coming up next" },
  "始める前に目安が過ぎた事（残すと、済んでいるかを聞きます）": {
    zh: "开始用手册前已过了参考时间的事（保存后，会问你是否已经办好）",
    en: "Things whose suggested time passed before you started (once you save, we'll ask whether they're done)",
  },
  この手帳を残しますか: { zh: "要保存这本手册吗？", en: "Keep this handbook?" },
  "メールのコードで入ると、済んだ印が残り、家族と分け合えて、話した事・撮った紙・写真が手帳に積み上がります。": {
    zh: "用邮箱验证码登录后，“办完了”的标记会保存下来，可以和家人共享，说的话、拍的纸和照片都会积累在手册里。",
    en: "Sign in with a code sent to your email to keep your “done” marks, share with your family, and build up what you say, the papers you snap, and your photos in the handbook.",
  },
  "手帳を作っています…": { zh: "正在创建手册…", en: "Creating your handbook…" },
  "残す（メールで入る）": { zh: "保存（用邮箱登录）", en: "Save (sign in with email)" },
  "この体験版では、本物の家族の手帳はまだ残せません。見本の家族の手帳で、記録がたまった後の姿を触れます。": {
    zh: "这个体验版还不能保存真实家庭的手册。可以在示例家庭的手册里，体验记录积累之后的样子。",
    en: "This trial can't save a real family's handbook yet. In the sample family's handbook, you can try how it looks once records build up.",
  },
  見本の家族の手帳を見る: { zh: "查看示例家庭的手册", en: "See the sample family's handbook" },
  // lib/start-preview.ts
  "まず、{what}（目安 {date} を過ぎています。今からでもできます）": {
    zh: "首先是“{what}”（已过了参考时间 {date}，现在也来得及）",
    en: "First: {what} (the suggested date, {date}, has passed. You can still do it now)",
  },
  "ほか{n}件": { zh: "另外{n}件", en: "{n} more" },
} satisfies Entries;
