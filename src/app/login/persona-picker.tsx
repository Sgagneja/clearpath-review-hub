"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/ui/form-message";
import { ROLE_LABELS, type Role } from "@/domain/types";
import { IDLE } from "@/lib/form-state";
import { signInAs } from "@/server/actions/session";

export interface PersonaCard {
  id: string;
  name: string;
  role: Role;
  title: string;
  team: string;
  tryThis: string;
}

function useIsPending(userId: string) {
  const { pending, data } = useFormStatus();
  return { any: pending, mine: pending && data?.get("userId") === userId };
}

/** A whole row is the button, so its accessible name includes "Continue as {first name}". */
function FeaturedPersona({ persona }: { persona: PersonaCard }) {
  const pending = useIsPending(persona.id);
  return (
    <li>
      <button
        type="submit"
        name="userId"
        value={persona.id}
        disabled={pending.any}
        className="group grid w-full gap-x-6 gap-y-2 px-4 py-4 text-left transition-colors hover:bg-paper/70 disabled:opacity-70 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-ink-950">{persona.name}</span>
          <span className="block text-[0.8125rem] text-ink-500">
            {ROLE_LABELS[persona.role]} · {persona.title}
          </span>
          <span className="mt-2 block max-w-[60ch] text-[0.8125rem] leading-relaxed text-ink-700">{persona.tryThis}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 self-start whitespace-nowrap text-sm font-medium text-brand-700 group-hover:text-brand-800 sm:mt-0.5">
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
    </li>
  );
}

function OtherPersona({ persona }: { persona: Omit<PersonaCard, "tryThis"> }) {
  const pending = useIsPending(persona.id);
  return (
    <li>
      <button
        type="submit"
        name="userId"
        value={persona.id}
        disabled={pending.any}
        className="flex w-full items-baseline justify-between gap-3 border-b border-line py-2.5 text-left text-[0.8125rem] transition-colors hover:text-brand-700 disabled:opacity-70"
      >
        <span className="truncate font-medium text-ink-900">{persona.name}</span>
        {pending.mine ? (
          <LoaderCircle className="size-3.5 shrink-0 animate-spin self-center text-brand-600" aria-hidden="true" />
        ) : (
          <span className="shrink-0 text-ink-500">{persona.role === "submitter" ? persona.team : ROLE_LABELS[persona.role]}</span>
        )}
      </button>
    </li>
  );
}

export function PersonaPicker({
  featured,
  teams,
  next,
}: {
  featured: PersonaCard[];
  teams: { name: string; people: Omit<PersonaCard, "tryThis">[] }[];
  next?: string;
}) {
  const [state, formAction] = useActionState(signInAs, IDLE);
  return (
    <form action={formAction} className="space-y-10">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage state={state} />
      <section aria-labelledby="start-with">
        <h2 id="start-with" className="text-sm font-semibold text-ink-950">
          Good places to start
        </h2>
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-white">
          {featured.map((p) => (
            <FeaturedPersona key={p.id} persona={p} />
          ))}
        </ul>
      </section>
      <section aria-labelledby="everyone-else">
        <h2 id="everyone-else" className="text-sm font-semibold text-ink-950">
          The rest of the team
        </h2>
        <div className="mt-3 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {teams.map((team) => (
            <div key={team.name}>
              <h3 className="text-xs font-medium text-ink-500">{team.name}</h3>
              <ul className="mt-1">
                {team.people.map((p) => (
                  <OtherPersona key={p.id} persona={p} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </form>
  );
}
