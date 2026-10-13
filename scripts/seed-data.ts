import type { Channel, ProductLine, Role, VersionOutcome } from "../src/domain/types";

/**
 * Demo content: fictional people and eight weeks of review history.
 *
 * Every timestamp is expressed relative to the moment the seed runs, so the
 * queue always has live SLA clocks (some overdue, some due soon) and the
 * dashboard always shows the last eight weeks. The copy is written to trip
 * specific pre-check rules on first drafts and pass on revisions, which is
 * exactly what the real rules engine reports when the seed runs it.
 */

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  team: string;
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: "u_priya",
    name: "Priya Raman",
    email: "priya.raman@clearpath.example",
    role: "submitter",
    title: "Growth Marketing Manager",
    team: "Personal Loans Marketing",
  },
  {
    id: "u_jordan",
    name: "Jordan Ellis",
    email: "jordan.ellis@clearpath.example",
    role: "submitter",
    title: "Lifecycle Marketing Lead",
    team: "Card Marketing",
  },
  {
    id: "u_sofia",
    name: "Sofia Marquez",
    email: "sofia.marquez@clearpath.example",
    role: "submitter",
    title: "Brand & Social Manager",
    team: "Home Lending Marketing",
  },
  {
    id: "u_marcus",
    name: "Marcus Bell",
    email: "marcus.bell@clearpath.example",
    role: "reviewer",
    title: "Senior Compliance Analyst",
    team: "Marketing Compliance",
  },
  {
    id: "u_alana",
    name: "Alana Torres",
    email: "alana.torres@clearpath.example",
    role: "reviewer",
    title: "Compliance Analyst, Mortgage",
    team: "Marketing Compliance",
  },
  {
    id: "u_kenji",
    name: "Kenji Watanabe",
    email: "kenji.watanabe@clearpath.example",
    role: "reviewer",
    title: "Compliance Analyst, Cards",
    team: "Marketing Compliance",
  },
  {
    id: "u_dana",
    name: "Dana Okafor",
    email: "dana.okafor@clearpath.example",
    role: "compliance_lead",
    title: "Director, Marketing Compliance",
    team: "Marketing Compliance",
  },
];

type UserId = (typeof DEMO_USERS)[number]["id"];

export interface SeedComment {
  author: UserId;
  /** Hours after the round was submitted. */
  afterHours: number;
  body: string;
}

export interface SeedRound {
  body: string;
  /** Submitter's note on a resubmission. */
  note?: string;
  /** For v2+: hours after the previous decision. */
  submittedAfterHours?: number;
  /** Lead assigns a reviewer before pickup (recorded as its own event). */
  assignedBy?: UserId;
  reviewer?: UserId;
  /** Hours after submission. Omit to leave the round waiting for pickup. */
  pickupAfterHours?: number;
  /** Hours after pickup. Omit to leave the round in review. */
  decideAfterHours?: number;
  outcome?: VersionOutcome;
  decisionComment?: string;
  /** Who decided, when it isn't the reviewer (e.g. the lead stepping in). */
  decidedBy?: UserId;
  comments?: SeedComment[];
}

export interface SeedScenario {
  title: string;
  productLine: ProductLine;
  channel: Channel;
  submitter: UserId;
  createdHoursAgo: number;
  /** Launch date, in days after the submission was created. */
  launchAfterDays: number;
  rounds: SeedRound[];
}

const DAY = 24;

