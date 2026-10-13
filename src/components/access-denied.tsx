import Link from "next/link";
import { buttonClasses } from "./ui/button";

/**
 * Shown when a signed-in user opens a page their role can't use. The check
 * happens on the server, so the reason here comes straight from the policy.
 */
export function AccessDenied({ reason, home }: { reason: string; home: string }) {
  return (
    <div className="max-w-xl py-6">
      <h1 className="page-title">Not available for your role</h1>
      <p className="mt-2 text-ink-600">{reason}</p>
      <p className="mt-1 text-sm text-ink-500">To see this page as another role, switch person from the sidebar.</p>
      <Link href={home} className={buttonClasses({ variant: "secondary", className: "mt-6" })}>
        Back to your work
      </Link>
    </div>
  );
}
