import { wordDiff } from "@/domain/diff";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";

/** Word-level redline between two versions, like tracked changes in a contract. */
export function Redline({ previous, next, className }: { previous: string; next: string; className?: string }) {
  const diff = wordDiff(previous, next);
  return (
    <div className={className}>
      <p className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.6875rem] text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="redline-ins px-1">+</span>
          {pluralize(diff.wordsAdded, "word")} added
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="redline-del px-1">−</span>
          {pluralize(diff.wordsRemoved, "word")} removed
        </span>
      </p>
      <div className={cn("proof")}>
        {diff.segments.map((segment, i) =>
          segment.kind === "added" ? (
            <ins key={i} className="redline-ins">
              <span className="sr-only">[added: </span>
              {segment.text}
              <span className="sr-only">]</span>
            </ins>
          ) : segment.kind === "removed" ? (
            <del key={i} className="redline-del">
              <span className="sr-only">[removed: </span>
              {segment.text}
              <span className="sr-only">]</span>
            </del>
          ) : (
            <span key={i}>{segment.text}</span>
          ),
        )}
      </div>
    </div>
  );
}
