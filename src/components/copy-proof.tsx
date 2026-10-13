import { Fragment } from "react";
import { segmentText } from "@/domain/highlight";
import type { Finding } from "@/domain/types";
import { cn } from "@/lib/cn";
import { SEVERITY_FILL } from "./severity";

/**
 * The submitted copy with every flagged phrase highlighted and footnoted.
 * Footnote numbers link down to the finding (`#finding-N`) and each finding
 * links back up to its first highlight (`#match-N`). Plain anchors and CSS
 * `:target`, no client JavaScript.
 */
export function CopyProof({ body, findings, className }: { body: string; findings: Finding[]; className?: string }) {
  const segments = segmentText(body, findings);
  const anchored = new Set<number>();

  return (
    <div className={cn("proof", className)}>
      {segments.map((segment) => {
        if (!segment.severity) return <Fragment key={segment.start}>{segment.text}</Fragment>;

        const anchors = segment.findingIndexes.filter((i) => !anchored.has(i));
        anchors.forEach((i) => anchored.add(i));
        const endingHere = segment.findingIndexes.filter((i) =>
          findings[i].matches.some((m) => Math.min(m.end, body.length) === segment.end),
        );

        return (
          <Fragment key={segment.start}>
            {anchors.map((i) => (
              <span key={i} id={`match-${i + 1}`} className="scroll-mt-28" />
            ))}
            <mark
              className={cn("hl", `hl-${segment.severity}`)}
              title={segment.findingIndexes.map((i) => `${i + 1}. ${findings[i].title}`).join("\n")}
            >
              {segment.text}
            </mark>
            {endingHere.map((i) => (
              <a
                key={i}
                href={`#finding-${i + 1}`}
                className={cn("fn hover:brightness-110", SEVERITY_FILL[findings[i].severity])}
                aria-label={`Finding ${i + 1}: ${findings[i].title}`}
              >
                {i + 1}
              </a>
            ))}
          </Fragment>
        );
      })}
    </div>
  );
}
