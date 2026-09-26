# Shadow Real-Wedding Discovery Report

**Plan:** WW-NATIVE-SHADOW-REAL-WEDDING-PARITY-2026-09-18-01  
**Reference scenario:** Charity & Kudzie / Eleven Eleven Testing  
**Production access mode:** READ-ONLY ONLY

> This template is for the first authorized production discovery pass. Do not guess identifiers from chat. Populate them only from authoritative production records.

## 1. Repository Gate 0

- Local branch:
- Local HEAD:
- Remote HEAD:
- Divergence:
- Worktree:
- Production main SHA:
- Protected active workspace touched: NO / STOP

## 2. Production safety

- Read-only credential/path used:
- Mechanism proving read-only:
- Production writes performed: NO / STOP
- External side effects triggered: NO / STOP

## 3. Authoritative identity graph

- Wedding/project ID:
- Wedding slug/domain:
- Couple membership IDs:
- Planner account/profile ID:
- Eleven Eleven Testing organization/profile ID:
- Planner membership/permission role:
- Wedding lifecycle:
- Wedding date:
- Venue:
- Currency/timezone:

## 4. Domain inventory

| Domain | Count | Available | Sensitive | Notes |
|---|---:|---|---|---|
| Tasks | | | | |
| Budget items | | | | |
| Contributions | | | | |
| Vendors | | | | |
| Service engagements | | | | |
| Guests | | | | |
| Households | | | | |
| Tables | | | | |
| Seating assignments | | | | |
| Timeline items | | | | |
| Invitations | | | | |
| Bookings | | | | |
| Contracts | | | | |
| Messages/threads | | | | |
| Announcements | | | | |

## 5. Relationship findings

Document the real relationship graph:

    Wedding
      -> Tasks
      -> Budget <-> Contributions <-> Vendors
      -> Guests <-> Households <-> Seating
      -> Timeline <-> Vendors
      -> Invitations -> RSVP -> Pass eligibility
      -> Wedding Day attendance

Record any production relationship that differs from this expected model.

## 6. Privacy classification

- Class A operational structure:
- Class B personal data:
- Class C financial/business data:
- Class D secrets excluded:
- Class E private content:
- Data that must not enter Git:

## 7. Snapshot feasibility

- Proposed extraction boundary:
- Proposed export mechanism:
- Tables/API families required:
- Domains deliberately excluded:
- Expected row counts:
- Required pseudonymization:
- Attachments/documents policy:
- Secret scan method:
- Checksum method:

## 8. Product findings for native UI

- Couple Home changes indicated by real data:
- Planner Overview changes:
- Missing Planner modules:
- Guest/Seating relationship issues:
- Vendor/Booking issues:
- Invitation/RSVP issues:
- Wedding Day/Pass implications:

## 9. Blockers / ambiguities

1.
2.
3.

## 10. Gate decision

- Phase 1 discovery: PASS / FAIL
- Safe to design snapshot: YES / NO
- Next exact task:
