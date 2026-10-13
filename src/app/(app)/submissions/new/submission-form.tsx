"use client";

import { Send } from "lucide-react";
import { useRef, useState } from "react";
import { ChannelPicker, ProductPicker } from "@/components/asset-fields";
import { LivePrecheck } from "@/components/live-precheck";
import { FieldError, FieldHint, Input, Label, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Channel, ProductLine } from "@/domain/types";
import { cn } from "@/lib/cn";
import { fieldError, IDLE, submittedValue } from "@/lib/form-state";
import { useFormAction } from "@/lib/use-form-action";
import { LIMITS } from "@/lib/validation";
import { createSubmissionAction } from "@/server/actions/submissions";
import type { SampleCopy } from "./samples";

/**
 * Inputs are uncontrolled (React resets forms after an action) and seeded
 * from the values the action echoes back, so a validation error never wipes
 * what was typed. Local state only mirrors them to drive the live pre-check.
 */
export function SubmissionForm({ today, samples }: { today: string; samples: SampleCopy[] }) {
  const [state, formAction] = useFormAction(createSubmissionAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const initialProduct = (submittedValue(state, "productLine") as ProductLine | undefined) ?? "personal_loan";
  const initialChannel = (submittedValue(state, "channel") as Channel | undefined) ?? "email";
  const [productLine, setProductLine] = useState<ProductLine>(initialProduct);
  const [channel, setChannel] = useState<Channel>(initialChannel);
  const [body, setBody] = useState(submittedValue(state, "body") ?? "");

  function loadSample(sample: SampleCopy) {
    const form = formRef.current;
    if (!form || !bodyRef.current || !titleRef.current) return;
    bodyRef.current.value = sample.body;
    titleRef.current.value = sample.title;
    (form.elements.namedItem("productLine") as RadioNodeList).value = sample.productLine;
    (form.elements.namedItem("channel") as RadioNodeList).value = sample.channel;
    setBody(sample.body);
    setProductLine(sample.productLine);
    setChannel(sample.channel);
    bodyRef.current.focus();
  }

  const err = (field: string) => fieldError(state, field);
  const describedBy = (field: string, hint?: string) =>
    [hint, err(field) ? `${field}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(25rem,32%)]">
      <form ref={formRef} action={formAction} noValidate className="space-y-6">
        <FormMessage state={state} />

        <section aria-labelledby="asset-heading" className="rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
          <header className="border-b border-line px-5 py-4">
            <h2 id="asset-heading" className="text-[0.9375rem] font-semibold text-ink-950">
              The asset
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-ink-500">The product and where it runs decide what the pre-check looks for.</p>
          </header>
          <div className="space-y-5 px-5 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="title">Name</Label>
              <Input
                ref={titleRef}
                id="title"
                name="title"
                required
                minLength={LIMITS.titleMin}
                maxLength={LIMITS.titleMax}
                defaultValue={submittedValue(state, "title")}
                placeholder="e.g. Fall debt consolidation email"
                aria-invalid={Boolean(err("title"))}
                aria-describedby={describedBy("title")}
              />
              <FieldError id="title-error" message={err("title")} />
            </div>

            <ProductPicker defaultValue={initialProduct} onChange={setProductLine} error={err("productLine")} />
            <ChannelPicker defaultValue={initialChannel} onChange={setChannel} error={err("channel")} />

            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="targetLaunchDate">Target launch date</Label>
              <Input
                id="targetLaunchDate"
                name="targetLaunchDate"
                type="date"
                required
                min={today}
                defaultValue={submittedValue(state, "targetLaunchDate")}
                aria-invalid={Boolean(err("targetLaunchDate"))}
                aria-describedby={describedBy("targetLaunchDate", "launch-hint")}
              />
              <FieldHint id="launch-hint">We warn you if the review deadline falls on or after this day.</FieldHint>
              <FieldError id="targetLaunchDate-error" message={err("targetLaunchDate")} />
            </div>
          </div>
        </section>

        <section aria-labelledby="copy-heading" className="rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
          <header className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="copy-heading" className="text-[0.9375rem] font-semibold text-ink-950">
                The copy
              </h2>
              <p className="mt-0.5 text-[0.8125rem] text-ink-500">Everything the customer will read: subject line, body, fine print.</p>
            </div>
          </header>
          <div className="space-y-3 px-5 py-5">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Load sample copy">
              <span className="eyebrow mr-1 text-ink-400">Try a sample</span>
              {samples.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => loadSample(s)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    s.id === "clean-loan"
                      ? "border-approve-100 bg-approve-50 text-approve-700 hover:border-approve-500"
                      : "border-line-strong bg-paper text-ink-700 hover:border-ink-300 hover:text-ink-950",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Label htmlFor="body" className="sr-only">
              Copy
            </Label>
            <Textarea
              ref={bodyRef}
              id="body"
              name="body"
              rows={14}
              required
              maxLength={LIMITS.bodyMax}
              defaultValue={submittedValue(state, "body")}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Paste the full copy here…"
              aria-invalid={Boolean(err("body"))}
              aria-describedby={describedBy("body", "body-count")}
              className="min-h-72 resize-y font-serif text-[1.0625rem] leading-[1.7]"
            />
            <div className="flex items-start justify-between gap-4">
              <FieldError id="body-error" message={err("body")} />
              <p id="body-count" className="ml-auto shrink-0 font-mono text-[0.6875rem] text-ink-400">
                {body.length.toLocaleString("en-US")} / {LIMITS.bodyMax.toLocaleString("en-US")}
              </p>
            </div>
          </div>
          <footer className="flex flex-col gap-3 rounded-b-xl border-t border-line bg-paper/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[0.8125rem] text-ink-600">
              Goes straight to the compliance queue. You&apos;ll be able to follow it and reply to comments.
            </p>
            <SubmitButton variant="brand" pendingLabel="Submitting…">
              <Send aria-hidden="true" />
              Submit for review
            </SubmitButton>
          </footer>
        </section>
      </form>

      <LivePrecheck text={body} productLine={productLine} channel={channel} className="xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-y-auto xl:scrollbar-thin" />
    </div>
  );
}
