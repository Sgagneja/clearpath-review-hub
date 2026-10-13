import { cn } from "@/lib/cn";

/** The ClearPath mark: a road narrowing to the horizon, centre line dashed. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" fill="#0c7466" />
      <path d="M8.5 25.5 14.6 6.5M23.5 25.5 17.4 6.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 23.5v-2.6M16 17.6v-2.2M16 12.4v-1.8" stroke="#a3d8cd" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-serif text-[1.15rem] font-semibold tracking-[-0.01em]",
            tone === "light" ? "text-white" : "text-ink-950",
          )}
        >
          ClearPath
        </span>
        <span className={cn("eyebrow mt-1 text-[0.6rem]", tone === "light" ? "text-brand-200" : "text-brand-700")}>
          Review Hub
        </span>
      </span>
    </span>
  );
}
