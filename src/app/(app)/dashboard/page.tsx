import { ArrowRight, CalendarClock, Hourglass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { SeverityGlyph } from "@/components/severity";
import { SlaIndicator } from "@/components/sla";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardNote } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { STAGE_LABELS } from "@/domain/metrics";
import { authorize } from "@/domain/permissions";
import { ROLE_LABELS, SEVERITIES } from "@/domain/types";
import { niceAxis } from "@/lib/axis";
import { cn } from "@/lib/cn";
import { formatHours, formatPercent, formatShortDate, pluralize } from "@/lib/format";
import { homePathFor, requireUser } from "@/server/auth";
import { getDashboard, type Dashboard } from "@/server/queries/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const access = authorize(user, "dashboard.view");
  if (!access.allowed) return <AccessDenied reason={access.reason} home={homePathFor(user.role)} />;

  const now = new Date();
  const data = await getDashboard(user, now);

  return (
    <div className="space-y-6">
      <PageHeader
        context={`${formatShortDate(data.weeks[0].weekStart)} – ${formatShortDate(now)}`}
        title="Review throughput"
        description="How fast copy moves from submission to decision, where it waits, and which guidelines marketing trips over most."
        actions={
          <Link href="/queue" className={buttonClasses({ variant: "secondary" })}>
            Open the queue
            <ArrowRight aria-hidden="true" />
          </Link>
        }
      />

      <Kpis data={data} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <ThroughputChart weeks={data.weeks} />
        <StageChart data={data} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Attention data={data} now={now} />
        <Workload data={data} />
      </div>

      <TopRules data={data} />
    </div>
  );
}

