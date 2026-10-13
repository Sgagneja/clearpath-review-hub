import type { Finding, RiskLevel, Severity } from "./types";

/** Points each finding contributes to the 0–100 risk score. */
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  high: 30,
  medium: 15,
  low: 5,
};

export const MAX_RISK_SCORE = 100;

/** Score thresholds (inclusive) for each risk level. */
export const RISK_THRESHOLDS = { high: 50, medium: 20 } as const;

export function riskScore(findings: Pick<Finding, "severity">[]): number {
  const total = findings.reduce((sum, f) => sum + SEVERITY_WEIGHTS[f.severity], 0);
  return Math.min(MAX_RISK_SCORE, total);
}

export function riskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.high) return "high";
  if (score >= RISK_THRESHOLDS.medium) return "medium";
  return "low";
}

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Most severe first; used to order findings and to pick highlight colours. */
export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_RANK[a] - SEVERITY_RANK[b];
}

export function highestSeverity(severities: Severity[]): Severity | null {
  if (severities.length === 0) return null;
  return [...severities].sort(compareSeverity)[0];
}
