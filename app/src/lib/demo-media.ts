// 見本の家族（佐藤家・すべて作った家族）の写真と声の種。
// 写真は画像生成（Z-Image Turbo・自宅の機械）で作った物、声は合成音声（AivisSpeech・自宅の機械）で作った物。実在の人物は写っていない・話していない。
// 大人の顔は写さない構図にしてある。日付は lib/capture.ts の作った記録（seedItems）と同じ筋書きに合わせる。
// 置き場は app/demo-media/（公開リポジトリに入る）。入れる時は写真・声とも、本物の家族と同じ道（暗号にして置く）を通す。
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { HouseholdCtx } from "./access";
import { addDays, addMonths, conceptionDate, lmpFromDue } from "./clock";
import { DEMO_FAMILY } from "./demo-family";
import { writeLetter } from "./letters";
import type { LetterOpen } from "./letters-shared";
import { saveAudio, saveUpload } from "./media";
import type { MediaFrom, VoiceMoment } from "./media-shared";

type Seed =
  | { kind: "photo"; file: string; at: string; caption?: string; who?: string; star?: boolean; from?: MediaFrom }
  | { kind: "audio"; file: string; at: string; moment: VoiceMoment; who: string; spokenTo?: string; transcript: string; sec: number; star?: boolean; from?: MediaFrom };

// みんなの章の2人（作った祖父母）。母方の祖母は鹿児島、父方の祖父は大阪に住む筋書き
const BAABA: MediaFrom = { name: "ばあば", relation: "鹿児島・美咲の母" };
const JIIJI: MediaFrom = { name: "じいじ", relation: "大阪・翔太の父" };

