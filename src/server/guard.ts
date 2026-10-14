import "server-only";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { ForbiddenError } from "@/domain/permissions";
import { InvalidTransitionError } from "@/domain/workflow";
import type { FormState } from "@/lib/form-state";
import { TokenBucketLimiter } from "@/lib/rate-limit";
import { fieldErrors } from "@/lib/validation";
import { getCurrentUser, type CurrentUser } from "./auth";
import { ConflictError, UserFacingError } from "./errors";

/**
 * Shared front door for server actions. Next.js server actions are public
 * POST endpoints: anyone can call them with any payload, so each action runs
 * `guardMutation()` (origin + session + rate limit), parses its input with
 * zod, and lets the service layer check permissions. `runAction()` turns the
 * outcome into a `FormState` without leaking internals.
 */

// Burst of 20, then one every 2s per user. Plenty for a human, a wall for a script.
const mutationLimiter = new TokenBucketLimiter({ capacity: 20, refillPerSecond: 0.5 });
// Per IP: 10 sign-ins, then one every 6s.
const signInLimiter = new TokenBucketLimiter({ capacity: 10, refillPerSecond: 1 / 6 });

/**
 * Next.js already compares Origin and Host for server actions. Doing it here
 * as well keeps the CSRF defence explicit and independent of the framework
 * version, rejects requests with no Origin at all, and covers route handlers,
 * which get no built-in check.
 */
async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    originHost = null;
  }
  if (!originHost || !host || originHost !== host) {
    throw new UserFacingError("This request didn't come from ClearPath Review Hub, so it was blocked.");
  }
}

async function clientAddress(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

function rateLimitMessage(retryAfterMs: number): string {
  return `You're going faster than a person usually does. Try again in ${Math.ceil(retryAfterMs / 1000)}s.`;
}

export async function guardMutation(): Promise<CurrentUser> {
  await assertSameOrigin();
  const user = await getCurrentUser();
  if (!user) throw new UserFacingError("Your session has ended. Sign in again to continue.");
  const limit = mutationLimiter.take(user.id);
  if (!limit.ok) throw new UserFacingError(rateLimitMessage(limit.retryAfterMs));
  return user;
}

export async function guardSignIn(): Promise<void> {
  await assertSameOrigin();
  const limit = signInLimiter.take(await clientAddress());
  if (!limit.ok) throw new UserFacingError(rateLimitMessage(limit.retryAfterMs));
}

/**
 * Signing out only ends the caller's own session, and records at most one event per
 * session, so it isn't rate limited: nobody should be made to wait to leave.
 */
export async function guardSignOut(): Promise<void> {
  await assertSameOrigin();
}

/** Thrown by `parse()` and turned into inline field errors by `runAction()`. */
class InvalidInputError extends Error {
  constructor(readonly fieldErrors: Record<string, string>) {
    super("Some fields need attention.");
  }
}

export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new InvalidInputError(fieldErrors(result.error));
  return result.data;
}

/**
 * Runs an action body and maps failures onto form state. `redirect()` and
 * `notFound()` work by throwing, so those are re-thrown untouched.
 */
export async function runAction<T extends { status: string } = FormState>(
  body: () => Promise<T>,
  values?: Record<string, string>,
): Promise<T | FormState> {
  try {
    return await body();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof InvalidInputError) {
      return { status: "error", message: error.message, fieldErrors: error.fieldErrors, values };
    }
    if (error instanceof UserFacingError) {
      return {
        status: "error",
        message: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
        values,
      };
    }
    if (error instanceof ForbiddenError) {
      return { status: "error", message: error.message, values };
    }
    if (error instanceof InvalidTransitionError) {
      return { status: "error", message: new ConflictError().message, values };
    }
    console.error("[action] unexpected failure", error);
    return { status: "error", message: "Something went wrong on our side. Nothing was saved.", values };
  }
}

/** FormData → plain strings, ignoring files and Next's internal `$ACTION_` fields. */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}
