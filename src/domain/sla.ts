import type { RiskLevel } from "./types";

/**
 * Review SLAs in calendar hours, by risk. Riskier copy gets a *shorter* SLA
 * because it is the most likely to block a launch and the most expensive to
 * get wrong.
 */
export const SLA_HOURS: Record<RiskLevel, number> = {
  high: 48,
  medium: 72,
  low: 120,
};

/** Open items inside this window are flagged "due soon". */
export const DUE_SOON_HOURS = 12;

const HOUR_MS = 60 * 60 * 1000;

export function slaDueAt(submittedAt: Date, level: RiskLevel): Date {
  return new Date(submittedAt.getTime() + SLA_HOURS[level] * HOUR_MS);
}

export type SlaState = "on_track" | "due_soon" | "overdue" | "met" | "missed";

export interface SlaStatus {
  state: SlaState;
  /** Positive while time remains, negative once overdue (ms). */
  remainingMs: number;
  /** Share of the SLA window used so far, clamped to 0–1. For progress bars. */
  elapsedFraction: number;
}

/** What the UI shows for a round: a live SLA, or a paused clock while the submitter revises. */
export type SlaView = (SlaStatus & { dueAt: Date }) | { state: "paused"; since: Date };

/**
 * Where a review round stands against its SLA. Once a round is decided the
 * clock stops, so `decidedAt` turns the state into met/missed.
 */
export function slaStatus(input: {
  submittedAt: Date;
  dueAt: Date;
  now: Date;
  decidedAt?: Date | null;
}): SlaStatus {
  const { submittedAt, dueAt, now, decidedAt } = input;
  const end = decidedAt ?? now;
  const remainingMs = dueAt.getTime() - end.getTime();
  const windowMs = Math.max(1, dueAt.getTime() - submittedAt.getTime());
  const elapsedFraction = clamp((end.getTime() - submittedAt.getTime()) / windowMs);

  let state: SlaState;
  if (decidedAt) state = remainingMs >= 0 ? "met" : "missed";
  else if (remainingMs < 0) state = "overdue";
  else if (remainingMs <= DUE_SOON_HOURS * HOUR_MS) state = "due_soon";
  else state = "on_track";

  return { state, remainingMs, elapsedFraction };
}

/**
 * The launch date is a calendar date (YYYY-MM-DD). Approval has to land
 * before that day starts, so the SLA "threatens the launch" when it falls on
 * or after midnight UTC of the launch date.
 */
export function launchCutoff(targetLaunchDate: string): Date {
  return new Date(`${targetLaunchDate}T00:00:00.000Z`);
}

export function threatensLaunch(dueAt: Date, targetLaunchDate: string): boolean {
  return dueAt.getTime() >= launchCutoff(targetLaunchDate).getTime();
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
