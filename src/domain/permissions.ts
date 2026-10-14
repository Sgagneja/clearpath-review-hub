import type { Role, Status } from "./types";

/**
 * Authorization policy. This is the real security boundary of the app: every
 * server action and data read calls `authorize()` / `assertCan()`, and the UI
 * only uses `can()` to decide what to *show*. The policy is IdP-agnostic: swap
 * the demo login for SSO and nothing here changes, because it only needs the
 * actor's id and role.
 */

export type Action =
  | "submission.create"
  | "submission.view"
  | "submission.comment"
  | "submission.claim"
  | "submission.assign"
  | "submission.decide"
  | "submission.resubmit"
  | "queue.review"
  | "queue.view_all"
  | "dashboard.view"
  | "mywork.view"
  | "audit.view"
  | "audit.export"
  | "import.run"
  | "rules.test";

export interface Actor {
  id: string;
  role: Role;
}

/** The subset of a submission the policy needs. */
export interface SubmissionScope {
  submitterId: string;
  assigneeId: string | null;
  status: Status;
}

export type AuthzResult = { allowed: true } | { allowed: false; reason: string };

const ALLOW: AuthzResult = { allowed: true };
const deny = (reason: string): AuthzResult => ({ allowed: false, reason });

const isCompliance = (role: Role) =>
  role === "reviewer" || role === "compliance_lead";

const SELF_REVIEW =
  "Separation of duties: you authored this submission, so another reviewer has to decide it.";

/**
 * Who can open a submission. Everyone sees their own work. A reviewer also sees the
 * reviews assigned to them and the ones nobody has picked up yet, so they can take one.
 * Only the Compliance Lead sees everyone's. `visibleTo` in src/server/queries/queue.ts
 * is the same rule in SQL, so the queue never lists what can't be opened.
 */
export function canOpen(actor: Actor, submission: SubmissionScope): boolean {
  if (actor.role === "compliance_lead" || submission.submitterId === actor.id) return true;
  if (actor.role !== "reviewer") return false;
  return (
    submission.assigneeId === actor.id ||
    (submission.assigneeId === null && submission.status === "submitted")
  );
}

const ROLE_ONLY: Partial<Record<Action, (role: Role) => AuthzResult>> = {
  "submission.create": () => ALLOW,
  "queue.review": (role) =>
    isCompliance(role) ? ALLOW : deny("Only compliance reviews copy."),
  // Everything below shows other people's work, so it's the lead's alone.
  "queue.view_all": (role) =>
    role === "compliance_lead"
      ? ALLOW
      : deny("Only the Compliance Lead sees every review. Yours are under My work."),
  "dashboard.view": (role) =>
    role === "compliance_lead" ? ALLOW : deny("The team overview is for the Compliance Lead."),
  "mywork.view": (role) =>
    isCompliance(role) ? ALLOW : deny("My work is for reviewers. Your own copy is under My submissions."),
  "audit.view": (role) =>
    role === "compliance_lead"
      ? ALLOW
      : deny("The audit trail is for the Compliance Lead. Each submission's history is on its own page."),
  "audit.export": (role) =>
    role === "compliance_lead"
      ? ALLOW
      : deny("Only a Compliance Lead can export the audit trail."),
  // Imports attribute work to other people (who submitted, who decided).
  "import.run": (role) =>
    role === "compliance_lead"
      ? ALLOW
      : deny("Bringing in old trackers and emails is for the Compliance Lead. To send new copy, use New submission."),
  // Checking that the checks behave is a compliance control. Marketing practises
  // on their own copy in New submission, which saves nothing until they submit.
  "rules.test": (role) =>
    isCompliance(role) ? ALLOW : deny("The test cases are for the compliance team."),
};

export function authorize(
  actor: Actor,
  action: Action,
  submission?: SubmissionScope,
): AuthzResult {
  const roleCheck = ROLE_ONLY[action];
  if (roleCheck) return roleCheck(actor.role);

  if (!submission) {
    // Submission-scoped actions are meaningless without a submission. Failing
    // closed here catches call sites that forgot to pass one.
    return deny("This action needs a submission.");
  }

  const isOwner = submission.submitterId === actor.id;
  const isAssignee = submission.assigneeId === actor.id;
  const isClosed =
    submission.status === "approved" || submission.status === "rejected";

  switch (action) {
    case "submission.view":
      return canOpen(actor, submission) ? ALLOW : deny("You can only open your own work.");

    case "submission.comment":
      if (!canOpen(actor, submission)) return deny("You can only comment on your own work.");
      return isClosed ? deny("This submission is closed.") : ALLOW;

    case "submission.claim":
      if (!isCompliance(actor.role)) return deny("Only compliance can review.");
      if (isOwner) return deny(SELF_REVIEW);
      if (submission.status !== "submitted") {
        return deny("Only submissions awaiting review can be picked up.");
      }
      if (submission.assigneeId && !isAssignee && actor.role !== "compliance_lead") {
        return deny("This submission is assigned to another reviewer.");
      }
      return ALLOW;

    case "submission.assign":
      if (actor.role !== "compliance_lead") {
        return deny("Only a Compliance Lead can assign reviewers.");
      }
      return submission.status === "submitted" || submission.status === "in_review"
        ? ALLOW
        : deny("Only open submissions can be reassigned.");

    case "submission.decide":
      if (!isCompliance(actor.role)) return deny("Only compliance can decide.");
      if (isOwner) return deny(SELF_REVIEW);
      if (submission.status !== "in_review") {
        return deny("Start the review before recording a decision.");
      }
      if (!isAssignee && actor.role !== "compliance_lead") {
        return deny("Only the assigned reviewer or a Compliance Lead can decide.");
      }
      return ALLOW;

    case "submission.resubmit":
      if (!isOwner) return deny("Only the original submitter can resubmit.");
      return submission.status === "changes_requested"
        ? ALLOW
        : deny("Resubmission is only possible after changes are requested.");

    default:
      return deny("Unknown action.");
  }
}

export function can(actor: Actor, action: Action, submission?: SubmissionScope) {
  return authorize(actor, action, submission).allowed;
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan(
  actor: Actor,
  action: Action,
  submission?: SubmissionScope,
): void {
  const result = authorize(actor, action, submission);
  if (!result.allowed) throw new ForbiddenError(result.reason);
}

/** Whether `candidate` may be assigned as the reviewer of `submission`. */
export function isEligibleAssignee(
  candidate: Actor,
  submission: Pick<SubmissionScope, "submitterId">,
): boolean {
  return isCompliance(candidate.role) && candidate.id !== submission.submitterId;
}
