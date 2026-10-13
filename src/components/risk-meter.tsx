import { RISK_THRESHOLDS } from "@/domain/risk";
import type { RiskLevel } from "@/domain/types";
import { cn } from "@/lib/cn";
import { SEVERITY_TEXT, SeverityGlyph } from "./severity";

const LEVEL_LABEL: Record<RiskLevel, string> = {
  high: "High risk",
  medium: "Medium risk",
  low: "Low risk",
};

/**
 * The risk score drawn as a ruler: three tinted zones split at the level
 * thresholds, tick marks at 20 and 50, and a needle at the score.
 */
export function RiskRuler({ score, level, className }: { score: number; level: RiskLevel; className?: string }) {
  const needle = { high: "bg-high-700", medium: "bg-medium-700", low: "bg-low-700" }[level];
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="flex shrink-0 flex-col">
        <span className={cn("font-serif text-[2.5rem] leading-none tabular-nums", SEVERITY_TEXT[level])}>{score}</span>
        <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-ink-600">
          <SeverityGlyph severity={level} />
          {LEVEL_LABEL[level]}
        </span>
      </div>
      <div className="min-w-0 flex-1" role="img" aria-label={`Risk score ${score} out of 100, ${LEVEL_LABEL[level].toLowerCase()}`}>
        <div className="relative h-2.5 overflow-visible rounded-full">
          <div className="absolute inset-0 flex overflow-hidden rounded-full">
            <span className="h-full bg-low-100" style={{ width: `${RISK_THRESHOLDS.medium}%` }} />
            <span className="h-full bg-medium-100" style={{ width: `${RISK_THRESHOLDS.high - RISK_THRESHOLDS.medium}%` }} />
            <span className="h-full flex-1 bg-high-100" />
          </div>
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,var(--color-low-500),var(--color-medium-500)_45%,var(--color-high-600))]"
            style={{ width: `${Math.max(score, 1.5)}%`, clipPath: "inset(0 round 999px)" }}
          />
          <span
            className={cn("absolute -top-1 h-[1.125rem] w-1 -translate-x-1/2 rounded-full ring-2 ring-white", needle)}
            style={{ left: `${Math.min(Math.max(score, 1), 99)}%` }}
          />
        </div>
        <div className="relative mt-1.5 h-4 font-mono text-[0.625rem] text-ink-400">
          <span className="absolute left-0">0</span>
          <span className="absolute -translate-x-1/2" style={{ left: `${RISK_THRESHOLDS.medium}%` }}>
            {RISK_THRESHOLDS.medium}
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: `${RISK_THRESHOLDS.high}%` }}>
            {RISK_THRESHOLDS.high}
          </span>
          <span className="absolute right-0">100</span>
        </div>
      </div>
    </div>
  );
}

/** Compact score for tables: number + a 10-cell bar. */
export function RiskPill({ score, level }: { score: number; level: RiskLevel }) {
  const filled = Math.round(score / 10);
  const fill = { high: "bg-high-600", medium: "bg-medium-500", low: "bg-low-500" }[level];
  return (
    <span className="inline-flex items-center gap-2" aria-label={`Risk ${score}, ${level}`}>
      <span className={cn("w-6 text-right font-mono text-[0.8125rem] font-medium tabular-nums", SEVERITY_TEXT[level])}>
        {score}
      </span>
      <span className="flex gap-[2px]" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={cn("h-3 w-[3px] rounded-[1px]", i < filled ? fill : "bg-ink-100")} />
        ))}
      </span>
    </span>
  );
}
