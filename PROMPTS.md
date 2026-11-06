# AI Prompt Library: Invoicing & Reconciliation Platform

Prompts to use with an AI assistant while building the project described in `MD.md`. Copy a prompt, fill in the `[BRACKETS]`, and paste it into your AI tool.

## How to use this file

1. **Start every new AI session by pasting the Master Context Prompt** (section 1). AI tools forget between sessions, so this keeps answers consistent with your decisions.
2. **Work one phase at a time.** Use the phase prompts in section 2 in order.
3. **Paste real code and real errors**, not descriptions of them.
4. **Use the cross-cutting prompts** (section 3) after each feature: review, tests, security check.
5. **Verify against official docs.** The stack uses the latest versions, and AI answers can be outdated. Section 1 tells the AI to flag uncertainty, but still check Angular, NestJS, and Prisma docs for anything version-sensitive.
6. **Never accept code you don't understand.** If something is unclear, use the "Explain" prompt in section 3.

---

## 1. Master Context Prompt (paste at the start of every session)

```text
You are a senior full-stack engineer helping me build a multi-tenant invoicing and bank reconciliation SaaS as a CV/portfolio project.

PROJECT
- Purpose: invoicing plus automatic bank-statement reconciliation with a South Africa-focused angle (importing statements from major SA banks, normalising them, and matching deposits to open invoices with confidence scoring and a manual review queue).
- Multi-tenant from day one: shared database, tenant_id on every tenant-owned table, enforced in the application AND with PostgreSQL Row-Level Security.

STACK (use the latest stable versions of everything)
- Frontend: Angular (standalone components, signals, modern control flow)
- Backend: NestJS with TypeScript
- ORM: Prisma
- Database: PostgreSQL
- Jobs: Redis + BullMQ
- Testing: Jest, Supertest, Playwright or Cypress
- CI: GitHub Actions
- Monorepo: [Nx / pnpm workspaces]
- NOT using Docker. Assume PostgreSQL and Redis run locally or as managed services.

NON-NEGOTIABLE RULES
1. Money is never a float. Use integer cents or Decimal, with currency stored per record.
2. VAT rate is configurable per tenant and per line, never hardcoded.
3. Payments are linked to invoices through payment allocations (many-to-many), supporting partial and combined payments.
4. Statement imports are idempotent: hash each transaction so re-uploads never create duplicates.
5. Invoice numbers are sequential per tenant, generated inside a database transaction.
6. Never hard-delete financial records. Void or reverse them and write an audit log entry.
7. The audit log is append-only.
8. All money-moving operations run inside database transactions.
9. Every route validates input (DTOs) and enforces role-based access (owner, accountant, viewer).
10. Every tenant-owned query must be tenant-scoped.

HOW I WANT YOU TO RESPOND
- Follow current best practice for the latest versions. If you are unsure whether an API or syntax is current, say so and tell me what to verify in the official docs instead of guessing.
- Show complete, working code with file paths, not fragments.
- Briefly explain key decisions and trade-offs.
- Point out edge cases, security risks, and anything that could break tenant isolation or money correctness.
- Ask me ONE clarifying question only if you truly cannot proceed; otherwise state your assumption and continue.
- Do not suggest Docker.

CURRENT STATE
- Phase: [number and name]
- Done so far: [short summary]
- Working on now: [task]
```

---

## 2. Phase Prompts

### Phase 0: Preparation

**0.1 Analyse a bank statement format**

```text
I have a CSV export from [BANK NAME]. Here are the first [10] rows with personal details redacted:

[PASTE ROWS]

Analyse the format and give me:
1. Column names and what each means
2. Date format and any timezone concerns
3. How debits and credits are represented (separate columns, signed amounts, or a type column)
4. Where the payment reference lives and how noisy it is
5. Whether a running balance is present and whether it can help with deduplication
6. Anything unusual (header rows, footers, merged fields, encodings, thousand separators, decimal commas)
7. A proposed normalised TypeScript interface that could represent this and other banks' rows
```

**0.2 Compare multiple bank formats**

