// 辞書: 手帳に聞く（components/ask/）と、見本の答え（lib/samples.ts）。
// 書き方は lib/i18n/index.ts の頭。言葉は lib/i18n/glossary.ts にそろえる。同じ鍵を2つの場所に置かない（core.ts などにある鍵は、そちらを使う）
// サーバから来る字（状態の行・断り・動きの札）は answers.ts。体・心の事と急ぎの時の文は、言い換えずに意味をそのまま訳す
import type { Entries } from "..";

export default {
  // ── 右下のボタンと窓の頭 ──
  "手帳に聞く（質問・アプリの使い方）": { zh: "问手册（提问、应用的用法）", en: "Ask the handbook (questions, how to use the app)" },
  手帳に聞く: { zh: "问手册", en: "Ask the handbook" },
  "見本の家族の手帳・手続き・予定・使い方に答えて動きます": {
    zh: "示例家庭的手册：解答手续、日程和用法，还能直接帮你办",
    en: "Sample family's handbook · Answers and acts on paperwork, schedules, and app help",
  },
  "あなたの手帳・手続き・予定・使い方に答えて動きます": {
    zh: "你的手册：解答手续、日程和用法，还能直接帮你办",
    en: "Your handbook · Answers and acts on paperwork, schedules, and app help",
  },
  新しく話す: { zh: "开始新对话", en: "New chat" },
  "開いています…": { zh: "正在打开…", en: "Opening…" },

  // ── 話す前の案内（同意がまだの時・体と心の事） ──
  "この家族の予定と手帳を見て答えます。窓口調べ・下書き・画面の案内まで、そのままできます。": {
    zh: "会根据这个家庭的日程和手册来回答。查该去的窗口、写草稿、带你去要用的页面，都能在这里直接完成。",
    en: "Answers draw on this family's schedule and handbook. Finding the right office, writing drafts, and getting to the right screen all happen right here.",
  },
  "次にやる事・健診と予防接種の日など、予定表で分かる事はすぐ答えます。ほかの問いは、ママが手帳に入って同意した後に答えます。": {
    zh: "下一步要做的事、健康检查和预防接种的日期等，看日程表就知道的事会马上回答。其他问题，要等妈妈加入手册并同意后再回答。",
    en: "Things the schedule can tell, like what to do next or when checkups and immunizations are, get answered right away. Other questions get answered after Mom joins the handbook and gives consent.",
  },
  "次にやる事・健診と予防接種の日など、予定表で分かる事はすぐ答えます。ほかの問いは、米国の Claude に送る同意の後に答えます。": {
    zh: "下一步要做的事、健康检查和预防接种的日期等，看日程表就知道的事会马上回答。其他问题，要在你同意发送给美国的 Claude 之后再回答。",
    en: "Things the schedule can tell, like what to do next or when checkups and immunizations are, get answered right away. Other questions get answered after you consent to sending data to Claude in the US.",
  },
  "体や心のこと、授乳や離乳食の量は、判断しません。日付つきで記録し、健診で聞く事と連絡先につなぎます。急ぐ時は赤い「急ぎの時」・119・#8000。": {
    zh: "身体和心理的事、喂奶和辅食的量，手册不做判断。会附上日期记录下来，再连到健康检查时要问的事和可以联系的地方。着急时：红色的“紧急情况”、119、#8000。",
    en: "The handbook doesn't judge anything about the body or mind, or how much milk or baby food to give. It records things with the date and links them to questions for the checkup and to the right contacts. If it's urgent: the red “Emergency” button, 119, or #8000.",
  },
  /** **…** は太字の所（AskSheet の withBold が描く。訳でも太字にしたい言葉を **…** で囲む） */
  "この問いに答えるには、**米国の Claude に送る同意**が要ります（問いと一緒に、最近の記録と会話も送ります）。同意の後に、続けて答えます。": {
    zh: "要回答这个问题，需要**同意发送给美国的 Claude**（会把问题连同最近的记录和对话一起发送）。同意后，会接着回答。",
    en: "To answer this question, the handbook needs your **consent to send data to Claude in the US** (your recent records and conversation are sent along with the question). Once you agree, it will go on to answer.",
  },

  // ── 最初の問いの例（押すと、訳した問いがそのままサーバへ行く。人が打つ形の問いにする） ──
  "次にやる事は何？": { zh: "接下来要做什么？", en: "What should I do next?" },
  "この画面では何ができる？": { zh: "这个页面能做什么？", en: "What can I do on this screen?" },
  "健診で何を聞けばいい？": { zh: "健康检查时该问医生什么？", en: "What should I ask at the checkup?" },
  "健診の日の録音はどうやるの？": { zh: "健康检查那天怎么录音？", en: "How do I record on checkup day?" },
  "撮った紙はどこで OK するの？": { zh: "拍下来的纸在哪里确认？", en: "Where do I confirm the papers I photographed?" },
  "予防接種の控えはどこ？": { zh: "预防接种的记录在哪里？", en: "Where are the vaccination records?" },
  "何を話せば記録になるの？": { zh: "说什么才能变成记录？", en: "What should I say to make a record?" },
  "役所の封筒を撮ったらどうなる？": { zh: "拍了区政府寄来的信封会怎样？", en: "What happens if I photograph mail from the city office?" },
  "産休と育休はいつから？": { zh: "产前产后休假和育儿休假从什么时候开始？", en: "When do maternity leave and childcare leave start?" },
  "出産でもらえるお金は？": { zh: "生孩子能领到哪些钱？", en: "What money can I get for giving birth?" },
  "出生届はいつまで？どこに？": { zh: "出生登记什么时候之前办？在哪里办？", en: "When and where do I file the birth registration?" },
  "児童手当は誰が申し込むの？": { zh: "儿童补贴由谁来申请？", en: "Who applies for the child allowance?" },
  "次の予防接種と健診はいつ？": { zh: "下次预防接种和健康检查是什么时候？", en: "When are the next vaccinations and checkup?" },
  "保育園の申し込みはいつ？": { zh: "保育园什么时候申请？", en: "When do I apply for daycare?" },
  "次の健診はいつ？": { zh: "下次健康检查是什么时候？", en: "When is the next checkup?" },
  "これまでの記録を一冊にするには？": { zh: "怎么把以往的记录做成一本书？", en: "How do I turn our records into a book?" },

  // ── 会話の流れ（答えを待つ間・答えが付かなかった時） ──
  "前の話（{n}件）": { zh: "之前的对话（{n}条）", en: "Earlier conversation ({n})" },
  "{status}…（閉じても、答えはここに残ります）": { zh: "{status}…（关掉也没关系，回答会留在这里）", en: "{status}… (You can close this. The answer will stay here.)" },
  答えを作っています: { zh: "正在准备回答", en: "Preparing the answer" },
  "この問いには、答えを作れませんでした。": { zh: "这个问题没能生成回答。", en: "Couldn't put together an answer to this question." },
  もう一度聞く: { zh: "再问一次", en: "Ask again" },
  "体の事で急ぐ時は、答えを待たずに:": { zh: "身体的事很着急时，不要等回答：", en: "If it's about the body and urgent, don't wait for the answer:" },
  "迷ったら #8000": { zh: "拿不准时打 #8000", en: "Not sure? Call #8000" },
  "通信できませんでした。電波を確かめて、もう一度聞いてください": {
    zh: "无法连接网络。请检查信号后再问一次",
    en: "Couldn't connect. Please check your signal and ask again",
  },
  // 「消せませんでした」はアルバムの辞書（album.ts）の訳を使う

  // ── 書く欄 ──
  聞きたい事: { zh: "想问的事", en: "Your question" },
  聞きたい事を書く: { zh: "写下想问的事", en: "Type your question" },
  送る: { zh: "发送", en: "Send" },

  // ── 押している間だけ話す ──
  押している間だけ話して聞く: { zh: "按住时说话提问", en: "Hold to ask by voice" },
  押して話す: { zh: "按住说话", en: "Hold to talk" },
  話しています: { zh: "正在说话", en: "Talking" },
  聞き取り中: { zh: "正在识别", en: "Transcribing" },
  "この機械では録音が使えません。書いて聞いてください": { zh: "这台设备不能录音。请打字提问", en: "This device can't record. Please type your question" },
  "マイクが使えませんでした。ブラウザの設定でマイクを許可してください": {
    zh: "无法使用麦克风。请在浏览器设置里允许使用麦克风",
    en: "Couldn't use the microphone. Please allow it in your browser settings",
  },
  "押している間だけ録音します。押したまま話してください": {
    zh: "只在按住时录音。请按住说话",
    en: "It only records while you hold the button. Please keep holding while you talk",
  },
  "短すぎました。押したまま話してください": { zh: "太短了。请按住说话", en: "That was too short. Please keep holding while you talk" },
  声を文字にできませんでした: { zh: "没能把声音转成文字", en: "Couldn't turn your voice into text" },

  // ── 答えの下の動き ──
  調べたページ: { zh: "参考的网页", en: "Sources" },
  "✓ 済みました": { zh: "✓ 已完成", en: "✓ Done" },
  ママの次の健診で先生に聞く事: { zh: "妈妈下次健康检查时要问医生的事", en: "To ask the doctor at Mom's next checkup" },
  "{name}の次の健診で先生に聞く事": { zh: "{name}下次健康检查时要问医生的事", en: "To ask the doctor at {name}'s next checkup" },
  次の健診で先生に聞く事: { zh: "下次健康检查时要问医生的事", en: "To ask the doctor at the next checkup" },
  健診で聞く事に足す: { zh: "加到健康检查时要问的事里", en: "Add to checkup questions" },
  "記録に残す事（話す・撮るの「これまでの記録」に日付つきで。一冊には入りません）": {
    zh: "要记下来的事（会带上日期存进“说·拍·写”的“以往的记录”，不会放进成长书）",
    en: "To keep as a record (saved with the date in “Past records” on Talk · Snap · Type; it won't go into the book)",
  },
  "記録しています…": { zh: "正在记录…", en: "Saving…" },
  記録に残す: { zh: "记录下来", en: "Save as a record" },
  "「{label}」を済みにする": { zh: "将“{label}”标记为完成", en: "Mark “{label}” as done" },
  "{to}へ渡す文（送るのはあなた）": { zh: "要交给{to}的文字（由你来发送）", en: "Message for {to} (you send it)" },
  件名: { zh: "主题", en: "Subject" },
  本文: { zh: "正文", en: "Message" },
} satisfies Entries;
