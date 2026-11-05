// 辞書: 健診の記録（app/visit/[id]/page.tsx・components/visit/Recorder.tsx・Guide.tsx）。書き方は lib/i18n/index.ts の頭。
// 2026-11-05 夜: 健診の画面の訳（UX が2体に分けて訳す。全体監査の dict/visit.ts とは別のファイル）。
// 先生の言葉・録音から聞こえた言葉は訳さない（機械の聞き取りを、訳でさらに変えない）。病院あての1枚は日本語のまま描く（LocaleScope）
// - 言葉: 健診＝健康检查／checkup（today.ts・techo.ts）・まとめ＝总结／summary・整理＝整理／organize・受付＝挂号／reception・案内図＝指示图／floor map（answers.ts）
// - ほかの辞書の鍵を使う所: 健診（answers.ts）・読む・消す・やめる・{n}秒・写真から選ぶ・写真を読めませんでした（album.ts）・送る（ask.ts）・撮る（capture.ts）・
//   済んだ・まだ・もう一度開く（today.ts）・妊娠{w}週（techo.ts）・{m}分{s}秒（book.ts）・（{x}）・うまくいきませんでした（{status}）（core.ts）
// - 先生に聞かせる言葉（録音してもいいですか・家族が聞き返すためだけに使います）は、中文・English でも日本語を括弧で並べる（その場で言える・見せられるように）
import type { Entries } from "..";

