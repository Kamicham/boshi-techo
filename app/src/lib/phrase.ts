// 短い1行（札の見出し・行の題・手紙の見出し・写真の一言）を、日本語の文節に近いまとまりに分ける
// （デモの会話が見つけた⑧・2026-11-06）。components/Phrase.tsx が、このまとまりの間でだけ折る。
// 日本語は字と字の間のどこででも折れるので、「ひなた／へ」「見てい／た」「数え直し／ました」のように、
// 名前と助詞の間や語の途中で折れていた。CSS の word-break: keep-all だけでは、空白・句読点・括弧の所でしか
// 折れず（「ママ（美咲）／からの手紙」）、どれも無い長い1行は端で折れる。Chrome の word-break: auto-phrase は
// iPhone の Safari に無い。
// 字の種類だけで分ける（辞書を使わない）ので、サーバと端末で同じに分かれる（描き直しのずれが出ない）。
// 近似: 漢字の間の送り仮名が2字以上の複合の語（「繰り返し行う」の類）は、間で折れる事がある。

/** まとまりの間で折る1行の長さの目安。これより長いまとまりは、中でも折れるようにする（はみ出さない） */
export const PHRASE_MAX = 12;

type Kind = "hira" | "word" | "open" | "close" | "punct" | "space" | "emoji" | "join";

const HIRA = /\p{Script=Hiragana}/u;
const OPEN = /[（「『【〈《［｛〔([{“‘]/u;
const CLOSE = /[）」』】〉》］｝〕)\]}”’]/u;
// 中で分けない括弧（「ママ（美咲）」「（産後2週間）」）。かぎ括弧「」の中は文なので、中でも分ける
const PAREN_OPEN = /[（【〈《［｛〔([{]/u;
const PAREN_CLOSE = /[）】〉》］｝〕)\]}]/u;
// 後ろで折ってよい句読点（「、」「。」「・」など）。ASCII の . , : / - は数と日付の中（5/3・15:00・3.5）なので、字の続きとして扱う
const PUNCT = /[、。，．・！？：；…‥!?]/u;
const EMOJI = /\p{Extended_Pictographic}/u;
const HAN = /\p{Script=Han}/u;
// 漢字の間に1字だけある時に、分ける目印にするひらがな（助詞）。ほかの1字は送り仮名としてつなぐ（数え直す・書き込む・思い出）
const PARTICLE = new Set([..."がをにはでともへやかなよねの"]);
// 前の字にくっつく物（絵文字の異体字セレクタ・ZWJ・肌の色・結合文字・のばす棒・改行しない空白）
const JOIN = /[\uFE0E\uFE0F\u200D\u20E3\u00A0ー\p{Emoji_Modifier}\p{M}]/u;

function kindOf(c: string): Kind {
  if (JOIN.test(c)) return "join";
  if (/\s/.test(c)) return "space";
  if (HIRA.test(c)) return "hira";
  if (OPEN.test(c)) return "open";
  if (CLOSE.test(c)) return "close";
  if (PUNCT.test(c)) return "punct";
  if (EMOJI.test(c)) return "emoji";
  // 漢字・カタカナ・数字・英字と、そのほかの記号（〜・％・→ など）は、語の続き
  return "word";
}

/** 前の字の種類 prev の後、次の字の種類 k の前で、まとまりを分けるか（括弧の外で） */
function breaks(prev: Kind, k: Kind): boolean {
  if (k === "join") return false;
  switch (prev) {
    // 「、」「。」の後で分ける（「。」」のように続く句読点と閉じ括弧はつける）
    case "punct":
      return k !== "punct" && k !== "close";
    // 閉じ括弧の後の助詞はつける（「ママ（美咲）からの」）。語・絵文字・開き括弧が来たら分ける
    case "close":
      return k === "word" || k === "emoji" || k === "open";
    // 助詞・送り仮名の後に、次の語（漢字・カタカナ・数字・英字・絵文字・開き括弧）が来たら分ける（「手紙が／開きました」）
    case "hira":
      return k === "word" || k === "emoji" || k === "open";
    // 漢字・カタカナ・数字の続き（「6月22日」「出生連絡票」）と、その後の送り仮名・助詞はつける。絵文字の前で分ける
    case "word":
      return k === "emoji";
    // 絵文字は次の語につける（「🎙 声を」）。開き括弧の中は分けない
    default:
      return false;
  }
}

/**
 * 短い1行を、文節に近いまとまりに分ける。空白は1つのまとまりとして返す（そこで折れる）。
 * 丸括弧の中では分けない。絵文字の後の空白は、改行しない空白にして次の語とつなぐ。
 * 例: 「💌 ママ（美咲）からの手紙が開きました」→「💌 ママ（美咲）からの」「手紙が」「開きました」
 */
export function phraseChunks(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let prev: Kind | null = null;
  let depth = 0;
  let glue = false;
  const push = () => {
    if (cur) out.push(cur);
    cur = "";
  };
  for (const c of text) {
    const k = kindOf(c);
    if (k === "space" && depth === 0) {
      // 絵文字の後の空白は、次の語とつなぐ（「🎙」だけが行の終わりに残らない）
      if (prev === "emoji" && cur) {
        cur += "\u00A0";
        glue = true;
        continue;
      }
      push();
      if (out.length && /^\s+$/.test(out[out.length - 1])) out[out.length - 1] += c;
      else out.push(c);
      prev = "space";
      continue;
    }
    if (cur && depth === 0 && !glue && prev && prev !== "space" && breaks(prev, k)) {
      const cs = [...cur];
      const last = cs[cs.length - 1];
      const before = cs[cs.length - 2] ?? "";
      if (prev === "hira" && HAN.test(c) && HAN.test(before) && !PARTICLE.has(last)) {
        // 漢字の間の送り仮名1字はつなぐ（「数え直しました」「書き込む」「思い出」）。助詞1字（「手紙が開きました」）の時は分ける
      } else if (prev === "hira" && k === "word" && (last === "お" || last === "ご") && cs.length > 1 && HIRA.test(before)) {
        // 「お」「ご」（お守り・お知らせ・ご家族）は、前のひらがなとではなく、後ろの語とつける
        cur = cs.slice(0, -1).join("");
        push();
        cur = last;
      } else if (!(prev === "hira" && k === "word" && (cur === "お" || cur === "ご"))) {
        push();
      }
    }
    glue = false;
    cur += c;
    if (k === "open" && PAREN_OPEN.test(c)) depth++;
    else if (k === "close" && depth > 0 && PAREN_CLOSE.test(c)) depth--;
    if (k !== "join") prev = k;
  }
  push();
  return out;
}
