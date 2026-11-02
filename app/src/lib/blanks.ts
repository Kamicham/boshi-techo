// 下書きの【 】（空欄）を読み分ける。サーバ（keep・drafts）と画面（DraftPanel）の両方で使う。
// 「そう変わらない物」（会社名・部署・上司・人事・自分の名前・病院）は keep に覚え、次から自動で埋める。
// それ以外（日付・期間・理由など）は、その下書きだけに入れる。

export type BlankKey = "company" | "dept" | "boss" | "email" | "hr" | "hrEmail" | "myName" | "hospital";

export type BlankInput = "text" | "date" | "datetime-local" | "email" | "tel";

export type BlankField = "to" | "title" | "body";

export interface Blank {
  /** 本文に出てくる形（【 】込み） */
  raw: string;
  /** 欄の名前（【 】と末尾の「様」を外した物。名前の無い【 】は、その行の文） */
  label: string;
  /** keep に覚える物なら、その種類 */
  key?: BlankKey;
  input: BlankInput;
  /** 数を入れる欄（「2026年【 】月」の【 】など） */
  numeric?: boolean;
  /** 名前の無い【 】は1つずつ別の欄: どの文の何文字目か（名前のある物は、同じ物を全部まとめて埋める） */
  at?: { field: BlankField; index: number };
}

/** 【 】の中身（と、すぐ前の文）から、覚える種類を決める（覚えない物は undefined） */
export function blankKey(inner: string, before = ""): BlankKey | undefined {
  const s = inner.replace(/\s/g, "");
  if (!s) return undefined;
  const mail = /メール|アドレス|e-?mail/i.test(s);
  // 人事の担当（人）とそのメール。「人事部」だけの欄は、その下書きだけに入れる。「人事担当【担当者名】」も人事
  const hrCtx = /(人事|総務|労務)[^【】\s]{0,3}$/.test(before) && !/上司/.test(s);
  if (/人事|総務|労務/.test(s) || (hrCtx && /担当|名前|様/.test(s))) return mail ? "hrEmail" : /担当|様|名前|さん/.test(s) ? "hr" : undefined;
  if (mail) return /自分|私|わたし|本人|あなた|個人|自宅|私用|連絡先/.test(s) ? undefined : "email";
  if (/電話|番号|住所|所在地/.test(s)) return undefined;
  if (/部署|所属|部課|課名|部名|チーム名|^部$|^課$/.test(s)) return "dept";
  if (/上司|課長|部長|係長|マネージャー|リーダー|ご?担当者/.test(s)) return "boss";
  if (/会社|勤務先|職場|御社|貴社|事業所名|勤め先/.test(s)) return "company";
  if (/病院|産院|クリニック|医院|産婦人科/.test(s) && !/日|時/.test(s)) return "hospital";
  if (/^(自分|私|わたし|あなた|本人|申請者|届出人|差出人|書き手|送り主)?の?(お?名前|氏名|フルネーム|署名)$/.test(s)) return "myName";
  return undefined;
}

/** 入れ方（日付っぽい物は日付の入力） */
export function blankInput(inner: string, key?: BlankKey): BlankInput {
  if (key === "email" || key === "hrEmail" || /メール|アドレス/.test(inner)) return "email";
  if (/電話番号$|^電話$|^内線$/.test(inner.trim())) return "tel";
  if (/日時[\d０-９]*$/.test(inner.trim())) return "datetime-local";
  if (/期間|から|まで|〜|~/.test(inner)) return "text";
  if (/(年月日|日付|日にち|の日|開始日|終了日|予定日|復帰日|期限|日)$/.test(inner.replace(/\s/g, "")) && !/曜日$/.test(inner)) return "date";
  return "text";
}

const TAG = /^(ご?報告|ご?連絡|ご?相談|お知らせ|重要|至急|共有|ご?依頼|お願い|確認|要確認|再送|速報)$/;

