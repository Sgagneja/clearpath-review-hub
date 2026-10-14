import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser, homePathFor } from "@/server/auth";
import { getDirectory } from "@/server/queries/directory";
import { safeNextPath } from "@/lib/validation";
import { PersonaPicker, type PersonaCard } from "./persona-picker";

export const metadata: Metadata = { title: "Sign in" };

/** What each suggested person is good for, so a first-time visitor knows where to start. In display order. */
const FEATURED: Record<string, string> = {
  u_dana: "Start with the whole team: work at each stage, who has what, where it's stuck. Hand out reviews and download the audit trail for an examiner.",
  u_marcus: "Starts on the team overview too, with his own reviews under My work. Try approving copy you wrote yourself: someone else has to decide it.",
  u_priya: "Marketing's side. Write a new email and watch the pre-check flag problems as you type, or revise the wedding-loan email compliance sent back.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [{ next }, directory, current] = await Promise.all([searchParams, getDirectory(), getCurrentUser()]);
  const nextPath = safeNextPath(Array.isArray(next) ? next[0] : next) ?? undefined;

  const featured: PersonaCard[] = Object.entries(FEATURED).flatMap(([id, tryThis]) => {
    const person = directory.get(id);
    return person ? [{ ...person, tryThis }] : [];
  });
  const others = directory.people.filter((p) => !(p.id in FEATURED));
  const teams = [
    { name: "Compliance", people: others.filter((p) => p.role !== "submitter") },
    { name: "Marketing", people: others.filter((p) => p.role === "submitter") },
  ].filter((t) => t.people.length > 0);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-10 sm:px-8 sm:py-16">
      <Logo tone="dark" />

      <h1 className="page-title mt-12">Sign in to Review Hub</h1>
      <p className="mt-2 text-ink-600">
        This is a demo, so there are no passwords. Choose someone from the team to see Review Hub the way they would. You can switch
        person at any time from the sidebar.
      </p>

      {current ? (
        <Link
          href={nextPath ?? homePathFor(current.role)}
          className="mt-6 flex items-center justify-between gap-4 rounded-md border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 hover:bg-brand-100"
        >
          <span>
            You&apos;re signed in as <strong className="font-semibold">{current.name}</strong>.
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 font-medium">
            Continue <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        </Link>
      ) : null}

      <div className="mt-10 flex-1">
        <PersonaPicker featured={featured} teams={teams} next={nextPath} />
      </div>

      <p className="mt-12 text-xs text-ink-400">
        ClearPath Financial is made up: no real customers, products or rates. At a real company, people would sign in with their work
        account.
      </p>
    </main>
  );
}
