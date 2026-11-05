// 辞書: 話す・撮る（components/capture/・app/capture/）。書き方は lib/i18n/index.ts の頭
// - タブの名前は shell.ts にそろえる（話す・撮る・打つ → 说·拍·写／Talk · Snap · Type。手帳 → 手册／Handbook）。
//   「候補」は家族の OK を待つ手帳の行（answers.ts と同じく 候选／candidate）。「残す」は album.ts（留存／Keep）。
// - 共通の短い言葉は、ほかの辞書の物を使う: 閉じる・赤ちゃん・（{x}）・うまくいきませんでした（{status}）は core.ts、
//   やめる・直す・残す・🌸 残す・入れています…・{n}秒 は album.ts、ママ・記録・「{text}」・産後ケア・相談できる人 は today.ts、
//   いる・いない は start.ts、書いた は draft.ts、健診 は answers.ts、話しています・マイクと短すぎの断りは ask.ts
// - 急ぎの1文（urgent-note.ts）は言い換えずに訳す（119 と #8000 の言い方は answers.ts にそろえる）
import type { Entries } from "..";

export default {
  // ── 手帳の欄の名前（TechoCandidates の LABELS・TypeSheet の札。lib/techo-fields.ts と同じ言葉。手帳のタブもこの鍵を使える）──
  週数: { zh: "孕周", en: "Weeks pregnant" },
  体重: { zh: "体重", en: "Weight" },
  身長: { zh: "身高", en: "Height" },
  頭囲: { zh: "头围", en: "Head circumference" },
  胸囲: { zh: "胸围", en: "Chest circumference" },
  "血圧（上）": { zh: "血压（高压）", en: "Blood pressure (upper)" },
  "血圧（下）": { zh: "血压（低压）", en: "Blood pressure (lower)" },
  子宮底長: { zh: "宫高", en: "Fundal height" },
  むくみ: { zh: "浮肿", en: "Swelling" },
  尿たんぱく: { zh: "尿蛋白", en: "Urine protein" },
  尿糖: { zh: "尿糖", en: "Urine sugar" },
  産後: { zh: "产后", en: "After birth" },
  生まれて: { zh: "出生后", en: "Age" },
  便色カード: { zh: "大便颜色卡", en: "Stool color card" },
  時期: { zh: "时期", en: "When" },
  できた事: { zh: "会做的事", en: "Milestone" },
  検査: { zh: "检查", en: "Test" },
  結果: { zh: "结果", en: "Result" },
  ワクチン: { zh: "疫苗", en: "Vaccine" },
  回: { zh: "剂次", en: "Dose" },
  "ロット（シールの番号）": { zh: "批号（贴纸上的号码）", en: "Lot (the number on the sticker)" },
  医療機関: { zh: "医疗机构", en: "Clinic or hospital" },
  医師: { zh: "医生", en: "Doctor" },
  言葉: { zh: "话", en: "Words" },
  いつ: { zh: "什么时候", en: "When" },
  相談した相手: { zh: "咨询的对象", en: "Who you talked to" },
  お産の方法: { zh: "分娩方式", en: "Type of delivery" },
  場所: { zh: "地点", en: "Place" },
  栄養: { zh: "喂养", en: "Feeding" },
  ビタミンK2: { zh: "维生素K2", en: "Vitamin K2" },
  メモ: { zh: "备忘", en: "Note" },
  かかった病気: { zh: "得过的病", en: "Past illnesses" },
  アレルギー: { zh: "过敏", en: "Allergies" },
  薬: { zh: "药", en: "Medicine" },
  前のお産: { zh: "以前的分娩", en: "Previous births" },
  たばこ: { zh: "吸烟", en: "Smoking" },
  体温: { zh: "体温", en: "Temperature" },
  健診の日: { zh: "检查日期", en: "Checkup date" },
  測った日: { zh: "测量日期", en: "Date measured" },
  日付: { zh: "日期", en: "Date" },
  その日: { zh: "日期", en: "Date" },
  "例: 24週": { zh: "例：24周", en: "e.g. 24 weeks" },
  /** 欄の名前と値（「体重: 3.2kg」） */
  "{label}: {value}": { zh: "{label}：{value}", en: "{label}: {value}" },
  "{label}: {n}日": { zh: "{label}：{n}天", en: "{label}: {n} {n:day|days}" },
  "{label}: {n}番": { zh: "{label}：{n}号", en: "{label}: No. {n}" },
  "{label}: {n}番（{name}）": { zh: "{label}：{n}号（{name}）", en: "{label}: No. {n} ({name})" },
  /** 直す欄の札に添える単位（「産後（日）」） */
  "（日）": { zh: "（天）", en: " (days)" },
  "（番）": { zh: "（号）", en: " (No.)" },

  // ── 記録の種類（lib/capture.ts の RECORD_KINDS・lib/manual-entry.ts の MANUAL_KINDS。値は日本語のまま持ち、札に描く時に訳す）──
  気がかり: { zh: "担心的事", en: "Concern" },
  できごと: { zh: "发生的事", en: "Event" },
  予定: { zh: "日程", en: "Plan" },
  書類: { zh: "文件", en: "Document" },
  期限: { zh: "期限", en: "Deadline" },

  // ── 話す・撮る・打つの画面（CaptureScreen）──
  "話す・撮る": { zh: "说·拍·写", en: "Talk · Snap · Type" },
  "話す・撮る・打つ。楽な方で、手帳に入ります": {
    zh: "说·拍·写，哪种方便就用哪种，都会记进手册",
    en: "Talk · Snap · Type: use whichever is easiest, and it goes into the handbook",
  },
  "言われた事は話す、紙は撮る、体重や体温は打つ。どれで入れても同じ手帳になります": {
    zh: "听到的话就说，纸张就拍，体重和体温就写。不管用哪种方式，都会记进同一本手册",
    en: "Say what you were told, snap the papers, type in weight or temperature. Whichever way you use, it all goes into the same handbook",
  },
  "OK 待ち {n}件": { zh: "{n}条等你点 OK", en: "{n} waiting for your OK" },
  "手帳で見る ›": { zh: "在手册里看 ›", en: "See in Handbook ›" },
  "「話す」を押したまま話すと、手帳の候補になります": {
    zh: "按住“说”说话，就会成为手册的候选",
    en: "Hold “Talk” and speak, and it becomes a candidate for the handbook",
  },
  "下の「撮る」で手帳のページを撮って、「読み取る」→「紙の母子手帳のページ」を選んでください": {
    zh: "请用下面的“拍”拍下手册的页面，然后选择“读取”→“纸质母子健康手册的页面”",
    en: "Use “Snap” below to photograph the handbook page, then choose “Read” → “A page of the paper Maternal and Child Health Handbook”",
  },
  /** 話す・撮る・打つの3つのボタンを包む所（読み上げの札）。手帳のタブの送るボタン（成長・接種・できた日・欄）も同じ鍵 */
  入れる: { zh: "记入", en: "Add" },
  話す: { zh: "说", en: "Talk" },
  撮る: { zh: "拍", en: "Snap" },
  紙も写真も: { zh: "纸张和照片都行", en: "Papers or photos" },
  打つ: { zh: "写", en: "Type" },
  "数字・ひとこと": { zh: "数字、一句话", en: "Numbers, a quick note" },
  "撮った後に選べます: 「読み取る」＝文字を手帳に書き写す／「残す」＝写真のまま取っておく。体験版は AI（Claude）を呼ばないので、読み取る時も写真をどこへも送りません（見本の返事が出ます）": {
    zh: "拍完后可以选择：“读取”＝把文字抄进手册／“留存”＝按照片原样保存。体验版不调用 AI（Claude），所以读取时照片也不会发送到任何地方（会显示示例回复）",
    en: "After you take a photo, you can choose: “Read” = copy the text into the handbook / “Keep” = save it as a photo. The trial doesn't call the AI (Claude), so even when reading, the photo isn't sent anywhere (you'll see a sample reply)",
  },
  "撮った後に選べます: 「読み取る」＝文字を手帳に書き写す／「残す」＝写真のまま取っておく。読み取る時だけ、写真を米国の AI（Claude）に送ります（その写真は手帳に残しません）": {
    zh: "拍完后可以选择：“读取”＝把文字抄进手册／“留存”＝按照片原样保存。只有读取时，才会把照片发送给美国的 AI（Claude）（那张照片不会留在手册里）",
    en: "After you take a photo, you can choose: “Read” = copy the text into the handbook / “Keep” = save it as a photo. Only when reading is the photo sent to the AI (Claude) in the US (that photo isn't kept in the handbook)",
  },
  // 待つ間の表示（後ろに「…」と秒を付ける）
  聞き取っています: { zh: "正在识别语音", en: "Listening" },
  紙を読んでいます: { zh: "正在读取纸上的内容", en: "Reading the paper" },
  手帳のページを読んでいます: { zh: "正在读取手册的页面", en: "Reading the handbook page" },
  手帳に書いています: { zh: "正在写进手册", en: "Writing it into the handbook" },
  "同意できました。手帳に書いています": { zh: "已同意。正在写进手册", en: "Consent done. Writing it into the handbook" },
  書き直しています: { zh: "正在重写", en: "Rewriting" },
  // 失敗の知らせ（何が起きたか／書いた事は無事か）
  記録を読み込めませんでした: { zh: "无法读取记录", en: "Couldn't load the records" },
  "手帳の記録は消えていません。電波のある所で開き直してください": {
    zh: "手册里的记录没有丢失。请到有信号的地方重新打开",
    en: "Your handbook records haven't been lost. Please reopen this where you have signal",
  },
  まだ送れていません: { zh: "还没有发送出去", en: "Not sent yet" },
  "聞き取った言葉は、下の書く欄に残っています。そのまま送り直せます": {
    zh: "识别出的话还留在下面的输入栏里，可以直接重新发送",
    en: "The words we caught are still in the writing box below. You can send them again as they are",
  },
  "録音は残っていません。もう一度話してください": { zh: "录音没有保留下来。请再说一次", en: "The recording wasn't kept. Please talk again" },
  まだ読めていません: { zh: "还没有读取", en: "Not read yet" },
  "写真はこの画面に残っていません。もう一度撮ってください": {
    zh: "照片没有留在这个页面上。请再拍一次",
    en: "The photo isn't kept on this screen. Please take it again",
  },
  "書いた事は、この画面の下の欄に残っています。そのまま送り直せます": {
    zh: "你写的内容还留在这个页面下方的栏里，可以直接重新发送",
    en: "What you wrote is still in the box at the bottom of this screen. You can send it again as it is",
  },
  "答えは欄に残っています。そのまま送り直せます": {
    zh: "回答还留在栏里，可以直接重新发送",
    en: "Your answer is still in the box. You can send it again as it is",
  },
  まだ手帳に届いていません: { zh: "还没有送到手册", en: "It hasn't reached the handbook yet" },
  記録はそのままです: { zh: "记录保持不变", en: "Your records are unchanged" },
  デモの記録を入れられませんでした: { zh: "无法放入演示记录", en: "Couldn't add the demo records" },
  // 同意がまだで送らなかった時の青い案内（何を送ろうとしていたかで言い分ける）
  "話した事を手帳の欄に分けるには、もう1つ同意が要ります（米国の Claude に送るのは文字だけです）。録音はまだ送っていません。同意の後に、もう一度話してください。": {
    zh: "要把说的内容分到手册的各栏里，还需要一项同意（发送给美国的 Claude 的只有文字）。录音还没有发送。同意后，请再说一次。",
    en: "To sort what you said into the handbook's sections, one more consent is needed (only the text is sent to Claude in the US). The recording hasn't been sent yet. After you agree, please talk again.",
  },
  "撮った紙を手帳の欄に分けるには、もう1つ同意が要ります（米国の Claude に送るのは、「読み取る」を選んだ1枚だけです）。写真はまだ送っていません。同意の後に、もう一度撮ってください。": {
    zh: "要把拍的纸分到手册的各栏里，还需要一项同意（发送给美国的 Claude 的，只有你选了“读取”的那一张）。照片还没有发送。同意后，请再拍一次。",
    en: "To sort the paper you photographed into the handbook's sections, one more consent is needed (only the one photo you chose to “Read” is sent to Claude in the US). The photo hasn't been sent yet. After you agree, please take it again.",
  },
  "答えを手帳の欄に分けるには、もう1つ同意が要ります（米国の Claude に送るのは文字だけです）。答えは欄に残っています。": {
    zh: "要把回答分到手册的各栏里，还需要一项同意（发送给美国的 Claude 的只有文字）。回答还留在栏里。",
    en: "To sort your answer into the handbook's sections, one more consent is needed (only the text is sent to Claude in the US). Your answer is still in the box.",
  },
  "この文を手帳の欄に分けるには、もう1つ同意が要ります（米国の Claude に送るのは文字だけです）。": {
    zh: "要把这段文字分到手册的各栏里，还需要一项同意（发送给美国的 Claude 的只有文字）。",
    en: "To sort this text into the handbook's sections, one more consent is needed (only the text is sent to Claude in the US).",
  },
  // いま書いた事・聞き返し・書いて入れる
  いま書いた事: { zh: "刚刚记下的内容", en: "What you just added" },
  聞き取った言葉: { zh: "识别出的话", en: "What we heard" },
  まだ答えていない問い: { zh: "还没回答的问题", en: "Question not answered yet" },
  "前に入れた事について、1つだけ聞かせてください": { zh: "关于之前记下的内容，想问你一个问题", en: "One quick question about something you added earlier" },
  答える: { zh: "回答", en: "Answer" },
  "答えない（記録はこのまま）": { zh: "不回答（记录保持不变）", en: "Don't answer (records stay as they are)" },
  記録と予定: { zh: "记录和日程", en: "Records and plans" },
  書いて入れる: { zh: "写下来记录", en: "Write it in" },
  "例: 来週の火曜に保育園の見学": { zh: "例：下周二参观保育园", en: "e.g. Visiting a daycare next Tuesday" },
  手帳に書く: { zh: "写进手册", en: "Write to the handbook" },
  "長めに書いて、手帳に分けてもらう": { zh: "写长一点，让手册帮你分类", en: "Write something longer and have it sorted into the handbook" },
  デモの記録を入れる: { zh: "放入演示记录", en: "Add demo records" },

  // ── 押して話す（HoldToTalk）・声を録る道具（useRecorder）──
  "この機械では録音が使えません。下の欄に書いてください": { zh: "这台设备不能录音。请在下面的栏里写", en: "This device can't record. Please write in the box below" },
  "押している間だけ録音します。もう一度、押したまま話してください": {
    zh: "只在按住时录音。请再按住一次说话",
    en: "It only records while you hold the button. Please hold it again while you talk",
  },
  マイク準備中: { zh: "正在准备麦克风", en: "Getting the mic ready" },
  "{n}秒・指を離すと送ります": { zh: "{n}秒 · 松开手指就发送", en: "{n}s · Let go to send" },
  押している間: { zh: "按住时录音", en: "Hold to record" },
  この機械では録音が使えません: { zh: "这台设备不能录音", en: "This device can't record" },
  "短すぎました。もう一度どうぞ": { zh: "太短了。请再试一次", en: "That was too short. Please try again" },

  // ── 撮った写真の使い道（PhotoChoice）──
  写真の使い道: { zh: "照片的用途", en: "What to do with the photo" },
  "撮った写真 {n}": { zh: "拍的照片 {n}", en: "Photo {n}" },
  "ほか{n}枚": { zh: "另外{n}张", en: "+{n} more" },
  "この写真を、どうしますか": { zh: "这张照片要怎么处理？", en: "What would you like to do with this photo?" },
  読み取る: { zh: "读取", en: "Read" },
  "紙の中身を手帳に写します。写真は読み取りのために Claude に送り、残しません": {
    zh: "把纸上的内容抄进手册。照片会为了读取发送给 Claude，不会保存",
    en: "Copies what's on the paper into the handbook. The photo is sent to Claude to be read, and isn't kept",
  },
  "届いた紙・健診の紙": { zh: "收到的通知、检查的单子", en: "A letter you received, or a checkup sheet" },
  紙の母子手帳のページ: { zh: "纸质母子健康手册的页面", en: "A page of the paper Maternal and Child Health Handbook" },
  "読み取りは1枚ずつです。1枚だけ選び直してください": {
    zh: "一次只能读取一张。请重新只选一张",
    en: "Reading works one photo at a time. Please choose just one again",
  },
  "思い出の写真として手帳に残します。この家族の置き場（鍵つき）だけに置き、Claude には見せません": {
    zh: "作为回忆的照片留存在手册里。只放在这个家庭的存储空间（已加密），不给 Claude 看",
    en: "Keep it in the handbook as a memory photo. It stays only in this family's storage (encrypted) and isn't shown to Claude",
  },
  "{n}枚を残す": { zh: "留存{n}张", en: "Keep {n} {n:photo|photos}" },
  "やめる（どこにも送りません）": { zh: "取消（不发送到任何地方）", en: "Cancel (nothing is sent)" },

  // ── 写真の下ごしらえと残す（media.ts。思い出の KeepSheet も使う）──
  "写真が読めませんでした（HEIC の時は設定で「互換性優先」に）": {
    zh: "无法读取照片（如果是 HEIC 格式，请在设置的相机格式里选择“兼容性最佳”）",
    en: "Couldn't read the photo (for HEIC photos, set the camera format to “Most Compatible” in Settings)",
  },
  写真を縮められませんでした: { zh: "无法缩小照片", en: "Couldn't shrink the photo" },
  写真が読めませんでした: { zh: "无法读取照片", en: "Couldn't read the photo" },
  "送れませんでした。電波を確かめて、もう一度": { zh: "没能发送。请检查信号后再试一次", en: "Couldn't send. Please check your signal and try again" },
  "送れませんでした（{status}）。もう一度": { zh: "没能发送（{status}）。请再试一次", en: "Couldn't send ({status}). Please try again" },

  // ── 手帳に入れる候補（TechoCandidates・DateCheck）──
  手帳に入れる候補: { zh: "要记进手册的候选", en: "Candidates for the handbook" },
  "{n}件ともOK": { zh: "{n}条全部 OK", en: "OK all {n}" },
  "合っていれば OK。読み違いは「直す」でその場で直せます。OK は後で手帳の上からもできます。OK した後も手帳から消せます": {
    zh: "没问题就点 OK。读错的地方可以用“修改”当场改。OK 也可以之后在手册的上方点。点了 OK 之后也能从手册里删掉",
    en: "If it's right, tap OK. If something was misread, fix it right here with “Change”. You can also OK it later at the top of the Handbook. Even after OK, you can remove it from the handbook",
  },
  "{n}件を手帳に入れました": { zh: "已将{n}条记进手册", en: "Added {n} to the handbook" },
  手帳に届きませんでした: { zh: "没有送到手册", en: "Didn't reach the handbook" },
  "候補はそのまま残っています。もう一度押してください。": { zh: "候选还原样保留着。请再点一次。", en: "The candidates are still here. Please tap again." },
  "撮った・話した事は、すぐには手帳に入れず候補にします。家族が OK した物だけが記録になります（紙の手帳が正本のまま）。": {
    zh: "拍的、说的内容不会马上记进手册，而是先作为候选。只有家人点了 OK 的才会成为记录（纸质手册仍然是正本）。",
    en: "What you snap or say doesn't go straight into the handbook; it becomes a candidate first. Only what your family OKs becomes a record (the paper handbook stays the official copy).",
  },
  "読めなかった・言っていない数字は空のままにしています。手帳のページで足してください。": {
    zh: "没读出来的、没说到的数字会留空。请在手册的页面上补上。",
    en: "Numbers we couldn't read, or that you didn't mention, are left blank. Please add them on the handbook page.",
  },
  "OK した後も、手帳の記録の「消す」で消せます。": {
    zh: "点了 OK 之后，也可以用手册记录上的“删除”删掉。",
    en: "Even after you OK it, you can remove it with “Delete” on the handbook record.",
  },
  "紙に日付が無い時は、今日の日付にせず、ページの題（1か月児健診など）と生まれた日から推した日を出します。違う時は直してから OK してください。": {
    zh: "纸上没有日期时，不会用今天的日期，而是根据页面的标题（如满月儿健康检查）和出生日期推算出日期。不对的话，请修改后再点 OK。",
    en: "When there's no date on the paper, we don't use today's date; we estimate it from the page title (such as the one-month checkup) and the birth date. If it's wrong, fix it and then tap OK.",
  },
  // 成長・できた日の候補に添える注意書き（lib/techo.ts の GROWTH_NOTE・DEVELOPMENT_NOTE。手帳のタブの GrowthChart・DevelopmentList も同じ鍵）
  "帯は国の調査の目安です。帯の外でも、気になる事は健診で聞いてください（母子健康手帳の考え方）。": {
    zh: "带状区域是国家调查得出的参考范围。即使在带状区域之外，有担心的事也请在健康检查时问（这是母子健康手册的思路）。",
    en: "The band is a guide from a national survey. Even outside the band, ask at a checkup about anything that worries you (this follows the Maternal and Child Health Handbook).",
  },
  "できた時期は子どもによって違います。目安より早くても遅くても、その子のペースです。気になる事は健診で聞いてください（母子健康手帳の考え方）。": {
    zh: "会做的时间因孩子而异。比参考时间早也好、晚也好，都是这个孩子自己的节奏。有担心的事，请在健康检查时问（这是母子健康手册的思路）。",
    en: "Every child reaches these at a different time. Earlier or later than the guide, it's your child's own pace. Ask at a checkup about anything that worries you (this follows the Maternal and Child Health Handbook).",
  },
  /**
   * 便色カードの候補に添える一言（{note} は手帳の原文・{aside} は「迷う時は #8000。」。どちらも answers.ts の訳で引く）。
   * 中文・English の {note} は、訳の中で2つの枠を “ ” で引いているので、外を “ ” で包まない（引用が二重になる）。
   * 手帳の文でない {aside} は先に置き、手帳の文は「…に書いてある」の後に続けて、どこからが手帳の言葉かを分ける
   */
  "母子手帳の便色カード「{note}」{aside}": {
    zh: "{aside}母子健康手册的大便颜色卡上写着：{note}",
    en: "{aside} The stool color card in the Maternal and Child Health Handbook says: {note}",
  },
  直してOK: { zh: "改好后 OK", en: "OK with changes" },
  直さない: { zh: "不修改", en: "Don't change" },
  違う: { zh: "不对", en: "Not right" },
  "紙に日付が無かったので、ページの題と生まれた日から推しました。この日で合っていますか？": {
    zh: "纸上没有日期，所以根据页面的标题和出生日期推算了日期。这个日期对吗？",
    en: "There was no date on the paper, so we estimated it from the page title and the birth date. Is this date right?",
  },
  "紙に日付がありませんでした。その日を入れてください": { zh: "纸上没有日期。请填入那天的日期", en: "There was no date on the paper. Please enter the date" },
  その事の日: { zh: "这件事的日期", en: "Date it happened" },

  // ── 記録の時系列（Timeline）──
  話した: { zh: "语音", en: "Spoken" },
  撮った: { zh: "拍照", en: "Photographed" },
  デモ用: { zh: "演示用", en: "Demo" },
  "{date}まで・あした": { zh: "{date}截止 · 明天", en: "Due {date} · tomorrow" },
  "{date}まで・あと{n}日": { zh: "{date}截止 · 还有{n}天", en: "Due {date} · {n} {n:day|days} left" },
  これからの予定: { zh: "今后的日程", en: "Upcoming plans" },
  これまでの記録: { zh: "以往的记录", en: "Past records" },
  "まだありません。話すか撮ると、ここに日付つきで並びます": {
    zh: "还没有记录。说或拍之后，会带着日期排在这里",
    en: "Nothing yet. Talk or snap, and things will be listed here with dates",
  },
  "話すか撮ると、ここに日付つきで並びます": { zh: "说或拍之后，会带着日期排在这里", en: "Talk or snap, and things will be listed here with dates" },
  // 急ぎに見えた記録に添える電話先（urgent-note.ts。言い換えずに訳す）
  "急ぎの時はかかりつけの産院へ電話（夜間も）。命が危ないと思ったら、迷わず119": {
    zh: "紧急时请打电话给你常去的产科医院（夜间也可以）。如果觉得有生命危险，请毫不犹豫地拨打119",
    en: "If it's urgent, call your maternity clinic (even at night). If you think a life is in danger, call 119 without hesitation",
  },
  "かかりつけの小児科へ。夜や休みは #8000。命が危ないと思ったら、迷わず119": {
    zh: "请联系常看的儿科。夜间和休息日请拨打 #8000。如果觉得有生命危险，请毫不犹豫地拨打119",
    en: "Call your child's regular pediatrician. At night or on holidays, call #8000. If you think a life is in danger, call 119 without hesitation",
  },
  "子どもはかかりつけの小児科・夜や休みは #8000。母の体はかかっている産院（夜間も）。命が危ないと思ったら、迷わず119": {
    zh: "孩子的事请联系常看的儿科，夜间和休息日请拨打 #8000。妈妈的身体请联系正在就诊的产科医院（夜间也可以）。如果觉得有生命危险，请毫不犹豫地拨打119",
    en: "For your child: their regular pediatrician, or #8000 at night or on holidays. For Mom's body: the maternity clinic she goes to (even at night). If you think a life is in danger, call 119 without hesitation",
  },

  // ── 打つ（TypeSheet。打った物は Claude を通さず手帳に入る）──
  "体重・身長": { zh: "体重、身高", en: "Weight, height" },
  "健診の体重・血圧": { zh: "检查时的体重、血压", en: "Checkup weight, blood pressure" },
  週数は入っています: { zh: "孕周已经填好了", en: "Weeks pregnant is already filled in" },
  ひとこと: { zh: "一句话", en: "A quick note" },
  "できごと・気がかり・メモ": { zh: "发生的事、担心的事、备忘", en: "Events, concerns, notes" },
  "予定・期限": { zh: "日程、期限", en: "Plans, deadlines" },
  日付と時刻: { zh: "日期和时间", en: "Date and time" },
  数字を1つ入れてください: { zh: "请至少填入一个数字", en: "Please enter at least one number" },
  "妊娠中の経過（妊婦健診）のページに入れました": {
    zh: "已记进“孕期经过（孕妇健康检查）”这一页",
    en: "Added to the “Pregnancy progress (prenatal checkups)” page",
  },
  "成長のページに入れました（曲線に点が付きます）": { zh: "已记进“成长”这一页（曲线上会标出点）", en: "Added to the Growth page (a point appears on the curve)" },
  体温を記録に入れました: { zh: "已把体温记进记录", en: "Temperature added to your records" },
  "{mama}の事か、{child}の事かを選んでください": { zh: "请选择是{mama}的事，还是{child}的事", en: "Please choose whether this is about {mama} or {child}" },
  "期限として入れました（いまのやる事に並びます）": {
    zh: "已作为期限记下（会排进“今天”的要做的事里）",
    en: "Added as a deadline (it shows up in your to-dos on Today)",
  },
  予定に入れました: { zh: "已加入日程", en: "Added to your plans" },
  "記録に入れ、{child}の次の健診で聞く事にも並べました": {
    zh: "已记进记录，也列进了{child}下次健康检查时要问的事里",
    en: "Added to your records, and to the questions for {child}'s next checkup",
  },
  "記録に入れ、次の健診の『先生に聞く事』にも並べました": {
    zh: "已记进记录，也列进了下次健康检查的“要问医生的事”里",
    en: "Added to your records, and to “Questions for the doctor” for the next checkup",
  },
  記録に入れました: { zh: "已记进记录", en: "Added to your records" },
  打って入れる: { zh: "手动输入", en: "Type it in" },
  "‹ 選び直す": { zh: "‹ 重新选择", en: "‹ Choose again" },
  "打った物は、そのまま手帳に入ります（AI には送りません）": {
    zh: "输入的内容会直接记进手册（不会发送给 AI）",
    en: "What you type goes straight into the handbook (it isn't sent to AI)",
  },
  "ほかの欄に打つ（検査・接種・できた日） ›": { zh: "在其他栏里输入（检查、接种、会做的日子） ›", en: "Type into other sections (tests, immunizations, milestones) ›" },
  "例 6.2": { zh: "例如 6.2", en: "e.g. 6.2" },
  "例 36.8": { zh: "例如 36.8", en: "e.g. 36.8" },
  だれの体温: { zh: "谁的体温", en: "Whose temperature" },
  何の記録: { zh: "什么记录", en: "What kind of record" },
  "何の予定・期限": { zh: "什么日程或期限", en: "What plan or deadline" },
  "例: 保育園の見学": { zh: "例：参观保育园", en: "e.g. Visiting a daycare" },
  "例: 夜に足がつる": { zh: "例：夜里腿抽筋", en: "e.g. Leg cramps at night" },
  "例: 初めて声を出して笑った": { zh: "例：第一次笑出声来", en: "e.g. Laughed out loud for the first time" },
  だれの事: { zh: "是谁的事", en: "Who it's about" },
  "だれの事？": { zh: "是谁的事？", en: "Who is it about?" },
  /** 気がかりを誰の健診で聞くか（{who} はママの呼び名か子の名前） */
  "{who}の事": { zh: "{who}的事", en: "About {who}" },
  "書いた事は、次の健診の「先生に聞く事」にも並びます。急ぎに見える時は、書くより先に電話を（{link}）": {
    zh: "写下的内容，也会排进下次健康检查的“要问医生的事”里。看起来紧急时，请先打电话，再写（{link}）",
    en: "What you write also goes on “Questions for the doctor” for the next checkup. If it looks urgent, call before you write ({link})",
  },
  "時刻（あれば）": { zh: "时间（如有）", en: "Time (if any)" },
  "期限にする（いまの「やる事」に並ぶ）": { zh: "设为期限（会排进“今天”的“要做的事”）", en: "Make it a deadline (it shows up in your to-dos on Today)" },
  手帳に入れる: { zh: "记进手册", en: "Add to handbook" },

  // ── 記録の題と本文の決まった形（保存は日本語のまま。出す時に components/capture/record-text.ts が引く） ──
  "体温 {n}℃": { zh: "体温 {n}℃", en: "Temperature {n}°C" },
  "{time}から": { zh: "{time}开始", en: "From {time}" },
  "期限。出どころ: {source}": { zh: "期限。来源：{source}", en: "Deadline. Source: {source}" },
} satisfies Entries;
