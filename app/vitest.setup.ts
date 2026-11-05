// 試験の置き場（2026-11-05 監査）: 試験は、わが家の記録の置き場（app/data）に決して触れない。
// 試験の中で BOSHI_DATA_DIR を決めない試験にも、ここで一時の置き場を渡す（試験の中で決めた値はそのまま勝つ）。
// それでも開く道が app/data になった時は、lib/db.ts の assertNotHomeInTests が止める（二重の止め）。
// 注意: これで「BOSHI_DATA_DIR が無い＝わが家の置き場」の判定（isHomeDataDir）は、試験の中では偽になる。
// わが家の置き場の振る舞いを試す試験は、今までどおり試験の中で BOSHI_DATA_DIR を消して試す（開く道は一時の置き場のまま）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.BOSHI_DATA_DIR ??= fs.mkdtempSync(path.join(os.tmpdir(), "boshi-test-"));
