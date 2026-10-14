import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { StatusBadge } from "@/components/status-badge";
import { AUDIT_ACTIONS } from "@/domain/audit";
import { authorize, can } from "@/domain/permissions";
import { STATUSES, STATUS_LABELS } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatDateTime, pluralize } from "@/lib/format";
import { auditItemFiltersSchema, firstValues } from "@/lib/validation";
import { homePathFor, requireUser } from "@/server/auth";
import { AUDIT_ITEMS_PAGE_SIZE, getAuditCounts, getAuditItems, type AuditItem } from "@/server/queries/audit";
import { AuditFilters } from "./audit-filters";
import { AuditHeader, EventIcon, ExportProblem, listHref, Pagination, PermanentNote } from "./parts";

export const metadata: Metadata = { title: "Audit trail" };

const STATUS_OPTIONS = [{ value: "all", label: "All statuses" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))];

export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  const user = await requireUser();
  const access = authorize(user, "audit.view");
  if (!access.allowed) return <AccessDenied reason={access.reason} home={homePathFor(user.role)} />;

  const params = firstValues(await searchParams);
  const filters = auditItemFiltersSchema.parse(params);
  const [list, counts] = await Promise.all([getAuditItems(user, filters), getAuditCounts(user)]);
  const first = list.total === 0 ? 0 : (list.page - 1) * AUDIT_ITEMS_PAGE_SIZE + 1;
  const last = Math.min(list.total, list.page * AUDIT_ITEMS_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <AuditHeader active="items" counts={counts} canExport={can(user, "audit.export")} />
      <ExportProblem code={params.export} />
      <PermanentNote />

      <div className="rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <AuditFilters
            path="/audit"
            label="Find a queue item"
            q={filters.q}
            searchLabel="Search by asset, person or review number"
            placeholder="Asset, person or MKT-1017"
            select={{ name: "status", label: "Status", value: filters.status, options: STATUS_OPTIONS }}
          />
          <p className="text-xs tabular-nums text-ink-500">
            {first}–{last} of {list.total}
          </p>
        </div>

        {list.items.length === 0 ? (
          <p className="px-5 py-14 text-center text-sm text-ink-500">No queue items match these filters.</p>
        ) : (
          <ItemList items={list.items} />
        )}

        <Pagination
          page={list.page}
          pageCount={list.pageCount}
          href={(page) => listHref("/audit", { q: filters.q, status: filters.status, page })}
        />
      </div>
    </div>
  );
}

const trailHref = (item: AuditItem) => `/audit/${item.reference}`;

function Latest({ item, className }: { item: AuditItem; className?: string }) {
  return (
    <span className={cn("inline-flex items-start gap-2", className)}>
      {item.lastAction ? <EventIcon action={item.lastAction} /> : null}
      <span>
        <span className="block text-[0.8125rem] text-ink-800">{item.lastAction ? AUDIT_ACTIONS[item.lastAction] : "Recorded"}</span>
        <time dateTime={item.lastAt.toISOString()} className="block font-mono text-[0.6875rem] text-ink-500">
          {formatDateTime(item.lastAt)}
        </time>
      </span>
    </span>
  );
}

/** Newest activity first. Cards on smaller screens, a table from wide laptops up. */
function ItemList({ items }: { items: AuditItem[] }) {
  return (
    <>
      <ul aria-label="Queue items, most recent activity first" className="divide-y divide-line xl:hidden">
        {items.map((item) => (
          <li key={item.reference}>
            <Link href={trailHref(item)} className="block px-4 py-3 hover:bg-paper/50 sm:px-5">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-brand-700">{item.reference}</span>
                <StatusBadge status={item.status} />
              </span>
              <span className="mt-0.5 block text-[0.9375rem] font-medium text-ink-900">{item.title}</span>
              <span className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
                <span className="text-xs text-ink-500">
                  {item.submitter?.name ?? "Unknown"} · {pluralize(item.events, "event")}
                </span>
                <Latest item={item} />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="relative hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <caption className="sr-only">Queue items, most recent activity first</caption>
          <thead>
            <tr className="border-b border-line bg-paper/60">
              {["Queue item", "Status", "Submitted by", "Events", "Latest"].map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  className={cn("eyebrow px-3 py-2.5 font-medium text-ink-500", i === 0 && "pl-5", i === 3 && "text-right", i === 4 && "pr-5")}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((item) => (
              <tr key={item.reference} className="align-top hover:bg-paper/50">
                <td className="py-3 pl-5 pr-3">
                  <Link href={trailHref(item)} className="group block">
                    <span className="block font-mono text-xs text-brand-700 group-hover:underline">{item.reference}</span>
                    <span className="mt-0.5 block font-medium text-ink-900 group-hover:underline">{item.title}</span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-[0.8125rem] text-ink-700">{item.submitter?.name ?? "Unknown"}</td>
                <td className="px-3 py-3 text-right font-mono text-[0.8125rem] tabular-nums text-ink-700">{item.events}</td>
                <td className="whitespace-nowrap py-3 pl-3 pr-5">
                  <Latest item={item} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