```text
Here are sample rows from three SA banks:

BANK A: [PASTE]
BANK B: [PASTE]
BANK C: [PASTE]

Design a single normalised BankTransaction shape that all three can map into. List the field mappings per bank, the differences I must handle in each parser, and the fields I should hash to make imports idempotent.
```

---

### Phase 1: Foundation

**1.1 Monorepo scaffold**

```text
Set up a monorepo using [Nx / pnpm workspaces] with:
- apps/api (NestJS)
- apps/web (Angular, standalone components)
- libs/shared (DTOs, types, constants shared by both)

Give me the exact commands in order, the resulting folder structure, the root scripts to start the API, web app, and background workers together, and ESLint/Prettier/tsconfig path alias setup. No Docker. Assume PostgreSQL and Redis are already running locally.
```

**1.2 Prisma schema for tenancy**

```text
Write the Prisma schema for: Tenant, User, Membership (role: OWNER, ACCOUNTANT, VIEWER), and AuditLog.

Requirements:
- A user can belong to many tenants through memberships
- Every tenant-owned model includes tenantId and appropriate indexes
- AuditLog is append-only and stores tenantId, actorId, action, entityType, entityId, before/after JSON, and timestamp
- Use sensible IDs (cuid, uuid, or uuidv7) and explain your choice
- Include the first migration steps

Explain any design decisions that affect multi-tenancy.
```

**1.3 Postgres Row-Level Security with Prisma**

```text
Show me how to enforce tenant isolation with PostgreSQL Row-Level Security while using Prisma.

I need:
1. The SQL migration that enables RLS and creates policies on tenant-owned tables, keyed on a per-transaction setting such as app.tenant_id
2. A dedicated database role the application uses that does NOT bypass RLS (and why this matters)
3. How to set the tenant context safely for each request in Prisma (client extension or transaction wrapper), using SET LOCAL semantics so it cannot leak across pooled connections
4. A NestJS request-scoped provider or interceptor that applies it automatically
5. Integration tests proving tenant A cannot read or write tenant B's data, even when application code forgets the filter

Flag any Prisma limitations or connection pooling pitfalls I should know about.
```

**1.4 Authentication**

```text
Implement authentication in NestJS:
- Register, login, refresh tokens, logout
- Password hashing with a modern algorithm (argon2 or bcrypt) and your reasoning
- Short-lived access JWT plus rotating refresh tokens stored hashed
- Guards for authentication and for role-based access
- A decorator to get the current user and active tenant
- Active tenant selected from the user's memberships

Include DTOs with validation, error handling, and tests. Point out common auth mistakes I should avoid.
```

**1.5 Angular shell**

```text
Build the Angular application shell using standalone components and signals:
- Login page
- Authenticated layout with navigation and a tenant switcher
- Route guards for authentication and roles
- HTTP interceptor that attaches the access token and handles refresh on 401
- A typed API service pattern I can reuse for every feature

Show the folder structure, full code, and how state is managed.
```

**1.6 CI pipeline**

```text
Write a GitHub Actions workflow for this monorepo that:
- Installs dependencies with caching
- Runs lint, unit tests, and builds for the API and web apps
- Starts a PostgreSQL service container for integration tests (GitHub Actions service, not my local Docker use) and runs Prisma migrations
- Fails fast and only runs affected projects if the monorepo tool supports it
```

---

### Phase 2: Customers and Invoices

**2.1 Schema**

```text
Extend the Prisma schema with Customer, Invoice, and InvoiceLine.

Requirements:
- All tenant-scoped with indexes for common queries
- Money stored as [integer cents / Decimal], currency per invoice
- Per-line VAT rate and discount
- Invoice status: DRAFT, SENT, PARTIALLY_PAID, PAID, OVERDUE, VOID
- Unique invoice number per tenant
- Customers are archived, never deleted
- Fields useful for reconciliation later (customer aliases or payer names, due date, outstanding amount)

Explain how the schema supports partial payments and voiding.
```

**2.2 Totals calculation**

```text
Write a pure, framework-free TypeScript function that calculates invoice totals from lines (quantity, unit price, discount, VAT rate).

Requirements:
- No floating-point arithmetic for money
- A clearly documented rounding strategy (per line vs per invoice) and why
- Handles zero, negative (credit notes), and very large values
- Returns subtotal, discount total, VAT total, grand total
- Include thorough Jest tests covering rounding edge cases
- Lives in libs/shared so frontend and backend use the same logic
```

