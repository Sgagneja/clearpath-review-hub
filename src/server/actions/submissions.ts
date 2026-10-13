"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { DECISION_LABELS } from "@/domain/types";
import type { FormState } from "@/lib/form-state";
import {
  assignSchema,
  commentSchema,
  createSubmissionSchema,
  decisionSchema,
  referenceSchema,
  resubmitSchema,
} from "@/lib/validation";
import { z } from "zod";
import { formValues, guardMutation, parse, runAction } from "../guard";
import {
  addComment,
  assignReviewer,
  createSubmission,
  decide,
  resubmit,
  startReview,
} from "../services/submissions";

/*
 * Server actions are public HTTP endpoints. Each one follows the same steps,
 * in this order:
 *   guardMutation()  same-origin check, valid session, per-user rate limit
 *   parse()          zod validation of every field
 *   service call     permission check + state machine + audit, in one transaction
 *   refresh()/redirect()
 */

export async function createSubmissionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  return runAction(async () => {
    const actor = await guardMutation();
    const input = parse(createSubmissionSchema(new Date()), values);
    const { reference } = await createSubmission(actor, input);
    redirect(`/submissions/${reference}?created=1`);
  }, values);
}

export async function startReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  return runAction(async () => {
    const actor = await guardMutation();
    const { reference } = parse(z.object({ reference: referenceSchema }), values);
    await startReview(actor, reference);
    refresh();
    return { status: "success", message: "You're now reviewing this submission." };
  });
}

export async function assignReviewerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  return runAction(async () => {
    const actor = await guardMutation();
    const { reference, assigneeId } = parse(assignSchema, values);
    await assignReviewer(actor, reference, assigneeId);
    refresh();
    return { status: "success", message: "Reviewer assigned." };
  }, values);
}

export async function decideAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  return runAction(async () => {
    const actor = await guardMutation();
    const input = parse(decisionSchema, values);
    await decide(actor, input);
    refresh();
    return { status: "success", message: `Decision recorded: ${DECISION_LABELS[input.decision]}.` };
  }, values);
}

export async function resubmitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  return runAction(async () => {
    const actor = await guardMutation();
    const input = parse(resubmitSchema, values);
    const { version } = await resubmit(actor, input);
    redirect(`/submissions/${input.reference}?v=${version}&resubmitted=1`);
  }, values);
}

export async function addCommentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  return runAction(async () => {
    const actor = await guardMutation();
    const input = parse(commentSchema, values);
    await addComment(actor, input);
    refresh();
    return { status: "success", message: "Comment posted." };
  }, values);
}
