// 辞書: アルバムと思い出の部品（components/album の写真・声・手紙・みんなの章・家族のありがとう）。
// 一冊・映画・印刷の画面は book.ts、lib の側の言葉（時期・節目・声の題・手紙の開く日）は memories.ts。
// 書き方は lib/i18n/index.ts の頭。共通の短い言葉（閉じる・赤ちゃん・（{x}）・通信できませんでした）は core の物を使う。
// - 「この1枚」は月ごとに選ぶ1枚（English は Pick of the month）。「残す」は写真・声を手帳にしまう事（English は Keep）。
// - 中文は简体字・呼びかけは「你」。訳に「・」を残さない（区切りは lib/memory-words.ts の dot()）。
import type { Entries } from "..";

export default {
  // ── 行き来 ──
  "‹ 手帳へ": { zh: "‹ 回到手册", en: "‹ Handbook" },
  "一冊へ ›": { zh: "成长书 ›", en: "Book ›" },

  // ── アルバム（AlbumScreen）──
  "{child}のアルバム": { zh: "{child}的相册", en: "{child}'s album" },
  "月ごとの「この1枚」は、手帳が仮に選んでおきます。★で選び直せます。残した声も、同じ月に並びます。": {
    zh: "每个月的“这一张”，手册会先帮你暂选。点★可以重新选。留下的声音也会排在同一个月里。",
    en: "The handbook picks a photo of the month for you for now. Tap ★ to choose another. Voices you keep appear in the same month.",
  },
  "アルバムを開いています…": { zh: "正在打开相册…", en: "Opening the album…" },
  "この手帳では、まだ写真を残せません": { zh: "这本手册还不能保存照片", en: "You can't keep photos in this handbook yet" },
  "写真は家族のアカウント（ログイン）で守って残します。いまは準備中です。": {
    zh: "照片会在家庭账号（登录）下受到保护并保存。现在还在准备中。",
    en: "Photos are kept safe under your family's account (sign-in). This is still being set up.",
  },
  "写真 {n} 枚": { zh: "照片 {n} 张", en: "Photos: {n}" },
  "声 {n} 本": { zh: "声音 {n} 段", en: "Voices: {n}" },
  "{size}（この家族の置き場だけ・鍵つき）": { zh: "{size}（只存放在这个家庭的空间，已加密）", en: "{size} (only in this family's storage, encrypted)" },
  "まだ写真がありません。「🌸 残す」から足すと、月ごとに並びます。": {
    zh: "还没有照片。从“🌸 留存”添加后，会按月排列。",
    en: "No photos yet. Add some with “🌸 Keep” and they'll be arranged by month.",
  },
  "{date} の写真": { zh: "{date} 的照片", en: "Photo from {date}" },
  声: { zh: "声音", en: "Voice" },
  "★ この1枚": { zh: "★ 这个月的这一张", en: "★ Pick of the month" },
  "☆ この1枚": { zh: "☆ 这个月的这一张", en: "☆ Pick of the month" },
  "この1枚（仮）": { zh: "这个月的这一张（暂选）", en: "Pick of the month (for now)" },
  "手帳「{titles}」": { zh: "手册“{titles}”", en: "Handbook: “{titles}”" },
  "Claude には見せていません（声も聞かせていません）。一冊を作る時も、Claude に渡すのは日付・一言・結んだ記録・声の題と最初の一文の文字だけです。": {
    zh: "这些没有给 Claude 看过（声音也没有让它听）。制作成长书时，交给 Claude 的也只有文字：日期、一句话、关联的记录，以及声音的标题和第一句话。",
    en: "None of this is shown to Claude (it doesn't hear the voices either). Even when making the book, Claude only gets text: dates, captions, linked records, and each voice's title and first sentence.",
  },
  "入れられませんでした（{status}）": { zh: "无法添加（{status}）", en: "Couldn't add them ({status})" },
  "入れています…": { zh: "正在添加…", en: "Adding…" },
  見本の写真と声を入れる: { zh: "添加示例照片和声音", en: "Add sample photos and voices" },
  "見本の写真は画像生成、声は合成音声で作った物です（作った家族・実在の人ではありません）。": {
    zh: "示例照片由图像生成制作，声音由合成语音制作（虚构的家庭，并非真实存在的人）。",
    en: "The sample photos were made with image generation and the voices with synthetic speech (a fictional family, not real people).",
  },
  ゴミ箱: { zh: "回收站", en: "Trash" },
  "読んでいます…": { zh: "正在读取…", en: "Loading…" },
  "ゴミ箱は空です。入れた写真は{n}日たつと消えます。": {
    zh: "回收站是空的。放进来的照片过{n}天后会被删除。",
    en: "The trash is empty. Photos you put here are deleted after {n} {n:day|days}.",
  },
  "{n}日たつと、写真のファイルごと消えます。それまでは戻せます。": {
    zh: "过{n}天后，照片文件会被一并删除。在那之前都可以恢复。",
    en: "After {n} {n:day|days}, the photo files are deleted too. Until then, you can restore them.",
  },
  戻す: { zh: "恢复", en: "Restore" },
  "今すぐ消しますか？（戻せません）": { zh: "现在就删除吗？（无法恢复）", en: "Delete now? (This can't be undone)" },
  今すぐ消す: { zh: "立即删除", en: "Delete now" },

  // ── 写真1枚（PhotoSheet）──
  写真に入っていた撮った日: { zh: "照片里记录的拍摄日期", en: "date stored in the photo" },
  ファイルの日付: { zh: "文件的日期", en: "file date" },
  "残した日（撮った日が分からなかった）": { zh: "保存的日期（不知道拍摄日期）", en: "date it was kept (the date taken was unknown)" },
  家族が直した日: { zh: "家人修改过的日期", en: "date corrected by your family" },
  分からない: { zh: "不知道", en: "unknown" },
  写真: { zh: "照片", en: "Photo" },
  "AI で作った家族と写真です": { zh: "这是用 AI 生成的家庭和照片", en: "This family and photo were made with AI" },
  "手帳: {titles}": { zh: "手册：{titles}", en: "Handbook: {titles}" },
  "（ほかに{n}人）": { zh: "（还有{n}人）", en: " (+{n} {n:other|others})" },
  "一冊・動画に入れない": { zh: "不放进成长书和视频", en: "Not in the book or video" },
  "一冊・動画に入れる": { zh: "放进成长书和视频", en: "In the book and video" },
  一言: { zh: "一句话", en: "Caption" },
  "例: はじめてのお散歩": { zh: "例：第一次散步", en: "e.g. First walk outside" },
  "撮った日（{from}）": { zh: "拍摄日期（{from}）", en: "Date taken ({from})" },
  直す: { zh: "修改", en: "Change" },
  この日の手帳の記録に結ぶ: { zh: "关联到这一天的手册记录", en: "Link to this day's handbook records" },
  元の写真を保存: { zh: "保存原图", en: "Save the original photo" },
  "この写真をゴミ箱に入れますか？（30日たつと消えます。それまではゴミ箱から戻せます）": {
    zh: "要把这张照片放进回收站吗？（30天后会被删除。在那之前可以从回收站恢复）",
    en: "Move this photo to the trash? (It's deleted after 30 days. Until then, you can restore it from the trash.)",
  },
  ゴミ箱へ: { zh: "放进回收站", en: "Move to trash" },
  "Claude には見せていません": { zh: "没有给 Claude 看过", en: "Not shown to Claude" },

  // ── 声1本（VoiceItem）──
  "声を読めませんでした（{status}）": { zh: "无法读取声音（{status}）", en: "Couldn't load the voice ({status})" },
  再生できませんでした: { zh: "无法播放", en: "Couldn't play it" },
  止める: { zh: "停止", en: "Stop" },
  聞く: { zh: "听", en: "Play" },
  みんなの章: { zh: "大家的篇章", en: "Everyone's chapter" },
  "{n}秒": { zh: "{n}秒", en: "{n}s" },
  "例: 毎晩のおやすみ": { zh: "例：每晚的晚安", en: "e.g. Good night, every night" },
  "★ を外す": { zh: "取消 ★", en: "Remove ★" },
  "☆ 一冊に入れたい": { zh: "☆ 想放进成长书", en: "☆ I'd like it in the book" },
  "一冊・映画に戻す": { zh: "放回成长书和电影", en: "Put back in the book and movie" },
  "一冊・映画に入れない": { zh: "不放进成长书和电影", en: "Leave out of the book and movie" },

  // ── 残す（KeepButtons・KeepSheet）──
  残す: { zh: "留存", en: "Keep" },
  "🌸 残す": { zh: "🌸 留存", en: "🌸 Keep" },
  "🌸 残す（準備中）": { zh: "🌸 留存（准备中）", en: "🌸 Keep (coming soon)" },
  "写真は家族のアカウントで守って残します。この手帳では、まだ使えません": {
    zh: "照片会在家庭账号下受到保护并保存。这本手册还不能使用。",
    en: "Photos are kept safe under your family's account. Not available in this handbook yet",
  },
  "写真を手帳に残します。この家族の置き場（鍵つき）だけに置き、Claude には見せません": {
    zh: "把照片留存在手册里。只放在这个家庭的存储空间（已加密），不给 Claude 看",
    en: "Keep photos in the handbook. They stay only in this family's storage (encrypted) and aren't shown to Claude",
  },
  いま撮る: { zh: "现在拍", en: "Take a photo" },
  写真から選ぶ: { zh: "从照片中选", en: "Choose from photos" },
  写真を残す: { zh: "留存照片", en: "Keep photos" },
  "{total}枚中 {done}枚": { zh: "{total}张中的 {done}张", en: "{done} of {total}" },
  "置き場に入れています…": { zh: "正在放进存储空间…", en: "Saving to your storage…" },
  "Claude には見せていません。写真はこの家族の置き場にだけ置き、鍵をかけてあります。": {
    zh: "没有给 Claude 看过。照片只放在这个家庭的存储空间里，并且已加密。",
    en: "Not shown to Claude. Photos are kept only in this family's storage, encrypted.",
  },
  アルバムで見る: { zh: "在相册里看", en: "View in the album" },
  "置いています…": { zh: "正在保存…", en: "Saving…" },
  もう一度送る: { zh: "重新发送", en: "Send again" },
  待っています: { zh: "等待中", en: "Waiting" },
  "もう残してありました。": { zh: "之前已经留存过了。", en: "Already kept. " },
  "残しました。": { zh: "已留存。", en: "Kept. " },
  "一言（任意）": { zh: "一句话（可不填）", en: "Caption (optional)" },

  // ── みんなの章・未来の手紙（Minna）──
  "み ん な の 章": { zh: "大 家 的 篇 章", en: "Everyone's chapter" },
  "家族や周りの人に、{child}へのひと言を頼めます。招いた人が足した写真・声・手紙が、ここに並びます。": {
    zh: "可以请家人和身边的人给{child}留一句话。受邀的人添加的照片、声音和信，会排在这里。",
    en: "You can ask family and people close to you for a few words to {child}. The photos, voices and letters they add will appear here.",
  },
  "家族に頼む（招く）": { zh: "请家人留言（邀请）", en: "Ask family (invite)" },
  "{child}を待っていた人たち": { zh: "等待{child}到来的人们", en: "The people who were waiting for {child}" },
  あなた: { zh: "你", en: "you" },
  "ほかの家族にも頼む ›": { zh: "也请其他家人留言 ›", en: "Ask other family members too ›" },
  "手紙を読めませんでした（{status}）": { zh: "无法读取信（{status}）", en: "Couldn't load the letters ({status})" },
  "✉ 手紙を書く": { zh: "✉ 写信", en: "✉ Write a letter" },
  未来へ手紙: { zh: "写给未来的信", en: "A letter to the future" },
  "未 来 へ 手 紙": { zh: "写 给 未 来 的 信", en: "A letter to the future" },
  "伝えたい事がある時だけ、手紙にして残せます。封をせず、いつでも読める形にもできます。": {
    zh: "只在有想说的话时，写成信留下就好。也可以不封存，随时都能读。",
    en: "Only when there's something you want to say, you can keep it as a letter. You can also leave it unsealed so it can be read anytime.",
  },
  "開く日を決めて封をする手紙です。例: {child}の1歳の誕生日に開く。開く日までは、書いた人も読めません。": {
    zh: "这是定好开启日期再封存的信。例如：在{child}1岁生日那天打开。开启日之前，写信的人自己也不能读。",
    en: "A letter you seal until a day you choose. For example: open it on {child}'s first birthday. Until that day, not even the writer can read it.",
  },
  未来の手紙: { zh: "未来的信", en: "Letters to the future" },
  "未 来 の 手 紙": { zh: "未 来 的 信", en: "Letters to the future" },
  "封をした手紙 {n} 通": { zh: "已封存的信 {n} 封", en: "Sealed letters: {n}" },
  "開いた手紙 {n} 通": { zh: "已打开的信 {n} 封", en: "Opened letters: {n}" },
  "封をした手紙は、書いた人も開く日まで読めません。手紙の中身は AI（Claude）に渡していません。": {
    zh: "已封存的信，写信的人在开启日之前也不能读。信的内容没有交给 AI（Claude）。",
    en: "Not even the writer can read a sealed letter before its day. The letters' contents are never given to the AI (Claude).",
  },
  読めませんでした: { zh: "无法读取", en: "Couldn't open it" },
  声を開けませんでした: { zh: "无法打开声音", en: "Couldn't open the voice" },
  消せませんでした: { zh: "无法删除", en: "Couldn't delete it" },
  "{from}から {to}へ": { zh: "{from} 写给 {to}", en: "From {from} to {to}" },
  "{date}に開きました": { zh: "{date}打开了", en: "Opened on {date}" },
  "{date}に書いた": { zh: "{date}写的", en: "written on {date}" },
  "🎙 声つき": { zh: "🎙 附有声音", en: "🎙 with voice" },
  読む: { zh: "读", en: "Read" },
  "この手紙を消しますか？（戻せません）": { zh: "要删除这封信吗？（无法恢复）", en: "Delete this letter? (This can't be undone)" },
  消す: { zh: "删除", en: "Delete" },
  やめる: { zh: "取消", en: "Cancel" },

  // ── 手紙を書く（LetterKeeper）──
  "開く日を決めて封をします。{child}が大きくなった日に、一冊の中で開きます。": {
    zh: "定好开启的日期再封存。等{child}长大的那一天，在成长书里打开。",
    en: "Choose the day it opens, then seal it. On a day when {child} has grown up, it opens inside the book.",
  },
  子ども: { zh: "孩子", en: "your child" },
  手紙を書く: { zh: "写信", en: "Write a letter" },
  封をしました: { zh: "已封存", en: "Sealed" },
  "{to}へ、声を添えて。{opens}。それまでは、書いたあなたも読めず、声も聞けません。": {
    zh: "给{to}，附上了声音。{opens}。在那之前，写信的你自己也不能读，也听不到声音。",
    en: "To {to}, with your voice. {opens}. Until then, not even you, the writer, can read it or hear the voice.",
  },
  "{to}へ。{opens}。それまでは、書いたあなたも読めません。": {
    zh: "给{to}。{opens}。在那之前，写信的你自己也不能读。",
    en: "To {to}. {opens}. Until then, not even you, the writer, can read it.",
  },
  "{to}へ、声を添えて。いつでも読めます。": { zh: "给{to}，附上了声音。随时都能读。", en: "To {to}, with your voice. It can be read anytime." },
  "{to}へ。いつでも読めます。": { zh: "给{to}。随时都能读。", en: "To {to}. It can be read anytime." },
  "一冊の「未来の手紙」に並びます。消したい時は、そこから消せます。": {
    zh: "会排在成长书的“未来的信”里。想删除时，可以在那里删除。",
    en: "It will appear under “Letters to the future” in the book. You can delete it there if you want.",
  },
  一冊で見る: { zh: "在成长书里看", en: "View in the book" },
  誰へ: { zh: "写给谁", en: "To" },
  いつ開くか: { zh: "什么时候打开", en: "When it opens" },
  開く日: { zh: "开启日期", en: "Opening date" },
  "封をせず、いつでも読める手紙にします": { zh: "不封存，作为随时都能读的信", en: "It won't be sealed, so it can be read anytime" },
  手紙: { zh: "信", en: "Letter" },
  "{to}へ。": { zh: "致{to}：", en: "Dear {to}," },
  "封をしています…": { zh: "正在封存…", en: "Sealing…" },
  封をする: { zh: "封存", en: "Seal" },
  "封をすると、開く日まで書いたあなたも読めず、声も聞けません。": {
    zh: "封存后，开启日之前写信的你自己也不能读，也听不到声音。",
    en: "Once sealed, not even you, the writer, can read it or hear the voice until its day.",
  },
  "封をすると、開く日まで書いたあなたも読めません。": { zh: "封存后，开启日之前写信的你自己也不能读。", en: "Once sealed, not even you, the writer, can read it until its day." },
  "手紙と声は家族の鍵で守って、この手帳の中だけに残します。AI（Claude）には送りません。": {
    zh: "信和声音会用家庭的密钥保护，只保存在这本手册里。不会发给 AI（Claude）。",
    en: "The letter and voice are protected with your family's key and kept only in this handbook. They're never sent to the AI (Claude).",
  },
  "手紙は家族の鍵で守って、この手帳の中だけに残します。AI（Claude）には送りません。": {
    zh: "信会用家庭的密钥保护，只保存在这本手册里。不会发给 AI（Claude）。",
    en: "The letter is protected with your family's key and kept only in this handbook. It's never sent to the AI (Claude).",
  },
  "書いた手紙を見る ›": { zh: "查看写好的信 ›", en: "See your letters ›" },
  "🎙 声を添えます（{time}）": { zh: "🎙 附上声音（{time}）", en: "🎙 Voice attached ({time})" },
  録り直す: { zh: "重新录", en: "Record again" },
  声を外す: { zh: "去掉声音", en: "Remove the voice" },
  "🎙 声も添える": { zh: "🎙 也附上声音", en: "🎙 Add your voice too" },
  "🎙 録る": { zh: "🎙 录音", en: "🎙 Record" },
  "{now} / {max}・押すと止めます": { zh: "{now} / {max} · 点一下停止", en: "{now} / {max} · Tap to stop" },
  "押して話し、もう一度押して止めます（{n}分まで）": {
    zh: "点一下开始说，再点一下停止（最长{n}分钟）",
    en: "Tap to start talking, tap again to stop (up to {n} {n:minute|minutes})",
  },

  // ── 声を残す（VoiceKeeper）──
  声を残す: { zh: "留下声音", en: "Keep a voice" },
  "残したい時だけ、声のまま残せます。消さずにしまうこともできます。": {
    zh: "只在想留的时候，把声音原样留下就好。也可以不删除，先收起来。",
    en: "Only when you want to, you can keep a voice just as it is. You can also put it away without deleting it.",
  },
  "声のまま残します。聞き返す手がかりに、手帳の中で文字にして添えます（声は AI に送りません）。大きくなった子どもが、一冊の本の中で聞けます": {
    zh: "把声音原样留下。为了方便回听，手册会在内部把它转成文字附上（声音不会发给 AI）。孩子长大后，可以在成长书里听到",
    en: "Keeps the voice just as it is. To help you find it again, the handbook adds a text version, made inside the handbook itself (the voice is never sent to the AI). When your child grows up, they can listen to it inside the book",
  },
  "残せませんでした（{status}）": { zh: "无法保存（{status}）", en: "Couldn't keep it ({status})" },
  "おなかの{child}に、今日の事を話してみてください": { zh: "对肚子里的{child}，说说今天的事吧", en: "Try telling {child} in your belly about today" },
  "{child}に、今日のおやすみを": { zh: "对{child}说一声今天的晚安", en: "Say today's good night to {child}" },
  "{child}の名前を、呼んでみてください": { zh: "试着呼唤{child}的名字吧", en: "Try calling {child}'s name" },
  "残しました（{n}秒）。アルバムの{m}月に並びます。": { zh: "已留存（{n}秒）。会排在相册的{m}月里。", en: "Kept ({n}s). You'll find it in the album under {m}." },
  アルバムで聞く: { zh: "在相册里听", en: "Listen in the album" },
  もう1つ: { zh: "再录一段", en: "Record another" },
  "残しています…": { zh: "正在留存…", en: "Keeping…" },
  録る: { zh: "录音", en: "Record" },
  "{n}秒・押すと止めて残します": { zh: "{n}秒 · 点一下停止并留存", en: "{n}s · Tap to stop and keep" },
  "押して話し始め、もう一度押して止めます": { zh: "点一下开始说，再点一下停止", en: "Tap to start talking, tap again to stop" },
  "声は家族の鍵で守って、この手帳の中だけに残します。声そのものは AI（Claude）に送りません。文字にするのも手帳の中です。一冊を作る時だけ、題と最初の一文の文字を Claude に渡します。消したい時はアルバムから消せます。": {
    zh: "声音会用家庭的密钥保护，只保存在这本手册里。声音本身不会发给 AI（Claude）。转成文字也在手册内部完成。只有在制作成长书时，才把标题和第一句话的文字交给 Claude。想删除时，可以在相册里删除。",
    en: "Voices are protected with your family's key and kept only in this handbook. The voice itself is never sent to the AI (Claude). Turning it into text also happens inside the handbook. Only when making the book does Claude get the text of its title and first sentence. You can delete voices from the album.",
  },
  "残した声を聞く ›": { zh: "听留下的声音 ›", en: "Listen to kept voices ›" },

  // ── 家族のありがとう（ThanksChapter）──
  家族のありがとう: { zh: "家人之间的感谢", en: "Family thank-yous" },
  "手帳の中で、家族が交わしたありがとうです。": { zh: "这是家人在手册里互相表达的感谢。", en: "Thank-yous your family shared in the handbook." },
  "🌷 {from}から {to}へ": { zh: "🌷 {from} 感谢 {to}", en: "🌷 From {from} to {to}" },
  "「{title}」に": { zh: "为“{title}”", en: "for “{title}”" },

  // ── 写真と声の読み書き（useMedia）──
  "写真を読めませんでした（{status}）": { zh: "无法读取照片（{status}）", en: "Couldn't load photos ({status})" },
  写真を読めませんでした: { zh: "无法读取照片", en: "Couldn't load photos" },
  "直せませんでした（{status}）": { zh: "无法修改（{status}）", en: "Couldn't save the change ({status})" },
  "消せませんでした（{status}）": { zh: "无法删除（{status}）", en: "Couldn't delete it ({status})" },
} satisfies Entries;
