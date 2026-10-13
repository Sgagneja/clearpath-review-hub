import { CircleCheck, CirclePause, Clock, TimerOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { SlaView } from "@/domain/sla";

const TONE = {
  on_track: "text-ink-700",
  due_soon: "text-medium-700",
  overdue: "text-high-700",
  met: "text-approve-700",
  missed: "text-high-700",
  paused: "text-ink-500",
} as const;

/** `extra` trails the label and wraps onto its own line in narrow columns. */
function describe(sla: SlaView, now: Date): { label: string; extra?: string; detail: string } {
  switch (sla.state) {
    case "paused":
      return { label: "With submitter", extra: formatDuration(now.getTime() - sla.since.getTime()), detail: "Deadline paused while changes are made" };
    case "overdue":
      return { label: `Overdue ${formatDuration(sla.remainingMs)}`, detail: `Was due ${formatDateTime(sla.dueAt)}` };
    case "due_soon":
    case "on_track":
      return { label: `Due in ${formatDuration(sla.remainingMs)}`, detail: formatDateTime(sla.dueAt) };
    case "met":
      return { label: "Decided on time", detail: `${formatDuration(sla.remainingMs)} to spare` };
    case "missed":
      return { label: "Decided late", detail: `${formatDuration(sla.remainingMs)} past the deadline` };
  }
}

function SlaIcon({ state }: { state: SlaView["state"] }) {
  const Icon = state === "paused" ? CirclePause : state === "met" ? CircleCheck : state === "missed" ? TimerOff : Clock;
  return <Icon className="mt-[0.1875rem] size-3.5 shrink-0" aria-hidden="true" />;
}

/** Review-deadline status with a thin "fuse" that burns down as the window is used. */
export function SlaIndicator({ sla, now, compact = false }: { sla: SlaView; now: Date; compact?: boolean }) {
  const { label, extra, detail } = describe(sla, now);
  const showFuse = sla.state === "on_track" || sla.state === "due_soon" || sla.state === "overdue";
  const fuse = sla.state === "overdue" ? "bg-high-600" : sla.state === "due_soon" ? "bg-medium-500" : "bg-brand-500";

  return (
    <div className="min-w-0">
      <p className={cn("flex items-start gap-1.5 text-[0.8125rem] font-medium", TONE[sla.state])}>
        <SlaIcon state={sla.state} />
        <span>
          <span className="whitespace-nowrap">{label}</span>
          {extra ? <span className="whitespace-nowrap"> · {extra}</span> : null}
        </span>
      </p>
      {showFuse ? (
        <div className="mt-1.5 h-1 w-full max-w-36 overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
          <div className={cn("h-full rounded-full", fuse)} style={{ width: `${Math.round(sla.elapsedFraction * 100)}%` }} />
        </div>
      ) : null}
      {!compact ? <p className="mt-1 font-mono text-[0.6875rem] text-ink-500">{detail}</p> : null}
    </div>
  );
}