export const SCENARIOS: SeedScenario[] = [
  // ── Personal loans ──────────────────────────────────────────────────────
  {
    title: "Referral program launch email",
    productLine: "personal_loan",
    channel: "email",
    submitter: "u_priya",
    createdHoursAgo: 56 * DAY,
    launchAfterDays: 10,
    rounds: [
      {
        body: "Subject: Share ClearPath, get $100\n\nKnow someone who could use a better way to borrow? Refer a friend and you'll both get $100 when their loan funds. There's no limit on referrals.\n\nOffer ends December 31, 2026. Loan subject to credit approval. Terms apply.",
        reviewer: "u_kenji",
        pickupAfterHours: 70,
        decideAfterHours: 60,
        outcome: "approved",
        decisionComment: "Approved. Sorry for the wait on this one — month-end backlog.",
      },
    ],
  },
  {
    title: "“Fresh Start” debt consolidation email",
    productLine: "personal_loan",
    channel: "email",
    submitter: "u_priya",
    createdHoursAgo: 52 * DAY,
    launchAfterDays: 9,
    rounds: [
      {
        body: "Subject: Your fresh start is one click away\n\nHi {first_name},\n\nJuggling five credit card bills? Roll them into one simple payment with a ClearPath personal loan. Guaranteed approval in minutes, and applying won't affect your credit score.\n\nBorrow up to $40,000 for as little as $199/mo.\n\nAct now — this offer won't last!\n\n[Check my rate]",
        reviewer: "u_marcus",
        pickupAfterHours: 3,
        decideAfterHours: 2,
        outcome: "changes_requested",
        decisionComment:
          "Three blockers before this can go out: (1) “Guaranteed approval” has to go — we underwrite every loan. (2) “$199/mo” is a Reg Z trigger, so we need the APR range and a representative example right next to it. (3) The credit-score line needs the soft-pull qualifier. Suggested wording is on each finding.",
      },
      {
        body: "Subject: Your fresh start is one click away\n\nHi {first_name},\n\nJuggling five credit card bills? Roll them into one predictable monthly payment with a ClearPath personal loan.\n\nChecking your rate takes two minutes and won't affect your credit score. If you accept an offer, we'll do a hard credit inquiry, which may.\n\nBorrow $5,000–$40,000. APRs from 8.99% to 35.99%, based on creditworthiness. Terms 24–60 months. Example: a $10,000 loan at 12.99% APR for 36 months has 36 monthly payments of $336.89.\n\nSubject to credit approval. Terms apply.\n\n[Check my rate]",
        note: "Swapped in the suggested disclosures and dropped the urgency line.",
        submittedAfterHours: 20,
        reviewer: "u_marcus",
        pickupAfterHours: 2,
        decideAfterHours: 1,
        outcome: "approved",
        decisionComment: "Clean. Thanks for turning this around so quickly.",
      },
    ],
  },
  {
    title: "Home improvement loan landing page",
    productLine: "personal_loan",
    channel: "landing_page",
    submitter: "u_priya",
    createdHoursAgo: 46 * DAY,
    launchAfterDays: 12,
    rounds: [
      {
        body: "Make the kitchen happen.\n\nFrom new cabinets to a new roof, a ClearPath home improvement loan gives you the cash in as little as one business day. Rates as low as 6.99%. No home equity required.\n\nThe lowest rates for homeowners, period.\n\nCheck your rate in two minutes.",
        reviewer: "u_kenji",
        pickupAfterHours: 9,
        decideAfterHours: 4,
        outcome: "changes_requested",
        decisionComment:
          "“As low as 6.99%” needs to be an APR and needs qualifying language. We also can't say “lowest rates” without a current comparison study — drop it or cite the Q3 rate survey.",
      },
      {
        body: "Make the kitchen happen.\n\nFrom new cabinets to a new roof, a ClearPath home improvement loan can get you funds as soon as one business day after approval. APRs as low as 7.49% for well-qualified applicants with excellent credit; your rate is based on creditworthiness. No home equity required.\n\nCheck your rate in two minutes — it won't affect your credit score.\n\nSubject to credit approval. Terms apply.",
        note: "Updated the rate to match the current pricing sheet and removed the superlative.",
        submittedAfterHours: 30,
        reviewer: "u_kenji",
        pickupAfterHours: 5,
        decideAfterHours: 2,
        outcome: "approved",
        decisionComment: "Approved.",
      },
    ],
  },
  {
    title: "“Big plans” display ad (300×250)",
    productLine: "personal_loan",
    channel: "display_ad",
    submitter: "u_priya",
    createdHoursAgo: 40 * DAY,
    launchAfterDays: 7,
    rounds: [
      {
        body: "Big plans? Let's fund them.\nPersonal loans from $5,000 to $40,000.\nCheck your rate without affecting your credit score.\nSubject to credit approval. Terms apply.",
        reviewer: "u_marcus",
        pickupAfterHours: 6,
        decideAfterHours: 1,
        outcome: "approved",
        decisionComment: "Looks good — approved first pass.",
      },
    ],
  },
  {
    title: "Holiday expenses Instagram post",
    productLine: "personal_loan",
    channel: "social",
    submitter: "u_priya",
    createdHoursAgo: 33 * DAY,
    launchAfterDays: 5,
    rounds: [
      {
        body: "Holiday bills piling up? 🎁 Get up to $15,000 with NO credit check and guaranteed approval. Funds in 24 hours. Act fast, limited time only! Link in bio. #holidays #cash",
        reviewer: "u_dana",
        pickupAfterHours: 4,
        decideAfterHours: 2,
        outcome: "rejected",
        decisionComment:
          "Rejecting rather than sending back: the whole concept is built on “no credit check” and “guaranteed approval,” which aren't true of any ClearPath product. Happy to help brainstorm a holiday angle that works — grab time with me this week.",
      },
    ],
  },
  {
    title: "“Say yes” wedding loan email",
    productLine: "personal_loan",
    channel: "email",
    submitter: "u_priya",
    createdHoursAgo: 6 * DAY,
    launchAfterDays: 14,
    rounds: [
      {
        body: "Subject: Say yes to the dress (and the venue)\n\nCongratulations, newlyweds-to-be! A ClearPath wedding loan is perfect for young couples who want the day they imagined without draining their savings.\n\nAPRs from 8.99% to 35.99%, based on creditworthiness. Subject to credit approval. Terms apply.",
        reviewer: "u_marcus",
        pickupAfterHours: 20,
        decideAfterHours: 3,
        outcome: "changes_requested",
        decisionComment:
          "Love the concept. The audience language is the issue — “newlyweds” and “young couples” key on marital status and age, which ECOA protects. Speak to the occasion, not the people: “Planning a wedding?” works well.",
        comments: [
          {
            author: "u_priya",
            afterHours: 26,
            body: "Makes sense. Reworking the headline with the brand team — new draft early next week.",
          },
        ],
      },
    ],
  },
  {
    title: "Debt payoff calculator landing page",
    productLine: "personal_loan",
    channel: "landing_page",
    submitter: "u_priya",
    createdHoursAgo: 30,
    launchAfterDays: 9,
    rounds: [
      {
        body: "See how fast you could be debt-free.\n\nEnter your balances and our calculator shows how a single fixed-rate loan could change your payoff date. Pay it off in 36 months instead of 10 years. No hidden fees, ever.\n\nHurry — rates are rising.\n\nChecking your rate won't affect your credit score.\n\nAPRs from 8.99% to 35.99%. Subject to credit approval. Terms apply.",
        reviewer: "u_marcus",
        pickupAfterHours: 22,
        comments: [
          {
            author: "u_priya",
            afterHours: 24,
            body: "Calculator assumptions are in the methodology doc linked on the brief, if that helps.",
          },
          {
            author: "u_marcus",
            afterHours: 26,
            body: "Thanks. Checking with Product whether any fees apply at all before I clear “no hidden fees.”",
          },
        ],
      },
    ],
  },
  {
    title: "Rate-check reminder for returning visitors",
    productLine: "personal_loan",
    channel: "email",
    submitter: "u_priya",
    createdHoursAgo: 55,
    launchAfterDays: 4,
    rounds: [
      {
        body: "Subject: Good news — you've been pre-approved, {first_name}\n\nYou're pre-approved for up to $25,000 at rates as low as 5.99%. Just $289/mo. Finish your application today — offer ends soon!",
      },
    ],
  },
  {
    title: "Approved disclosure snippets for social captions",
    productLine: "personal_loan",
    channel: "social",
    submitter: "u_marcus",
    createdHoursAgo: 26,
    launchAfterDays: 10,
    rounds: [
      {
        body: "Short-form disclosure for personal loan social posts:\n\n“Loans $5K–$40K. APR 8.99%–35.99%. Subject to credit approval. Terms apply: clearpath.example/loan-terms”",
      },
    ],
  },

  // ── Credit cards ────────────────────────────────────────────────────────
  {
    title: "ClearPath Cash+ launch email",
    productLine: "credit_card",
    channel: "email",
    submitter: "u_jordan",
    createdHoursAgo: 50 * DAY,
    launchAfterDays: 14,
    rounds: [
      {
        body: "Subject: Meet Cash+, the card that pays you back\n\nEarn unlimited 2% cash back on every purchase, plus a $200 bonus after you spend $500 in your first 3 months. Enjoy 0% intro APR on purchases and balance transfers!\n\nNo annual fee. Apply in minutes.",
        reviewer: "u_kenji",
        pickupAfterHours: 8,
        decideAfterHours: 3,
        outcome: "changes_requested",
        decisionComment:
          "The 0% intro offer needs its length and the go-to APR right next to it (12 CFR 1026.16(g)). Please add the terms line too.",
      },
      {
        body: "Subject: Meet Cash+, the card that pays you back\n\nEarn unlimited 2% cash back on every purchase, plus a $200 bonus after you spend $500 in your first 3 months. Enjoy 0% intro APR on purchases and balance transfers for 15 months, then a variable APR of 19.24%–29.24%, based on creditworthiness. A 3% balance transfer fee applies (min $5).\n\nNo annual fee. Subject to credit approval. Terms apply.",
        note: "Added the intro period, go-to APR and the balance transfer fee.",
        submittedAfterHours: 16,
        reviewer: "u_kenji",
        pickupAfterHours: 3,
        decideAfterHours: 1,
        outcome: "approved",
        decisionComment: "Approved for launch.",
      },
    ],
  },
  {
    title: "Cash+ rewards Instagram carousel",
    productLine: "credit_card",
    channel: "social",
    submitter: "u_jordan",
    createdHoursAgo: 38 * DAY,
    launchAfterDays: 8,
    rounds: [
      {
        body: "Slide 1: The best card for everyday spending. 💳\nSlide 2: 2% cash back on everything. No hidden fees.\nSlide 3: Apply today — link in bio.",
        reviewer: "u_marcus",
        pickupAfterHours: 30,
        decideAfterHours: 4,
        outcome: "changes_requested",
        decisionComment:
          "Two claims we can't support: “the best card” (no substantiation) and “no hidden fees” (Cash+ has late and foreign transaction fees). Name the specific fee you don't charge instead.",
      },
      {
        body: "Slide 1: An everyday card that pays you back. 💳\nSlide 2: 2% cash back on everything. $0 annual fee. Purchase APR 19.24%–29.24% variable.\nSlide 3: Apply today — link in bio. Subject to credit approval. Terms apply.",
        submittedAfterHours: 26,
        reviewer: "u_marcus",
        pickupAfterHours: 6,
        decideAfterHours: 1,
        outcome: "approved",
        decisionComment: "Approved.",
      },
    ],
  },
  {
    title: "Cash+ “More back” animated display ad",
    productLine: "credit_card",
    channel: "display_ad",
    submitter: "u_jordan",
    createdHoursAgo: 28 * DAY,
    launchAfterDays: 6,
    rounds: [
      {
        body: "Frame 1: More back on every swipe.\nFrame 2: 2% cash back. $0 annual fee.\nTerms apply.",
        reviewer: "u_marcus",
        pickupAfterHours: 5,
        decideAfterHours: 2,
        outcome: "approved",
        decisionComment:
          "Approving with the trigger-term finding noted: this is a 300×250 animated unit and the purchase APR and fee table render on the end frame (creative CP-DA-1182, attached in Workfront). The copy field only captures frames 1–2.",
      },
    ],
  },
  {
    title: "Q4 Flex card acquisition landing page",
    productLine: "credit_card",
    channel: "landing_page",
    submitter: "u_jordan",
    createdHoursAgo: 24 * DAY,
    launchAfterDays: 10,
    rounds: [
      {
        body: "Approval guaranteed. Bad credit OK.\n\nGet the ClearPath Flex card with a credit line up to $5,000 — everyone qualifies. 0% APR for 12 months.\n\nHurry: only 500 cards left!",
        reviewer: "u_alana",
        pickupAfterHours: 12,
        decideAfterHours: 3,
        outcome: "rejected",
        decisionComment:
          "Rejecting. Flex is an underwritten product with a 61% approval rate, so “approval guaranteed” and “everyone qualifies” would be deceptive under UDAAP regardless of disclaimers. Please re-brief with Card Product before a new draft.",
      },
    ],
  },
  {
    title: "Credit-builder tips social post",
    productLine: "credit_card",
    channel: "social",
    submitter: "u_jordan",
    createdHoursAgo: 18 * DAY,
    launchAfterDays: 5,
    rounds: [
      {
        body: "Building credit is a marathon, not a sprint. 🏃\nThree habits that help: pay on time, keep balances low, and review your credit report every year at annualcreditreport.com.\nClearPath Builder can help you get there. Subject to credit approval. Terms apply.",
        reviewer: "u_kenji",
        pickupAfterHours: 4,
        decideAfterHours: 1,
        outcome: "approved",
        decisionComment: "Nice educational post — approved.",
      },
    ],
  },
  {
    title: "Platinum Transfer mailer — “You've been pre-selected”",
    productLine: "credit_card",
    channel: "direct_mail",
    submitter: "u_jordan",
    createdHoursAgo: 9 * DAY,
    launchAfterDays: 21,
    rounds: [
      {
        body: "{First_name}, you've been pre-selected for a ClearPath Platinum Transfer card.\n\nMove your high-interest balances and pay 0% intro APR for 18 months. Then a variable APR of 20.24%–29.99%.\n\nRespond by the date on your reply card.",
        reviewer: "u_kenji",
        pickupAfterHours: 10,
        decideAfterHours: 30,
        outcome: "changes_requested",
        decisionComment:
          "Prescreened mail needs both the short- and long-form opt-out notices (12 CFR 1022.54). Put them on the back panel, and add the terms line.",
      },
      {
        body: "{First_name}, you've been pre-selected for a ClearPath Platinum Transfer card.\n\nMove your high-interest balances and pay 0% intro APR for 18 months. Then a variable APR of 20.24%–29.99%.\n\nRespond by the date on your reply card.\n\nPRESCREEN & OPT-OUT NOTICE: This “prescreened” offer of credit is based on information in your credit report indicating that you meet certain criteria. If you do not want to receive prescreened offers of credit from this and other companies, call the consumer reporting agencies toll-free, 1-888-5-OPT-OUT (1-888-567-8688), or visit optoutprescreen.com.\n\nSubject to credit approval. Terms apply.",
        note: "Added the short-form notice to the front and long-form to the back panel.",
        submittedAfterHours: 120,
        reviewer: "u_kenji",
        pickupAfterHours: 4,
      },
    ],
  },
  {
    title: "Platinum upgrade offer for existing cardmembers",
    productLine: "credit_card",
    channel: "email",
    submitter: "u_jordan",
    createdHoursAgo: 40,
    launchAfterDays: 5,
    rounds: [
      {
        body: "Subject: You've been selected for an upgrade\n\nAs a valued cardmember, you've been selected for ClearPath Platinum. Enjoy the lowest APR we've ever offered: 0% intro APR on balance transfers.\n\nUpgrade today — it only takes a minute.",
        reviewer: "u_kenji",
        pickupAfterHours: 10,
        comments: [
          {
            author: "u_kenji",
            afterHours: 14,
            body: "Checking with Card Product whether this list is prescreened or pure existing-customer — that decides whether the FCRA opt-out applies.",
          },
        ],
      },
    ],
  },
  {
    title: "Cash+ retargeting banner",
    productLine: "credit_card",
    channel: "display_ad",
    submitter: "u_jordan",
    createdHoursAgo: 5,
    launchAfterDays: 3,
    rounds: [
      {
        body: "Still thinking it over?\nCash+ earns 2% cash back on everything.\nPurchase APR 19.24%–29.24% variable. $0 annual fee.\nSubject to credit approval. Terms apply.",
      },
    ],
  },
  {
    title: "Standard APR disclosure footer for all card emails",
    productLine: "credit_card",
    channel: "email",
    submitter: "u_dana",
    createdHoursAgo: 20,
    launchAfterDays: 12,
    rounds: [
      {
        body: "Purchase APR: 19.24%–29.24% variable, based on your creditworthiness. Balance transfer APR: 19.24%–29.24% variable. Cash advance APR: 29.99% variable. Annual fee: $0. Balance transfer fee: 3% of each transfer (min $5).\n\nSubject to credit approval. See clearpath.example/card-terms for details.",
        assignedBy: "u_dana",
        reviewer: "u_marcus",
        pickupAfterHours: 18,
      },
    ],
  },

  // ── Mortgage prequalification ──────────────────────────────────────────
  {
    title: "Spring homebuying checklist email",
    productLine: "mortgage_prequal",
    channel: "email",
    submitter: "u_sofia",
    createdHoursAgo: 54 * DAY,
    launchAfterDays: 8,
    rounds: [
      {
        body: "Subject: Your spring homebuying checklist\n\n1. Check your credit report.\n2. Set a budget you're comfortable with.\n3. Get prequalified to see what you may be able to borrow. Prequalification is not a loan approval or commitment to lend.\n\nClearPath Home Lending, LLC · NMLS #482913 · Equal Housing Lender",
        reviewer: "u_alana",
        pickupAfterHours: 7,
        decideAfterHours: 1,
        outcome: "approved",
        decisionComment: "Approved.",
      },
    ],
  },
  {
    title: "First-time homebuyer prequal landing page",
    productLine: "mortgage_prequal",
    channel: "landing_page",
    submitter: "u_sofia",
    createdHoursAgo: 44 * DAY,
    launchAfterDays: 16,
    rounds: [
      {
        body: "Your first home is closer than you think.\n\nGet prequalified in 3 minutes and you're approved to start shopping today. Buy with just 3% down.\n\nPerfect for young families ready to put down roots.",
        reviewer: "u_alana",
        pickupAfterHours: 14,
        decideAfterHours: 6,
        outcome: "changes_requested",
        decisionComment:
          "Several issues: prequal can't be framed as approval, “3% down” triggers the APR and terms disclosure, and every mortgage asset needs the NMLS ID and Equal Housing statement. The “young families” line also raises a familial-status flag under the Fair Housing Act.",
      },
      {
        body: "Your first home is closer than you think.\n\nGet prequalified in 3 minutes to see how much you may be able to borrow. Prequalification is not a loan approval or commitment to lend. Down payments as low as 3%.\n\nBuilt for first-time buyers ready to put down roots.\n\nClearPath Home Lending, LLC · NMLS #482913 · Equal Housing Lender",
        note: "Reworked the prequal language and added NMLS / Equal Housing.",
        submittedAfterHours: 50,
        reviewer: "u_alana",
        pickupAfterHours: 20,
        decideAfterHours: 2,
        outcome: "changes_requested",
        decisionComment:
          "Much better. Last thing: “down payments as low as 3%” is still a triggering term, so it needs the APR and a representative example. Add that and we're there.",
      },
      {
        body: "Your first home is closer than you think.\n\nGet prequalified in 3 minutes to see how much you may be able to borrow. Prequalification is not a loan approval or commitment to lend. Down payments as low as 3%. Example: a $300,000 30-year fixed-rate loan at 6.625% interest (6.912% APR) with 3% down has 360 monthly payments of $1,863.27 (principal and interest; taxes and insurance not included).\n\nBuilt for first-time buyers ready to put down roots.\n\nSubject to credit approval. Terms apply.\n\nClearPath Home Lending, LLC · NMLS #482913 · Equal Housing Lender",
        note: "Added the representative example from the rate sheet dated this week.",
        submittedAfterHours: 28,
        reviewer: "u_alana",
        pickupAfterHours: 4,
        decideAfterHours: 1,
        outcome: "approved",
        decisionComment: "Approved. This is the template I'll point other teams to.",
      },
    ],
  },
  {
    title: "Maple Ridge neighborhood spotlight email",
    productLine: "mortgage_prequal",
    channel: "email",
    submitter: "u_sofia",
    createdHoursAgo: 26 * DAY,
    launchAfterDays: 9,
    rounds: [
      {
        body: "Subject: Discover Maple Ridge, an exclusive neighborhood\n\nMaple Ridge is a family-friendly neighborhood with great schools and a strong Christian community — perfect for traditional families. Get prequalified with ClearPath today.\n\nClearPath Home Lending, LLC · NMLS #482913 · Equal Housing Lender",
        reviewer: "u_alana",
        pickupAfterHours: 9,
        decideAfterHours: 2,
        outcome: "rejected",
        decisionComment:
          "Rejecting — this steers by religion and familial status, which the Fair Housing Act prohibits in housing advertising (42 U.S.C. 3604(c)). It isn't fixable with edits; the spotlight concept needs a rethink with Legal before a new draft.",
      },
    ],
  },
  {
    title: "Prequal retargeting display ad",
    productLine: "mortgage_prequal",
    channel: "display_ad",
    submitter: "u_sofia",
    createdHoursAgo: 5 * DAY,
    launchAfterDays: 12,
    rounds: [
      {
        body: "Ready to buy? Get prequalified today.\nLowest mortgage rates in the state.\nClearPath Home Lending · NMLS #482913",
        reviewer: "u_alana",
        pickupAfterHours: 30,
        decideAfterHours: 2,
        outcome: "changes_requested",
        decisionComment:
          "Drop “lowest mortgage rates” unless we can cite a current survey, and add Equal Housing Lender plus the prequal disclaimer. Happy to approve quickly once those are in.",
      },
    ],
  },
  {
    title: "“Know your budget” prequal social ad",
    productLine: "mortgage_prequal",
    channel: "social",
    submitter: "u_sofia",
    createdHoursAgo: 72,
    launchAfterDays: 6,
    rounds: [
      {
        body: "Know your budget before you fall in love with a house. 🏡 Get pre-qualified in minutes — it's like a green light from the lender, guaranteed. Won't hurt your credit. NMLS #482913",
        reviewer: "u_alana",
        pickupAfterHours: 22,
        comments: [
          {
            author: "u_alana",
            afterHours: 30,
            body: "Sofia, can we drop “guaranteed” and the green-light line? Prequal isn't an approval. Holding the decision until we talk.",
          },
          {
            author: "u_sofia",
            afterHours: 33,
            body: "Yes — rewriting now. Will resubmit once the brand team signs off on the new line.",
          },
        ],
      },
    ],
  },
  {
    title: "Refinance rate-drop mailer",
    productLine: "mortgage_prequal",
    channel: "direct_mail",
    submitter: "u_sofia",
    createdHoursAgo: 30,
    launchAfterDays: 5,
    rounds: [
      {
        body: "Rates just dropped. Lock in a 6.25% rate on a 30-year fixed and lower your monthly payment by up to $412.\n\nCall today — rates can change daily.\n\nClearPath Home Lending, LLC · NMLS #482913 · Equal Housing Lender",
        assignedBy: "u_dana",
        reviewer: "u_alana",
      },
    ],
  },
];
