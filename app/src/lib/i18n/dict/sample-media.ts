// 見本の家族（佐藤家・すべて作った家族）の写真の一言と、みんなの章の続柄の注の訳（多言語化・2026-11-05）。
// 鍵は日本語の文そのもの（sample-books.ts と同じ形）。元は lib/demo-media.ts の種（写真の一言27行・続柄の注2つ）。
// AREAS（lib/i18n/dicts.ts）には入れない＝画面の辞書に送らない。/api/media が頼みの言葉で、作った写真（made）の一言と続柄を
// 差し替える（lib/sample-media-i18n.ts）。元の種は変えず、日本語の時は1字も変わらない。
// 見本の一冊の辞書（sample-books.ts）と画面の辞書に同じ文がある物（はじめまして・お宮参り など13行）は、ここに入れずにそちらから引く
// （鍵を2か所に置かない）。
// 訳は Claude Code が書いた（API は呼んでいない）。名前と呼び名・言い回しは sample-books.ts の頭の決め事と同じ
// （中文は名前を日本語のまま・English はローマ字。うさぎ＝兔子／bunny、エコー写真＝B超照片／ultrasound photo、帰省＝回老家／trip back to the family home）。
// 試験は lib/sample-media-i18n.test.ts（27行と続柄のすべてに訳がある・数・名前・仮名・用語集）
import type { Entries } from "..";

export default {
  // ── 妊娠中 ──
  "線が2本。しばらく二人で黙って見ていた": { zh: "两条线。我们俩静静地看了好一会儿", en: "Two lines. For a while, the two of us just looked at it in silence" },
  "はじめてのエコー写真。冷蔵庫に貼った": { zh: "第一张B超照片。贴在了冰箱上", en: "Your first ultrasound photo. It went up on the fridge" },
  "20週のおなか。いつものソファとうさぎの横で": { zh: "20周的肚子。在平常的沙发和兔子旁边", en: "The belly at 20 weeks, next to the usual sofa and the bunny" },
  名前の候補を書いたノート: { zh: "写着名字候选的本子", en: "The notebook with our name ideas" },
  "32週。同じソファ、同じうさぎ": { zh: "32周。同一张沙发，同一只兔子", en: "32 weeks. Same sofa, same bunny" },
  // ── 生まれた後 ──
  "3か月。うさぎと同じくらい": { zh: "3个月。和兔子差不多大了", en: "3 months. About the same size as the bunny" },
  離乳食のはじまり: { zh: "开始吃辅食", en: "Starting baby food" },
  "6か月。ひとりで座れた": { zh: "6个月。能自己坐着了", en: "6 months. You sat up on your own" },
  "12か月。うさぎを追い越しそう": { zh: "12个月。快要比兔子还高了", en: "12 months. Almost taller than the bunny" },
  はじめての靴: { zh: "第一双鞋", en: "Your first shoes" },
  落ち葉の公園: { zh: "满是落叶的公园", en: "The park with fallen leaves" },
  // ── みんなの章（作った祖父母が足した物の筋書き） ──
  "鹿児島から箱が届いた。手編みの帽子とお守り": { zh: "从鹿儿岛寄来了一个箱子。里面是手织的帽子和护身符", en: "A box came from Kagoshima: a hand-knitted hat and an omamori charm" },
  "はじめて会えた日。小さいのに、ぎゅっと握る": { zh: "第一次见面的那天。手那么小，却握得紧紧的", en: "The day we first met. Such a small hand, and such a tight grip" },
  "はじめての帰省。縁側でずっと庭を見ていた": { zh: "第一次回老家。在檐廊上一直看着院子", en: "Your first trip back to the family home. You watched the garden from the veranda the whole time" },
  // ── 続柄の注（みんなの章の名前の横） ──
  "鹿児島・美咲の母": { zh: "鹿儿岛・美咲的母亲", en: "Kagoshima · Misaki's mother" },
  "大阪・翔太の父": { zh: "大阪・翔太的父亲", en: "Osaka · Shota's father" },
} satisfies Entries;
