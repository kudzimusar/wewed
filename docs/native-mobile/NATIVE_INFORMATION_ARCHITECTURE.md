# WEWED NATIVE INFORMATION ARCHITECTURE & NAVIGATION

**Authority Baseline:** `main` @ `2be25d724b51539f4677f2f15050e0deb873922e`  
**Purpose:** Formal specification of route hierarchies, navigation models, and deep-link schemes across iOS SwiftUI and Android Jetpack Compose.

---

## 1. Top-Level Role Shells

Rather than a static 5-tab bar for all users, the root application shell resolves the active authenticated role and mounts the corresponding native container:

```text
RootShell
 ├── AuthFlow (Unauthenticated)
 │    ├── SignInScreen
 │    ├── RegisterScreen
 │    ├── ForgotPasswordScreen
 │    └── PersonaPicker (Developer / E2E Switcher)
 │
 ├── CoupleShell (Role: COUPLE)
 │    ├── HomeTab (Countdown, Quick Actions, Active Story)
 │    ├── PlanTab (Core Modules Grid, Next Priority Task, Tools List)
 │    ├── GuestsTab (Household List, Dietary, RSVP Summary)
 │    ├── PassTab (ECDSA WW2 QR Pass, Wallet Prompt, Gate Mode Demo)
 │    └── LiveTab (Live Wall, Well Wishes, Media Feed)
 │
 ├── PlannerShell (Role: PLANNER)
 │    ├── PortfolioTab (Multi-Wedding Registry, Progress, Quick Switch)
 │    ├── WorkspaceTab (Tasks, Budget, Seating, Timeline, Contracts, AI Architect)
 │    ├── InquiriesTab (Bookings Pipeline, Consultations, Quotes)
 │    ├── NotebookTab (Field Notes, Audio Recording & Local Transcripts)
 │    └── MoreTab (Marketplace Listing, Vault, Settings, Persona Switch)
 │
 ├── CoordinatorShell (Role: COORDINATOR)
 │    ├── TimelineTab (Live Run of Show with Real-Time Clocks)
 │    ├── OperationsTab (Ground Operations, Vendor Dispatch, Incident Log)
 │    ├── GateTab (Direct Gate Scanner Launch, Live Admittance Counter)
 │    └── RadioTab (Channel Broadcasts, Direct Line to Couple & Venue)
 │
 ├── VendorShell (Role: VENDOR)
 │    ├── ScheduleTab (Assigned Weddings, Delivery & Call Times)
 │    ├── JobDayTab (Current Event Presence State: En Route -> Arrived -> Active)
 │    ├── CatalogTab (Packages, Add-ons, Pricing Tiers)
 │    └── DocumentsTab (Executed Contracts, COI / Insurance, Invoices)
 │
 ├── UsherShell (Role: USHER)
 │    ├── ScannerTab (High-Speed Camera Barcode Reader + Fallback Simulator)
 │    ├── RosterTab (Searchable Guest & Household Manifest with Table Numbers)
 │    ├── SyncTab (Offline Manifest Status, Cryptographic Key Ring, Unsynced Logs)
 │    └── MetricsTab (Gate Admittance Rates, Remaining Capacity)
 │
 ├── GuestShell (Role: GUEST)
 │    ├── PassTab (High-Fidelity Wedding Pass, Table Number, Seat Assignment)
 │    ├── ScheduleTab (Public Event Timeline, Venue Directions, Attire Brief)
 │    ├── RegistryTab (Honeyfund, Gift Contributions, Message to Couple)
 │    └── LiveTab (Upload Guest Photos, Send Well Wishes)
 │
 └── AdminShell (Role: ADMIN)
      ├── StatusTab (System Health, Offline Sync Queue, Error Rates)
      ├── WeddingsTab (All Active Weddings, Emergency Freeze Controls)
      ├── PlannersTab (Marketplace Approvals, Verification Badges)
      └── AuditTab (Global Check-In Security Audit Log)
```

---

## 2. Core Screen State Standards

To ensure production-grade UX parity, every primary native screen must implement deterministic state handling derived from local fixtures:

1. **Populated State:** Realistic fixture entities with valid formatting, currency tokens, and timestamps.
2. **Empty State:** Clean, contextual empty prompt with actionable primary CTA (e.g. "Create First Task", "No Inbound Inquiries").
3. **Loading State:** Skeleton loaders or shimmer placeholders matching design token geometry.
4. **Error State:** Human-readable error banner with retry mechanism.
5. **Offline State:** Visual badge indicating cached local manifest or queueing actions for sync.
6. **Attention State:** Prominent warning indicators for urgent items (e.g., overdue tasks, capacity violations).
7. **Read-Only vs Editable States:** Appropriate affordances based on role permissions.

---

## 3. Deep-Link Routing Specification

Universal links and custom scheme (`wewed://`) routes:

| URL Pattern | Target Destination | Handling Persona / Role |
|---|---|---|
| `wewed://today` | Couple Home Dashboard | Couple, Planner |
| `wewed://plan/tasks` | Tasks Checklist | Couple, Planner |
| `wewed://plan/budget` | Budget Allocations | Couple, Planner |
| `wewed://plan/timeline` | Run of Show Timeline | All Roles |
| `wewed://pass/{token}` | Wedding Pass Credential | Guest, Couple |
| `wewed://scan` | Gate Scanner Modal | Usher, Coordinator |
| `wewed://invite/{slug}` | Ivory Floral Invitation | Guest (Resolves Pass) |
| `wewed://vendor/job` | Vendor Day-of Operations | Vendor Owner, Staff |
| `wewed://portfolio` | Planner Multi-Wedding Dashboard | Planner |

