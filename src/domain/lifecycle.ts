import { pluralize } from "@/lib/format";
import type { RiskLevel, Status, VersionOutcome } from "./types";

/**
 * The life of one submission, start to launch, as a short row of steps:
 * submitted (with what the pre-check found), one step per review round, back
 * with marketing if it was sent back, the decision, then the launch date.
 */

export interface LifecycleRound {
  version: number;
  findingCount: number;
  riskLevel: RiskLevel;
  submittedBy: string | null;
  submittedAt: Date;
  reviewStartedAt: Date | null;
  reviewer: string | null;
  decidedAt: Date | null;
  decidedBy: string | null;
  outcome: VersionOutcome | null;
}

export interface LifecycleInput {
  status: Status;
  /** Oldest first. */
  rounds: LifecycleRound[];
  assignee: string | null;
  /** Calendar date, YYYY-MM-DD. */
  targetLaunchDate: string;
  launchAtRisk: boolean;
}

export type StepState = "done" | "current" | "upcoming";
export type StepTone = "positive" | "warning" | "negative";

export interface LifecycleStep {
  key: string;
  label: string;
  /** Who did it, or who has it. */
  by: string | null;
  at: Date | null;
  /** Calendar date (the launch step). */
  day: string | null;
  note: string | null;
  state: StepState;
  tone: StepTone | null;
}

const DECIDED_LABEL: Record<VersionOutcome, string> = {
  approved: "approved",
  changes_requested: "sent back",
  rejected: "rejected",
};

const DECIDED_TONE: Record<VersionOutcome, StepTone> = {
  approved: "positive",
  changes_requested: "warning",
  rejected: "negative",
};

function precheckNote(round: LifecycleRound): string {
  return round.findingCount === 0
    ? "Pre-check: nothing flagged"
    : `Pre-check: ${pluralize(round.findingCount, "finding")}, ${round.riskLevel} risk`;
}

function roundStep(round: LifecycleRound, assignee: string | null): LifecycleStep {
  const base = { key: `v${round.version}`, day: null, note: round.version > 1 ? precheckNote(round) : null };
  const name = `Version ${round.version}`;

  if (round.outcome && round.decidedAt) {
    return {
      ...base,
      label: `${name} ${DECIDED_LABEL[round.outcome]}`,
      // Imported history can record the decision without saying who made it.
      by: round.decidedBy ?? round.reviewer,
      at: round.decidedAt,
      state: "done",
      tone: DECIDED_TONE[round.outcome],
    };
  }
  if (round.reviewStartedAt) {
    return { ...base, label: `${name} in review`, by: round.reviewer, at: round.reviewStartedAt, state: "current", tone: null };
  }
  return {
    ...base,
    label: `${name} waiting for a reviewer`,
    by: assignee ? `Assigned to ${assignee}` : "Not assigned yet",
    at: null,
    state: "current",
    tone: null,
  };
}

function launchStep({ status, targetLaunchDate, launchAtRisk }: LifecycleInput): LifecycleStep {
  const base = { key: "launch", by: null, at: null, day: targetLaunchDate };
  if (status === "approved") return { ...base, label: "Cleared to launch", note: null, state: "done", tone: "positive" };
  if (status === "rejected") return { ...base, label: "Not launching", day: null, note: "Rejected copy can't run", state: "upcoming", tone: null };
  return {
    ...base,
    label: "Launch",
    note: launchAtRisk ? "At risk: the review deadline is on or after launch day" : null,
    state: "upcoming",
    tone: launchAtRisk ? "warning" : null,
  };
}

export function lifecycleSteps(input: LifecycleInput): LifecycleStep[] {
  const { rounds, status } = input;
  const first = rounds[0];
  if (!first) return [];
  const last = rounds[rounds.length - 1];

  const steps: LifecycleStep[] = [
    {
      key: "submitted",
      label: "Submitted",
      by: first.submittedBy,
      at: first.submittedAt,
      day: null,
      note: precheckNote(first),
      state: "done",
      tone: null,
    },
    ...rounds.map((round) => roundStep(round, input.assignee)),
  ];

  if (status === "changes_requested" && last.outcome === "changes_requested") {
    steps.push({
      key: "with-marketing",
      label: "Back with marketing",
      by: first.submittedBy,
      at: null,
      day: null,
      note: "Review deadline paused until it comes back",
      state: "current",
      tone: null,
    });
  }
  if (status !== "approved" && status !== "rejected") {
    steps.push({ key: "decision", label: "Decision", by: null, at: null, day: null, note: null, state: "upcoming", tone: null });
  }
  steps.push(launchStep(input));
  return steps;
}
