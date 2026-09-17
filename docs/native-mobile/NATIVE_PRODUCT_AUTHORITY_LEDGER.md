# WEWED NATIVE PRODUCT AUTHORITY LEDGER

**Authority Baseline (Production Reference):** `main` @ `2be25d724b51539f4677f2f15050e0deb873922e`  
**Pure Native Checkpoint:** `reconcile/native-mobile-pure-20260917` @ `db910641857354477cdf82980f5f91524f5059b3`  
**Current Active Branch:** `native-mobile/whole-product-shell-20260917`  
**Sprint Governance:** Isolated Dual-Native Whole-Product Application Shell Directive  

---

## 1. Status Vocabulary Standard

Each capability is rigorously audited and tagged with exactly one of the authoritative lifecycle states:
- `DISCOVERED`: Route, database entity, or feature surfaced in production audit; not yet represented in native shell.
- `SHELL-MISSING`: Scoped for native execution, but native view/navigation destination does not yet exist.
- `SHELL-PRESENT`: Native destination exists and is navigable in the role workspace, with UI layout matching tokens.
- `FIXTURE-BEHAVIOR`: Native destination is backed by rich, deterministic local domain fixtures (all states: populated, empty, loading, error, offline, attention, read-only, editable). Zero production networking.
- `CONTRACT-READY`: Canonical OpenAPI/interface schema defined and aligned between production models and native clients.
- `DATA-WIRED`: Native domain repository interfaces connected to local storage or mocked gateway.
- `NATIVE-TESTED`: Unit and integration test suites on iOS (Swift XCTest) and Android (Kotlin JUnit) compile and pass.
- `E2E-QUALIFIED`: Maestro deterministic automated E2E journey traverses and asserts surface behavior.
- `PARITY-PASS`: Fully qualified on dual-native platforms matching production functional capability.
- `WEB-PRIMARY`: Intentionally scoped as web-primary or deferred desktop administrative surface.
- `NOT-MOBILE-SCOPED`: Non-mobile operational utilities, internal webhooks, developer cron jobs, or database migration scripts.
- `BLOCKED-DEPENDENCY`: Implementation strictly blocked by external dependency or unintegrated backend contract.

---

## 2. Whole-Product Capability Ledger

