"use client";

import { Search } from "lucide-react";
import Form from "next/form";
import { useRef } from "react";
import { Input, Select } from "@/components/ui/field";
import { AUDIT_ACTION_KEYS, AUDIT_ACTIONS } from "@/domain/audit";

export function AuditFilters({ q, action }: { q: string; action: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <Form ref={formRef} action="/audit" role="search" aria-label="Filter the audit trail" className="flex flex-col gap-2 sm:flex-row">
      <div className="relative sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
        <label htmlFor="audit-q" className="sr-only">
          Search by name, asset or review number
        </label>
        <Input id="audit-q" name="q" type="search" defaultValue={q} maxLength={80} placeholder="Name, asset or MKT-1017" className="h-9 pl-9 text-sm" />
      </div>
      <label htmlFor="audit-action" className="sr-only">
        Event type
      </label>
      <Select
        id="audit-action"
        name="action"
        defaultValue={action}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-9 text-sm sm:w-56"
      >
        <option value="all">All events</option>
        {AUDIT_ACTION_KEYS.map((key) => (
          <option key={key} value={key}>
            {AUDIT_ACTIONS[key]}
          </option>
        ))}
      </Select>
    </Form>
  );
}
