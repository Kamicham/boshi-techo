// 橋の床: 急ぎ・心の危機に見える言葉には、Claude の返事より前に、機械で必ず連絡先を出す（ビジョン⑤ 医療は壁でなく橋）。
// 体や心の判断はしない。言葉が含まれていたら案内を出すだけ（出しすぎても害は小さく、出し損ねる方が重い）。
// 出典:
//   - 119・#8000: 厚生労働省「子ども医療電話相談事業（#8000）」（都道府県が行う）https://www.mhlw.go.jp/topics/2006/10/tp1010-3.html
//   - 日本語以外の言葉（URGENT_INTL・CRISIS_INTL）: 在留外国人の多い国籍（出入国在留管理庁「在留外国人統計」2025年6月末:
//     中国・ベトナム・韓国・フィリピン・ネパール・ブラジルの順）の言葉に、英語を足した7つ。日本語の言葉と同じ意味の言葉だけを置く。
//     近似（母語の人にはまだ確かめていない）。出しすぎても害は小さいので、迷う言葉は入れる側に倒す。
//     https://www.moj.go.jp/isa/policies/statistics/toukei_ichiran_touroku.html
//   - こころの健康相談統一ダイヤル 0570-064-556・よりそいホットライン 0120-279-338:
//     厚生労働省「まもろうよ こころ」https://www.mhlw.go.jp/mamorouyokokoro/soudan/tel/ （2026-11 確認）
//   - 児童相談所 相談専用ダイヤル 0120-189-783: こども家庭庁（ConsultAsk.tsx と同じ出典）
//   - 便色カード: 母子健康手帳の便色カードの注意書き（lib/techo.ts の STOOL_NOTE）
// 画面からもサーバからも読む（server-only にしない）。
import { STOOL_NOTE } from "../techo";
import type { AskAction } from "./types";

/** その日のうちに医療機関へ連絡した方がよさそうに見える言葉（capture.ts の urgent と同じ考え方） */
const URGENT =
  /出血|血が出|破水|水っぽいものが|羊水|けいれん|痙攣|ひきつけ|息をしていない|息が(苦し|でき|止ま|おかし)|呼吸が|ぐったり|意識が|反応がない|反応しない|高熱|(3[89]|4[0-2])(\.\d)?\s*(度|℃)|胎動が(少な|減|ない|無い|感じ)|お腹が(張って|痛)|強い痛み|激痛|詰まった|窒息|誤飲|飲み込んだ|やけど|頭を打|落ち(た|て)|顔色が(悪|青)|唇が(紫|青)/;

/** 便色カードの1〜3番に近い色と言った（手帳の注意書きが「1日も早く受診」と言う所） */
const STOOL = /(便|うんち|ウンチ).{0,15}([1-3１-３]\s*番|白っぽ|白い|灰色|灰白|クリーム色|象牙色|薄い黄|淡い黄|黄緑)/;

/** 心の危機に見える言葉（死にたい・手をあげてしまいそう 等） */
const CRISIS = /死にたい|消えたい|自殺|いなくなりたい|生きているのがつらい|生きてるのがつらい|もう限界|手をあげてしまい|叩いてしまい|たたいてしまい|虐待/;

/**
 * 日本語以外で書かれた急ぎの言葉（URGENT と同じ意味の物だけ）。英語・ポルトガル語などの単語は語の頭（\b）で区切る
 * （"heartburn" や "fell asleep" には当てない）。大文字・小文字は問わない。
 */
