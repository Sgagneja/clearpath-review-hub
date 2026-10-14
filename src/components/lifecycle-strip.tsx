import { Check, X } from "lucide-react";
import type { LifecycleStep } from "@/domain/lifecycle";
import { cn } from "@/lib/cn";
import { formatCalendarDate, formatDateTime } from "@/lib/format";

function dotClasses(step: LifecycleStep): string {
  if (step.tone === "negative") return "bg-high-600 text-white";
  if (step.tone === "warning") return step.state === "upcoming" ? "bg-white text-medium-600 ring-2 ring-medium-500" : "bg-medium-500 text-white";
  if (step.state === "done") return "bg-brand-600 text-white";
  if (step.state === "current") return "bg-white text-brand-700 ring-2 ring-brand-500";
  return "bg-white text-ink-400 ring-1 ring-line-strong";
}

function detail(step: LifecycleStep): string {
  if (step.day) return formatCalendarDate(step.day);
  const parts = [step.by, step.at ? formatDateTime(step.at) : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Pending";
}

/**
 * The whole life of a submission in one row: submitted, every review round,
 * back with marketing, the decision, launch. Stacks into a list on phones.
 */
export function LifecycleStrip({ steps }: { steps: LifecycleStep[] }) {
  return (
    <ol className="grid gap-3 md:auto-cols-fr md:grid-flow-col md:gap-0" aria-label="Where this submission is">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li
            key={step.key}
            className="relative flex gap-3 md:flex-col md:gap-2 md:pr-4"
            aria-current={step.state === "current" ? "step" : undefined}
          >
            {last ? null : (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[0.6875rem] top-[1.375rem] -bottom-3 w-px md:bottom-auto md:left-7 md:right-1 md:top-[0.6875rem] md:h-px md:w-auto",
                  step.state === "done" ? "bg-brand-300" : "bg-line-strong",
                )}
              />
            )}
            <span className={cn("relative z-10 inline-flex size-[1.375rem] shrink-0 items-center justify-center rounded-full", dotClasses(step))}>
              {step.tone === "negative" ? (
                <X className="size-3" strokeWidth={3} aria-hidden="true" />
              ) : step.state === "done" ? (
                <Check className="size-3" strokeWidth={3} aria-hidden="true" />
              ) : step.state === "current" ? (
                <span className="size-1.5 rounded-full bg-brand-500" />
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.8125rem] font-semibold text-ink-900">
                {step.label}
                {step.state === "current" ? <span className="sr-only"> (now)</span> : null}
              </span>
              <span className="block truncate text-xs text-ink-500">{detail(step)}</span>
              {step.note ? (
                <span className={cn("mt-0.5 block text-xs", step.tone === "warning" && step.state === "upcoming" ? "font-medium text-medium-700" : "text-ink-500")}>
                  {step.note}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
