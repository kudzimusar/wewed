# NM05M1 — Moderator Wedding Pass Containment Closure Receipt

## Context

LNM 01 independently certified the NM05 iOS Guest experience at:

`native-mobile/phase13-ios-ui-overflow-closure-nm05-agent-20260925`

SHA:

`baf92c05c96764b6a67d5751cda6ac825a6107a5`

Seven of the eight requested iOS surfaces passed. The sole visual failure was the canonical Wedding Pass (`IOS-PASS-01`): the Pass card contents were shifted to the right and clipped at the card edge.

This is a moderator closure patch after independent LNM evidence. It does not reopen the already-passed Home, RSVP, Couple Note, Invitation Closed, Invitation Details, Wedding Day or More surfaces.

## Root cause review

Independent source review confirmed `WeddingReferencePassView.passCard` still placed:

`WewedMediaImage(WewedAsset.ornamentFrame).scaledToFill()`

as a sizing sibling inside the root Pass-card `ZStack`.

Because the ornament is resizable and fill-scaled without a concrete frame, it can participate in the ZStack's layout proposal. The card later clips to a rounded rectangle, which can hide the oversize pixels while leaving the visible content horizontally displaced.

The canonical Pass is now changed so:

1. the actual Pass content `VStack` is the card's sizing authority;
2. that content is explicitly bounded with `.frame(maxWidth: .infinity)`;
3. the ornament is rendered in a background `GeometryReader` only after the final card width and height are known;
4. the ornament receives the exact measured card frame and is clipped there;
5. dynamic couple/guest/venue/table/date text is given centered multiline/compression behavior so long authoritative values cannot become a new width owner;
6. the canonical `WeddingQRCodeView`, WW2 payload, Pass authority and interaction model are unchanged.

## Branch

Base:

`native-mobile/phase13-ios-ui-overflow-closure-nm05-agent-20260925`

Base SHA:

`baf92c05c96764b6a67d5751cda6ac825a6107a5`

Moderator closure branch:

`native-mobile/phase13-ios-pass-card-closure-nm05m1-20260926`

Product patch commits:

- `80e6eeaf222cd72051cb90f13e7543414c34a3f8` — contain canonical Wedding Pass ornament and dynamic text
- `dce16f21cca8413d1899c527b37be71cdb6fafee` — add Pass-card responsive regression contract

Qualified implementation commit with temporary workflow:

`be9816e108f6e25505c2f26fcbcf7b96bfd6b454`

Qualification:

- GitHub Actions run: `36211013691`
- job: `108317359399`
- Swift tests: 468 executed, 14 skipped, 0 failures
- Swift build: PASS
- XcodeGen: PASS
- iOS simulator application build: `** BUILD SUCCEEDED **`

The temporary qualification workflow was removed after the successful run.

## Permanent source delta

Only:

- `apps/ios/Wewed/Views/Pass/WeddingReferencePassView.swift`
- `apps/ios/Wewed/Tests/GuestResponsiveRootClosureTests.swift`
- this receipt

No Guest Session authority, RSVP authority, WW2 authority, QR generation authority, backend, Android, database or production state changed.

## Next gate

LNM 01 must perform a narrow independent iOS Pass-card visual regression against the final branch tip.

The rerun must prove:

- couple title is fully visible;
- guest name is fully visible;
- table assignment is fully visible;
- date is fully visible;
- `View Guest Details` is fully visible;
- C&K monogram is fully visible;
- QR is centered with safe left/right margins;
- entire Pass card remains inside the 393 pt iPhone viewport;
- native TabView remains above the home indicator;
- canonical `WeddingReferencePassView` and WW2 QR authority remain unchanged.

One additional Home screenshot is required as a shell regression sentinel. Full eight-screen repetition is not required because LNM 01 already passed the other seven NM05 surfaces and the moderator patch is isolated to the Pass renderer plus a source regression test.

Phase 13 remains open until LNM independently passes this closure and the later release-mode live production-data/PWA parity gate succeeds.
