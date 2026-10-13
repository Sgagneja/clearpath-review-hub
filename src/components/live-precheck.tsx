"use client";

import { ChevronDown, ScanSearch } from "lucide-react";
import { useDeferredValue, useMemo } from "react";
import { compareFindings, runPrecheck } from "@/domain/precheck/engine";
import { SLA_HOURS } from "@/domain/sla";
import { SEVERITIES, type Channel, type Finding, type ProductLine } from "@/domain/types";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";
import { RiskRuler } from "./risk-meter";
import { SEVERITY_FILL, SeverityGlyph, SeverityTag } from "./severity";

/**
 * The pre-check, running in the browser on every keystroke. It is the same
 * rule set the server runs on submit, so what you see here is what compliance
 * sees. The server never trusts this result; it re-runs the check itself.
 */
export function LivePrecheck({
  text,
  productLine,
  channel,
  previousFindings,
  previousVersion,
  className,
}: {
  text: string;
  productLine: ProductLine;
  channel: Channel;
  /** When revising: findings on the version being replaced, to show progress. */
  previousFindings?: Finding[];
  previousVersion?: number;
  className?: string;
}) {
  const deferredText = useDeferredValue(text);
  const result = useMemo(
    () => runPrecheck({ text: deferredText, productLine, channel }),
    [deferredText, productLine, channel],
  );
  const delta = useMemo(
    () => (previousFindings ? compareFindings(previousFindings, result.findings) : null),
    [previousFindings, result.findings],
  );
  const empty = deferredText.trim().length === 0;
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, result.findings.filter((f) => f.severity === s).length]));

  return (
    <section aria-labelledby="live-precheck-title" className={cn("rounded-xl border border-line bg-white shadow-[var(--shadow-card)]", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 id="live-precheck-title" className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink-950">
          <ScanSearch className="size-4 text-brand-600" aria-hidden="true" />
          Live pre-check
        </h2>
        <span className="font-mono text-[0.625rem] text-ink-400">
          {result.rulesEvaluated} rules · v{result.engineVersion}
        </span>
      </header>

      <div className="space-y-4 px-5 py-4" aria-live="polite" aria-atomic="false">
        {empty ? (
          <p className="text-sm text-ink-500">Paste or type the copy and the rules run as you go.</p>
        ) : (
          <>
            <RiskRuler score={result.score} level={result.level} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-ink-600">
              {SEVERITIES.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <SeverityGlyph severity={s} />
                  <span className="font-mono tabular-nums">{counts[s]}</span> {s}
                </span>
              ))}
            </div>
            {delta && previousVersion ? (
              <p className="rounded-md bg-paper px-3 py-2 text-[0.8125rem] text-ink-700">
                Compared with v{previousVersion}:{" "}
                <strong className="font-semibold text-approve-700">{delta.resolved.length} resolved</strong>,{" "}
                <strong className={cn("font-semibold", delta.introduced.length ? "text-high-700" : "text-ink-700")}>
                  {delta.introduced.length} new
                </strong>
                , {delta.persisting.length} still open.
              </p>
            ) : null}
          </>
        )}
      </div>

      {!empty && result.findings.length > 0 ? (
        <ol className="divide-y divide-line border-t border-line">
          {result.findings.map((finding, i) => (
            <li key={finding.key}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-3 hover:bg-paper/60 [&::-webkit-details-marker]:hidden">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[0.625rem] text-white",
                      SEVERITY_FILL[finding.severity],
                    )}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.8125rem] font-medium leading-snug text-ink-900">{finding.title}</span>
                    <span className="mt-0.5 block font-mono text-[0.625rem] text-ink-500">{finding.citation}</span>
                  </span>
                  <ChevronDown className="mt-0.5 size-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="space-y-2 px-5 pb-4 pl-[3.25rem] text-[0.8125rem] leading-relaxed">
                  <SeverityTag severity={finding.severity} />
                  <p className="text-ink-700">{finding.message}</p>
                  <p className="rounded-md bg-brand-50/70 px-3 py-2 text-brand-800">
                    <span className="font-semibold">Suggested fix. </span>
                    {finding.suggestion}
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ol>
      ) : null}

      {!empty && result.findings.length === 0 ? (
        <p className="border-t border-line px-5 py-3 text-[0.8125rem] text-approve-700">
          No findings. A reviewer still reads every word, but this should be a quick one.
        </p>
      ) : null}

      <footer className="rounded-b-xl border-t border-line bg-paper/60 px-5 py-3 text-xs leading-relaxed text-ink-500">
        {empty
          ? "Review SLA is set by risk: 48h high, 72h medium, 120h low."
          : `If you submit now: ${pluralize(result.findings.length, "finding")}, ${result.level} risk, reviewed within ${SLA_HOURS[result.level]} hours.`}{" "}
        Compliance re-runs the same check on submit.
      </footer>
    </section>
  );
}
