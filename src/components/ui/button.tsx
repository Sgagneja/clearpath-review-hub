import { cn } from "@/lib/cn";

const VARIANTS = {
  primary:
    "bg-ink-900 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] hover:bg-ink-800 active:bg-ink-950 disabled:bg-ink-300",
  brand:
    "bg-brand-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-200",
  secondary:
    "bg-white text-ink-900 shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-paper hover:shadow-[inset_0_0_0_1px_var(--color-ink-300)] disabled:text-ink-400",
  ghost: "text-ink-700 hover:bg-ink-900/5 hover:text-ink-950 disabled:text-ink-300",
  danger:
    "bg-high-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1)] hover:bg-high-700 active:bg-high-800 disabled:bg-high-200",
  warning:
    "bg-medium-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1)] hover:bg-medium-700 active:bg-medium-800 disabled:bg-medium-200",
} as const;

const SIZES = {
  sm: "h-8 gap-1.5 rounded-md px-3 text-[0.8125rem]",
  md: "h-10 gap-2 rounded-lg px-4 text-sm",
  lg: "h-12 gap-2 rounded-lg px-5 text-[0.9375rem]",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

/** Shared so links can look like buttons without nesting <a><button>. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,box-shadow,color] duration-150 disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
