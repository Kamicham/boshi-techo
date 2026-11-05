#!/usr/bin/env node
// 世帯をまたぐ確かめ（実際のサーバの API で）: 家族Aの札で家族Bの記録・済んだ事・手帳・写真・健診を叩くと、すべて 404 になるか。
// シミュレーションのサーバ（scripts/sim-server.sh・3100番。既定で BOSHI_SIM_LOGIN=1）に対して回す。Workflow simulate が、なりきりの後に呼ぶ。
//
//   node src/sim/cross.mjs [家族A] [家族B]     既定は sim-04 と sim-06（作った家族）
//
// 印: ○ 404 になった／× 家族Bの物が見えた・変わった（穴）／△ 確かめられなかった（口がまだ無い・健診は 11/5 の後に関所が入る）
// 最後の行に JSON（{ ok, rows }）を出す。× が1つでもあれば終わりの番号は 1、サーバがログインなしで開いていれば 2。
// 書くのはシミュレーションの DB だけ（本番 3210番・わが家には触らない）。家族Bの物を壊さないよう、横取りの試しは「確定」だけにする。
const BASE = process.env.SIM_URL ?? "http://127.0.0.1:3100";
const [A = "sim-04", B = "sim-06"] = process.argv.slice(2);
if (A === B) {
  console.error("家族A と家族B は別の家族にしてください");
  process.exit(2);
}
if (!/^127\.0\.0\.1:3100$|^localhost:3100$/.test(new URL(BASE).host) && process.env.SIM_CROSS_ANY !== "1") {
  console.error(`シミュレーションのサーバ（3100番）以外には回しません: ${BASE}`);
  process.exit(2);
}

const rows = [];
const mark = (what, status, expect, note = "") => {
  const m = status === expect ? "○" : "×";
  rows.push({ mark: m, what, status, note });
  return m;
};
const gap = (what, note) => rows.push({ mark: "△", what, status: null, note });

async function login(fid) {
  const res = await fetch(`${BASE}/api/sim/login?familyId=${encodeURIComponent(fid)}`);
  if (!res.ok) throw new Error(`${fid} でログインできません（${res.status} ${(await res.text()).slice(0, 120)}）。サーバを scripts/sim-server.sh --replace で組み立て直す`);
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  if (!/session_token=/.test(cookie)) throw new Error(`${fid} の札（クッキー）が返りませんでした`);
  return cookie;
}

