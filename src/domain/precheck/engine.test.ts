import { describe, expect, it } from "vitest";
import { compareSeverity } from "../risk";
import type { Channel, ProductLine } from "../types";
import { applicableRules, compareFindings, ENGINE_VERSION, runPrecheck } from "./engine";
import { hasStandardAprDisclosure, RULES } from "./rules";

const check = (text: string, productLine: ProductLine = "personal_loan", channel: Channel = "email") =>
  runPrecheck({ text, productLine, channel });

const ruleIds = (text: string, productLine?: ProductLine) =>
  check(text, productLine).findings.map((f) => f.ruleId);

const findingFor = (text: string, ruleId: string, productLine?: ProductLine) =>
  check(text, productLine).findings.find((f) => f.ruleId === ruleId);

/** Copy that satisfies every personal-loan rule. */
const CLEAN_LOAN =
  "Consolidate high-interest debt with a ClearPath personal loan. Checking your rate takes two minutes and won't affect your credit score; if you accept an offer we'll do a hard inquiry. APRs from 8.99% to 35.99%, based on creditworthiness. Subject to credit approval. Terms apply.";

const CLEAN_MORTGAGE =
  "See what you could borrow before you shop for a home. Get prequalified online in minutes. Prequalification is not a loan approval or commitment to lend. ClearPath Home Lending, LLC · NMLS #482913 · Equal Housing Lender. Terms apply.";

describe("runPrecheck", () => {
  it("passes compliant personal-loan copy with no findings", () => {
    const result = check(CLEAN_LOAN);
    expect(result.findings).toEqual([]);
    expect(result.score).toBe(0);
    expect(result.level).toBe("low");
  });

  it("passes compliant mortgage copy with no findings", () => {
    expect(check(CLEAN_MORTGAGE, "mortgage_prequal").findings).toEqual([]);
  });

  it("stamps the engine version and how many rules ran", () => {
    const result = check(CLEAN_LOAN);
    expect(result.engineVersion).toBe(ENGINE_VERSION);
    expect(result.rulesEvaluated).toBe(applicableRules("personal_loan").length);
  });

  it("only applies mortgage rules to mortgage copy", () => {
    const loanRules = applicableRules("personal_loan").map((r) => r.id);
    expect(loanRules).not.toContain("mortgage-nmls-id");
    expect(applicableRules("mortgage_prequal").map((r) => r.id)).toContain("mortgage-nmls-id");
  });

  it("orders findings by severity, then by position in the copy", () => {
    const { findings } = check(
      "Hurry, limited time! Guaranteed approval and the lowest rates around. No credit check.",
    );
    const severities = findings.map((f) => f.severity);
    expect(severities).toEqual([...severities].sort(compareSeverity));
    const highs = findings.filter((f) => f.severity === "high");
    expect(highs.map((f) => f.matches[0].text)).toEqual(["Guaranteed approval", "No credit check"]);
  });

  it("returns offsets that point at the matched text", () => {
    const text = "Big news: guaranteed approval for everyone who applies.";
    const finding = findingFor(text, "udaap-absolute-claim")!;
    const [match] = finding.matches;
    expect(text.slice(match.start, match.end)).toBe("guaranteed approval");
  });

  it("reads look-alike hyphens from Word and email, keeping offsets on the original copy", () => {
    const text = "You’ve been pre\u2011approved for a ClearPath card.\u200BNo\u200Bcredit\u200Bcheck.";
    const [prescreen] = findingFor(text, "fcra-prescreen-opt-out")!.matches;
    expect(text.slice(prescreen.start, prescreen.end)).toBe("You’ve been pre\u2011approved");
    const [claim] = findingFor(text, "udaap-absolute-claim")!.matches;
    expect(text.slice(claim.start, claim.end)).toBe("No\u200Bcredit\u200Bcheck");
  });

  it("scores the worst-case demo copy as high risk", () => {
    const result = check(
      "You've been pre-approved! Guaranteed approval, no credit check. Rates as low as 5.99%. Just $199/mo. Act now!",
    );
    expect(result.level).toBe("high");
    expect(result.score).toBe(100);
  });
});

