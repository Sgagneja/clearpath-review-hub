import {
  PRODUCT_LINES,
  type Channel,
  type ProductLine,
  type RuleCategory,
  type Severity,
  type TextMatch,
} from "../types";
import {
  contains,
  dedupeMatches,
  findAll,
  groupByPhrase,
  listPhrases,
  textAfter,
  textAround,
  textBefore,
} from "./text";

/**
 * The pre-check rule catalog.
 *
 * Each rule encodes one thing a ClearPath compliance reviewer would otherwise
 * catch by eye, with the regulation it comes from and a concrete fix. Rules
 * are deliberately conservative pattern matchers: they exist to put the
 * obvious problems in front of a human *before* review starts, not to replace
 * the reviewer's judgment. A finding is a prompt to look, not a verdict.
 *
 * Conventions:
 * - "Missing disclosure" rules emit one finding, anchored on every phrase that
 *   triggered the requirement (or with no anchors if the gap is product-wide).
 * - "Risky claim" rules emit one finding per distinct phrase, because each
 *   claim has to be fixed on its own.
 */

export interface RuleContext {
  text: string;
  productLine: ProductLine;
  channel: Channel;
}

export interface RuleHit {
  /** Appended to the rule id to form the finding's stable key. */
  keySuffix?: string;
  title?: string;
  severity?: Severity;
  citation?: string;
  message: string;
  suggestion: string;
  matches: TextMatch[];
}

export interface Rule {
  id: string;
  title: string;
  category: RuleCategory;
  severity: Severity;
  citation: string;
  products: readonly ProductLine[];
  /** One-line description for the rule catalog UI. */
  summary: string;
  check(ctx: RuleContext): RuleHit[];
}

// ---------------------------------------------------------------------------
// Shared patterns
// ---------------------------------------------------------------------------

const PCT = String.raw`(?<![\d.])\d{1,2}(?:\.\d{1,3})?\s?%`;
const APR_WORD = String.raw`(?:APRs?\b|annual\s+percentage\s+rates?)`;
const APR_AFTER_RATE = new RegExp(
  String.raw`^\s*(?:(?:-|–|—|to)\s*${PCT}\s*)?(?:\(?(?:fixed|variable|standard|regular|purchase)\)?\s*)?${APR_WORD}`,
  "i",
);
const APR_BEFORE_RATE = new RegExp(
  String.raw`${APR_WORD}\s*(?:\(APR\)\s*)?(?:ranges?\s+|range\s+)?(?:of|is|are|from|between|:|=)?\s*(?:${PCT}\s*(?:-|–|—|to|and)\s*)?(?:just\s+)?$`,
  "i",
);
const INTRO_WORDS = /\b(?:intro(?:ductory)?|promo(?:tional)?)\b/i;
const RATE_WORDS =
  /\b(?:rates?|interest|financing|fixed|variable|apr|intro(?:ductory)?|promo(?:tional)?)\b/i;
const NON_RATE_PERCENT_AFTER =
  /^\s*(?:down\b|cash\s?back|back\b|rewards?|bonus|off\b|of\s+(?:applicants|customers|borrowers)|more\b|faster\b|balance\s+transfer\s+fee|cash\s+advance\s+fee|foreign\s+transaction\s+fee|fee\b)/i;
const AS_LOW_AS = String.raw`(?:as\s+low\s+as|starting\s+(?:at|from)|rates?\s+(?:from|starting\s+at)|low\s+as)`;
const AS_LOW_AS_BEFORE_RATE = new RegExp(String.raw`${AS_LOW_AS}\s+(?:just\s+|only\s+)?$`, "i");
/** "APRs as low as 8.99%": the APR label comes before the as-low-as phrase. */
const APR_IMMEDIATELY_BEFORE = new RegExp(String.raw`${APR_WORD}\s*$`, "i");

/** Any percentage in the copy that is stated as an APR (either word order). */
function isStatedAsApr(text: string, rate: TextMatch): boolean {
  return (
    APR_AFTER_RATE.test(textAfter(text, rate, 40)) ||
    APR_BEFORE_RATE.test(textBefore(text, rate, 50))
  );
}

/**
 * Whether the copy discloses a real (non-promotional) APR. A "0% intro APR"
 * doesn't count: it tells the consumer nothing about the rate they will pay.
 */
