import { STATUS_LABELS, type Status } from "@/domain/types";
import { cn } from "@/lib/cn";

const STYLES: Record<Status, { text: string; mark: string }> = {
  submitted: { text: "text-ink-700", mark: "bg-ink-400" },
  in_review: { text: "text-brand-800", mark: "bg-brand-500" },
  changes_requested: { text: "text-medium-800", mark: "bg-medium-500" },
  approved: { text: "text-approve-700", mark: "bg-approve-500" },
  rejected: { text: "text-high-800", mark: "bg-high-600" },
};

/** Status as a word with a small square key, like a legend on a printed report. */
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const style = STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[0.8125rem] font-medium", style.text, className)}>
      <span className={cn("size-2 shrink-0 rounded-[1px]", style.mark)} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
