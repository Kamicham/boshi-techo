// 役所を地図で探す言葉（画面とサーバの両方で使う）。
// 政令指定都市は、出生届・児童手当などの窓口が市役所ではなく「住んでいる区の区役所」なので、区役所で探す。

/** 政令指定都市（20市） */
export const DESIGNATED_CITIES = [
  "札幌市",
  "仙台市",
  "さいたま市",
  "千葉市",
  "横浜市",
  "川崎市",
  "相模原市",
  "新潟市",
  "静岡市",
  "浜松市",
  "名古屋市",
  "京都市",
  "大阪市",
  "堺市",
  "神戸市",
  "岡山市",
  "広島市",
  "北九州市",
  "福岡市",
  "熊本市",
] as const;

/** 政令市なら、その市の名前（「さいたま市浦和区」も「さいたま市」） */
export function designatedCity(city: string): string | null {
  return DESIGNATED_CITIES.find((c) => city.startsWith(c)) ?? null;
}

/** 政令市の区（「さいたま市浦和区」→「浦和区」）。区が入っていなければ null */
export function wardOf(city: string): string | null {
  const base = designatedCity(city);
  if (!base) return null;
  const rest = city.slice(base.length).trim();
  return /区$/.test(rest) ? rest : null;
}

/** 町の役所そのものの名前（区役所・市役所・町役場・村役場） */
export function officeName(city: string): string {
  const base = designatedCity(city);
  if (base) {
    const ward = wardOf(city);
    return ward ? `${base}${ward}役所` : `${base} 区役所`;
  }
  return `${city}${/[町村]$/.test(city) ? "役場" : "役所"}`;
}

/** 調べた役所の名前が、政令市の区役所として使えるか（「各区役所」「住んでいる区の区役所」は使えない） */
function isWardOffice(office: string): boolean {
  return /[^\s各]区役所/.test(office) && !/(各|住んでいる|お住まいの|住所地の)/.test(office);
}

/**
 * 地図で探す言葉: 調べた役所の名前と住所 → 町の役所。
 * 政令市は、区が分かる時だけその区役所、分からない時は「◯◯市 区役所」で探す（市役所本庁へ連れて行かない）。
 */
export function officeSearch(o: { prefecture: string; city: string; office?: string; address?: string }): string {
  const office = (o.office ?? "").trim();
  const address = (o.address ?? "").trim();
  if (designatedCity(o.city)) {
    if (office && isWardOffice(office)) return `${office} ${address}`.trim();
    return `${o.prefecture}${officeName(o.city)}`;
  }
  if (address) return `${office} ${address}`.trim();
  if (office && !office.includes("確かめる")) return office.startsWith(o.prefecture) ? office : `${o.prefecture}${office}`;
  return `${o.prefecture}${officeName(o.city)}`;
}

/** 表に出す「どこへ」: 1行目（役所と課の名前）だけ。かっこ書き・電話・受付時間は外す */
export function shortWhere(where: string): string {
  // かっこの中の「。」で切らないよう、先にかっこ書きを外す
  const plain = where.replace(/[（(][^）)]*[）)]/g, "");
  const first = plain.split(/\n|。/).map((x) => x.trim()).find(Boolean) ?? plain;
  let s = first
    .replace(/[（(][^）)]*$/, "")
    .replace(/[、,]?\s*(電話|TEL|tel|☎|受付|開庁|平日|月曜|午前|\d{2,4}-\d).*$/, "")
    .replace(/^(窓口は|窓口[:：]|提出先[:：]?)/, "")
    .trim();
  if (s.length > 36) s = s.split(/[、,：:]/)[0].trim();
  return s || first.slice(0, 36) || where.slice(0, 36);
}

/** 表に出す「いつまで」: 日付・日数だけ。法律の名前・条の番号は外す */
export function shortDeadline(deadline: string): string {
  // 去年度の日程の文（「〜だった」「前年度」）は外す。表に去年の受付の日が「いつまで」と出た（第31回・隠岐の島の保育園）
  const current = deadline
    .split(/(?<=。)|\n/)
    .filter((x) => !/(だった|でした|前年度|昨年度|去年度|去年)/.test(x))
    .join("")
    .trim();
  const base = current || deadline;
  const noLaw = base
    .replace(/[（(][^）)]*(法|条|令|規則)[^）)]*[）)]/g, "")
    .replace(/[^、。\s]*(法|条例|規則)(第[\d０-９一二三四五六七八九十百]+条)?(により|による|で|に基づき)?[、。]?/g, "")
    .trim();
  const hit =
    noLaw.match(/[^、。]{0,16}?[\d０-９]+\s*(日|か月|ヶ月|カ月|か月半|週間?)以内/) ??
    // 「11月4日〜」「11月4日から」は受付の始まりなので、締切に使わない
    noLaw.match(/[\d０-９]{1,2}月[\d０-９]{1,2}日(?![〜～\-ー]|から|より)(まで)?/) ??
    noLaw.match(/[^、。]{0,12}(まで|以内|前まで)/);
  // 日付が取れず「確かめる」と書いてある時は、その文を出す
  const check = !hit && noLaw.split(/[。\n]/).find((x) => x.includes("確かめ"));
  const s = (check || (hit?.[0] ?? noLaw.split(/[。\n]/)[0])).replace(/^[、。\s]+/, "").trim();
  return s || base.split(/[。\n]/)[0];
}
