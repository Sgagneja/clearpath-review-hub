import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "./ui/button";

/**
 * Shown when a signed-in user opens a page their role can't use. The check
 * happens on the server, so the reason here comes straight from the policy.
 */
export function AccessDenied({ reason, home }: { reason: string; home: string }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-white text-ink-500 ring-1 ring-line">
        <ShieldCheck className="size-5" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-serif text-[1.75rem] font-medium text-ink-950">Not available for your role</h1>
      <p className="mt-2 text-ink-600">{reason}</p>
      <p className="mt-1 text-sm text-ink-500">
        This is enforced on the server, not just hidden in the menu. Switch persona from the sidebar to see it.
      </p>
      <Link href={home} className={buttonClasses({ variant: "secondary", className: "mt-6" })}>
        Back to your work
      </Link>
    </div>
  );
}