export default {
  // ── 健診の1日の画面（app/visit/[id]/page.tsx）──
  健診の記録を開けませんでした: { zh: "无法打开这次检查的记录", en: "Couldn't open the checkup record" },
  "記録は消えていません。電波のある所で開き直してください": { zh: "记录没有丢失。请到有信号的地方重新打开", en: "Your record is safe. Please reopen it where you have a signal" },
  健診の段: { zh: "检查的步骤", en: "Checkup steps" },
  /** 段の札（lib/visit.ts の STAGES。読む・送るは album.ts・ask.ts の鍵） */
  着く: { zh: "到达", en: "Arrive" },
  案内: { zh: "指引", en: "Guide" },
  録音: { zh: "录音", en: "Record" },
  "今の操作が、まだ手帳に届いていません": { zh: "刚才的操作还没有送到手册", en: "What you just did hasn't reached the handbook yet" },
  "録音と記録は消えていません。電波のある所でもう一度押してください": {
    zh: "录音和记录都没有丢失。请在有信号的地方再按一次",
    en: "Your recording and records are safe. Please tap again where you have a signal",
  },
  "病院に着いたら、押す": { zh: "到了医院就按这里", en: "Tap when you arrive at the hospital" },
  着いた: { zh: "到了", en: "I'm here" },
  まとめを作れませんでした: { zh: "没能生成总结", en: "Couldn't make the summary" },
  録音が手帳に届きませんでした: { zh: "录音没有送到手册", en: "The recording didn't reach the handbook" },
  "録音は消えていません。まとめは「読む」から作り直せます": { zh: "录音没有丢失。可以在“读”里重新生成总结", en: "Your recording is safe. You can remake the summary from “Read”" },
  もう一度録音してください: { zh: "请再录一次", en: "Please record again" },
  今日聞く事: { zh: "今天要问的事", en: "To ask today" },
  "聞けたら印を付けると、整理の時に先生の答えを探します。": {
    zh: "问到了就打勾，整理时会找出医生的回答。",
    en: "Check off what you asked, and we'll look for the doctor's answers while organizing.",
  },
  /** 上の1文の後ろに続ける（English は半角の括弧と空き） */
  "（{n}件 聞けた）": { zh: "（已问 {n} 件）", en: " ({n} asked)" },
  録音は済みました: { zh: "录音已经完成", en: "Recording is done" },
  まとめを読む: { zh: "看总结", en: "Read the summary" },
  "1/2 文字にしています": { zh: "1/2 正在转成文字", en: "1/2 Turning it into text" },
  "2/2 整理しています": { zh: "2/2 正在整理", en: "2/2 Organizing" },
  まとめを作っています: { zh: "正在生成总结", en: "Making the summary" },
  "閉じても大丈夫。1〜2分ほどで出ます": { zh: "关掉也没关系，大约1～2分钟后就会出来", en: "You can close this. It'll be ready in about 1–2 minutes" },
  "閉じても大丈夫。1分ほどで出ます": { zh: "关掉也没关系，大约1分钟后就会出来", en: "You can close this. It'll be ready in about a minute" },
  "止まっているので、やり直す": { zh: "好像卡住了，重新来", en: "It's stuck. Try again" },
  "録音は消えていません。まとめだけ作り直します": { zh: "录音没有丢失。只重新生成总结", en: "Your recording is safe. Only the summary will be remade" },
  "録音が手帳に届いていません。もう一度録音してください": { zh: "录音还没有送到手册。请再录一次", en: "The recording hasn't reached the handbook. Please record again" },
  まとめを作り直す: { zh: "重新生成总结", en: "Remake the summary" },
  録音へ: { zh: "去录音", en: "Go to recording" },
  まだ録音していません: { zh: "还没有录音", en: "Not recorded yet" },
  一緒に読んでもらう: { zh: "请家人一起看", en: "Read it together with your family" },
  "LINE で家族に送る": { zh: "用 LINE 发给家人", en: "Send to family with LINE" },
  ほかのアプリで: { zh: "用其他应用", en: "With another app" },
  "3行の全文": { zh: "3行全文", en: "Full 3-line text" },
  まとめができたら送れます: { zh: "总结生成后就能发送", en: "You can send it once the summary is ready" },
  戻る: { zh: "返回", en: "Back" },
  録音も一緒に消えます: { zh: "录音也会一起删除", en: "The recording will be deleted too" },
  この健診の記録を消す: { zh: "删除这次检查的记录", en: "Delete this checkup record" },
  /** 健診の呼び名（サーバが日本語で残した「妊娠の前」。妊娠中・生まれた後の呼び名は techo.ts と lib/clock.ts の relabel） */
  妊娠の前: { zh: "怀孕前", en: "Before pregnancy" },

  // ── 録音（components/visit/Recorder.tsx）──
  先生の話を録音する: { zh: "录下医生说的话", en: "Record what the doctor says" },
  "前に録った分（{n}秒ほど）が届いています": { zh: "之前录的部分（约{n}秒）已经送到了", en: "Your earlier recording (about {n} {n:second|seconds}) has arrived" },
  続きを録音する: { zh: "继续录音", en: "Continue recording" },
  録音を始める: { zh: "开始录音", en: "Start recording" },
  録った分を整理する: { zh: "整理已录的部分", en: "Organize what's recorded" },
  /** 先生に聞く言葉は、中文・English でも日本語を括弧で並べる（その場で言える・見せられるように） */
  "先生に「録音してもいいですか」と聞きましたか？": {
    zh: "你问过医生了吗？“可以录音吗？”（録音してもいいですか）",
    en: "Did you ask the doctor, “May I record this?” (録音してもいいですか)",
  },
  家族が聞き返すためだけに使います: {
    zh: "只用于让家人回听（家族が聞き返すためだけに使います）",
    en: "It's only for your family to listen back to (家族が聞き返すためだけに使います)",
  },
  "聞いた。始める": { zh: "问过了，开始", en: "Asked. Start" },
  "マイクを準備しています…": { zh: "正在准备麦克风…", en: "Getting the microphone ready…" },
  一時停止: { zh: "暂停", en: "Pause" },
  再開: { zh: "继续", en: "Resume" },
  止めて整理する: { zh: "停止并整理", en: "Stop and organize" },
  一時停止中: { zh: "已暂停", en: "Paused" },
  "残りを送っています…": { zh: "正在发送剩下的部分…", en: "Sending the rest…" },
  "送った {sent} / 録った {made}（10秒ずつ）": { zh: "已发送 {sent} / 已录 {made}（每段10秒）", en: "Sent {sent} / Recorded {made} (10 seconds each)" },
  "10秒以上、音が入っていません。マイクを指で塞いでいないか、通話などほかのアプリがマイクを使っていないか確かめてください": {
    zh: "已经超过10秒没有录进声音。请确认手指没有挡住麦克风，也没有通话等其他应用正在使用麦克风",
    en: "No sound for more than 10 seconds. Check that your finger isn't covering the microphone and that no other app, like a call, is using it",
  },
  "画面を消さない・ほかのアプリに切り替えない（iPhone は録音が止まります）": {
    zh: "不要关屏幕，也不要切换到其他应用（iPhone 会停止录音）",
    en: "Keep the screen on and stay in this app (on iPhone, recording stops otherwise)",
  },
  "録音ファイルを送っています…": { zh: "正在发送录音文件…", en: "Sending the recording file…" },
  "念のため、この端末にも録音を保存する": { zh: "以防万一，也把录音保存到这台设备上", en: "Just in case, save the recording on this device too" },
  "録音ファイルを取り込む（ボイスメモなど）": { zh: "导入录音文件（语音备忘录等）", en: "Import a recording file (Voice Memos, etc.)" },
  /** iPhone の設定の名前は、その言葉の iPhone の表示にそろえる */
  "この端末は画面を消さない設定が使えません。自動ロックで画面が消えると録音が止まります。設定 > 画面表示と明るさ > 自動ロック を「なし」にしてください": {
    zh: "这台设备无法让屏幕保持常亮。自动锁定关掉屏幕后，录音会停止。请在 设置 > 显示与亮度 > 自动锁定 中选择“永不”",
    en: "This device can't keep the screen on. If Auto-Lock turns the screen off, recording stops. Go to Settings > Display & Brightness > Auto-Lock and choose “Never”",
  },
  "マイクが止められています（画面が消えた・ほかのアプリ・着信など）。この画面に戻ると続きを録ります": {
    zh: "麦克风被停用了（屏幕关闭、其他应用、来电等）。回到这个页面就会接着录",
    en: "The microphone has been stopped (screen off, another app, an incoming call, etc.). Come back to this screen to keep recording",
  },
  /** {time} は「1分5秒」「40秒」（book.ts の {m}分{s}秒・album.ts の {n}秒） */
  "画面が消えていた・ほかのアプリにいた {time}ほどは、録れていないかもしれません": {
    zh: "屏幕关闭或切到其他应用的约{time}里，可能没有录上",
    en: "The screen was off or you were in another app for about {time}. That part may not have been recorded",
  },
  この健診はもう文字起こしを始めています: { zh: "这次检查已经开始转写文字了", en: "Transcription has already started for this checkup" },
  "録音の一部を受け取ってもらえませんでした（{status}）。念のため、下の「この端末にも録音を保存する」を押してください": {
    zh: "录音的一部分没有被接收（{status}）。以防万一，请按下面的“也把录音保存到这台设备上”",
    en: "Part of the recording wasn't accepted ({status}). Just in case, tap “Save the recording on this device too” below",
  },
  "いま送れていません。録音は続いていて、電波が戻ったら自動で送ります": {
    zh: "现在发送不出去。录音还在继续，信号恢复后会自动发送",
    en: "Can't send right now. Recording continues and will send automatically when the signal is back",
  },
  "残りを送れていません。電波が戻ったら自動で送ります。急ぐ時は下の「この端末にも録音を保存する」を押してください": {
    zh: "剩下的部分还没发送出去。信号恢复后会自动发送。着急时，请按下面的“也把录音保存到这台设备上”",
    en: "The rest hasn't been sent yet. It will send automatically when the signal is back. If you're in a hurry, tap “Save the recording on this device too” below",
  },
  "この機械のブラウザでは録音ができません。下の「録音ファイルを取り込む」を使ってください": {
    zh: "这台设备的浏览器不能录音。请使用下面的“导入录音文件”",
    en: "This device's browser can't record. Please use “Import a recording file” below",
  },
  "録音が止まりました。送れた所までは残っています": { zh: "录音停止了。已经发送的部分都保留着", en: "Recording stopped. Everything sent so far is kept" },
  "マイクが使えません。ブラウザの設定で、このページのマイクを「許可」にしてください": {
    zh: "无法使用麦克风。请在浏览器设置里，把这个页面的麦克风设为“允许”",
    en: "Can't use the microphone. In your browser settings, set the microphone for this page to “Allow”",
  },
  マイクが見つかりません: { zh: "找不到麦克风", en: "No microphone found" },
  録音を始められませんでした: { zh: "无法开始录音", en: "Couldn't start recording" },
  /** 端末に残す録音のファイルの名前（{date} は 2026-11-05） */
  "健診-{date}-{n}.{ext}": { zh: "检查-{date}-{n}.{ext}", en: "checkup-{date}-{n}.{ext}" },
  "録音が途切れました（着信・ほかのアプリ・画面のロックなど）。録れた所までは残っています。「続きを録音する」で続けられます": {
    zh: "录音中断了（来电、其他应用、屏幕锁定等）。已经录到的部分都保留着。按“继续录音”可以接着录",
    en: "Recording was interrupted (an incoming call, another app, the screen locking, etc.). What was recorded so far is kept. Tap “Continue recording” to go on",
  },
  "通信できませんでした。電波が戻ったら「録った分を整理する」を押してください": {
    zh: "无法连接网络。信号恢复后，请按“整理已录的部分”",
    en: "Couldn't connect. When the signal is back, tap “Organize what's recorded”",
  },
  "文字起こしを始められませんでした: {message}": { zh: "无法开始转写文字：{message}", en: "Couldn't start transcription: {message}" },
  "送れませんでした（{status}）": { zh: "没能发送（{status}）", en: "Couldn't send it ({status})" },

  // ── 院内の道案内（components/visit/Guide.tsx）。場所・階・する事・確かめる事は写真から読んだ日本語のまま（病院の表示と見比べるため）──
  "写真を小さくしています…": { zh: "正在缩小照片…", en: "Making the photos smaller…" },
  "順番を作っています…（30秒ほど）": { zh: "正在排顺序…（约30秒）", en: "Working out the order… (about 30 seconds)" },
  院内の道案内: { zh: "院内指引", en: "Directions in the hospital" },
  "受付・院内の道案内": { zh: "挂号和院内指引", en: "Reception and directions in the hospital" },
  案内図か受付票を撮る: { zh: "拍下指示图或挂号单", en: "Take a photo of the floor map or reception slip" },
  "回る順番を作ります。次からは撮らずに出します。": { zh: "会排好要去的顺序。下次不用拍也会显示。", en: "This makes the order to go around. Next time it shows up without a photo." },
  とばす: { zh: "跳过", en: "Skip" },
  "次はここ（{i}/{n}）": { zh: "下一站（{i}/{n}）", en: "Next stop ({i}/{n})" },
  診察に呼ばれた: { zh: "轮到我看诊了", en: "I've been called in" },
  順番は全部済みました: { zh: "所有步骤都完成了", en: "All steps are done" },
  いつもの順番: { zh: "平时的顺序", en: "Usual order" },
  今日の順番: { zh: "今天的顺序", en: "Today's order" },
  いつもの病院: { zh: "常去的医院", en: "Usual hospital" },
  撮り直す: { zh: "重新拍", en: "Retake" },
  受付で確かめる事: { zh: "要在挂号处确认的事", en: "Check at reception" },

  // ── 健診のタブ（app/visit/page.tsx・Briefing.tsx）とも重なる言葉。持ち物の名前は lib/visit.ts の bringList（窓口で見せる物なので、日本語を括弧で並べる）──
  "読み込んでいます…": { zh: "正在读取…", en: "Loading…" },
  録音中: { zh: "正在录音", en: "Recording" },
  デモ: { zh: "演示", en: "Demo" },
  "持ち物 {n}": { zh: "要带的东西 {n}样", en: "{n} {n:item|items} to bring" },
  母子健康手帳: { zh: "母子健康手册（母子健康手帳）", en: "Maternal and Child Health Handbook (母子健康手帳)" },
  マイナ保険証か資格確認書: {
    zh: "个人编号卡健康保险证（マイナ保険証）或资格确认书（資格確認書）",
    en: "My Number health insurance card (マイナ保険証) or certificate of eligibility (資格確認書)",
  },
  妊婦健診の受診券: { zh: "孕妇健康检查的检查券（妊婦健診の受診券）", en: "Prenatal checkup vouchers (妊婦健診の受診券)" },
  診察券: { zh: "就诊卡（診察券）", en: "Patient card (診察券)" },
  子どもの医療証: { zh: "儿童医疗证（子どもの医療証）", en: "Child's medical card (子どもの医療証)" },
  "出産手当金の申請書（医師の証明の欄がまだなら）": {
    zh: "分娩补贴（出産手当金）的申请书（如果医师证明栏还没填）",
    en: "Maternity allowance (出産手当金) application form (if the doctor's section isn't filled in yet)",
  },
} satisfies Entries;
