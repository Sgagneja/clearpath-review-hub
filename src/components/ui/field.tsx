import { cn } from "@/lib/cn";

const CONTROL =
  "block w-full rounded-lg border border-line-strong bg-white px-3 text-[0.9375rem] text-ink-950 shadow-[inset_0_1px_1px_rgb(8_21_42/0.04)] transition-[border-color,box-shadow] placeholder:text-ink-400 hover:border-ink-300 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-100 aria-[invalid=true]:border-high-500 aria-[invalid=true]:focus:ring-high-100 disabled:bg-paper disabled:text-ink-500";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("block text-[0.8125rem] font-medium text-ink-800", className)} {...props} />;
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(CONTROL, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(CONTROL, "py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        CONTROL,
        "select-chevron h-10 appearance-none pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function FieldHint({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-[0.8125rem] text-ink-500", className)} {...props} />;
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-high-700">
      <svg viewBox="0 0 16 16" aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" fill="currentColor">
        <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm-.75 3.25h1.5v4.5h-1.5v-4.5Zm0 5.75h1.5V12h-1.5v-1.5Z" />
      </svg>
      {message}
    </p>
  );
}
