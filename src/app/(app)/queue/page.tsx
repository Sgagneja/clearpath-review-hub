import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, FilePlus2, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { RiskPill } from "@/components/risk-meter";
import { SlaIndicator } from "@/components/sla";
import { StatusBadge } from "@/components/status-badge";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/domain/permissions";
import { CHANNEL_LABELS, PRODUCT_LINE_LABELS, STATUS_LABELS, type Status } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatCalendarDate, formatRelative } from "@/lib/format";
import { firstValues, QUEUE_SORTS, queueFiltersSchema, type QueueFilters as Filters } from "@/lib/validation";
import { requireUser } from "@/server/auth";
import { getDirectory } from "@/server/queries/directory";
import { getQueue, type QueueRow, type QueueSummary } from "@/server/queries/queue";
import { QueueFilters } from "./queue-filters";

export const metadata: Metadata = { title: "Queue" };

const DEFAULTS = queueFiltersSchema.parse({});

/** Each column's most useful first direction when you click it. */
const NATURAL_DIR: Record<Filters["sort"], Filters["dir"]> = {
  sla: "asc",
  risk: "desc",
  launch: "asc",
  updated: "desc",
  reference: "desc",
};

const SORT_LABELS: Record<Filters["sort"], string> = {
  sla: "Deadline",
  risk: "Risk",
  launch: "Launch date",
  updated: "Last update",
  reference: "Submitted",
};

function queueHref(filters: Filters, overrides: Partial<Filters> = {}) {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value !== DEFAULTS[key as keyof Filters]) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `/queue?${qs}` : "/queue";
}

