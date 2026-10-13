import type { Metadata } from "next";
import { SeverityGlyph, SeverityTag } from "@/components/severity";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ENGINE_VERSION } from "@/domain/precheck/engine";
import { RULES } from "@/domain/precheck/rules";
import { RISK_THRESHOLDS, SEVERITY_WEIGHTS } from "@/domain/risk";
import { SLA_HOURS } from "@/domain/sla";
import { PRODUCT_LINE_LABELS, PRODUCT_LINES, RULE_CATEGORIES, RULE_CATEGORY_LABELS, SEVERITIES } from "@/domain/types";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Rule library" };

const CATEGORY_NOTES: Record<(typeof RULE_CATEGORIES)[number], string> = {
  disclosure: "Terms the law requires once certain words or numbers appear.",
  claim: "Promises and comparisons that need to be true, qualified or sourced.",
  fair_lending: "Language that could steer or discourage protected groups.",
  presentation: "Framing that pressures or leaves out the basics.",
};

export default async function RulesPage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <PageHeader
        context={`Rule set ${ENGINE_VERSION}`}
        title="Rule library"
        description="Every check the pre-check runs, and the regulation behind it. The checks are written rules, not AI, so the same copy always gets the same result and every finding can be explained."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="How the score works" />
          <CardBody className="space-y-2 text-[0.8125rem] text-ink-700">
            {SEVERITIES.map((s) => (
              <p key={s} className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <SeverityGlyph severity={s} /> Each {s} finding
                </span>
                <span className="font-mono tabular-nums text-ink-900">+{SEVERITY_WEIGHTS[s]}</span>
              </p>
            ))}
            <p className="border-t border-line pt-2 text-xs text-ink-500">Capped at 100.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Risk levels" />
          <CardBody className="space-y-2 text-[0.8125rem] text-ink-700">
            <p className="flex justify-between">
              <span>High</span>
              <span className="font-mono">≥ {RISK_THRESHOLDS.high}</span>
            </p>
            <p className="flex justify-between">
              <span>Medium</span>
              <span className="font-mono">
                {RISK_THRESHOLDS.medium}–{RISK_THRESHOLDS.high - 1}
              </span>
            </p>
            <p className="flex justify-between">
              <span>Low</span>
              <span className="font-mono">&lt; {RISK_THRESHOLDS.medium}</span>
            </p>
            <p className="border-t border-line pt-2 text-xs text-ink-500">One high finding alone is medium risk; two make it high.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Review deadline by risk" />
          <CardBody className="space-y-2 text-[0.8125rem] text-ink-700">
            {SEVERITIES.map((s) => (
              <p key={s} className="flex justify-between">
                <span className="capitalize">{s}</span>
                <span className="font-mono">{SLA_HOURS[s]} hours</span>
              </p>
            ))}
            <p className="border-t border-line pt-2 text-xs text-ink-500">Riskier copy gets the shorter clock: it&apos;s the likeliest to block a launch.</p>
          </CardBody>
        </Card>
      </div>

      {RULE_CATEGORIES.map((category) => {
        const rules = RULES.filter((r) => r.category === category);
        if (rules.length === 0) return null;
        return (
          <section key={category} aria-labelledby={`cat-${category}`} className="space-y-3">
            <div>
              <h2 id={`cat-${category}`} className="text-lg font-semibold tracking-[-0.01em] text-ink-950">
                {RULE_CATEGORY_LABELS[category]}
              </h2>
              <p className="text-[0.8125rem] text-ink-500">{CATEGORY_NOTES[category]}</p>
            </div>
            <ul className="grid gap-3 lg:grid-cols-2">
              {rules.map((rule) => (
                <li key={rule.id} className="rounded-xl border border-line bg-white p-4 shadow-[var(--shadow-card)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SeverityTag severity={rule.severity} />
                    <code className="font-mono text-[0.6875rem] text-ink-400">{rule.id}</code>
                  </div>
                  <h3 className="mt-2 font-semibold text-ink-950">{rule.title}</h3>
                  <p className="mt-0.5 font-mono text-[0.6875rem] text-ink-500">{rule.citation}</p>
                  <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-700">{rule.summary}</p>
                  <p className="mt-3 text-xs text-ink-500">
                    Applies to{" "}
                    <span className="text-ink-700">
                      {rule.products.length === PRODUCT_LINES.length
                        ? "every product"
                        : PRODUCT_LINES.filter((p) => rule.products.includes(p))
                            .map((p) => PRODUCT_LINE_LABELS[p])
                            .join(", ")}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="text-xs text-ink-500">
        The pre-check speeds review up. It doesn&apos;t replace it: a reviewer reads every submission, and can approve over a finding with a
        written rationale that goes on the audit trail.
      </p>
    </div>
  );
}
