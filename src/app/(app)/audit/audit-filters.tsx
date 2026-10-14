"use client";

import { Search } from "lucide-react";
import Form from "next/form";
import { useRef } from "react";
import { Input, Select } from "@/components/ui/field";

/**
 * Search plus one dropdown, for either audit list. Picking from the dropdown
 * applies it straight away; the search applies on Enter.
 */
export function AuditFilters({
  path,
  label,
  q,
  searchLabel,
  placeholder,
  select,
}: {
  path: string;
  label: string;
  q: string;
  searchLabel: string;
  placeholder: string;
  select: { name: string; label: string; value: string; options: { value: string; label: string }[] };
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <Form ref={formRef} action={path} role="search" aria-label={label} className="flex flex-col gap-2 sm:flex-row">
      <div className="relative sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
        <label htmlFor="audit-q" className="sr-only">
          {searchLabel}
        </label>
        <Input id="audit-q" name="q" type="search" defaultValue={q} maxLength={80} placeholder={placeholder} className="h-9 pl-9 text-sm" />
      </div>
      <label htmlFor="audit-select" className="sr-only">
        {select.label}
      </label>
      <Select
        id="audit-select"
        name={select.name}
        defaultValue={select.value}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-9 text-sm sm:w-56"
      >
        {select.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Form>
  );
}