const BLANK = /【([^】\n]{0,40})】/g;

/** 名前の無い【 】の欄の名前: その行の文（この空欄を「＿」、ほかの空欄を「…」にして短く） */
function lineLabel(text: string, index: number, len: number): string {
  const start = text.lastIndexOf("\n", index - 1) + 1;
  const endN = text.indexOf("\n", index + len);
  const end = endN < 0 ? text.length : endN;
  const line = `${text.slice(start, index)}＿${text.slice(index + len, end)}`.replace(BLANK, "…").replace(/^[\s■●・※]+/, "").trim();
  // 前の行が見出し（■希望する期間 など）なら添える
  const prev = text.slice(0, Math.max(0, start - 1)).split("\n").pop()?.trim() ?? "";
  const head = /^[■●【]/.test(prev) ? `${prev.replace(/^[■●]\s*/, "")}: ` : "";
  const s = `${head}${line}`;
  return s.length > 40 ? `…${s.slice(Math.max(0, s.indexOf("＿") - 18), s.indexOf("＿") + 18)}…` : s;
}

/** 下書きの宛先・件名・本文から、残った【 】を出てきた順に（名前のある物は同じ物を1つに、名前の無い物は1つずつ） */
/** 「2026年【 】月【 】日」のような、名前の無い空欄で書いた日付（1つの日付の入力にまとめる） */
const SPLIT_DATE = /(\d{4}年)?【\s*】月【\s*】日/g;

export function findBlanks(fields: Record<BlankField, string>): Blank[] {
  const seen = new Set<string>();
  const out: Blank[] = [];
  for (const field of ["to", "title", "body"] as const) {
    const text = fields[field] ?? "";
    const dates = [...text.matchAll(SPLIT_DATE)].map((m) => ({ i: m.index ?? 0, raw: m[0] }));
    const inDate = (i: number) => dates.some((d) => i >= d.i && i < d.i + d.raw.length);
    for (const m of text.matchAll(BLANK)) {
      const inner = m[1].trim();
      const i = m.index ?? 0;
      if (!inner) {
        const d = dates.find((x) => x.i === i || (inDate(i) && x.i <= i && i < x.i + x.raw.length));
        if (d) {
          // 日付の1つ目の【 】の時だけ欄を出す
          if (text.indexOf("【", d.i) === i) out.push({ raw: d.raw, label: lineLabel(text, d.i, d.raw.length), input: "date", at: { field, index: d.i } });
          continue;
        }
        const label = lineLabel(text, i, m[0].length);
        // 「【 】〜【 】」のような期間の端は日付
        const range = /〜\s*$/.test(text.slice(Math.max(0, i - 2), i)) || /^\s*〜/.test(text.slice(i + m[0].length, i + m[0].length + 2));
        out.push({ raw: m[0], label, input: range ? "date" : "text", numeric: /^[年月日時分か]/.test(text.slice(i + m[0].length)), at: { field, index: i } });
        continue;
      }
      // 件名の頭の【ご報告】のような札は空欄ではない
      if (seen.has(m[0]) || TAG.test(inner)) continue;
      seen.add(m[0]);
      const key = blankKey(inner, text.slice(Math.max(0, i - 8), i));
      const label = inner.replace(/様$/, "");
      out.push({ raw: m[0], label: key === "hr" && !/人事|総務|労務/.test(label) ? `人事の${label}` : label, key, input: blankInput(inner, key) });
    }
  }
  return out;
}

