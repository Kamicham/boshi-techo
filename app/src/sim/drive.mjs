#!/usr/bin/env node
// なりきりの道具: シミュレーションのサーバ（scripts/sim-server.sh・3100番）の画面を、iPhone の大きさで1手ずつ触る。
// Claude のなりきり役が Bash から呼ぶ。端末の記憶（localStorage）は家族ごとの profile に残るので、続けて触れる。
//
//   node src/sim/drive.mjs <家族id> setup <meId> <今日 YYYY-MM-DD>   その家族・その人・その日で開く
//   node src/sim/drive.mjs <家族id> open </path>                     画面を開く
//   node src/sim/drive.mjs <家族id> see                               見えている文字と、押せる物の番号（欄の今の値・選んだ状態・押せない物も出す）
//   node src/sim/drive.mjs <家族id> all                               画面の上から下までの文字（件数を数える・長い手帳を見渡す時）
//   node src/sim/drive.mjs <家族id> find <文字>                       その文字のある所まで動かして see（例: find OK待ち）
//   node src/sim/drive.mjs <家族id> wait [秒]                         待ってから see（撮る・話すの候補が出るのを待つ。既定3秒・最大30秒）
//   node src/sim/drive.mjs <家族id> click <番号>                      押す（外のアプリへ渡すリンクは開かず、行き先を出す）
//   node src/sim/drive.mjs <家族id> type <番号> <文字>                入れる（日付の欄は YYYY-MM-DD で入れる）
//   node src/sim/drive.mjs <家族id> scroll <down|up>                  1画面ぶん動かす
//   node src/sim/drive.mjs <家族id> shot                              画面を撮る（画像の場所を出す）
//   node src/sim/drive.mjs <家族id> tab <today|visit|capture|techo|emergency|settings>   下のタブ・急ぎの時・設定の画面へ
//   node src/sim/drive.mjs <家族id> upload <番号> <画像>              写真を選ぶ欄（input type=file）に画像を入れる（撮るの代わり）
//   node src/sim/drive.mjs <家族id> page <kind>                       作った手帳のページの画像を作る（kind: checkup / vaccine / growth。中身は作った値）
//   node src/sim/drive.mjs <家族id> offline [/path]                   電波を切ってその画面を開き直す（急ぎの時が通信なしで開けるか）。終わると電波は戻る
//
// ログイン: 作った家族（sim-・pop-）は、setup の時に仮のアカウント sim:<家族id>（その世帯の owner）で入る（/api/sim/login・札は profile に残る）。
//   サーバを BOSHI_SIM_LOGIN=1（scripts/sim-server.sh の既定）で立てると、ほかの家族の記録は 404 になる。見本の家族はログインしない。
// 撮るの試しには、page で作った画像だけを使う（本物の手帳・本物の家族の写真は使わない）。
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SIM_URL ?? "http://127.0.0.1:3100";
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "sim", "out");
const [, , fam, cmd, ...args] = process.argv;
if (!fam || !cmd) {
  console.error("使い方: node src/sim/drive.mjs <家族id> <setup|open|tab|see|all|find|wait|click|type|upload|scroll|shot|page|offline> …");
  process.exit(2);
}
const profile = path.join(OUT, "profiles", fam);
const urlFile = profile + ".url";
const scrollFile = profile + ".scroll";
fs.mkdirSync(profile, { recursive: true });

const TABS = { today: "/", visit: "/visit", capture: "/capture", techo: "/techo", emergency: "/emergency", settings: "/settings" };

