// 橋の床: 急ぎ・心の危機に見える言葉には、Claude の返事より前に、機械で必ず連絡先を出す（ビジョン⑤ 医療は壁でなく橋）。
// 体や心の判断はしない。言葉が含まれていたら案内を出すだけ（出しすぎても害は小さく、出し損ねる方が重い）。
// 出典:
//   - 119・#8000: 厚生労働省「子ども医療電話相談事業（#8000）」（都道府県が行う）https://www.mhlw.go.jp/topics/2006/10/tp1010-3.html
//     言い方は「命が危ないと思ったら、迷わず119」「（子どもの事で）救急車を呼ぶか迷う時は #8000」。「迷ったら119」と書くと、
//     迷う時の相談先（#8000・#7119）より先に119へ向かわせる。119 の例は消防庁の言葉（「呼吸をしていない。息がない。」「呼びかけても、反応がない。」
//     ＝緊急度判定プロトコル Ver.3 救急受診ガイド、「けいれんが止まらない」＝「救急車を上手に使いましょう」令和7年12月）。
//   - DV相談＋ 0120-279-889（電話は24時間・通話料はかからない）と「今すぐ警察官に駆けつけてもらいたいような緊急の場合は、110番に通報してください」:
//     内閣府 男女共同参画局 https://www.gender.go.jp/policy/sokushin/ouen/safe/dv/ ・DV相談＋ https://soudanplus.jp/ （2026-11-05 確認）
//   - 日本語以外の言葉（URGENT_INTL・CRISIS_INTL）: 在留外国人の多い国籍（出入国在留管理庁「在留外国人統計」2025年6月末:
//     中国・ベトナム・韓国・フィリピン・ネパール・ブラジルの順）の言葉に、英語を足した7つ。日本語の言葉と同じ意味の言葉だけを置く。
//     近似（母語の人にはまだ確かめていない）。出しすぎても害は小さいので、迷う言葉は入れる側に倒す。
//     https://www.moj.go.jp/isa/policies/statistics/toukei_ichiran_touroku.html
//   - 中文・English の確度の高い急ぎの言葉（URGENT_SURE_INTL・2026-11-05 作り手の決め事④・形は全体監査と決めた）:
//     こども家庭庁「外国語版の母子健康手帳」R5（https://mchbook.cfa.go.jp/category03/index.php の R5_CN_240301.pdf・R5_EN_240301.pdf。
//     dict/emergency.ts と同じ訳）の、すぐに受診・相談する時の文の言葉と、消防庁「救急車利用マニュアル」中文版の119 の例
//     （https://www.fdma.go.jp/publication/portal/items/portal002_chinese.pdf の 没有呼吸・没有反应・痉挛不止）。言い換えない
//   - こころの健康相談統一ダイヤル 0570-064-556・よりそいホットライン 0120-279-338:
//     厚生労働省「まもろうよ こころ」https://www.mhlw.go.jp/mamorouyokokoro/soudan/tel/ （2026-11 確認）
//   - 児童相談所 相談専用ダイヤル 0120-189-783: こども家庭庁（ConsultAsk.tsx と同じ出典）
//   - 便色カード: 母子健康手帳の便色カードの頁の言葉（lib/techo.ts の STOOL_NOTE。府令様式 p.19 の原文そのまま）。
//     「」の中は手帳の文だけにし、手帳の文でない「迷う時は #8000。」（STOOL_ASIDE）は「」の外に書く（2026-11-05 統括の決め）
//   - #8000 につながらない時: 「#」の入った番号は、電話によっては画面のリンクからかからない事がある。床は家族の県を知らないので番号は書かず、
//     県のふつうの番号が出る急ぎの時の画面（/emergency。表は lib/emergency-lines.ts の N8000）を指す一言だけを添える（2026-11-05 統括の決め）
// 画面からもサーバからも読む（server-only にしない）。
import { currentLang, t } from "../i18n";
import { STOOL_ASIDE, STOOL_NOTE } from "../techo";
import type { AskAction } from "./types";

/** #8000 の後に添える一言（番号は書かない。県の番号は急ぎの時の画面にある） */
export const N8000_ALT_NOTE = "#8000 につながらない時の県の番号は、急ぎの時の画面にあります。";

/**
 * Claude の返事から、機械が頭に置く文（手帳の注意書きの引用）の繰り返しを除く。
 * 引用は数文あるので、まるごとの他に、文ごと（。で切る。頭の『』の枠を外した形・終わりの。が無い形も）に、長い方から除く。
 * 12字より短い切れ端は除かない（ほかの文を壊さない）。
 * 除いた後に残る「」（空の引用）を含む文と、「便色カードにはこう書いてあります」の前置きも除く。
 */
export function stripLeadRepeats(reply: string, lead: string | null): string {
  if (!lead) return reply;
  let out = reply;
  for (const line of lead.split("\n")) {
    const core = line.match(/「(.+)」/)?.[1];
    if (!core) continue;
    const forms = [core, ...core.split(/(?<=。)/).map((s) => s.trim())].flatMap((s) => {
      const bare = s.replace(/^(『[^』]*』)+/, "");
      return [s, bare, s.replace(/。$/, ""), bare.replace(/。$/, "")];
    });
    const parts = [...new Set(forms)].filter((s) => s.length >= 12).sort((a, b) => b.length - a.length);
    for (const p of parts) out = out.split(p).join("");
  }
  return out.replace(/[^。\n]*「[\s、。]*」[^。\n]*。?/g, "").replace(/(母子手帳の)?便色カードには、?(こう)?書いてあります。?/g, "");
}

