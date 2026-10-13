/**
 * Every kind of event the audit trail records. Kept as a closed list so the
 * export, the filters and the seed data can't drift apart.
 */
export const AUDIT_ACTIONS = {
  "session.signed_in": "Signed in",
  "session.signed_out": "Signed out",
  "submission.created": "Submitted",
  "submission.imported": "Brought in",
  "submission.resubmitted": "Resubmitted",
  "import.tracker": "Tracker imported",
  "precheck.completed": "Pre-check ran",
  "reviewer.assigned": "Reviewer assigned",
  "review.started": "Review started",
  "comment.added": "Commented",
  "decision.approved": "Approved",
  "decision.changes_requested": "Changes requested",
  "decision.rejected": "Rejected",
  "audit.exported": "Audit exported",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export const AUDIT_ACTION_KEYS = Object.keys(AUDIT_ACTIONS) as AuditAction[];

export function isAuditAction(value: string): value is AuditAction {
  return value in AUDIT_ACTIONS;
}

/** Visual grouping for the timeline and audit table. */
export type AuditTone = "neutral" | "positive" | "warning" | "negative" | "system";

export function auditTone(action: AuditAction): AuditTone {
  switch (action) {
    case "decision.approved":
      return "positive";
    case "decision.changes_requested":
      return "warning";
    case "decision.rejected":
      return "negative";
    case "precheck.completed":
    case "import.tracker":
    case "session.signed_in":
    case "session.signed_out":
    case "audit.exported":
      return "system";
    default:
      return "neutral";
  }
}
