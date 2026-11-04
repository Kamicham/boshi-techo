// 「ようこそ」の1枚（WelcomeBaby.tsx）の言葉。画面を持たない純関数（早送りの試験から使う）。
import type { Family, Member } from "@/lib/demo-family";
import { jpShort } from "./dates";
import type { Task } from "./task";

/** 出生届の一言。担当（今日の画面の「誰がやる？」）から組む。産んだ人には、休む事を先に言う。役の呼び名（ママ・パパ）は使わない */
export function registrationLine(family: Family, me: Member | null, reg: (Task & { together?: boolean }) | undefined): string {
  if (!reg) return "";
  if (reg.status === "済み") return "出生届は済みました。";
  // 戸籍法第49条: 生まれた日を含めて14日以内
  const until = reg.deadlineDate ? `${jpShort(reg.deadlineDate)}まで` : "14日以内";
  const mother = family.members.find((m) => m.role === "母");
  const rest = me?.role === "母" ? "あなたは、休む事を一番に。" : mother ? `${mother.name}が休めるように。` : "";
  if (family.members.length < 2) return `出生届は${until}（14日以内）です。今日でなくて大丈夫です。届書を窓口へ持っていくのは、ほかの家族でもできます。`;
  if (reg.together) return `出生届は、2人で出す事にしています（${until}）。${me?.role === "母" ? rest : ""}`;
  const person = reg.who === "家族" ? undefined : family.members.find((m) => m.role === reg.who);
  if (!person) return `出生届は${until}（14日以内）です。誰が出すかは、下の札で決められます。`;
  if (me && person.id === me.id) return `出生届は、あなたの番です（${until}）。${me.role === "母" ? "" : rest}`;
  return `出生届は、${person.name}の番です（${until}）。${person.role === "母" ? "" : rest}`;
}
