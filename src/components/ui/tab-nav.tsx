import Link from "next/link";
import { cn } from "@/lib/cn";

export interface TabItem {
  key: string;
  href: string;
  label: string;
  count?: number;
  /** Read after the count by screen readers, e.g. "waiting on you". */
  countLabel?: string;
}

/** Views of one page, as links: each tab has its own address, so it can be bookmarked and shared. */
export function TabNav({ label, items, active, className }: { label: string; items: TabItem[]; active: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("border-b border-line", className)}>
      <ul className="-mb-px flex gap-6 overflow-x-auto scrollbar-thin">
        {items.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  // `relative` keeps the screen-reader text inside the scrolling row on narrow screens.
                  "relative inline-flex h-10 items-center gap-2 whitespace-nowrap border-b-2 text-sm font-medium transition-colors",
                  current ? "border-ink-900 text-ink-950" : "border-transparent text-ink-500 hover:border-line-strong hover:text-ink-900",
                )}
              >
                {tab.label}
                {tab.count ? (
                  <span className="rounded-sm bg-ink-900/[0.06] px-1.5 text-xs tabular-nums text-ink-700">
                    <span className="sr-only">(</span>
                    {tab.count}
                    {tab.countLabel ? <span className="sr-only"> {tab.countLabel})</span> : <span className="sr-only">)</span>}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