export function demoMediaSeeds(): Seed[] {
  const f = DEMO_FAMILY;
  const lmp = lmpFromDue(f.dueDate);
  const wk = (w: number, d = 0) => addDays(lmp, w * 7 + d);
  const birth = f.birthDate!;
  const mo = (m: number, d = 0) => addDays(addMonths(birth, m), d);
  const child = f.childName!;
  return [
    { kind: "photo", file: "p01-test.jpg", at: addDays(conceptionDate(f), 26), caption: "線が2本。しばらく二人で黙って見ていた", who: "美咲" },
    { kind: "photo", file: "p02-techo.jpg", at: wk(9, 2), caption: "母子健康手帳をもらった日", who: "美咲" },
    { kind: "photo", file: "p03-echo.jpg", at: wk(12, 1), caption: "はじめてのエコー写真。冷蔵庫に貼った", who: "翔太", star: true },
    { kind: "photo", file: "p04-belly20.jpg", at: wk(20), caption: "20週のおなか。いつものソファとうさぎの横で", who: "翔太" },
    { kind: "photo", file: "p05-hand.jpg", at: wk(20, 1), caption: "毎晩の話しかけ", who: "美咲" },
    { kind: "audio", file: "v01.m4a", at: wk(20, 1), moment: "belly", who: "翔太", spokenTo: child, transcript: `${child}、聞こえる？パパだよ。今日は寒かったね。早く会いたいな。おやすみ。`, sec: 5.7, star: true },
    { kind: "photo", file: "p06-names.jpg", at: wk(28), caption: "名前の候補を書いたノート", who: "翔太" },
    { kind: "audio", file: "v02.m4a", at: wk(28), moment: "name", who: "美咲", spokenTo: child, transcript: `${child}。今日ね、あなたの名前が決まったよ。${child}。ひなたぼっこみたいに、あったかい子になってね。`, sec: 8.7 },
    { kind: "photo", file: "p07-belly32.jpg", at: wk(32), caption: "32週。同じソファ、同じうさぎ", who: "翔太" },
    { kind: "photo", file: "p08-bag.jpg", at: wk(35, 3), caption: "入院の荷物を玄関に", who: "美咲" },
    { kind: "audio", file: "v03.m4a", at: wk(36, 2), moment: "belly", who: "美咲", spokenTo: child, transcript: "もうすぐだね。ママ、ちょっとだけ怖いけど、楽しみのほうがずっと大きいよ。待ってるね。", sec: 7.6 },
    { kind: "photo", file: "b01-finger.jpg", at: birth, caption: "はじめまして", who: "翔太", star: true },
    { kind: "audio", file: "v04.m4a", at: birth, moment: "name", who: "翔太", spokenTo: child, transcript: `${child}。はじめまして。パパだよ。来てくれて、ありがとう。`, sec: 4.7, star: true },
    { kind: "photo", file: "b02-feet.jpg", at: addDays(birth, 1), caption: "足首のネームバンド", who: "美咲" },
    { kind: "photo", file: "b03-sleep.jpg", at: addDays(birth, 20), caption: "うさぎのほうが大きい", who: "美咲" },
    { kind: "audio", file: "v05.m4a", at: addDays(birth, 20), moment: "bedtime", who: "美咲", spokenTo: child, transcript: `${child}、おやすみ。今日もいっぱい泣いて、いっぱい飲んだね。ママも少し寝るね。`, sec: 6.6 },
    { kind: "photo", file: "m01-miyamairi.jpg", at: addDays(birth, 31), caption: "お宮参り", who: "翔太" },
    { kind: "photo", file: "m02-okuizome.jpg", at: addDays(birth, 100), caption: "お食い初めの膳", who: "美咲" },
    { kind: "photo", file: "m03-sofa3.jpg", at: mo(3), caption: "3か月。うさぎと同じくらい", who: "翔太" },
    { kind: "photo", file: "m04-roll.jpg", at: mo(4, 5), caption: "寝返りした", who: "翔太" },
    { kind: "photo", file: "m05-spoon.jpg", at: mo(5, 10), caption: "離乳食のはじまり", who: "美咲" },
    { kind: "photo", file: "m06-sofa6.jpg", at: mo(6), caption: "6か月。ひとりで座れた", who: "翔太" },
    { kind: "photo", file: "m07-mama.jpg", at: mo(10, 1), caption: "「まんま」と言った朝", who: "美咲" },
    { kind: "audio", file: "v06.m4a", at: mo(10, 1), moment: "bedtime", who: "翔太", spokenTo: child, transcript: `今日、はじめて、まんまって言ったね。パパって言ってくれるのは、いつかな。おやすみ、${child}。`, sec: 6.2 },
    { kind: "photo", file: "y01-mochi.jpg", at: mo(12), caption: "一升餅を背負って3歩", who: "翔太", star: true },
    { kind: "photo", file: "y02-cake.jpg", at: mo(12), caption: "1歳のケーキ", who: "美咲" },
    { kind: "audio", file: "v07.m4a", at: mo(12), moment: "message", who: "美咲", spokenTo: child, transcript: `${child}、一歳おめでとう。一年前の今日の朝、あなたに会えたんだよ。生まれてきてくれて、ありがとう。`, sec: 9.0, star: true },
    { kind: "photo", file: "y03-stand.jpg", at: mo(12, 2), caption: "12か月。うさぎを追い越しそう", who: "翔太" },
    { kind: "photo", file: "y05-shoes.jpg", at: mo(14), caption: "はじめての靴", who: "美咲" },
    { kind: "photo", file: "y04-park.jpg", at: mo(18), caption: "落ち葉の公園", who: "翔太" },
    { kind: "photo", file: "y06-sofa24.jpg", at: mo(24), caption: "2歳。うさぎが小さくなった", who: "美咲", star: true },
    // みんなの章（祖父母が招待から足した物の筋書き）
    { kind: "photo", file: "g01-parcel.jpg", at: addDays(birth, 10), caption: "鹿児島から箱が届いた。手編みの帽子とお守り", who: "ばあば", from: BAABA },
    { kind: "audio", file: "g-baaba.m4a", at: addDays(birth, 10), moment: "message", who: "ばあば", spokenTo: child, transcript: "ひなちゃん、ばあばだよ。鹿児島は、今日もあったかかったよ。早く抱っこしたいねえ。元気に大きくなってね。", sec: 17.0, from: BAABA },
    { kind: "photo", file: "g02-hands.jpg", at: mo(2, 3), caption: "はじめて会えた日。小さいのに、ぎゅっと握る", who: "じいじ", from: JIIJI },
    { kind: "audio", file: "g-jiiji.m4a", at: mo(2, 3), moment: "message", who: "じいじ", spokenTo: child, transcript: "ひなた。じいじだ。おまえの手は、小さいのに、強いなあ。大きくなったら、また大阪においで。", sec: 10.1, from: JIIJI },
    { kind: "photo", file: "g03-engawa.jpg", at: mo(18, 10), caption: "はじめての帰省。縁側でずっと庭を見ていた", who: "ばあば", from: BAABA },
  ];
}

