import { cn } from "@/lib/cn";

/** Page title block. `context` is a short line above the title, such as a date range. */
export function PageHeader({
  context,
  title,
  description,
  actions,
  className,
}: {
  context?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {context ? <p className="mb-1 text-[0.8125rem] font-medium text-ink-500">{context}</p> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="mt-1.5 max-w-[75ch] text-ink-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
