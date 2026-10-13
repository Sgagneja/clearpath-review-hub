"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Avatar } from "@/components/ui/avatar";
import { FormMessage } from "@/components/ui/form-message";
import { ROLE_LABELS, type Role } from "@/domain/types";
import { cn } from "@/lib/cn";
import { IDLE } from "@/lib/form-state";
import { signInAs } from "@/server/actions/session";

export interface PersonaCard {
  id: string;
  name: string;
  role: Role;
  title: string;
  team: string;
  tryThis: string[];
}

const ROLE_ACCENT: Record<Role, string> = {
  submitter: "bg-low-50 text-low-800 ring-low-200",
  reviewer: "bg-brand-50 text-brand-800 ring-brand-200",
  compliance_lead: "bg-medium-50 text-medium-800 ring-medium-200",
};

function useIsPending(userId: string) {
  const { pending, data } = useFormStatus();
  return { any: pending, mine: pending && data?.get("userId") === userId };
}

function FeaturedPersona({ persona }: { persona: PersonaCard }) {
  const pending = useIsPending(persona.id);
  return (
    <button
      type="submit"
      name="userId"
      value={persona.id}
      disabled={pending.any}
      className="group flex w-full flex-col rounded-xl border border-line bg-white p-4 text-left shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-brand-300 hover:shadow-[var(--shadow-raised)] disabled:translate-y-0 disabled:opacity-70 sm:p-5"
    >
      <span className="flex items-center gap-3">
        <Avatar person={persona} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink-950">{persona.name}</span>
          <span className="block truncate text-[0.8125rem] text-ink-500">{persona.title}</span>
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ring-1 ring-inset", ROLE_ACCENT[persona.role])}>
          {ROLE_LABELS[persona.role]}
        </span>
      </span>
      <ul className="mt-3.5 space-y-1 border-t border-line pt-3 text-[0.8125rem] text-ink-600">
        {persona.tryThis.map((t) => (
          <li key={t} className="flex gap-2">
            <span aria-hidden="true" className="mt-[0.55rem] size-1 shrink-0 rounded-full bg-brand-400" />
            {t}
          </li>
        ))}
      </ul>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 group-hover:text-brand-800">
        {pending.mine ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Signing in…
          </>
        ) : (
          <>
            Continue as {persona.name.split(" ")[0]}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </>
        )}
      </span>
    </button>
  );
}

function OtherPersona({ persona }: { persona: Omit<PersonaCard, "tryThis"> }) {
  const pending = useIsPending(persona.id);
  return (
    <button
      type="submit"
      name="userId"
      value={persona.id}
      disabled={pending.any}
      className="flex items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-2 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-70"
    >
      <Avatar person={persona} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-[0.8125rem] font-medium text-ink-900">{persona.name}</span>
        <span className="block truncate text-[0.6875rem] text-ink-500">
          {ROLE_LABELS[persona.role]} · {persona.team}
        </span>
      </span>
      {pending.mine ? <LoaderCircle className="ml-auto size-3.5 animate-spin text-brand-600" aria-hidden="true" /> : null}
    </button>
  );
}

export function PersonaPicker({
  featured,
  others,
  next,
}: {
  featured: PersonaCard[];
  others: Omit<PersonaCard, "tryThis">[];
  next?: string;
}) {
  const [state, formAction] = useActionState(signInAs, IDLE);
  return (
    <form action={formAction} className="space-y-6">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage state={state} />
      <fieldset className="grid gap-3">
        <legend className="sr-only">Featured personas</legend>
        {featured.map((p) => (
          <FeaturedPersona key={p.id} persona={p} />
        ))}
      </fieldset>
      <fieldset>
        <legend className="eyebrow mb-2 text-ink-500">More of the team</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {others.map((p) => (
            <OtherPersona key={p.id} persona={p} />
          ))}
        </div>
      </fieldset>
    </form>
  );
}
