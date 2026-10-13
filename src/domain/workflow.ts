import type { Decision, Status, VersionOutcome } from "./types";

/**
 * The review workflow as an explicit state machine. Server actions must go
 * through `transition()` so an illegal move (approving something that was
 * never reviewed, resubmitting an approved asset) fails loudly instead of
 * silently corrupting the record.
 *
 *   submitted ──start_review──▶ in_review ──approve──────────▶ approved
 *       ▲                           ├──────reject───────────▶ rejected
 *       │                           └──request_changes──▶ changes_requested
 *       └─────────────────resubmit (new version)──────────────────┘
 */
export type Transition =
  | "start_review"
  | "approve"
  | "request_changes"
  | "reject"
  | "resubmit";

const TRANSITIONS: Record<Status, Partial<Record<Transition, Status>>> = {
  submitted: { start_review: "in_review" },
  in_review: {
    approve: "approved",
    request_changes: "changes_requested",
    reject: "rejected",
  },
  changes_requested: { resubmit: "submitted" },
  approved: {},
  rejected: {},
};

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: Status,
    readonly attempted: Transition,
  ) {
    super(`Cannot "${attempted}" a submission that is "${from}".`);
    this.name = "InvalidTransitionError";
  }
}

export function transition(from: Status, attempted: Transition): Status {
  const next = TRANSITIONS[from][attempted];
  if (!next) throw new InvalidTransitionError(from, attempted);
  return next;
}

export function canTransition(from: Status, attempted: Transition): boolean {
  return TRANSITIONS[from][attempted] !== undefined;
}

export function availableTransitions(from: Status): Transition[] {
  return Object.keys(TRANSITIONS[from]) as Transition[];
}

export function isTerminal(status: Status): boolean {
  return availableTransitions(status).length === 0;
}

/** Maps a reviewer's verdict to the outcome stored on the version. */
export const DECISION_OUTCOME: Record<Decision, VersionOutcome> = {
  approve: "approved",
  request_changes: "changes_requested",
  reject: "rejected",
};

/** The workflow stages shown in the progress tracker, in order. */
export const STAGES = ["submitted", "in_review", "decision"] as const;
export type Stage = (typeof STAGES)[number];

export function stageOf(status: Status): Stage {
  if (status === "submitted") return "submitted";
  if (status === "in_review") return "in_review";
  return "decision";
}