export function hasStandardAprDisclosure(text: string): boolean {
  return findAll(text, new RegExp(PCT, "gi")).some((rate) => {
    if (!isStatedAsApr(text, rate)) return false;
    if (Number.parseFloat(rate.text) === 0) return false;
    return !INTRO_WORDS.test(textAround(text, rate, 25, 30));
  });
}

const QUALIFYING_TERMS =
  /\b(?:for\s+(?:well[-\s])?qualified|(?:well[-\s])?qualified\s+(?:applicants|borrowers|customers|buyers)|with\s+(?:excellent|good|strong)\s+credit|based\s+on\s+(?:your\s+)?(?:credit|creditworthiness)|creditworthiness|rates?\s+(?:vary|will\s+vary|depend)|not\s+all\s+applicants|lowest\s+rates?\s+(?:are\s+)?(?:reserved|available)\s+(?:for|to))/i;

const MONTH_DAY =
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|jun|jul|aug|sept?|oct|nov|dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?\b(?![.%\d])|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/i;

const CLOSED_END = "Reg Z · 12 CFR 1026.24(d)";
const OPEN_END = "Reg Z · 12 CFR 1026.16(b)";
const UDAAP = "CFPA UDAAP · 12 U.S.C. 5531, 5536";

const ALL_PRODUCTS = PRODUCT_LINES;

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const TRIGGER_PATTERNS: RegExp[] = [
  // Payment amount: "$199/mo", "$250 per month", "monthly payments of $312"
  /\$\s?\d[\d,]*(?:\.\d{2})?\s*(?:\/\s*mo(?:nth)?\b|per\s+month\b|a\s+month\b|each\s+month\b|monthly\b)/gi,
  /\b(?:monthly\s+)?payments?\s+(?:of|as\s+low\s+as|from|starting\s+at)\s+(?:just\s+|only\s+)?\$\s?\d[\d,]*(?:\.\d{2})?/gi,
  // Number of payments / repayment period: "60 monthly payments", "36-month term"
  /\b\d{1,3}\s+(?:monthly\s+|easy\s+|low\s+|fixed\s+)?payments\b/gi,
  /\b\d{1,2}[-\s](?:month|year|yr)\s+(?:terms?|loans?|repayment|financing|plans?|fixed|mortgages?)\b/gi,
  /\b(?:pay\s+(?:it\s+)?(?:off|back)|repay(?:\s+it)?)\s+(?:in|over|within)\s+\d{1,3}\s+(?:months|years)\b/gi,
  // Down payment: "3% down", "$0 down", "down payments as low as 3%"
  /\b\d{1,2}(?:\.\d)?\s?%\s+down\b|\$\s?\d[\d,]*\s+down\b|\bdown\s+payments?\s+(?:of|as\s+low\s+as|from)\s+(?:\$\s?\d[\d,]*|\d{1,2}(?:\.\d)?\s?%)/gi,
  // Finance charge amount
  /\b(?:finance\s+charges?|interest)\s+(?:of|as\s+low\s+as|under|less\s+than)\s+\$\s?\d[\d,]*/gi,
];

const CARD_FEE_TRIGGERS =
  /\$\s?\d[\d,]*\s+annual\s+fee\b|\b\d(?:\.\d+)?\s?%\s+(?:balance\s+transfer|cash\s+advance|foreign\s+transaction)\s+fees?\b/gi;

const tilaTriggerTerms: Rule = {
  id: "tila-trigger-terms",
  title: "Triggering terms without an APR",
  category: "disclosure",
  severity: "high",
  citation: CLOSED_END,
  products: ALL_PRODUCTS,
  summary:
    "Payment amounts, number of payments, terms or down payments require the APR to be disclosed.",
  check({ text, productLine }) {
    const patterns =
      productLine === "credit_card" ? [...TRIGGER_PATTERNS, CARD_FEE_TRIGGERS] : TRIGGER_PATTERNS;
    const triggers = dedupeMatches(patterns.flatMap((p) => findAll(text, p)));
    if (triggers.length === 0 || hasStandardAprDisclosure(text)) return [];

    const isCard = productLine === "credit_card";
    return [
      {
        citation: isCard ? OPEN_END : CLOSED_END,
        matches: triggers,
        message: `${listPhrases(triggers.map((t) => t.text.trim()))} ${
          triggers.length === 1 ? "is a Regulation Z triggering term" : "are Regulation Z triggering terms"
        }. Once one appears, the ad must also state the APR${
          isCard ? " and key account terms" : ", the repayment terms and any down payment"
        }, clearly and conspicuously.`,
        suggestion: isCard
          ? "State the purchase APR next to the term, e.g. “Purchase APR 19.24%–29.24% variable, based on creditworthiness. $0 annual fee.”"
          : "Add a representative example beside the term, e.g. “APR 8.99%–35.99%. Terms 24–60 months. A $10,000 loan at 12.99% APR for 36 months has 36 payments of $336.89.”",
      },
    ];
  },
};

