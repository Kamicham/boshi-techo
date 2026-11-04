// 鍵が無くても動く床（2026-11-04）: Claude の鍵（ANTHROPIC_API_KEY）が無い時、見本の家族（kind = demo）だけは、
// Claude の代わりにここの「見本の答え」を返す。公開リポを clone した人・審査の人が、鍵を作る前に手帳の流れを一通り触れるように。
// - 本物の世帯・シミュレーションの家族には使わない（今までどおり「鍵がありません」の 503）
// - 見本の答えは、Claude が書いたふりをしない。どれも「見本」と分かる言葉にする（現実に即す約束）
// - 町の窓口の調べ物は見本を作らない（町×手続きの答えはほかの家族と使い回すので、見本が混ざらないように）
// - 決まりで動く所（予定表・期限・急ぎの時の連絡先＝ask/bridge.ts）は、もともと鍵なしで動く
import "server-only";

/** 答えの頭に付ける札 */
export const SAMPLE_MARK = "（見本の答え）";
/** 見本にした訳（鍵が無い／公開版で今日の上限に達した） */
const noKey = () =>
  process.env.ANTHROPIC_API_KEY ? "今日の体験で Claude を使える上限に達したので、見本の答えにしました。明日はここを Claude が書きます。" : "Claude の鍵を入れると、ここを Claude が書きます。";

type Content = string | readonly { type: string; text?: string }[];

const textOf = (c: Content): string => (typeof c === "string" ? c : c.map((b) => (b.type === "text" ? (b.text ?? "") : "")).join("\n"));
const firstDay = (s: string): string | null => s.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

/** 急ぎに見える言葉（見本の時も、連絡を勧める印だけは付ける。体の判断はしない） */
const URGENT = /出血|破水|強い痛み|お腹が痛|胎動が(少な|無|ない)|ぐったり|高熱|けいれん|息が苦し/;

/** 撮る・書く: 書いた文を、そのまま1つのメモとして残す */
function capture(content: Content) {
  const all = textOf(content);
  const today = firstDay(all) ?? new Date().toISOString().slice(0, 10);
  // context() の後ろに家族の文が来る。最後の空行の後を家族の文とみなす
  // capture() は「家族の時計など\n\n書いた事:\n<家族の文>」の形で渡す。最後の段の見出しの行を外す
  const said = all.split(/\n\s*\n/).pop()?.replace(/^[^\n]*[:：]\n/, "").trim() || all.trim();
  const urgent = URGENT.test(said);
  return {
    gist: "",
    records: [
      {
        date: today,
        kind: "メモ" as const,
        title: said.replace(/\s+/g, " ").slice(0, 20),
        detail: `${said}${urgent ? "\nその日のうちに産院（子どもの事ならかかりつけ・迷ったら #8000）へ電話" : ""}`,
        urgent,
        who: null,
      },
    ],
    deadlines: [],
    techo: [],
    oneQuestion: null,
    reply: `${SAMPLE_MARK}書いた文を、そのままメモに残しました。${noKey()}（いつ・誰の事・期限を読み分けます）`,
  };
}

/** 紙の手帳の写真を写す: 見本では読まない */
function capturePage() {
  return {
    page: "unknown",
    entries: [],
    unreadable: false,
    reply: `${SAMPLE_MARK}写真は残しました。${noKey()}（紙の母子手帳のページを読んで、行ごとに写します）`,
  };
}

/** 下書き: 空欄つきの記入メモ */
function draft(content: Content) {
  const all = textOf(content);
  const title = all.match(/(?:事|手続き|やる事)[:：]\s*(.+)/)?.[1]?.trim().slice(0, 30) ?? "手続きの下書き";
  return {
    kind: "記入メモ" as const,
    title: `${SAMPLE_MARK}${title}`,
    to: "【出す先】",
    body: `${noKey()}\nこの家族の予定・町・「いつもの」（勤め先や連絡先）から、そのまま出せる文を書き、分からない所だけ空欄にして残します。\n\n見本では、出す前に確かめる事だけを並べています。`,
    checklist: ["出す先と締切を、町の窓口のページで確かめる", "持って行く物をそろえる", "書いた文を家族で読み合わせる"],
  };
}

/** 気づき（決まりのきっかけ）: 機械で確かめた事は画面に出るので、文だけ見本にする */
function advice() {
  return {
    title: `${SAMPLE_MARK}予定表に無い事に気づきました`,
    why: `予定表で分かった事（下に出ています）から見つけました。${noKey()}`,
    plan: ["下に出ている、予定表で分かった事を家族で見る", "必要なら町の窓口か職場に確かめる"],
  };
}

/** 見渡す: 見本では無理に作らない */
function look() {
  return { found: false, basis: [] };
}

/** 一冊: 記録から語りかける本は、鍵がある時だけ書く（映画と声は lib/book.ts の settlePhotos・settleVoices が候補から古い順に作る） */
function book() {
  return {
    title: "見本の一冊",
    dedication: `${SAMPLE_MARK}${noKey()}今日までの記録と写真から、子どもに語りかける一冊を書きます。`,
    chapters: [],
    closing: "記録が増えるほど、この本は厚くなります。",
    cover: "",
    film: [],
  };
}

const SAMPLES: Record<string, (content: Content) => unknown> = {
  capture,
  "capture-page": capturePage,
  draft,
  advice,
  look,
  book,
};

/** その仕事の見本の答え（無い仕事は null。呼ぶ側は今までどおり「鍵がありません」を返す） */
export function sampleAnswer(task: string | undefined, content: Content): unknown | null {
  const make = task ? SAMPLES[task] : undefined;
  return make ? make(content) : null;
}

/** 手帳に聞く: 見本の返事（急ぎの言葉への連絡先は、bridge.ts が鍵なしで頭に置く） */
export const sampleAskReply = () => `${SAMPLE_MARK}${noKey()}この家族の予定・記録・町を道具で見てから答え、記録・健診で聞く事・その画面へ行くボタンを添えます。\n見本のあいだも、予定表・期限・急ぎの時の連絡先はそのまま使えます。`;