/**
 * 確度の高い急ぎの言葉（2026-11-05 監査 llm-2）。聞くの床（URGENT）の芯で、話す・撮るの床（lib/capture.ts）と、
 * 鍵の無い時の見本の答えの急ぎの印（lib/samples.ts）は、この表だけを使う（表を二重に持たない）。
 * 話す・撮るは日々の記録なので、聞くより狭くする: 記録が急ぎになると、次の健診の「先生に聞く事」に並ばなくなる
 * （「落ちた」「お腹が張って」「飲み込んだ」「38度」まで含む聞くの表をそのまま当てると、急ぎでない気がかりが聞く事から外れる）。
 * 選んだ言葉: 話す・撮るの指示（CAPTURE_SYSTEM）が急ぎの例に挙げる言葉（出血・破水・胎動が少ない・強い痛み・水も飲めない・
 * 子どもの高熱やぐったり）と、上の出典の119 の例（けいれん・息をしていない・反応がない）に当たる言葉、唇の色・窒息・誤飲。
 * 打ち消し・もしもの言い方・よくある軽い所（歯ぐき・鼻の出血、足のつり、産後の悪露・生理が戻った時の出血）は sureUrgent が外す。
 */
export const URGENT_SURE = new RegExp(
  [
    // 「血がたくさん出た」「血がでてる」（かな書き）「血が止まらない」も（2026-11-05 監査。どの表にも当たっていなかった）
    "出血|血が出|血が(たくさん|いっぱい|大量に|どんどん|だらだら|ぽたぽた|少し|ちょっと)(出|で)|血がで(た|て|る|ま|ちゃ)|血が止まらな(い|く|かっ)|血が止まらず|破水",
    "けいれん|痙攣|ひきつけ|引きつけ",
    "息をしていない|息をしてない|(息|呼吸)が(でき|止ま)|(息|呼吸)が苦しそう",
    "意識が(ない|無い|なく|なかっ|おかし|もうろう|朦朧)|呼びかけても反応(が|し)?(ない|無い|なかっ|せず)",
    "唇が(紫|青)|窒息|誤飲|(喉|のど)に詰ま|(電池|磁石|たばこ|タバコ|煙草|洗剤|おもちゃ|ビー玉|硬貨|コイン|小銭)を(飲み込|飲んで?しま|飲んじゃ)",
    "胎動(が|を)?(少な|減|ない|無い|なくな|止ま|弱|感じない|感じられない|感じなくな)",
    "強い痛み|激痛|激しい痛み|激しく痛",
    "水も飲めない|水分も?(取|と)れない",
    "高熱|(39|4[0-2])(\\.\\d)?\\s*(度|℃)の熱|(熱|体温)が\\s*(39|4[0-2])(\\.\\d)?\\s*(度|℃)",
    "(赤ちゃん|あかちゃん|子ども|子供|こども|息子|娘|この子|ベビー)(が|は|も)?ぐったり|熱[^。\\n]{0,12}ぐったり|ぐったり[^。\\n]{0,12}熱",
  ].join("|"),
);

/**
 * 確度の高い急ぎの言葉の中文（简体・繁体）と English（2026-11-05 作り手の決め事④。形は全体監査と決めた）。日本語の URGENT_SURE と同じ意味の物だけ。
 * 話す・撮るの床（sureUrgent）と、見本の答えの急ぎの印もこの表を見る。聞くの床の URGENT_INTL は、この表に広めの言葉を足した物
 * （日本語の URGENT＝URGENT_SURE＋広め と同じ形。表を二重に持たない）。
 * - 出血・破水・胎動の減少・胎動を感じない・つわりで衰弱がひどい: 外国語版の母子健康手帳 R5 の訳の言葉
 *   （流血・羊水破／bleeding・water breaking、胎动减少・感觉不到胎动／fewer movements・no longer feel the baby movements、极度虚弱）。
 *   见红・spotting は、妊娠中の少しの出血の日常の言い方（日本語の表は「出血が少し」も数える）
 * - 息をしていない・反応が無い・けいれん: 消防庁の119 の例の中文（没有呼吸・没有反应・痉挛不止）と English（not breathing・not responding・seizures）
 * - 意識・唇の色・のどに詰まる・誤飲・強い痛み・水も飲めない・高熱・子どものぐったり: 日本語の表と同じ意味の言葉
 *   （のどに詰まった＝喉咙卡住了・ぐったり＝瘫软・強い痛み＝剧烈疼痛 は dict/emergency.ts の訳）
 * 「出血」「破水」「痙攣」「窒息」「高熱」は日本語と同じ字なので、日本語の表が拾う（中文の打ち消し・軽い所は、sureUrgent が両方の表に当てる）。
 * 没有呼吸・叫不醒・not breathing・won't wake のように、打ち消しの形そのものが急ぎの言葉もある（打ち消しで外すのは出来事の語だけ）。
 * ほかの5つの言葉は聞くの床（URGENT_INTL）だけ（画面の言葉は日本語・中文・English の3つ）。英字は \b で区切る。近似（母語の人にはまだ確かめていない）。
 */