const rateNotStatedAsApr: Rule = {
  id: "rate-not-apr",
  title: "Rate not stated as an APR",
  category: "disclosure",
  severity: "high",
  citation: "Reg Z · 12 CFR 1026.24(c)",
  products: ALL_PRODUCTS,
  summary: "Any advertised rate of finance charge must be stated as an “annual percentage rate.”",
  check({ text, productLine }) {
    // A simple interest rate may appear *alongside* the APR (1026.24(c)), as in
    // "6.625% interest (6.912% APR)", so only flag rates when no APR is given.
    if (hasStandardAprDisclosure(text)) return [];
    const rates = findAll(text, new RegExp(PCT, "gi")).filter((rate) => {
      if (isStatedAsApr(text, rate)) return false;
      if (NON_RATE_PERCENT_AFTER.test(textAfter(text, rate, 30))) return false;
      if (AS_LOW_AS_BEFORE_RATE.test(textBefore(text, rate, 30))) return false; // as-low-as rule
      const around = textAround(text, rate, 40, 25);
      if (INTRO_WORDS.test(around)) return false; // intro-rate rule
      return RATE_WORDS.test(around);
    });
    if (rates.length === 0) return [];
    return [
      {
        citation:
          productLine === "credit_card" ? "Reg Z · 12 CFR 1026.16(b)(1)" : "Reg Z · 12 CFR 1026.24(c)",
        matches: rates,
        message: `${listPhrases(rates.map((r) => r.text))} ${
          rates.length === 1 ? "reads as an interest rate but isn't" : "read as interest rates but aren't"
        } labeled as an APR. Regulation Z requires advertised rates to be stated as an “annual percentage rate,” using that term or “APR.”`,
        suggestion: "Label the rate as an APR, e.g. “8.99% APR,” and use the full APR range if rates vary.",
      },
    ];
  },
};

const asLowAsRate: Rule = {
  id: "as-low-as-rate",
  title: "“As low as” rate without qualifying terms",
  category: "disclosure",
  severity: "high",
  citation: "Reg Z · 12 CFR 1026.24(c); CFPA UDAAP",
  products: ALL_PRODUCTS,
  summary: "Best-case rates must be stated as an APR and say who qualifies for them.",
  check({ text }) {
    const offers = findAll(
      text,
      new RegExp(String.raw`\b${AS_LOW_AS}\s+(?:just\s+|only\s+)?${PCT}`, "gi"),
    ).filter(
      // "Down payments as low as 3%" is a down-payment trigger, not a rate.
      (o) =>
        !/down\s+payments?\s*$/i.test(textBefore(text, o, 20)) &&
        !NON_RATE_PERCENT_AFTER.test(textAfter(text, o, 30)),
    );
    if (offers.length === 0) return [];

    const missingApr = offers.some(
      (o) =>
        !APR_AFTER_RATE.test(textAfter(text, o, 40)) &&
        !APR_IMMEDIATELY_BEFORE.test(textBefore(text, o, 30)),
    );
    const missingQualifier = !contains(text, QUALIFYING_TERMS);
    if (!missingApr && !missingQualifier) return [];

    const gaps = [
      missingApr && "isn't stated as an APR",
      missingQualifier && "doesn't say who qualifies for it",
    ].filter(Boolean);
    return [
      {
        severity: missingApr ? "high" : "medium",
        matches: offers,
        message: `The best-case rate in ${listPhrases(offers.map((o) => o.text))} ${gaps.join(
          " and ",
        )}. Most applicants won't get the lowest rate, so presenting it alone is likely misleading.`,
        suggestion:
          "Pair the rate with the APR and qualifying language, e.g. “APRs as low as 8.99% for well-qualified applicants with excellent credit. Your rate is based on creditworthiness.”",
      },
    ];
  },
};

