# WEWED NATIVE ROLE & CAPABILITY MATRIX

**Authority Reference:** `main` @ `2be25d724b51539f4677f2f15050e0deb873922e`  
**Purpose:** Replaces the legacy monolithic tab bar with role-specific workspaces and navigation topologies.

---

## 1. Native Workspace Topology by Role

| Role Identifier | Role Persona | Primary Tab Navigation Topology | Quick Actions / Overlays |
|---|---|---|---|
| `COUPLE` | Couple Owner | **Home** • **Plan** • **Guests** • **Pass** • **Live** | Switch to Planner View, Add Task, Share Pass |
| `PLANNER` | Professional Planner | **Portfolio** • **Plan & Tools** • **Clients** • **Messages** • **More** | Quick Client Switcher, Voice Memo, AI Architect |
| `COORDINATOR` | Day-of Coordinator | **Timeline** • **Operations** • **Gate** • **Vendors** • **Radio** | Emergency Dispatch, Broadcast Alert |
| `VENDOR` | Vendor Owner & Staff | **Jobs** • **Day-of Status** • **Catalog** • **Messages** • **Profile** | One-Tap Arrival Status, Contract Viewer |
| `USHER` | Gate Usher | **Scanner** • **Guest Search** • **Manifest Sync** • **Live Status** | Scan QR Pass, Manual Check-In, Admittance Log |
| `GUEST` | Attending Guest | **Pass** • **Timeline** • **Story/Registry** • **Live Wall** • **Help** | Add to Apple Wallet, Request Direction |
| `ADMIN` | Administrator | **Overview** • **Accounts** • **System Health** • **Audit Log** • **Settings** | Emergency Mode, Security Lockout |

---

## 2. Capability Matrix Across Roles

| Capability Area | Couple | Planner | Coordinator | Vendor | Usher | Guest | Admin |
|---|---|---|---|---|---|---|---|
| **Identity & Persona Switch** | Full | Full | Full | Full | Full | Full | Full |
| **Wedding Context Switch** | Read-Only | Full Multi | Assigned | Assigned | Assigned | Single | Full All |
| **Tasks Management** | Edit | Full Edit | Read-Only | None | None | None | Audit |
| **Budget & Honeyfund** | Full | Full | None | None | None | Contribute | Audit |
| **Vendor Operations** | Review | Full | Status Sync | Update Self | None | None | Audit |
| **Run of Show Timeline** | Full | Full Edit | Full Edit | View Shift | View Times | View Public | Audit |
| **Seating Chart** | Full | Full Edit | View All | View Table | View Seat | View Own | Audit |
| **Guest Roster & RSVP** | Full | Full Edit | View Roster | None | Admittance | None | Audit |
| **Wedding Pass Display** | View Own | View Demo | View Demo | View Pass | None | View Own | None |
| **Gate Check-In & Scanner** | Demo View | Demo View | Full Scan | None | Full Scan | None | Audit |
| **Live Wall Interactivity** | Full | Full Post | Broadcast | View | View | Full | Moderate |
| **Contract Governance** | Sign/View | Draft/Vault | None | Sign/View | None | None | Audit |
| **Notebook & Voice Memos** | Shared | Full Private | Operational | None | None | None | None |
| **AI Architect Workspace** | Assisted | Full Engine | None | None | None | None | None |
| **Vendor Catalog & Quotes** | Browse | Quote/Book | None | Full Manage | None | None | Audit |
| **Inbound Bookings** | None | Pipeline | None | Pipeline | None | None | Audit |
| **Messages / Shared Inbox** | Direct | Direct | Team Radio | Direct | Dispatch | None | Audit |
| **Administrative Controls** | None | None | None | None | None | None | Full |

---

## 3. Role selection (superseded 2026-09-19)

The development persona selector has been removed. People no longer pick a role. The account's
authorized grants decide the experience. A single-role account enters directly; a multi-role account
chooses among only its own roles. UAT sign-in uses the `wewed_shadow_account` launch argument.
Test-only overlays are labelled on screen as test access.

The authoritative capability matrix and shell definitions are in
**NATIVE_ROLE_ARCHITECTURE_P0_2026-09-19.md**. Where this document disagrees, that document wins.