/** 作った手帳のページ（紙の手帳を撮った写真の代わり）。値はすべて作った物。手書きに見えるよう少し崩す */
function fakePageHtml(kind) {
  const hand = "font-family:'Klee One','Hiragino Maru Gothic ProN',cursive;color:#1f2a6b;transform:rotate(-0.6deg)";
  const rows = {
    checkup: {
      title: "妊娠中の経過",
      head: ["診察月日", "妊娠週数", "子宮底長", "血圧", "体重", "尿蛋白", "尿糖"],
      body: [
        ["11/5", "24週3日", "21cm", "112/68", "56.4kg", "−", "−"],
        ["11/19", "26週3日", "23cm", "108/66", "57.0kg", "−", "−"],
      ],
    },
    vaccine: {
      title: "予防接種の記録",
      head: ["ワクチンの種類", "接種年月日", "メーカー/ロット", "接種者署名"],
      body: [
        ["五種混合 1回目", "R9.6.26", "（作った）A123", "（作った）こどもクリニック"],
        ["小児用肺炎球菌 1回目", "R9.6.26", "（作った）B456", "（作った）こどもクリニック"],
      ],
    },
    growth: {
      title: "1か月児健康診査",
      head: ["", ""],
      body: [
        ["体重", "4,120 g"],
        ["身長", "53.6 cm"],
        ["胸囲", "36.8 cm"],
        ["頭囲", "36.9 cm"],
      ],
    },
  }[kind];
  if (!rows) throw new Error(`知らない page: ${kind}（checkup / vaccine / growth）`);
  const cell = (c, i, isHead) => `<${isHead ? "th" : "td"} style="border:1px solid #888;padding:6px 8px;${isHead || i === 0 ? "" : hand}">${c}</${isHead ? "th" : "td"}>`;
  return `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#d9cdb8;padding:24px;font-family:'Hiragino Mincho ProN',serif">
<div style="background:#fffdf6;padding:20px;box-shadow:0 2px 8px #0003;transform:rotate(1.2deg)">
<p style="margin:0 0 4px;font-size:12px;color:#a33">作った手帳のページ（試し用・実在の記録ではない）</p>
<h1 style="font-size:20px;margin:0 0 12px">${rows.title}</h1>
<table style="border-collapse:collapse;font-size:15px;width:100%">${rows.head.some(Boolean) ? `<tr>${rows.head.map((c, i) => cell(c, i, true)).join("")}</tr>` : ""}${rows.body.map((r) => `<tr>${r.map((c, i) => cell(c, i, false)).join("")}</tr>`).join("")}</table>
</div></body>`;
}

const ctx = await chromium.launchPersistentContext(profile, {
  headless: true,
  // 急ぎの時の service worker（本番だけ登録）を試せるように
  serviceWorkers: "allow",
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "ja-JP",
  timezoneId: "Asia/Tokyo",
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));

const settle = async () => {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(400);
};
const save = async () => {
  fs.writeFileSync(urlFile, page.url());
  fs.writeFileSync(scrollFile, String(await page.evaluate(() => window.scrollY)));
};
/**
 * シミュレーションのログイン: 作った家族（sim-・pop-）の仮のアカウント sim:<家族id> で入り、その世帯の owner の札（クッキー）をもらう。
 * 札は家族ごとの profile に残る（30日）。札が無い時だけ /api/sim/login を呼ぶ。setup では毎回もらい直す（sim-data を消した後でも通るよう）。
 * 見本の家族（demo-sato）はだれでも読める世帯なので、ログインしない。
 * サーバがログインの口を持たない（古い組み立て）時は、警告を出してログインなしで続ける。
 */
const loggedIn = async () => (await ctx.cookies(BASE)).some((c) => /session_token$/.test(c.name));
async function login(force = false) {
  if (!/^(sim|pop)-/.test(fam)) return;
  if (!force && (await loggedIn())) return;
  const res = await page.request.get(`${BASE}/api/sim/login?familyId=${encodeURIComponent(fam)}`, { failOnStatusCode: false });
  if (res.ok()) {
    if (force) console.log(`（ログイン: 仮のアカウント sim:${fam}・この世帯の owner）`);
    return;
  }
  const msg = (await res.text().catch(() => "")).slice(0, 120);
  console.log(`（ログインできませんでした: ${res.status()} ${msg}。サーバが古い組み立てなら scripts/sim-server.sh --replace で組み立て直す。ログインなしで続けます）`);
}

const restore = async () => {
  await login();
  const url = fs.existsSync(urlFile) ? fs.readFileSync(urlFile, "utf8") : BASE + "/";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await settle();
  const y = fs.existsSync(scrollFile) ? Number(fs.readFileSync(scrollFile, "utf8")) : 0;
  if (y) await page.evaluate((v) => window.scrollTo(0, v), y);
};