async function call(cookie, method, p, body) {
  const res = await fetch(BASE + p, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

const q = (fid) => `familyId=${encodeURIComponent(fid)}`;

try {
  const ca = await login(A);
  const cb = await login(B);

  // 0) サーバがログインを求めているか（求めていなければ、作った家族はだれでも読める＝確かめにならない）
  const open = await call(null, "GET", `/api/done?${q(B)}`);
  if (open.status === 200) {
    console.log(`サーバがログインなしで作った家族を開いています（BOSHI_SIM_LOGIN が無い）。scripts/sim-server.sh --replace（--guest を付けない）で立て直してから回す`);
    console.log(JSON.stringify({ ok: false, reason: "guest", rows }));
    process.exit(2);
  }
  mark("札なしで家族Bの済んだ事", open.status, 401);

  // 1) 家族Bの札では見える（下の 404 が「口が無い」ための 404 でない事の確かめ）
  const own = await call(cb, "GET", `/api/done?${q(B)}`);
  if (own.status !== 200) throw new Error(`家族Bの札で家族Bの済んだ事が読めません（${own.status}）。関所かログインの不具合`);

  // 2) 家族Aの札で、家族Bの一覧を叩く
  for (const [what, p] of [
    ["済んだ事の一覧", `/api/done?${q(B)}`],
    ["手帳の記録の一覧", `/api/techo?${q(B)}`],
    ["いつもの（keep）", `/api/keep?${q(B)}`],
    ["下書きの一覧", `/api/draft?${q(B)}`],
    ["一冊（book）", `/api/book?${q(B)}`],
    ["参謀の気づきの数", `/api/advisor?${q(B)}&peek=1`],
    ["世帯の中身", `/api/account/household?${q(B)}`],
  ]) {
    const base = await call(cb, "GET", p);
    if (base.status === 404 && !base.json?.error) {
      gap(what, "口がまだ無い");
      continue;
    }
    mark(what, (await call(ca, "GET", p)).status, 404);
  }

  // 3) id で叩く: 家族Bの手帳の記録の id を、家族Aの世帯として・家族Bの世帯として確定しようとする
  const techoB = await call(cb, "GET", `/api/techo?${q(B)}`);
  const entry = (techoB.json?.techo ?? []).find((e) => e && typeof e.id === "string");
  if (!entry) gap("手帳の記録の id", "家族Bに手帳の記録が無い");
  else {
    mark("手帳の記録の id（家族Aの世帯として確定）", (await call(ca, "POST", "/api/techo", { familyId: A, action: "confirm", id: entry.id })).status, 404);
    mark("手帳の記録の id（家族Bの世帯として確定）", (await call(ca, "POST", "/api/techo", { familyId: B, action: "confirm", id: entry.id })).status, 404);
  }
  // 済んだ事を外す（家族Bの世帯）
  mark("済んだ事を外す（家族Bの世帯）", (await call(ca, "DELETE", "/api/done", { familyId: B, milestoneId: "birth-registration" })).status, 404);

  // 4) 写真: 家族Bの写真の id（写真の口ができてから）
  const mediaB = await call(cb, "GET", `/api/media?${q(B)}`);
  const media = Array.isArray(mediaB.json?.media) ? mediaB.json.media : Array.isArray(mediaB.json?.photos) ? mediaB.json.photos : null;
  if (mediaB.status !== 200 || !media) gap("写真の id", mediaB.status === 404 ? "写真の口（/api/media）がまだ無い" : `家族Bの写真の一覧が読めない（${mediaB.status}）`);
  else {
    mark("写真の一覧", (await call(ca, "GET", `/api/media?${q(B)}`)).status, 404);
    const m = media.find((x) => x && typeof x.id === "string");
    if (!m) gap("写真の id", "家族Bに写真が無い");
    else {
      mark("写真の id（本体）", (await call(ca, "GET", `/api/media/${encodeURIComponent(m.id)}`)).status, 404);
      mark("写真の id（小さい形）", (await call(ca, "GET", `/api/media/${encodeURIComponent(m.id)}?v=thumb`)).status, 404);
    }
  }

  // 5) 健診（2026-11-05 監査 #2 で世帯の関所が入った。家族Aの札で家族Bの健診は、在るかどうかも見せずに 404）
  mark("健診の一覧", (await call(ca, "GET", `/api/visit?${q(B)}`)).status, 404);
  const visitB = await call(cb, "GET", `/api/visit?${q(B)}`);
  const v = (visitB.json?.visits ?? []).find((x) => x && typeof x.id === "string");
  if (!v) gap("健診の id", visitB.status === 200 ? "家族Bに健診が無い" : `家族Bの健診の一覧が読めない（${visitB.status}）`);
  else {
    mark("健診の id", (await call(ca, "GET", `/api/visit/${encodeURIComponent(v.id)}`)).status, 404);
    // 結果の画面の1問（次の健診の日の確かめ）も、よその世帯の札では書けない
    mark("健診の次の日の確かめ（家族Bの健診）", (await call(ca, "PATCH", `/api/visit/${encodeURIComponent(v.id)}`, { nextCheck: { state: "none", by: "x" } })).status, 404);
  }
} catch (e) {
  console.log(`止まりました: ${e instanceof Error ? e.message : e}`);
  console.log(JSON.stringify({ ok: false, reason: "error", rows }));
  process.exit(2);
}

console.log(`世帯をまたぐ確かめ: 家族A ${A} の札で、家族B ${B} を叩く（${BASE}）`);
for (const r of rows) console.log(`${r.mark} ${r.what}${r.status != null ? `（${r.status}）` : ""}${r.note ? ` … ${r.note}` : ""}`);
const bad = rows.filter((r) => r.mark === "×");
console.log(bad.length ? `× が ${bad.length} 件（世帯をまたいで見えた・変わった）` : "× は無し");
console.log(JSON.stringify({ ok: bad.length === 0, a: A, b: B, rows }));
process.exit(bad.length ? 1 : 0);
