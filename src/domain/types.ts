/**
 * Core vocabulary of the review workflow. Everything here is plain data so it
 * can be shared by server code, client components, the seed script and tests.
 */

export const PRODUCT_LINES = [
  "personal_loan",
  "credit_card",
  "mortgage_prequal",
] as const;
export type ProductLine = (typeof PRODUCT_LINES)[number];

export const PRODUCT_LINE_LABELS: Record<ProductLine, string> = {
  personal_loan: "Personal loan",
  credit_card: "Credit card",
  mortgage_prequal: "Mortgage prequal",
};

export const CHANNELS = [
  "email",
  "landing_page",
  "social",
  "direct_mail",
  "display_ad",
] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email",
  landing_page: "Landing page",
  social: "Social post",
  direct_mail: "Direct mail",
  display_ad: "Display ad",
};

export const STATUSES = [
  "submitted",
  "in_review",
  "changes_requested",
  "approved",
  "rejected",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  submitted: "Awaiting review",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
};

/** Statuses where the next move belongs to compliance, not the submitter. */
export const OPEN_REVIEW_STATUSES: readonly Status[] = ["submitted", "in_review"];

export const ROLES = ["submitter", "reviewer", "compliance_lead"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  submitter: "Submitter",
  reviewer: "Reviewer",
  compliance_lead: "Compliance Lead",
};

export const SEVERITIES = ["high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];
export type RiskLevel = Severity;

export const SEVERITY_LABELS: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Reviewer verdicts on a single version. `request_changes` keeps it open. */
export const DECISIONS = ["approve", "request_changes", "reject"] as const;
export type Decision = (typeof DECISIONS)[number];

export const DECISION_LABELS: Record<Decision, string> = {
  approve: "Approve",
  request_changes: "Request changes",
  reject: "Reject",
};

/** Outcome recorded on a version once a reviewer has decided it. */
export type VersionOutcome = "approved" | "changes_requested" | "rejected";

export const RULE_CATEGORIES = [
  "disclosure",
  "claim",
  "fair_lending",
  "presentation",
] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const RULE_CATEGORY_LABELS: Record<RuleCategory, string> = {
  disclosure: "Missing disclosure",
  claim: "Risky claim",
  fair_lending: "Fair lending",
  presentation: "Presentation",
};

/** A span of the submitted copy, as UTF-16 offsets into the original string. */
export interface TextMatch {
  start: number;
  end: number;
  text: string;
}

/**
 * One problem the pre-check found. `matches` is empty when the problem is
 * something *missing* from the copy (e.g. no NMLS ID), so there is nothing to
 * highlight.
 */
export interface Finding {
  /** Stable across versions, so we can tell which findings a revision fixed. */
  key: string;
  ruleId: string;
  title: string;
  severity: Severity;
  category: RuleCategory;
  citation: string;
  message: string;
  suggestion: string;
  matches: TextMatch[];
}

export interface PrecheckResult {
  findings: Finding[];
  score: number;
  level: RiskLevel;
  /** How many rules applied to this product line. */
  rulesEvaluated: number;
  /** Rule-set version, stored with every result so audits can reproduce it. */
  engineVersion: string;
}
