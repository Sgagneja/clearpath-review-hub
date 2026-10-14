import { ArrowRight, Check, ChevronDown, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SeverityGlyph, SeverityTag } from "@/components/severity";
import { Card, CardBody, CardHeader, CardNote } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TabNav } from "@/components/ui/tab-nav";
import { can } from "@/domain/permissions";
import { applicableRules, ENGINE_VERSION } from "@/domain/precheck/engine";
import { RULES } from "@/domain/precheck/rules";
import { runScenario, SCENARIOS, type ScenarioResult } from "@/domain/precheck/scenarios";
import { RISK_THRESHOLDS, SEVERITY_WEIGHTS } from "@/domain/risk";
import { SLA_HOURS } from "@/domain/sla";
import {
  CHANNEL_LABELS,
  PRODUCT_LINE_LABELS,
  PRODUCT_LINES,
  RULE_CATEGORIES,
  RULE_CATEGORY_LABELS,
  SEVERITIES,
  type ProductLine,
} from "@/domain/types";
import { cn } from "@/lib/cn";
import { requireUser } from "@/server/auth";

export const metadata: Metadata = { title: "Rule library" };

const CATEGORY_NOTES: Record<(typeof RULE_CATEGORIES)[number], string> = {
  disclosure: "Terms the law requires once certain words or numbers appear.",
  claim: "Promises and comparisons that need to be true, qualified or sourced.",
  fair_lending: "Language that could steer or discourage protected groups.",
  presentation: "Framing that pressures or leaves out the basics.",
};

const ruleTitle = new Map(RULES.map((r) => [r.id, r.title]));

export default async function RulesPage({ searchParams }: PageProps<"/rules">) {
  const user = await requireUser();
  const requested = (await searchParams).product;
  const product = PRODUCT_LINES.find((p) => p === requested) ?? null;
  const rules = product ? applicableRules(product) : [...RULES];

  // Test cases run here, on the server, each time the page opens: the same
  // pre-check the app uses, against the answers compliance expects.
  const canTest = can(user, "rules.test");
  const results = canTest ? SCENARIOS.filter((s) => !product || s.productLine === product).map(runScenario) : [];
  const failing = results.filter((r) => !r.ok).length;

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          context={`Rule set ${ENGINE_VERSION}`}
          title="Rule library"
          description="Every check the pre-check runs, and the regulation behind it. The checks are written rules, not AI, so the same copy always gets the same result and every finding can be explained."
        />
        <TabNav
          label="Products"
          active={product ?? "all"}
          className="mt-5"
          items={[
            { key: "all", href: "/rules", label: "All products", count: RULES.length, countLabel: "checks" },
            ...PRODUCT_LINES.map((p) => ({
              key: p,
              href: `/rules?product=${p}`,
              label: PRODUCT_LINE_LABELS[p],
              count: applicableRules(p).length,
              countLabel: "checks",
            })),
          ]}
        />
      </div>

      {canTest && product ? (
        <TestCases product={product} results={results} failing={failing} />
      ) : canTest ? (
        <p className="text-[0.8125rem] text-ink-600">
          <span className={cn("font-semibold", failing ? "text-high-700" : "text-approve-700")}>
            {results.length - failing} of {results.length} test cases
          </span>{" "}
          behave as expected across the three products. Pick a product to see them and try one yourself.
        </p>
      ) : null}

      {product ? null : <HowScoringWorks />}

      {RULE_CATEGORIES.map((category) => {
        const inCategory = rules.filter((r) => r.category === category);
        if (inCategory.length === 0) return null;
        return (
          <section key={category} aria-labelledby={`cat-${category}`} className="space-y-3">
            <div>
              <h2 id={`cat-${category}`} className="text-lg font-semibold tracking-[-0.01em] text-ink-950">
                {RULE_CATEGORY_LABELS[category]}
              </h2>
              <p className="text-[0.8125rem] text-ink-500">{CATEGORY_NOTES[category]}</p>
            </div>
            <ul className="grid gap-3 lg:grid-cols-2">
              {inCategory.map((rule) => (
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

function describeExpectation(ids: readonly string[]): string {
  if (ids.length === 0) return "Should pass clean";
  if (ids.length > 2) return `Should flag ${ids.length} checks`;
  return `Should flag: ${ids.map((id) => ruleTitle.get(id) ?? id).join("; ")}`;
}

/**
 * One row per test case: what it should flag, whether it did, and the copy.
 * "Try it" opens the case in New submission, where the pre-check runs as you
 * edit and nothing is saved until you submit.
 */
function TestCases({ product, results, failing }: { product: ProductLine; results: ScenarioResult[]; failing: number }) {
  return (
    <Card aria-labelledby="tests-title">
      <CardHeader
        titleId="tests-title"
        title={`${PRODUCT_LINE_LABELS[product]} test cases`}
        action={
          <span className={cn("text-[0.8125rem] font-semibold", failing ? "text-high-700" : "text-approve-700")}>
            {results.length - failing} of {results.length} as expected
          </span>
        }
      />
      <ul className="divide-y divide-line">
        {results.map((r) => (
          <li key={r.scenario.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-3 hover:bg-paper/60 [&::-webkit-details-marker]:hidden">
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-white",
                    r.ok ? "bg-approve-500" : "bg-high-600",
                  )}
                >
                  {r.ok ? <Check className="size-3" strokeWidth={3} aria-hidden="true" /> : <X className="size-3" strokeWidth={3} aria-hidden="true" />}
                  <span className="sr-only">{r.ok ? "As expected:" : "Not as expected:"}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] font-medium text-ink-900">{r.scenario.label}</span>
                  <span className="mt-0.5 block text-xs text-ink-500">
                    {CHANNEL_LABELS[r.scenario.channel]} · {describeExpectation(r.scenario.expect)}
                  </span>
                  {r.missed.length ? (
                    <span className="mt-0.5 block text-xs font-medium text-high-700">
                      Missed: {r.missed.map((id) => ruleTitle.get(id) ?? id).join("; ")}
                    </span>
                  ) : null}
                  {r.unexpected.length ? (
                    <span className="mt-0.5 block text-xs font-medium text-high-700">
                      Also flagged: {r.unexpected.map((id) => ruleTitle.get(id) ?? id).join("; ")}
                    </span>
                  ) : null}
                </span>
                <ChevronDown className="mt-0.5 size-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="space-y-3 px-5 pb-4 pl-[3.25rem]">
                <p className="proof whitespace-pre-line rounded-md bg-paper px-4 py-3 text-[0.9375rem]">{r.scenario.body}</p>
                {r.flagged.length ? (
                  <ul className="space-y-1 text-[0.8125rem] text-ink-700">
                    {r.flagged.map((id) => {
                      const rule = RULES.find((x) => x.id === id);
                      return (
                        <li key={id} className="flex items-center gap-2">
                          {rule ? <SeverityGlyph severity={rule.severity} /> : null}
                          {rule?.title ?? id}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[0.8125rem] text-approve-700">No findings.</p>
                )}
                <Link
                  href={`/submissions/new?example=${r.scenario.id}`}
                  className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-brand-700 hover:underline"
                >
                  Try it yourself
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </details>
          </li>
        ))}
      </ul>
      <CardNote>
        These cases run before every change goes live, and again each time this page opens. Trying one opens it as a new submission to
        edit: nothing is saved or sent unless you press Submit.
      </CardNote>
    </Card>
  );
}

function HowScoringWorks() {
  return (
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
  );
}