/** 押せる物に番号を付けて、見えている物だけを返す */
async function mark() {
  return page.evaluate(() => {
    const sel = 'a[href], button, summary, input, textarea, select, [role="button"]';
    const out = [];
    let n = 0;
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (getComputedStyle(el).visibility === "hidden") continue;
      // 閉じた details の中は見えない
      if (el.closest("details:not([open])") && el.tagName !== "SUMMARY") continue;
      n += 1;
      el.setAttribute("data-sim", String(n));
      const inView = r.bottom > 0 && r.top < window.innerHeight;
      const label = (el.getAttribute("aria-label") || el.innerText || el.getAttribute("placeholder") || el.getAttribute("value") || "").replace(/\s+/g, " ").trim().slice(0, 60);
      const href = el.getAttribute("href") || "";
      const type = el.tagName === "INPUT" ? el.getAttribute("type") || "text" : "";
      // 欄の今の値（日付・文字）と、選んだ状態（aria-pressed・チェック）、押せない（disabled）
      const value = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" ? (type === "checkbox" || type === "radio" ? "" : el.value) : "";
      const on = el.getAttribute("aria-pressed") === "true" || el.getAttribute("aria-checked") === "true" || (el.checked === true);
      const off = el.matches(":disabled") || el.getAttribute("aria-disabled") === "true";
      out.push({ n, tag: el.tagName.toLowerCase(), type, label, value, on, off, href, small: r.height < 44 || r.width < 44, inView });
    }
    return out;
  });
}

async function see() {
  const items = await mark();
  const text = await page.evaluate(() => {
    const lines = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.replace(/\s+/g, " ").trim();
      if (!t) continue;
      const el = node.parentElement;
      if (!el || el.closest("script,style")) continue;
      if (el.closest("details:not([open])") && !el.closest("summary")) continue;
      const r = el.getBoundingClientRect();
      if (r.height === 0 || r.bottom <= 0 || r.top >= window.innerHeight) continue;
      lines.push(t);
    }
    return lines;
  });
  const chars = text.join("").length;
  console.log(`画面: ${page.url().replace(BASE, "")}　見えている文字 ${chars}字`);
  console.log("―― 見えている文字 ――");
  console.log(text.join("\n"));
  console.log("―― 押せる物（この画面に見えている物）――");
  for (const i of items.filter((x) => x.inView)) {
    const kind = i.type && i.type !== "text" ? `(${i.type})` : "";
    const state = `${i.on ? "（選んでいる）" : ""}${i.off ? "（押せない）" : ""}`;
    const val = i.tag === "input" || i.tag === "textarea" || i.tag === "select" ? ` ＝「${String(i.value).slice(0, 40)}」` : "";
    console.log(`[${i.n}] ${i.tag}${kind}${i.small ? "（小さい: 44px 未満）" : ""}${state} ${i.label}${val}${i.href && !i.href.startsWith("/") ? `  → ${i.href.slice(0, 80)}` : ""}`);
  }
  const below = items.filter((x) => !x.inView).length;
  if (below) console.log(`（ほかに、動かすと見える押せる物が ${below} 個）`);
}