**2.3 Sequential invoice numbers**

```text
Implement tenant-scoped sequential invoice numbering in NestJS with Prisma that is safe under concurrent requests.

Compare at least two approaches (a counter row with row locking, a database sequence per tenant, or serializable transactions), recommend one, implement it, and write a test that creates invoices concurrently and proves there are no duplicates or gaps caused by races.
```

**2.4 Status lifecycle**

```text
Design and implement the invoice status state machine: allowed transitions, who may trigger each, and what side effects occur (audit entry, emails, locking edits).

Show the transition table, the NestJS service code that enforces it, and tests for both valid and invalid transitions. Editing a sent invoice should be restricted; explain how to handle corrections (void and reissue or credit note).
```

**2.5 PDF generation**

```text
Implement invoice PDF generation in NestJS.

Compare Puppeteer (HTML to PDF) and PDFKit for this use case, recommend one, then implement it with a clean template that includes company details, customer, line items, VAT breakdown, banking details, and invoice number. Run generation so it does not block the request (job or stream). Explain memory and performance considerations.
```

**2.6 Invoice UI**

```text
Build the Angular invoice editor with signals and reactive forms:
- Add/remove lines, live totals using the shared calculation function
- Customer selection with search
- Validation and unsaved-changes protection
- Invoice detail view showing status, payment history, and actions (send, download PDF, void)

Show full code and explain the state management approach.
```

---

### Phase 3: Payments and Automation

**3.1 Payments and allocations**

```text
Design and implement Payment and PaymentAllocation.

Requirements:
- One payment can be allocated across several invoices; one invoice can receive several payments
- Prevent over-allocation (allocated total cannot exceed payment amount or invoice outstanding)
- Invoice status and outstanding amount update automatically inside the same transaction
- Handle reversing a payment or allocation with an audit entry
- Tests for: partial payment, exact payment, combined payment, over-allocation attempt, and reversal
```

**3.2 Background jobs**

```text
Set up BullMQ in NestJS for:
1. Recurring invoice generation
2. Overdue detection and reminder emails

Requirements:
- Jobs are idempotent (re-running never double-creates or double-sends)
- Retries with backoff and a dead-letter strategy
- Tenant context is applied correctly inside job processors so RLS still holds
- Configurable reminder schedule per tenant
- Basic monitoring (how to inspect failed jobs)

Show code, configuration, and tests.
```

**3.3 Recurring invoices**

```text
Design recurring invoices: schedule definition (frequency, start, end), how the next run is calculated (including month-end edge cases and timezones, assuming South Africa Standard Time), and how generated invoices link back to the template. Implement it with BullMQ and tests for month-end and leap-year cases.
```

---

### Phase 4: Statement Import

**4.1 Parser architecture**

```text
Design the statement import architecture in NestJS:
- A BankStatementParser interface and one implementation per bank
- Format detection (auto-detect from headers, with manual override)
- A normalised BankTransaction output
- Streaming CSV parsing for large files
- Row-level error collection (bad rows reported, good rows imported)

Show the interface, a registry/factory, and a complete parser for the following real format:

[PASTE REDACTED SAMPLE ROWS AND COLUMN NOTES]

Include tests using that sample.
```

**4.2 Idempotent import**

```text
Implement idempotent statement import.

Requirements:
- Deterministic hash per transaction built from [account, date, signed amount, normalised reference, running balance if present]
- Unique constraint on (tenantId, bankAccountId, hash)
- Handle legitimately identical transactions on the same day (two identical amounts with the same reference) without wrongly dropping them
- Upload the same file twice, and an overlapping date range file, and prove no duplicates appear
- Import runs as a background job with progress and a summary (imported, skipped, failed)

Explain how you handled the identical-transaction problem and show the tests.
```

**4.3 Upload endpoint**

```text
Implement a secure CSV upload endpoint in NestJS: file type and size validation, safe temporary storage, streaming into the job, encoding detection, and protection against malicious files (formula injection when values are later exported, oversized files, path traversal). Show the code and the Angular upload component with progress.
```

