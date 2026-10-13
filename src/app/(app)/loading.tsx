/** Skeleton shown while a page's server data loads. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <div className="h-3 w-28 rounded bg-ink-100" />
        <div className="h-8 w-80 max-w-full rounded bg-ink-100" />
        <div className="h-4 w-[32rem] max-w-full rounded bg-ink-50" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 rounded-xl border border-line bg-white" />
        ))}
      </div>
      <div className="h-96 rounded-xl border border-line bg-white" />
    </div>
  );
}
