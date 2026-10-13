import { SEVERITY_LABELS, type Severity } from "@/domain/types";
import { cn } from "@/lib/cn";

/**
 * Severity is shown with a shape as well as a colour (▲ high, ◆ medium,
 * ● low) so it survives colour-blindness and greyscale printing.
 */
export function SeverityGlyph({ severity, className }: { severity: Severity; className?: string }) {
  const color = { high: "text-high-600", medium: "text-medium-500", low: "text-low-500" }[severity];
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className={cn("size-2.5 shrink-0", color, className)} fill="currentColor">
      {severity === "high" ? (
        <path d="M6 1.2 11.2 10.4H.8L6 1.2Z" />
      ) : severity === "medium" ? (
        <path d="M6 .8 11.2 6 6 11.2.8 6 6 .8Z" />
      ) : (
        <circle cx="6" cy="6" r="4.6" />
      )}
    </svg>
  );
}

export const SEVERITY_TEXT: Record<Severity, string> = {
  high: "text-high-700",
  medium: "text-medium-700",
  low: "text-low-700",
};

export const SEVERITY_FILL: Record<Severity, string> = {
  high: "bg-high-600",
  medium: "bg-medium-500",
  low: "bg-low-500",
};

export function SeverityTag({ severity, className }: { severity: Severity; className?: string }) {
  const box = {
    high: "bg-high-50 text-high-800 ring-high-200",
    medium: "bg-medium-50 text-medium-800 ring-medium-200",
    low: "bg-low-50 text-low-800 ring-low-200",
  }[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] ring-1 ring-inset",
        box,
        className,
      )}
    >
      <SeverityGlyph severity={severity} />
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