---

### Phase 5: Reconciliation Engine

**5.1 Matching engine design**

```text
Design the reconciliation matching engine for credit transactions against open invoices.

Rules, in priority order:
1. Exact reference: invoice number found in the bank reference
2. Amount plus customer: exact outstanding amount with a known payer name or saved rule
3. Amount plus fuzzy name: exact amount with normalised, token-based name similarity
4. Sum match: one deposit equals the sum of several open invoices for the same customer
5. Partial payment: amount below the outstanding balance, always sent for review

Provide:
- A scoring model with confidence values and a configurable auto-apply threshold
- Reference/name normalisation (case, punctuation, bank noise words)
- How candidate invoices are selected efficiently (avoid scanning everything)
- The data structures and interfaces for rules so new rules can be added
- Complexity analysis for the sum-match rule (subset-sum) and a practical way to bound it

Output the design first, before any code.
```

**5.2 Implementation**

```text
Implement the matching engine from this design:

[PASTE YOUR APPROVED DESIGN]

Write it as pure, testable functions separate from Prisma and NestJS, with a thin service layer that loads data and applies results. Applying a match must create the payment and allocations in one transaction and write an audit entry. Include an unmatch/undo operation.
```

**5.3 Test suite**

```text
Write a comprehensive Jest test suite for the matching engine covering:
- Each rule's happy path
- Duplicate amounts across different customers
- Same amount, ambiguous customers (must go to review, never auto-apply)
- Reference with typos, extra characters, or the invoice number embedded in noise
- Overpayment, underpayment, and rounding differences
- Refunds and reversed transactions
- Sum matches with and without a unique answer
- A reused reference
- Tenant isolation (one tenant's invoices never match another tenant's transactions)

Use table-driven tests where sensible and name each case clearly.
```

**5.4 Review queue UI**

```text
Build the Angular review queue for pending matches:
- List of unmatched and low-confidence transactions with the suggested matches and confidence shown
- Actions: confirm, reject, reassign to a different invoice or customer, split across invoices
- Bulk confirm for high-confidence suggestions
- Option to save a matching rule ("always match this payer to customer X")
- Keyboard-friendly and fast for processing many rows

Use signals and show full code.
```

**5.5 Seed data and metrics**

```text
Write a seed script that generates a realistic dataset: [N] customers, [N] invoices, and a bank statement CSV where payments include exact references, missing references, partial payments, combined payments, typos in payer names, and some unrelated deposits.

Then write a script that runs the matching engine and reports auto-match rate, review rate, false-match count (using known ground truth), and precision/recall. I want a defensible number for my CV.
```

---

### Phase 6: Reporting, Hardening and Launch

**6.1 Dashboard**

```text
Build the dashboard backend and frontend: ageing report (current, 30, 60, 90+ days), cash received over time, unreconciled transaction count, and top overdue customers. Write efficient tenant-scoped SQL/Prisma queries with appropriate indexes, cache where sensible, and use a chart library in Angular with signals.
```

**6.2 Security hardening**

```text
Review the application for security and list concrete fixes in priority order. Cover: authentication and token handling, RBAC gaps, tenant isolation (app and RLS), rate limiting, security headers (Helmet), CORS, input validation, file upload risks, secrets management, dependency vulnerabilities, logging of sensitive data, and CSV/formula injection on exports. Here is the relevant code:

[PASTE CODE]
```

**6.3 End-to-end tests**

```text
Write Playwright (or Cypress) E2E tests for the critical path:
1. Register and create a tenant
2. Create a customer and an invoice, send it
3. Import a bank statement
4. See the matching engine auto-reconcile some payments and queue others
5. Confirm a queued match
6. Verify invoice status and the dashboard update

Include test data setup and teardown, and make the tests deterministic.
```

**6.4 Deployment without Docker**

```text
Give me a deployment plan for this app WITHOUT Docker. Compare deploying to (a) a PaaS such as Railway, Render, or Fly.io and (b) a VPS with PM2 or systemd and Nginx. Recommend one for a portfolio project with a low budget, and provide step by step instructions: managed PostgreSQL and Redis, environment variables, running Prisma migrations safely, building and serving the Angular app, running the API and background workers, HTTPS, and a GitHub Actions deploy job on merge to main.
```

