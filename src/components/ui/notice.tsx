import { CircleAlert, CircleCheck, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";

const TONES = {
  info: { box: "border-low-200 bg-low-50 text-low-800", icon: Info },
  success: { box: "border-approve-100 bg-approve-50 text-approve-700", icon: CircleCheck },
  warning: { box: "border-medium-200 bg-medium-50 text-medium-800", icon: CircleAlert },
  error: { box: "border-high-200 bg-high-50 text-high-800", icon: CircleAlert },
  guard: { box: "border-ink-200 bg-ink-50 text-ink-800", icon: ShieldAlert },
} as const;

export type NoticeTone = keyof typeof TONES;

export function Notice({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: NoticeTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  const { box, icon: Icon } = TONES[tone];
  return (
    <div role={role} className={cn("flex gap-3 rounded-lg border px-3.5 py-3 text-[0.8125rem] leading-relaxed", box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div> : null}
      </div>
    </div>
  );
}