const URGENT_INTL = new RegExp(
  [
    // 英語
    String.raw`\bbleed(ing|s)?\b`,
    String.raw`\bwaters? (has |have )?(broke|broken)\b`,
    String.raw`\b(seizures?|convuls\w*)`,
    String.raw`\b(not breathing|can'?t breathe|cannot breathe|stopped breathing|(trouble|difficulty|struggling to) breath(e|ing))\b`,
    String.raw`\b(unconscious|unresponsive|not responding|passed out|floppy|limp)\b`,
    String.raw`\bhigh fever\b`,
    String.raw`\b(10[2-6])(\.\d)?\s*°?\s*f\b`,
    String.raw`\b(chok(e|ed|ing)|suffocat\w*)`,
    String.raw`\bswallowed\b`,
    String.raw`\bburn(ed|t|s)?\b`,
    String.raw`\b(hit|bumped|banged) (his|her|their|the|my) head\b|\bhead injury\b`,
    String.raw`\bfell (off|from|down|out)\b`,
    String.raw`\b(lips?|face) (is |are |turning |turned |went )*(blue|purple)\b`,
    String.raw`\b(baby|fetus) (is )?(not moving|moving less)\b|\b(less|fewer|reduced|decreased|no) (fetal |baby )?movements?\b`,
    String.raw`\bsevere (pain|abdominal pain|cramps?|headache)\b`,
    String.raw`\bemergency\b`,
    // ポルトガル語
    String.raw`\bsangr(amento|ando|ar|ou)\b|\ba bolsa (estourou|rompeu)\b`,
    String.raw`\bn[aã]o (est[aá] )?respira(ndo)?\b|\b(falta de ar|dificuldade (para|de) respirar)\b`,
    String.raw`\b(desmaiou|inconsciente|n[aã]o responde)\b|\bfebre alta\b`,
    String.raw`\b(engasg\w*|sufoc\w*|engoliu|queimad\w*|queimou|caiu)\b|\bbateu a cabe[cç]a\b|\bl[aá]bios roxos\b`,
    String.raw`\bbeb[eê] (n[aã]o (se )?mexe|parou de mexer)\b`,
    // フィリピノ語（タガログ語）
    String.raw`\b(dumudugo|nagdurugo|pagdurugo|panubigan|kombulsyon|nangingisay|kinukumbulsyon)\b`,
    String.raw`\b(hindi humihinga|hirap huminga|nahihirapang huminga|walang malay|mataas na lagnat)\b`,
    String.raw`\b(nabulunan|nalunok|napaso|nauntog|nahulog|bumagsak)\b`,
    // ベトナム語（声調の記号が無い書き方も）
    String.raw`ch[aả]y m[aá]u|ra m[aá]u|v[oỡ] [oố]i|co gi[aậ]t|kh[oô]ng th[oở](?=[\s.,!?]|$)|kh[oó] th[oở]|b[aấ]t t[iỉ]nh|s[oố]t cao|h[oó]c d[iị] v[aậ]t|ngh[eẹ]n|nu[oố]t ph[aả]i|b[oỏ]ng|b[iị] ng[aã]|t[eé] ng[aã]|[dđ][aậ]p [dđ][aầ]u|m[oô]i t[ií]m|thai (m[aá]y [ií]t|kh[oô]ng m[aá]y)`,
    // 中国語（簡体・繁体。日本語と同じ字の 出血・破水・羊水・窒息 は URGENT が拾う）
    "流血|抽搐|惊厥|驚厥|不呼吸|没有呼吸|沒有呼吸|呼吸困难|呼吸困難|昏迷|没反应|沒反應|没有反应|沒有反應|高烧|高燒|发高烧|發高燒|噎住|误吞|誤吞|吞下|烫伤|燙傷|烧伤|燒傷|摔下|摔倒|撞到头|撞到頭|嘴唇发紫|嘴唇發紫|胎动减少|胎動減少|胎动少|胎動少|剧痛|劇痛",
    // 韓国語
    "출혈|피가 나|피가 멈추지|양수가 터|경련|발작|숨을 안|숨을 못|숨을 쉬지|호흡곤란|의식이 없|반응이 없|고열|질식|목에 걸|삼켰|화상|머리를 부딪|떨어졌|입술이 파|태동이 줄|태동이 없",
    // ネパール語
    "रगत बग|रगत आ|पानी फुट|बेहोस|सास फेर्न|सास फेरेको छैन|छारे|काम्न थाल|उच्च ज्वरो|धेरै ज्वरो|घाँटीमा अड्क|निल्यो|पोल्यो|जल्यो|लड्यो|खस्यो",
  ].join("|"),
  "i",
);

/** 日本語以外で書かれた心の危機の言葉（CRISIS と同じ意味の物だけ） */
const CRISIS_INTL = new RegExp(
  [
    // 英語
    String.raw`\b(suicid\w*|kill myself|end my life|want to die|wanna die|don'?t want to live|can'?t go on|want to disappear)\b`,
    String.raw`\b(hurt|harm|hit|shake|shook|shaking|slap) (my|the|our) (baby|child|kid|son|daughter)\b|\babuse\b`,
    // ポルトガル語
    String.raw`\b(quero morrer|suic[ií]d\w*|me matar|quero sumir|n[aã]o aguento mais)\b|\bbater n[oa] (meu |minha )?(beb[eê]|filh[oa])\b`,
    // フィリピノ語
    String.raw`\b(magpakamatay|pagpapakamatay|gusto ko nang mamatay|gustong mamatay|ayoko nang mabuhay)\b|\bsaktan ang (anak|baby)\b`,
    // ベトナム語
    String.raw`mu[oố]n ch[eế]t|t[ựu] t[ửu]\b|kh[oô]ng mu[oố]n s[oố]ng|[dđ][aá]nh con`,
    // 中国語
    "想死|不想活|自杀|轻生|輕生|活不下去|打孩子|伤害孩子|傷害孩子",
    // 韓国語
    "죽고 싶|자살|사라지고 싶|살기 싫|아이를 때릴|아기를 때릴|학대",
    // ネパール語
    "मर्न मन|आत्महत्या|बाँच्न मन छैन|बच्चालाई कुट",
  ].join("|"),
  "i",
);

