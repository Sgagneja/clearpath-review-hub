import { compareSeverity, riskLevel, riskScore } from "../risk";
import type { Channel, Finding, PrecheckResult, ProductLine } from "../types";
import { RULES, type Rule } from "./rules";

/**
 * Bumped whenever a rule changes. Stored with every pre-check result so an
 * examiner can tell exactly which rule set produced a historical finding.
 */
export const ENGINE_VERSION = "2026.10.1";

export interface PrecheckInput {
  text: string;
  productLine: ProductLine;
  channel: Channel;
}

export function applicableRules(productLine: ProductLine): Rule[] {
  return RULES.filter((rule) => rule.products.includes(productLine));
}

/**
 * Runs every applicable rule over the copy. Pure and synchronous, so the same
 * function powers the live preview in the browser and the authoritative
 * server-side check that gets stored with each version.
 */
export function runPrecheck(input: PrecheckInput): PrecheckResult {
  const rules = applicableRules(input.productLine);
  const findings = rules.flatMap((rule) =>
    rule.check(input).map(
      (hit): Finding => ({
        key: hit.keySuffix ? `${rule.id}:${hit.keySuffix}` : rule.id,
        ruleId: rule.id,
        title: hit.title ?? rule.title,
        severity: hit.severity ?? rule.severity,
        category: rule.category,
        citation: hit.citation ?? rule.citation,
        message: hit.message,
        suggestion: hit.suggestion,
        matches: hit.matches,
      }),
    ),
  );

  findings.sort(
    (a, b) =>
      compareSeverity(a.severity, b.severity) || firstOffset(a) - firstOffset(b),
  );

  const score = riskScore(findings);
  return {
    findings,
    score,
    level: riskLevel(score),
    rulesEvaluated: rules.length,
    engineVersion: ENGINE_VERSION,
  };
}

/** Findings with nothing to highlight sort after anchored ones. */
function firstOffset(finding: Finding): number {
  return finding.matches[0]?.start ?? Number.MAX_SAFE_INTEGER;
}

export interface FindingComparison {
  resolved: Finding[];
  introduced: Finding[];
  persisting: Finding[];
}

/** What a revision fixed, broke, or left alone, keyed by `Finding.key`. */
export function compareFindings(previous: Finding[], next: Finding[]): FindingComparison {
  const prevKeys = new Set(previous.map((f) => f.key));
  const nextKeys = new Set(next.map((f) => f.key));
  return {
    resolved: previous.filter((f) => !nextKeys.has(f.key)),
    introduced: next.filter((f) => !prevKeys.has(f.key)),
    persisting: next.filter((f) => prevKeys.has(f.key)),
  };
}
