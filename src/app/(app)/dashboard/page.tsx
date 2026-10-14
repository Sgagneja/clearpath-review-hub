import { Hourglass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { SeverityGlyph } from "@/components/severity";
import { Card, CardHeader, CardNote, CardBody } from "@/components/ui/card";
import type { OpenLoad, StageKey } from "@/domain/metrics";
import { authorize, can } from "@/domain/permissions";
import { niceAxis } from "@/lib/axis";
import { cn } from "@/lib/cn";
import { formatHours, formatPercent, formatRelative, formatShortDate, pluralize } from "@/lib/format";
import { homePathFor, requireUser } from "@/server/auth";
import { getDashboard, type Dashboard } from "@/server/queries/dashboard";
import { countMyQueue } from "@/server/queries/queue";
import { OverviewHeader } from "./overview-header";
import { WorkList } from "./work-list";

export const metadata: Metadata = { title: "Team overview" };

const linkClasses = "text-[0.8125rem] font-medium text-brand-700 hover:underline";

/**
 * Where everyone in compliance starts the day: work at each stage of review,
 * who has it, what's about to slip, and how fast work moves. Each person's own
 * list is one tab over, on /dashboard/mine.
 */
export default async function TeamOverviewPage() {
  const user = await requireUser();
  const access = authorize(user, "dashboard.view");
  if (!access.allowed) return <AccessDenied reason={access.reason} home={homePathFor(user.role)} />;

  const now = new Date();
  const [data, myCount] = await Promise.all([getDashboard(user, now), countMyQueue(user)]);

  return (
    <div className="space-y-6">
      <OverviewHeader
        active="team"
        context={`${user.team} · ${formatShortDate(data.weeks[0].weekStart)} – ${formatShortDate(now)}`}
        myCount={myCount}
      />

      <Pipeline data={data} />

      <WhoIsOnWhat data={data} now={now} userId={user.id} canAssign={can(user, "submission.assign")} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Attention data={data} now={now} />
        <TopRules data={data} />
      </div>

      <Performance data={data} />
    </div>
  );
}

const BOTTLENECK_ADVICE: Record<StageKey, string> = {
  awaiting_pickup: "Most of the wait is before anyone opens the asset. Assigning on arrival would cut turnaround more than faster reviews.",
  in_review: "Reviews themselves take the longest. Check who's on what before tightening deadlines.",
  with_submitter: "Revisions are the slow part. The most common findings are where marketing needs better templates.",
};

/**
 * The review lifecycle as one row: how much is at each stage now, how long work
 * usually sits there, and which stage is the bottleneck. Each stage opens the
 * queue filtered to it.
 */
function Pipeline({ data }: { data: Dashboard }) {
  const { pipeline } = data;
  const hours = (stage: StageKey) => data.stages.find((s) => s.stage === stage)?.meanHours ?? null;
  const thisWeek = data.weeks[data.weeks.length - 1];
  const decided = thisWeek.approved + thisWeek.changesRequested + thisWeek.rejected;

  const stages: { key: string; stage?: StageKey; label: string; href: string; count: number; detail: React.ReactNode }[] = [
    {
      key: "waiting",
      stage: "awaiting_pickup",
      label: "Waiting for a reviewer",
      href: "/queue?status=submitted",
      count: pipeline.waiting.count,
      detail: (
        <>
          <Overdue count={pipeline.waiting.overdue} />
          {pipeline.waiting.unassigned ? ` · ${pipeline.waiting.unassigned} not assigned` : null}
        </>
      ),
    },
    {
      key: "review",
      stage: "in_review",
      label: "Under review",
      href: "/queue?status=in_review",
      count: pipeline.inReview.count,
      detail: <Overdue count={pipeline.inReview.overdue} />,
    },
    {
      key: "marketing",
      stage: "with_submitter",
      label: "Back with marketing",
      href: "/queue?status=changes_requested",
      count: pipeline.withMarketing.count,
      detail: "Deadline paused for changes",
    },
    {
      key: "decided",
      label: "Decided this week",
      href: "/queue?status=all&sort=updated&dir=desc",
      count: decided,
      detail: `${thisWeek.approved} approved · ${thisWeek.changesRequested} sent back · ${thisWeek.rejected} rejected`,
    },
  ];

  return (
    <section aria-labelledby="pipeline-title">
      <h2 id="pipeline-title" className="sr-only">
        Review stages
      </h2>
      <ol className="grid gap-px overflow-hidden rounded-xl border border-line bg-line shadow-[var(--shadow-card)] sm:grid-cols-2 xl:grid-cols-4">
        {stages.map((s, i) => {
          const isBottleneck = s.stage !== undefined && data.bottleneck?.stage === s.stage;
          return (
            <li key={s.key} className="relative bg-white px-5 py-4 hover:bg-paper/50">
              <p className="eyebrow flex items-center justify-between gap-2 text-ink-500">
                <span>
                  <span className="tabular-nums text-ink-400">{i + 1}</span> · {s.label}
                </span>
                {isBottleneck ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-medium-700">
                    <Hourglass className="size-3" aria-hidden="true" /> Slowest
                  </span>
                ) : null}
              </p>
              <Link href={s.href} className="figure mt-1.5 block after:absolute after:inset-0">
                {s.count}
                <span className="sr-only"> {s.label.toLowerCase()}</span>
              </Link>
              <p className="mt-1 text-xs text-ink-600">{s.detail}</p>
              {s.stage ? (
                <p className="mt-2.5 border-t border-line pt-2 text-xs text-ink-500">
                  Average <span className="font-mono tabular-nums text-ink-800">{formatHours(hours(s.stage))}</span> here
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {data.bottleneck ? (
        <p className="mt-3 flex items-start gap-2 text-[0.8125rem] leading-relaxed text-ink-700">
          <Hourglass className="mt-0.5 size-3.5 shrink-0 text-medium-600" aria-hidden="true" />
          {BOTTLENECK_ADVICE[data.bottleneck.stage]}
        </p>
      ) : null}
    </section>
  );
}

function Overdue({ count }: { count: number }) {
  return count ? <span className="font-semibold text-high-700">{count} overdue</span> : <>None overdue</>;
}

function WhoIsOnWhat({ data, now, userId, canAssign }: { data: Dashboard; now: Date; userId: string; canAssign: boolean }) {
  const loose = data.unassigned;
  const maxOpen = Math.max(1, loose.open, ...data.workload.map((w) => w.open));
  const head = "eyebrow whitespace-nowrap px-3 py-2 font-medium text-ink-500";

  return (
    <Card aria-labelledby="team-title">
      <CardHeader
        titleId="team-title"
        title="Who's on what"
        action={
          <Link href="/queue" className={linkClasses}>
            Full queue
          </Link>
        }
      />
      {/* The right padding sits on the scroll box so whichever column is last keeps its gutter. */}
      <div className="relative overflow-x-auto pr-1 sm:pr-2">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Open reviews and decisions for each person on the compliance team</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={cn(head, "pl-4 sm:pl-5")}>Person</th>
              <th scope="col" className={head}>Open now</th>
              <th scope="col" className={cn(head, "text-right")}>Overdue</th>
              <th scope="col" className={cn(head, "hidden text-right sm:table-cell")}>Next deadline</th>
              <th scope="col" className={cn(head, "hidden text-right md:table-cell")}>Decided</th>
              <th scope="col" className={cn(head, "hidden text-right md:table-cell")}>On time</th>
              <th scope="col" className={cn(head, "hidden text-right xl:table-cell")}>Review time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loose.open > 0 ? (
              <tr className="bg-paper/60">
                <th scope="row" className="py-2.5 pl-4 pr-3 font-normal sm:pl-5">
                  <Link href="/queue?status=submitted&assignee=unassigned" className="font-medium italic text-ink-800 hover:text-brand-700">
                    Not assigned yet
                  </Link>
                  <span className="block text-[0.6875rem] text-ink-500">
                    {canAssign ? "Yours to hand out" : "Anyone on the team can start these"}
                  </span>
                </th>
                <LoadCells load={loose} max={maxOpen} now={now} />
                <td className="hidden md:table-cell" />
                <td className="hidden md:table-cell" />
                <td className="hidden xl:table-cell" />
              </tr>
            ) : null}
            {data.workload.map((w) => (
              <tr key={w.reviewerId}>
                <th scope="row" className="py-2.5 pl-4 pr-3 font-normal sm:pl-5">
                  <Link href={`/queue?assignee=${w.reviewerId}`} className="font-medium text-ink-900 hover:text-brand-700">
                    {w.reviewer.name}
                  </Link>
                  {w.reviewerId === userId ? <span className="ml-1.5 text-xs text-ink-400">you</span> : null}
                  <span className="block truncate text-[0.6875rem] text-ink-500">{w.reviewer.title}</span>
                </th>
                <LoadCells load={w} max={maxOpen} now={now} />
                <td className="hidden px-3 py-2.5 text-right font-mono tabular-nums text-ink-700 md:table-cell">{w.decided}</td>
                <td className="hidden px-3 py-2.5 text-right font-mono tabular-nums text-ink-700 md:table-cell">{formatPercent(w.onTime.rate)}</td>
                <td className="hidden px-3 py-2.5 text-right font-mono tabular-nums text-ink-700 xl:table-cell">{formatHours(w.medianReviewHours)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CardNote>
        Open now is what each person has on their desk; the darker part is already under review. Decided, on time and review time
        cover every decision they&apos;ve made.
      </CardNote>
    </Card>
  );
}

/** Open now, overdue and next deadline: the same three cells for a person or for the unassigned pile. */
function LoadCells({ load, max, now }: { load: OpenLoad; max: number; now: Date }) {
  const late = load.nextDueAt !== null && load.nextDueAt.getTime() < now.getTime();
  return (
    <>
      <td className="px-3 py-2.5">
        <span className="flex items-center gap-2.5">
          <span className="w-4 text-right font-mono tabular-nums text-ink-900">{load.open}</span>
          <span className="sr-only">
            : {load.inReview} under review, {load.toStart} not started
          </span>
          <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-ink-50 sm:flex" aria-hidden="true">
            <span className="h-full bg-brand-600" style={{ width: `${(load.inReview / max) * 100}%` }} />
            <span className="h-full bg-brand-200" style={{ width: `${(load.toStart / max) * 100}%` }} />
          </span>
        </span>
      </td>
      <td className={cn("px-3 py-2.5 text-right font-mono tabular-nums", load.overdue ? "font-semibold text-high-700" : "text-ink-300")}>
        {load.overdue}
      </td>
      <td className={cn("hidden whitespace-nowrap px-3 py-2.5 text-right font-mono text-[0.8125rem] sm:table-cell", late ? "text-high-700" : "text-ink-700")}>
        {load.nextDueAt ? formatRelative(load.nextDueAt, now) : <span className="text-ink-300">—</span>}
      </td>
    </>
  );
}

function Attention({ data, now }: { data: Dashboard; now: Date }) {
  return (
    <Card aria-labelledby="attention-title">
      <CardHeader
        titleId="attention-title"
        title="Closest to the deadline"
        action={
          <Link href="/queue" className={linkClasses}>
            Full queue
          </Link>
        }
      />
      <WorkList
        items={data.attention}
        now={now}
        empty="Nothing open. Enjoy it."
        aside={(item) =>
          item.assignee ? <span className="text-ink-600">{item.assignee.name.split(" ")[0]}</span> : <span className="italic text-ink-400">Not assigned</span>
        }
      />
    </Card>
  );
}

function Performance({ data }: { data: Dashboard }) {
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
  // rules between cells, whether they sit side by side or stacked beside the chart.
  return (
    <section aria-labelledby="performance-title">
      <h2 id="performance-title" className="mb-3 text-[0.9375rem] font-semibold text-ink-950">
        How the team is doing
      </h2>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line shadow-[var(--shadow-card)] sm:grid-cols-3 xl:grid-cols-1">
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
        </ul>
        <ThroughputChart weeks={data.weeks} />
      </div>
    </section>
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

function TopRules({ data }: { data: Dashboard }) {
  const max = Math.max(1, ...data.topRules.map((r) => r.submissions));
  return (
    <Card aria-labelledby="rules-title">
      <CardHeader
        titleId="rules-title"
        title="What first drafts get wrong"
        action={
          <Link href="/rules" className={linkClasses}>
            Rule library
          </Link>
        }
      />
      <CardBody>
        <ol className="grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2 xl:grid-cols-1">
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