export const URGENT_SURE_INTL = new RegExp(
  [
    // 中文: 出血・破水（R5）
    // 「血止不住」「流了很多血」も（出血・流血の字が続かない言い方。2026-11-05 監査。血压・血糖などの言葉には当てない）
    "流血|见红|見紅|羊水破|血止不住|止不住血|血流不止|止不了血|血止不了|(流|出)了(很多|好多|不少|大量的?|一些|一点|一點|点|點)?血(?!压|壓|糖|型|管|液|清|检|檢|常规|常規|统|統|小板|红|紅)",
    // けいれん（脚がつる「抽筋」は入れない）
    "痉挛|抽搐|抽风|抽風|惊厥|驚厥",
    // 息をしていない・息ができない
    "没有呼吸|沒有呼吸|没呼吸|沒呼吸|不呼吸|停止呼吸|呼吸停止|不能呼吸|无法呼吸|無法呼吸|呼吸困难|呼吸困難|喘不上气|喘不上氣|喘不过气|喘不過氣",
    // 反応が無い・意識が無い
    "没有反应|沒有反應|没反应|沒反應|叫不醒|没有意识|沒有意識|失去意识|失去意識|意识不清|意識不清|昏迷|昏过去|昏過去|晕过去|暈過去",
    // 唇の色・のどに詰まる・誤飲
    "嘴唇[^。！？\\n，,]{0,3}(紫|发青|發青|变青|變青)|噎住|喉咙卡住|喉嚨卡住|卡在喉咙|卡在喉嚨|误吞|誤吞|误食|誤食",
    "(吞|吃)(了|下了?)(一个|一個|一颗|一顆|一块|一塊|一枚|个|個|颗|顆)?(纽扣电池|鈕扣電池|电池|電池|磁铁|磁鐵|香烟|香菸|烟头|菸頭|洗涤剂|洗滌劑|洗衣液|洗衣凝珠|玩具|弹珠|彈珠|硬币|硬幣)",
    // 胎動の減少・胎動を感じない（R5）
    "胎(动|動)(明显|明顯)?(减少|減少|变少|變少|变弱|變弱|少了|很少|太少|停止|停了|消失|没了|沒了)|胎(动|動)(突然)?感(觉|覺)不到|感(觉|覺)不到(胎(动|動)|宝宝(在)?动|寶寶(在)?動)|没有胎动|沒有胎動",
    // 強い痛み・水も飲めない（R5「因妊娠反应而变得极度虚弱」）
    "剧痛|劇痛|剧烈(的)?(疼痛|腹痛|头痛)|劇烈(的)?(疼痛|腹痛|頭痛)|(疼|痛)得(厉害|厲害|受不了)",
    "水都喝不|连水也喝不|連水也喝不|喝不下水|极度虚弱|極度虛弱",
    // 高熱（39度から。日本語の表と同じ境。「高热量」は数えない）
    "高烧|高燒|高热(?!量)|(发烧|發燒|发热|發熱|烧到|燒到|体温|體溫)[^。！？\\n，,]{0,4}(39|4[0-2])(\\.\\d)?\\s*(度|℃)",
    // 子どもがぐったり
    "(宝宝|寶寶|孩子|小孩|婴儿|嬰兒|儿子|兒子|女儿|女兒)[^。！？\\n，,]{0,4}(瘫软|癱軟|软绵绵|軟綿綿)",
    // English: 出血・破水（R5: bleeding・your water breaking）
    String.raw`\bbleed(ing|s)?\b|\bbled\b|\bspotting\b`,
    // 「a lot of blood」「blood won't stop」も（bleeding の語が無い言い方。2026-11-05 監査。blood test・blood pressure などには当てない）
    String.raw`\b(lots of|a lot of|so much|too much) blood\b(?! (work|tests?|pressure|sugar|type|draws?|panel|count))|\bblood (everywhere|won'?t stop|keeps (coming|pouring))\b`,
    String.raw`\bwaters?('s)? (is |are |has |have |had |just |already |may have |might have )*(broke|broken|breaking)\b`,
    // けいれん・息・反応（119 の例: seizures・not breathing・not responding）
    String.raw`\b(seizures?|seizing|convuls\w*)`,
    String.raw`\b(not breathing|isn'?t breathing|stopped breathing|can'?t breathe|cannot breathe|can not breathe|unable to breathe|(trouble|difficulty|struggling to) breath(e|ing))\b`,
    String.raw`\b(unconscious|unresponsive|not responding|isn'?t responding|won'?t respond|doesn'?t respond|passed out|won'?t wake( up)?|not waking( up)?|can'?t wake (him|her|them|the baby|my baby|my son|my daughter)( up)?)\b`,
    // 唇の色・のどに詰まる・誤飲（"choked up"＝胸がいっぱい は数えない）
    String.raw`\b(blue|purple) lips\b|\blips? (is |are |turning |turned |went |look |looks |looking |seem |seems |a bit |a little |slightly |very )*(blue|purple)\b|\b(turning|turned|went|gone|going) (blue|purple)\b`,
    String.raw`\b(chok(e|es|ed|ing)\b(?! up\b)|suffocat\w*)`,
    String.raw`\b(swallowed|ate) (a |an |the |some |two |my |his |her |their )?(button |small )?(batter(y|ies)|magnets?|coins?|detergent|laundry (pod|capsule)s?|cigarettes?|cigarette butts?|tobacco|marbles?|toys?|toy parts?)\b`,
    // 胎動の減少・胎動を感じない（R5: fewer movements from your baby・no longer feel the baby movements）
    String.raw`\b(baby|fetus) (is |has )?(not moving|stopped moving|moving less|moved less|moves less|isn'?t moving|hasn'?t (been )?mov(ed|ing)|has not (been )?mov(ed|ing)|didn'?t move)\b|\b(less|fewer|reduced|decreased|no) (fetal |baby |baby'?s )?(movements?|kicks)\b|\b(movements?|kicks) (have |has )?(decreased|slowed( down)?|stopped|reduced)\b|\b(can'?t|cannot|no longer|don'?t|didn'?t) feel (the |my )?baby('?s)? (move|moving|movements?|kick|kicking|kicks)\b`,
    // 強い痛み・水も飲めない・高熱（39度から）・子どものぐったり
    String.raw`\bsevere (pain|abdominal pain|stomach pain|belly pain|cramps?|cramping|headache)\b|\b(intense|excruciating|unbearable) pain\b`,
    String.raw`\b(can'?t|cannot|unable to) (even )?(keep (any )?(water|fluids|liquids|anything) down|drink (any )?water)\b`,
    String.raw`\bhigh fever\b|\bfever (of |is |was |at |reached |hit |went up to |up to )?(39|4[0-2])(\.\d)?\b|\b(39|4[0-2])(\.\d)?\s*(°\s*c|℃|degrees?( c| celsius)?) fever\b|\b10[3-6](\.\d)?\s*°?\s*f\b`,
    String.raw`\b(baby|child|kid|son|daughter|toddler) (is |was |seems |looks |went |has gone |became |feels )?(very )?(limp|floppy)\b`,
  ].join("|"),
  "i",
);

