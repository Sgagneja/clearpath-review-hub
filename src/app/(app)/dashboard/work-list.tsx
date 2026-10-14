import Link from "next/link";
import { SeverityGlyph } from "@/components/severity";
import { SlaIndicator } from "@/components/sla";
import { CardBody } from "@/components/ui/card";
import type { SlaView } from "@/domain/sla";
import { SEVERITY_LABELS, type RiskLevel } from "@/domain/types";
import { cn } from "@/lib/cn";

export interface WorkItem {
  reference: string;
  title: string;
  riskLevel: RiskLevel;
  sla: SlaView;
  launchAtRisk: boolean;
}

/**
 * Reviews as a short list: risk mark, asset, an optional short column (who
 * has it, or its status) and the deadline. The whole row opens the review.
 *
 * The same list sits in wide and narrow cards, so it lays itself out by the
 * card's width rather than the screen's: in a narrow card the deadline drops
 * under the title, and the extra column only appears when there is room.
 */
export function WorkList<T extends WorkItem>({
  items,
  now,
  aside,
  empty,
}: {
  items: T[];
  now: Date;
  aside?: (item: T) => React.ReactNode;
  empty: React.ReactNode;
}) {
  if (items.length === 0) {
    return (
      <CardBody>
        <p className="text-sm text-ink-500">{empty}</p>
      </CardBody>
    );
  }
  return (
    <ul className="@container divide-y divide-line">
      {items.map((item) => (
        <li
          key={item.reference}
          className={cn(
            "relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 px-5 py-3 hover:bg-paper/60",
            "@md:grid-cols-[auto_minmax(0,1fr)_9rem] @md:items-center @md:gap-x-4",
            aside && "@xl:grid-cols-[auto_minmax(0,1fr)_7rem_9rem]",
          )}
        >
          <SeverityGlyph severity={item.riskLevel} className="mt-1.5 @md:mt-0" />
          <div className="min-w-0">
            <Link
              href={`/submissions/${item.reference}`}
              className="block truncate text-[0.875rem] font-medium text-ink-900 after:absolute after:inset-0 hover:text-brand-700"
            >
              {item.title}
            </Link>
            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[0.6875rem] text-ink-500">
              {item.reference}
              <span className="sr-only">, {SEVERITY_LABELS[item.riskLevel].toLowerCase()} risk</span>
              {item.launchAtRisk ? <span className="font-sans font-semibold text-medium-700">· launch at risk</span> : null}
            </p>
          </div>
          {aside ? <div className="hidden min-w-0 truncate text-xs @xl:block">{aside(item)}</div> : null}
          <div className="col-start-2 @md:col-start-auto">
            <SlaIndicator sla={item.sla} now={now} compact />
          </div>
        </li>
      ))}
    </ul>
  );
}