const INTRO_OFFER =
  /\b0\s?%\s+(?:intro(?:ductory)?\s+)?APR\b|\bintro(?:ductory)?\s+(?:APR|rate)\b|\bpromotional\s+(?:APR|rate)\b|\b0\s?%\s+(?:interest|financing)\b|\b0\s?%\s+(?:for|until)\b/gi;
const INTRO_DURATION =
  /\bfor\s+(?:the\s+first\s+)?\d{1,2}\s+(?:billing\s+cycles|months)\b|\b\d{1,2}[-\s]months?\s+(?:intro(?:ductory)?|promo(?:tional)?)\b|\buntil\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/i;
const GO_TO_RATE = new RegExp(
  String.raw`\b(?:then|after\s+that|thereafter|afterwards?|after\s+the\s+(?:intro(?:ductory)?|promo(?:tional)?)\s+period)\b[\s\S]{0,60}?${PCT}`,
  "i",
);

const introRateTerms: Rule = {
  id: "intro-rate-terms",
  title: "Promotional rate missing its terms",
  category: "disclosure",
  severity: "high",
  citation: "Reg Z · 12 CFR 1026.16(g)",
  products: ["credit_card", "personal_loan"],
  summary: "Intro and 0% offers must state how long they last and the APR that applies afterwards.",
  check({ text }) {
    const offers = findAll(text, INTRO_OFFER);
    if (offers.length === 0) return [];

    const missingDuration = !contains(text, INTRO_DURATION);
    const missingGoTo = !contains(text, GO_TO_RATE) && !hasStandardAprDisclosure(text);
    if (!missingDuration && !missingGoTo) return [];

    const gaps = [
      missingDuration && "how long the promotional rate lasts",
      missingGoTo && "the APR that applies after it ends",
    ].filter(Boolean);
    return [
      {
        matches: dedupeMatches(offers),
        message: `The promotional offer doesn't state ${gaps.join(
          " or ",
        )}. Regulation Z requires both, in immediate proximity to the promotional rate.`,
        suggestion:
          "Spell out the full offer, e.g. “0% intro APR on purchases for 15 months, then a variable APR of 19.24%–29.24%.”",
      },
    ];
  },
};

