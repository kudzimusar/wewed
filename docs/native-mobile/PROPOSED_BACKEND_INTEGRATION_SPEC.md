# Wewed Mobile — Proposed Backend Integration Specification

**Plan ID:** `WW-NATIVE-MOBILE-IOS-ANDROID-2026-09-17-01`  
**Governing Rule:** Mandatory Isolation. DO NOT apply to production database or Next.js routes during mobile development.

---

## 1. Overview

During the implementation of the Wewed dual-native mobile clients (iOS Swift/SwiftUI and Android Kotlin/Jetpack Compose), several capabilities were identified to support the **Wewed Wedding Pass & Wedding Day System**.

In accordance with Section 9 of the Isolation Mandate, these capabilities have been **fully mocked in `mobile/fixtures/mock-wedding-data.json` and implemented in the native clients' `FixtureWeddingRepository`**. 

They are documented here for execution during the future, approved **Milestone B (Production Integration)**.

---

## 2. Proposed Database Schema Extensions (Prisma / Supabase)

### A. Household Model
Support multi-guest groups, families, and named +1s under a single pass or individual passes:
```prisma
model Household {
  id             String        @id @default(cuid())
  name           String        // e.g. "Musarurwa Household"
  weddingId      String
  wedding        Wedding       @relation(fields: [weddingId], references: [id])
  primaryGuestId String
  guests         Guest[]
  passes         WeddingPass[]
  createdAt      DateTime      @default(now())
}
```

### B. WeddingPass Model
Store pass metadata, stage, and registered Apple/Google push tokens without coupling to third-party services:
```prisma
model WeddingPass {
  id                String      @id @default(cuid())
  serialNumber      String      @unique @default(cuid())
  authSecret        String
  currentStage      String      @default("INVITATION")
  appleDeviceCount  Int         @default(0)
  googleWalletSaved Boolean     @default(false)
  guestId           String?     @unique
  guest             Guest?      @relation(fields: [guestId], references: [id])
  householdId       String?
  household         Household?  @relation(fields: [householdId], references: [id])
  qrPayload         String      @unique
  lastPushedAt      DateTime?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
}
```

### C. CheckInRecord Model
Audit log for scans with offline sync reconciliation:
```prisma
model CheckInRecord {
  id                 String       @id @default(cuid())
  guestId            String
  guest              Guest        @relation(fields: [guestId], references: [id])
  eventId            String?
  checkedInByUserId  String
  deviceIdentifier   String
  checkedInCount     Int          @default(1)
  scannedAt          DateTime
  syncedAt           DateTime     @default(now())
  isOfflineSync      Boolean      @default(false)

  @@index([guestId])
}
```

---

## 3. Proposed New API Endpoints

1. `GET /api/pass/:token`: Resolves zero-auth guest pass view (<50KB payload).
2. `POST /api/checkin/verify`: Validates HMAC QR payload and records attendance.
3. `POST /api/checkin/sync-batch`: Flushes offline check-in queue upon network reconnection.
4. `GET /api/checkin/manifest/:weddingId`: Downloads AES-GCM encrypted guest manifest for ushers.

---

## 4. Regression & Migration Risk Assessment

* **Zero Breaking Changes:** All proposed additions are additive. Existing fields on `Guest` and `RSVP` remain unchanged.
* **Rollout Strategy:** When Milestone B is authorized, run Prisma migration `add_wedding_pass_system` on staging first, run end-to-end qualification, and only then deploy to production.
