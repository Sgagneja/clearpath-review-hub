import type { Channel, ProductLine } from "@/domain/types";

/** One-click example copy for the new-submission form, from risky to clean. */
export interface SampleCopy {
  id: string;
  label: string;
  title: string;
  productLine: ProductLine;
  channel: Channel;
  body: string;
}

export const SAMPLES: SampleCopy[] = [
  {
    id: "risky-loan",
    label: "Risky loan email",
    title: "Debt consolidation push — October",
    productLine: "personal_loan",
    channel: "email",
    body: `Subject: Say goodbye to credit card debt

Guaranteed approval for a ClearPath personal loan with rates as low as 5.99%! No credit check, no hassle. Consolidate everything into one low monthly payment of just $199.

Hurry, this offer won't last. Apply now!`,
  },
  {
    id: "card-intro",
    label: "Card intro offer",
    title: "Cash+ intro APR display ad",
    productLine: "credit_card",
    channel: "display_ad",
    body: `ClearPath Cash+
0% intro APR on purchases. Earn 3% cash back on everything.
The best card for everyday spending. No fees, ever.
Apply in 60 seconds.`,
  },
  {
    id: "mortgage-social",
    label: "Mortgage prequal post",
    title: "First-home prequal Instagram post",
    productLine: "mortgage_prequal",
    channel: "social",
    body: `You're pre-approved to buy your first home! 🏡
Get prequalified with ClearPath in minutes. 30-year fixed rates from 6.25%.
Perfect for young families ready to put down roots.`,
  },
  {
    id: "clean-loan",
    label: "Compliant example",
    title: "Personal loan rate-check landing page",
    productLine: "personal_loan",
    channel: "landing_page",
    body: `Check your rate for a ClearPath personal loan in about two minutes.

Fixed rates from 8.99% APR to 29.99% APR. Your rate is based on creditworthiness; the lowest rates are available to well-qualified applicants who enroll in autopay. Loan amounts from $2,000 to $40,000, with terms of 24 to 60 months. For example, a $10,000 loan over 36 months at 11.99% APR has monthly payments of $332.

Checking your rate uses a soft credit inquiry, which won't affect your credit score. Accepting a loan offer results in a hard inquiry.

All loans are subject to credit approval. Terms apply.`,
  },
];
