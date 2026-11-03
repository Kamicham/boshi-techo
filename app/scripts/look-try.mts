// 見渡す気づき（lookAround）を、作った家族で試す。置き場は渡した BOSHI_DATA_DIR（わが家の app/data には触らない）
import path from "node:path";
import nextEnv from "@next/env";
const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
nextEnv.loadEnvConfig(process.env.ENV_DIR ?? APP);
if (!process.env.BOSHI_DATA_DIR) throw new Error("BOSHI_DATA_DIR を指定してください");
process.env.BOSHI_SIM_BUDGET_USD ??= "3";
const { SIM_FAMILIES } = await import("../src/sim/families");
const { DEMO_FAMILY } = await import("../src/lib/demo-family");
const { addDays } = await import("../src/lib/clock");
const { lookAround } = await import("../src/app/api/advisor/_lib/write");
const { lookBucket } = await import("../src/lib/advisor");
const { getKeep } = await import("../src/lib/keep");
const { doneSetFor } = await import("../src/app/api/done/_lib/done");
const cases = (process.argv.slice(2).length ? process.argv.slice(2) : ["sim-07@196", "sim-02@300", "demo-sato@230", "sim-04@120"]).map((x) => x.split("@"));
await Promise.all(
  cases.map(async ([id, day]) => {
    const f = id === DEMO_FAMILY.id ? DEMO_FAMILY : SIM_FAMILIES.find((s) => s.id === id)!;
    const today = addDays(addDays(f.dueDate, -280), Number(day));
    const t0 = Date.now();
    const a = await lookAround({ family: f, today, done: doneSetFor(f, today), isDemo: f.id === DEMO_FAMILY.id }, getKeep(f.id), `look:${lookBucket(f, today)}`);
    console.log(`\n=== ${id} ${today}（${((Date.now() - t0) / 1000).toFixed(0)}秒）\n${JSON.stringify(a, null, 1)}`);
  }),
);
