// 気づきの理由を文に分ける（表には1文目だけ、残りは「なぜ？」の奥へ）。AdvisorCard・ClosedAdvice と試験が同じ切り方を使う。
// 日本語・中文は「。」、English は「. 」で分ける（English の文は app/api/advisor/_lib/in-lang.ts が「 」でつないで返す）。
export const whyParts = (why: string): string[] =>
  why
    .split(/(?<=。)|(?<=[.!?])\s+|\n/)
    .map((x) => x.trim())
    .filter(Boolean);