/** 欄に入れた値で、文の【 】を埋める（名前のある物は全部、名前の無い物はその1つだけ） */
export function applyBlanks(fields: Record<BlankField, string>, values: { blank: Blank; value: string }[]): Record<BlankField, string> {
  const out = { ...fields };
  // 名前の無い物は、後ろから埋める（前を埋めても位置がずれないように）。位置の文が違えば埋めない
  const pos = values.filter((v) => v.blank.at).sort((a, b) => b.blank.at!.index - a.blank.at!.index);
  for (const { blank, value } of pos) {
    const { field: f, index } = blank.at!;
    if (out[f].slice(index, index + blank.raw.length) !== blank.raw) continue;
    out[f] = out[f].slice(0, index) + value + out[f].slice(index + blank.raw.length);
  }
  for (const { blank, value } of values.filter((v) => !v.blank.at)) {
    for (const f of ["to", "title", "body"] as const) out[f] = out[f].split(blank.raw).join(value);
  }
  return out;
}

/** 日付の入力（2027-01-05 / 2027-01-05T14:00）を、文に入れる形（2027年1月5日 / 1月5日 14:00）に */
export function jpDate(iso: string): string {
  const t = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (t) return `${Number(t[2])}月${Number(t[3])}日 ${Number(t[4])}:${t[5]}`;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日` : iso;
}

/** 呼び名が役割の言葉（ママ・パパなど）なら、手紙の名前には使わない */
export function isRoleWord(name: string): boolean {
  return /^(ママ|パパ|母|父|妻|夫|お?かあさん|お?とうさん|お母さん|お父さん|ばあば|じいじ|祖母|祖父|おばあちゃん|おじいちゃん|わたし|私|自分|本人)$/.test(name.trim());
}

/** 家族の情報で分かる空欄を埋める時に使う家族の形（Family の一部。画面とサーバの両方で使う） */
export interface FamilyForBlanks {
  city: string;
  prefecture: string;
  dueDate: string;
  birthDate?: string;
  childName?: string;
  members: { id: string; name: string; role: string }[];
}

/**
 * 家族の情報で分かる【 】を埋める（町名・都道府県・パートナーや母の名前・赤ちゃんの名前・予定日・生まれた日）。
 * 書き手の名前（【名前】【自分の名前】）は writer があれば入れる。分からない物（呼び名が「パパ」など）は空欄のまま。
 * names は「いつもの」に覚えた手紙の名前（家族の id ごと）。
 */
export function fillFamilyBlanks(text: string, f: FamilyForBlanks, opts: { writer?: string | null; names?: Record<string, string> } = {}): string {
  const nameOf = (role: string) => {
    const p = f.members.find((m) => m.role === role);
    if (!p) return undefined;
    const kept = opts.names?.[p.id];
    return kept || (isRoleWord(p.name) ? undefined : p.name);
  };
  const ymd = (d: string) => jpDate(d);
  return text.replace(/【([^】\n]{1,40})】/g, (m, inner: string) => {
    const s = inner.replace(/\s/g, "").replace(/様$/, "");
    let v: string | undefined;
    if (/^(町名|市区町村名?|市町村名?|お?住まいの(町|市区町村)|住んでいる(町|市区町村)|自治体名?|市名|区名)$/.test(s)) v = f.city;
    else if (/^(都道府県名?|県名)$/.test(s)) v = f.prefecture || undefined;
    else if (/^(パートナー|夫|旦那|配偶者|父親?|パパ)の?(お?名前|氏名)$/.test(s)) v = nameOf("パートナー");
    else if (/^(母親?|妻|ママ|妊婦)の?(お?名前|氏名)$/.test(s)) v = nameOf("母");
    else if (/^(赤ちゃん|子ども|子供|お子さん|お子様|児童)の?(お?名前|呼び名)$/.test(s)) v = f.childName;
    else if (/^(出産)?予定日$/.test(s)) v = ymd(f.dueDate);
    else if (/^(生まれた日|出生日|出産日|誕生日)$/.test(s)) v = f.birthDate ? ymd(f.birthDate) : undefined;
    else if (/^(お?名前|氏名|自分の(お?名前|氏名)|差出人|送り主)$/.test(s)) v = opts.writer ?? undefined;
    return v?.trim() ? v.trim() : m;
  });
}
