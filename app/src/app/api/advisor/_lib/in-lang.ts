// 決まりで書いた気づき（理由に RULE_MARK の付いた物）を、頼みの言葉で組み直す（2026-11-05 多言語化③の漏れ: 中文・English でも
// 「美咲の育休の始まりを6月22日に数え直しました」が日本語のまま出ていた）。
// DB には日本語で残す（家族の誰がどの言葉で開いても、同じ1つの気づき）。画面へ返す時だけ、同じ決まり（lib/advisor.ts の ruleAdvice）を
// 頼みの言葉で回す。職場・役所あての文面（message）は、相手が読む日本語のまま。Claude が書いた気づき（見渡した物）は書いたまま。
import { factsIn, RULE_MARK, ruleAdvice, type Advice } from "@/lib/advisor";
import type { Family } from "@/lib/demo-family";
import { t, withLang, type Lang } from "@/lib/i18n";
import { dictFor } from "@/lib/i18n/dicts";
import { isMadeId, nameIn } from "@/lib/i18n/names";

export function adviceIn(advice: Advice, family: Family, lang: Lang): Advice {
  if (lang === "ja" || !advice.why.includes(RULE_MARK) || !advice.facts?.length) return advice;
  const mother = family.members.find((m) => m.role === "母")?.name;
  const partner = family.members.find((m) => m.role === "パートナー")?.name;
  // 書いた時に渡した名前を当てる（パートナーは働いている時だけ渡す＝lib/samples.ts）。日本語で回して、残した物と同じになる組を使う
  const tries = [
    { mother, partner },
    { mother, partner: undefined },
    { mother: undefined, partner },
    { mother: undefined, partner: undefined },
  ];
  const made = isMadeId(family.id);
  for (const c of tries) {
    const ja = withLang("ja", () => ruleAdvice(advice.facts, { today: advice.today, ...c }));
    if (!ja || ja.title !== advice.title || ja.plan.join("\n") !== advice.plan.join("\n") || !advice.why.startsWith(ja.why)) continue;
    // 理由の後ろに足した一言（lib/samples.ts の3つ: 体験版では Claude を呼ばない・上限に達した・鍵を入れると）
    const note = advice.why.slice(ja.why.length);
    return withLang(
      lang,
      () => {
        const out = ruleAdvice(advice.facts, { today: advice.today, mother: c.mother && nameIn(c.mother, { made }), partner: c.partner && nameIn(c.partner, { made }) });
        if (!out) return advice;
        const why = note ? [out.why, t(note)].join(lang === "en" ? " " : "") : out.why;
        return { ...advice, title: out.title, why, plan: out.plan, facts: factsIn(advice.facts) };
      },
      dictFor(lang),
    );
  }
  return advice;
}
