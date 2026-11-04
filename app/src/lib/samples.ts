// 鍵が無くても動く床（2026-11-04）: Claude の鍵（ANTHROPIC_API_KEY）が無い時、見本の家族（kind = demo）だけは、
// Claude の代わりにここの「見本の答え」を返す。公開リポを clone した人・審査の人が、鍵を作る前に手帳の流れを一通り触れるように。
// - 本物の世帯・シミュレーションの家族には使わない（今までどおり「鍵がありません」の 503）
// - 見本の答えは、Claude が書いたふりをしない。どれも「見本」と分かる言葉にする（現実に即す約束）
// - 町の窓口の調べ物は見本を作らない（町×手続きの答えはほかの家族と使い回すので、見本が混ざらないように）
// - 決まりで動く所（予定表・期限・急ぎの時の連絡先＝ask/bridge.ts）は、もともと鍵なしで動く
import "server-only";
import { ruleAdvice } from "./advisor";
import { DRAFTABLE } from "./draft-kinds";
import type { DraftKind } from "./drafts";
import { MILESTONES } from "./milestones";
import { MONEY, paidDef } from "./money";

/** 答えの頭に付ける札 */
export const SAMPLE_MARK = "（見本の答え）";
/** 見本にした訳（鍵が無い／公開版で今日の上限に達した） */
const noKey = () =>
  process.env.ANTHROPIC_API_KEY ? "今日の体験で Claude を使える上限に達したので、見本の答えにしました。明日はここを Claude が書きます。" : "Claude の鍵を入れると、ここを Claude が書きます。";

type Content = string | readonly { type: string; text?: string }[];

const textOf = (c: Content): string => (typeof c === "string" ? c : c.map((b) => (b.type === "text" ? (b.text ?? "") : "")).join("\n"));
const firstDay = (s: string): string | null => s.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

/** 急ぎに見える言葉（見本の時も、連絡を勧める印だけは付ける。体の判断はしない） */
const URGENT = /出血|破水|強い痛み|お腹が痛|胎動が(少な|無|ない)|ぐったり|高熱|けいれん|息が苦し|水も飲めない/;
/** 気がかりに見える言葉（見本の時も、メモでなく気がかりにして、次の健診の「先生に聞く事」へ並べる道を通す。体の判断はしない） */
const WORRY = /気にな|心配|不安|痛|足がつ|こむら返り|つる|眠れない|寝られない|寝つけない|かゆ|むくみ|張る|張って|吐き|吐いた|つわり|泣き止まない|泣きやまない|よく泣く|飲まない|食べない|熱|咳|せき|鼻水|湿疹|発疹|便秘|下痢/;

/** 撮る・書く: 書いた文を、そのまま1つの記録として残す（気がかりに見える言葉なら気がかり、ほかはメモ） */
function capture(content: Content) {
  const all = textOf(content);
  const today = firstDay(all) ?? new Date().toISOString().slice(0, 10);
  // context() の後ろに家族の文が来る。最後の空行の後を家族の文とみなす
  // capture() は「家族の時計など\n\n書いた事:\n<家族の文>」の形で渡す。最後の段の見出しの行を外す
  const said = all.split(/\n\s*\n/).pop()?.replace(/^[^\n]*[:：]\n/, "").trim() || all.trim();
  const urgent = URGENT.test(said);
  const worry = urgent || WORRY.test(said);
  return {
    gist: "",
    records: [
      {
        date: today,
        kind: worry ? ("気がかり" as const) : ("メモ" as const),
        title: said.replace(/\s+/g, " ").slice(0, 20),
        detail: `${said}${urgent ? "\nその日のうちに産院（子どもの事ならかかりつけ・迷ったら #8000）へ電話" : worry ? "\n次の健診で聞く" : ""}`,
        urgent,
        who: null,
      },
    ],
    deadlines: [],
    techo: [],
    oneQuestion: null,
    reply: `${SAMPLE_MARK}書いた文を、そのまま${worry ? "気がかり" : "メモ"}に残しました。${noKey()}（いつ・誰の事・期限を読み分けます）`,
  };
}

/** 紙の手帳の写真を写す: 見本では読まない（写真そのものは、鍵があっても残さない＝lib/capture.ts の captureTechoPage） */
function capturePage() {
  const key = !!process.env.ANTHROPIC_API_KEY;
  return {
    page: "unknown",
    entries: [],
    unreadable: false,
    reply: `${SAMPLE_MARK}${key ? "今日の体験で Claude を使える上限に達したので" : "見本なので"}、写真は読まず、残してもいません。${key ? "明日は" : "Claude の鍵を入れると、"}紙の母子手帳のページを読んで、行ごとに写します。`,
  };
}

