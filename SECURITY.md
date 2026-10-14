# Security

Review Hub holds a compliance record: who submitted what, what the reviewer
saw, and who approved it. The most important things to protect are that the
record is **accurate** (nobody can act as someone else or skip a step) and
**permanent** (nothing can be quietly changed afterwards). Unreleased marketing
copy is confidential too.

This page covers what's in place, the one deliberate shortcut in the public
demo, and what changes before real customer data.

## The demo's sign-in is intentionally open

The public demo has no passwords. Anyone with the link can pick one of seven
fictional employees and is signed in as them, so an evaluator can see all three
roles in a minute. All data is fictional.

Everything *after* sign-in is real and stays the same in production:

- The sign-in cookie is a signed token (HS256, with the algorithm, issuer and
  audience checked). It's `HttpOnly`, `SameSite=Lax`, `Secure` with the
  `__Host-` prefix in production, and expires after 8 hours. A forged or
  expired cookie is ignored.
- The cookie only says *who* you are. Your role is read from the database on
  every request, so changing someone's role takes effect immediately.
- Every page and every action checks permission on the server (below). Each
  sign-in, sign-out and switch is recorded in the audit trail with its session.

Swapping the demo picker for company sign-in changes two files
(`src/server/session.ts` and the login page). The permission rules, data layer
and audit trail only need a person's id and role.

## Controls

### Who can do what

- One permission policy, `src/domain/permissions.ts`, is checked on the server
  for every read and every write. The interface uses the same policy only to
  decide what to show; hiding a button is never the protection.
- Separation of duties: nobody can start, decide or be assigned a review of
  their own copy, the Compliance Lead included.
- Submitters only see their own submissions. Opening anyone else's shows "not
  found", which doesn't confirm it exists.
- Only the Compliance Lead can assign reviewers or download the audit trail.
  Only the compliance team can import.

### A record that can't be rewritten

- Every change and its audit event are saved in the same database transaction:
  both or neither.
- The database itself refuses to update, delete or empty the audit table
  (triggers in `drizzle/0001_audit_append_only.sql`). A bug or a compromised
  app server can add events but can't change past ones.
- Decisions lock the submission's row and re-check permission and the workflow
  on the locked row, so two people acting at the same moment can't both win,
  and nobody can decide a review that was reassigned a second earlier.
- The workflow only allows the defined moves (`src/domain/workflow.ts`).
  Anything else is refused.
- Pre-check results are stored with the version of the rules that produced
  them, so a past decision can always be reproduced.

### Requests and input

- **Forged requests (CSRF).** Every write checks that the request's `Origin`
  matches the site and rejects requests without one. This covers server actions
  and the audit download, which is a `POST` because downloading is itself
  recorded. The cookie's `SameSite=Lax` adds a second layer.
- **Validation.** Every field is checked on the server with Zod, whatever the
  form allowed: lengths, allowed values, real dates, launch dates within a
  year.
- **Database queries** are always parameterised through Drizzle. Search text
  has its wildcard characters escaped.
- **Redirects** after sign-in only go to paths on this site.
- **Rate limits.** Each person can make 20 changes in a burst, then one every
  2 seconds. Sign-in is limited to 10 per address, then one every 6 seconds.
  Signing out isn't limited: it only ends the caller's own session.

### The browser

- **Content Security Policy** with a fresh random nonce per page and
  `strict-dynamic`: only scripts Review Hub itself served can run. Nothing
  loads from other sites, including fonts. Plugins are blocked, forms can only
  post to the site, and `upgrade-insecure-requests` is on in production.
- **No framing** (`frame-ancestors 'none'` and `X-Frame-Options: DENY`), so the
  app can't be embedded in another page to trick someone into clicking.
- `Strict-Transport-Security` for two years, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Cross-Origin-Opener-Policy: same-origin`, and a `Permissions-Policy` that
  turns off camera, microphone, location, payment, USB and ad-topic APIs.
- React escapes everything it displays and the app never inserts raw HTML.
  Imported emails are reduced to plain text.
- The `X-Powered-By` header is off.

### Uploaded files

- **Spreadsheets** are limited to 2 MB and 500 rows (requests are capped at
  2.5 MB). Unpacked contents are capped at 30 MB per part and 60 MB in total,
  so a compressed "zip bomb" is refused before it's read. Only cell values are
  read: no formulas are run, no macros, no external links, no XML entities.
  Older `.xls` and macro-enabled `.xlsm` files are refused.
- **Emails** are read in the person's browser, never uploaded. The reader has
  limits on size (10 MB), nesting and header length. Only the fields the person
  confirms reach the server, and they're validated like any other submission.
- **Uploaded files aren't stored.** The rows they produce are the record.

### Downloads

- The audit download is limited to the Compliance Lead and is itself recorded
  in the audit trail.
- Any cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return is
  prefixed so Excel shows it as text instead of running it as a formula
  ("CSV injection").

### Errors

People see what happened and what to do, never how the system works inside.
Expected problems (a missing field, a review someone else just decided, a file
that doesn't match the template) have their own plain messages. Anything
unexpected is logged on the server and shown only as "Something went wrong on
our side. Nothing was saved." Database messages, file paths and stack traces
never reach the browser.

### Secrets and configuration

- Three environment variables: `SESSION_SECRET` and two database addresses.
  In production they live in Vercel's encrypted environment variables.
- Nothing secret is in the repository. `.env*` files are ignored by git except
  `.env.example`, which has empty values.
- `SESSION_SECRET` must be at least 32 characters. Without one, the app won't
  issue or accept any sign-in.
- Scripts that print the database they're working on show only its host and
  name, never the password. The seed script erases the database, so it refuses
  to run against anything but a local one unless given `--yes`.
- Settings are deliberately not stored in the database: the database address
  can't live in the database it unlocks, and a secret in a table would let
  anyone who can read the database forge sign-ins.

### Dependencies

- `npm audit --omit=dev`: **0 known vulnerabilities** in what runs in
  production (checked October 13, 2026).
- The full audit lists advisories only in development tools that never run in
  the deployed app: the Next.js lint configuration (through `fast-glob`,
  `micromatch` and `braces`, a slowdown triggered by unusual file patterns in
  the developer's own project) and `drizzle-kit`, the migration generator
  (through an old `esbuild` whose development server isn't used). We don't run
  `npm audit fix --force`, which would install incompatible major versions;
  they're resolved by upgrading those tools when fixed releases ship.

## Before real customer data

| Area | Change |
| --- | --- |
| Sign-in | Company single sign-on over OIDC (authorization code with PKCE) with the identity provider, such as Okta or Microsoft Entra ID. Multi-factor sign-in and offboarding come from there, and roles map from directory groups |
| Sessions | Store sessions on the server (or check a revocation list) so access can be cut off before a session expires |
| Database permissions | The app connects as a role that can only insert into and read the audit table. Only the migration role owns the schema and could ever disable its triggers |
| Rate limits | Move the counters from memory to a shared store such as Redis (Upstash on Vercel), so limits hold across regions and instances |
| Secrets | Rotate `SESSION_SECRET` on a schedule and on staff changes, through a secret manager |
| Monitoring | Send server logs and errors to a monitoring service, with alerts on repeated permission denials and failed sign-ins |
| Data | Point-in-time backups (built into Neon), a retention policy for the audit trail agreed with legal, and an export for examiners covering a date range |
| Review | An independent penetration test before launch |

## Reporting a problem

If you find a security issue, please report it privately to the maintainers
rather than opening a public issue.