/** 見本の家族の、封をした手紙（作った手紙）。書いた日と開く日は筋書きに合わせる */
export function demoLetterSeeds(): { key: string; at: string; from: string; relation?: string; open: LetterOpen; body: string }[] {
  const f = DEMO_FAMILY;
  const lmp = lmpFromDue(f.dueDate);
  const birth = f.birthDate!;
  const child = f.childName!;
  return [
    {
      key: "letter-1y",
      at: addDays(lmp, 30 * 7),
      from: "美咲",
      open: "1y",
      body: `1歳の${child}へ。\n\nこれを書いているのは、まだあなたがおなかの中にいる、30週の夜です。夜になるとよく動いて、パパと二人で「いま蹴った」と笑っています。\n\nあなたがどんな顔で、どんな声で泣くのか、まだ知りません。でも、この1年がきっと大変で、きっとかけがえのない1年だったことは、もう分かる気がします。\n\n1歳おめでとう。会いに来てくれて、ありがとう。`,
    },
    {
      key: "letter-school",
      at: addDays(birth, 3),
      from: "翔太",
      open: "school",
      body: `小学校に入る${child}へ。\n\n生まれて3日目の夜、病院から帰ってきて、これを書いています。抱っこの仕方もまだぎこちないパパです。\n\nランドセルは重いかな。友だちはできたかな。困った時は、いつでも話してね。パパはずっと、あなたの一番の味方です。`,
    },
    {
      key: "letter-10y-baaba",
      at: mo(birth, 12),
      from: "ばあば",
      relation: "鹿児島・美咲の母",
      open: "10y",
      body: `10歳のひなちゃんへ。\n\nばあばです。1歳のお誕生日に、この手紙を書いています。一升餅を背負って3歩歩いたと、写真で見ましたよ。\n\n10歳のあなたは、鹿児島の夏を覚えているかな。縁側でスイカを食べようね。ばあばは、いつまでもあなたを待っています。`,
    },
    {
      key: "letter-20y",
      at: mo(birth, 12),
      from: "美咲",
      open: "20y",
      body: `20歳の${child}へ。\n\nママです。あなたの1歳の誕生日の夜に、これを書いています。\n\nこの手帳には、あなたがおなかにいた頃からの、たくさんの記録と声が残っています。読み返すと、毎日が必死で、毎日が宝物でした。\n\nこれからどんな道を選んでも、あなたが生まれてきてくれた日のことを、ママはずっと誇りに思っています。20歳、おめでとう。`,
    },
  ];
}

const mo = (birth: string, m: number) => addMonths(birth, m);

function dir(): string {
  for (const d of [path.join(process.cwd(), "demo-media"), path.join(process.cwd(), "app", "demo-media")]) if (fs.existsSync(d)) return d;
  return path.join(process.cwd(), "demo-media");
}

/**
 * 見本の家族（とその公開版の写し）に、作った写真と声を入れる。同じ中身は二重に入らない（sha256）ので、何度呼んでもよい。
 * 作った家族の世帯だけ（本物の世帯には入れない）。入れた数を返す
 */
export async function seedDemoMedia(ctx: HouseholdCtx): Promise<number> {
  if (ctx.household.kind === "real") return 0;
  const base = dir();
  let added = 0;
  for (const s of demoMediaSeeds()) {
    const p = path.join(base, s.file);
    if (!fs.existsSync(p)) continue;
    const buf = fs.readFileSync(p);
    const starBy = s.star ? "name:美咲" : null;
    if (s.kind === "photo") {
      const r = await saveUpload(ctx, { orig: buf, caption: s.caption, who: s.who, today: s.at, made: true, starBy, from: s.from });
      if (!r.duplicate) added++;
    } else {
      const r = await saveAudio(ctx, { audio: buf, moment: s.moment, who: s.who, spokenTo: s.spokenTo, transcript: s.transcript, durationSec: s.sec, today: s.at, made: true, seedKey: s.file, from: s.from });
      if (!r.duplicate) {
        added++;
        if (starBy) ctx.db.media.patch(r.media.id, { data: { star: [starBy] } });
      }
    }
  }
  // 封をした手紙（同じ種は二度入れない）
  for (const l of demoLetterSeeds()) {
    try {
      writeLetter(ctx, { body: l.body, open: l.open, from: l.from, relation: l.relation, today: l.at, made: true, seedKey: l.key });
      added++;
    } catch (e) {
      if ((e as { status?: number }).status !== 409) throw e;
    }
  }
  return added;
}
