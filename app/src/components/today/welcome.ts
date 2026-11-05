// 「ようこそ」の1枚（WelcomeBaby.tsx）の言葉。画面を持たない純関数（早送りの試験から使う）。
import type { Family, Member } from "@/lib/demo-family";
import { t } from "@/lib/i18n";
import { jpShort } from "./dates";
import type { Task } from "./task";

/**
 * 出生届の一言。担当（今日の画面の「誰がやる？」）から組む。産んだ人には、休む事を先に言う。役の呼び名（ママ・パパ）は使わない。
 * 画面の言葉で返す（辞書は lib/i18n/dict/today.ts。サーバと試験ではいつも日本語）
 */
export function registrationLine(family: Family, me: Member | null, reg: (Task & { together?: boolean }) | undefined): string {
  if (!reg) return "";
  if (reg.status === "済み") return t("出生届は済みました。");
  // 戸籍法第49条: 生まれた日を含めて14日以内
  const until = reg.deadlineDate ? t("{date}まで", { date: jpShort(reg.deadlineDate) }) : t("14日以内");
  const mother = family.members.find((m) => m.role === "母");
  const rest = me?.role === "母" ? t("あなたは、休む事を一番に。") : mother ? t("{name}が休めるように。", { name: mother.name }) : "";
  if (family.members.length < 2) return t("出生届は{until}（14日以内）です。今日でなくて大丈夫です。届書を窓口へ持っていくのは、ほかの家族でもできます。", { until });
  if (reg.together) return t("出生届は、2人で出す事にしています（{until}）。{rest}", { until, rest: me?.role === "母" ? rest : "" });
  const person = reg.who === "家族" ? undefined : family.members.find((m) => m.role === reg.who);
  // 担当をまだ決めていない時も、産んだ人には休む事を先に（パートナーには「〇〇が休めるように」）
  if (!person) return t("出生届は{until}（14日以内）です。誰が出すかは、下の札で決められます。{rest}", { until, rest });
  if (me && person.id === me.id) return t("出生届は、あなたの番です（{until}）。{rest}", { until, rest: me.role === "母" ? "" : rest });
  return t("出生届は、{name}の番です（{until}）。{rest}", { name: person.name, until, rest: person.role === "母" ? "" : rest });
}
