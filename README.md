# ClearPath Review Hub

The marketing-compliance review desk for ClearPath Financial. It replaces the
Excel tracker and the email threads that marketing and compliance use today,
so more campaigns get reviewed, on time, with less back-and-forth.

> ClearPath Financial, its people and its data are fictional. This is a working
> demo: anyone with the link can sign in as one of seven sample employees.

**Live demo:** _link added after the first deploy_

![The review queue: every open review, soonest deadline first](docs/screenshots/queue.jpg)

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
| Nobody can see where work gets stuck | A dashboard shows turnaround, on-time rate, first-time approvals, reviewer workload and the guidelines marketing trips over most |

The full reasoning is in [docs/PLAN.md](docs/PLAN.md).

## Try it

Open the demo, pick a person and you're signed in. There are no passwords
(see [Security](SECURITY.md) for why that's fine for a demo and what production
would use). The switcher at the bottom of the sidebar changes person at any time.

| Person | Role | Good for |
| --- | --- | --- |
| Priya Raman | Submitter (Growth Marketing) | Drafting copy and watching the pre-check flag it live; revising work that was sent back |
| Jordan Ellis, Sofia Marquez | Submitters | More marketing work in flight |
| Marcus Bell | Reviewer (Senior Compliance Analyst) | Working the queue; trying to approve his own copy and being stopped |
| Alana Torres, Kenji Watanabe | Reviewers | Mortgage and card specialists with their own workload |
| Dana Okafor | Compliance Lead | The dashboard, assigning reviewers, imports and the audit trail download |

A five-minute walkthrough:

1. **As Priya**, choose **New submission**, click the **Risky loan email**
   sample and watch the live pre-check score it before you submit.
2. **As Marcus**, open the review from the queue, choose **Start review**, then
   **Request changes** with a note.
3. **As Priya**, open it again, choose **Revise and resubmit**, fix the copy and
   send it back. The review page now shows a tracked-changes view between versions.
4. **As Dana**, approve it, then visit the **Dashboard**, the **Audit trail**
   (try **Download for Excel**) and **Import**, where **See a filled-in example**
   gives you a tracker to try the import with.

| | |
| --- | --- |
| ![A review with the pre-check's findings marked in the copy](docs/screenshots/review.jpg) | ![The live pre-check while drafting](docs/screenshots/new-submission.jpg) |
| ![The dashboard](docs/screenshots/dashboard.jpg) | ![Checking an Excel tracker before importing it](docs/screenshots/import-preview.jpg) |

It works the same on a phone, tablet, laptop or a large monitor:

<p>
  <img src="docs/screenshots/phone-queue.jpg" alt="The queue on a phone" width="260">
  <img src="docs/screenshots/phone-review.jpg" alt="A review on a phone" width="260">
</p>

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
| `npm test` | Unit tests (Vitest, 267 tests) |
| `npm run test:layout` | Signs in as each role and checks every page fits phone, tablet, laptop, desktop and 2560px screens (Playwright) |
| `npm run docs:screenshots` | Regenerates the screenshots in this README (run `npm run db:seed` first) |
| `npm run db:generate` | Write a new migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Reset the database to the demo data. Asks for `--yes` against anything that isn't local; `--dry-run` previews |

GitHub Actions runs the checks, the production build and the layout test on every push
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

### How the code is organised

```
src/
  app/                 Pages and routes (Next.js App Router)
    (app)/             Signed-in pages: queue, submissions, dashboard, import, audit, rules
    login/             Demo sign-in: pick a person from the team
  components/          Shared UI: app shell, findings, redline, deadline indicator, form parts
  domain/              The business rules as plain, unit-tested functions:
                       workflow states, deadlines, risk scoring, permissions, metrics,
                       the pre-check rules, and the tracker and email import checks
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
e2e/                   Playwright layout checks and README screenshots
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
   database access.