/**
 * 続く言葉が打ち消し・もしもの言い方・書き写した値なら数えない
 * （「出血はない」「破水したら電話」「誤飲しないように」「出血量は500ml」。「出血量が多い」は数える）
 */
const NOT_NOW =
  /^(は|が|も)?(ない|無い|なかった|無かった|なし|無し|ありません|ありませんでした|ではな|じゃな|しない|しなかった|していない|してない|せず|したら|すれば|があったら|があれば|の時は|のときは|時は|ときは)|^(に|を)?(注意|気をつけ|気を付け|防止|予防|対策)|^量(は|:|：|\s*\d)/;
/** よくある軽い出血の所（歯ぐき・歯みがき・鼻）。話す・撮るの床では数えない（ふつうの気がかりとして健診で聞く事へ） */
const MILD_BLEED = /(歯ぐき|歯茎|はぐき|歯肉|歯みがき|歯磨き|鼻)(から|が|の|で|の時に?)?$/;
/** 足のつり（こむら返り）・まぶたのぴくつき。「手足が」は数える */
const MILD_TWITCH = /(?<!手)(足|あし|ふくらはぎ|太もも|まぶた|瞼|目の下)(が|の)?$/;
/**
 * 産後の悪露・生理が戻った時の出血（ふつうにある物）。同じ文に量が多い・塊・止まらないがあれば数える。
 * 「生理のような出血」（妊娠中の出血の言い方）は数える
 */
const ROUTINE_BLEED = /悪露|生理が(来|き|再開|始ま|戻)|生理(中|の日)/;
const HEAVY_BLEED = /多い|多く|多め|増え|止まらな|止まらず|塊|かたまり|レバー|急に|突然|真っ赤|まっか|鮮血|鮮やか|鮮紅|大量/;
/**
 * 歯ぐき・鼻の出血でも数える時（2026-11-05 監査。中文・English の OTHER_SITE と同じ考え方）: 同じ文にほかの所（口・耳・目・頭・便・おしっこ・性器）や
 * 熱がある（「口と鼻から血が出た」）、止まらない・大量（「鼻から血が出て止まらない」）
 */
const BLEED_NOT_MILD = /(口|耳|目|頭)(から|と|や|も|の中から)|便|うんち|おしっこ|尿|性器|膣|陰部|下から|熱|止まらな|止まらず|大量/;
/**
 * 足・まぶたのけいれんでも数える時（2026-11-05 監査。中文の WHOLE_BODY と同じ考え方）: 同じ文に手・全身・白目・熱・意識がある
 * （「手と足がけいれん」「熱があって足がけいれん」）、子どもの足・まぶた（「赤ちゃんの足がけいれん」。赤ちゃんは手足やまぶただけのけいれんもある）
 */
const TWITCH_NOT_MILD =
  /手(と|も|が|や|足)|両手|腕|全身|白目|熱|意識|(赤ちゃん|あかちゃん|子ども|子供|こども|息子|娘|この子|ベビー)の(足|あし|ふくらはぎ|太もも|まぶた|瞼|目の下)/;
/** at を含む1文（。と改行で切る） */
function sentenceAt(text: string, at: number): string {
  const start = Math.max(text.lastIndexOf("。", at), text.lastIndexOf("\n", at)) + 1;
  const ends = [text.indexOf("。", at), text.indexOf("\n", at)].filter((i) => i >= 0);
  return text.slice(start, ends.length ? Math.min(...ends) : text.length);
}

/**
 * iPhone などが打つまるいアポストロフィ（’ ‘ ʼ）と全角の＇を ' にそろえる。英語の表は can't・don't の形で書いてあり、
 * iPhone の打ち方（スマート句読点）の "can’t breathe"・"don’t want to live" に当たっていなかった（2026-11-05 監査）。
 * 1字を1字に替えるだけなので、当たった所の位置は変わらない
 */
const plainQuotes = (s: string) => s.replace(/[‘’ʼ＇]/g, "'");

// ── 中文・English の「数えない」（話す・撮るの床だけ。聞くの床は広いまま）──
// 日本語の NOT_NOW・MILD_BLEED・ROUTINE_BLEED・MILD_TWITCH と同じ考え方を、中文・English の書き方に当てる。
// 打ち消し・もしもで外すのは出来事の語だけ（全体監査 11/5: 没有呼吸・叫不醒・not breathing・won't wake のように、
// 急ぎの言葉そのものが打ち消しの形なので、まとめて外すと一番急ぐ物が消える）。見るのは同じ句の直前の短い所だけ。

