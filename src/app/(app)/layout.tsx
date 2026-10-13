import { Sidebar } from "@/components/app-shell/sidebar";
import { requireUser } from "@/server/auth";
import { getDirectory } from "@/server/queries/directory";
import { countMyQueue } from "@/server/queries/queue";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [directory, queueCount] = await Promise.all([getDirectory(), countMyQueue(user)]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-ink-950 focus:shadow-[var(--shadow-raised)]"
      >
        Skip to content
      </a>
      <Sidebar user={user} people={directory.people} queueCount={queueCount} />
      <main id="main" tabIndex={-1} className="min-w-0 px-4 py-7 outline-none sm:px-8 lg:px-10 lg:py-10 2xl:px-14 2xl:py-12">
        {children}
      </main>
    </div>
  );
}
