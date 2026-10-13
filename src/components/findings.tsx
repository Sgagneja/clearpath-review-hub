import { ArrowUpRight, CornerDownRight, PenLine, SearchX } from "lucide-react";
import { RULE_CATEGORY_LABELS, type Finding } from "@/domain/types";
import { cn } from "@/lib/cn";
import { SEVERITY_FILL, SeverityTag } from "./severity";

/**
 * Numbered findings, styled as margin notes. Numbers match the footnote
 * markers in <CopyProof>, and `interactive` adds the links between them.
 */
export function FindingList({
  findings,
  interactive = true,
  className,
}: {
  findings: Finding[];
  interactive?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("space-y-3", className)}>
      {findings.map((finding, index) => {
        const n = index + 1;
        const phrases = [...new Set(finding.matches.map((m) => m.text))];
        return (
          <li
            key={finding.key}
            id={interactive ? `finding-${n}` : undefined}
            className="finding scroll-mt-24 rounded-lg border border-line bg-white p-4 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[0.6875rem] font-medium text-white",
                  SEVERITY_FILL[finding.severity],
                )}
                aria-hidden="true"
              >
                {n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityTag severity={finding.severity} />
                  <span className="eyebrow text-ink-500">{RULE_CATEGORY_LABELS[finding.category]}</span>
                </div>
                <h3 className="mt-1.5 font-semibold leading-snug text-ink-950">
                  <span className="sr-only">Finding {n}: </span>
                  {finding.title}
                </h3>
                <p className="mt-0.5 font-mono text-[0.6875rem] text-ink-500">{finding.citation}</p>
                <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-700">{finding.message}</p>

                {phrases.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {phrases.map((phrase) => (
                      <q
                        key={phrase}
                        className="rounded border border-line bg-paper px-1.5 py-0.5 font-serif text-[0.875rem] italic text-ink-800"
                      >
                        {phrase}
                      </q>
                    ))}
                    {interactive ? (
                      <a
                        href={`#match-${n}`}
                        className="ml-1 inline-flex items-center gap-0.5 text-xs font-medium text-brand-700 hover:text-brand-800 hover:underline"
                      >
                        Show in copy<span className="sr-only"> (finding {n})</span>
                        <ArrowUpRight className="size-3" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2.5 inline-flex items-center gap-1.5 rounded border border-dashed border-line-strong px-1.5 py-0.5 text-xs text-ink-500">
                    <SearchX className="size-3.5" aria-hidden="true" />
                    Missing from the copy
                  </p>
                )}

                <div className="mt-3 flex gap-2 rounded-md bg-brand-50/70 px-3 py-2 text-[0.8125rem] leading-relaxed text-brand-800">
                  <PenLine className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                  <p>
                    <span className="font-semibold">Suggested fix. </span>
                    {finding.suggestion}
                  </p>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** One line per finding, for the summary beside the decision panel. */
export function FindingIndex({ findings, interactive = true }: { findings: Finding[]; interactive?: boolean }) {
  return (
    <ol className="space-y-0.5">
      {findings.map((finding, index) => {
        const n = index + 1;
        const content = (
          <>
            <span
              className={cn(
                "inline-flex size-4 shrink-0 items-center justify-center rounded-full font-mono text-[0.625rem] font-medium text-white",
                SEVERITY_FILL[finding.severity],
              )}
              aria-hidden="true"
            >
              {n}
            </span>
            <span className="min-w-0 flex-1">
              <span className="sr-only">
                {finding.severity} severity:{" "}
              </span>
              {finding.title}
            </span>
          </>
        );
        return (
          <li key={finding.key}>
            {interactive ? (
              <a
                href={`#finding-${n}`}
                className="-mx-2 flex items-start gap-2.5 rounded-md px-2 py-1.5 text-[0.8125rem] leading-snug text-ink-700 hover:bg-ink-900/[0.04] hover:text-ink-950"
              >
                {content}
              </a>
            ) : (
              <span className="flex items-start gap-2.5 py-1.5 text-[0.8125rem] leading-snug text-ink-700">{content}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Findings a revision fixed, shown struck through under the current list. */
export function ResolvedFindings({ findings, sinceVersion }: { findings: Finding[]; sinceVersion: number }) {
  if (findings.length === 0) return null;
  return (
    <div className="rounded-lg border border-approve-100 bg-approve-50/60 px-4 py-3">
      <p className="text-[0.8125rem] font-semibold text-approve-700">
        Resolved since v{sinceVersion} · {findings.length}
      </p>
      <ul className="mt-1.5 space-y-1">
        {findings.map((f) => (
          <li key={f.key} className="flex items-start gap-1.5 text-[0.8125rem] text-ink-600">
            <CornerDownRight className="mt-0.5 size-3.5 shrink-0 text-approve-500" aria-hidden="true" />
            <span className="line-through decoration-approve-500/60">{f.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
