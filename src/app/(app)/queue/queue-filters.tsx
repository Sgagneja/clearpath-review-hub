"use client";

import { Search, X } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useRef } from "react";
import { Input, Select } from "@/components/ui/field";
import { PRODUCT_LINE_LABELS, PRODUCT_LINES, SEVERITIES, SEVERITY_LABELS } from "@/domain/types";
import type { QueueFilters as Filters } from "@/lib/validation";

/**
 * A plain GET form (so filters live in the URL and survive reloads and
 * sharing). `next/form` turns the submit into a client-side navigation, and
 * selects submit on change so there's no "Apply" button to forget.
 */
export function QueueFilters({
  filters,
  reviewers,
  showAssignee,
  isFiltered,
}: {
  filters: Filters;
  reviewers: { id: string; name: string }[];
  showAssignee: boolean;
  isFiltered: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();

  return (
    <Form ref={formRef} action="/queue" className="flex flex-col gap-2 lg:flex-row lg:items-center" role="search" aria-label="Filter the queue">
      <input type="hidden" name="status" value={filters.status} />
      <input type="hidden" name="sort" value={filters.sort} />
      <input type="hidden" name="dir" value={filters.dir} />

      <div className="relative flex-1 lg:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
        <label htmlFor="queue-q" className="sr-only">
          Search by asset name or review number
        </label>
        <Input
          id="queue-q"
          name="q"
          type="search"
          defaultValue={filters.q}
          placeholder="Asset name or MKT-1017"
          maxLength={80}
          className="h-9 pl-9 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex">
        <label className="sr-only" htmlFor="queue-product">
          Product line
        </label>
        <Select id="queue-product" name="product" defaultValue={filters.product} onChange={submit} className="h-9 text-sm sm:w-44">
          <option value="all">All products</option>
          {PRODUCT_LINES.map((p) => (
            <option key={p} value={p}>
              {PRODUCT_LINE_LABELS[p]}
            </option>
          ))}
        </Select>

        <label className="sr-only" htmlFor="queue-risk">
          Risk level
        </label>
        <Select id="queue-risk" name="risk" defaultValue={filters.risk} onChange={submit} className="h-9 text-sm sm:w-36">
          <option value="all">Any risk</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABELS[s]} risk
            </option>
          ))}
        </Select>

        {showAssignee ? (
          <>
            <label className="sr-only" htmlFor="queue-assignee">
              Reviewer
            </label>
            <Select id="queue-assignee" name="assignee" defaultValue={filters.assignee} onChange={submit} className="h-9 text-sm sm:w-44">
              <option value="all">Any reviewer</option>
              <option value="me">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
              {reviewers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </>
        ) : null}
      </div>

      {isFiltered ? (
        <Link
          href={`/queue?status=${filters.status}`}
          className="inline-flex h-9 items-center gap-1 self-start rounded-md px-2.5 text-[0.8125rem] font-medium text-ink-600 hover:bg-ink-900/5 hover:text-ink-900 lg:self-auto"
        >
          <X className="size-3.5" aria-hidden="true" />
          Clear filters
        </Link>
      ) : null}
    </Form>
  );
}
