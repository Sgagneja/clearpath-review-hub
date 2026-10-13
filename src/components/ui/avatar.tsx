import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

/* Muted, print-like swatches. Picked per person, so a face stays one colour everywhere. */
const SWATCHES = [
  "bg-[#e8dccb] text-[#5c4326]",
  "bg-[#d8e4da] text-[#2f5238]",
  "bg-[#dbe2ef] text-[#2d4470]",
  "bg-[#efd9d3] text-[#7a3626]",
  "bg-[#e4dbea] text-[#4f3866]",
  "bg-[#d3e7e3] text-[#1d5650]",
  "bg-[#ece4c8] text-[#5f5114]",
];

function swatchFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SWATCHES[hash % SWATCHES.length];
}

const SIZES = {
  xs: "size-5 text-[0.55rem]",
  sm: "size-6 text-[0.625rem]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
} as const;

export function Avatar({
  person,
  size = "md",
  className,
}: {
  person: { id: string; name: string } | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (!person) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-ink-300 text-ink-400",
          SIZES[size],
          className,
        )}
      >
        ?
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-wide",
        swatchFor(person.id),
        SIZES[size],
        className,
      )}
    >
      {initials(person.name)}
    </span>
  );
}

/** System actor (the automated pre-check) in timelines and the audit trail. */
export function SystemAvatar({ size = "md", className }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-ink-900 text-brand-200",
        SIZES[size],
        className,
      )}
    >
      <svg viewBox="0 0 16 16" className="size-[55%]" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 8.5 6.2 11.5 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
