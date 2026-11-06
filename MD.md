# Invoicing & Reconciliation Platform

A multi-tenant invoicing and bank-reconciliation SaaS built with **Angular**, **NestJS**, **Prisma** and **PostgreSQL**, with a narrow **South Africa-focused reconciliation wedge**: importing bank statements from major SA banks, normalising them, and automatically matching deposits to open invoices.

> **Purpose:** a CV/portfolio project that demonstrates production-grade full-stack engineering, designed multi-tenant from day one so it can later grow into a real SaaS.

---

## Table of Contents

1. [Project Brief](#1-project-brief)
2. [Goals and Success Criteria](#2-goals-and-success-criteria)
3. [Tech Stack](#3-tech-stack)
4. [Architecture](#4-architecture)
5. [Domain Model](#5-domain-model)
6. [Engineering Rules (Non-Negotiables)](#6-engineering-rules-non-negotiables)
7. [Matching Engine Specification](#7-matching-engine-specification)
8. [Phase Plan](#8-phase-plan)
9. [Definition of Done](#9-definition-of-done)
10. [CV Output](#10-cv-output)
11. [Parallel Track: SaaS Validation](#11-parallel-track-saas-validation)
12. [Version Log](#12-version-log)

---

## 1. Project Brief

### 1.1 How this project was chosen

- **Starting point:** build a full-stack project with Angular and NestJS that solves a real problem (or is genuinely new) and is strong enough to show on a CV/resume.
- **Areas explored:** communication, transportation, accounting.
- **Shortlisted ideas:**
  - Communication: multi-channel customer inbox; announcements and acknowledgement tracker.
  - Transportation: shared-transport coordination; vehicle maintenance and compliance tracker for small fleets.
  - Accounting: invoicing and payment reconciliation; expense capture and VAT-ready reporting.
- **Decision:** build **invoicing and reconciliation** as the CV project.

### 1.2 The problem

Freelancers and small businesses send invoices from Word or Excel, then manually match bank deposits against them. This is slow, error-prone, and gets worse with partial payments, one deposit covering several invoices, and inconsistent bank references.

### 1.3 The wedge

**Reconciliation that understands South African bank statements.** Invoicing is table stakes (Xero, Sage, Zoho and QuickBooks already exist). The differentiator is the import-normalise-match pipeline for SA bank statement formats (FNB, Standard Bank, Capitec, Nedbank, and others), with a confidence-scored review queue.

### 1.4 Fixed decisions

| Decision | Choice |
|---|---|
| Frontend | Angular (latest version) |
| Backend | NestJS (latest version) |
| ORM | Prisma (latest version) |
| Database | PostgreSQL (latest version) |
| Tenancy | Multi-tenant from day one, shared database with `tenant_id` |
| Positioning | CV showcase first, SA-reconciliation angle as the SaaS wedge |
| Containers | **Not using Docker.** Run PostgreSQL and Redis locally, or use managed free-tier instances |
| Versions | Always use the latest stable release of every framework and tool at project start; record them in the [Version Log](#12-version-log) |

---

## 2. Goals and Success Criteria

### 2.1 Goals

- Demonstrate correctness-critical code: transactions, idempotency, rounding, audit trails.
- Demonstrate production concerns: auth with RBAC, multi-tenancy, background jobs, file handling, PDF generation, CI/CD, tests, API docs.
- Ship a deployed, working product with a clear README and architecture diagram.
- Deliver within roughly **6 weeks** of focused effort.

### 2.2 Success criteria

- [ ] Live deployed URL with demo data
- [ ] Tenant isolation enforced at application level **and** database level (Postgres RLS)
- [ ] Statement import is idempotent (re-upload creates zero duplicates)
- [ ] Measured auto-match rate reported on a realistic seeded dataset
- [ ] Automated tests cover the matching engine and money handling edge cases
- [ ] CI pipeline green; Swagger/OpenAPI published
- [ ] README with architecture diagram, setup steps and screenshots
- [ ] CV bullets written with real numbers

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular (standalone components, signals), Angular Router, a UI library of your choice, Chart library for dashboard |
| Backend | NestJS, class-validator / class-transformer (or Zod), Passport/JWT |
| Database | PostgreSQL with Row-Level Security |
| ORM | Prisma (with a client extension or transaction wrapper to set the tenant context) |
| Jobs / Queue | Redis + BullMQ |
| PDF | A server-side PDF library (e.g. Puppeteer or PDFKit) |
| Email | Transactional email provider (Ethereal or Mailtrap in dev) |
| Files | Local disk in dev, S3-compatible storage in production |
| Testing | Jest (unit/integration), Supertest (API), Playwright or Cypress (E2E) |
| DevOps | GitHub Actions CI/CD; deployment to a PaaS or a VPS with a process manager (no containers) |
| Docs | Swagger/OpenAPI, architecture diagram (Mermaid) |
| Repo | Monorepo (Nx or pnpm workspaces) |

---

## 4. Architecture

### 4.1 Repository layout

```
/
├── apps/
│   ├── api/          # NestJS application
│   └── web/          # Angular application
├── libs/
│   └── shared/       # Shared DTOs, types, constants
├── prisma/           # schema.prisma, migrations, seed
├── scripts/          # Local setup and deployment scripts
├── docs/             # Architecture diagram, ADRs, screenshots
└── README.md
```

### 4.2 NestJS modules

| Module | Responsibility |
|---|---|
| `auth` | Login, JWT + refresh tokens, guards |
| `tenants` | Organisations, memberships, roles (owner, accountant, viewer) |
| `customers` | Customer records |
| `invoices` | Invoices, lines, tax, status lifecycle, PDF generation |
| `payments` | Payments and allocations to invoices |
| `bank-accounts` | Bank accounts per tenant |
| `statements` | Upload, per-bank parsers, normalisation |
| `reconciliation` | Matching engine, review queue, matching rules |
| `notifications` | Overdue reminders by email |
| `audit` | Append-only audit log |
| `jobs` | BullMQ processors (statement processing, reminders, recurring invoices) |

### 4.3 Multi-tenancy model

- Shared database, shared schema, `tenant_id` on every tenant-owned table.
- **Layer 1 (application):** request-scoped tenant context resolved from the authenticated user's active membership; all queries scoped through one place.
- **Layer 2 (database):** Postgres RLS policies keyed on a per-transaction setting (e.g. `SET LOCAL app.tenant_id`) so a bug in application code cannot leak data across tenants.
- Tenant isolation must be covered by automated tests (attempt cross-tenant reads and writes and assert they fail).

---

## 5. Domain Model

Core tables:

`tenants`, `users`, `memberships`, `customers`, `invoices`, `invoice_lines`, `payments`, `payment_allocations`, `bank_accounts`, `statement_imports`, `bank_transactions`, `reconciliation_matches`, `matching_rules`, `audit_logs`

Key relationships:

- A **user** can belong to many **tenants** through **memberships** (with a role).
- An **invoice** belongs to a tenant and a customer, and has many **invoice lines**.
- A **payment** is allocated to one or more invoices through **payment_allocations** (many-to-many, supports partial payments and one deposit covering several invoices).
- A **statement import** belongs to a **bank account** and produces many **bank transactions**.
- A **reconciliation match** links a bank transaction to a payment/invoice with a confidence score and status (auto-applied, pending review, confirmed, rejected).

---

## 6. Engineering Rules (Non-Negotiables)

- [ ] **Money is never a float.** Store as integer cents or `NUMERIC`/Prisma `Decimal`, with currency on each record.
- [ ] **VAT is configurable** per tenant and per invoice line; never hardcoded.
- [ ] **Payment allocations** are many-to-many; partial and combined payments must work.
- [ ] **Idempotent imports:** hash each bank transaction (account, date, amount, reference, running balance where available) so re-uploads never duplicate.
- [ ] **Sequential invoice numbers per tenant**, generated inside a database transaction.
- [ ] **No hard deletes of financial records.** Void or reverse, and write an audit entry.
- [ ] **Audit log is append-only** and records who, what, when, and before/after values.
- [ ] **All money-moving operations run in transactions.**
- [ ] **Validate everything at the boundary** (DTOs) and enforce roles on every route.
- [ ] **Build against real bank CSV files**, not assumptions (see Phase 0).

---

## 7. Matching Engine Specification

Each unmatched bank transaction (credits only) is scored against open invoices:

| Rule | Signal | Confidence |
|---|---|---|
| 1. Exact reference | Invoice number found in the bank reference | High |
| 2. Amount + customer | Exact outstanding amount and a known payer name or saved rule | High |
| 3. Amount + fuzzy name | Exact amount, normalised token-based name similarity | Medium |
| 4. Sum match | One deposit equals the sum of several open invoices for the same customer | Medium (flagged) |
| 5. Partial payment | Amount below the outstanding balance | Low (always reviewed) |

Behaviour:

- Matches at or above a **configurable threshold** are auto-applied.
- Everything else goes to a **review queue** (confirm, reject, reassign).
- Users can create **matching rules** (e.g. "payments from this payer always belong to customer X").
- Normalisation: case-folding, stripping bank noise words and punctuation, token comparison.
- Every decision (auto or manual) writes an audit entry.
- Edge cases to test: duplicate amounts across customers, rounding, reversed/refunded transactions, same reference reused, overpayments.

---

## 8. Phase Plan

Each phase has **tasks**, **deliverables**, and an **exit checklist**. Do not start the next phase until the exit checklist is complete.

### Phase 0: Preparation (before Week 1)

**Tasks**
- [ ] Install the latest stable Node.js (LTS), package manager, PostgreSQL and Redis (local installs, or managed free-tier instances)
- [ ] Create the Git repository and decide branching strategy
- [ ] Export real CSV statements from two or three SA banks (redact personal details) and store them under `docs/sample-statements/` (git-ignored if sensitive)
- [ ] Write down the column names, date formats, and debit/credit conventions of each bank
- [ ] Record exact framework versions in the [Version Log](#12-version-log)

**Deliverables:** repo initialised, sample statements collected, bank format notes.

**Exit checklist**
- [ ] At least two real bank formats documented
- [ ] Tooling installed and verified

---

### Phase 1: Foundation (Week 1)

**Focus:** monorepo, infrastructure, auth, tenancy, audit.

**Tasks**
- [ ] Scaffold monorepo with `apps/api`, `apps/web`, `libs/shared`
- [ ] Local services: PostgreSQL and Redis running (local install or managed instance); dev email via Ethereal/Mailtrap
- [ ] Root scripts to start the API, web app and workers, plus a documented setup section in this README
- [ ] Prisma schema for `tenants`, `users`, `memberships`, `audit_logs`; first migration
- [ ] Auth module: register, login, JWT + refresh tokens, password hashing, guards
- [ ] Tenant context: request-scoped tenant resolution from active membership
- [ ] Role-based access control (owner, accountant, viewer)
- [ ] Postgres RLS policies on tenant-owned tables; Prisma transaction wrapper that sets `app.tenant_id`
- [ ] Audit module with append-only writes
- [ ] GitHub Actions CI: install, lint, test, build
- [ ] Angular shell: login, tenant switcher, authenticated layout, route guards

**Deliverables:** the stack runs locally with documented scripts; a user can register, log in and select a tenant.

**Exit checklist**
- [ ] A fresh clone can be set up and running by following the README setup steps
- [ ] Cross-tenant access test fails as expected (isolation proven)
- [ ] CI pipeline green
- [ ] Audit entries written for auth and tenant events

---

### Phase 2: Customers and Invoices (Week 2)

**Focus:** the core invoicing domain.

**Tasks**
- [ ] Customers CRUD (tenant-scoped, soft-archive instead of delete)
- [ ] Invoices with lines, quantity, unit price, discount, configurable VAT
- [ ] Invoice status lifecycle: draft → sent → partially paid → paid → overdue → void
- [ ] Sequential per-tenant invoice numbering in a transaction
- [ ] Decimal-safe totals calculation in a single shared function, with unit tests
- [ ] PDF generation and download
- [ ] Send invoice by email with PDF attached
- [ ] Angular: customer list/form, invoice list, invoice editor, invoice detail with status

**Deliverables:** a user can create, send, and download an invoice.

**Exit checklist**
- [ ] Totals and VAT tests pass, including rounding edge cases
- [ ] Invoice numbers never duplicate under concurrent creation (test it)
- [ ] Voiding creates an audit entry and never deletes data

---

### Phase 3: Payments and Automation (Week 3)

**Focus:** recording payments and background jobs.

**Tasks**
- [ ] Payments and **payment_allocations** (partial payments, one payment across several invoices)
- [ ] Automatic invoice status updates from allocations
- [ ] Recurring invoices via BullMQ scheduled jobs
- [ ] Overdue detection and reminder emails via jobs, with retry and failure handling
- [ ] Bank accounts module (per-tenant accounts)
- [ ] Angular: record payment, allocation UI, recurring invoice setup

**Deliverables:** manual payments work end to end; recurring invoices and reminders run in the background.

**Exit checklist**
- [ ] Over-allocation is prevented
- [ ] Jobs are idempotent (re-running never double-sends or double-creates)
- [ ] Reminder schedule configurable per tenant

---

### Phase 4: Statement Import (Week 4)

**Focus:** the SA-specific ingestion pipeline.

**Tasks**
- [ ] Upload endpoint (CSV) with file validation and size limits
- [ ] Parser interface plus one parser per bank format, with auto-detection or user selection
- [ ] Normalised `bank_transactions` shape (date, signed amount, reference, description, balance)
- [ ] Idempotent import via per-transaction hash
- [ ] Import processing as a background job with progress and error reporting
- [ ] Row-level error handling (bad rows reported, good rows imported)
- [ ] Angular: upload screen, import history, transaction list with filters

**Deliverables:** uploading the same statement twice produces zero duplicates.

**Exit checklist**
- [ ] Parsers tested against the real sample files from Phase 0
- [ ] Idempotency test passes
- [ ] Malformed file test passes without crashing the worker

---

### Phase 5: Reconciliation Engine (Week 5)

**Focus:** the showpiece.

**Tasks**
- [ ] Implement the five matching rules from [section 7](#7-matching-engine-specification)
- [ ] Confidence scoring and a configurable auto-apply threshold
- [ ] Review queue API and Angular UI (confirm, reject, reassign, split)
- [ ] Matching rules (saved payer-to-customer mappings)
- [ ] Applying a match creates a payment and allocation in one transaction
- [ ] Undo/unmatch with audit trail
- [ ] Comprehensive unit tests for every rule and edge case
- [ ] Seed script generating a realistic dataset to measure auto-match rate

**Deliverables:** statements reconcile automatically; uncertain matches land in a review queue.

**Exit checklist**
- [ ] Auto-match rate measured and recorded in the README
- [ ] All edge cases in section 7 have tests
- [ ] Every match, rejection and unmatch is audited

---

### Phase 6: Reporting, Hardening and Launch (Week 6)

**Focus:** dashboard, quality, deployment, documentation.

**Tasks**
- [ ] Dashboard: ageing report, cash received over time, unreconciled count
- [ ] Rate limiting, security headers, input sanitisation, secrets via environment variables
- [ ] Swagger/OpenAPI documentation
- [ ] E2E tests for the critical path (create invoice → import statement → reconcile)
- [ ] Production build and deployment to a single host (PaaS, or a VPS with PM2/systemd and a reverse proxy)
- [ ] Demo tenant with seeded data
- [ ] README: architecture diagram (Mermaid), setup instructions, screenshots, measured metrics
- [ ] Write architecture decision records for key choices (RLS, idempotency, matching design)

**Deliverables:** deployed, documented, demo-ready product.

**Exit checklist**
- [ ] Live URL works with the demo tenant
- [ ] CI/CD deploys on merge to main
- [ ] All items in [Definition of Done](#9-definition-of-done) are ticked

---

## 9. Definition of Done

- [ ] All six phase exit checklists complete
- [ ] Tenant isolation verified at both application and database level
- [ ] No floats used for money anywhere in the codebase
- [ ] Test suite passes in CI; matching engine and money logic have high coverage
- [ ] Swagger docs available
- [ ] Deployed and reachable
- [ ] README includes diagram, setup guide, screenshots and metrics
- [ ] CV bullets updated with final numbers

---

## 10. CV Output

Target bullets (replace placeholders with real figures once measured):

- Built a multi-tenant invoicing and bank reconciliation platform (Angular, NestJS, Prisma, PostgreSQL) with tenant isolation enforced through Postgres row-level security.
- Designed a transaction-matching engine with confidence scoring that auto-reconciles bank deposits against open invoices (**[X]%** auto-match rate on a seeded dataset), with a manual review queue for ambiguous matches.
- Implemented idempotent statement imports for South African bank formats, decimal-safe money handling, and append-only audit logging.
- Automated recurring invoices and overdue reminders with BullMQ background jobs; shipped with CI/CD and a documented API.

Also add: live URL, GitHub link, and a short architecture diagram to the portfolio.

---

## 11. Parallel Track: SaaS Validation

Separate from this build, treat the **vehicle maintenance and compliance tracker for small fleets** as the stronger standalone SaaS candidate:

- Less crowded market; recurring pain (lapsed licence discs, roadworthy certificates, driver licences).
- Natural per-vehicle monthly pricing.
- Existing familiarity with fleet operators and tracking platforms.

**Cheap validation before any code:**
- [ ] Speak to two or three small fleet operators
- [ ] Ask how they track expiries and services today, and what lapses have cost them
- [ ] Decide whether to pursue it after the invoicing project ships

---

## 12. Version Log

Record the exact versions in use at project start (use the latest stable of each).

| Tool | Version | Date recorded |
|---|---|---|
| Node.js | | |
| Angular | | |
| NestJS | | |
| Prisma | | |
| PostgreSQL | | |
| Redis | | |
| BullMQ | | |

---

## Progress Tracker

| Phase | Status | Started | Completed |
|---|---|---|---|
| 0. Preparation | ☐ | | |
| 1. Foundation | ☐ | | |
| 2. Customers and Invoices | ☐ | | |
| 3. Payments and Automation | ☐ | | |
| 4. Statement Import | ☐ | | |
| 5. Reconciliation Engine | ☐ | | |
| 6. Reporting, Hardening and Launch | ☐ | | |