/** 下書きの種類ごとの見本（何を書くか・出す前に確かめる事） */
const DRAFT_SAMPLE: Record<DraftKind, { to: string; how: string; check: string[] }> = {
  メール: {
    to: "【出す先】",
    how: "この家族の予定・町・「いつもの」（勤め先や連絡先）から、そのまま送れるメールを書き、分からない所だけ空欄にして残します。",
    check: ["宛先と宛名を確かめる", "日付を手帳の予定と見比べる", "送る前に家族で読み合わせる"],
  },
  記入メモ: {
    to: "【出す先】",
    how: "届けや申請書の欄ごとに、何を書くか・どこを見れば分かるかを、この家族の予定と町から書きます。",
    check: ["出す先と締切を、町の窓口のページで確かめる", "持って行く物をそろえる", "書いた文を家族で読み合わせる"],
  },
  質問リスト: {
    to: "【聞く先】",
    how: "窓口や病院で聞く事を、この家族の予定と町から、1行に1つずつ書きます。",
    check: ["聞く先と、聞ける日・時間を確かめる", "聞いた答えを手帳に残す"],
  },
  頼み文: {
    to: "【頼む人の呼び方】",
    how: "家族にそのまま送れる、短い頼み文を書きます（いつ・何を頼むか）。",
    check: ["頼む日と時間を決める", "送る前に家族で読み合わせる"],
  },
};

/** 下書き: 押したボタンと同じ種類の、空欄つきの見本（「事: 題（種類）」の題から予定表の id を引き、lib/draft-kinds.ts の種類にする） */
function draft(content: Content) {
  const all = textOf(content);
  const head = all.match(/^(?:事|手続き|やる事)[:：]\s*(.+)$/m)?.[1]?.trim() ?? "";
  const title = head.replace(/（[^（）]*）$/, "").trim();
  const def = MILESTONES.find((m) => m.title === title) ?? Object.keys(MONEY).map((k) => paidDef(k)).find((m) => m?.title === title);
  const kind: DraftKind = (def && DRAFTABLE[def.id]) || "記入メモ";
  const s = DRAFT_SAMPLE[kind];
  return {
    kind,
    // 題は末尾の括弧（補いの説明）を外して短く（30字で括弧の途中が切れないように）
    title: `${SAMPLE_MARK}${(title.replace(/（[^（）]*）$/, "").trim() || title || "手続きの下書き").slice(0, 30)}`,
    to: kind === "メール" && def?.kind === "仕事" ? "【会社名】 【上司の名前】様" : s.to,
    body: `${noKey()}\n${s.how}\n\n見本では、出す前に確かめる事だけを並べています。`,
    checklist: s.check,
  };
}

/** 気づき（決まりのきっかけ）: 機械で確かめた事から、予定表の決まりで書く（lib/advisor.ts の ruleAdvice）。読めない時だけ見本の札つき */
function advice(content: Content) {
  const lines = textOf(content).split("\n").map((l) => l.trim());
  // app/api/advisor/_lib/write.ts の「機械で確かめた事:」の段（次の見出しの前まで）
  const at = lines.indexOf("機械で確かめた事:");
  const rest = at < 0 ? [] : lines.slice(at + 1);
  const end = rest.findIndex((l) => /^(文面の相手|文面を送る人|職場（覚えている事）|最近の記録|調べた文章)/.test(l));
  const facts = end < 0 ? rest : rest.slice(0, end);
  const today = lines.find((l) => l.startsWith("今日: "))?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  // パートナーの育休の事は、仕事の無い人には言わない
  const partner = lines.map((l) => l.match(/^- (.+)（パートナー）$/)?.[1]).find(Boolean);
  const works = !!partner && !lines.includes(`- ${partner}の働き方: 仕事なし`);
  const rule = ruleAdvice(facts, { today, partner: works ? partner : undefined });
  if (rule) {
    const note = process.env.ANTHROPIC_API_KEY
      ? "今日の体験で Claude を使える上限に達したので、予定表の決まりだけで書きました。明日はここを Claude が書きます。"
      : "Claude の鍵を入れると、家族の形（働き方・上の子）も見て、ここを Claude が書きます。";
    return { ...rule, why: `${rule.why}${note}` };
  }
  return {
    title: `${SAMPLE_MARK}予定表で分かった事を下に並べました`,
    why: `予定表で分かった事は、下の「機械で確かめた事」に出ています。${noKey()}`,
    plan: ["下の「機械で確かめた事」を家族で見る", "必要なら町の窓口か職場に確かめる"],
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