**6.5 Documentation**

```text
Generate the final project documentation from the following material:
[PASTE KEY CODE, SCHEMA, AND NOTES]

Produce: a README (overview, features, architecture diagram in Mermaid, setup instructions without Docker, environment variables, scripts, testing, deployment), and short Architecture Decision Records for: Row-Level Security for tenancy, idempotent imports via hashing, payment allocations design, and the matching engine's scoring approach.
```

---

## 3. Cross-Cutting Prompts (use any time)

**Code review**

```text
Review this code as a strict senior engineer. Check for: correctness, money-handling errors, race conditions, missing transactions, tenant isolation leaks, missing authorisation checks, input validation gaps, N+1 queries, error handling, naming, and testability. List problems by severity (critical, major, minor) with a concrete fix for each.

[PASTE CODE]
```

**Debug an error**

```text
I'm getting this error:

[PASTE FULL ERROR AND STACK TRACE]

Context: [what I was doing, versions of relevant packages]
Relevant code:
[PASTE CODE]

Explain the root cause first, then give the smallest fix. If there are several plausible causes, list them in order of likelihood and tell me how to confirm each.
```

**Write tests**

```text
Write tests for this code using Jest. Cover the happy path, edge cases, failure modes, and tenant isolation. Prefer table-driven tests, avoid mocking what I can test for real, and explain what each test protects against.

[PASTE CODE]
```

**Refactor**

```text
Refactor this code for readability and maintainability without changing behaviour. Keep money handling and transaction boundaries intact. Explain each change and tell me which tests I should run to confirm nothing broke.

[PASTE CODE]
```

**Explain (so you understand your own code)**

```text
Explain this code to me step by step as if I need to defend it in a technical interview. Cover what it does, why it is designed this way, the trade-offs, what could go wrong, and the follow-up questions an interviewer might ask.

[PASTE CODE]
```

**Performance and query analysis**

```text
Analyse this Prisma query and the table it runs against. Identify performance problems, suggest indexes, show the equivalent SQL, and explain how to verify the improvement with EXPLAIN ANALYZE.

[PASTE QUERY AND SCHEMA]
```

**Verify against the latest version**

```text
Before answering, check whether this approach is still correct for the latest stable versions of [Angular / NestJS / Prisma / PostgreSQL]. List anything that has been deprecated, renamed, or changed recently, and tell me exactly which official documentation pages I should confirm.

My question: [QUESTION]
```

**Architecture decision**

```text
I need to decide between [OPTION A] and [OPTION B] for [PROBLEM]. Compare them for this project (multi-tenant, correctness-critical money logic, solo developer, six-week timeline, CV showcase value). Give a recommendation and the strongest argument against it, then write a short ADR I can keep in docs/.
```

**Daily progress check**

```text
Here is my current phase checklist from the README and what I have finished:

[PASTE CHECKLIST]

Tell me: what is blocking the phase exit, what I should do next in priority order, and whether I am at risk of missing the six-week timeline. Be direct.
```

**CV and interview preparation**

```text
Here is my finished project summary and measured results:

[PASTE SUMMARY AND METRICS]

Write 4 to 5 strong CV bullets (action verb, technology, measurable outcome), a two-sentence project description for my portfolio, and 10 likely interview questions about this project with concise model answers. Do not invent numbers; use only what I provided.
```

---

## 4. Tips for Getting Better Results

- **Be specific about the phase and file.** "Add an endpoint" is weak; "add POST /invoices/:id/void to the invoices module, tenant-scoped, audited" is strong.
- **Ask for design before code** on complex pieces (matching engine, RLS, idempotency), approve it, then ask for the implementation.
- **Keep prompts small.** One feature per prompt gives better code than "build the whole module".
- **Re-paste the Master Context** when a conversation gets long and answers start to drift from your rules.
- **Challenge the AI.** Ask "what could break this?" and "how would this fail with two tenants?" after every feature.
- **Commit often.** Commit after each working AI-generated change so you can roll back bad suggestions.
- **Run it yourself.** If you can't run it and test it, it isn't done.