const PRESCREEN_PHRASES =
  /\bpre[-\s]?(?:approved|selected|screened)\b|\byou(?:'ve|’ve|\s+have)\s+been\s+(?:specially\s+)?(?:selected|chosen|pre[-\s]?approved)\b|\bspecially\s+selected\b/gi;
const OPT_OUT_NOTICE =
  /\bopt[-\s]?out\b|optoutprescreen|1-888-5-?opt-?out|888[-.\s]?567[-.\s]?8688/i;

const fcraPrescreenOptOut: Rule = {
  id: "fcra-prescreen-opt-out",
  title: "Prescreened offer without the opt-out notice",
  category: "disclosure",
  severity: "high",
  citation: "FCRA § 615(d) · 15 U.S.C. 1681m(d); 12 CFR 1022.54",
  products: ALL_PRODUCTS,
  summary: "“Pre-approved” or “selected” offers are prescreened and need the FCRA opt-out notice.",
  check({ text }) {
    const phrases = findAll(text, PRESCREEN_PHRASES);
    if (phrases.length === 0 || contains(text, OPT_OUT_NOTICE)) return [];
    return [
      {
        matches: phrases,
        message: `${listPhrases(phrases.map((p) => p.text))} signals a prescreened offer built from consumer report data. FCRA requires the prescreen opt-out notice, and the offer must be a firm offer of credit.`,
        suggestion:
          "Add the short-form notice: “PRESCREEN & OPT-OUT NOTICE: You can choose to stop receiving prescreened offers… call 1-888-5-OPT-OUT (1-888-567-8688) or visit optoutprescreen.com,” plus the long-form notice.",
      },
    ];
  },
};

const ABSOLUTE_CLAIMS: { pattern: RegExp; suggestion: string }[] = [
  {
    pattern:
      /\bguaranteed\s+(?:approval|acceptance|approved|loans?|credit)\b|\bapproval\s+(?:is\s+)?guaranteed\b|\b(?:100\s?%|always)\s+approv(?:al|ed)\b/gi,
    suggestion: "Replace with “Check your rate in minutes” and add “Subject to credit approval.”",
  },
  {
    pattern:
      /\b(?:everyone|anyone|all\s+applicants)\s+(?:qualifies|is\s+approved|gets\s+approved|can\s+qualify)\b|\bcan(?:'|’)?t\s+be\s+(?:denied|turned\s+down)\b|\bno\s+one\s+is\s+turned\s+(?:down|away)\b/gi,
    suggestion: "Remove. ClearPath underwrites every application; describe the process, not the outcome.",
  },
  {
    pattern: /\bno\s+credit\s+check\b/gi,
    suggestion:
      "ClearPath runs a credit check before funding. If the claim is about rate shopping, say “Checking your rate won't affect your credit score” instead.",
  },
  {
    pattern: /\brisk[-\s]free\b|\bzero\s+risk\b|\bno\s+risk\b/gi,
    suggestion: "Remove. Credit always carries cost; describe the concrete benefit instead.",
  },
  {
    pattern: /\bbad\s+credit\s+(?:ok|okay|no\s+problem)\b|\bno\s+matter\s+your\s+credit\b/gi,
    suggestion: "Remove, or replace with accurate language such as “Options for a range of credit profiles.”",
  },
];

const udaapAbsoluteClaims: Rule = {
  id: "udaap-absolute-claim",
  title: "Absolute or guaranteed outcome claim",
  category: "claim",
  severity: "high",
  citation: UDAAP,
  products: ALL_PRODUCTS,
  summary: "Claims like “guaranteed approval” or “no credit check” are likely deceptive.",
  check({ text }) {
    return ABSOLUTE_CLAIMS.flatMap(({ pattern, suggestion }) =>
      [...groupByPhrase(findAll(text, pattern))].map(([phrase, matches]) => ({
        keySuffix: phrase,
        title: `Absolute claim: “${matches[0].text}”`,
        matches,
        message: `“${matches[0].text}” promises an outcome ClearPath can't guarantee. Credit decisions depend on underwriting, so the claim is likely deceptive under UDAAP.`,
        suggestion,
      })),
    );
  },
};

const NMLS_ID = /\bNMLS\s*(?:#|ID|No\.?|number|unique\s+identifier)?\s*[:#]?\s*\d{3,}/i;

const mortgageNmlsId: Rule = {
  id: "mortgage-nmls-id",
  title: "NMLS ID missing",
  category: "disclosure",
  severity: "medium",
  citation: "SAFE Act · 12 U.S.C. 5101 et seq.; state advertising rules",
  products: ["mortgage_prequal"],
  summary: "Mortgage advertising must show the company's NMLS unique identifier.",
  check({ text }) {
    if (contains(text, NMLS_ID)) return [];
    return [
      {
        matches: [],
        message:
          "Mortgage copy must display ClearPath's NMLS unique identifier. State regulators routinely cite ads that omit it.",
        suggestion: "Add “ClearPath Home Lending, LLC · NMLS #482913” to the footer.",
      },
    ];
  },
};

const mortgageEqualHousing: Rule = {
  id: "mortgage-equal-housing",
  title: "Equal Housing statement missing",
  category: "disclosure",
  severity: "medium",
  citation: "Fair Housing Act · 42 U.S.C. 3604(c); HUD advertising guidance",
  products: ["mortgage_prequal"],
  summary: "Mortgage ads should carry the Equal Housing Lender statement or logo.",
  check({ text }) {
    if (contains(text, /equal\s+housing\s+(?:lender|opportunity)/i)) return [];
    return [
      {
        matches: [],
        message:
          "Mortgage copy should carry the Equal Housing Lender statement (or logo) to show ClearPath lends without regard to protected characteristics.",
        suggestion: "Add “Equal Housing Lender” next to the NMLS line, with the logo where the format allows.",
      },
    ];
  },
};

const PREQUAL = /\bpre[-\s]?qualif(?:y|ied|ication)\b/gi;
// "Subject to credit approval" is a disclaimer, not a promise, so it's excluded.
const APPROVAL_LANGUAGE =
  /\b(?:(?<!credit\s)(?<!to\s)approv(?:ed|al)|guaranteed?|commitment|locked(?:\s+in)?|your\s+loan\s+is\s+ready|you(?:'re|’re|\s+are)\s+in|cleared\s+to\s+close)\b/gi;
const PREQUAL_DISCLAIMER =
  /\bnot\s+(?:a|an)\s+(?:loan\s+)?(?:approval|commitment|offer|guarantee)|\bis\s+not\s+a\s+(?:guarantee|commitment)|\bisn(?:'|’)t\s+(?:a|an)\s+(?:loan\s+)?(?:approval|commitment)|\bdoes\s+not\s+guarantee/i;

const prequalImpliesApproval: Rule = {
  id: "prequal-implies-approval",
  title: "Prequalification presented as approval",
  category: "claim",
  severity: "high",
  citation: "Reg Z · 12 CFR 1026.24(i); MAP Rule · 12 CFR 1014.3",
  products: ["mortgage_prequal", "personal_loan"],
  summary: "“Prequalified” must not be framed as an approval, lock or commitment to lend.",
  check({ text }) {
    const matches: TextMatch[] = [];
    for (const pq of findAll(text, PREQUAL)) {
      const windowStart = Math.max(0, pq.start - 40);
      const window = text.slice(windowStart, pq.end + 80);
      if (contains(window, PREQUAL_DISCLAIMER)) continue;
      const approvals = findAll(window, APPROVAL_LANGUAGE).map((m) => ({
        start: m.start + windowStart,
        end: m.end + windowStart,
        text: m.text,
      }));
      if (approvals.length > 0) matches.push(pq, ...approvals);
    }
    if (matches.length === 0) return [];
    return [
      {
        matches: dedupeMatches(matches),
        message:
          "Prequalification is a preliminary estimate, but here it sits next to approval language. Consumers will read it as a credit decision or commitment to lend.",
        suggestion:
          "Separate the two ideas, e.g. “Get prequalified in minutes to see what you may be able to borrow. Prequalification is not a loan approval or commitment to lend.”",
      },
    ];
  },
};

const prequalDisclaimer: Rule = {
  id: "prequal-disclaimer",
  title: "Prequalification disclaimer missing",
  category: "disclosure",
  severity: "medium",
  citation: "MAP Rule · 12 CFR 1014.3; CFPA UDAAP",
  products: ["mortgage_prequal"],
  summary: "Prequal copy should say prequalification isn't an approval or commitment to lend.",
  check({ text }) {
    const mentions = findAll(text, PREQUAL);
    if (mentions.length === 0 || contains(text, PREQUAL_DISCLAIMER)) return [];
    return [
      {
        matches: mentions.slice(0, 1),
        message:
          "The copy offers prequalification without saying it isn't an approval or a commitment to lend.",
        suggestion: "Add “Prequalification is not a loan approval or commitment to lend. Subject to underwriting.”",
      },
    ];
  },
};

const NO_CREDIT_IMPACT =
  /\b(?:won(?:'|’)t|will\s+not|doesn(?:'|’)t|does\s+not|never)\s+(?:affect|impact|hurt|harm|ding|lower)s?\s+(?:your\s+)?credit(?:\s+scores?)?\b|\bno\s+impact\s+(?:on|to)\s+your\s+credit(?:\s+scores?)?\b|\bzero\s+impact\s+on\s+your\s+credit\b/gi;
const SOFT_PULL_QUALIFIER =
  /\bsoft\s+(?:credit\s+)?(?:pull|inquiry|check)|\bcheck(?:ing)?\s+your\s+rates?\b|\bhard\s+(?:credit\s+)?(?:pull|inquiry)|\bif\s+you\s+(?:accept|continue|proceed|apply)/i;

const softPullQualifier: Rule = {
  id: "soft-pull-qualifier",
  title: "Credit-score claim without the soft-pull qualifier",
  category: "claim",
  severity: "medium",
  citation: "CFPA UDAAP · 12 U.S.C. 5531; FCRA · 15 U.S.C. 1681b",
  products: ["personal_loan", "credit_card", "mortgage_prequal"],
  summary: "“Won't affect your credit” is only true for the soft-pull rate check, and must say so.",
  check({ text }) {
    const claims = findAll(text, NO_CREDIT_IMPACT);
    if (claims.length === 0 || contains(text, SOFT_PULL_QUALIFIER)) return [];
    return [
      {
        matches: claims,
        message:
          "Only the initial rate check is a soft inquiry. Applying for and accepting the loan triggers a hard inquiry that can affect the score, so the unqualified claim overstates the benefit.",
        suggestion:
          "Qualify it: “Checking your rate won't affect your credit score. If you accept an offer, we'll do a hard credit inquiry, which may.”",
      },
    ];
  },
};

const SUPERLATIVES =
  /\b(?:lowest|best|cheapest)\s+(?:rates?|aprs?|prices?|deals?|terms|card|loans?|mortgages?|lender)\b|\bnumber\s+one\b|\bno\.\s?1\b|#\s?1\b|\bbest\s+in\s+(?:the\s+)?(?:nation|country|industry|america|business)\b|\bbeat\s+any\s+(?:rate|offer)\b|\bunbeatable\b/gi;
const SUBSTANTIATION =
  /\b(?:source|according\s+to|based\s+on\s+(?:a\s+)?(?:\d{4}\s+)?(?:survey|study|analysis|data|rankings?))\b/i;

const unsupportedSuperlative: Rule = {
  id: "unsupported-superlative",
  title: "Unsubstantiated superlative",
  category: "claim",
  severity: "medium",
  citation: "FTC Act § 5 · 15 U.S.C. 45; CFPA UDAAP",
  products: ALL_PRODUCTS,
  summary: "Comparative claims like “lowest rates” need a cited, current source.",
  check({ text }) {
    if (contains(text, SUBSTANTIATION)) return [];
    const claims = findAll(text, SUPERLATIVES).filter(
      (m) =>
        !/^[*†‡¹²³]/.test(textAfter(text, m, 1)) &&
        // "The lowest rates are reserved for…" qualifies an offer; it isn't a market claim.
        !/^\s+(?:are\s+)?(?:reserved|available|offered)\s+(?:for|to)\b/i.test(textAfter(text, m, 30)),
    );
    return [...groupByPhrase(claims)].map(([phrase, matches]) => ({
      keySuffix: phrase,
      title: `Unsubstantiated claim: “${matches[0].text}”`,
      matches,
      message: `“${matches[0].text}” is a comparative claim. ClearPath needs current, documented substantiation before running it, and the ad should cite the source.`,
      suggestion:
        "Drop the superlative or substantiate it with a footnote, e.g. “Lower average APR than the top 5 national lenders¹ … ¹Based on a Q3 2026 analysis of published rates.”",
    }));
  },
};

const URGENCY =
  /\bact\s+(?:now|fast|today)\b|\bhurry\b|\blimited[-\s]time\b|\boffer\s+ends\s+(?:soon|tonight|today|at\s+midnight)\b|\bends\s+soon\b|\btoday\s+only\b|\blast\s+chance\b|\bdon(?:'|’)t\s+miss\s+out\b|\bexpires\s+(?:soon|tonight|today)\b|\bwhile\s+(?:supplies|spots)\s+last\b|\bonly\s+\d+\s+(?:spots|offers)\s+left\b/gi;

const falseUrgency: Rule = {
  id: "false-urgency",
  title: "Urgency without a real deadline",
  category: "presentation",
  severity: "low",
  citation: "CFPA UDAAP · 12 U.S.C. 5531",
  products: ALL_PRODUCTS,
  summary: "Pressure language needs a genuine, stated end date.",
  check({ text }) {
    const phrases = findAll(text, URGENCY);
    if (phrases.length === 0 || contains(text, MONTH_DAY)) return [];
    return [
      {
        matches: phrases,
        message: `${listPhrases(phrases.map((p) => p.text))} creates time pressure, but no end date is stated. Manufactured urgency around credit decisions draws UDAAP scrutiny.`,
        suggestion: "State the real deadline (“Offer ends November 30, 2026”) or remove the urgency language.",
      },
    ];
  },
};

const PROTECTED_AUDIENCE =
  /\byoung\s+(?:professionals|families|people|buyers)\b|\bmillennials\b|\bgen\s?z\b|\bseniors?\b|\bretirees\b|\belderly\b|\bmarried\s+couples\b|\bsingle\s+(?:moms?|mothers|dads?|fathers|parents)\b|\bnewlyweds\b|\bbachelors?\b|\bno\s+immigrants\b|\bnative[-\s]born\b|\benglish[-\s]speak(?:ing|ers)\b|\b(?:christian|catholic|jewish|muslim)\s+(?:families|community|neighborhoods?|values)\b|\btraditional\s+famil(?:y|ies)\b|\bexclusive\s+(?:neighborhoods?|communit(?:y|ies)|areas?)\b|\bfamily[-\s]friendly\s+neighborhoods?\b|\bperfect\s+for\s+(?:young\s+\w+|families|retirees)\b/gi;

const fairLendingLanguage: Rule = {
  id: "fair-lending-language",
  title: "Audience language may raise fair-lending concerns",
  category: "fair_lending",
  severity: "medium",
  citation: "ECOA / Reg B · 12 CFR 1002.4(b); Fair Housing Act · 42 U.S.C. 3604(c)",
  products: ALL_PRODUCTS,
  summary: "Flags references to age, family status, national origin or religion for human review.",
  check({ text }) {
    const phrases = findAll(text, PROTECTED_AUDIENCE);
    if (phrases.length === 0) return [];
    return [
      {
        matches: phrases,
        message: `${listPhrases(phrases.map((p) => p.text))} ${
          phrases.length === 1 ? "references" : "reference"
        } a characteristic protected under fair-lending law (such as age, marital or familial status, national origin or religion). Copy that targets or discourages people on these bases can violate ECOA and the Fair Housing Act.`,
        suggestion:
          "Describe the product benefit rather than the audience, e.g. replace “perfect for young professionals” with “built for your first big financial move.”",
      },
    ];
  },
};

const OFFER_SIGNALS =
  /\d{1,2}(?:\.\d{1,3})?\s?%|\$\s?\d|\bbonus\b|\bcash\s?back\b|\brewards?\b|\bpoints\b|\bintro(?:ductory)?\b|\boffers?\b/i;
const TERMS_FOOTER =
  /\bterms\s+(?:and|&)\s+conditions\s+apply|\bterms\s+apply|\bsee\s+(?:full\s+)?terms|\brestrictions\s+(?:may\s+)?apply|\bsubject\s+to\s+credit\s+approval|\boffer\s+details\b|\bsee\s+\S+\s+for\s+(?:details|terms)/i;

const termsApplyMissing: Rule = {
  id: "terms-apply-missing",
  title: "No “terms apply” or credit-approval line",
  category: "presentation",
  severity: "low",
  citation: "CFPA UDAAP · clear and conspicuous standard",
  products: ALL_PRODUCTS,
  summary: "Offer copy should point to full terms and note that credit approval is required.",
  check({ text }) {
    if (!contains(text, OFFER_SIGNALS) || contains(text, TERMS_FOOTER)) return [];
    return [
      {
        matches: [],
        message:
          "The copy makes an offer but never points to the full terms or says approval is required.",
        suggestion: "Close with “Subject to credit approval. Terms apply. See clearpath.com/terms for details.”",
      },
    ];
  },
};

const NO_FEE_CLAIM =
  /\bno\s+(?:hidden\s+)?fees(?:\s+(?:ever|whatsoever))?\b|\bzero\s+fees\b|\bfee[-\s]free\b|\bcompletely\s+free\b/gi;

const noFeeClaim: Rule = {
  id: "no-fee-claim",
  title: "Blanket “no fees” claim",
  category: "claim",
  severity: "medium",
  citation: "CFPA UDAAP · 12 U.S.C. 5531; Reg Z · 12 CFR 1026.24(i)",
  products: ALL_PRODUCTS,
  summary: "“No fees” is only accurate if no fee of any kind can apply.",
  check({ text }) {
    return [...groupByPhrase(findAll(text, NO_FEE_CLAIM))].map(([phrase, matches]) => ({
      keySuffix: phrase,
      title: `Blanket claim: “${matches[0].text}”`,
      matches,
      message: `“${matches[0].text}” implies no fee of any kind. ClearPath products can carry late or returned-payment fees, which would make the claim misleading.`,
      suggestion:
        "Name the specific fee you don't charge (“No origination fee”) and disclose the fees that can apply.",
    }));
  },
};

/** In display order: the riskiest, most common problems first. */
export const RULES: readonly Rule[] = [
  tilaTriggerTerms,
  rateNotStatedAsApr,
  asLowAsRate,
  introRateTerms,
  fcraPrescreenOptOut,
  udaapAbsoluteClaims,
  prequalImpliesApproval,
  mortgageNmlsId,
  mortgageEqualHousing,
  prequalDisclaimer,
  softPullQualifier,
  unsupportedSuperlative,
  noFeeClaim,
  fairLendingLanguage,
  falseUrgency,
  termsApplyMissing,
];
