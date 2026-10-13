import type { VersionOutcome } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatShortDate, initials } from "@/lib/format";

const STYLE: Record<VersionOutcome, { label: string; color: string }> = {
  approved: { label: "Approved", color: "text-approve-600" },
  rejected: { label: "Rejected", color: "text-high-600" },
  changes_requested: { label: "Revise", color: "text-medium-600" },
};

/** A rubber stamp for the decision on a version: outcome, reviewer initials, date. */
export function DecisionStamp({
  outcome,
  decidedBy,
  decidedAt,
  className,
}: {
  outcome: VersionOutcome;
  decidedBy: string | null;
  decidedAt: Date;
  className?: string;
}) {
  const { label, color } = STYLE[outcome];
  return (
    <span className={cn("stamp opacity-90", color, className)} aria-label={`${label} by ${decidedBy ?? "reviewer"} on ${formatShortDate(decidedAt)}`}>
      <span className="text-[0.9375rem] font-medium">{label}</span>
      <span className="text-[0.5625rem]">
        {decidedBy ? initials(decidedBy) : "—"} · {formatShortDate(decidedAt)}
      </span>
    </span>
  );
}