describe("TILA triggering terms", () => {
  it.each([
    "Borrow $10,000 for just $199/mo.",
    "Monthly payments of $312 for qualified borrowers.",
    "Spread it over 60 monthly payments.",
    "Choose a 36-month term that fits your budget.",
    "Pay it off in 24 months.",
    "Buy a home with just 3% down.",
  ])("flags a trigger without an APR: %s", (text) => {
    expect(ruleIds(text)).toContain("tila-trigger-terms");
  });

  it("is satisfied by an APR disclosure anywhere in the copy", () => {
    expect(ruleIds("Just $199/mo. APR 8.99%–35.99%. Terms apply.")).not.toContain("tila-trigger-terms");
  });

  it("does not accept a 0% intro APR as the APR disclosure", () => {
    expect(hasStandardAprDisclosure("0% intro APR for 15 months")).toBe(false);
    expect(hasStandardAprDisclosure("then a variable APR of 19.24%–29.24%")).toBe(true);
  });

  it("cites the open-end rule and fee triggers for credit cards", () => {
    const finding = findingFor("Only a $95 annual fee.", "tila-trigger-terms", "credit_card")!;
    expect(finding.citation).toContain("1026.16(b)");
    expect(finding.matches[0].text).toBe("$95 annual fee");
  });

  it("anchors one finding on every trigger term", () => {
    const finding = findingFor("Only $199/mo over 36 monthly payments.", "tila-trigger-terms")!;
    expect(finding.matches.map((m) => m.text)).toEqual(["$199/mo", "36 monthly payments"]);
  });
});

describe("rates not stated as an APR", () => {
  it("flags a bare interest rate", () => {
    expect(ruleIds("Lock in a 6.25% rate today.", "mortgage_prequal")).toContain("rate-not-apr");
  });

  it("ignores percentages that aren't finance charges", () => {
    expect(ruleIds("Earn 3% cash back on groceries. 5% down options.")).not.toContain("rate-not-apr");
  });

  it("allows an interest rate stated alongside the APR", () => {
    const text = "A 30-year fixed loan at 6.625% interest (6.912% APR) with 360 monthly payments.";
    expect(ruleIds(text, "mortgage_prequal")).not.toContain("rate-not-apr");
  });

  it("accepts either word order for the APR label", () => {
    expect(ruleIds("Fixed rate of 7.49% APR.")).not.toContain("rate-not-apr");
    expect(ruleIds("Fixed APR of 7.49%.")).not.toContain("rate-not-apr");
  });
});

describe("“as low as” rates", () => {
  it("is high severity when the rate isn't an APR", () => {
    const finding = findingFor("Rates as low as 5.99%!", "as-low-as-rate")!;
    expect(finding.severity).toBe("high");
    expect(finding.message).toMatch(/isn't stated as an APR and doesn't say who qualifies/);
  });

  it("drops to medium when the APR is there but qualifying terms aren't", () => {
    expect(findingFor("Rates as low as 5.99% APR.", "as-low-as-rate")!.severity).toBe("medium");
  });

  it("treats “down payments as low as 3%” as a trigger term, not a rate", () => {
    const ids = ruleIds("Down payments as low as 3%.", "mortgage_prequal");
    expect(ids).not.toContain("as-low-as-rate");
    expect(ids).toContain("tila-trigger-terms");
  });

  it("passes with the APR and qualifying language", () => {
    expect(
      ruleIds("APRs as low as 8.99% for well-qualified applicants. Your rate is based on creditworthiness."),
    ).not.toContain("as-low-as-rate");
  });
});

describe("promotional rates", () => {
  it("flags a 0% offer missing its duration and go-to rate", () => {
    const finding = findingFor("Enjoy 0% intro APR on balance transfers!", "intro-rate-terms", "credit_card")!;
    expect(finding.message).toMatch(/how long the promotional rate lasts or the APR that applies after it ends/);
  });

  it("passes when both are disclosed", () => {
    expect(
      ruleIds("0% intro APR on purchases for 15 months, then a variable APR of 19.24%–29.24%.", "credit_card"),
    ).not.toContain("intro-rate-terms");
  });
});

describe("FCRA prescreen notice", () => {
  it("flags pre-approved language without the opt-out notice", () => {
    expect(ruleIds("Good news, Sam — you've been pre-approved!", "credit_card")).toContain("fcra-prescreen-opt-out");
  });

  it("passes with the opt-out notice", () => {
    expect(
      ruleIds("You're pre-selected. PRESCREEN & OPT-OUT NOTICE: call 1-888-5-OPT-OUT.", "credit_card"),
    ).not.toContain("fcra-prescreen-opt-out");
  });
});

describe("UDAAP absolute claims", () => {
  it("emits one finding per distinct claim, grouping repeats", () => {
    const { findings } = check("Guaranteed approval! Risk-free. Yes, guaranteed approval.");
    const claims = findings.filter((f) => f.ruleId === "udaap-absolute-claim");
    expect(claims.map((f) => f.key)).toEqual([
      "udaap-absolute-claim:guaranteed approval",
      "udaap-absolute-claim:risk-free",
    ]);
    expect(claims[0].matches).toHaveLength(2);
  });

  it("flags no-credit-check claims", () => {
    expect(ruleIds("Apply today, no credit check required.")).toContain("udaap-absolute-claim");
  });
});

