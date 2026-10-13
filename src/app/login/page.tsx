import { ArrowRight, KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Notice } from "@/components/ui/notice";
import { getCurrentUser, homePathFor } from "@/server/auth";
import { getDirectory } from "@/server/queries/directory";
import { safeNextPath } from "@/lib/validation";
import { PersonaPicker, type PersonaCard } from "./persona-picker";

export const metadata: Metadata = { title: "Sign in" };

/** What each featured persona is good for, so a first-time visitor knows where to start. */
const FEATURED: Record<string, string[]> = {
  u_priya: [
    "Draft a new email and watch the pre-check flag it live",
    "Revise the wedding-loan email that compliance sent back",
  ],
  u_marcus: [
    "Work the queue: SLA timers, risk scores, launch dates",
    "Try to approve your own copy and hit separation of duties",
  ],
  u_dana: [
    "See cycle time, SLA hit rate and where work gets stuck",
    "Assign reviewers and export the audit trail for an examiner",
  ],
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [{ next }, directory, current] = await Promise.all([searchParams, getDirectory(), getCurrentUser()]);
  const nextPath = safeNextPath(Array.isArray(next) ? next[0] : next) ?? undefined;

  const featured: PersonaCard[] = Object.entries(FEATURED).flatMap(([id, tryThis]) => {
    const person = directory.get(id);
    return person ? [{ ...person, tryThis }] : [];
  });
  const others = directory.people.filter((p) => !(p.id in FEATURED));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]">
      <BrandPanel />

      <main className="flex min-h-screen flex-col px-5 py-10 sm:px-10 lg:px-16 lg:py-14">
        <div className="mx-auto w-full max-w-xl flex-1 2xl:max-w-2xl">
          <div className="lg:hidden">
            <Logo tone="dark" />
          </div>
          <p className="eyebrow mt-10 text-brand-700 lg:mt-0">Demo sign-in</p>
          <h1 className="mt-2 font-serif text-[2.125rem] font-medium leading-tight tracking-[-0.015em] text-ink-950">
            Pick who you want to be
          </h1>
          <p className="mt-2 text-ink-600">
            Three roles, one workflow. Each persona signs you in with its own session, and you can switch at any time from the
            sidebar.
          </p>

          {current ? (
            <Link
              href={nextPath ?? homePathFor(current.role)}
              className="mt-6 flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 hover:bg-brand-100"
            >
              <span>
                You&apos;re signed in as <strong className="font-semibold">{current.name}</strong>.
              </span>
              <span className="inline-flex items-center gap-1 font-medium">
                Continue <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </Link>
          ) : null}

          <div className="mt-7">
            <PersonaPicker featured={featured} others={others} next={nextPath} />
          </div>

          <Notice tone="guard" className="mt-8" title="Why there's no password">
            This is a public demo, so personas replace real accounts. The session is still a signed, HttpOnly cookie, and every
            permission check runs on the server. In production, sign-in would go through ClearPath&apos;s identity provider (SSO
            over OIDC) and nothing else would change.
          </Notice>
        </div>
        <p className="mx-auto mt-10 w-full max-w-xl font-mono text-[0.6875rem] text-ink-400 2xl:max-w-2xl">
          ClearPath Financial is fictional. No real customers, products or rates.
        </p>
      </main>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-ink-950 text-white lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(var(--color-ink-300)_1px,transparent_1px),linear-gradient(90deg,var(--color-ink-300)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_30%_40%,black,transparent_75%)]"
      />
      <Logo className="relative" />

      <div className="relative max-w-lg 2xl:max-w-xl">
        <p className="eyebrow text-brand-300">Marketing compliance · ClearPath Financial</p>
        <p className="mt-4 font-serif text-[2.75rem] font-medium leading-[1.08] tracking-[-0.02em]">
          Every claim checked. <span className="italic text-brand-200">Every decision on the record.</span>
        </p>
        <p className="mt-5 max-w-md text-[0.9375rem] leading-relaxed text-ink-300">
          Submit copy, get an instant rules-based pre-check, and move it through review with SLAs and an audit trail an
          examiner can read. No spreadsheets, no email threads.
        </p>

        <ProofPreview />
      </div>

      <dl className="relative grid grid-cols-3 gap-6 border-t border-white/10 pt-6 font-mono text-[0.6875rem] text-ink-400">
        <div>
          <dt className="eyebrow text-[0.5625rem] text-ink-500">Pre-check</dt>
          <dd className="mt-1 text-ink-200">16 rules · Reg Z, FCRA, UDAAP, ECOA</dd>
        </div>
        <div>
          <dt className="eyebrow text-[0.5625rem] text-ink-500">Review SLA</dt>
          <dd className="mt-1 text-ink-200">48–120 h, set by risk</dd>
        </div>
        <div>
          <dt className="eyebrow text-[0.5625rem] text-ink-500">Audit trail</dt>
          <dd className="mt-1 text-ink-200">Append-only, enforced in Postgres</dd>
        </div>
      </dl>
    </aside>
  );
}

/** A miniature review sheet: the product in one glance. Decorative. */
function ProofPreview() {
  return (
    <div aria-hidden="true" className="relative mt-10 max-w-md 2xl:max-w-lg">
      <div className="absolute -right-4 -top-4 z-10 rounded-lg bg-white px-3 py-2 text-ink-900 shadow-[var(--shadow-raised)]">
        <p className="eyebrow text-[0.5625rem] text-ink-500">Risk</p>
        <p className="font-serif text-2xl leading-none text-high-700">
          75 <span className="font-sans text-xs font-medium text-ink-500">high</span>
        </p>
      </div>
      <div className="-rotate-[1.5deg] rounded-xl bg-paper p-5 text-ink-900 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.5)]">
        <p className="flex items-center justify-between font-mono text-[0.625rem] text-ink-500">
          <span>MKT-1017 · v1 · Social post</span>
          <KeyRound className="size-3" />
        </p>
        <p className="proof mt-3 text-[0.9375rem] leading-relaxed">
          Find out what you can afford.{" "}
          <mark className="hl hl-high">You&apos;re approved</mark>
          <span className="fn bg-high-600">1</span> for a home loan in minutes, and checking{" "}
          <mark className="hl hl-medium">won&apos;t affect your score</mark>
          <span className="fn bg-medium-500">2</span>.
        </p>
        <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-[0.75rem]">
          <p className="flex items-center gap-2">
            <span className="fn ml-0 bg-high-600">1</span>
            <span className="font-medium">Prequalification presented as approval</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="fn ml-0 bg-medium-500">2</span>
            <span className="font-medium">Credit-score claim without the soft-pull qualifier</span>
          </p>
        </div>
      </div>
    </div>
  );
}