| Family ID | Capability Name | Production Route (`main`) | Native Role Scope | Current Native Status | Target Shell Status | Notes / Rationale |
|---|---|---|---|---|---|---|
| **AUTH-01** | Session & Auth Entry | `/sign-in`, `/register`, `/forgot-password`, `/reset-password` | All Roles | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Switchable deterministic persona picker for developer validation. |
| **AUTH-02** | Account Deletion & Privacy | `/account-deletion`, `/couple/privacy`, `/privacy` | Couple, Guest, Vendor | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | GDPR/Apple App Store mandatory account erasure request surface. |
| **WEDD-01** | Wedding & Business Context Switcher | Root Context / Header | Couple, Planner, Vendor, Admin | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Multi-wedding switcher for planners and vendor businesses. |
| **HOME-01** | Home / Today Dashboard | `/today`, `/` | Couple, Guest, Planner | `E2E-QUALIFIED` | `PARITY-PASS` | Couple overview, countdown, hero banner, quick actions. |
| **PLAN-01** | Tasks Checklist & Priority Engine | `/planner/tasks` | Couple, Planner | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Task filters (To Do, In Progress, Done), priorities (Low to Urgent). |
| **PLAN-02** | Budget Allocations & Payments | `/planner/budget`, `/planner/budget/funding` | Couple, Planner | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Budget categories, allocation progress, paid balances. |
| **PLAN-03** | Guest Contributions & Honeyfund | `/planner/contributions`, `/contribute` | Couple, Guest, Planner | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Gift registry campaigns, community contributions, funding progress. |
| **PLAN-04** | Vendor Directory & Onboarding | `/planner/vendors`, `/vendors` | Couple, Planner | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Contracted vendors, assigned zones, day-of operational presence. |
| **PLAN-05** | Marketplace Directory & Search | `/planner/marketplace`, `/planners`, `/vendors` | Couple, Planner, Vendor | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Provider listing directory, filter by category and location. |
| **PLAN-06** | Guest List Roster & Dietary Roster | `/planner/guests`, Root Guests Tab | Couple, Planner, Usher | `E2E-QUALIFIED` | `PARITY-PASS` | Household party tracking, RSVP status, dietary flags. |
| **PLAN-07** | Seating Chart & Table Allocations | `/planner/seating` | Couple, Planner | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Visual table breakdown, table capacities, seated headcounts. |
| **PLAN-08** | Run of Show Timeline & Schedule | `/planner/timeline` | Couple, Planner, Vendor, Usher | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Chronological programme milestones, location anchors, details. |
| **PLAN-09** | Digital & Physical Invitations / RSVP | `/invite/[slug]/open`, `/couple/invitations` | Couple, Guest, Planner | `NATIVE-TESTED` | `PARITY-PASS` | Ivory card presentation, physical pass barcode sync, RSVP confirmation. |
| **PASS-01** | Wedding Pass Credential View | `/w/[slug]`, Pass Tab | Guest, Couple | `E2E-QUALIFIED` | `PARITY-PASS` | Asymmetric ECDSA P-256 (WW2) cryptographic gate credential. |
| **GATE-01** | Gate Scanner & Offline Usher Check-In | Pass Tab / Scanner Sheet | Usher, Coordinator | `E2E-QUALIFIED` | `PARITY-PASS` | ECDSA offline signature validation, party capacity control, audit log. |
| **OPER-01** | Day-of Event Operations Dispatch | `/planner/event-day`, `/admin/client-operations` | Planner, Coordinator, Usher | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Real-time radio channels, vendor transit monitoring, alerts. |
| **VEND-01** | Vendor Job Day Presence & Schedule | `/vendor`, `/vendor/availability` | Vendor Owner, Staff | `NATIVE-TESTED` | `PARITY-PASS` | Transition vendor state: Scheduled -> En Route -> Arrived -> Active. |
| **BOOK-01** | Inbound Inquiries & Consultations | `/planner/bookings`, `/vendor/bookings` | Planner, Vendor | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Inbound booking pipeline, discovery calls, consultation schedule. |
| **CONT-01** | Contract Governance & Vault | `/planner/contracts/[id]/governance`, `/contracts/review/[token]` | Couple, Planner, Vendor | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Executed service agreements, retainer escrow, legal clauses. |
| **CONT-02** | Contract Intelligence & Risk Audit | `/planner/contract-intelligence` | Planner, Admin | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | AI-assisted clause review, overtime warnings, SLA auditing. |
| **COMM-01** | Messages & Dynamic Shared Inbox | `/messages`, `/messages/settings` | All Roles | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Real-time couple-planner-vendor communication threads. |
| **COMM-02** | Notifications Center & Preferences | `/notifications`, `/settings/notifications` | All Roles | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | System reminders, RSVP alerts, vendor check-in notifications. |
| **CALN-01** | Master Calendar & Availability | `/calendar` | Couple, Planner, Vendor | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Schedule of tastings, fittings, walkthroughs, event dates. |
| **VAUL-01** | Media Archive & Document Vault | `/vault`, `/planner/media-archive` | Couple, Planner | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | High-res floorplans, CAD vectors, executed PDFs, media assets. |
| **LIVE-01** | Live Wall & Celebratory Interactivity | Root Live Tab | All Roles | `E2E-QUALIFIED` | `PARITY-PASS` | Guest well-wishes, applause, photo stream, live announcements. |
| **AI-01** | Wewed AI Architect Workspace | `/planner/ai-workspace`, `/wedding-architect/plan` | Couple, Planner | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Automated timeline simulation, conflict resolution, budget audit. |
| **NOTE-01** | Notebook & Audio Memos | `/planner/notebook`, `/planner/notebook/manage` | Planner, Couple | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Voice memo recordings, local transcription, quick field notes. |
| **BRIE-01** | Wedding Brief & Aesthetic Directive | `/planner/wedding-brief` | Couple, Planner, Vendor | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Color palettes, floral moodboard, lighting, dress code rules. |
| **SETT-01** | Settings & Profile Management | `/settings` | All Roles | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Profile details, security, language, theme preferences. |
| **BILL-01** | Billing & Subscriptions | `/billing`, `/pricing` | Planner, Vendor, Admin | `WEB-PRIMARY` | `WEB-PRIMARY` | Stripe billing portal, tier upgrades. Handled via web deep-link. |
| **PORT-01** | Planner Multi-Wedding Portfolio | `/planner/portfolio` | Planner | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Pipeline of active client engagements and production stages. |
| **VBIZ-01** | Vendor Catalog & Document Management | `/vendor/catalog`, `/vendor/documents` | Vendor Owner | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Services list, pricing sheets, business licenses, insurance. |
| **ADMN-01** | Admin Operations & Governance | `/admin/**` | Administrator | `FIXTURE-BEHAVIOR` | `PARITY-PASS` | Mobile administrative inspection, account locks, system status. |

