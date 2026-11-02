#!/usr/bin/env node
// なりきりの道具: シミュレーションのサーバ（scripts/sim-server.sh・3100番）の画面を、iPhone の大きさで1手ずつ触る。
// Claude のなりきり役が Bash から呼ぶ。端末の記憶（localStorage）は家族ごとの profile に残るので、続けて触れる。
//
//   node src/sim/drive.mjs <家族id> setup <meId> <今日 YYYY-MM-DD>   その家族・その人・その日で開く
//   node src/sim/drive.mjs <家族id> open </path>                     画面を開く
//   node src/sim/drive.mjs <家族id> see                               見えている文字と、押せる物の番号
//   node src/sim/drive.mjs <家族id> click <番号>                      押す（外のアプリへ渡すリンクは開かず、行き先を出す）
//   node src/sim/drive.mjs <家族id> type <番号> <文字>                入れる
//   node src/sim/drive.mjs <家族id> scroll <down|up>                  1画面ぶん動かす
//   node src/sim/drive.mjs <家族id> shot                              画面を撮る（画像の場所を出す）
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SIM_URL ?? "http://127.0.0.1:3100";
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "sim", "out");
const [, , fam, cmd, ...args] = process.argv;
if (!fam || !cmd) {
  console.error("使い方: node src/sim/drive.mjs <家族id> <setup|open|see|click|type|scroll|shot> …");
  process.exit(2);
}
const profile = path.join(OUT, "profiles", fam);
const urlFile = profile + ".url";
const scrollFile = profile + ".scroll";
fs.mkdirSync(profile, { recursive: true });

const ctx = await chromium.launchPersistentContext(profile, {
  headless: true,
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
const restore = async () => {
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
      out.push({ n, tag: el.tagName.toLowerCase(), label, href, small: r.height < 44 || r.width < 44, inView });
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
    console.log(`[${i.n}] ${i.tag}${i.small ? "（小さい: 44px 未満）" : ""} ${i.label}${i.href && !i.href.startsWith("/") ? `  → ${i.href.slice(0, 80)}` : ""}`);
  }
  const below = items.filter((x) => !x.inView).length;
  if (below) console.log(`（ほかに、動かすと見える押せる物が ${below} 個）`);
}

try {
  if (cmd === "setup") {
    const [meId, today] = args;
    await page.goto(BASE + "/robots.txt");
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
    await page.goto(BASE + (args[0] ?? "/"));
    await settle();
    await see();
  } else {
    await restore();
    if (cmd === "see") {
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
