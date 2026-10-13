"use client";

import { ClipboardPaste, FileUp, Inbox, LoaderCircle, Mail, RotateCcw, Scissors, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { ChannelPicker, ProductPicker } from "@/components/asset-fields";
import { LivePrecheck } from "@/components/live-precheck";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { draftFromEmail, parsePastedEmail, parseSentLine, type EmailDraft, type ParsedEmail } from "@/domain/import/email";
import { CHANNELS, PRODUCT_LINES, type Channel, type ProductLine, type Role } from "@/domain/types";
import { cn } from "@/lib/cn";
import { toCompanyDateTimeInput } from "@/lib/dates";
import { fieldError, IDLE, submittedValue } from "@/lib/form-state";
import { formatFileSize } from "@/lib/spreadsheet/file-rules";
import { useFormAction } from "@/lib/use-form-action";
import { LIMITS } from "@/lib/validation";
import { importEmailAction } from "@/server/actions/imports";

interface Person {
  id: string;
  name: string;
  role: Role;
  team: string;
}

interface Props {
  people: Person[];
  today: string;
  sample: string;
}

/** Read on this device only, so the limit is about memory, not upload size. */
const MAX_EMAIL_BYTES = 10 * 1024 * 1024;

/**
 * Two steps: get the email in (paste or .eml), then confirm the draft we
 * made from it. Parsing happens in the browser; only the confirmed fields
 * are sent, and the server checks them like any other submission.
 */
export function EmailImporter({ people, today, sample }: Props) {
  const [draft, setDraft] = useState<{ value: EmailDraft; fileName: string; key: number } | null>(null);

  function accept(email: ParsedEmail, fileName = "") {
    setDraft({ value: draftFromEmail(email, people, today), fileName, key: Date.now() });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!draft) return <AddEmail sample={sample} onRead={accept} />;
  return (
    <ConfirmEmail
      key={draft.key}
      draft={draft.value}
      fileName={draft.fileName}
      people={people}
      today={today}
      onStartOver={() => setDraft(null)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: get the email in                                            */
/* ------------------------------------------------------------------ */

function AddEmail({ sample, onRead }: { sample: string; onRead: (email: ParsedEmail, fileName?: string) => void }) {
  const [tab, setTab] = useState<"paste" | "file">("paste");
  const [problem, setProblem] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const ids = useId();

  function readPasted() {
    const text = pasteRef.current?.value ?? "";
    if (text.trim().length < LIMITS.bodyMin) {
      setProblem("Paste the whole email first, including the From, Sent and Subject lines at the top.");
      pasteRef.current?.focus();
      return;
    }
    setProblem(null);
    onRead(parsePastedEmail(text));
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext === "msg") {
      setProblem(
        "That's an Outlook .msg file, which only Outlook can open. Open the email in Outlook, select everything, copy it and paste it on the Paste tab instead.",
      );
      return;
    }
    if (ext !== "eml") {
      setProblem(`We can read saved emails ending in .eml. “${file.name}” isn't one. Copy and paste the email instead.`);
      return;
    }
    if (file.size > MAX_EMAIL_BYTES) {
      setProblem(
        `This email is ${formatFileSize(file.size)}, probably because of attachments. We can read up to ${formatFileSize(MAX_EMAIL_BYTES)}. Copy and paste the email instead.`,
      );
      return;
    }
    setProblem(null);
    setReading(true);
    try {
      onRead(await readEmailFile(file), file.name);
    } catch {
      setProblem("We couldn't read this file as an email. It may be damaged or in a different format. Copy and paste the email instead.");
    } finally {
      setReading(false);
    }
  }

  const tabs = [
    { id: "paste", label: "Paste the email", icon: ClipboardPaste },
    { id: "file", label: "Upload a saved email", icon: FileUp },
  ] as const;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28%)]">
      <section aria-labelledby={`${ids}-title`} className="min-w-0 rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
        <header className="flex flex-col gap-3 border-b border-line px-5 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 id={`${ids}-title`} className="pb-1 text-[0.9375rem] font-semibold text-ink-950 sm:pb-3">
            Add the email
          </h2>
          <div role="tablist" aria-label="How to add the email" className="relative -mb-px flex gap-1 overflow-x-auto">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`${ids}-${id}-tab`}
                aria-selected={tab === id}
                aria-controls={`${ids}-${id}-panel`}
                onClick={() => {
                  setTab(id);
                  setProblem(null);
                }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-[0.8125rem] font-medium transition-colors",
                  tab === id ? "border-brand-600 text-ink-950" : "border-transparent text-ink-500 hover:text-ink-900",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="space-y-4 px-5 py-5">
          {problem ? (
            <Notice tone="error" role="alert" title="We couldn't use that">
              {problem}
            </Notice>
          ) : null}

          {tab === "paste" ? (
            <div role="tabpanel" id={`${ids}-paste-panel`} aria-labelledby={`${ids}-paste-tab`} className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Label htmlFor={`${ids}-paste`}>The email, from the From line down</Label>
                <button
                  type="button"
                  onClick={() => {
                    if (pasteRef.current) pasteRef.current.value = sample;
                    setProblem(null);
                    pasteRef.current?.focus();
                  }}
                  className="rounded-full border border-line-strong bg-paper px-2.5 py-1 text-xs font-medium text-ink-700 transition-colors hover:border-ink-300 hover:text-ink-950"
                >
                  Try an example email
                </button>
              </div>
              <Textarea
                ref={pasteRef}
                id={`${ids}-paste`}
                rows={14}
                maxLength={200_000}
                aria-describedby={`${ids}-paste-hint`}
                placeholder={"From: Priya Raman <priya.raman@clearpath.example>\nSent: Tuesday, October 13, 2026 9:12 AM\nTo: Marketing Compliance\nSubject: For review: Fall debt consolidation email\n\nHi team, can you review the copy below?\n…"}
                className="min-h-64 resize-y text-[0.875rem]"
              />
              <FieldHint id={`${ids}-paste-hint`}>
                Open the email, select everything (Ctrl+A, or ⌘A on a Mac), copy it and paste it here. Keep the From, Sent and Subject lines: that&apos;s
                how we know who sent it and when.
              </FieldHint>
              <div className="flex justify-end">
                <Button variant="primary" onClick={readPasted} className="max-sm:w-full">
                  <Scissors aria-hidden="true" />
                  Pull out the copy
                </Button>
              </div>
            </div>
          ) : (
            <div role="tabpanel" id={`${ids}-file-panel`} aria-labelledby={`${ids}-file-tab`}>
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void readFile(e.dataTransfer.files[0]);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand-100",
                  dragging ? "border-brand-500 bg-brand-50/60" : "border-line-strong hover:border-ink-300 hover:bg-paper/40",
                )}
              >
                <input
                  type="file"
                  accept=".eml,message/rfc822"
                  className="sr-only"
                  aria-describedby={`${ids}-file-hint`}
                  onChange={(e) => {
                    void readFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-paper text-ink-500 ring-1 ring-line">
                  {reading ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Upload className="size-5" aria-hidden="true" />}
                </span>
                <span className="mt-4 text-[0.9375rem] font-semibold text-ink-950">
                  {reading ? (
                    "Reading the email…"
                  ) : (
                    <>
                      Drop the saved email here, or <span className="text-brand-700 underline underline-offset-2">choose a file</span>
                    </>
                  )}
                </span>
                <span id={`${ids}-file-hint`} className="mt-1 text-[0.8125rem] text-ink-500">
                  .eml files · read on this computer, nothing is sent until you confirm
                </span>
              </label>
            </div>
          )}
        </div>
      </section>

      <aside aria-labelledby={`${ids}-help`} className="rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
        <header className="border-b border-line px-5 py-4">
          <h2 id={`${ids}-help`} className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink-950">
            <Inbox className="size-4 text-ink-500" aria-hidden="true" />
            Getting the email out
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-500">Copy and paste works everywhere. To save the email as a file:</p>
        </header>
        <dl className="divide-y divide-line text-[0.8125rem]">
          {SAVE_STEPS.map(([app, steps]) => (
            <div key={app} className="px-5 py-3">
              <dt className="font-medium text-ink-900">{app}</dt>
              <dd className="mt-0.5 text-ink-600">{steps}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t border-line bg-paper/60 px-5 py-3 text-xs text-ink-500">
          One email per import, with the copy in the message itself. Copy that only exists in an attachment or a screenshot needs to be pasted as a new
          submission.
        </p>
      </aside>
    </div>
  );
}

const SAVE_STEPS: [string, string][] = [
  ["Outlook on the web, or new Outlook", "Open the email, choose ⋯ › Save as, or Download."],
  ["Outlook for Mac", "Drag the email from your inbox onto the desktop."],
  ["Outlook for Windows (classic)", "It only saves .msg files, which we can't read. Copy and paste instead."],
  ["Gmail", "Open the email, choose ⋮ › Download message."],
  ["Apple Mail", "Choose File › Save As, then Raw Message Source."],
];

async function readEmailFile(file: File): Promise<ParsedEmail> {
  const { default: PostalMime } = await import("postal-mime");
  const email = await PostalMime.parse(await file.arrayBuffer(), { maxNestingDepth: 20, maxHeadersSize: 256 * 1024 });
  const sender = email.from?.address ? (email.from.name ? `${email.from.name} <${email.from.address}>` : email.from.address) : "";
  const sentAt = email.date ? new Date(email.date) : null;
  return {
    from: sender,
    receivedAt: sentAt && !Number.isNaN(sentAt.getTime()) ? toCompanyDateTimeInput(sentAt) : parseSentLine(email.date ?? ""),
    subject: email.subject ?? "",
    body: email.text?.trim() ? email.text : email.html ? htmlToText(email.html) : "",
    messageId: email.messageId ?? "",
  };
}

const BLOCK_TAGS = /^(?:P|DIV|LI|TR|H[1-6]|BLOCKQUOTE|SECTION|ARTICLE|TABLE|UL|OL|HR)$/;

/** HTML-only emails: keep the paragraphs, drop the markup. DOMParser never runs scripts. */
function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, head, title").forEach((n) => n.remove());
  const out: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push((node.textContent ?? "").replace(/\s+/g, " "));
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.tagName === "BR") {
      out.push("\n");
      return;
    }
    const block = BLOCK_TAGS.test(node.tagName);
    if (block) out.push("\n\n");
    node.childNodes.forEach(walk);
    if (block) out.push("\n\n");
  };
  walk(doc.body);
  return out
    .join("")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Step 2: confirm the draft                                           */
/* ------------------------------------------------------------------ */

const asProduct = (v: string | null | undefined) => (PRODUCT_LINES as readonly string[]).includes(v ?? "") ? (v as ProductLine) : null;
const asChannel = (v: string | null | undefined) => (CHANNELS as readonly string[]).includes(v ?? "") ? (v as Channel) : null;

function ConfirmEmail({
  draft,
  fileName,
  people,
  today,
  onStartOver,
}: {
  draft: EmailDraft;
  fileName: string;
  people: Person[];
  today: string;
  onStartOver: () => void;
}) {
  const [state, formAction] = useFormAction(importEmailAction, IDLE);
  // After a failed save the form resets to its defaults, so defaults prefer what was sent.
  const value = (field: string, fallback: string | null) => submittedValue(state, field) ?? fallback ?? "";
  const err = (field: string) => fieldError(state, field);

  const [productLine, setProductLine] = useState(asProduct(value("productLine", draft.productLine)));
  const [channel, setChannel] = useState(asChannel(value("channel", draft.channel)));
  const [body, setBody] = useState(value("body", draft.body));
  const [wholeEmail, setWholeEmail] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const submitters = people.filter((p) => p.role === "submitter");

  function replaceBody(next: string, whole: boolean) {
    if (bodyRef.current) bodyRef.current.value = next;
    setBody(next);
    setWholeEmail(whole);
    bodyRef.current?.focus();
  }

  const described = (field: string, hint?: string) => [hint, err(field) ? `${field}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(25rem,32%)]">
      <form action={formAction} noValidate className="min-w-0 space-y-6">
        <FormMessage state={state} />
        <input type="hidden" name="subject" value={draft.subject} />
        <input type="hidden" name="messageId" value={draft.messageId} />
        <input type="hidden" name="fileName" value={fileName} />

        <Section
          id="request"
          title="The request"
          description="Who asked for the review, and when. Check these: the review deadline is counted from when it arrived."
          aside={
            draft.subject || fileName ? (
              <p className="flex min-w-0 items-center gap-1.5 text-xs text-ink-500 sm:max-w-[50%]">
                <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{draft.subject ? `“${draft.subject}”` : fileName}</span>
              </p>
            ) : null
          }
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="senderId" className="flex items-center gap-2">
                Sent by {draft.senderId ? <FromEmail /> : null}
              </Label>
              <Select
                id="senderId"
                name="senderId"
                required
                defaultValue={value("senderId", draft.senderId)}
                aria-invalid={Boolean(err("senderId"))}
                aria-describedby={described("senderId", "senderId-hint")}
              >
                <option value="" disabled>
                  Choose a marketing teammate
                </option>
                {submitters.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
              <FieldHint id="senderId-hint" className={draft.senderNote ? "text-medium-700" : undefined}>
                {draft.senderNote ??
                  (draft.senderId ? "They'll see it in their submissions and get the reviewer's decision." : "We couldn't tell who sent it. Choose them here.")}
              </FieldHint>
              <FieldError id="senderId-error" message={err("senderId")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receivedAt" className="flex items-center gap-2">
                Arrived {draft.receivedAt ? <FromEmail /> : null}
              </Label>
              <Input
                id="receivedAt"
                name="receivedAt"
                type="datetime-local"
                required
                max={`${today}T23:59`}
                defaultValue={value("receivedAt", draft.receivedAt)}
                aria-invalid={Boolean(err("receivedAt"))}
                aria-describedby={described("receivedAt", "receivedAt-hint")}
              />
              <FieldHint id="receivedAt-hint">{draft.receivedAt ? "Eastern time." : "We couldn't find when it was sent. Eastern time."}</FieldHint>
              <FieldError id="receivedAt-error" message={err("receivedAt")} />
            </div>
          </div>
        </Section>

        <Section id="asset" title="The asset" description="What it is and where customers will see it. This decides what the pre-check looks for.">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="flex items-center gap-2">
                Name {draft.title ? <FromEmail what="subject line" /> : null}
              </Label>
              <Input
                id="title"
                name="title"
                required
                minLength={LIMITS.titleMin}
                maxLength={LIMITS.titleMax}
                defaultValue={value("title", draft.title)}
                placeholder="e.g. First-home prequal landing page"
                aria-invalid={Boolean(err("title"))}
                aria-describedby={described("title")}
              />
              <FieldError id="title-error" message={err("title")} />
            </div>
            <ProductPicker defaultValue={productLine} onChange={setProductLine} error={err("productLine")} />
            <ChannelPicker defaultValue={channel} onChange={setChannel} error={err("channel")} />
            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="targetLaunchDate" className="flex items-center gap-2">
                Launch date {draft.targetLaunchDate ? <FromEmail /> : null}
              </Label>
              <Input
                id="targetLaunchDate"
                name="targetLaunchDate"
                type="date"
                required
                min={today}
                defaultValue={value("targetLaunchDate", draft.targetLaunchDate)}
                aria-invalid={Boolean(err("targetLaunchDate"))}
                aria-describedby={described("targetLaunchDate", "launch-hint")}
              />
              <FieldHint id="launch-hint">
                {draft.targetLaunchDate ? "Found in the email. Check it's the date it goes out." : "The email didn't mention one. Ask the sender if you're not sure."}
              </FieldHint>
              <FieldError id="targetLaunchDate-error" message={err("targetLaunchDate")} />
            </div>
          </div>
        </Section>

        <section aria-labelledby="copy-title" className="rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
          <header className="border-b border-line px-5 py-4">
            <h2 id="copy-title" className="text-[0.9375rem] font-semibold text-ink-950">
              The copy
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-ink-500">Exactly what customers will read. Edit it if we kept or cut too much.</p>
          </header>
          <div className="space-y-3 px-5 py-5">
            {draft.removed.length > 0 ? (
              <div className="rounded-lg border border-line bg-paper/60 px-4 py-3 text-[0.8125rem]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  {wholeEmail ? (
                    <p className="text-ink-700">Showing the whole email, with nothing taken out.</p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-0.5 font-medium text-ink-900">We took out</span>
                      {draft.removed.map((r, i) => (
                        <span key={`${r.label}-${i}`} className="rounded-md bg-white px-1.5 py-0.5 text-xs text-ink-600 ring-1 ring-inset ring-line">
                          {r.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => (wholeEmail ? replaceBody(draft.body, false) : replaceBody(draft.fullBody, true))}
                    className="inline-flex shrink-0 items-center gap-1.5 self-start font-medium text-brand-700 underline-offset-2 hover:underline"
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    {wholeEmail ? "Go back to just the copy" : "Use the whole email instead"}
                  </button>
                </div>
                {!wholeEmail ? (
                  <details className="group mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-ink-500 hover:text-ink-900">See what we took out</summary>
                    <ul className="mt-2 space-y-2">
                      {draft.removed.map((r, i) => (
                        <li key={`${r.label}-${i}`}>
                          <p className="eyebrow text-ink-400">{r.label}</p>
                          <p className="mt-0.5 line-clamp-4 whitespace-pre-line text-xs text-ink-600">{r.text}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : null}
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
              defaultValue={value("body", draft.body)}
              onChange={(e) => setBody(e.target.value)}
              aria-invalid={Boolean(err("body"))}
              aria-describedby={described("body", "body-count")}
              className="min-h-72 resize-y font-serif text-[1.0625rem] leading-[1.7]"
            />
            <div className="flex items-start justify-between gap-4">
              <FieldError id="body-error" message={err("body")} />
              <p id="body-count" className="ml-auto shrink-0 font-mono text-[0.6875rem] text-ink-400">
                {body.length.toLocaleString("en-US")} / {LIMITS.bodyMax.toLocaleString("en-US")}
              </p>
            </div>
          </div>
          <footer className="flex flex-col-reverse gap-3 rounded-b-xl border-t border-line bg-paper/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={onStartOver} className="max-sm:w-full">
              Start over with a different email
            </Button>
            <SubmitButton variant="brand" pendingLabel="Adding…" className="max-sm:w-full">
              <Inbox aria-hidden="true" />
              Add to the review queue
            </SubmitButton>
          </footer>
        </section>
      </form>

      {productLine && channel ? (
        <LivePrecheck
          text={body}
          productLine={productLine}
          channel={channel}
          className="xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-y-auto xl:scrollbar-thin"
        />
      ) : (
        <div className="rounded-xl border border-dashed border-line-strong bg-white/60 px-5 py-6 text-[0.8125rem] text-ink-500 xl:sticky xl:top-8">
          <p className="font-medium text-ink-800">Pre-check</p>
          <p className="mt-1">Choose the product and where it runs, and the pre-check will flag anything in the copy that usually needs a change.</p>
        </div>
      )}
    </div>
  );
}

function Section({
  id,
  title,
  description,
  aside,
  children,
}: {
  id: string;
  title: string;
  description: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
      <header className="flex flex-col gap-2 border-b border-line px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-[0.9375rem] font-semibold text-ink-950">
            {title}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-500">{description}</p>
        </div>
        {aside}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

/** Marks a field we filled in from the email, so it's clear what to double-check. */
function FromEmail({ what = "email" }: { what?: string }) {
  return (
    <span className="rounded-full bg-brand-50 px-1.5 py-px text-[0.6875rem] font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
      from the {what}
    </span>
  );
}