import type { Channel, ProductLine } from "../types";
import { runPrecheck } from "./engine";

/**
 * Test cases for each product: copy a ClearPath marketer might really write,
 * and exactly which checks a compliance reviewer would expect to flag on it.
 *
 * They run in CI on every change (scenarios.test.ts), and on the rule library
 * for compliance, so anyone can see each product's checks still behave and open
 * a case to try edits. Between them the cases set off every check that applies
 * to each product, and include clean copy that must pass untouched.
 */
export interface Scenario {
  id: string;
  productLine: ProductLine;
  channel: Channel;
  label: string;
  /** Every check that should flag this copy, and no others. Empty means it should pass clean. */
  expect: readonly string[];
  body: string;
}

/** A compliant mortgage footer, so mortgage cases only test what they're about. */
const MORTGAGE_FOOTER =
  "Prequalification is not a loan approval or commitment to lend. ClearPath Home Lending, LLC · NMLS #482913 · Equal Housing Lender.";

export const SCENARIOS: readonly Scenario[] = [
  // Personal loans ------------------------------------------------------------
  {
    id: "pl-clean-landing",
    productLine: "personal_loan",
    channel: "landing_page",
    label: "Compliant rate-check page",
    expect: [],
    body: `Check your rate for a ClearPath personal loan in about two minutes.

Fixed rates from 8.99% APR to 29.99% APR. Your rate is based on creditworthiness; the lowest rates are available to well-qualified applicants who enroll in autopay. Loan amounts from $2,000 to $40,000, with terms of 24 to 60 months. For example, a $10,000 loan over 36 months at 11.99% APR has monthly payments of $332.

Checking your rate uses a soft credit inquiry, which won't affect your credit score. Accepting a loan offer results in a hard inquiry.

All loans are subject to credit approval. Terms apply.`,
  },
  {
    id: "pl-clean-social",
    productLine: "personal_loan",
    channel: "social",
    label: "Compliant short post",
    expect: [],
    body: "Check your rate in minutes. Personal loans from 8.99% to 35.99% APR, based on creditworthiness. Subject to credit approval. Terms apply.",
  },
  {
    id: "pl-clean-intro",
    productLine: "personal_loan",
    channel: "email",
    label: "Intro rate with its full terms",
    expect: [],
    body: "Start with an intro rate of 0% for your first 3 months, then a fixed 12.99% APR for the rest of your term, based on creditworthiness. Subject to credit approval. Terms apply.",
  },
  {
    id: "pl-payment-no-apr",
    productLine: "personal_loan",
    channel: "email",
    label: "Monthly payment with no APR",
    expect: ["tila-trigger-terms"],
    body: `Subject: One payment instead of five

Roll your card balances into a single ClearPath personal loan and pay just $289 a month. Pay it off in 36 months and be debt-free sooner.

Subject to credit approval. Terms apply.`,
  },
  {
    id: "pl-interest-not-apr",
    productLine: "personal_loan",
    channel: "email",
    label: "Interest rate instead of an APR",
    expect: ["rate-not-apr"],
    body: "A ClearPath personal loan at a fixed 11.99% interest rate, with no prepayment penalty. Subject to credit approval. Terms apply.",
  },
  {
    id: "pl-best-case-rate",
    productLine: "personal_loan",
    channel: "display_ad",
    label: "Best-case rate on its own",
    expect: ["as-low-as-rate"],
    body: "ClearPath personal loans. Rates as low as 7.49%. Check your rate today. Subject to credit approval.",
  },
  {
    id: "pl-percent-in-words",
    productLine: "personal_loan",
    channel: "direct_mail",
    label: "Rate written out as “percent”",
    expect: ["as-low-as-rate"],
    body: "Rates as low as 6.99 percent on ClearPath personal loans. Call us to check yours. Subject to credit approval.",
  },
  {
    id: "pl-intro-no-go-to",
    productLine: "personal_loan",
    channel: "email",
    label: "Intro rate with nothing after it",
    expect: ["intro-rate-terms"],
    body: "Start with an intro rate of 0% for the first 3 months on a ClearPath debt consolidation loan. Subject to credit approval. Terms apply.",
  },
  {
    id: "pl-guaranteed",
    productLine: "personal_loan",
    channel: "social",
    label: "Guaranteed approval, no credit check",
    expect: ["udaap-absolute-claim"],
    body: "Guaranteed approval on personal loans up to $25,000. No credit check, bad credit OK! Subject to credit approval. Terms apply.",
  },
  {
    id: "pl-prequal-approved",
    productLine: "personal_loan",
    channel: "email",
    label: "Prequalified made to sound approved",
    expect: ["prequal-implies-approval"],
    body: "Good news — you're prequalified and approved for up to $15,000. Check your rate in minutes. Subject to credit approval. Terms apply.",
  },
  {
    id: "pl-prescreen",
    productLine: "personal_loan",
    channel: "direct_mail",
    label: "Pre-approved letter with no opt-out",
    expect: ["fcra-prescreen-opt-out"],
    body: "You've been pre-approved for a ClearPath personal loan of up to $20,000 at 10.99% APR, based on your credit. Subject to credit approval. Terms apply.",
  },
  {
    id: "pl-credit-score",
    productLine: "personal_loan",
    channel: "landing_page",
    label: "“Won't affect your credit” on the application",
    expect: ["soft-pull-qualifier"],
    body: "Apply for a ClearPath personal loan in minutes. It won't affect your credit score. Subject to credit approval. Terms apply.",
  },
  {
    id: "pl-lowest-no-fees",
    productLine: "personal_loan",
    channel: "display_ad",
    label: "Lowest rates, no fees",
    expect: ["unsupported-superlative", "no-fee-claim"],
    body: "The lowest rates in personal lending. No fees, ever. Check your rate at clearpath.com. Subject to credit approval.",
  },
  {
    id: "pl-audience-urgency",
    productLine: "personal_loan",
    channel: "social",
    label: "Aimed at an age group, with pressure",
    expect: ["fair-lending-language", "false-urgency"],
    body: "Perfect for young professionals! Hurry — apply today and get funded as soon as tomorrow. Subject to credit approval.",
  },
  {
    id: "pl-no-terms",
    productLine: "personal_loan",
    channel: "email",
    label: "Offer with no terms line",
    expect: ["terms-apply-missing"],
    body: "Get a $200 bonus when your ClearPath personal loan funds this month.",
  },

  // Credit cards ---------------------------------------------------------------
  {
    id: "cc-clean-landing",
    productLine: "credit_card",
    channel: "landing_page",
    label: "Compliant card page",
    expect: [],
    body: "ClearPath Cash+ Card. Earn 2% cash back on every purchase. 0% intro APR on purchases for 15 months, then a variable APR of 19.24%–29.24%, based on creditworthiness. $0 annual fee. Subject to credit approval. See clearpath.com/cash-plus for terms.",
  },
  {
    id: "cc-intro-missing",
    productLine: "credit_card",
    channel: "display_ad",
    label: "0% intro with no end date",
    expect: ["intro-rate-terms", "unsupported-superlative", "no-fee-claim", "terms-apply-missing"],
    body: `ClearPath Cash+
0% intro APR on purchases. Earn 3% cash back on everything.
The best card for everyday spending. No fees, ever.
Apply in 60 seconds.`,
  },
  {
    id: "cc-fee-no-apr",
    productLine: "credit_card",
    channel: "direct_mail",
    label: "Annual fee with no APR",
    expect: ["tila-trigger-terms"],
    body: "The ClearPath Travel Card. $95 annual fee, waived the first year. Move a balance for a 3% balance transfer fee. Subject to credit approval. Terms apply.",
  },
  {
    id: "cc-rate-not-apr",
    productLine: "credit_card",
    channel: "email",
    label: "Card rate not called an APR",
    expect: ["rate-not-apr"],
    body: "Carry a balance for less: a variable rate of 18.24% on purchases. Subject to credit approval. Terms apply.",
  },
  {
    id: "cc-as-low-as",
    productLine: "credit_card",
    channel: "display_ad",
    label: "Lowest APR without who qualifies",
    expect: ["as-low-as-rate"],
    body: "ClearPath Platinum: APRs as low as 15.99%. Apply in minutes. Subject to credit approval.",
  },
  {
    id: "cc-percent-in-words",
    productLine: "credit_card",
    channel: "direct_mail",
    label: "Fee written out as “percent”, no APR",
    expect: ["tila-trigger-terms"],
    body: "Transfer a balance to the ClearPath Platinum card for a 3 percent balance transfer fee. Subject to credit approval. Terms apply.",
  },
  {
    id: "cc-preselected",
    productLine: "credit_card",
    channel: "direct_mail",
    label: "Pre-selected letter with no opt-out",
    expect: ["fcra-prescreen-opt-out"],
    body: "You've been specially selected for the ClearPath Platinum card with a purchase APR of 17.99%–27.99% variable. Subject to credit approval. Terms apply.",
  },
  {
    id: "cc-pasted-from-word",
    productLine: "credit_card",
    channel: "email",
    label: "Pre-approved, pasted from Word",
    expect: ["fcra-prescreen-opt-out"],
    // Word and Outlook swap in a non-breaking hyphen (U+2011) and curly apostrophes.
    body: "You’ve been pre\u2011approved for the ClearPath Platinum card with a purchase APR of 17.99%–27.99% variable, based on creditworthiness. Subject to credit approval. Terms apply.",
  },
  {
    id: "cc-guaranteed",
    productLine: "credit_card",
    channel: "social",
    label: "Everyone qualifies",
    expect: ["udaap-absolute-claim"],
    body: "Guaranteed approval on the ClearPath Secured card — everyone qualifies! Subject to credit approval. Terms apply.",
  },
  {
    id: "cc-prequal-approved",
    productLine: "credit_card",
    channel: "email",
    label: "Prequalified made to sound approved",
    expect: ["prequal-implies-approval"],
    body: "Good news — you're prequalified and approved for the ClearPath Cash+ card. Subject to credit approval. Terms apply.",
  },
  {
    id: "cc-credit-score",
    productLine: "credit_card",
    channel: "email",
    label: "“Won't hurt your credit” on the application",
    expect: ["soft-pull-qualifier"],
    body: "Apply for the ClearPath Cash+ card in minutes. Applying won't hurt your credit score. Subject to credit approval. Terms apply.",
  },
  {
    id: "cc-audience",
    productLine: "credit_card",
    channel: "social",
    label: "Aimed at retirees",
    expect: ["fair-lending-language"],
    body: "Perfect for retirees: earn 3% cash back on travel. Subject to credit approval. Terms apply.",
  },
  {
    id: "cc-urgency",
    productLine: "credit_card",
    channel: "email",
    label: "Pressure with no end date",
    expect: ["false-urgency"],
    body: "Last chance! Earn a $200 bonus after you spend $500 in your first 3 months. Subject to credit approval. Terms apply.",
  },

  // Mortgage prequalification ---------------------------------------------------
  {
    id: "mp-clean-landing",
    productLine: "mortgage_prequal",
    channel: "landing_page",
    label: "Compliant prequal page",
    expect: [],
    body: `See what you could borrow before you shop for a home. Get prequalified online in minutes. ${MORTGAGE_FOOTER} Terms apply.`,
  },
  {
    id: "mp-clean-rate",
    productLine: "mortgage_prequal",
    channel: "landing_page",
    label: "Compliant rate ad",
    expect: [],
    body: `30-year fixed: 6.625% interest rate (6.912% APR), based on creditworthiness. Get prequalified in minutes. ${MORTGAGE_FOOTER} Subject to credit approval. Terms apply.`,
  },
  {
    id: "mp-everything-wrong",
    productLine: "mortgage_prequal",
    channel: "social",
    label: "Everything wrong at once",
    expect: [
      "tila-trigger-terms",
      "as-low-as-rate",
      "fcra-prescreen-opt-out",
      "prequal-implies-approval",
      "mortgage-nmls-id",
      "mortgage-equal-housing",
      "prequal-disclaimer",
      "fair-lending-language",
      "terms-apply-missing",
    ],
    body: `You're pre-approved to buy your first home! 🏡
Get prequalified with ClearPath in minutes. 30-year fixed rates from 6.25%.
Perfect for young families ready to put down roots.`,
  },
  {
    id: "mp-missing-ids",
    productLine: "mortgage_prequal",
    channel: "email",
    label: "No NMLS ID or Equal Housing line",
    expect: ["mortgage-nmls-id", "mortgage-equal-housing"],
    body: "Get prequalified for a ClearPath mortgage in minutes. Prequalification is not a loan approval or commitment to lend. Terms apply.",
  },
  {
    id: "mp-rate-locked",
    productLine: "mortgage_prequal",
    channel: "email",
    label: "Prequal that promises a locked rate",
    expect: ["prequal-implies-approval", "prequal-disclaimer"],
    body: "Get prequalified in minutes and your rate is locked in. ClearPath Home Lending, LLC · NMLS #482913 · Equal Housing Lender. Subject to credit approval.",
  },
  {
    id: "mp-payment-no-apr",
    productLine: "mortgage_prequal",
    channel: "direct_mail",
    label: "Down payment and monthly payment with no APR",
    expect: ["tila-trigger-terms"],
    body: `Own your first home with as little as 3% down and monthly payments of $1,850. Get prequalified in minutes. ${MORTGAGE_FOOTER} Terms apply.`,
  },
  {
    id: "mp-rate-not-apr",
    productLine: "mortgage_prequal",
    channel: "social",
    label: "Mortgage rate not called an APR",
    expect: ["rate-not-apr"],
    body: `Mortgage rates just dropped: ClearPath's fixed rate is 6.5% for qualified buyers. Get prequalified in minutes. ${MORTGAGE_FOOTER} Terms apply.`,
  },
  {
    id: "mp-as-low-as",
    productLine: "mortgage_prequal",
    channel: "display_ad",
    label: "Lowest APR without who qualifies",
    expect: ["as-low-as-rate"],
    body: `Mortgage rates as low as 5.875% APR. Get prequalified in minutes. ${MORTGAGE_FOOTER} Terms apply.`,
  },
  {
    id: "mp-guaranteed",
    productLine: "mortgage_prequal",
    channel: "social",
    label: "Bad credit OK",
    expect: ["udaap-absolute-claim"],
    body: `Bad credit OK — everyone qualifies for a ClearPath home loan. Get prequalified in minutes. ${MORTGAGE_FOOTER} Terms apply.`,
  },
  {
    id: "mp-prescreen",
    productLine: "mortgage_prequal",
    channel: "direct_mail",
    label: "Selected-for-you letter with no opt-out",
    expect: ["fcra-prescreen-opt-out"],
    body: `You have been selected to refinance with ClearPath. Get prequalified in minutes. ${MORTGAGE_FOOTER} Terms apply.`,
  },
  {
    id: "mp-soft-pull",
    productLine: "mortgage_prequal",
    channel: "landing_page",
    label: "“Zero impact on your credit”",
    expect: ["soft-pull-qualifier"],
    body: `Getting prequalified has zero impact on your credit. ${MORTGAGE_FOOTER}`,
  },
  {
    id: "mp-best-act-now",
    productLine: "mortgage_prequal",
    channel: "email",
    label: "Best mortgage in town, act now",
    expect: ["unsupported-superlative", "false-urgency"],
    body: `The best mortgage rates in town — act now! Get prequalified in minutes. ${MORTGAGE_FOOTER} Terms apply.`,
  },
  {
    id: "mp-fees-neighborhoods",
    productLine: "mortgage_prequal",
    channel: "social",
    label: "No fees and “family-friendly neighborhoods”",
    expect: ["no-fee-claim", "fair-lending-language"],
    body: `No hidden fees, ever. Family-friendly neighborhoods are closer than you think. Get prequalified in minutes. ${MORTGAGE_FOOTER} Terms apply.`,
  },
  {
    id: "mp-no-terms",
    productLine: "mortgage_prequal",
    channel: "email",
    label: "Closing-cost credit with no terms line",
    expect: ["terms-apply-missing"],
    body: `Get a $1,500 closing cost credit when you get prequalified this month. ${MORTGAGE_FOOTER}`,
  },
];

export function scenariosFor(productLine: ProductLine): Scenario[] {
  return SCENARIOS.filter((s) => s.productLine === productLine);
}

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export interface ScenarioResult {
  scenario: Scenario;
  /** Checks that flagged the copy, in the order the pre-check reports them. */
  flagged: string[];
  /** Expected but not flagged. */
  missed: string[];
  /** Flagged but not expected. */
  unexpected: string[];
  ok: boolean;
}

/** Runs a test case through the same pre-check the app uses and compares it with what's expected. */
export function runScenario(scenario: Scenario): ScenarioResult {
  const { findings } = runPrecheck({ text: scenario.body, productLine: scenario.productLine, channel: scenario.channel });
  const flagged = [...new Set(findings.map((f) => f.ruleId))];
  const missed = scenario.expect.filter((id) => !flagged.includes(id));
  const unexpected = flagged.filter((id) => !scenario.expect.includes(id));
  return { scenario, flagged, missed, unexpected, ok: missed.length === 0 && unexpected.length === 0 };
}
