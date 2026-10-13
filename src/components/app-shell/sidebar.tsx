import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { can } from "@/domain/permissions";
import type { CurrentUser } from "@/server/auth";
import type { Person } from "@/server/queries/directory";
import { Logo } from "../brand/logo";
import { MobileNav } from "./mobile-nav";
import { NavLinks, type NavItem } from "./nav-links";
import { PersonaSwitcher } from "./persona-switcher";

/**
 * Navigation is filtered by permission so people only see what they can use.
 * That is convenience, not security: every page and action checks again.
 */
function navItems(user: CurrentUser, queueCount: number): NavItem[] {
  const compliance = can(user, "queue.view_all");
  const items: (NavItem | false)[] = [
    can(user, "dashboard.view") && { key: "dashboard", href: "/dashboard", label: "Dashboard" },
    { key: "queue", href: "/queue", label: compliance ? "Review queue" : "My submissions", badge: queueCount },
    { key: "new", href: "/submissions/new", label: "New submission" },
    can(user, "import.run") && { key: "import", href: "/import", label: "Import" },
    can(user, "audit.view") && { key: "audit", href: "/audit", label: "Audit trail" },
    { key: "rules", href: "/rules", label: "Rule library" },
  ];
  return items.filter((i): i is NavItem => Boolean(i));
}

function DemoNote() {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-brand-500/10 px-3 py-2 text-[0.6875rem] leading-relaxed text-brand-100 ring-1 ring-inset ring-brand-400/20">
      <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-brand-300" aria-hidden="true" />
      <span>
        Demo environment. ClearPath Financial and all data are fictional. Switch personas below to see each role.
      </span>
    </p>
  );
}

export function Sidebar({ user, people, queueCount }: { user: CurrentUser; people: Person[]; queueCount: number }) {
  const items = navItems(user, queueCount);
  // Client props are serialised into the page: pass only what the switcher shows.
  const me = { id: user.id, name: user.name, role: user.role, title: user.title };
  const switcher = <PersonaSwitcher user={me} people={people} />;

  return (
    <>
      <MobileNav
        items={items}
        footer={
          <div className="space-y-3">
            <DemoNote />
            {switcher}
          </div>
        }
      />
      <aside className="sticky top-0 hidden h-screen flex-col bg-ink-950 lg:flex">
        <div className="px-5 pb-6 pt-6">
          <Link href="/" className="inline-block rounded-md">
            <Logo />
            <span className="sr-only">Home</span>
          </Link>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 scrollbar-thin">
          <p className="eyebrow px-3 pb-2 text-[0.5625rem] text-ink-500">Workspace</p>
          <NavLinks items={items} />
        </nav>
        <div className="space-y-3 border-t border-white/[0.06] p-3">
          <DemoNote />
          {switcher}
        </div>
      </aside>
    </>
  );
}