/** ひらがな・カタカナ（日本語の文には、中文・English の見分けを当てない＝日本語の床は前のまま） */
const KANA = /[\u3040-\u30ff]/;
/** 句の区切り（打ち消し・軽い所は同じ句の中だけを見る） */
const CLAUSE_STOP = /[。！？!?\n；;，,、]|\.(?=\s|$)/g;
/** 文の区切り（産後の悪露・生理の見分けは1文を見る） */
const SENTENCE_STOP = /[。！？!?\n]|\.(?=\s|$)/g;

/** at から len 字の言葉の、同じ句の前の所（30字まで）と後の所（30字まで） */
function clauseAround(text: string, at: number, len: number): { before: string; after: string } {
  const head = text.slice(Math.max(0, at - 30), at);
  let cut = 0;
  for (const m of head.matchAll(CLAUSE_STOP)) cut = m.index + m[0].length;
  const tail = text.slice(at + len, at + len + 30);
  const end = [...tail.matchAll(CLAUSE_STOP)][0]?.index ?? tail.length;
  return { before: head.slice(cut), after: tail.slice(0, end) };
}

/** at を含む1文（中文・English） */
function sentenceIntl(text: string, at: number): string {
  let start = 0;
  let end = text.length;
  for (const m of text.matchAll(SENTENCE_STOP)) {
    if (m.index < at) start = m.index + m[0].length;
    else {
      end = m.index;
      break;
    }
  }
  return text.slice(start, end);
}