export interface Bridge {
  urgent: boolean;
  crisis: boolean;
  stool: boolean;
  /** 返事の頭に必ず置く1文（Claude の書き方に任せない） */
  lead: string | null;
  /** 返事の先頭に必ず添える動き */
  actions: AskAction[];
  /** Claude に伝える事（返事の頭で連絡先を言わせる） */
  note: string | null;
}

export function bridgeFor(text: string, phase: "pregnant" | "child" | "other"): Bridge {
  const urgent = URGENT.test(text) || URGENT_INTL.test(text);
  const crisis = CRISIS.test(text) || CRISIS_INTL.test(text);
  const stool = phase !== "pregnant" && STOOL.test(text);
  const actions: AskAction[] = [];
  const notes: string[] = [];
  const leads: string[] = [];
  if (urgent) {
    leads.push(phase === "pregnant" ? "今すぐ、かかりつけの産院へ電話してください（夜間も）。迷ったら119。" : "今すぐ電話してください。子どもの事はかかりつけか #8000、ママの体はかかりつけの産院（夜間も）。迷ったら119。");
    actions.push({ type: "open", href: phase === "pregnant" ? "/emergency#mama" : "/emergency", label: "急ぎの時を開く" });
    actions.push({ type: "call", label: "迷ったら119", tel: "119" });
    if (phase !== "pregnant") actions.push({ type: "call", label: "子どもの急な病気の相談 #8000", tel: "#8000" });
    notes.push(
      phase === "pregnant"
        ? "急ぎに見える言葉がある。返事の最初の1文で、かかりつけの産院へ今すぐ電話（夜間も）・迷ったら119 を案内する。体の判断はしない"
        : "急ぎに見える言葉がある。返事の最初の1文で、妊娠中・産後の体ならかかりつけの産院（夜間も）、子どもならかかりつけか #8000、迷ったら119 を案内する。体の判断はしない",
    );
  }
  if (stool && !urgent) {
    leads.push(`母子手帳の便色カードには「${STOOL_NOTE}」と書いてあります。`);
    actions.push({ type: "call", label: "子どもの急な病気の相談 #8000", tel: "#8000" });
    actions.push({ type: "open", href: "/techo#page-stool", label: "便色カードを開く" });
    notes.push("便色カードの1〜3番に近い色と言っている。手帳の注意書き（1日も早く受診）は機械が返事の頭に置く。次の健診まで待つ書き方（健診で聞く）をしない。色の良し悪しは言わない。かかりつけの小児科（生後1か月ごろまでは生まれた産院でもよい）へ電話する事と、番号を選んで記録できる事だけ");
  }
  if (crisis) {
    leads.push("話してくれてありがとう。ひとりで抱えなくていいです。今すぐ、電話の相談先にかけてください。命が危ないと思ったら119。");
    actions.push({ type: "call", label: "こころの健康相談統一ダイヤル", tel: "0570-064-556" });
    actions.push({ type: "call", label: "よりそいホットライン（24時間）", tel: "0120-279-338" });
    if (/手をあげ|叩いて|たたいて|虐待|\b(hurt|harm|hit|shake|shook|shaking|slap|bater)\b|\babuse\b|打孩子|伤害孩子|傷害孩子|때릴|학대|saktan|[dđ][aá]nh con|कुट/i.test(text)) actions.push({ type: "call", label: "児童相談所 相談専用ダイヤル", tel: "0120-189-783" });
    notes.push("心の危機に見える言葉がある。責めず、相談の判断や助言はせず、返事の最初で話してくれた事を受け止め、電話の相談先と町のこども家庭センターを案内する。命の危険がある時は119");
  }
  return { urgent, crisis, stool, lead: leads.length ? leads.join("\n") : null, actions, note: notes.length ? notes.join("\n") : null };
}

/** 電話をかけるリンク（#8000 の # は %23） */
export function telHref(tel: string): string {
  return `tel:${tel.replace(/#/g, "%23").replace(/[^0-9%+]/g, "")}`;
}
