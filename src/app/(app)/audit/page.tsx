import { ChevronLeft, ChevronRight, Download, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { AUDIT_ICONS } from "@/components/timeline";
import { buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { AUDIT_ACTIONS, auditTone, type AuditTone } from "@/domain/audit";
import { authorize, can } from "@/domain/permissions";
import { ROLE_LABELS } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { auditFiltersSchema, firstValues, type AuditFilters as Filters } from "@/lib/validation";
import { homePathFor, requireUser } from "@/server/auth";
import { AUDIT_PAGE_SIZE, getAuditLog } from "@/server/queries/audit";
import { AuditFilters } from "./audit-filters";
import { exportProblemMessage } from "./export-problem";

export const metadata: Metadata = { title: "Audit trail" };

function pageHref(filters: Filters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.action !== "all") params.set("action", filters.action);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/audit?${qs}` : "/audit";
}

export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  const user = await requireUser();
  const access = authorize(user, "audit.view");
  if (!access.allowed) return <AccessDenied reason={access.reason} home={homePathFor(user.role)} />;

  const params = firstValues(await searchParams);
  const filters = auditFiltersSchema.parse(params);
  const exportProblem = exportProblemMessage(params.export);
  const log = await getAuditLog(user, filters);
  const canExport = can(user, "audit.export");
  const first = log.total === 0 ? 0 : (log.page - 1) * AUDIT_PAGE_SIZE + 1;
  const last = Math.min(log.total, log.page * AUDIT_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit trail"
        description="Every sign-in, submission, assignment, comment and decision, newest first, ready to hand to an examiner."
        actions={
          canExport ? (
            <form method="post" action="/audit/export">
              <button type="submit" className={buttonClasses({ variant: "primary" })}>
                <Download aria-hidden="true" />
                Download for Excel
              </button>
            </form>
          ) : (
            <span className="inline-flex flex-col items-start gap-1 sm:items-end">
              <button type="button" disabled className={buttonClasses({ variant: "secondary" })} aria-describedby="export-hint">
                <Download aria-hidden="true" />
                Download for Excel
              </button>
              <span id="export-hint" className="text-[0.6875rem] text-ink-500">
                Only the Compliance Lead can download the trail
              </span>
            </span>
          )
        }
      />

      {exportProblem ? (
        <Notice tone="error" role="alert">
          {exportProblem}
        </Notice>
      ) : null}

      <p className="flex items-start gap-2 text-[0.8125rem] text-ink-600">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
        Nothing recorded here can be edited or deleted, not even by Review Hub itself. Downloads are recorded too.
      </p>

      <div className="rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <AuditFilters q={filters.q} action={filters.action} />
          <p className="text-xs tabular-nums text-ink-500">
            {first}–{last} of {log.total}
          </p>
        </div>

        {log.rows.length === 0 ? (
          <p className="px-5 py-14 text-center text-sm text-ink-500">No events match these filters.</p>
        ) : (
          <>
            {/* Phones, tablets and small laptops: one card per event. */}
            <ol className="divide-y divide-line xl:hidden">
              {log.rows.map((row) => (
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
                      {row.reference ? <ReviewLink reference={row.reference} /> : null}
                      <span className="font-mono text-[0.625rem] tabular-nums text-ink-400">#{eventNumber(row.id)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {/* `relative` keeps the caption's screen-reader text inside the scroll box. */}
            <div className="relative hidden overflow-x-auto xl:block">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <caption className="sr-only">Audit events, newest first</caption>
                <thead>
                  <tr className="border-b border-line bg-paper/60">
                    {["#", "When", "Event", "What happened", "Who", "Review"].map((h, i) => (
                      <th key={h} scope="col" className={cn("eyebrow px-3 py-2.5 font-medium text-ink-500", i === 0 && "pl-5", i === 5 && "pr-5")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {log.rows.map((row) => (
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
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <Actor actor={row.actor} role={row.actorRole} />
                      </td>
                      <td className="whitespace-nowrap py-2.5 pl-3 pr-5">
                        {row.reference ? <ReviewLink reference={row.reference} /> : <span className="text-ink-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {log.pageCount > 1 ? (
          <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-5 py-3">
            <PageLink href={pageHref(filters, log.page - 1)} disabled={log.page <= 1} direction="prev" />
            <span className="text-xs tabular-nums text-ink-500">
              Page {log.page} of {log.pageCount}
            </span>
            <PageLink href={pageHref(filters, log.page + 1)} disabled={log.page >= log.pageCount} direction="next" />
          </nav>
        ) : null}
      </div>
    </div>
  );
}

type AuditRow = Awaited<ReturnType<typeof getAuditLog>>["rows"][number];

function eventNumber(id: number) {
  return String(id).padStart(5, "0");
}

const EVENT_TONE: Record<AuditTone, string> = {
  neutral: "text-ink-500",
  system: "text-ink-400",
  positive: "text-approve-600",
  warning: "text-medium-600",
  negative: "text-high-600",
};

function EventIcon({ action }: { action: AuditRow["action"] }) {
  const Icon = AUDIT_ICONS[action];
  return <Icon className={cn("mt-0.5 size-3.5 shrink-0", EVENT_TONE[auditTone(action)])} aria-hidden="true" />;
}

/** Who did it. Events with no person were recorded by Review Hub itself, like an automatic pre-check. */
function Actor({ actor, role, inline }: { actor: AuditRow["actor"]; role: AuditRow["actorRole"]; inline?: boolean }) {
  if (!actor) return <span className="text-[0.8125rem] text-ink-500">Review Hub (automatic)</span>;
  return (
    <span className={cn(inline && "flex items-baseline gap-1.5")}>
      <span className="block text-[0.8125rem] font-medium text-ink-900">{actor.name}</span>
      {role ? <span className="block text-[0.6875rem] text-ink-500">{ROLE_LABELS[role]}</span> : null}
    </span>
  );
}

function ReviewLink({ reference }: { reference: string }) {
  return (
    <Link href={`/submissions/${reference}`} className="font-mono text-xs text-brand-700 hover:underline">
      {reference}
    </Link>
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