export default async function QueuePage({ searchParams }: PageProps<"/queue">) {
  const user = await requireUser();
  const filters = queueFiltersSchema.parse(firstValues(await searchParams));
  const now = new Date();
  const [{ rows, summary, truncated }, directory] = await Promise.all([getQueue(user, filters, now), getDirectory()]);
  const compliance = can(user, "queue.view_all");
  const isFiltered = filters.q !== "" || filters.product !== "all" || filters.risk !== "all" || filters.assignee !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title={compliance ? "Review queue" : "My submissions"}
        description={
          compliance
            ? "Everything waiting on compliance, soonest deadline first. Riskier copy gets less time: 48 hours for high risk, 72 for medium, 120 for low."
            : "Track every asset you've sent to compliance. Anything sent back with changes is waiting on you."
        }
        actions={
          <Link href="/submissions/new" className={buttonClasses({ variant: "brand" })}>
            <FilePlus2 aria-hidden="true" />
            New submission
          </Link>
        }
      />

      <SummaryStrip summary={summary} compliance={compliance} filters={filters} />

      <div className="rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
        <div className="space-y-3 border-b border-line px-4 pb-3 pt-3 sm:px-5">
          <StatusTabs filters={filters} counts={summary.byStatus} />
          <QueueFilters
            filters={filters}
            reviewers={directory.people.filter((p) => p.role !== "submitter")}
            showAssignee={compliance}
            isFiltered={isFiltered}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyQueue filtered={isFiltered || filters.status !== "open"} compliance={compliance} />
        ) : (
          <>
            {/* Phones, tablets and small laptops: one card per review. */}
            <div className="xl:hidden">
              <SortBar filters={filters} />
              <ul className="divide-y divide-line">
                {rows.map((row) => (
                  <QueueCard key={row.reference} row={row} now={now} compliance={compliance} />
                ))}
              </ul>
            </div>

            {/* `relative` keeps the headers' screen-reader text inside the scroll box. */}
            <div className="relative hidden overflow-x-auto xl:block">
              {/* Fixed column widths, so the asset name gets whatever room is left rather than the scraps. */}
              <table className="w-full table-fixed text-left text-sm">
                <caption className="sr-only">
                  {rows.length} submissions, sorted by {SORT_LABELS[filters.sort].toLowerCase()},{" "}
                  {filters.dir === "asc" ? "ascending" : "descending"}
                </caption>
                <thead>
                  <tr className="border-b border-line bg-paper/60">
                    <SortHeader label="Submission" sort="reference" filters={filters} className="pl-6" />
                    {/* From 1536px the columns take a share of the width, so wide screens spread out evenly. */}
                    <th scope="col" className="eyebrow w-44 px-3 py-2.5 font-medium text-ink-500 2xl:w-[14%]">
                      Status · Reviewer
                    </th>
                    <SortHeader label="Risk" sort="risk" filters={filters} className="w-[6.75rem] 2xl:w-[9%]" />
                    <SortHeader label="Deadline" sort="sla" filters={filters} className="w-[10.5rem] 2xl:w-[13%]" />
                    <SortHeader label="Launch" sort="launch" filters={filters} className="w-[7.75rem] max-2xl:pr-5 2xl:w-[10%]" />
                    <SortHeader label="Updated" sort="updated" filters={filters} className="hidden w-28 pr-5 2xl:table-cell 2xl:w-[9%]" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((row) => (
                    <QueueTableRow key={row.reference} row={row} now={now} compliance={compliance} />
                  ))}
                </tbody>
              </table>
            </div>

            {truncated ? (
              <p className="border-t border-line px-5 py-3 text-xs text-ink-500">Showing the first 200 results. Narrow the filters to see the rest.</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryStrip({ summary, compliance, filters }: { summary: QueueSummary; compliance: boolean; filters: Filters }) {
  const items = compliance
    ? [
        { label: "open", value: summary.active, href: queueHref(filters, { status: "open", sort: "sla", dir: "asc" }) },
        { label: "overdue", value: summary.overdue, tone: summary.overdue ? "high" : undefined, href: queueHref(filters, { status: "open", sort: "sla", dir: "asc" }) },
        { label: "due within 12 hours", value: summary.dueSoon, tone: summary.dueSoon ? "medium" : undefined, href: queueHref(filters, { status: "open", sort: "sla", dir: "asc" }) },
        { label: summary.launchAtRisk === 1 ? "launch at risk" : "launches at risk", value: summary.launchAtRisk, tone: summary.launchAtRisk ? "medium" : undefined, href: queueHref(filters, { status: "open", sort: "launch", dir: "asc" }) },
        { label: "unassigned", value: summary.unassigned, href: queueHref(filters, { status: "submitted", assignee: "unassigned" }) },
      ]
    : [
        { label: "with compliance", value: summary.active, href: queueHref(filters, { status: "open" }) },
        { label: "need your changes", value: summary.byStatus.changes_requested, tone: summary.byStatus.changes_requested ? "medium" : undefined, href: queueHref(filters, { status: "changes_requested" }) },
        { label: "approved", value: summary.byStatus.approved, href: queueHref(filters, { status: "approved" }) },
        { label: "rejected", value: summary.byStatus.rejected, href: queueHref(filters, { status: "rejected" }) },
      ];

  return (
    <ul aria-label="At a glance" className="flex flex-wrap items-baseline gap-x-7 gap-y-2 border-y border-line py-3">
      {items.map((item) => (
        <li key={item.label}>
          <Link href={item.href} className="group inline-flex items-baseline gap-1.5">
            <span
              className={cn(
                "text-xl font-semibold leading-none tabular-nums tracking-[-0.02em]",
                item.tone === "high" ? "text-high-700" : item.tone === "medium" ? "text-medium-700" : "text-ink-950",
              )}
            >
              {item.value}
            </span>
            <span className="text-sm text-ink-600 underline-offset-4 group-hover:text-ink-950 group-hover:underline">{item.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const TABS: (Status | "open" | "all")[] = ["open", "submitted", "in_review", "changes_requested", "approved", "rejected", "all"];

function StatusTabs({ filters, counts }: { filters: Filters; counts: QueueSummary["byStatus"] }) {
  return (
    <nav aria-label="Status" className="relative -mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-1 px-1">
        {TABS.map((tab) => {
          const active = filters.status === tab;
          const label = tab === "open" ? "Open" : tab === "all" ? "All" : STATUS_LABELS[tab];
          return (
            <li key={tab}>
              <Link
                href={queueHref(filters, { status: tab })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[0.8125rem] font-medium transition-colors",
                  active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-900/5 hover:text-ink-900",
                )}
              >
                {label}
                <span className={cn("text-xs tabular-nums", active ? "text-ink-300" : "text-ink-400")}>{counts[tab]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SortHeader({ label, sort, filters, className }: { label: string; sort: Filters["sort"]; filters: Filters; className?: string }) {
  const active = filters.sort === sort;
  const nextDir = active ? (filters.dir === "asc" ? "desc" : "asc") : NATURAL_DIR[sort];
  const Icon = active ? (filters.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th scope="col" aria-sort={active ? (filters.dir === "asc" ? "ascending" : "descending") : undefined} className={cn("px-3 py-2.5", className)}>
      <Link
        href={queueHref(filters, { sort, dir: nextDir })}
        className={cn("eyebrow inline-flex items-center gap-1 font-medium hover:text-ink-900", active ? "text-ink-900" : "text-ink-500")}
      >
        {label}
        <Icon className={cn("size-3", !active && "opacity-50")} aria-hidden="true" />
        <span className="sr-only">, sort {nextDir === "asc" ? "ascending" : "descending"}</span>
      </Link>
    </th>
  );
}

/** Sorting for the card list, where there are no column headers to click. */
function SortBar({ filters }: { filters: Filters }) {
  return (
    <nav aria-label="Sort" className="relative overflow-x-auto border-b border-line bg-paper/60">
      <ul className="flex min-w-max items-center gap-1 px-3 py-1.5 sm:px-4">
        <li className="eyebrow pl-1 pr-1.5 text-ink-400" aria-hidden="true">
          Sort
        </li>
        {QUEUE_SORTS.map((sort) => {
          const active = filters.sort === sort;
          const nextDir = active ? (filters.dir === "asc" ? "desc" : "asc") : NATURAL_DIR[sort];
          const Icon = filters.dir === "asc" ? ArrowUp : ArrowDown;
          return (
            <li key={sort}>
              <Link
                href={queueHref(filters, { sort, dir: nextDir })}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
                  active ? "bg-white text-ink-900 shadow-[var(--shadow-card)] ring-1 ring-line" : "text-ink-500 hover:text-ink-900",
                )}
              >
                {SORT_LABELS[sort]}
                {active ? <Icon className="size-3" aria-hidden="true" /> : null}
                <span className="sr-only">, sort {nextDir === "asc" ? "ascending" : "descending"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Overdue rows get a red hatched edge, launch-at-risk rows an amber one. */
function rowEdge(row: QueueRow) {
  return row.sla.state === "overdue" ? "text-high-500" : row.launchAtRisk ? "text-medium-500" : null;
}

function QueueCard({ row, now, compliance }: { row: QueueRow; now: Date; compliance: boolean }) {
  const edge = rowEdge(row);
  return (
    <li className={cn("group relative px-4 py-3.5 transition-colors hover:bg-paper/70 sm:px-5", row.sla.state === "overdue" && "bg-high-50/40")}>
      {edge ? <span aria-hidden="true" className={cn("hatch absolute inset-y-0 left-0 w-1.5", edge)} /> : null}
      <div className="flex items-start justify-between gap-4">
        <Link
          href={`/submissions/${row.reference}`}
          className="min-w-0 font-medium leading-snug text-ink-950 after:absolute after:inset-0 after:content-[''] group-hover:text-brand-700"
        >
          {row.title}
        </Link>
        <span className="shrink-0 pt-0.5">
          <RiskPill score={row.riskScore} level={row.riskLevel} />
        </span>
      </div>
      <SubmissionDetails row={row} compliance={compliance} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <StatusBadge status={row.status} />
          <Assignee person={row.assignee} />
        </div>
        <div className="w-40">
          <SlaIndicator sla={row.sla} now={now} compact />
        </div>
      </div>
      <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
        <span className={cn("inline-flex items-center gap-1", row.launchAtRisk && "font-semibold text-medium-700")}>
          <CalendarClock className="size-3" aria-hidden="true" />
          Launches {formatCalendarDate(row.targetLaunchDate)}
          {row.launchAtRisk ? " · at risk" : null}
        </span>
        <span className="text-ink-400">Updated {formatRelative(row.updatedAt, now)}</span>
      </p>
    </li>
  );
}

function SubmissionDetails({ row, compliance }: { row: QueueRow; compliance: boolean }) {
  const parts = [
    PRODUCT_LINE_LABELS[row.productLine],
    CHANNEL_LABELS[row.channel],
    row.version > 1 ? `Version ${row.version}` : null,
    compliance && row.submitter ? row.submitter.name : null,
  ].filter((part) => part !== null);
  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-500">
      <span className="font-mono text-[0.6875rem] text-ink-700">{row.reference}</span>
      {parts.map((part) => (
        <Fragment key={part}>
          <span aria-hidden="true">·</span>
          <span>{part}</span>
        </Fragment>
      ))}
    </p>
  );
}

function Assignee({ person }: { person: QueueRow["assignee"] }) {
  return (
    <span className={cn("block max-w-full truncate whitespace-nowrap text-[0.8125rem]", person ? "text-ink-800" : "italic text-ink-400")}>
      {person ? person.name : "Unassigned"}
    </span>
  );
}

function QueueTableRow({ row, now, compliance }: { row: QueueRow; now: Date; compliance: boolean }) {
  const edge = rowEdge(row);
  return (
    <tr className={cn("group relative transition-colors hover:bg-paper/70", row.sla.state === "overdue" && "bg-high-50/40")}>
      <td className="py-3 pl-6 pr-3">
        {edge ? <span aria-hidden="true" className={cn("hatch absolute inset-y-0 left-0 w-1.5", edge)} /> : null}
        <Link
          href={`/submissions/${row.reference}`}
          className="font-medium text-ink-950 after:absolute after:inset-0 after:content-[''] hover:text-brand-700 group-hover:underline group-hover:decoration-ink-300 group-hover:underline-offset-4"
        >
          {row.title}
        </Link>
        <SubmissionDetails row={row} compliance={compliance} />
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={row.status} />
        <div className="mt-2">
          <Assignee person={row.assignee} />
        </div>
      </td>
      <td className="px-3 py-3">
        <RiskPill score={row.riskScore} level={row.riskLevel} />
      </td>
      <td className="px-3 py-3">
        <SlaIndicator sla={row.sla} now={now} compact />
      </td>
      <td className="px-3 py-3 max-2xl:pr-5">
        <span className="whitespace-nowrap text-[0.8125rem] text-ink-800">{formatCalendarDate(row.targetLaunchDate)}</span>
        {row.launchAtRisk ? (
          <span className="mt-1 flex items-center gap-1 whitespace-nowrap text-[0.6875rem] font-semibold text-medium-700">
            <CalendarClock className="size-3" aria-hidden="true" />
            Launch at risk
          </span>
        ) : null}
        <span className="mt-1 block text-xs text-ink-400 2xl:hidden">
          Updated <span className="whitespace-nowrap">{formatRelative(row.updatedAt, now)}</span>
        </span>
      </td>
      <td className="hidden whitespace-nowrap py-3 pl-3 pr-5 text-xs text-ink-500 2xl:table-cell">
        {formatRelative(row.updatedAt, now)}
      </td>
    </tr>
  );
}

function EmptyQueue({ filtered, compliance }: { filtered: boolean; compliance: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <Inbox className="size-6 text-ink-300" aria-hidden="true" />
      <p className="mt-3 font-medium text-ink-900">{filtered ? "Nothing matches these filters" : compliance ? "The queue is clear" : "No submissions yet"}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-500">
        {filtered
          ? "Try a different status or clear the filters."
          : compliance
            ? "New submissions land here the moment marketing sends them."
            : "Send your first asset to compliance and it'll show up here with its review deadline."}
      </p>
      {filtered ? (
        <Link href="/queue" className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-5" })}>
          Back to open items
        </Link>
      ) : null}
    </div>
  );
}
