# ClearPath Review Hub

The marketing-compliance review desk for ClearPath Financial. It replaces the
Excel tracker and the email threads that marketing and compliance use today,
so more campaigns get reviewed, on time, with less back-and-forth.

> ClearPath Financial, its people and its data are fictional. This is a working
> demo: anyone with the link can sign in as one of seven sample employees.

**Live demo:** [clearpath-review-hub.vercel.app](https://clearpath-review-hub.vercel.app) ·
**Code:** [github.com/Sgagneja/clearpath-review-hub](https://github.com/Sgagneja/clearpath-review-hub)

![The review queue: every open review, soonest deadline first](docs/screenshots/queue.jpg)

**On this page:** [Why it exists](#why-it-exists) · [Try it](#try-it) ·
[How a submission moves](#how-a-submission-moves) · [The pre-check rules](#the-pre-check-rules) ·
[Scores and deadlines](#scores-and-deadlines) · [Who can do what](#who-can-do-what) ·
[Key decisions](#key-decisions) · [Assumptions](#assumptions) · [How it's tested](#how-its-tested) ·
[For developers](#for-developers)

---

## Why it exists

Compliance review at ClearPath runs on a shared spreadsheet and email. That
process is now the bottleneck on growth: marketing can produce campaigns faster
than compliance can clear them. The time goes to work that isn't judgement:

| Where time goes today | What Review Hub does instead |
| --- | --- |
| Requests sit in someone's inbox and nobody knows who owns them | One queue for the whole team, soonest deadline first, with unassigned work called out |
| Reviewers re-read every draft for the same handful of mistakes | A rules-based pre-check marks those mistakes in the copy before a reviewer opens it, and shows marketing the same marks while they write |
| No deadlines, so launches slip without warning | Every review gets a deadline set by its risk (48, 72 or 120 hours), and the queue warns when a deadline lands on or after launch day |
| Versions get lost in reply chains | Every revision is kept, with a tracked-changes view of what moved between versions |
| Audit evidence is assembled by hand | Every action is recorded permanently and downloads as an Excel-ready file |
| Years of history live in old trackers and inboxes | The team's existing Excel tracker and review emails can be brought in, checked before anything is saved |
| Nobody can see where work gets stuck | The team overview shows how much work is at each stage, which stage is slowest, who has what, and what's closest to its deadline |

The full reasoning is in [docs/PLAN.md](docs/PLAN.md).

## Try it

Open the demo, pick a person and you're signed in. There are no passwords
(see [Security](SECURITY.md) for why that's fine for a demo and what production
would use). The switcher at the bottom of the sidebar changes person at any time.

| Person | Role | Good for |
| --- | --- | --- |
| Dana Okafor | Compliance Lead | The team overview, handing out reviews, imports and the audit trail download |
| Marcus Bell | Reviewer (Senior Compliance Analyst) | His own reviews under **My work**; trying to approve copy he wrote himself and being stopped |
| Alana Torres, Kenji Watanabe | Reviewers | Mortgage and card specialists with their own workload |
| Priya Raman | Submitter (Growth Marketing) | Drafting copy and watching the pre-check flag it live; revising work that was sent back |
| Jordan Ellis, Sofia Marquez | Submitters | More marketing work in flight |

A five-minute walkthrough:

1. **As Dana**, you land on the **Team overview**: how much work is waiting,
   under review, back with marketing and decided this week, which stage is
   slowest, and who has what. **My work** is one tab over.
2. **As Priya**, choose **New submission**, click the **Risky loan email**
   sample and watch the live pre-check score it before you submit.
3. **As Marcus**, open it from the queue, choose **Start review**, then
   **Request changes** with a note.
4. **As Priya**, open it again, choose **Revise and resubmit**, fix the copy and
   send it back. The review page shows a tracked-changes view between versions,
   and the strip at the top shows every round so far.
5. **As Dana**, approve it, then open the **Rule library**, pick a product and
   try one of its test cases. Finish with the **Audit trail** (**Download for
   Excel**) and **Import**, where **See a filled-in example** gives you a
   tracker to try.

| | |
| --- | --- |
| ![A review with the pre-check's findings marked in the copy](docs/screenshots/review.jpg) | ![The live pre-check while drafting](docs/screenshots/new-submission.jpg) |
| ![The team overview](docs/screenshots/dashboard.jpg) | ![Checking an Excel tracker before importing it](docs/screenshots/import-preview.jpg) |

It works the same on a phone, tablet, laptop or a large monitor:

<p>
  <img src="docs/screenshots/phone-queue.jpg" alt="The queue on a phone" width="260">
  <img src="docs/screenshots/phone-review.jpg" alt="A review on a phone" width="260">
</p>

## How a submission moves

```
          ┌─────────── request changes ───────────┐
          ▼                                       │
  Submitted ──▶ Waiting for a reviewer ──▶ In review ──▶ Approved  (closed)
  (pre-check     (deadline running)        (one person   ──▶ Rejected  (closed)
   runs here)                               decides)
          ▲                                       │
          └── resubmitted as the next version ◀───┘  back with marketing,
                                                     deadline paused
```

- **Submitted.** Marketing writes or pastes the copy and picks the product and
  channel. The pre-check runs as they type, and again on submit; its findings
  and risk score are saved with the version.
- **Waiting for a reviewer.** The review deadline starts. The Compliance Lead
  can assign it, or any reviewer can pick up unassigned work.
- **In review.** One reviewer owns it. They comment, then approve, request
  changes or reject. Approving copy that still has high-severity findings needs
  a written reason.
- **Back with marketing.** The deadline pauses. The submitter replies and
  resubmits; the new version gets its own pre-check and its own deadline, and
  goes back to the same reviewer.
- **Approved or rejected.** The submission closes. Approved copy is cleared for
  its launch date; rejected copy can't run in any form.

Every screen shows the same lifecycle. The team overview counts work at each
stage and names the slowest; each submission's page shows its own path,
round by round, ending at its launch date.

## The pre-check rules

Sixteen checks, written as plain rules rather than AI, so the same copy always
gets the same result and every finding can be explained. Each one applies only
to the products it's relevant to: **13 apply to personal loans, 13 to credit
cards and 15 to mortgage prequalification**. They're the same on every channel.

| Check | Severity | Kind | Regulation | Products |
| --- | --- | --- | --- | --- |
| Triggering terms without an APR | High | Missing disclosure | Reg Z · 12 CFR 1026.24(d) | All |
| Rate not stated as an APR | High | Missing disclosure | Reg Z · 12 CFR 1026.24(c) | All |
| “As low as” rate without qualifying terms | High | Missing disclosure | Reg Z · 12 CFR 1026.24(c); CFPA UDAAP | All |
| Promotional rate missing its terms | High | Missing disclosure | Reg Z · 12 CFR 1026.16(g) | Loan, Card |
| Prescreened offer without the opt-out notice | High | Missing disclosure | FCRA § 615(d) · 15 U.S.C. 1681m(d); 12 CFR 1022.54 | All |
| Absolute or guaranteed outcome claim | High | Risky claim | CFPA UDAAP · 12 U.S.C. 5531, 5536 | All |
| Prequalification presented as approval | High | Risky claim | Reg Z · 12 CFR 1026.24(i); MAP Rule · 12 CFR 1014.3 (cards: CFPA UDAAP) | All |
| NMLS ID missing | Medium | Missing disclosure | SAFE Act · 12 U.S.C. 5101 et seq.; state advertising rules | Mortgage |
| Equal Housing statement missing | Medium | Missing disclosure | Fair Housing Act · 42 U.S.C. 3604(c); HUD advertising guidance | Mortgage |
| Prequalification disclaimer missing | Medium | Missing disclosure | MAP Rule · 12 CFR 1014.3; CFPA UDAAP | Mortgage |
| Credit-score claim without the soft-pull qualifier | Medium | Risky claim | CFPA UDAAP · 12 U.S.C. 5531; FCRA · 15 U.S.C. 1681b | All |
| Unsubstantiated superlative | Medium | Risky claim | FTC Act § 5 · 15 U.S.C. 45; CFPA UDAAP | All |
| Blanket “no fees” claim | Medium | Risky claim | CFPA UDAAP · 12 U.S.C. 5531; Reg Z · 12 CFR 1026.24(i) | All |
| Audience language may raise fair-lending concerns | Medium | Fair lending | ECOA / Reg B · 12 CFR 1002.4(b); Fair Housing Act · 42 U.S.C. 3604(c) | All |
| Urgency without a real deadline | Low | Presentation | CFPA UDAAP · 12 U.S.C. 5531 | All |
| No “terms apply” or credit-approval line | Low | Presentation | CFPA UDAAP · clear and conspicuous standard | All |

The checks read copy the way it actually arrives: pasted from Word or an email
client, with curly quotes, non-breaking hyphens and “percent” spelled out. They
live in [`src/domain/precheck/rules.ts`](src/domain/precheck/rules.ts); the
version in use (currently **Rule set 2026.10.2**) is saved with every finding,
so old reviews still show what the rules said at the time.

**Proving the rules work, per product.** 42 test cases (15 personal loan, 13
credit card, 14 mortgage prequalification) each say exactly which checks a
piece of copy should set off, including compliant copy that must pass clean.
Every check is set off by at least one case for every product it applies to,
and results must match on all five channels. They run on every change, and
the compliance team can see them and try them in the Rule library (see
[Who can do what](#who-can-do-what)).

The pre-check advises; a reviewer decides. It can't see a disclosure that lives
on another page, so a reviewer may approve over a finding with a written
reason, which goes on the audit trail.

## Scores and deadlines

| Finding | Points |
| --- | --- |
| Each high-severity finding | 30 |
| Each medium | 15 |
| Each low | 5 |

The score is capped at 100. **50 or more is high risk, 20–49 medium, under 20
low**, so one high finding alone is medium risk and two make it high.

| Risk | Review deadline |
| --- | --- |
| High | 48 hours |
| Medium | 72 hours |
| Low | 120 hours |

Riskier copy gets the *shorter* deadline: it's the most likely to block a launch
and the most expensive to get wrong. Deadlines are calendar hours from when the
version was submitted, pause while work is back with marketing, and restart with
each new version. A launch is flagged at risk when its review deadline lands on
or after launch day.

## Who can do what

| | Submitter (marketing) | Reviewer | Compliance Lead |
| --- | :-: | :-: | :-: |
| Send copy for review, see the live pre-check | ✓ | ✓ | ✓ |
| See and comment on their own submissions | ✓ | ✓ | ✓ |
| Revise and resubmit their own copy after changes are requested | ✓ | ✓ | ✓ |
| See the whole queue, the team overview and the audit trail | | ✓ | ✓ |
| Pick up unassigned work; review and decide what's assigned to them | | ✓ | ✓ |
| See the rule test cases and try them | | ✓ | ✓ |
| Bring in old Excel trackers and review emails | | ✓ | ✓ |
| Assign or reassign reviewers; decide anyone's review | | | ✓ |
| Download the audit trail | | | ✓ |

Two rules hold for everyone, the lead included: **nobody reviews their own
copy**, and **closed submissions take no more comments**. Every rule is
checked on the server for every read and every change; hiding a button is
only a courtesy. When something isn't allowed, the screen says why in a
sentence, not an error code.

Trying a test case opens it in New submission with the copy filled in. Nothing
is saved or sent until Submit is pressed. A marketer opening the same link gets
a blank form.

## Key decisions

The most important calls, in brief. The full list, with the alternatives we
turned down, is in [docs/DECISIONS.md](docs/DECISIONS.md).

- **Written rules, not AI, for the pre-check.** Compliance has to explain every
  finding to an examiner and get the same answer twice. Each rule is a short,
  tested function with a legal citation and a suggested fix, and unreleased
  marketing copy never goes to a third party.
- **Built for the team first.** Compliance lands on the team overview, not a
  personal inbox, because the bottleneck is the team's. Each person's own work
  is one tab over.
- **The whole lifecycle, without extra pages.** The overview counts each stage
  and names the slowest; each submission shows its own rounds. No separate
  "pipeline" page to maintain or to forget to check.
- **Risk sets the deadline, and the deadline drives the queue.** The queue is
  ordered by deadline, so the work most likely to block a launch is always on top.
- **History can't be changed.** Every action writes an audit event in the same
  transaction as the change, and a database trigger rejects edits and deletes
  on the audit table.
- **Bring the old process in instead of starting over.** One documented
  tracker layout and pasted emails, each checked and previewed before anything
  is saved, and never imported twice.
- **One stack, hosted.** Next.js 16 on Vercel with Postgres on Neon: one
  codebase, server-side permission checks on every action, no separate API to
  secure. Configuration lives in Vercel's encrypted environment variables, so
  there's no settings page.
- **Plain language everywhere.** Users aren't technical: sentence-case labels,
  “review deadline” rather than SLA, “version 2” rather than v2, and every error
  says what to do next.
- **A look of its own, for every screen.** An editorial “proof sheet” design
  (copy under review set in a serif, findings marked in the margin), tested at
  phone, tablet, laptop, desktop and 2560px sizes, keyboard and screen-reader
  friendly.

## Assumptions

What we took as given because the brief didn't say. Each is one edit to change;
[docs/DECISIONS.md](docs/DECISIONS.md#assumptions) lists where each lives.

- ClearPath is a US consumer lender with three products (personal loans, credit
  cards, mortgage prequalification) and five channels (email, landing pages,
  social, direct mail, display ads).
- One compliance team: three reviewers and a Compliance Lead, serving three
  marketers. Three roles are enough.
- A review is about the words. Images and layout are reviewed outside the tool
  for now.
- Each round ends in approve, request changes or reject. Rejected means “can't
  run in any form”; fixable problems get request changes.
- Requesting changes or rejecting needs a reason of at least 15 characters, so
  the submitter knows what to do next.
- Deadlines are calendar hours in US Eastern time; holiday calendars come later.
- Old trackers use one documented layout; up to 500 reviews and 2 MB per file.
  Everyone named in an import already has an account.
- The demo is public with fictional data, so sign-in is “pick a person”. Real
  use would put company single sign-on in front of the same permission checks.

## How it's tested

| What | How | Size |
| --- | --- | --- |
| Business rules | Unit tests (Vitest) for workflow states, deadlines, scoring, permissions, metrics, imports and the lifecycle strip | 335 tests |
| The pre-check, per product | The 42 test cases above, plus checks that every rule is covered for every product and every channel agrees | Part of the 335 |
| Every workflow, every table | Playwright drives the real screens as four different people, then checks the rows in all six tables: a submission from draft to approval across two versions, a rejection, self-review being blocked, a test case saving nothing until submitted, spreadsheet and email imports (and duplicates being refused), the audit download and signing out | 5 workflows |
| Every page on every screen | Signs in as each role and fails if anything pushes past the edge of a phone, tablet, laptop, desktop or 2560px screen | 5 sizes |

All of it runs on every push in GitHub Actions
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). The workflow tests
write data, so they refuse to run against anything but a local database, and
reset it before and after.

## Documentation

| Document | What's in it |
| --- | --- |
| [docs/PLAN.md](docs/PLAN.md) | The problem, who it's for, what's in and out of scope, how we measure success, and what's next |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Every assumption we made, the technology choices and the alternatives we turned down, and the product and design decisions |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Each database table and column, and why it's shaped that way |
| [docs/IMPORTING.md](docs/IMPORTING.md) | For the compliance team: exactly which spreadsheets and emails can be brought in, and how |
| [SECURITY.md](SECURITY.md) | What we protect against, the controls in place, and what changes before real customer data |

---

## For developers

### Run it locally

You need Node 20.9 or newer and a Postgres database (14 or newer; a free
[Neon](https://neon.tech) database works too).

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run db:setup             # creates the tables and loads the demo data
npm run dev                  # http://localhost:3000
```

### Configuration

Three environment variables, and nothing else to configure. In production they
live in the Vercel project's environment variables (encrypted, and kept out of
the code), never in the repository or the database.

| Variable | Required | What it is |
| --- | --- | --- |
| `SESSION_SECRET` | Yes | Signs the sign-in cookie. At least 32 characters: `openssl rand -base64 48` |
| `DATABASE_URL` | Yes | Postgres connection used by the app. On Neon, the pooled (`-pooler`) address |
| `DATABASE_URL_UNPOOLED` | No | Direct connection for migrations and seeding. Falls back to `DATABASE_URL` |

On Vercel, the Neon integration sets both database variables; `SESSION_SECRET`
is added with `vercel env add SESSION_SECRET`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app with live reload |
| `npm run build` / `npm start` | Production build and server |
| `npm run check` | Lint, type-check and unit tests in one go |
| `npm test` | Unit tests (Vitest) |
| `npm run test:workflows` | Every workflow through the screens, checked against each table (Playwright; local database only, reset before and after) |
| `npm run test:layout` | Signs in as each role and checks every page fits phone, tablet, laptop, desktop and 2560px screens (Playwright) |
| `npm run docs:screenshots` | Regenerates the screenshots in this README (run `npm run db:seed` first) |
| `npm run db:generate` | Write a new migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Reset the database to the demo data. Asks for `--yes` against anything that isn't local; `--dry-run` previews |

### How the code is organised

```
src/
  app/                 Pages and routes (Next.js App Router)
    (app)/             Signed-in pages: team overview, queue, submissions, import, audit, rules
    login/             Demo sign-in: pick a person from the team
  components/          Shared UI: app shell, findings, redline, lifecycle strip, deadline indicator, form parts
  domain/              The business rules as plain, unit-tested functions:
                       workflow states, deadlines, risk scoring, permissions, metrics, lifecycle,
                       the pre-check rules and their per-product test cases,
                       and the tracker and email import checks
  server/
    actions/           Form endpoints: validate input, call a service, return a friendly result
    services/          Everything that writes: row locks, permission checks, audit events
    queries/           Everything that reads, scoped to what the signed-in person may see
    auth.ts, guard.ts  Who is signed in; origin check and rate limit for every write
  lib/                 Validation, dates, CSV, spreadsheet reading, rate limiter, security headers
  db/                  Drizzle schema and connection
  proxy.ts             Runs before every request: security headers and sign-in redirect
drizzle/               SQL migrations, including the trigger that makes the audit trail permanent
scripts/               Migrate and seed
e2e/                   Playwright workflow and layout checks, and README screenshots
```

The rule of thumb: `domain/` decides, `server/` enforces and records, `app/`
presents. Business rules never live in a page, so they're tested once and apply
everywhere.

### Stack

Next.js 16 (App Router, server actions), React 19, TypeScript, Tailwind CSS 4,
Postgres with Drizzle ORM, Zod, jose, Vitest and Playwright. Hosted on Vercel
with Neon Postgres. Why each, and what we turned down, is in
[docs/DECISIONS.md](docs/DECISIONS.md#stack).

### Deploying

1. Push this repository to GitHub and import it in Vercel.
2. Add the Neon integration from the Vercel marketplace. It creates the
   database and sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. `vercel env add SESSION_SECRET` with a fresh `openssl rand -base64 48`.
4. Pull the variables locally (`vercel env pull .env.local`), then run
   `npm run db:migrate` and `npm run db:seed -- --yes`.
5. Deploy. Every page is rendered per request, so there's no build-time
   database access. Pushing to `main` redeploys.
