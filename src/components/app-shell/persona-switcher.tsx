"use client";

import { ChevronsUpDown, LoaderCircle, LogOut, Repeat } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ROLE_LABELS, ROLES, type Role } from "@/domain/types";
import { cn } from "@/lib/cn";
import { IDLE } from "@/lib/form-state";
import { signInAs, signOut } from "@/server/actions/session";
import { Avatar } from "../ui/avatar";

interface Persona {
  id: string;
  name: string;
  role: Role;
  title: string;
}

function PersonaButton({ persona, current }: { persona: Persona; current: boolean }) {
  const { pending, data } = useFormStatus();
  const isPending = pending && data?.get("userId") === persona.id;
  return (
    <button
      type="submit"
      name="userId"
      value={persona.id}
      disabled={current || pending}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
        current ? "cursor-default bg-white/[0.06]" : "hover:bg-white/[0.06] disabled:opacity-60",
      )}
    >
      <Avatar person={persona} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium text-white">{persona.name}</span>
        <span className="block truncate text-[0.6875rem] text-ink-400">{persona.title}</span>
      </span>
      {isPending ? <LoaderCircle className="size-3.5 animate-spin text-brand-200" aria-hidden="true" /> : null}
      {current ? <span className="shrink-0 text-[0.6875rem] font-medium text-brand-200">You</span> : null}
    </button>
  );
}

/**
 * Demo-only: switch to another persona without going back to the login page.
 * Each switch is a real sign-in (new signed session, audited).
 */
export function PersonaSwitcher({ user, people }: { user: Persona; people: Persona[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(signInAs, IDLE);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {open ? (
        <div
          id={panelId}
          className="absolute inset-x-0 bottom-full mb-2 max-h-[min(30rem,70vh)] overflow-y-auto rounded-xl border border-white/10 bg-ink-900 p-2 shadow-[var(--shadow-raised)] scrollbar-thin"
        >
          <form action={formAction}>
            {ROLES.map((role) => (
              <fieldset key={role} className="mb-1 last:mb-0">
                <legend className="px-2 pb-1 pt-2 text-[0.6875rem] font-medium text-ink-400">{ROLE_LABELS[role]}s</legend>
                {people
                  .filter((p) => p.role === role)
                  .map((p) => (
                    <PersonaButton key={p.id} persona={p} current={p.id === user.id} />
                  ))}
              </fieldset>
            ))}
          </form>
          {state.status === "error" ? (
            <p role="alert" className="px-2 pt-2 text-xs text-high-200">
              {state.message}
            </p>
          ) : null}
          <form action={signOut} className="mt-1 border-t border-white/10 pt-1">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[0.8125rem] text-ink-300 hover:bg-white/[0.06] hover:text-white"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
      >
        <Avatar person={user} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{user.name}</span>
          <span className="flex items-center gap-1 truncate text-xs text-brand-200">
            <Repeat className="size-3" aria-hidden="true" />
            {ROLE_LABELS[user.role]}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink-400" aria-hidden="true" />
        <span className="sr-only">Switch person</span>
      </button>
    </div>
  );
}
