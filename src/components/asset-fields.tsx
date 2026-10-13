"use client";

import { CreditCard, House, Mail, Mailbox, PanelTop, RectangleHorizontal, Share2, Wallet, type LucideIcon } from "lucide-react";
import { FieldError } from "@/components/ui/field";
import { CHANNEL_LABELS, CHANNELS, PRODUCT_LINE_LABELS, PRODUCT_LINES, type Channel, type ProductLine } from "@/domain/types";

const PRODUCT_META: Record<ProductLine, { icon: LucideIcon; blurb: string }> = {
  personal_loan: { icon: Wallet, blurb: "Fixed-payment loans" },
  credit_card: { icon: CreditCard, blurb: "Cards and balance transfers" },
  mortgage_prequal: { icon: House, blurb: "Home loan prequalification" },
};

const CHANNEL_ICONS: Record<Channel, LucideIcon> = {
  email: Mail,
  landing_page: PanelTop,
  social: Share2,
  direct_mail: Mailbox,
  display_ad: RectangleHorizontal,
};

interface PickerProps<T> {
  /** Uncontrolled: forms reset after an action, so the selection lives in the DOM. */
  defaultValue: T | null;
  onChange: (value: T) => void;
  error?: string;
}

/** The product decides which rules the pre-check applies. */
export function ProductPicker({ defaultValue, onChange, error }: PickerProps<ProductLine>) {
  return (
    <fieldset aria-describedby={error ? "productLine-error" : undefined}>
      <legend className="text-[0.8125rem] font-medium text-ink-800">Product</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {PRODUCT_LINES.map((p) => {
          const { icon: Icon, blurb } = PRODUCT_META[p];
          return (
            <label
              key={p}
              className="relative flex cursor-pointer items-start gap-3 rounded-lg border border-line-strong bg-white px-3.5 py-3 transition-colors hover:border-ink-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50 has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-brand-500)] has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand-100"
            >
              <input
                type="radio"
                name="productLine"
                value={p}
                defaultChecked={p === defaultValue}
                onChange={() => onChange(p)}
                className="peer sr-only"
              />
              <Icon className="mt-0.5 size-4 shrink-0 text-ink-500 peer-checked:text-brand-600" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink-900">{PRODUCT_LINE_LABELS[p]}</span>
                <span className="block text-xs text-ink-500">{blurb}</span>
              </span>
            </label>
          );
        })}
      </div>
      <FieldError id="productLine-error" message={error} />
    </fieldset>
  );
}

export function ChannelPicker({ defaultValue, onChange, error }: PickerProps<Channel>) {
  return (
    <fieldset aria-describedby={error ? "channel-error" : undefined}>
      <legend className="text-[0.8125rem] font-medium text-ink-800">Where customers will see it</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {CHANNELS.map((c) => {
          const Icon = CHANNEL_ICONS[c];
          return (
            <label
              key={c}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-white px-3 py-1.5 text-[0.8125rem] font-medium text-ink-700 transition-colors hover:border-ink-300 has-[:checked]:border-ink-900 has-[:checked]:bg-ink-900 has-[:checked]:text-white has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand-100"
            >
              <input
                type="radio"
                name="channel"
                value={c}
                defaultChecked={c === defaultValue}
                onChange={() => onChange(c)}
                className="sr-only"
              />
              <Icon className="size-3.5" aria-hidden="true" />
              {CHANNEL_LABELS[c]}
            </label>
          );
        })}
      </div>
      <FieldError id="channel-error" message={error} />
    </fieldset>
  );
}
