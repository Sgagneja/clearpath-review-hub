import {
  BadgeCheck,
  Ban,
  Download,
  Eye,
  FileInput,
  FilePen,
  FilePlus2,
  FileSpreadsheet,
  FileStack,
  LogIn,
  LogOut,
  MessageSquare,
  ScanSearch,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { auditTone, type AuditAction } from "@/domain/audit";
import { ROLE_LABELS } from "@/domain/types";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { TimelineItem } from "@/server/queries/submission";
import { Avatar } from "./ui/avatar";

export const AUDIT_ICONS: Record<AuditAction, LucideIcon> = {
  "session.signed_in": LogIn,
  "session.signed_out": LogOut,
  "submission.created": FilePlus2,
  "submission.imported": FileInput,
  "submission.resubmitted": FileStack,
  "import.tracker": FileSpreadsheet,
  "precheck.completed": ScanSearch,
  "reviewer.assigned": UserPlus,
  "review.started": Eye,
  "comment.added": MessageSquare,
  "decision.approved": BadgeCheck,
  "decision.changes_requested": FilePen,
  "decision.rejected": Ban,
  "audit.exported": Download,
};

export const TONE_STYLES = {
  neutral: "bg-white text-ink-600 ring-line-strong",
  system: "bg-ink-50 text-ink-500 ring-ink-200",
  positive: "bg-approve-50 text-approve-600 ring-approve-100",
  warning: "bg-medium-50 text-medium-700 ring-medium-200",
  negative: "bg-high-50 text-high-700 ring-high-200",
} as const;

/** Activity on one submission: workflow events and discussion, oldest first. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? <span aria-hidden="true" className="absolute bottom-0 left-[0.9375rem] top-8 w-px bg-line" /> : null}
            {item.kind === "event" ? <EventItem item={item} /> : <CommentItem item={item} />}
          </li>
        );
      })}
    </ol>
  );
}

function EventItem({ item }: { item: Extract<TimelineItem, { kind: "event" }> }) {
  const Icon = AUDIT_ICONS[item.action];
  const tone = auditTone(item.action);
  return (
    <>
      <span className={cn("relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full ring-1", TONE_STYLES[tone])}>
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-1.5">
        <p className="text-[0.8125rem] text-ink-800">
          <span className={cn(tone === "system" && "text-ink-500")}>{item.summary}</span>
        </p>
        <p className="mt-0.5 font-mono text-[0.6875rem] text-ink-400">
          <time dateTime={item.at.toISOString()}>{formatDateTime(item.at)}</time>
        </p>
        {item.attachment ? (
          <blockquote
            className={cn(
              "mt-2 rounded-r-md border-l-2 bg-paper px-3 py-2 text-[0.8125rem] leading-relaxed text-ink-700",
              tone === "positive" ? "border-approve-500" : tone === "negative" ? "border-high-500" : tone === "warning" ? "border-medium-500" : "border-ink-300",
            )}
          >
            {item.attachment}
          </blockquote>
        ) : null}
      </div>
    </>
  );
}

function CommentItem({ item }: { item: Extract<TimelineItem, { kind: "comment" }> }) {
  return (
    <>
      <Avatar person={item.author} className="relative z-10" />
      <div className="min-w-0 flex-1">
        <div className="rounded-lg border border-line bg-white px-3.5 py-2.5 shadow-[var(--shadow-card)]">
          <p className="flex flex-wrap items-baseline gap-x-2 text-[0.8125rem]">
            <span className="font-semibold text-ink-900">{item.author?.name ?? "Former user"}</span>
            {item.author ? <span className="text-xs text-ink-500">{ROLE_LABELS[item.author.role]}</span> : null}
            <span className="font-mono text-[0.6875rem] text-ink-400">
              v{item.version} · <time dateTime={item.at.toISOString()}>{formatDateTime(item.at)}</time>
            </span>
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[0.875rem] leading-relaxed text-ink-800">{item.body}</p>
        </div>
      </div>
    </>
  );
}
