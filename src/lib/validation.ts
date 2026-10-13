import { z } from "zod";
import {
  CHANNELS,
  DECISIONS,
  PRODUCT_LINES,
  SEVERITIES,
  STATUSES,
  type Decision,
} from "@/domain/types";

/**
 * Input schemas for every server action and query string. Server actions are
 * public POST endpoints, so nothing from FormData or the URL is trusted until
 * it has been through one of these.
 */

export const LIMITS = {
  titleMin: 4,
  titleMax: 120,
  bodyMin: 20,
  bodyMax: 8_000,
  commentMax: 2_000,
  rationaleMin: 15,
  searchMax: 80,
  launchWindowDays: 365,
} as const;

export const referenceSchema = z
  .string()
  .regex(/^MKT-\d{4,6}$/, "Unknown submission reference.");

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD, a real calendar date, today or later, within a year. */
export function launchDateSchema(today: Date) {
  const todayIso = today.toISOString().slice(0, 10);
  const latest = new Date(today.getTime() + LIMITS.launchWindowDays * 86_400_000)
    .toISOString()
    .slice(0, 10);

  return z
    .string()
    .regex(DATE_ONLY, "Pick a launch date.")
    .refine((value) => {
      const parsed = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
    }, "That isn't a valid date.")
    .refine((value) => value >= todayIso, "The launch date can't be in the past.")
    .refine((value) => value <= latest, "Launch dates more than a year out aren't accepted.");
}

const bodySchema = z
  .string()
  .trim()
  .min(LIMITS.bodyMin, `Paste the full copy (at least ${LIMITS.bodyMin} characters).`)
  .max(LIMITS.bodyMax, `Copy is limited to ${LIMITS.bodyMax.toLocaleString("en-US")} characters.`);

export function createSubmissionSchema(today: Date) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(LIMITS.titleMin, "Give the asset a short, descriptive name.")
      .max(LIMITS.titleMax, `Keep the name under ${LIMITS.titleMax} characters.`),
    productLine: z.enum(PRODUCT_LINES, "Choose a product line."),
    channel: z.enum(CHANNELS, "Choose a channel."),
    targetLaunchDate: launchDateSchema(today),
    body: bodySchema,
  });
}

/**
 * A review request brought in from the compliance inbox. Same rules as a new
 * submission, plus who sent it and when it arrived (the deadline counts from
 * then). Arrival is a wall-clock time in the company time zone.
 */
export function importEmailSchema(today: Date) {
  return createSubmissionSchema(today).extend({
    senderId: z.string().regex(/^u_[a-z]+$/, "Choose who sent the email."),
    receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Add when the email arrived."),
    subject: z.string().trim().max(300).optional().default(""),
    messageId: z.string().trim().max(300).optional().default(""),
    fileName: z.string().trim().max(200).optional().default(""),
  });
}

export const resubmitSchema = z.object({
  reference: referenceSchema,
  body: bodySchema,
  note: z.string().trim().max(LIMITS.commentMax).optional().default(""),
});

export const decisionSchema = z
  .object({
    reference: referenceSchema,
    decision: z.enum(DECISIONS, "Choose a decision."),
    comment: z.string().trim().max(LIMITS.commentMax).optional().default(""),
  })
  .refine((d) => d.decision === "approve" || d.comment.length >= LIMITS.rationaleMin, {
    path: ["comment"],
    message: "Explain what needs to change so the submitter can act on it.",
  });

/**
 * Approving copy that still has high-severity findings is allowed (the rules
 * are heuristics and the reviewer may know the disclosure lives elsewhere),
 * but it requires a written rationale for the audit trail.
 */
export function approvalNeedsRationale(decision: Decision, openHighFindings: number): boolean {
  return decision === "approve" && openHighFindings > 0;
}

export const commentSchema = z.object({
  reference: referenceSchema,
  body: z
    .string()
    .trim()
    .min(1, "Write a comment first.")
    .max(LIMITS.commentMax, `Comments are limited to ${LIMITS.commentMax} characters.`),
});

export const assignSchema = z.object({
  reference: referenceSchema,
  assigneeId: z.string().regex(/^u_[a-z]+$/, "Choose a reviewer."),
});

export const personaSchema = z.object({
  userId: z.string().regex(/^u_[a-z]+$/, "Choose someone from the list."),
});

/**
 * Post-login redirect target. Only same-site absolute paths are allowed, so
 * `?next=https://evil.example` or `//evil.example` can't turn the login page
 * into an open redirect.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 200) return null;
  if (!/^\/(?![/\\])[\w\-./?=&%]*$/.test(value)) return null;
  if (value.startsWith("/login")) return null;
  return value;
}

export const QUEUE_SORTS = ["sla", "risk", "launch", "updated", "reference"] as const;

/** Query-string filters for the queue. Invalid values fall back to defaults. */
export const queueFiltersSchema = z.object({
  status: z.enum([...STATUSES, "open", "all"]).catch("open"),
  product: z.enum([...PRODUCT_LINES, "all"]).catch("all"),
  risk: z.enum([...SEVERITIES, "all"]).catch("all"),
  assignee: z
    .string()
    .regex(/^(?:all|me|unassigned|u_[a-z]+)$/)
    .catch("all"),
  q: z.string().trim().max(LIMITS.searchMax).catch(""),
  sort: z.enum(QUEUE_SORTS).catch("sla"),
  dir: z.enum(["asc", "desc"]).catch("asc"),
});
export type QueueFilters = z.infer<typeof queueFiltersSchema>;

export const auditFiltersSchema = z.object({
  q: z.string().trim().max(LIMITS.searchMax).catch(""),
  action: z.string().regex(/^(?:all|[a-z_]+\.[a-z_]+)$/).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type AuditFilters = z.infer<typeof auditFiltersSchema>;

/** Turns `URLSearchParams`-style input into a plain object of first values. */
export function firstValues(
  params: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
}

/** Field → first error message, the shape forms render inline. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(flat).flatMap(([field, messages]) =>
      messages?.[0] ? [[field, messages[0]]] : [],
    ),
  );
}
