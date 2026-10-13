"use client";

import { CircleCheck, Download, FileSpreadsheet, FileX2, Import, LoaderCircle, RotateCcw, Upload } from "lucide-react";
import { startTransition, useRef, useState } from "react";
import { SeverityGlyph } from "@/components/severity";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { CHANNEL_LABELS, PRODUCT_LINE_LABELS, SEVERITY_LABELS, STATUSES, STATUS_LABELS } from "@/domain/types";
import { cn } from "@/lib/cn";
import { toCsv } from "@/lib/csv";
import { formatDate, pluralize } from "@/lib/format";
import { IDLE } from "@/lib/form-state";
import { checkSpreadsheetFile, formatFileSize, MAX_FILE_BYTES } from "@/lib/spreadsheet/file-rules";
import { useFormAction } from "@/lib/use-form-action";
import { trackerAction, type TrackerFormState } from "@/server/actions/imports";
import type { TrackerPreview } from "@/server/services/imports";

type Failed = Extract<TrackerPreview, { ok: false }>;
type Ready = Extract<TrackerPreview, { ok: true }>;

/**
 * Upload → check → import. Choosing a file checks it straight away and saves
 * nothing; the result is either an exact list of what to fix or a preview of
 * what will be created. Importing sends the same file again and the server
 * checks it from scratch, so a stale preview can never import bad data.
 */
export function TrackerUploader() {
  const [state, dispatch, pending] = useFormAction<TrackerFormState>(trackerAction, IDLE);
  const [file, setFile] = useState<File | null>(null);
  const [intent, setIntent] = useState<"check" | "import">("check");
  const [localProblem, setLocalProblem] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function send(next: File, nextIntent: "check" | "import") {
    const data = new FormData();
    data.set("file", next);
    data.set("intent", nextIntent);
    setIntent(nextIntent);
    setShowResult(true);
    startTransition(() => dispatch(data));
  }

  function choose(next: File | undefined) {
    if (!next) return;
    setFile(next);
    const problem = checkSpreadsheetFile(next.name, next.size);
    setLocalProblem(problem);
    if (problem) setShowResult(false);
    else send(next, "check");
  }

  function startOver() {
    setFile(null);
    setLocalProblem(null);
    setShowResult(false);
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  }

  const checking = pending && intent === "check";
  const result = showResult && !checking ? state : IDLE;
  const preview = result.status === "checked" ? result.preview : null;

  return (
    <div aria-live="polite" aria-busy={pending} className="space-y-4">
      {checking && file ? (
        <Checking fileName={file.name} />
      ) : preview?.ok ? (
        <ReadyView preview={preview} importing={pending} onImport={() => file && send(file, "import")} onStartOver={startOver} />
      ) : preview ? (
        <ProblemsView preview={preview} onStartOver={startOver} />
      ) : (
        <>
          {localProblem ? (
            <Notice tone="error" role="alert" title={`We can't use ${file?.name ?? "this file"}`}>
              {localProblem}
            </Notice>
          ) : null}
          {result.status === "error" ? (
            <Notice tone="error" role="alert" title="That didn't work">
              {result.message}
              {file ? (
                <button type="button" onClick={() => send(file, intent)} className="ml-1 font-semibold underline underline-offset-2">
                  Try again
                </button>
              ) : null}
            </Notice>
          ) : null}
          <DropZone inputRef={inputRef} onChoose={choose} />
        </>
      )}
    </div>
  );
}

function DropZone({ inputRef, onChoose }: { inputRef: React.RefObject<HTMLInputElement | null>; onChoose: (file: File | undefined) => void }) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onChoose(e.dataTransfer.files[0]);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand-100",
        dragging ? "border-brand-500 bg-brand-50/60" : "border-line-strong bg-white hover:border-ink-300 hover:bg-paper/40",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="sr-only"
        aria-describedby="upload-rules"
        onChange={(e) => onChoose(e.target.files?.[0])}
      />
      <Upload className="size-6 text-ink-400" strokeWidth={1.75} aria-hidden="true" />
      <span className="mt-3 text-[0.9375rem] font-semibold text-ink-950">
        Drop your tracker here, or <span className="text-brand-700 underline underline-offset-2">choose a file</span>
      </span>
      <span id="upload-rules" className="mt-1 text-[0.8125rem] text-ink-500">
        .xlsx or .csv · up to {formatFileSize(MAX_FILE_BYTES)}
      </span>
      <span className="mt-4 text-xs text-ink-400">We check the file first. Nothing is saved until you press Import.</span>
    </label>
  );
}

