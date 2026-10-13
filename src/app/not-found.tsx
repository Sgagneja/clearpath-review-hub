import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <Logo tone="dark" />
      <h1 className="page-title mt-10">Nothing filed under that address</h1>
      <p className="mt-2 text-ink-600">
        The page may have moved, or your role can&apos;t see it. Submitters only see their own work.
      </p>
      <Link href="/" className={buttonClasses({ variant: "secondary", className: "mt-6 self-start" })}>
        Back to your work
      </Link>
    </main>
  );
}
