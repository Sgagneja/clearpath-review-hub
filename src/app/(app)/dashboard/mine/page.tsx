import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { StatusBadge } from "@/components/status-badge";
import { SummaryLine, type SummaryItem } from "@/components/summary-line";
import { Card, CardBody, CardHeader, CardNote } from "@/components/ui/card";
import { authorize, can } from "@/domain/permissions";
import { formatHours, formatPercent, formatRelative } from "@/lib/format";
import { homePathFor, requireUser } from "@/server/auth";
import { getMyWork, type MyWork } from "@/server/queries/my-work";
import { countMyQueue } from "@/server/queries/queue";
import { OverviewHeader } from "../overview-header";
import { WorkList } from "../work-list";

export const metadata: Metadata = { title: "My work" };

const linkClasses = "text-[0.8125rem] font-medium text-brand-700 hover:underline";

/**
 * One person's slice of the team's work, one tab over from the team view:
 * what's assigned to them, what nobody has yet, what they sent back, and how
 * their own decisions have gone.
 */
export default async function MyWorkPage() {
  const user = await requireUser();
  const access = authorize(user, "mywork.view");
  if (!access.allowed) return <AccessDenied reason={access.reason} home={homePathFor(user.role)} />;

  const now = new Date();
  const [work, myCount] = await Promise.all([getMyWork(user, now), countMyQueue(user)]);
  const canAssign = can(user, "submission.assign");

  return (
    <div className="space-y-6">
      <OverviewHeader
        active="mine"
        context={`${user.name} · ${user.title}`}
        myCount={myCount}
        showTeam={can(user, "dashboard.view")}
      />

      <MyLine work={work} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card aria-labelledby="assigned-title">
            <CardHeader
              titleId="assigned-title"
              title="Assigned to you"
              action={
                <Link href="/queue?assignee=me" className={linkClasses}>
                  In the queue
                </Link>
              }
            />
            <WorkList
              items={work.open}
              now={now}
              aside={(item) => <StatusBadge status={item.status} className="text-xs" />}
              empty={
                work.unclaimed.length
                  ? "Nothing assigned to you right now. The reviews below are waiting for someone."
                  : "Nothing assigned to you right now."
              }
            />
          </Card>

          <Card aria-labelledby="unclaimed-title">
            <CardHeader titleId="unclaimed-title" title={canAssign ? "Needs a reviewer" : "Nobody has these yet"} />
            <WorkList
              items={work.unclaimed}
              now={now}
              aside={(item) => <span className="text-ink-600">From {item.submitter?.name.split(" ")[0] ?? "marketing"}</span>}
              empty="Everything open has a reviewer."
            />
            <CardNote>
              {canAssign
                ? "Open one to hand it to a reviewer, or start the review yourself."
                : "Open one and start the review to take it on. Nobody can review their own copy."}
            </CardNote>
          </Card>
        </div>

        <div className="space-y-6">
          <Card aria-labelledby="sent-back-title">
            <CardHeader titleId="sent-back-title" title="Back with marketing" />
            <WorkList items={work.sentBack} now={now} empty="Nothing you sent back is waiting on marketing." />
            <CardNote>The deadline is paused while marketing makes changes. The new version comes back to you.</CardNote>
          </Card>

          <RecentDecisions work={work} now={now} />
        </div>
      </div>
    </div>
  );
}

function MyLine({ work }: { work: MyWork }) {
  const { record } = work;
  const items: SummaryItem[] = [
    { value: work.toStart, label: "not started yet", href: "/queue?status=submitted&assignee=me" },
    { value: work.inReview, label: "under review", href: "/queue?status=in_review&assignee=me" },
    { value: work.overdue, label: "overdue", tone: work.overdue ? "high" : undefined, href: "/queue?assignee=me" },
    { value: work.sentBack.length, label: "back with marketing", href: "/queue?status=changes_requested&assignee=me" },
    { value: record.decided, label: "decided" },
    { value: formatPercent(record.onTime.rate), label: "on time" },
    { value: formatHours(record.medianReviewHours), label: "typical review" },
  ];
  return <SummaryLine items={items} label="Your work at a glance" />;
}

function RecentDecisions({ work, now }: { work: MyWork; now: Date }) {
  return (
    <Card aria-labelledby="decisions-title">
      <CardHeader titleId="decisions-title" title="Your recent decisions" />
      {work.recent.length === 0 ? (
        <CardBody>
          <p className="text-sm text-ink-500">You haven&apos;t decided anything yet.</p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-line">
          {work.recent.map((d) => (
            <li key={`${d.reference}-${d.version}`} className="relative px-5 py-3 hover:bg-paper/60">
              <Link
                href={`/submissions/${d.reference}`}
                className="block truncate text-[0.875rem] font-medium text-ink-900 after:absolute after:inset-0 hover:text-brand-700"
              >
                {d.title}
              </Link>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-500">
                <StatusBadge status={d.outcome} className="text-xs" />
                <span>version {d.version}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={d.decidedAt.toISOString()} className="font-mono text-[0.6875rem]">
                  {formatRelative(d.decidedAt, now)}
                </time>
                {d.onTime ? null : <span className="font-medium text-high-700">after the deadline</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
