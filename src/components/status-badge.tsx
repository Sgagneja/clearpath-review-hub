import { STATUS_LABELS, type Status } from "@/domain/types";
import { cn } from "@/lib/cn";

const STYLES: Record<Status, { box: string; dot: string }> = {
  submitted: { box: "bg-ink-50 text-ink-700 ring-ink-200", dot: "bg-ink-400" },
  in_review: { box: "bg-brand-50 text-brand-800 ring-brand-200", dot: "bg-brand-500" },
  changes_requested: { box: "bg-medium-50 text-medium-800 ring-medium-200", dot: "bg-medium-500" },
  approved: { box: "bg-approve-50 text-approve-700 ring-approve-100", dot: "bg-approve-500" },
  rejected: { box: "bg-high-50 text-high-800 ring-high-200", dot: "bg-high-600" },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        style.box,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot, status === "in_review" && "animate-pulse")} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
