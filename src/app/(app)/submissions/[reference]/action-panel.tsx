import { ArrowRight, CircleCheck, Hourglass } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import type { AuthzResult } from "@/domain/permissions";
import { formatDateTime } from "@/lib/format";
import type { CurrentUser } from "@/server/auth";
import type { SubmissionDetail, VersionDetail } from "@/server/queries/submission";
import { AssignForm } from "./assign-form";
import { ClaimForm } from "./claim-form";
import { DecisionForm } from "./decision-form";

const SOD_PREFIX = "Separation of duties";

function DeniedNotice({ result }: { result: AuthzResult }) {
  if (result.allowed) return null;
  const sod = result.reason.startsWith(SOD_PREFIX);
  return (
    <Notice tone="guard" title={sod ? "Separation of duties" : "You can't act on this one"}>
      {sod ? "You wrote this submission, so a different reviewer has to decide it. That's enforced on the server for every action." : result.reason}
    </Notice>
  );
}

/**
 * The "what can I do here?" panel. Each branch is driven by the policy
 * results computed on the server; the forms inside are thin wrappers around
 * server actions that re-check the same policy.
 */
export function ActionPanel({ detail, current, user }: { detail: SubmissionDetail; current: VersionDetail; user: CurrentUser }) {
  const { permissions: p, status } = detail;
  const isOwner = detail.submitter?.id === user.id;
  const openHigh = current.findings.filter((f) => f.severity === "high").length;
  const lastDecisionNote = [...detail.timeline]
    .reverse()
    .find((t) => t.kind === "event" && t.action === "decision.changes_requested");

  if (status === "approved" || status === "rejected") {
    return (
      <Card>
        <CardHeader title={status === "approved" ? "Approved" : "Rejected"} description={detail.closedAt ? `Closed ${formatDateTime(detail.closedAt)}` : undefined} />
        <CardBody className="space-y-2 text-sm text-ink-700">
          <p className="flex items-center gap-2">
            <Avatar person={current.decidedBy} size="sm" />
            <span>
              {current.decidedBy?.name ?? "A reviewer"} {status === "approved" ? "approved" : "rejected"} v{current.version}.
            </span>
          </p>
          <p className="text-[0.8125rem] text-ink-500">
            {status === "approved"
              ? "This version is the one cleared to launch. Any change to the copy needs a new submission."
              : "This submission is closed. Start a new one if the campaign is reworked."}
          </p>
        </CardBody>
      </Card>
    );
  }

  if (status === "changes_requested") {
    return (
      <Card>
        <CardHeader title="Changes requested" description={isOwner ? "Waiting on you" : `Waiting on ${detail.submitter?.name ?? "the submitter"}`} />
        <CardBody className="space-y-4">
          {lastDecisionNote?.kind === "event" && lastDecisionNote.attachment ? (
            <figure className="rounded-lg border border-medium-200 bg-medium-50/60 px-3.5 py-3">
              <blockquote className="text-[0.875rem] leading-relaxed text-ink-800">{lastDecisionNote.attachment}</blockquote>
              <figcaption className="mt-2 flex items-center gap-2 text-xs text-ink-500">
                <Avatar person={lastDecisionNote.actor} size="xs" />
                {lastDecisionNote.actor?.name} · {formatDateTime(lastDecisionNote.at)}
              </figcaption>
            </figure>
          ) : null}
          {p.resubmit.allowed ? (
            <Link href={`/submissions/${detail.reference}/revise`} className={buttonClasses({ variant: "brand", className: "w-full" })}>
              Revise and resubmit
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <p className="text-[0.8125rem] text-ink-500">
              The SLA clock is paused until {detail.submitter?.name ?? "the submitter"} sends a revision.
            </p>
          )}
        </CardBody>
      </Card>
    );
  }

  // Open: submitted or in review.
  const assignee = detail.assignee;
  const showAssign = p.assign.allowed && detail.assignableReviewers.length > 0;

  return (
    <Card>
      <CardHeader
        title={status === "submitted" ? "Awaiting review" : "In review"}
        description={
          assignee
            ? status === "submitted"
              ? `Assigned to ${assignee.id === user.id ? "you" : assignee.name}, not picked up yet`
              : `${assignee.id === user.id ? "You're" : `${assignee.name} is`} reviewing`
            : "Nobody has picked this up yet"
        }
      />
      <CardBody className="space-y-4">
        {status === "submitted" ? (
          p.claim.allowed ? (
            <ClaimForm
              reference={detail.reference}
              label={assignee && assignee.id !== user.id ? `Take over from ${assignee.name.split(" ")[0]}` : "Start review"}
            />
          ) : user.role === "submitter" ? (
            <p className="flex items-start gap-2 text-[0.8125rem] text-ink-600">
              <Hourglass className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
              With compliance. You&apos;ll see comments and the decision here, and the SLA is shown above.
            </p>
          ) : (
            <DeniedNotice result={p.claim} />
          )
        ) : p.decide.allowed ? (
          <>
            {assignee && assignee.id !== user.id ? (
              <Notice tone="info">You&apos;re deciding as Compliance Lead on {assignee.name}&apos;s review.</Notice>
            ) : null}
            <DecisionForm reference={detail.reference} version={current.version} openHighFindings={openHigh} />
          </>
        ) : isOwner && user.role === "submitter" ? (
          <p className="flex items-start gap-2 text-[0.8125rem] text-ink-600">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden="true" />
            {assignee?.name ?? "A reviewer"} is reviewing v{current.version}. Reply to comments below if they ask anything.
          </p>
        ) : (
          <DeniedNotice result={p.decide} />
        )}

        {showAssign ? (
          <div className="border-t border-line pt-4">
            <AssignForm
              reference={detail.reference}
              currentAssigneeId={assignee?.id ?? null}
              reviewers={detail.assignableReviewers}
            />
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