function Checking({ fileName }: { fileName: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-white px-5 py-6 shadow-[var(--shadow-card)]">
      <LoaderCircle className="size-5 shrink-0 animate-spin text-brand-600" aria-hidden="true" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink-950">Checking {fileName}</p>
        <p className="text-[0.8125rem] text-ink-500">Reading every row and running the pre-check on its copy…</p>
      </div>
    </div>
  );
}

function ProblemsView({ preview, onStartOver }: { preview: Failed; onStartOver: () => void }) {
  const fileProblems = preview.problems.filter((p) => p.row === null);
  const rowProblems = preview.problems.filter((p) => p.row !== null);
  const total = preview.problems.length + preview.moreProblems;

  function downloadList() {
    const csv = toCsv(
      ["Row", "Column", "What to fix"],
      rowProblems.map((p) => [p.row, p.column ?? "", p.message]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: `Fixes for ${preview.fileName.replace(/\.[^.]+$/, "")}.csv` });
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-labelledby="problems-title" className="overflow-hidden rounded-xl border border-high-200 bg-white shadow-[var(--shadow-card)]">
      <header className="flex items-start gap-3 border-b border-high-100 bg-high-50/70 px-5 py-4">
        <FileX2 className="mt-0.5 size-5 shrink-0 text-high-700" aria-hidden="true" />
        <div className="min-w-0">
          <h3 id="problems-title" className="font-semibold text-high-800">
            We can&apos;t import this file yet
          </h3>
          <p className="mt-0.5 text-[0.8125rem] text-high-800/90">
            {rowProblems.length > 0 ? `${pluralize(total, "thing")} to fix in ` : null}
            <span className="font-medium">{preview.fileName}</span>. Nothing has been imported. Fix {rowProblems.length > 0 ? "these" : "this"} in
            your spreadsheet, save it, and upload it again.
          </p>
        </div>
      </header>

      {fileProblems.length > 0 ? (
        <ul className="space-y-2 px-5 py-4">
          {fileProblems.map((p) => (
            <li key={p.message} className="text-[0.875rem] leading-relaxed text-ink-800">
              {p.message}
            </li>
          ))}
        </ul>
      ) : null}

      {rowProblems.length > 0 ? (
        <div className="relative max-h-[26rem] overflow-auto scrollbar-thin">
          <table className="w-full text-left text-[0.8125rem]">
            <caption className="sr-only">Rows that need fixing</caption>
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-line">
                <th scope="col" className="eyebrow w-20 py-2.5 pl-5 pr-3 font-medium text-ink-500">Row</th>
                <th scope="col" className="eyebrow w-36 px-3 py-2.5 font-medium text-ink-500">Column</th>
                <th scope="col" className="eyebrow py-2.5 pl-3 pr-5 font-medium text-ink-500">What to fix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rowProblems.map((p, i) => (
                <tr key={`${p.row}-${p.column}-${i}`} className="align-top">
                  <td className="py-2.5 pl-5 pr-3">
                    <span className="rounded bg-ink-50 px-1.5 py-0.5 font-mono text-[0.6875rem] text-ink-700 ring-1 ring-inset ring-ink-200">{p.row}</span>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-ink-800">{p.column ?? "Whole row"}</td>
                  <td className="py-2.5 pl-3 pr-5 text-ink-700">{p.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {preview.moreProblems > 0 ? (
        <p className="border-t border-line px-5 py-3 text-[0.8125rem] text-ink-600">
          …and {pluralize(preview.moreProblems, "more problem")}. Fix these first; the rest will show on the next check.
        </p>
      ) : null}

      <footer className="flex flex-wrap items-center gap-2 border-t border-line bg-paper/60 px-5 py-3">
        <Button variant="primary" onClick={onStartOver}>
          <RotateCcw aria-hidden="true" />
          Upload the fixed file
        </Button>
        {rowProblems.length > 0 ? (
          <Button variant="secondary" onClick={downloadList}>
            <Download aria-hidden="true" />
            Download this list
          </Button>
        ) : null}
      </footer>
    </section>
  );
}

function ReadyView({ preview, importing, onImport, onStartOver }: { preview: Ready; importing: boolean; onImport: () => void; onStartOver: () => void }) {
  const n = preview.rows.length;
  return (
    <section aria-labelledby="ready-title" className="overflow-hidden rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
      <header className="flex flex-col gap-4 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-approve-600" aria-hidden="true" />
          <div className="min-w-0">
            <h3 id="ready-title" className="font-semibold text-ink-950">
              Ready to import {pluralize(n, "review")}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[0.8125rem] text-ink-500">
              <FileSpreadsheet className="size-3.5 shrink-0" aria-hidden="true" />
              {preview.fileName} · “{preview.tabName}” tab · every row passed the checks
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="ghost" onClick={onStartOver} disabled={importing}>
            Use a different file
          </Button>
          <Button variant="brand" onClick={onImport} disabled={importing} aria-disabled={importing}>
            {importing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Import aria-hidden="true" />}
            {importing ? `Importing ${pluralize(n, "review")}…` : `Import ${pluralize(n, "review")}`}
          </Button>
        </div>
      </header>

      {/* 1px gaps over a line-coloured background draw the dividers at every breakpoint. */}
      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-5">
        {STATUSES.map((s) => (
          <div key={s} className="bg-white px-5 py-3 max-sm:last:col-span-2">
            <dt className="text-xs text-ink-500">{STATUS_LABELS[s]}</dt>
            <dd className="figure mt-1 text-2xl">{preview.byStatus[s]}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2 px-5 py-4">
        {preview.open > 0 ? (
          <Notice tone="info" title={`${pluralize(preview.open, "open review")} will join the queue`}>
            {preview.overdueOnArrival > 0
              ? `${preview.overdueOnArrival} ${preview.overdueOnArrival === 1 ? "is" : "are"} already past ${preview.overdueOnArrival === 1 ? "its" : "their"} review deadline, so ${preview.overdueOnArrival === 1 ? "it goes" : "they go"} straight to the top.`
              : "Each one keeps the deadline it would have had from the day it was submitted."}
          </Notice>
        ) : (
          <Notice tone="guard" title="Everything in this file is closed">
            It all goes into history. Nothing new joins the queue.
          </Notice>
        )}
        {preview.flaggedApprovals > 0 ? (
          <Notice tone="warning" title={`${pluralize(preview.flaggedApprovals, "approval")} would be flagged high risk today`}>
            {preview.flaggedApprovals === 1 ? "It's" : "They're"} imported exactly as recorded. The pre-check result is shown on each review if you want a second look.
          </Notice>
        ) : null}
        {preview.ignoredColumns.length > 0 ? (
          <Notice tone="guard" title="Some columns will be left out">
            {preview.ignoredColumns.map((c) => `“${c}”`).join(", ")} {preview.ignoredColumns.length === 1 ? "isn't" : "aren't"} part of the template, so we won&apos;t import {preview.ignoredColumns.length === 1 ? "it" : "them"}.
          </Notice>
        ) : null}
      </div>

      <div className="relative max-h-[30rem] overflow-auto border-t border-line scrollbar-thin">
        <table className="w-full min-w-[52rem] text-left text-[0.8125rem]">
          <caption className="sr-only">Reviews that will be imported</caption>
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_var(--color-line)]">
            <tr>
              {["Row", "Asset", "Status", "Submitted", "Reviewer", "Pre-check today"].map((h, i) => (
                <th key={h} scope="col" className={cn("eyebrow px-3 py-2.5 font-medium text-ink-500", i === 0 && "pl-5", i === 5 && "pr-5")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {preview.rows.map((r) => (
              <tr key={r.row} className="align-top">
                <td className="py-2.5 pl-5 pr-3 font-mono text-[0.6875rem] text-ink-400">{r.row}</td>
                <td className="max-w-72 px-3 py-2.5 xl:max-w-96 2xl:max-w-xl">
                  <span className="block truncate font-medium text-ink-900">{r.title}</span>
                  <span className="block text-xs text-ink-500">
                    {PRODUCT_LINE_LABELS[r.productLine]} · {CHANNEL_LABELS[r.channel]}
                    {r.trackerId ? ` · ${r.trackerId}` : ""}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge status={r.status} />
                  {r.overdue ? <span className="mt-1 block text-xs font-medium text-high-700">Past its deadline</span> : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-700">
                  {r.submitter}
                  <span className="block text-xs text-ink-500">{formatDate(new Date(r.submittedAt))}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink-700">{r.reviewer ?? <span className="text-ink-400">Not assigned</span>}</td>
                <td className="whitespace-nowrap py-2.5 pl-3 pr-5">
                  <span className="inline-flex items-center gap-1.5 text-ink-800">
                    <SeverityGlyph severity={r.riskLevel} />
                    {SEVERITY_LABELS[r.riskLevel]} risk
                  </span>
                  <span className="block text-xs text-ink-500">{r.findings === 0 ? "Nothing flagged" : pluralize(r.findings, "issue")}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