/** 出来事の語（打ち消し・もしもで外すのは、この語だけ） */
const EVENT_WORD = /^(出血|流血|见红|見紅|破水|羊水破|痙攣|痉挛|抽搐|抽风|抽風|惊厥|驚厥|bleed|bled|spotting|seiz|convuls)/i;
const BLEED_WORD = /^(出血|流血|见红|見紅|血止|止不住血|血流不止|止不了血|(流|出)了|bleed|bled|spotting|(lots of|a lot of|so much|too much) blood|blood )/i;
const TWITCH_WORD = /^(痙攣|痉挛|抽搐|抽风|抽風|惊厥|驚厥)/;
/** 出来事の語のすぐ前の、中文の打ち消し・もしも（没有出血・未见出血・如果有出血・万一破水） */
const NOT_NOW_ZH = /(没有|沒有|没|沒|无|無|未|如果|万一|萬一|要是|假如)(有|再|又|任何|明显|明顯|见|見|看到|发现|發現|发生|發生|出现|出現|过|過)*$/;
/** 出来事の語のすぐ前の、English の打ち消し・もしも（no bleeding・hasn't had any bleeding・if there is bleeding）。間に入れてよい語を決めておく（"won't stop bleeding" は数える） */
const NOT_NOW_EN =
  /\b(no|not|without|never|isn'?t|wasn'?t|hasn'?t|haven'?t|hadn'?t|didn'?t|doesn'?t|don'?t|if|in case( of)?)\b(\s+(any|a|an|the|more|signs?|of|there|there'?s|is|was|are|were|has|had|have|been|be|see|seen|saw|notice|noticed|experienced|having|get|got))*\s*$/i;
/** よくある軽い出血の所（日本語の MILD_BLEED と同じ。牙龈・刷牙・鼻／gums・nose）。English は言葉のすぐ前後だけを見る */
const MILD_BLEED_ZH = /(牙龈|牙齦|牙床|刷牙|鼻子|鼻腔|鼻)[^。！？\n，,；;]{0,6}$/;
const MILD_BLEED_EN_BEFORE = /\b(gums?|nose|nostrils?)( (is|are|keeps?|kept|started|was|were))?( still)?\s*$/i;
const MILD_BLEED_EN_AFTER = /^\s*(gums?\b|from (the |his |her |my |their |a )?(gums?|nose|nostrils?)\b|(when|while|after) (i |he |she )?(brush|floss))/i;
/** 同じ文にほかの所（口・耳・頭・便・下）や熱があれば、軽い所の見分けを当てない（「嘴和鼻子出血」「bleeding from the mouth and nose」は数える） */
const OTHER_SITE = /嘴|口|耳|头|頭|眼睛|大便|便血|尿|阴道|陰道|下面|下体|下體|发烧|發燒|发热|發熱|\b(mouth|ears?|head|eyes?|stool|poop|diaper|nappy|vagina|vaginal|down there|urine|pee|fever)\b/i;
/** 産後の悪露・生理が戻った時の出血（日本語の ROUTINE_BLEED と同じ）。量が多い・塊・止まらない・急に鮮紅色は数える。「像来月经一样」（妊娠中の出血の言い方）も数える */
const ROUTINE_BLEED_INTL = /恶露|惡露|(来|來)了?(月经|月經|例假)|(月经|月經|例假)(又|已经|已經)?(来|來|恢复|恢復)|大姨(妈|媽)(来|來)|\blochia\b|\bperiod (came|started|is back|came back|returned|has returned|has come back)\b/i;
const HEAVY_BLEED_INTL =
  /很多|好多|太多|增多|变多|變多|量多|量大|止不住|不止|停不下|血块|血塊|鲜红|鮮紅|突然|\bheavy\b|\ba lot\b|\blots\b|\bmore\b|increas\w*|won'?t stop|not stopping|\bclots?\b|soak\w*|\bbright red\b|\bsudden(ly)?\b/i;
const LIKE = /像|一样|一樣|似的|\blike\b/i;
/**
 * 止まらない・多い出血は、軽い所（牙龈・鼻／gums・nose）でも数える（「宝宝鼻子流血止不住」「my baby's nose won't stop bleeding」。日本語の BLEED_NOT_MILD と同じ。
 * 2026-11-05 監査）。「很多」だけでは数えない（「很多孕妇都这样」の「多くの」）
 */
const WONT_STOP_INTL =
  /止不住|不止|停不下|止不了|大量|很多血|好多血|(出血|流血)(很多|好多|量大|量很大)|\bwon'?t stop\b|\bnot stopping\b|\b(hasn'?t|has not|haven'?t|doesn'?t|does not|didn'?t|can'?t|cannot) stop(ped)?\b|\b(a lot|lots|heavily|heavy)\b/i;
/** 子どもの腿・眼皮の抽搐は数える（「宝宝的腿在抽搐」。日本語の「赤ちゃんの足がけいれん」と同じ。2026-11-05 監査） */
const CHILD_LEG_ZH = /(宝宝|寶寶|孩子|小孩|婴儿|嬰兒|儿子|兒子|女儿|女兒)(的)?(眼皮|眼睑|眼瞼|小腿|大腿|腿|脚|腳)/;
/** 腿・眼皮の抽搐（日本語の MILD_TWITCH と同じ。「手脚」は数える）。同じ文に手・全身・四肢・熱があれば当てない（「手和腿在抽搐」「发烧，腿在抽搐」は数える） */
const MILD_TWITCH_ZH = /(?<!手)(眼皮|眼睑|眼瞼|小腿|大腿|腿|脚|腳)[^。！？\n，,；;]{0,3}$/;
const WHOLE_BODY = /手(?![机機术術续續册冊帐帳表套写寫工艺藝势勢段法])|全身|四肢|身体|身體|浑身|渾身|胳膊|翻白眼|发烧|發燒|发热|發熱/;
/** 誤飲・窒息を防ぐ話（日本語の NOT_NOW の「防止・予防・対策」と同じ。「不小心」＝うっかり・「没能防止」＝防げなかった は数える） */
const PREVENT_BEFORE =
  /(?<!没能|沒能|没有|沒有|未能|无法|無法|不能)(防止|预防|預防|避免|以免)[^。！？\n，,；;]{0,4}$|\b(prevent|preventing|prevention of|avoid|avoiding|risk of)\s*$/i;
const PREVENT_AFTER = /^(的危险|的危險|的风险|的風險)|^\s*(hazards?|risks?|prevention)\b/i;

/** 中文・English の打ち消し・もしも・軽い所・防ぐ話なら true（数えない） */
function notNowIntl(text: string, at: number, word: string): boolean {
  const { before, after } = clauseAround(text, at, word.length);
  if (PREVENT_BEFORE.test(before) || PREVENT_AFTER.test(after)) return true;
  if (EVENT_WORD.test(word) && (NOT_NOW_ZH.test(before) || NOT_NOW_EN.test(before) || /^(的话|的話)/.test(after))) return true;
  const s = sentenceIntl(text, at);
  if (BLEED_WORD.test(word)) {
    if (!OTHER_SITE.test(s) && !WONT_STOP_INTL.test(s) && (MILD_BLEED_ZH.test(before) || MILD_BLEED_EN_BEFORE.test(before) || MILD_BLEED_EN_AFTER.test(after))) return true;
    if (ROUTINE_BLEED_INTL.test(s) && !LIKE.test(s) && !HEAVY_BLEED_INTL.test(s)) return true;
  }
  return TWITCH_WORD.test(word) && MILD_TWITCH_ZH.test(before) && !WHOLE_BODY.test(s) && !CHILD_LEG_ZH.test(s);
}

/**
 * 話す・撮るの床: 確度の高い急ぎの言葉（日本語の URGENT_SURE と、中文・English の URGENT_SURE_INTL）が、
 * 打ち消し・もしも・軽い所でない形で入っているか。体の判断ではない（当たったら、連絡先の案内を付けるだけ）。
 */
export function sureUrgent(raw: string): boolean {
  const text = plainQuotes(raw);
  for (const m of text.matchAll(new RegExp(URGENT_SURE.source, "g"))) {
    const before = text.slice(Math.max(0, m.index - 8), m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 10);
    if (NOT_NOW.test(after)) continue;
    if (/^(出血|血が)/.test(m[0])) {
      const s = sentenceAt(text, m.index);
      if (MILD_BLEED.test(before) && !BLEED_NOT_MILD.test(s)) continue;
      if (ROUTINE_BLEED.test(s) && !HEAVY_BLEED.test(s)) continue;
    }
    if (/^(けいれん|痙攣|ひきつけ|引きつけ)/.test(m[0]) && MILD_TWITCH.test(before) && !TWITCH_NOT_MILD.test(sentenceAt(text, m.index))) continue;
    // 中文で書いた 出血・破水・痙攣・窒息・高熱（日本語と同じ字）: 句にかなが無い時だけ、中文の打ち消し・軽い所を当てる
    const around = clauseAround(text, m.index, m[0].length);
    if (!KANA.test(around.before + around.after) && notNowIntl(text, m.index, m[0])) continue;
    return true;
  }
  for (const m of text.matchAll(new RegExp(URGENT_SURE_INTL.source, "gi"))) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 10);
    if (NOT_NOW.test(after) || notNowIntl(text, m.index, m[0])) continue;
    return true;
  }
  return false;
}

/**
 * その日のうちに医療機関へ連絡した方がよさそうに見える言葉（聞くの床）。確度の高い言葉（URGENT_SURE）に、聞く時だけ使う広めの言葉を足した表
 * （出しすぎても害は小さい。話す・撮るの床は URGENT_SURE だけ）
 */