function Kpis({ data }: { data: Dashboard }) {
  const { totals } = data;
  const tiles = [
    {
      label: "Typical turnaround",
      value: formatHours(data.cycleTime.medianHours),
      note: `First submission to final decision · ${pluralize(data.cycleTime.count, "asset")}`,
    },
    {
      label: "Decided on time",
      value: formatPercent(data.slaHit.rate),
      note: `${data.slaHit.numerator} of ${data.slaHit.denominator} review rounds decided before the deadline`,
      bar: data.slaHit.rate,
    },
    {
      label: "Approved first time",
      value: formatPercent(data.firstPass.rate),
      note: `${data.firstPass.numerator} of ${data.firstPass.denominator} approved without a revision`,
      bar: data.firstPass.rate,
    },
  ];

  // One sheet of figures. The 1px gaps over a line-coloured background draw the
  // rules between cells, whether they sit four across or two by two.
  return (
    <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line shadow-[var(--shadow-card)] sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((t) => (
        <li key={t.label} className="bg-white px-5 py-4">
          <p className="eyebrow text-ink-500">{t.label}</p>
          <p className="figure mt-1.5">{t.value}</p>
          {t.bar !== undefined && t.bar !== null ? (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round(t.bar * 100)}%` }} />
            </div>
          ) : null}
          <p className="mt-2 text-xs text-ink-500">{t.note}</p>
        </li>
      ))}
      <li className="bg-white px-5 py-4">
        <p className="eyebrow text-ink-500">Open with compliance</p>
        <p className="mt-1.5 flex items-baseline gap-3">
          <span className="figure">{totals.active}</span>
          <span className="text-sm">
            <span className="sr-only">open, </span>
            {totals.overdue ? <span className="font-semibold text-high-700">{totals.overdue} overdue</span> : <span className="text-ink-500">none overdue</span>}
          </span>
        </p>
        <div className="mt-3 flex h-1 overflow-hidden rounded-full bg-ink-100" aria-label={`${totals.activeByRisk.high} high, ${totals.activeByRisk.medium} medium, ${totals.activeByRisk.low} low risk`} role="img">
          {SEVERITIES.map((s) => (
            <span
              key={s}
              className={cn(s === "high" ? "bg-high-500" : s === "medium" ? "bg-medium-500" : "bg-low-500")}
              style={{ width: totals.active ? `${(totals.activeByRisk[s] / totals.active) * 100}%` : 0 }}
            />
          ))}
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-ink-500">
          {SEVERITIES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <SeverityGlyph severity={s} className="size-2" />
              {totals.activeByRisk[s]} {s}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3" aria-hidden="true" />
            {totals.launchAtRisk} launch at risk
          </span>
        </p>
      </li>
    </ul>
  );
}

function ThroughputChart({ weeks }: { weeks: Dashboard["weeks"] }) {
  const { top, ticks } = niceAxis(Math.max(...weeks.map((w) => Math.max(w.approved + w.changesRequested + w.rejected, w.submitted))));
  const series = [
    { key: "approved", label: "Approved", className: "bg-approve-500" },
    { key: "changesRequested", label: "Changes requested", className: "bg-medium-500" },
    { key: "rejected", label: "Rejected", className: "bg-high-600" },
  ] as const;

  return (
    <Card aria-labelledby="throughput-title" className="flex flex-col">
      <CardHeader titleId="throughput-title" title="Decisions per week" />
      <CardBody className="flex-1">
        <ul aria-hidden="true" className="mb-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
          {series.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-sm", s.className)} />
              {s.label}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-ink-900" />
            New submissions
          </li>
        </ul>
        <div className="relative h-56 2xl:h-72" aria-hidden="true">
          {[0, ...ticks].map((tick) => (
            <span
              key={tick}
              className={cn("absolute inset-x-0 border-t sm:left-6", tick === 0 ? "border-line-strong" : "border-dashed border-line")}
              style={{ bottom: `${(tick / top) * 100}%` }}
            >
              <span className="absolute -top-2 right-full mr-2 hidden font-mono text-[0.625rem] tabular-nums text-ink-400 sm:block">{tick}</span>
            </span>
          ))}
          <div className="absolute inset-0 flex items-end gap-2 sm:ml-6 sm:gap-3">
            {weeks.map((w) => {
              const total = w.approved + w.changesRequested + w.rejected;
              return (
                <div key={w.weekStart.toISOString()} className="relative flex h-full flex-1 flex-col justify-end">
                  <div className="mx-auto flex w-full max-w-11 flex-col-reverse overflow-hidden rounded-t-[4px] 2xl:max-w-16" style={{ height: `${(total / top) * 100}%` }}>
                    {series.map((s) => (
                      <span key={s.key} className={s.className} style={{ height: total ? `${(w[s.key] / total) * 100}%` : 0 }} />
                    ))}
                  </div>
                  {w.submitted > 0 ? (
                    <span className="absolute inset-x-1 h-0.5 rounded-full bg-ink-900" style={{ bottom: `${(w.submitted / top) * 100}%` }} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex gap-2 sm:ml-6 sm:gap-3" aria-hidden="true">
          {weeks.map((w) => (
            <span key={w.weekStart.toISOString()} className="flex-1 text-center font-mono text-[0.625rem] text-ink-400">
              {formatShortDate(w.weekStart)}
            </span>
          ))}
        </div>
        {/* Tables won't shrink to sr-only's 1px, so the wrapper does the hiding. */}
        <div className="sr-only">
          <table>
            <caption>Decisions and new submissions per week</caption>
            <thead>
              <tr>
                <th scope="col">Week of</th>
                <th scope="col">Approved</th>
                <th scope="col">Changes requested</th>
                <th scope="col">Rejected</th>
                <th scope="col">New submissions</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.weekStart.toISOString()}>
                  <th scope="row">{formatShortDate(w.weekStart)}</th>
                  <td>{w.approved}</td>
                  <td>{w.changesRequested}</td>
                  <td>{w.rejected}</td>
                  <td>{w.submitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
      <CardNote>Every review round counts, including ones sent back for changes.</CardNote>
    </Card>
  );
}

function StageChart({ data }: { data: Dashboard }) {
  const max = Math.max(1, ...data.stages.map((s) => s.meanHours ?? 0));
  return (
    <Card aria-labelledby="stages-title" className="flex flex-col">
      <CardHeader titleId="stages-title" title="Where work waits" />
      <CardBody className="flex-1 space-y-5">
        {data.stages.map((stage) => {
          const isBottleneck = data.bottleneck?.stage === stage.stage;
          return (
            <div key={stage.stage}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-ink-800">
                  {STAGE_LABELS[stage.stage]}
                  {isBottleneck ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-medium-700">
                      <Hourglass className="size-3" aria-hidden="true" /> Slowest stage
                    </span>
                  ) : null}
                </p>
                <p className="font-mono text-[0.8125rem] tabular-nums text-ink-900">{formatHours(stage.meanHours)}</p>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-50" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full", isBottleneck ? "bg-medium-500" : "bg-ink-300")}
                  style={{ width: `${((stage.meanHours ?? 0) / max) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-[0.6875rem] text-ink-400">{pluralize(stage.samples, "round")}</p>
            </div>
          );
        })}
        {data.bottleneck ? (
          <p className="border-t border-line pt-4 text-[0.8125rem] leading-relaxed text-ink-700">
            {data.bottleneck.stage === "awaiting_pickup"
              ? "Most of the wait is before anyone opens the asset. Assigning on arrival would cut turnaround more than faster reviews."
              : data.bottleneck.stage === "in_review"
                ? "Reviews themselves take the longest. Check reviewer workload below before tightening deadlines."
                : "Revisions are the slow part. The most common findings below are where marketing needs better templates."}
          </p>
        ) : null}
      </CardBody>
      <CardNote>Average time per review round, open reviews included.</CardNote>
    </Card>
  );
}

