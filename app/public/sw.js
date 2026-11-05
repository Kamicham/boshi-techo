// 急ぎの時（/emergency）を、通信が無くても開けるように取っておく service worker。
// 扱うのは /emergency のページと、そのページが読む部品（/_next/static/ の CSS・JS・文字）だけ。ほかの通信には手を出さない。
// ページは先に通信で取りに行き（新しい中身を出す）、2.5 秒で届かない・通信できない時は、取っておいた写しを出す（届いた中身で、写しは裏で新しくする）。
// 部品は名前に中身の印（ハッシュ）が入っていて中身が変わらないので、写しがあれば写しを先に出す（弱い電波でも、写しのページがすぐ描ける）。
// 登録は app/emergency/Frame.tsx（本番の時だけ）。
// v2（2026-11-05）: 11/4 に乳児の胸骨圧迫の手順を直したので、名前を上げて全部の端末で写しを取り直す（前の版の写しは activate で消す）。
const CACHE = "boshi-emergency-v2";
const PAGE = "/emergency";
/** ページを通信で待つ長さ。過ぎたら写しを出す */
const WAIT_MS = 2500;

/** ページの HTML から、読み込む部品（/_next/static/…）の住所を拾う */
function assetsOf(html) {
  const out = new Set();
  for (const m of html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+)"/g)) out.add(m[1]);
  return [...out];
}
/** CSS の中の文字（url(/_next/static/media/…)）を拾う */
function fontsOf(css) {
  const out = new Set();
  for (const m of css.matchAll(/url\((\/_next\/static\/media\/[^)]+)\)/g)) out.add(m[1].replace(/["']/g, ""));
  return [...out];
}

/** 文字の形（フォント）と画像。欠けても、端末のほかの字体で読める */
const optional = (url) => url.startsWith("/_next/static/media/");

/**
 * /emergency と部品を取って、写しを入れ替える。入れ替わるのは、最後にページを入れた時。
 * CSS・JS は全部そろった時だけページを入れる。1つでも取れなければページも古い部品もそのまま（前の写しを残す）。
 * 文字は数百（日本語の字形を分けたファイル）あるので、取れた物だけ（1つの失敗で、新しい手順の写しを止めない。前の写しにある物は消さない）。
 * 部品は取れた物から写しへ流し込む（中身を読まずに数百を抱えると、つながりがふさがって次の取得が始まらない）。
 * 部品の名前には中身の印（ハッシュ）が入っているので、先に入れても、今の写しのページが読む物は変わらない
 */
async function refresh(pageResponse) {
  const res = pageResponse ?? (await fetch(PAGE, { cache: "no-store", credentials: "same-origin" }));
  // 合言葉の画面へ回された時などは取っておかない
  if (!res.ok || res.redirected || !new URL(res.url).pathname.startsWith(PAGE)) return;
  const html = await res.clone().text();
  const cache = await caches.open(CACHE);
  /** 1つ取って写しへ入れる（取れなければ投げる）。CSS なら、中で読む文字の住所を返す */
  const save = async (url) => {
    const r = await fetch(url, { credentials: "same-origin" });
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    // 住所の後ろに ?v=… が付く事がある（開発サーバ）ので、道の部分で見る
    const css = new URL(url, self.location.origin).pathname.endsWith(".css") ? r.clone().text() : null;
    await cache.put(url, r);
    return css ? fontsOf(await css) : [];
  };
  const assets = assetsOf(html);
  const need = assets.filter((u) => !optional(u));
  const fonts = new Set(assets.filter(optional));
  for (const list of await Promise.all(need.map(save))) for (const f of list) fonts.add(f);
  await Promise.all([...fonts].map((f) => save(f).catch(() => {})));
  await cache.put(PAGE, res);
  // 新しいページが読まない古い部品を消す
  const keep = new Set([PAGE, ...need, ...fonts].map((u) => new URL(u, self.location.origin).href));
  for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
}

self.addEventListener("install", (event) => {
  event.waitUntil(refresh().catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("boshi-emergency-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** この住所は /emergency のページか、そのページが読む部品か */
function mine(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname === PAGE && request.mode === "navigate") return true;
  if (!url.pathname.startsWith("/_next/static/")) return false;
  // 部品は、/emergency のページか、そのページの CSS から読まれた物だけ
  try {
    const ref = new URL(request.referrer);
    return ref.origin === self.location.origin && (ref.pathname === PAGE || ref.pathname.startsWith("/_next/static/css/"));
  } catch {
    return false;
  }
}

/** ページ: 通信を WAIT_MS まで待つ。届かない・通信できない・サーバが答えられない（5xx）時は写しを出す。写しが無ければ通信を待つ */
async function pageOf(net) {
  let timer;
  const late = new Promise((resolve) => (timer = setTimeout(resolve, WAIT_MS, null)));
  const res = await Promise.race([net.catch(() => null), late]);
  clearTimeout(timer);
  if (res && res.status < 500) return res;
  const kept = await caches.match(PAGE, { cacheName: CACHE });
  return kept ?? res ?? net;
}

self.addEventListener("fetch", (event) => {
  if (!mine(event.request)) return;
  if (event.request.mode !== "navigate") {
    // 部品: 写しがあれば写しを先に（中身が変わらない名前なので）。無ければ通信
    event.respondWith(caches.match(event.request, { cacheName: CACHE }).then((kept) => kept ?? fetch(event.request)));
    return;
  }
  const net = fetch(event.request);
  // 届いたページで写しも新しくする（2.5 秒を過ぎて写しを出した後も、裏で続ける）。複製は、ページを出す前に作る
  const fresh = net.then((res) => (res.ok && !res.redirected ? res.clone() : null), () => null);
  event.waitUntil(fresh.then((res) => res && refresh(res)).catch(() => {}));
  event.respondWith(pageOf(net));
});
