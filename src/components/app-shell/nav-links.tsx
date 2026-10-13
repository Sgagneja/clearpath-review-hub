"use client";

import { BookOpenCheck, FilePlus2, Import, Inbox, LayoutDashboard, ScrollText, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type NavKey = "dashboard" | "queue" | "new" | "import" | "audit" | "rules";

const ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  queue: Inbox,
  new: FilePlus2,
  import: Import,
  audit: ScrollText,
  rules: BookOpenCheck,
};

export interface NavItem {
  key: NavKey;
  href: string;
  label: string;
  badge?: number;
}

function isActive(pathname: string, item: NavItem) {
  if (item.key === "new") return pathname === "/submissions/new";
  if (item.key === "queue") return pathname === "/queue" || (pathname.startsWith("/submissions/") && pathname !== "/submissions/new");
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const active = isActive(pathname, item);
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                active ? "bg-white/[0.08] text-white" : "text-ink-300 hover:bg-white/[0.04] hover:text-white",
              )}
            >
              {active ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-300" /> : null}
              <Icon className={cn("size-4 shrink-0", active ? "text-brand-200" : "text-ink-400 group-hover:text-ink-200")} aria-hidden="true" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge ? (
                <span className={cn("text-xs tabular-nums", active ? "text-brand-100" : "text-ink-400 group-hover:text-ink-200")}>
                  <span className="sr-only">(</span>
                  {item.badge}
                  <span className="sr-only"> waiting on you)</span>
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
