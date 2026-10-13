import { CalendarClock, ChevronRight, FileDiff, FileSpreadsheet, Highlighter, Mail, MessageSquareQuote } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyProof } from "@/components/copy-proof";
import { DecisionStamp } from "@/components/decision-stamp";
import { FindingIndex, FindingList, ResolvedFindings } from "@/components/findings";
import { Redline } from "@/components/redline";
import { ReviewProgress } from "@/components/review-progress";
import { RiskRuler } from "@/components/risk-meter";
import { SeverityGlyph } from "@/components/severity";
import { SlaIndicator } from "@/components/sla";
import { StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { can } from "@/domain/permissions";
import { compareFindings } from "@/domain/precheck/engine";
import { SLA_HOURS } from "@/domain/sla";
import { CHANNEL_LABELS, PRODUCT_LINE_LABELS, SEVERITIES } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatCalendarDate, formatDateTime, pluralize } from "@/lib/format";
import { firstValues, referenceSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth";
import { getSubmissionDetail } from "@/server/queries/submission";
import { ActionPanel } from "./action-panel";
import { CommentForm } from "./comment-form";

export async function generateMetadata({ params }: PageProps<"/submissions/[reference]">): Promise<Metadata> {
  const { reference } = await params;
  return { title: referenceSchema.safeParse(reference).success ? reference : "Submission" };
}

export default async function SubmissionPage({ params, searchParams }: PageProps<"/submissions/[reference]">) {
  const user = await requireUser();
  const [{ reference: rawReference }, query] = await Promise.all([params, searchParams.then(firstValues)]);
  const reference = referenceSchema.safeParse(rawReference);
  if (!reference.success) notFound();

  const now = new Date();
  const detail = await getSubmissionDetail(user, reference.data, now);
  if (!detail) notFound();

  const requested = Number.parseInt(query.v ?? "", 10);
  const viewed = detail.versions.find((v) => v.version === requested) ?? detail.versions[detail.versions.length - 1];
  const previous = detail.versions.find((v) => v.version === viewed.version - 1) ?? null;
  const isCurrent = viewed.version === detail.currentVersion;
  const view = query.view === "changes" && previous ? "changes" : "highlights";
  const delta = previous ? compareFindings(previous.findings, viewed.findings) : null;
  const versionHref = (v: number, nextView = view) =>
    `/submissions/${detail.reference}?v=${v}${nextView === "changes" ? "&view=changes" : ""}`;

  const decidedOutcome = viewed.outcome && viewed.decidedAt ? viewed : null;

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-[0.8125rem] text-ink-500">
          <li>
            <Link href="/queue" className="hover:text-ink-900 hover:underline">
              {user.role === "submitter" ? "My submissions" : "Review queue"}
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="font-mono text-ink-700">
            {detail.reference}
          </li>
        </ol>
      </nav>

      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={detail.status} />
            <span className="text-xs text-ink-500">
              <span className="font-mono">{detail.reference}</span> · Version {detail.currentVersion}
            </span>
          </div>
          <h1 className="page-title mt-2">{detail.title}</h1>
          <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem] text-ink-600">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Product and channel</dt>
              <dd>
                {PRODUCT_LINE_LABELS[detail.productLine]} · {CHANNEL_LABELS[detail.channel]}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-ink-400">Submitted by</dt>
              <dd className="font-medium text-ink-800">{detail.submitter?.name ?? "Unknown"}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-ink-400">Launch</dt>
              <dd className={cn("flex items-center gap-1 font-medium", detail.launchAtRisk ? "text-medium-700" : "text-ink-800")}>
                {detail.launchAtRisk ? <CalendarClock className="size-3.5" aria-hidden="true" /> : null}
                {formatCalendarDate(detail.targetLaunchDate)}
                {detail.launchAtRisk ? <span className="font-normal"> · review deadline is on or after launch day</span> : null}
              </dd>
            </div>
            {detail.source ? (
              <div className="flex min-w-0 items-center gap-1.5">
                <dt className="text-ink-400">Came from</dt>
                <dd className="flex min-w-0 items-center gap-1.5 text-ink-700">
                  {detail.source.kind === "spreadsheet" ? (
                    <FileSpreadsheet className="size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                  ) : (
                    <Mail className="size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                  )}
                  {can(user, "import.run") ? (
                    <Link href={`/import/${detail.source.importId}`} className="truncate hover:text-ink-950 hover:underline">
                      {detail.source.label}
                    </Link>
                  ) : (
                    <span className="truncate">{detail.source.label}</span>
                  )}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="flex shrink-0 items-center gap-5">
          {detail.status === "approved" || detail.status === "rejected" ? (
            decidedOutcome ? (
              <DecisionStamp outcome={decidedOutcome.outcome!} decidedBy={decidedOutcome.decidedBy?.name ?? null} decidedAt={decidedOutcome.decidedAt!} />
            ) : null
          ) : (
            <div className="min-w-56 rounded-xl border border-line bg-white px-4 py-3 shadow-[var(--shadow-card)]">
              <p className="eyebrow mb-1.5 text-ink-500">Review deadline · {SLA_HOURS[detail.riskLevel]} hours</p>
              <SlaIndicator sla={detail.sla} now={now} />
            </div>
          )}
        </div>
      </header>

      {query.created ? (
        <Notice tone="success" role="status" title={`${detail.reference} is in the queue`}>
          The pre-check flagged {pluralize(viewed.findings.length, "finding")} ({viewed.riskLevel} risk), so compliance will review it within{" "}
          {SLA_HOURS[viewed.riskLevel]} hours, by {formatDateTime(viewed.slaDueAt)}.
        </Notice>
      ) : null}
      {query.imported ? (
        <Notice tone="success" role="status" title={`Brought in as ${detail.reference}`}>
          {detail.status === "submitted"
            ? `It's in the queue with a review deadline of ${formatDateTime(viewed.slaDueAt)}, counted from when the email arrived. `
            : null}
          The original email details are kept on the record and in the audit trail.
        </Notice>
      ) : null}
      {query.resubmitted && isCurrent ? (
        <Notice tone="success" role="status" title={`Version ${viewed.version} submitted`}>
          {delta ? `${pluralize(delta.resolved.length, "finding")} fixed since version ${viewed.version - 1}. ` : null}
          It&apos;s back with {detail.assignee?.name ?? "compliance"}, due within {SLA_HOURS[viewed.riskLevel]} hours.
        </Notice>
      ) : null}
      {!isCurrent ? (
        <Notice tone="info">
          You&apos;re looking at version {viewed.version}, an earlier version.{" "}
          <Link href={versionHref(detail.currentVersion, "highlights")} className="font-semibold underline underline-offset-2">
            Go to the current version ({detail.currentVersion})
          </Link>
        </Notice>
      ) : null}

      <Card>
        <CardBody className="py-4">
          <ReviewProgress
            version={viewed.version}
            submittedAt={viewed.submittedAt}
            submittedBy={viewed.submittedBy?.name ?? null}
            reviewStartedAt={viewed.reviewStartedAt}
            reviewer={viewed.reviewer?.name ?? null}
            assignee={isCurrent ? (detail.assignee?.name ?? null) : null}
            decidedAt={viewed.decidedAt}
            decidedBy={viewed.decidedBy?.name ?? null}
            outcome={viewed.outcome}
          />
        </CardBody>
      </Card>

      {/*
        Small screens stack copy, actions, findings, activity. On wide screens the
        aside spans all three rows of the right column; the trailing 1fr row
        absorbs any extra aside height so the left cards don't spread apart.
      */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,34%)] xl:grid-rows-[auto_auto_1fr]">
        <Card aria-labelledby="proof-title" className="min-w-0 xl:col-start-1">
          <header className="flex flex-col gap-3 border-b border-line px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="proof-title" className="sr-only">
              Copy, version {viewed.version}
            </h2>
            <nav aria-label="Versions" className="relative -mx-1 overflow-x-auto">
              <ul className="flex gap-1 px-1">
                {detail.versions.map((v) => {
                  const active = v.version === viewed.version;
                  return (
                    <li key={v.version}>
                      <Link
                        href={versionHref(v.version, v.version === 1 ? "highlights" : view)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "inline-flex h-8 items-center gap-2 rounded-md px-2.5 font-mono text-xs transition-colors",
                          active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-900/5 hover:text-ink-900",
                        )}
                      >
                        Version {v.version}
                        <span className={cn("inline-flex items-center gap-1", active ? "text-ink-300" : "text-ink-400")}>
                          <SeverityGlyph severity={v.riskLevel} className="size-2" />
                          {v.riskScore}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {previous ? (
              <div role="group" aria-label="View" className="inline-flex self-start rounded-lg bg-paper p-0.5 ring-1 ring-line sm:self-auto">
                <Link
                  href={versionHref(viewed.version, "highlights")}
                  aria-current={view === "highlights" ? "true" : undefined}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
                    view === "highlights" ? "bg-white text-ink-900 shadow-[var(--shadow-card)]" : "text-ink-500 hover:text-ink-900",
                  )}
                >
                  <Highlighter className="size-3.5" aria-hidden="true" />
                  Findings
                </Link>
                <Link
                  href={versionHref(viewed.version, "changes")}
                  aria-current={view === "changes" ? "true" : undefined}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
                    view === "changes" ? "bg-white text-ink-900 shadow-[var(--shadow-card)]" : "text-ink-500 hover:text-ink-900",
                  )}
                >
                  <FileDiff className="size-3.5" aria-hidden="true" />
                  Changes since version {previous.version}
                </Link>
              </div>
            ) : null}
          </header>

          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <p className="mb-5 font-mono text-[0.6875rem] text-ink-400">
              Version {viewed.version} · {viewed.submittedBy?.name ?? "Unknown"} · {formatDateTime(viewed.submittedAt)}
            </p>
            {view === "changes" && previous ? (
              <Redline previous={previous.body} next={viewed.body} />
            ) : (
              <CopyProof body={viewed.body} findings={viewed.findings} />
            )}
            {viewed.note ? (
              <figure className="mt-7 flex gap-3 border-t border-dashed border-line-strong pt-5">
                <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
                <div>
                  <figcaption className="eyebrow text-ink-500">Note from {viewed.submittedBy?.name.split(" ")[0] ?? "the submitter"}</figcaption>
                  <blockquote className="mt-1 text-[0.875rem] leading-relaxed text-ink-700">{viewed.note}</blockquote>
                </div>
              </figure>
            ) : null}
          </div>
        </Card>

        <aside aria-label="Review" className="space-y-6 xl:col-start-2 xl:row-span-3 xl:row-start-1">
          {isCurrent ? <ActionPanel detail={detail} current={viewed} user={user} /> : null}

          <Card aria-labelledby="precheck-title">
            <CardHeader
              titleId="precheck-title"
              title={`Pre-check · version ${viewed.version}`}
              description="Flags wording that usually needs a change. A reviewer always makes the call."
            />
            <CardBody className="space-y-4">
              <RiskRuler score={viewed.riskScore} level={viewed.riskLevel} />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-ink-600">
                {SEVERITIES.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <SeverityGlyph severity={s} />
                    <span className="font-mono tabular-nums">{viewed.findings.filter((f) => f.severity === s).length}</span> {s}
                  </span>
                ))}
              </div>
              {viewed.findings.length > 0 ? (
                <div className="border-t border-line pt-3">
                  <FindingIndex findings={viewed.findings} interactive={view === "highlights"} />
                </div>
              ) : (
                <p className="rounded-lg border border-approve-100 bg-approve-50/60 px-4 py-3 text-[0.8125rem] text-approve-700">
                  Nothing flagged on this version.
                </p>
              )}
              {delta ? <ResolvedFindings findings={delta.resolved} sinceVersion={viewed.version - 1} /> : null}
            </CardBody>
          </Card>
        </aside>

        {viewed.findings.length > 0 ? (
          <Card aria-labelledby="findings-title" className="min-w-0 xl:col-start-1">
            <CardHeader
              titleId="findings-title"
              title={`${pluralize(viewed.findings.length, "finding")} on version ${viewed.version}`}
              description="Numbered to match the marks in the copy, with the guideline behind each one and a suggested fix."
            />
            <CardBody>
              <FindingList findings={viewed.findings} interactive={view === "highlights"} />
            </CardBody>
          </Card>
        ) : null}

        <Card aria-labelledby="activity-title" className="min-w-0 xl:col-start-1">
          <CardHeader titleId="activity-title" title="Activity" description="Comments and every step so far, as recorded in the audit trail." />
          <CardBody className="space-y-6">
            <Timeline items={detail.timeline} />
            {detail.permissions.comment.allowed ? (
              <div className="border-t border-line pt-5">
                <CommentForm reference={detail.reference} version={detail.currentVersion} />
              </div>
            ) : (
              <p className="border-t border-line pt-4 text-[0.8125rem] text-ink-500">{detail.permissions.comment.reason}</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
