import { Check, X } from "lucide-react";
import type { VersionOutcome } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";

interface Step {
  label: string;
  detail: string;
  state: "done" | "current" | "upcoming";
  tone?: "positive" | "warning" | "negative";
}

const OUTCOME_LABEL: Record<VersionOutcome, string> = {
  approved: "Approved",
  changes_requested: "Changes requested",
  rejected: "Rejected",
};

/** Submitted → In review → Decision for the version on screen. */
export function ReviewProgress({
  version,
  submittedAt,
  submittedBy,
  reviewStartedAt,
  reviewer,
  assignee,
  decidedAt,
  decidedBy,
  outcome,
}: {
  version: number;
  submittedAt: Date;
  submittedBy: string | null;
  reviewStartedAt: Date | null;
  reviewer: string | null;
  assignee: string | null;
  decidedAt: Date | null;
  decidedBy: string | null;
  outcome: VersionOutcome | null;
}) {
  const reviewStep = (): Step => {
    if (reviewStartedAt) {
      return { label: "In review", detail: `${reviewer ?? "Reviewer"} · ${formatDateTime(reviewStartedAt)}`, state: decidedAt ? "done" : "current" };
    }
    // Imported history records the decision but not when the review began.
    if (decidedAt) return { label: "Reviewed", detail: reviewer ?? decidedBy ?? "Reviewer", state: "done" };
    return { label: "Waiting for a reviewer", detail: assignee ? `Assigned to ${assignee}` : "Unassigned", state: "current" };
  };

  const steps: Step[] = [
    {
      label: `Version ${version} submitted`,
      detail: `${submittedBy ?? "Unknown"} · ${formatDateTime(submittedAt)}`,
      state: "done",
    },
    reviewStep(),
    decidedAt && outcome
      ? {
          label: OUTCOME_LABEL[outcome],
          detail: `${decidedBy ?? "Reviewer"} · ${formatDateTime(decidedAt)}`,
          state: "done",
          tone: outcome === "approved" ? "positive" : outcome === "rejected" ? "negative" : "warning",
        }
      : { label: "Decision", detail: "Pending", state: "upcoming" },
  ];

  return (
    <ol className="grid gap-3 sm:grid-cols-3 sm:gap-0" aria-label="Review progress">
      {steps.map((step, i) => {
        const dot =
          step.tone === "negative"
            ? "bg-high-600 text-white"
            : step.tone === "warning"
              ? "bg-medium-500 text-white"
              : step.state === "done"
                ? "bg-brand-600 text-white"
                : step.state === "current"
                  ? "bg-white text-brand-700 ring-2 ring-brand-500"
                  : "bg-white text-ink-400 ring-1 ring-line-strong";
        return (
          <li key={step.label} className="relative flex gap-3 sm:flex-col sm:gap-2 sm:pr-4" aria-current={step.state === "current" ? "step" : undefined}>
            {i < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute hidden h-px sm:left-7 sm:right-1 sm:top-[0.6875rem] sm:block",
                  step.state === "done" ? "bg-brand-300" : "bg-line-strong",
                )}
              />
            ) : null}
            <span className={cn("relative z-10 inline-flex size-[1.375rem] shrink-0 items-center justify-center rounded-full", dot)}>
              {step.tone === "negative" ? (
                <X className="size-3" strokeWidth={3} aria-hidden="true" />
              ) : step.state === "done" ? (
                <Check className="size-3" strokeWidth={3} aria-hidden="true" />
              ) : step.state === "current" ? (
                <span className="size-1.5 rounded-full bg-brand-500" />
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.8125rem] font-semibold text-ink-900">{step.label}</span>
              <span className="block truncate text-xs text-ink-500">{step.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