const URGENT = new RegExp(
  `${URGENT_SURE.source}|水っぽいものが|羊水|息が(苦し|おかし)|呼吸が|ぐったり|意識が|反応がない|反応しない|(3[89]|4[0-2])(\\.\\d)?\\s*(度|℃)|胎動が感じ|お腹が(張って|痛)|詰まった|飲み込んだ|やけど|頭を打|落ち(た|て)|顔色が(悪|青)`,
);

/** 文をつなぐ（English は空きを入れる。日本語・中文はそのまま続ける） */
const cat = (...parts: string[]) => parts.join(currentLang() === "en" ? " " : "");

/**
 * 急ぎの時に返事の頭へ置く1文（聞く・話す・撮るで同じ連絡先）。
 * 今の言葉で返す（サーバは頼みの言葉の withLang の中で呼ぶ＝lib/ask/agent.ts。ほかのサーバの道はいつも日本語。訳は意味を変えない＝dict/answers.ts）
 */
export function urgentLead(phase: "pregnant" | "child" | "other"): string {
  return phase === "pregnant"
    ? t("今すぐ、かかりつけの産院へ電話してください（夜間も）。命が危ないと思ったら、迷わず119。")
    : cat(t("今すぐ電話してください。命が危ないと思ったら、迷わず119。救急車を呼ぶか迷う時は、子どもの事はかかりつけか #8000、ママの体はかかりつけの産院へ（夜間も）。"), t(N8000_ALT_NOTE));
}

/** 便色カードの1〜3番に近い色と言った（手帳の注意書きが「1日も早く受診」と言う所） */
const STOOL = /(便|うんち|ウンチ).{0,15}([1-3１-３]\s*番|白っぽ|白い|灰色|灰白|クリーム色|象牙色|薄い黄|淡い黄|黄緑)/;

/**
 * 赤ちゃんを揺さぶってしまいそう・揺さぶってしまった（こども家庭庁「赤ちゃんが泣きやまない」: 無理に泣きやませようと激しく揺さぶらないでください）。
 * 「揺さぶられ症候群が心配」「揺さぶったらどうなる？」のような問いには当てない。
 */
const SHAKE = /(揺|ゆ)さぶ(って(しま|ちゃ)|っちゃ|りそう|りたく|った(?!ら))/;

/**
 * 心の危機に見える言葉（死にたい・手をあげてしまいそう 等）。
 * 「死にたくなる」は拾い、「（お産で）死にたくない」は拾わない。「消えてしまいたい」「もう無理」も拾う（出しすぎても害は小さい）。
 */
const CRISIS = new RegExp(
  [
    "死にたい|死にたく(?!ない)|消えたい|消えてしまいたい|自殺|いなくなりたい|生きているのがつらい|生きてるのがつらい|もう限界|もう無理",
    "手をあげてしまい|叩いてしまい|たたいてしまい|虐待",
    SHAKE.source,
  ].join("|"),
);

/**
 * 暴力を受けている言葉（DV の相談先も出す）。「お腹を蹴られる（胎動）」「2歳の子に叩かれる」には当てないよう、
 * 蹴る・叩くは大人の相手（夫・パートナーなど）がいる時だけ拾う。
 */
const PARTNER = "(夫|妻|彼|彼氏|彼女|パートナー|旦那|主人|相手)";
const VIOLENCE = new RegExp(
  [
    "殴られ|なぐられ|首を(絞|締|し)め|突き飛ばされ|暴力を(受け|振るわれ|ふるわれ)|ＤＶ|\\bDV\\b",
    `${PARTNER}(に|から)(蹴られ|けられ|叩かれ|たたかれ)|${PARTNER}(からの|から|の)暴力`,
    String.raw`\bdomestic violence\b|\b(husband|wife|partner|boyfriend|girlfriend) (hits|hit|beats|beat|kicks|kicked|chokes|choked|strangled) me\b`,
  ].join("|"),
  "i",
);

/** 子に手をあげてしまいそうな言葉（児童相談所 相談専用ダイヤルも出す） */
const CHILD_HARM =
  /手をあげ|叩いて|たたいて|虐待|\b(hurt|harm|hit|shake|shook|shaking|slap|bater)\b|\babuse\b|打孩子|伤害孩子|傷害孩子|때릴|학대|saktan|[dđ][aá]nh con|कुट/i;

/**
 * 日本語以外で書かれた急ぎの言葉（聞くの床。URGENT と同じ意味の物だけ）。確度の高い中文・English（URGENT_SURE_INTL）に、
 * 聞く時だけ使う広めの言葉と、ほかの5つの言葉を足した表（日本語の URGENT＝URGENT_SURE＋広め と同じ形）。
 * 英語・ポルトガル語などの単語は語の頭（\b）で区切る（"heartburn" や "fell asleep" には当てない）。大文字・小文字は問わない。
 */
