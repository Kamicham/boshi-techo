import { t } from "@/lib/i18n";
import { STATUS_LABEL, type VisitStatus } from "@/lib/visit";

const STYLE: Record<VisitStatus, string> = {
  ready: "bg-line text-muted",
  recording: "bg-rose-soft text-rose",
  transcribing: "bg-sky-soft text-sky",
  organizing: "bg-sky-soft text-sky",
  done: "bg-ok/10 text-ok",
  failed: "bg-alert/10 text-alert",
};

export function StatusChip({ status }: { status: VisitStatus }) {
  // 状態の札（STATUS_LABEL の日本語）は出す時に訳す。「これから」だけの鍵は手帳の見出し（以后・Coming up）の訳なので、
  // 健診の状態は空の {visit} を付けた鍵で引く（日本語は同じ。鍵は lib/i18n/dict/visit-home.ts）
  const label = status === "ready" ? t("これから{visit}", { visit: "" }) : t(STATUS_LABEL[status]);
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STYLE[status]}`}>{label}</span>;
}
