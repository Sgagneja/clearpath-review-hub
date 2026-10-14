import { ChevronLeft, ChevronRight, Download, Lock } from "lucide-react";
import Link from "next/link";
import { AUDIT_ICONS } from "@/components/timeline";
import { buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { TabNav } from "@/components/ui/tab-nav";
import { AUDIT_ACTIONS, auditTone, type AuditAction, type AuditTone } from "@/domain/audit";
import { ROLE_LABELS } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { AuditRow } from "@/server/queries/audit";
import { exportProblemMessage } from "./export-problem";

/**
 * Download for Excel. The lead gets the button; reviewers see why they don't.
 * With a reference, the file is that queue item's trail; without, everything.
 */
export function ExportButton({ canExport, reference }: { canExport: boolean; reference?: string }) {
  if (canExport) {
    return (
      <form method="post" action="/audit/export">
        {reference ? <input type="hidden" name="reference" value={reference} /> : null}
        <button type="submit" className={buttonClasses({ variant: "primary" })}>
          <Download aria-hidden="true" />
          Download for Excel
        </button>
      </form>
    );
  }
  return (
    <span className="inline-flex flex-col items-start gap-1 sm:items-end">
      <button type="button" disabled className={buttonClasses({ variant: "secondary" })} aria-describedby="export-hint">
        <Download aria-hidden="true" />
        Download for Excel
      </button>
      <span id="export-hint" className="text-[0.6875rem] text-ink-500">
        Only the Compliance Lead can download the trail
      </span>
    </span>
  );
}

export function ExportProblem({ code }: { code: string | undefined }) {
  const message = exportProblemMessage(code);
  if (!message) return null;
  return (
    <Notice tone="error" role="alert">
      {message}
    </Notice>
  );
}

export function PermanentNote() {
  return (
    <p className="flex items-start gap-2 text-[0.8125rem] text-ink-600">
      <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
      Nothing recorded here can be edited or deleted, not even by Review Hub itself. Downloads are recorded too.
    </p>
  );
}

type View = "items" | "activity";

const DESCRIPTIONS: Record<View, string> = {
  items:
    "The record of every queue item: who submitted, assigned, reviewed, commented and decided, and when. Open one to read its trail from start to finish.",
  activity: "The team's own activity, kept apart from the queue items: who signed in and out, which trackers came in, and who downloaded the trail.",
};

/**
 * Top of the audit trail. Queue items come first, because that's what an
 * examiner asks about; the team's own activity is one tab over.
 */
export function AuditHeader({ active, counts, canExport }: { active: View; counts: { items: number; activity: number }; canExport: boolean }) {
  return (
    <div>
      <PageHeader title="Audit trail" description={DESCRIPTIONS[active]} actions={<ExportButton canExport={canExport} />} />
      <TabNav
        label="Audit trail"
        active={active}
        className="mt-5"
        items={[
          { key: "items", href: "/audit", label: "Queue items", count: counts.items, countLabel: "queue items" },
          { key: "activity", href: "/audit/activity", label: "Sign-ins, imports and downloads", count: counts.activity, countLabel: "events" },
        ]}
      />
    </div>
  );
}

export function eventNumber(id: number) {
  return String(id).padStart(5, "0");
}

const EVENT_TONE: Record<AuditTone, string> = {
  neutral: "text-ink-500",
  system: "text-ink-400",
  positive: "text-approve-600",
  warning: "text-medium-600",
  negative: "text-high-600",
};

export function EventIcon({ action }: { action: AuditAction }) {
  const Icon = AUDIT_ICONS[action];
  return <Icon className={cn("mt-0.5 size-3.5 shrink-0", EVENT_TONE[auditTone(action)])} aria-hidden="true" />;
}

/** Who did it. Events with no person were recorded by Review Hub itself, like an automatic pre-check. */
export function Actor({ actor, role, inline }: { actor: AuditRow["actor"]; role: AuditRow["actorRole"]; inline?: boolean }) {
  if (!actor) return <span className="text-[0.8125rem] text-ink-500">Review Hub (automatic)</span>;
  return (
    <span className={cn(inline && "flex items-baseline gap-1.5")}>
      <span className="block text-[0.8125rem] font-medium text-ink-900">{actor.name}</span>
      {role ? <span className="block text-[0.6875rem] text-ink-500">{ROLE_LABELS[role]}</span> : null}
    </span>
  );
}

/**
 * Events as cards on smaller screens and a table from wide laptops up.
 * `caption` names the list for screen readers, including its order.
 */
export function EventList({ rows, caption }: { rows: AuditRow[]; caption: string }) {
  return (
    <>
      <ol aria-label={caption} className="divide-y divide-line xl:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex gap-3 px-4 py-3 sm:px-5">
            <EventIcon action={row.action} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-[0.8125rem] font-medium text-ink-900">{AUDIT_ACTIONS[row.action]}</span>
                <time dateTime={row.occurredAt.toISOString()} className="font-mono text-[0.6875rem] text-ink-500">
                  {formatDateTime(row.occurredAt)}
                </time>
              </p>
              <p className="mt-0.5 text-[0.8125rem] text-ink-700">{row.summary}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <Actor actor={row.actor} role={row.actorRole} inline />
                <span className="font-mono text-[0.625rem] tabular-nums text-ink-400">#{eventNumber(row.id)}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* `relative` keeps the caption's screen-reader text inside the scroll box. */}
      <div className="relative hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line bg-paper/60">
              {["#", "When", "Event", "What happened", "Who"].map((h, i) => (
                <th key={h} scope="col" className={cn("eyebrow px-3 py-2.5 font-medium text-ink-500", i === 0 && "pl-5", i === 4 && "pr-5")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.id} className="align-top hover:bg-paper/50">
                <td className="py-2.5 pl-5 pr-3 font-mono text-[0.6875rem] tabular-nums text-ink-400">{eventNumber(row.id)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[0.6875rem] text-ink-600">
                  <time dateTime={row.occurredAt.toISOString()}>{formatDateTime(row.occurredAt)}</time>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="inline-flex items-center gap-2 text-[0.8125rem] font-medium text-ink-800">
                    <EventIcon action={row.action} />
                    {AUDIT_ACTIONS[row.action]}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[0.8125rem] text-ink-700">{row.summary}</td>
                <td className="whitespace-nowrap py-2.5 pl-3 pr-5">
                  <Actor actor={row.actor} role={row.actorRole} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Pagination({ page, pageCount, href }: { page: number; pageCount: number; href: (page: number) => string }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-5 py-3">
      <PageLink href={href(page - 1)} disabled={page <= 1} direction="prev" />
      <span className="text-xs tabular-nums text-ink-500">
        Page {page} of {pageCount}
      </span>
      <PageLink href={href(page + 1)} disabled={page >= pageCount} direction="next" />
    </nav>
  );
}

function PageLink({ href, disabled, direction }: { href: string; disabled: boolean; direction: "prev" | "next" }) {
  const label = direction === "prev" ? "Newer" : "Older";
  const content =
    direction === "prev" ? (
      <>
        <ChevronLeft aria-hidden="true" /> {label}
      </>
    ) : (
      <>
        {label} <ChevronRight aria-hidden="true" />
      </>
    );
  if (disabled) {
    return (
      <span aria-disabled="true" className={buttonClasses({ variant: "ghost", size: "sm", className: "pointer-events-none opacity-40" })}>
        {content}
      </span>
    );
  }
  return (
    <Link href={href} rel={direction} className={buttonClasses({ variant: "secondary", size: "sm" })}>
      {content}
    </Link>
  );
}

/** Builds a list page's address from its filters, leaving defaults out so links stay short. */
export function listHref(path: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === "all" || (key === "page" && value === 1)) continue;
    query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}