function Attention({ data, now }: { data: Dashboard; now: Date }) {
  return (
    <Card aria-labelledby="attention-title">
      <CardHeader
        titleId="attention-title"
        title="Closest to the deadline"
        action={
          <Link href="/queue" className="text-[0.8125rem] font-medium text-brand-700 hover:underline">
            Full queue
          </Link>
        }
      />
      {data.attention.length === 0 ? (
        <CardBody>
          <p className="text-sm text-ink-500">Nothing open. Enjoy it.</p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-line">
          {data.attention.map((item) => (
            <li key={item.reference} className="relative flex items-center gap-4 px-5 py-3 hover:bg-paper/60">
              <SeverityGlyph severity={item.riskLevel} />
              <div className="min-w-0 flex-1">
                <Link href={`/submissions/${item.reference}`} className="block truncate text-[0.875rem] font-medium text-ink-900 after:absolute after:inset-0 hover:text-brand-700">
                  {item.title}
                </Link>
                <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.6875rem] text-ink-500">
                  {item.reference}
                  {item.launchAtRisk ? <span className="font-sans font-semibold text-medium-700">· launch at risk</span> : null}
                </p>
              </div>
              <span className={cn("hidden w-20 truncate text-xs sm:block", item.assignee ? "text-ink-600" : "italic text-ink-400")}>
                {item.assignee?.name.split(" ")[0] ?? "Unassigned"}
              </span>
              <div className="w-36 shrink-0">
                <SlaIndicator sla={item.sla} now={now} compact />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Workload({ data }: { data: Dashboard }) {
  const maxOpen = Math.max(1, ...data.workload.map((w) => w.open));
  return (
    <Card aria-labelledby="workload-title">
      <CardHeader
        titleId="workload-title"
        title="Reviewer workload"
      />
      <div className="relative overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="eyebrow py-2 pl-4 pr-3 font-medium text-ink-500 sm:pl-5">
                Reviewer
              </th>
              <th scope="col" className="eyebrow px-3 py-2 font-medium text-ink-500">
                Open
              </th>
              <th scope="col" className="eyebrow hidden px-3 py-2 text-right font-medium text-ink-500 sm:table-cell">
                Decided
              </th>
              <th scope="col" className="eyebrow whitespace-nowrap py-2 pl-3 pr-4 text-right font-medium text-ink-500 sm:pr-5">
                Review time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.workload.map((w) => (
              <tr key={w.reviewerId}>
                <td className="py-2.5 pl-4 pr-3 sm:pl-5">
                  <span className="block truncate font-medium text-ink-900">{w.reviewer.name}</span>
                  <span className="block truncate text-[0.6875rem] text-ink-500">{ROLE_LABELS[w.reviewer.role]}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="w-4 text-right font-mono tabular-nums text-ink-900">{w.open}</span>
                    <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-ink-50 sm:block" aria-hidden="true">
                      <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(w.open / maxOpen) * 100}%` }} />
                    </span>
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 text-right font-mono tabular-nums text-ink-700 sm:table-cell">{w.decided}</td>
                <td className="py-2.5 pl-3 pr-4 text-right font-mono tabular-nums text-ink-700 sm:pr-5">{formatHours(w.medianReviewHours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CardNote>Review time is the typical time from starting a review to deciding it.</CardNote>
    </Card>
  );
}

function TopRules({ data }: { data: Dashboard }) {
  const max = Math.max(1, ...data.topRules.map((r) => r.submissions));
  return (
    <Card aria-labelledby="rules-title">
      <CardHeader
        titleId="rules-title"
        title="What first drafts get wrong"
        action={
          <Link href="/rules" className="text-[0.8125rem] font-medium text-brand-700 hover:underline">
            Rule library
          </Link>
        }
      />
      <CardBody>
        <ol className="grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
          {data.topRules.map((rule, i) => (
            <li key={rule.ruleId} className="flex gap-3">
              <span className="w-5 shrink-0 text-[0.8125rem] font-semibold tabular-nums text-ink-300">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] font-medium text-ink-900">
                    <SeverityGlyph severity={rule.severity} />
                    <span className="truncate">{rule.title}</span>
                  </p>
                  <p className="shrink-0 font-mono text-xs tabular-nums text-ink-600">
                    {rule.submissions} <span className="text-ink-400">· {formatPercent(rule.submissions / Math.max(1, data.totals.submissions))}</span>
                  </p>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-50" aria-hidden="true">
                  <div className="h-full rounded-full bg-ink-700" style={{ width: `${(rule.submissions / max) * 100}%` }} />
                </div>
                <p className="mt-1 truncate font-mono text-[0.625rem] text-ink-400">{rule.citation}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardBody>
      <CardNote>
        Findings on first versions across {pluralize(data.totals.submissions, "submission")}. This is the training list for marketing.
      </CardNote>
    </Card>
  );
}