const URGENT_INTL = new RegExp(
  [
    URGENT_SURE_INTL.source,
    // 英語（広め）
    String.raw`\b(floppy|limp)\b`,
    String.raw`\b(10[2-6])(\.\d)?\s*°?\s*f\b|\b(3[89]|4[0-2])(\.\d)?\s*(°\s*c\b|℃|degrees\b)|\b(temp|temperature) (of |is |was |at |reached |hit )?(3[89]|4[0-2])(\.\d)?\b`,
    String.raw`\bswallowed\b`,
    String.raw`\bburn(ed|t|s)?\b`,
    String.raw`\b(hit|bumped|banged) (his|her|their|the|my) head\b|\bhead injury\b`,
    String.raw`\bfell (off|from|down|out)\b`,
    String.raw`\bface (is |are |turning |turned |went )*(blue|purple)\b`,
    String.raw`\b(amniotic fluid|leaking (fluid|water)|hard to breathe|short(ness)? of breath)\b`,
    String.raw`\b(stomach|belly|tummy|abdominal) (pain|cramps?|cramping|tightening)\b|\b(stomach|belly|tummy) (hurts|is hurting|is tight|feels tight|is hard|feels hard)\b`,
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
    // 中国語（広め。確度の高い言葉は URGENT_SURE_INTL。日本語と同じ字の 出血・破水・羊水・窒息 は URGENT が拾う）
    "吞下|吞了|咽下|喉(咙|嚨)卡|烫伤|燙傷|烧伤|燒傷|摔下|摔倒|撞到头|撞到頭|胎动少|胎動少|瘫软|癱軟|软绵绵|軟綿綿|蔫|(脸|臉)色(发|發)(青|紫)|呼吸急促|腹部紧张|腹部緊張|肚子(很|好|特别|特別|一直)?(痛|疼)|肚子(发|發)(紧|緊|硬)",
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

export function bridgeFor(raw: string, phase: "pregnant" | "child" | "other"): Bridge {
  const text = plainQuotes(raw);
  const urgent = URGENT.test(text) || URGENT_INTL.test(text);
  const violence = VIOLENCE.test(text);
  const crisis = CRISIS.test(text) || CRISIS_INTL.test(text) || violence;
  const stool = phase !== "pregnant" && STOOL.test(text);
  const actions: AskAction[] = [];
  const notes: string[] = [];
  const leads: string[] = [];
  if (urgent) {
    leads.push(urgentLead(phase));
    actions.push({ type: "open", href: phase === "pregnant" ? "/emergency#mama" : "/emergency", label: "急ぎの時を開く" });
    actions.push({ type: "call", label: "命が危ない時は119", tel: "119" });
    if (phase !== "pregnant") actions.push({ type: "call", label: "子どもの事で迷う時 #8000", tel: "#8000" });
    notes.push(
      phase === "pregnant"
        ? "急ぎに見える言葉がある。返事の最初の1文で、かかりつけの産院へ今すぐ電話（夜間も）・命が危ないと思ったら迷わず119 を案内する。「迷ったら119」とは書かない。体の判断はしない"
        : "急ぎに見える言葉がある。返事の最初の1文で、命が危ないと思ったら迷わず119、救急車を呼ぶか迷う時は、子どもならかかりつけか #8000、妊娠中・産後の体ならかかりつけの産院（夜間も）を案内する。「迷ったら119」とは書かない。体の判断はしない",
    );
  }
  if (stool && !urgent) {
    leads.push(cat(t("母子手帳の便色カードには「{note}」と書いてあります。", { note: t(STOOL_NOTE) }), t(STOOL_ASIDE), t(N8000_ALT_NOTE)));
    // つながらない時の一言は lead にだけ置き、ボタンは足さない（聞く画面は /emergency へのボタンを大きく出すので、受診と #8000 より目立ってしまう）
    actions.push({ type: "call", label: "子どもの急な病気の相談 #8000", tel: "#8000" });
    actions.push({ type: "open", href: "/techo#page-stool", label: "便色カードを開く" });
    notes.push("便色カードの1〜3番に近い色と言っている。手帳の注意書き（1日も早く受診）は機械が返事の頭に置く。次の健診まで待つ書き方（健診で聞く）をしない。色の良し悪しは言わない。かかりつけの小児科（生後1か月ごろまでは生まれた産院でもよい）へ電話する事と、番号を選んで記録できる事だけ");
  }
  if (crisis) {
    leads.push(
      violence
        ? t("話してくれてありがとう。ひとりで抱えなくていいです。今すぐ危ない時は110番。DV相談＋は24時間、電話で話せます（通話料はかかりません）。")
        : t("話してくれてありがとう。ひとりで抱えなくていいです。今すぐ、電話の相談先にかけてください。命が危ないと思ったら119。"),
    );
    if (violence) {
      actions.push({ type: "call", label: "DV相談＋（24時間）", tel: "0120-279-889" });
      actions.push({ type: "call", label: "今すぐ危ない時は110", tel: "110" });
    }
    if (!violence || CRISIS.test(text) || CRISIS_INTL.test(text)) actions.push({ type: "call", label: "こころの健康相談統一ダイヤル", tel: "0570-064-556" });
    actions.push({ type: "call", label: "よりそいホットライン（24時間）", tel: "0120-279-338" });
    if (CHILD_HARM.test(text) || SHAKE.test(text)) actions.push({ type: "call", label: "児童相談所 相談専用ダイヤル", tel: "0120-189-783" });
    notes.push(
      violence
        ? "暴力を受けているように見える言葉がある。責めず、相談の判断や助言はせず、返事の最初で話してくれた事を受け止め、今すぐ危ない時は110番・DV相談＋（24時間）を案内する。相手に知らせる・話し合う事を勧めない"
        : "心の危機に見える言葉がある。責めず、相談の判断や助言はせず、返事の最初で話してくれた事を受け止め、電話の相談先と町のこども家庭センターを案内する。命の危険がある時は119",
    );
  }
  return { urgent, crisis, stool, lead: leads.length ? leads.join("\n") : null, actions, note: notes.length ? notes.join("\n") : null };
}

/** 電話をかけるリンク（#8000 の # は %23） */
export function telHref(tel: string): string {
  return `tel:${tel.replace(/#/g, "%23").replace(/[^0-9%+]/g, "")}`;
}
