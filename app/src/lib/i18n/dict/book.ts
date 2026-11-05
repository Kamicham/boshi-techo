// 辞書: 一冊の画面（app/book）・映画（app/book/film）・印刷用（app/book/print）と、一冊の下の部品（components/album の FilmLink・FilmExport）。
// 一冊の中身（題・はじめに・章の文・出来事・写真の一言・映画の字幕）は家族の記録から Claude が書いたデータなので、ここでは訳さない
// （見本の一冊の訳は別のファイルに置く・多言語化のプランの⑤）。訳すのは、まわりの枠の字だけ。
// 書き方は lib/i18n/index.ts の頭。一冊は「成长书」「book」（UX の shell.ts の下のタブにそろえる）、映画は「电影」「movie」。
import type { Entries } from "..";

export default {
  // ── 一冊の画面 ──
  記録を日付順に並べています: { zh: "正在按日期排列记录", en: "Putting the records in date order" },
  "おなかにいた日々から、時期に分けています": { zh: "正在从在肚子里的日子开始，按时期划分", en: "Dividing them into stages, starting with the days in the womb" },
  家族の言葉を読み返しています: { zh: "正在重读家人的话", en: "Rereading your family's words" },
  章の題を考えています: { zh: "正在想各章的标题", en: "Thinking of chapter titles" },
  "写真の一言と記録の言葉から、章に合う写真を選んでいます（写真は見ていません）": {
    zh: "正在根据照片的一句话和记录的文字，挑选适合各章的照片（不看照片本身）",
    en: "Choosing photos for each chapter from their captions and the records (without looking at the photos)",
  },
  子どもに語りかける言葉を選んでいます: { zh: "正在挑选对孩子说的话", en: "Choosing words that speak to your child" },
  ページを綴じています: { zh: "正在装订页面", en: "Binding the pages" },
  "本棚を見ています…": { zh: "正在查看书架…", en: "Checking the bookshelf…" },
  "見本の家族（作った家族）の{date}までの記録 {n} 件から、{writer}が、本番と同じ書き方の決まりで実際に書いた一冊です。あなたの手帳では、あなたの記録から書きます。": {
    zh: "这是{writer}根据示例家庭（虚构的家庭）截至{date}的 {n} 条记录，按照与正式版相同的写作规则实际写成的成长书。在你的手册里，会根据你的记录来写。",
    en: "{writer} actually wrote this book from {n} records of the sample family (a fictional family) up to {date}, following the same writing rules as the real service. In your handbook, it's written from your own records.",
  },
  "見本の家族（作った家族）の{date}までの記録 {n} 件から、Claude が実際に書いた一冊です。あなたの手帳では、あなたの記録から書きます。": {
    zh: "这是 Claude 根据示例家庭（虚构的家庭）截至{date}的 {n} 条记录实际写成的成长书。在你的手册里，会根据你的记录来写。",
    en: "Claude actually wrote this book from {n} records of the sample family (a fictional family) up to {date}. In your handbook, it's written from your own records.",
  },
  "この一冊は前の決まりで作ったので、「聞く」で相談した気がかりが文に入っているかもしれません。今の決まりでは、気がかりは一冊に入れません。": {
    zh: "这本成长书是按以前的规则制作的，文中可能包含你在“提问”里咨询过的担忧。按现在的规则，担忧不会写进成长书。",
    en: "This book was made under the old rules, so worries you asked about in “Ask” may be in the text. Under the current rules, worries never go into the book.",
  },
  今の決まりで作り直す: { zh: "按现在的规则重新制作", en: "Remake it under the current rules" },
  "書き出す・作り直す": { zh: "导出 / 重新制作", en: "Export / remake" },
  家族に渡す: { zh: "分享给家人", en: "Share with family" },
  "印刷用（A5・PDF）": { zh: "打印版（A5，PDF）", en: "For printing (A5, PDF)" },
  "Claude に渡したのは、写真の日付・一言・結んだ記録・声の題と最初の一文の文字だけです（写真 {p} 枚・声 {v} 本の候補。画像も声も渡していません）。": {
    zh: "交给 Claude 的只有文字：照片的日期、一句话、关联的记录，以及声音的标题和第一句话（候选为照片 {p} 张、声音 {v} 段。图像和声音都没有交出去）。",
    en: "Claude only got text: each photo's date, caption and linked records, plus each voice's title and first sentence (candidates: {p} {p:photo|photos}, {v} {v:voice|voices}; no images or audio were given).",
  },
  "Claude に渡したのは、写真の日付・一言・結んだ記録の文字だけです（写真 {p} 枚の候補。画像も声も渡していません）。": {
    zh: "交给 Claude 的只有文字：照片的日期、一句话和关联的记录（候选为照片 {p} 张。图像和声音都没有交出去）。",
    en: "Claude only got text: each photo's date, caption and linked records (candidates: {p} {p:photo|photos}; no images or audio were given).",
  },
  "{date}までの記録 {n} 件から作りました": { zh: "根据截至{date}的 {n} 条记录制作", en: "Made from the records up to {date} ({n} in all)" },
  "いま {n} 件": { zh: "现在 {n} 条", en: "Now {n}" },
  今日までの記録で作り直す: { zh: "用截至今天的记录重新制作", en: "Remake with the records up to today" },
  いまの記録でまとめてみる: { zh: "先用现有的记录整理看看", en: "Try making it from the records so far" },
  "🌸 アルバム（月ごとの写真）": { zh: "🌸 相册（按月的照片）", en: "🌸 Album (photos by month)" },
  "何が本になる？": { zh: "什么会变成书？", en: "What goes into the book?" },
  "話す・撮る: 胎動を感じた日、はじめて笑った顔": { zh: "说·拍：感到胎动的那天、第一次笑的样子", en: "Talk · Snap: the day you felt the first kicks, the first smile" },
  "健診: 先生と話した事（体の良し悪しは書きません）": { zh: "健康检查：和医生谈过的事（不写身体的好坏）", en: "Checkups: what you talked about with the doctor (nothing about whether your health is good or bad)" },
  "済んだ手続き: 家族がした事の題だけ": { zh: "办完的手续：只写家人做过的事的标题", en: "Finished paperwork: only the names of what your family did" },
  "手帳: できた日・気持ちの記録・出産の記録": { zh: "手册：做到的那天、心情的记录、分娩的记录", en: "Handbook: firsts, feelings and the birth record" },
  "写真: アルバムの写真（Claude には写真の文字だけを渡し、画像は見せません）": {
    zh: "照片：相册里的照片（只把照片的文字交给 Claude，不给它看图像）",
    en: "Photos: photos in the album (Claude only gets the text about them, never the images)",
  },
  "第{n}章　{title}（{period}）": { zh: "第{n}章　{title}（{period}）", en: "Chapter {n}: {title} ({period})" },
  はじめに: { zh: "写在前面", en: "Foreword" },
  おわりに: { zh: "写在最后", en: "Afterword" },
  "1000日の記録": { zh: "1000天的记录", en: "A record of 1000 days" },
  一冊を綴じています: { zh: "正在装订成长书", en: "Binding the book" },
  "{n} 秒・数分かかります。この画面のままで": { zh: "{n} 秒 · 需要几分钟。请停留在这个页面", en: "{n}s · This takes a few minutes. Please stay on this screen" },
  ページをめくる: { zh: "翻页", en: "Turn the pages" },
  "← 前へ": { zh: "← 上一页", en: "← Back" },
  "次へ →": { zh: "下一页 →", en: "Next →" },
  この章の声: { zh: "这一章的声音", en: "Voices in this chapter" },
  "1000 日 の 記 録": { zh: "1000 天 的 记 录", en: "1000 days" },
  "第{n}章・{period}": { zh: "第{n}章 · {period}", en: "Chapter {n} · {period}" },

  // ── 映画で見る（FilmLink）・動画にする（FilmExport）──
  "▶ 映画で見る": { zh: "▶ 看电影版", en: "▶ Watch the movie" },
  "家族の声 {n} 本": { zh: "家人的声音 {n} 段", en: "Family voices: {n}" },
  "声の手紙 {n} 通": { zh: "声音信 {n} 封", en: "Voice letters: {n}" },
  "約{n}分": { zh: "约{n}分钟", en: "About {n} min" },
  "{m}分{s}秒": { zh: "{m}分{s}秒", en: "{m}m {s}s" },
  "作れませんでした（{status}）": { zh: "无法制作（{status}）", en: "Couldn't make it ({status})" },
  "読めませんでした（{status}）": { zh: "无法读取（{status}）", en: "Couldn't load it ({status})" },
  "体験版では、動画（mp4）の書き出しは閉じています。映画は、上の「映画で見る」からそのまま見られます。": {
    zh: "体验版不提供视频（mp4）导出。电影可以直接从上面的“看电影版”观看。",
    en: "Exporting a video (mp4) is turned off in the trial. You can watch the movie right away with “Watch the movie” above.",
  },
  "🎞 動画にしました（{dur}・{size}・横長）。LINE やテレビでそのまま流せます。": {
    zh: "🎞 已做成视频（{dur} · {size} · 横版）。可以直接在 LINE 或电视上播放。",
    en: "🎞 Made into a video ({dur} · {size} · landscape). You can play it as is on LINE or a TV.",
  },
  保存する: { zh: "保存", en: "Save" },
  "動画を組んでいます…（{n}秒）写真の多い一冊は1〜2分かかります。この画面のままお待ちください。": {
    zh: "正在制作视频…（{n}秒）照片多的成长书需要1〜2分钟。请停留在这个页面等待。",
    en: "Making the video… ({n}s) A book with many photos takes 1–2 minutes. Please stay on this screen.",
  },
  "🎞 動画にする（mp4）": { zh: "🎞 做成视频（mp4）", en: "🎞 Make a video (mp4)" },
  "映画を1本の動画にして、家族に送ったりテレビで流したりできるようにします。組むのは手帳の中だけで、AI（Claude）にも外のサービスにも送りません。": {
    zh: "把电影做成一个视频，方便发给家人或在电视上播放。制作只在手册内部完成，不会发给 AI（Claude），也不会发给外部服务。",
    en: "Turns the movie into a single video you can send to family or play on a TV. It's made only inside the handbook and is never sent to the AI (Claude) or any outside service.",
  },

  // ── 映画（app/book/film）──
  "映画を用意しています…": { zh: "正在准备电影…", en: "Getting the movie ready…" },
  "映画にする写真がまだありません。アルバムに写真を残して、一冊を作り直すと映画になります。": {
    zh: "还没有可以做成电影的照片。在相册里留下照片，再重新制作成长书，就会变成电影。",
    en: "There are no photos for a movie yet. Keep photos in the album and remake the book, and it becomes a movie.",
  },
  一冊へ戻る: { zh: "回到成长书", en: "Back to the book" },
  "♪ 声の手紙": { zh: "♪ 声音信", en: "♪ Voice letter" },
  "▶ 再生する": { zh: "▶ 播放", en: "▶ Play" },
  "約{n}分・音が出ます。画面を押すと止まります": { zh: "约{n}分钟 · 会有声音。点一下画面就会暂停", en: "About {n} min · Sound on. Tap the screen to pause" },
  "家族が交わしたありがとう {n}": { zh: "家人之间的感谢 {n}", en: "Family thank-yous: {n}" },
  もう一度: { zh: "再看一次", en: "Watch again" },
  一冊へ: { zh: "回到成长书", en: "To the book" },
  "✕ 閉じる": { zh: "✕ 关闭", en: "✕ Close" },
  "止めています・押すと続き": { zh: "已暂停 · 点一下继续", en: "Paused · Tap to continue" },

  // ── 印刷用（app/book/print）──
  "‹ 一冊へ": { zh: "‹ 回到成长书", en: "‹ Book" },
  "印刷用（A5）": { zh: "打印版（A5）", en: "For printing (A5)" },
  "「印刷・PDF にする」を押し、iPhone は「プリント」、Mac は「PDF として保存」を選びます。写真の会社に印刷を頼む時は、その会社に写真が渡ります。": {
    zh: "点“打印 / 存为 PDF”，iPhone 选择“打印”，Mac 选择“存储为 PDF”。如果请照片冲印公司打印，照片会交给那家公司。",
    en: "Tap “Print / save as PDF”, then choose “Print” on iPhone or “Save as PDF” on a Mac. If you ask a photo-printing company to print it, your photos go to that company.",
  },
  "印刷・PDF にする": { zh: "打印 / 存为 PDF", en: "Print / save as PDF" },
  "一冊を開いています…": { zh: "正在打开成长书…", en: "Opening the book…" },
  "まだ一冊がありません。一冊の画面で作ってから開いてください。": {
    zh: "还没有成长书。请先在成长书页面制作，然后再打开。",
    en: "There's no book yet. Make one on the Book screen first, then open this.",
  },
} satisfies Entries;
