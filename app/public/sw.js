// 急ぎの時（/emergency）を、通信が無くても開けるように取っておく service worker。
// 扱うのは /emergency のページと、そのページが読む部品（/_next/static/ の CSS・JS・文字）だけ。ほかの通信には手を出さない。
// いつも先に通信で取りに行き（新しい中身を出す）、通信できない時だけ取っておいた物を出す。
// 登録は app/emergency/Frame.tsx（本番の時だけ）。
const CACHE = "boshi-emergency-v1";
const PAGE = "/emergency";

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

/** /emergency と部品を取って、取っておく（古い部品は消す） */
async function refresh(pageResponse) {
  const cache = await caches.open(CACHE);
  const res = pageResponse ?? (await fetch(PAGE, { cache: "no-store", credentials: "same-origin" }));
  // 合言葉の画面へ回された時などは取っておかない
  if (!res.ok || res.redirected || !new URL(res.url).pathname.startsWith(PAGE)) return;
  const html = await res.clone().text();
  const keep = new Set([new URL(PAGE, self.location.origin).href]);
  await cache.put(PAGE, res.clone());
  for (const a of assetsOf(html)) {
    try {
      const r = await fetch(a, { credentials: "same-origin" });
      if (!r.ok) continue;
      await cache.put(a, r.clone());
      keep.add(new URL(a, self.location.origin).href);
      if (a.endsWith(".css")) {
        for (const f of fontsOf(await r.text())) {
          const fr = await fetch(f).catch(() => null);
          if (fr && fr.ok) {
            await cache.put(f, fr);
            keep.add(new URL(f, self.location.origin).href);
          }
        }
      }
    } catch {
      // 1つ取れなくても、ほかは取っておく
    }
  }
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

self.addEventListener("fetch", (event) => {
  if (!mine(event.request)) return;
  const isPage = event.request.mode === "navigate";
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // 通信できた時はそのまま出す。ページなら、取っておく中身も新しくする
        if (isPage && res.ok && !res.redirected) event.waitUntil(refresh(res.clone()).catch(() => {}));
        return res;
      })
      .catch(async () => (await caches.match(isPage ? PAGE : event.request, { cacheName: CACHE })) ?? Response.error()),
  );
});
