import Link from "next/link";
import { cn } from "@/lib/cn";

export interface SummaryItem {
  value: number | string;
  label: string;
  /** Where to see the work behind the number. */
  href?: string;
  /** Colours the figure when it needs someone's attention. */
  tone?: "high" | "medium";
}

/** A single line of figures in place of a row of tiles. Each one opens the work behind it. */
export function SummaryLine({ items, label = "At a glance" }: { items: SummaryItem[]; label?: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap items-baseline gap-x-7 gap-y-2 border-y border-line py-3">
      {items.map((item) => {
        const content = (
          <>
            <span
              className={cn(
                "text-xl font-semibold leading-none tabular-nums tracking-[-0.02em]",
                item.tone === "high" ? "text-high-700" : item.tone === "medium" ? "text-medium-700" : "text-ink-950",
              )}
            >
              {item.value}
            </span>
            <span className={cn("text-sm text-ink-600", item.href && "underline-offset-4 group-hover:text-ink-950 group-hover:underline")}>
              {item.label}
            </span>
          </>
        );
        return (
          <li key={item.label}>
            {item.href ? (
              <Link href={item.href} className="group inline-flex items-baseline gap-1.5">
                {content}
              </Link>
            ) : (
              <span className="inline-flex items-baseline gap-1.5">{content}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
