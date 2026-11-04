// 橋の床: 急ぎ・心の危機に見える言葉には、Claude の返事より前に、機械で必ず連絡先を出す（ビジョン⑤ 医療は壁でなく橋）。
// 体や心の判断はしない。言葉が含まれていたら案内を出すだけ（出しすぎても害は小さく、出し損ねる方が重い）。
// 出典:
//   - 119・#8000: こども家庭庁「こども医療電話相談事業（#8000）」https://www.cfa.go.jp/policies/boshihoken/8000/
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
  const urgent = URGENT.test(text);
  const crisis = CRISIS.test(text);
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
    if (/手をあげ|叩いて|たたいて|虐待/.test(text)) actions.push({ type: "call", label: "児童相談所 相談専用ダイヤル", tel: "0120-189-783" });
    notes.push("心の危機に見える言葉がある。責めず、相談の判断や助言はせず、返事の最初で話してくれた事を受け止め、電話の相談先と町のこども家庭センターを案内する。命の危険がある時は119");
  }
  return { urgent, crisis, stool, lead: leads.length ? leads.join("\n") : null, actions, note: notes.length ? notes.join("\n") : null };
}

/** 電話をかけるリンク（#8000 の # は %23） */
export function telHref(tel: string): string {
  return `tel:${tel.replace(/#/g, "%23").replace(/[^0-9%+]/g, "")}`;
}