describe("mortgage disclosures", () => {
  it("requires the NMLS ID and Equal Housing statement on mortgage copy", () => {
    const ids = ruleIds("Find your dream home with ClearPath.", "mortgage_prequal");
    expect(ids).toEqual(expect.arrayContaining(["mortgage-nmls-id", "mortgage-equal-housing"]));
    const nmls = findingFor("Find your dream home.", "mortgage-nmls-id", "mortgage_prequal")!;
    expect(nmls.matches).toEqual([]);
  });

  it("flags prequalification framed as approval", () => {
    const finding = findingFor(
      "Get prequalified today and you're approved in minutes!",
      "prequal-implies-approval",
      "mortgage_prequal",
    )!;
    expect(finding.matches.map((m) => m.text)).toEqual(["prequalified", "approved"]);
  });

  it("counts approval language that starts just outside the 40 characters before “prequalified”", () => {
    // With \r\n the window begins inside "approved"; it has to be matched whole.
    const lines = ["You're pre-approved to buy your first home! 🏡", "Get prequalified with ClearPath in minutes."];
    const withNewlines = ruleIds(lines.join("\n"), "mortgage_prequal");
    expect(withNewlines).toContain("prequal-implies-approval");
    expect(ruleIds(lines.join("\r\n"), "mortgage_prequal")).toEqual(withNewlines);
  });

  it("doesn't mistake “subject to credit approval” for an approval claim", () => {
    expect(
      ruleIds("Get prequalified in minutes. Not a commitment to lend. Subject to credit approval.", "mortgage_prequal"),
    ).not.toContain("prequal-implies-approval");
  });

  it("asks for the prequalification disclaimer", () => {
    expect(ruleIds("Get prequalified in minutes.", "mortgage_prequal")).toContain("prequal-disclaimer");
  });
});

describe("credit-score claims", () => {
  it("flags an unqualified no-impact claim", () => {
    expect(ruleIds("Applying won't affect your credit score.")).toContain("soft-pull-qualifier");
  });

  it("passes when tied to checking your rate", () => {
    expect(ruleIds("Checking your rate won't affect your credit score.")).not.toContain("soft-pull-qualifier");
  });
});

describe("claims and presentation", () => {
  it("flags unsubstantiated superlatives unless footnoted or sourced", () => {
    expect(ruleIds("The lowest rates in town.")).toContain("unsupported-superlative");
    expect(ruleIds("The lowest rates* in town. *Source: Q3 2026 rate survey.")).not.toContain(
      "unsupported-superlative",
    );
  });

  it("treats “the lowest rates are reserved for…” as a qualifier, not a claim", () => {
    expect(ruleIds("The lowest rates are available to well-qualified applicants.")).not.toContain(
      "unsupported-superlative",
    );
    expect(ruleIds("Lowest APRs reserved for borrowers with excellent credit.")).not.toContain(
      "unsupported-superlative",
    );
  });

  it("flags urgency without a date, but not with one", () => {
    expect(ruleIds("Act now, offer ends soon!")).toContain("false-urgency");
    expect(ruleIds("Act now — offer ends November 30, 2026.")).not.toContain("false-urgency");
  });

  it("doesn't read “APR 8” as an April date", () => {
    expect(ruleIds("Hurry! APR 8.99%.")).toContain("false-urgency");
  });

  it("flags audience language tied to protected characteristics", () => {
    const finding = findingFor("Perfect for young professionals and newlyweds.", "fair-lending-language")!;
    expect(finding.severity).toBe("medium");
    expect(finding.matches.map((m) => m.text)).toEqual(["Perfect for young professionals", "newlyweds"]);
  });

  it("flags blanket no-fee claims but allows naming a specific fee", () => {
    expect(ruleIds("No hidden fees, ever.")).toContain("no-fee-claim");
    expect(ruleIds("No origination fee.")).not.toContain("no-fee-claim");
  });

  it("asks for a terms line when the copy makes an offer", () => {
    expect(ruleIds("Get a $200 bonus when you open a card.")).toContain("terms-apply-missing");
    expect(ruleIds("Get a $200 bonus. Terms apply.")).not.toContain("terms-apply-missing");
  });
});

describe("rule catalog", () => {
  it("has unique ids and a citation on every rule", () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of RULES) {
      expect(rule.citation.length).toBeGreaterThan(5);
      expect(rule.products.length).toBeGreaterThan(0);
    }
  });
});

describe("compareFindings", () => {
  it("reports what a revision resolved, introduced and left in place", () => {
    const v1 = check("Guaranteed approval! Act now. Rates as low as 5.99%.").findings;
    const v2 = check("Rates as low as 5.99%. The best rates around. Act now.").findings;
    const diff = compareFindings(v1, v2);
    expect(diff.resolved.map((f) => f.key)).toContain("udaap-absolute-claim:guaranteed approval");
    expect(diff.introduced.map((f) => f.key)).toEqual(["unsupported-superlative:best rates"]);
    expect(diff.persisting.map((f) => f.key)).toEqual(expect.arrayContaining(["as-low-as-rate", "false-urgency"]));
  });
});