try {
  if (cmd === "setup") {
    const [meId, today] = args;
    await page.goto(BASE + "/robots.txt");
    await login(true);
    await page.evaluate(
      ([f, m, d]) => {
        localStorage.clear();
        localStorage.setItem("boshi.family", f);
        if (m) localStorage.setItem("boshi.me", JSON.stringify({ [f]: m }));
        if (d) localStorage.setItem("boshi.demoToday", d);
      },
      [fam, meId, today],
    );
    await page.goto(BASE + "/");
    await settle();
    await see();
  } else if (cmd === "open") {
    await login();
    await page.goto(BASE + (args[0] ?? "/"));
    await settle();
    await see();
  } else {
    await restore();
    if (cmd === "see") {
      await see();
    } else if (cmd === "all") {
      // 画面の上から下まで（閉じた折りたたみの中は出さない＝人にも見えない）
      const lines = await page.evaluate(() => {
        const out = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const t = node.textContent.replace(/\s+/g, " ").trim();
          const el = node.parentElement;
          if (!t || !el || el.closest("script,style")) continue;
          if (el.closest("details:not([open])") && !el.closest("summary")) continue;
          const r = el.getBoundingClientRect();
          if (r.height === 0) continue;
          out.push(t);
        }
        return out;
      });
      console.log(`画面: ${page.url().replace(BASE, "")}　上から下までの文字 ${lines.join("").length}字`);
      console.log(lines.join("\n"));
    } else if (cmd === "find") {
      const word = args.join(" ");
      if (!word) throw new Error("find <文字> の文字がありません");
      const hit = page.getByText(word, { exact: false }).first();
      if (!(await hit.count())) {
        console.log(`「${word}」はこの画面にありません（閉じた折りたたみの中かもしれません）`);
      } else {
        await hit.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(300);
      }
      await see();
    } else if (cmd === "wait") {
      const sec = Math.min(30, Math.max(0, Number(args[0] ?? 3) || 3));
      await page.waitForTimeout(sec * 1000);
      await settle();
      await see();
    } else if (cmd === "click" || cmd === "type") {
      await mark();
      const el = page.locator(`[data-sim="${args[0]}"]`);
      if (!(await el.count())) throw new Error(`[${args[0]}] が見つかりません。see で番号を見直してください`);
      const href = (await el.getAttribute("href")) ?? "";
      if (cmd === "click" && /^(mailto:|tel:|https?:|line:|blob:)/.test(href) && !href.startsWith(BASE)) {
        console.log(`外のアプリへ渡すリンクです（開かずに記録します）: ${decodeURIComponent(href).slice(0, 400)}`);
      } else if (cmd === "click") {
        await el.scrollIntoViewIfNeeded();
        await el.click({ timeout: 5000 });
        await settle();
      } else {
        await el.fill(args.slice(1).join(" "));
        await page.waitForTimeout(200);
      }
      await see();
    } else if (cmd === "scroll") {
      await page.evaluate((d) => window.scrollBy(0, d === "up" ? -700 : 700), args[0]);
      await page.waitForTimeout(300);
      await see();
    } else if (cmd === "tab") {
      const to = TABS[args[0]];
      if (!to) throw new Error(`知らないタブ: ${args[0]}（${Object.keys(TABS).join(" / ")}）`);
      await page.goto(BASE + to);
      await settle();
      await see();
    } else if (cmd === "upload") {
      await mark();
      const [n, file] = args;
      if (!file || !fs.existsSync(file)) throw new Error(`画像が見つかりません: ${file}（page で作った画像を使う）`);
      let el = page.locator(`[data-sim="${n}"]`);
      if (!(await el.count())) throw new Error(`[${n}] が見つかりません。see で番号を見直してください`);
      // 押す物が label やボタンなら、その中かすぐ近くの input type=file を探す
      if ((await el.evaluate((x) => x.tagName)) !== "INPUT") {
        const inner = el.locator('input[type="file"]');
        el = (await inner.count()) ? inner.first() : page.locator('input[type="file"]').first();
      }
      if (!(await el.count())) throw new Error("写真を選ぶ欄（input type=file）が見つかりません");
      await el.setInputFiles(file);
      await settle();
      await page.waitForTimeout(1500);
      await see();
    } else if (cmd === "page") {
      const kind = args[0] ?? "checkup";
      const file = path.join(OUT, "fixtures", `${kind}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const p2 = await ctx.newPage();
      await p2.setViewportSize({ width: 390, height: 520 });
      await p2.setContent(fakePageHtml(kind));
      await p2.screenshot({ path: file });
      await p2.close();
      console.log(file);
    } else if (cmd === "offline") {
      const to = args[0] ?? "/emergency";
      // 一度電波のある時に開いて（service worker が取っておく）、電波を切って開き直す
      await page.goto(BASE + to);
      await settle();
      await page.waitForTimeout(4000);
      await ctx.setOffline(true);
      try {
        await page.goto(BASE + to, { waitUntil: "domcontentloaded", timeout: 10_000 });
        await page.waitForTimeout(500);
        console.log("（電波を切って開き直しました）");
        await see();
      } catch (e) {
        console.log(`電波が無いと開けませんでした: ${String(e.message).slice(0, 120)}（開発サーバでは service worker を登録しないので、本番の作りで試す）`);
      } finally {
        await ctx.setOffline(false);
      }
    } else if (cmd === "shot") {
      const file = path.join(OUT, "shots", `${fam}-${Date.now()}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await page.screenshot({ path: file });
      console.log(file);
    } else {
      throw new Error(`知らない命令: ${cmd}`);
    }
  }
  if (errors.length) console.log("―― 画面のエラー ――\n" + [...new Set(errors)].join("\n"));
  await save();
} catch (e) {
  console.log("うまくいきませんでした: " + e.message);
  await save().catch(() => {});
  process.exitCode = 1;
} finally {
  await ctx.close();
}
