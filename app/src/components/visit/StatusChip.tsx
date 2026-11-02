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
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}
