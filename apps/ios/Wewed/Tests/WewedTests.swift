import XCTest
@testable import WewedKit

final class WewedTests: XCTestCase {
    func testTokenParsingValidFormat() {
        let token = "WW1.wedts26.WWJD0824.0e.66f001ab.3f9a7c2b4d1e809f"
        let result = TokenVerifier.parse(token: token)

        switch result {
        case .success(let parsed):
            XCTAssertEqual(parsed.version, "WW1")
            XCTAssertEqual(parsed.weddingShortId, "wedts26")
            XCTAssertEqual(parsed.passSerial, "WWJD0824")
            XCTAssertEqual(parsed.eventBitmask, 0x0E)
            XCTAssertEqual(parsed.nonce, "66f001ab")
            XCTAssertEqual(parsed.signature, "3f9a7c2b4d1e809f")
        case .failure(let error):
            XCTFail("Failed to parse valid token: \(error)")
        }
    }

    func testTokenParsingInvalidFormat() {
        let invalidToken = "WW1.too.short"
        let result = TokenVerifier.parse(token: invalidToken)
        XCTAssertEqual(result, .failure(.invalidFormat))
    }

    func testTokenVerificationUnauthorizedEvent() {
        let token = "WW1.wedts26.WWJD0824.02.66f001ab.3f9a7c2b4d1e809f" // Only bit 0x02
        let result = TokenVerifier.verify(token: token, secretKey: "secret", requiredEventBit: 0x04) // Requires bit 0x04
        XCTAssertEqual(result, .failure(.unauthorizedEvent))
    }

    func testFixtureRepositoryLifecycle() async throws {
        let repo = FixtureWeddingRepository()

        // 1. Get Wedding
        let wedding = try await repo.getWedding()
        XCTAssertEqual(wedding.coupleNames, "Tariro & Shadreck")
        XCTAssertEqual(wedding.programme.count, 5)

        // 2. Tasks
        let initialTasks = try await repo.getTasks()
        XCTAssertEqual(initialTasks.count, 5)

        let createdTask = try await repo.createTask(title: "Test Task", priority: .high, category: "Test")
        XCTAssertEqual(createdTask.status, .todo)

        let toggled = try await repo.toggleTask(taskId: createdTask.id)
        XCTAssertEqual(toggled.status, .done)

        // 3. Guests
        let guests = try await repo.getGuests()
        XCTAssertEqual(guests.count, 4)

        // 4. Search
        let searchRes = try await repo.searchGuests(query: "Musarurwa")
        XCTAssertEqual(searchRes.count, 1)
        XCTAssertEqual(searchRes.first?.householdName, "Musarurwa Household")
    }

    func testGateCheckInFullParty() async throws {
        let repo = FixtureWeddingRepository()
        let tokenJane = "WW1.wedts26.WWJD0824.0e.66f001ab.3f9a7c2b4d1e809f"

        // Admit entire party of 2
        let res = try await repo.checkInGuest(qrPayload: tokenJane, count: 2, usherId: "gate_usher_1")
        XCTAssertEqual(res.status, .validPass)
        XCTAssertEqual(res.guestName, "Jane & Michael Doe")
        XCTAssertEqual(res.partySize, 2)
        XCTAssertEqual(res.alreadyCheckedInCount, 2)
        XCTAssertEqual(res.remainingCount, 0)
        XCTAssertEqual(res.tableNumber, 8)

        // Duplicate scan rejection
        let dupRes = try await repo.checkInGuest(qrPayload: tokenJane, count: 1, usherId: "gate_usher_1")
        XCTAssertEqual(dupRes.status, .alreadyCheckedIn)
        XCTAssertEqual(dupRes.remainingCount, 0)
    }

    func testGateCheckInPartialHouseholdAndCapacityLimits() async throws {
        let repo = FixtureWeddingRepository()
        let tokenMusarurwa = "WW1.wedts26.WWMF0104.0e.77a002bc.5a8c9e1f2b3d4e6a"

        // Step 1: Partial arrival of 2 out of 4
        let step1 = try await repo.checkInGuest(qrPayload: tokenMusarurwa, count: 2, usherId: "usher_north")
        XCTAssertEqual(step1.status, .partialCheckedIn)
        XCTAssertEqual(step1.partySize, 4)
        XCTAssertEqual(step1.alreadyCheckedInCount, 2)
        XCTAssertEqual(step1.remainingCount, 2)

        // Step 2: Over-capacity check-in attempt (trying to admit 3 when only 2 remain)
        let step2 = try await repo.checkInGuest(qrPayload: tokenMusarurwa, count: 3, usherId: "usher_north")
        XCTAssertEqual(step2.status, .capacityExceeded)
        XCTAssertEqual(step2.remainingCount, 2)

        // Step 3: Second partial arrival (remaining 2 arrive)
        let step3 = try await repo.checkInGuest(qrPayload: tokenMusarurwa, count: 2, usherId: "usher_north")
        XCTAssertEqual(step3.status, .validPass)
        XCTAssertEqual(step3.partySize, 4)
        XCTAssertEqual(step3.alreadyCheckedInCount, 4)
        XCTAssertEqual(step3.remainingCount, 0)

        // Step 4: Subsequent scan after household is full
        let step4 = try await repo.checkInGuest(qrPayload: tokenMusarurwa, count: 1, usherId: "usher_north")
        XCTAssertEqual(step4.status, .alreadyCheckedIn)

        // Verify local gate audit records were persisted
        let audit = try await repo.getAuditRecords()
        XCTAssertEqual(audit.count, 2) // step1 (2) and step3 (2) were successful admissions
        XCTAssertEqual(audit[0].countAdmitted, 2)
        XCTAssertEqual(audit[0].passSerial, "WWMF0104")
        XCTAssertEqual(audit[1].countAdmitted, 2)
    }

    func testGateCheckInInvalidPass() async throws {
        let repo = FixtureWeddingRepository()
        let fakeToken = "WW1.wedts26.FAKE9999.0e.00000000.signature"
        let res = try await repo.checkInGuest(qrPayload: fakeToken, count: 1, usherId: "usher_gate")
        XCTAssertEqual(res.status, .invalidPass)
        XCTAssertEqual(res.guestName, "Unknown Guest")
    }

    func testSessionHoldsOnlyGrantedRoles() {
        let session = SessionStore()
        XCTAssertFalse(session.isAuthenticated)

        let couple = RoleGrant(role: .couple, weddingId: "w1", weddingTitle: "A & B", provenance: .sanitizedFixture, provenanceNote: "owner")
        session.establish(AuthorizedSession(accountId: "couple:w1", displayName: "A & B", grants: [couple]))
        XCTAssertTrue(session.isAuthenticated)
        // A single role is entered directly.
        XCTAssertEqual(session.activeGrant?.role, .couple)
        // A role the account does not hold can never be activated.
        XCTAssertFalse(session.activate(.admin))
        XCTAssertFalse(session.activate(.planner))
        XCTAssertEqual(session.activeGrant?.role, .couple)

        session.signOut()
        XCTAssertFalse(session.isAuthenticated)
        XCTAssertNil(session.activeGrant)
    }

    func testMultiRoleSessionWaitsForChoiceAndSwitchesOnlyAmongGrants() {
        let session = SessionStore()
        let couple = RoleGrant(role: .couple, weddingId: "w1", weddingTitle: "A & B", provenance: .sanitizedFixture, provenanceNote: "owner")
        let planner = RoleGrant(role: .planner, weddingId: "w1", weddingTitle: "A & B", provenance: .shadowTestOverlay, provenanceNote: "overlay")
        session.establish(AuthorizedSession(accountId: "cp:w1", displayName: "A & B", grants: [couple, planner]))
        XCTAssertNil(session.activeGrant, "Multi-role accounts choose explicitly")
        XCTAssertTrue(session.activate(.planner))
        XCTAssertEqual(session.activeGrant?.role, .planner)
        session.clearActiveRole()
        XCTAssertNil(session.activeGrant)
        XCTAssertTrue(session.activate(.couple))
        XCTAssertFalse(session.activate(.guest))
    }

    func testBudgetCalculations() async throws {
        let repo = FixtureWeddingRepository()
        let budget = try await repo.getBudget()

        XCTAssertEqual(budget.totalBudget, 35000.0)
        XCTAssertEqual(budget.totalAllocated, 32400.0)
        XCTAssertEqual(budget.totalPaid, 24800.0)
        XCTAssertEqual(budget.currency, "USD")
        XCTAssertEqual(budget.categories.count, 5)
        let venueCategory = budget.categories.first { $0.name == "Venue & Decor" }
        XCTAssertNotNil(venueCategory)
        XCTAssertEqual(venueCategory?.allocated, 12000.0)
    }

    func testGuestRosterAggregation() async throws {
        let repo = FixtureWeddingRepository()
        let guests = try await repo.getGuests()

        let attending = guests.filter { $0.rsvpStatus == .attending }
        let totalPartyAttending = attending.reduce(0) { $0 + $1.partySize }

        XCTAssertEqual(attending.count, 3)
        XCTAssertEqual(totalPartyAttending, 7) // Jane (2) + Musarurwa (4) + Sarah (1)
    }

    func testSecureStorageDirectOperations() {
        let storage = InMemorySecureStorage()
        XCTAssertNil(storage.get(key: "test_key"))

        storage.save(key: "test_key", value: "test_secret_value")
        XCTAssertEqual(storage.get(key: "test_key"), "test_secret_value")

        storage.delete(key: "test_key")
        XCTAssertNil(storage.get(key: "test_key"))

        storage.save(key: "k1", value: "v1")
        storage.save(key: "k2", value: "v2")
        storage.clear()
        XCTAssertNil(storage.get(key: "k1"))
        XCTAssertNil(storage.get(key: "k2"))
    }

    func testOfflineManifestSaveAndLookup() async throws {
        let store = OfflineManifestStore()
        let weddingId = "wedts26"
        let items = [
            GuestManifestItem(id: "g1", serial: "SERIAL01", guestName: "Tendai Moyo", partySize: 3, tableAssignment: "Table 4"),
            GuestManifestItem(id: "g2", serial: "SERIAL02", guestName: "Chipo Ndlovu", partySize: 1, tableAssignment: "Table 1")
        ]

        await store.clearManifest(weddingId: weddingId)
        try await store.saveManifest(weddingId: weddingId, items: items)

        let manifest = await store.getManifest(weddingId: weddingId)
        XCTAssertEqual(manifest.count, 2)

        let found = await store.lookupBySerial(weddingId: weddingId, serial: "SERIAL01")
        XCTAssertNotNil(found)
        XCTAssertEqual(found?.guestName, "Tendai Moyo")
        XCTAssertEqual(found?.partySize, 3)

        let notFound = await store.lookupBySerial(weddingId: weddingId, serial: "NONEXISTENT")
        XCTAssertNil(notFound)
    }

    func testOfflineCheckInAndCapacity() async throws {
        let store = OfflineManifestStore()
        let weddingId = "wedts26"
        let items = [
            GuestManifestItem(id: "g1", serial: "SERIAL01", guestName: "Tendai Moyo", partySize: 2)
        ]
        try await store.saveManifest(weddingId: weddingId, items: items)

        // 1. Valid partial admission (1 of 2)
        let res1 = try await store.recordOfflineCheckIn(weddingId: weddingId, serial: "SERIAL01", count: 1, usherId: "usher_gate")
        XCTAssertEqual(res1.status, .validPass)
        XCTAssertEqual(res1.checkedInCount, 1)

        // 2. Capacity exceeded (trying to admit 2 more when only 1 spot is left)
        let res2 = try await store.recordOfflineCheckIn(weddingId: weddingId, serial: "SERIAL01", count: 2, usherId: "usher_gate")
        XCTAssertEqual(res2.status, .capacityExceeded)

        // 3. Final admission of remaining 1
        let res3 = try await store.recordOfflineCheckIn(weddingId: weddingId, serial: "SERIAL01", count: 1, usherId: "usher_gate")
        XCTAssertEqual(res3.status, .validPass)
        XCTAssertEqual(res3.checkedInCount, 2)
    }

    func testOfflineCheckInSyncQueue() async throws {
        let store = OfflineManifestStore()
        let weddingId = "wedts26"
        let items = [
            GuestManifestItem(id: "g1", serial: "SYNC_SERIAL", guestName: "Farai Sithole", partySize: 2)
        ]
        await store.clearManifest(weddingId: weddingId)
        try await store.saveManifest(weddingId: weddingId, items: items)

        _ = try await store.recordOfflineCheckIn(weddingId: weddingId, serial: "SYNC_SERIAL", count: 2, usherId: "usher_offline_1")

        let pending = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending.first?.passSerial, "SYNC_SERIAL")
        XCTAssertEqual(pending.first?.count, 2)
        XCTAssertFalse(pending.first?.synced ?? true)

        if let checkInId = pending.first?.id {
            try await store.markCheckInSynced(id: checkInId)
            let remaining = await store.getPendingCheckIns(weddingId: weddingId)
            XCTAssertEqual(remaining.count, 0)
        }
    }

    func testIvoryInvitationResolutionAndRsvpLifecycle() async throws {
        let repo = FixtureWeddingRepository()
        let slug = "tariro-shadreck-2026"
        let token = "tok_jane_doe_2026"

        // 1. Resolve invitation
        let invitation = try await repo.resolveInvitation(weddingSlug: slug, token: token)
        XCTAssertEqual(invitation.weddingSlug, slug)
        XCTAssertEqual(invitation.guestName, "Jane & Michael Doe")
        XCTAssertEqual(invitation.householdName, "Doe Household")
        XCTAssertEqual(invitation.partySize, 2)
        XCTAssertEqual(invitation.cardStyle, "ivory-floral-gold")
        XCTAssertFalse(invitation.isConfirmed)

        // 2. Confirm RSVP
        let pass = try await repo.confirmRsvp(weddingSlug: slug, token: token, attending: true)
        XCTAssertEqual(pass.guestName, "Jane & Michael Doe")
        XCTAssertEqual(pass.partySize, 2)
        XCTAssertEqual(pass.tableNumber, 8)
    }

    func testVendorPresenceLifecycle() async throws {
        let repo = FixtureWeddingRepository()

        // 1. Initial list
        let initialVendors = try await repo.getVendors()
        XCTAssertEqual(initialVendors.count, 3)
        let decor = initialVendors.first { $0.vendorName == "Shandy Events" }
        XCTAssertNotNil(decor)
        XCTAssertEqual(decor?.state, .arrived)

        // 2. Update status
        let updated = try await repo.updateVendorState(id: "v1", state: .serviceActive)
        XCTAssertEqual(updated.state, .serviceActive)

        // 3. Verify persistence
        let reloaded = try await repo.getVendors()
        let reloadedDecor = reloaded.first { $0.id == "v1" }
        XCTAssertEqual(reloadedDecor?.state, .serviceActive)
    }

    func testWeddingAnnouncementsBroadcast() async throws {
        let repo = FixtureWeddingRepository()

        let initial = try await repo.getAnnouncements()
        XCTAssertEqual(initial.count, 2)

        let posted = try await repo.postAnnouncement(
            title: "Photo Call",
            message: "Bridal party kindly gather at the fountain.",
            urgency: .action
        )
        XCTAssertEqual(posted.title, "Photo Call")
        XCTAssertEqual(posted.urgency, .action)

        let updated = try await repo.getAnnouncements()
        XCTAssertEqual(updated.count, 3)
        XCTAssertEqual(updated.first?.title, "Photo Call")
    }

    func testDeepLinkInvitationUriParsing() {
        let urlString = "wewed://invite?wedding=tariro-shadreck-2026&token=tok_test_123&card=ivory-floral-gold"
        guard let url = URL(string: urlString),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            XCTFail("Failed to construct URLComponents")
            return
        }

        XCTAssertEqual(components.scheme, "wewed")
        XCTAssertEqual(components.host, "invite")

        let queryItems = components.queryItems ?? []
        let wedding = queryItems.first(where: { $0.name == "wedding" })?.value
        let token = queryItems.first(where: { $0.name == "token" })?.value
        let card = queryItems.first(where: { $0.name == "card" })?.value

        XCTAssertEqual(wedding, "tariro-shadreck-2026")
        XCTAssertEqual(token, "tok_test_123")
        XCTAssertEqual(card, "ivory-floral-gold")
    }

    func testAsymmetricECDSAVerification() {
        let pubHex = "043d2178d1d53662565131b57913079288516d25bac99b0b6e7c5738071d9e26b0b67ab662ad380d88a158063008819b0da560ec1a1591b314e8654cfe99d1d235"
        let validToken = "WW2.wedts26.WWJD0824.0e.66f001ab.8d4ba7eca9ef156da73f31e98456a9eaae676f66e4e33d4afaeb5f36cc5f4e06d612a90d0519d343346872759e675437934043ba97fec6a763b7ae3430d6ab30"

        // 1. Valid signature
        let res = TokenVerifier.verifyAsymmetric(token: validToken, rawPublicKeyHex: pubHex, requiredEventBit: 0x04)
        switch res {
        case .success(let parsed):
            XCTAssertEqual(parsed.version, "WW2")
            XCTAssertEqual(parsed.weddingShortId, "wedts26")
            XCTAssertEqual(parsed.passSerial, "WWJD0824")
            XCTAssertEqual(parsed.eventBitmask, 0x0E)
        case .failure(let err):
            XCTFail("ECDSA verification failed: \(err)")
        }

        // 2. Tampered token payload
        let tamperedToken = "WW2.wedts26.TAMPERED.0e.66f001ab.8d4ba7eca9ef156da73f31e98456a9eaae676f66e4e33d4afaeb5f36cc5f4e06d612a90d0519d343346872759e675437934043ba97fec6a763b7ae3430d6ab30"
        let tamperedRes = TokenVerifier.verifyAsymmetric(token: tamperedToken, rawPublicKeyHex: pubHex)
        XCTAssertEqual(tamperedRes, .failure(.signatureMismatch))

        // 3. Unauthorized event
        let unauthRes = TokenVerifier.verifyAsymmetric(token: validToken, rawPublicKeyHex: pubHex, requiredEventBit: 0x20)
        XCTAssertEqual(unauthRes, .failure(.unauthorizedEvent))

        // 4. Invalid key
        let badKeyRes = TokenVerifier.verifyAsymmetric(token: validToken, rawPublicKeyHex: "001122")
        XCTAssertEqual(badKeyRes, .failure(.invalidKey))
    }

    func testOfflinePersistenceAndSyncLifecycle() async throws {
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let weddingId = "wedts26"
        let initialItems = [
            GuestManifestItem(id: "g1", serial: "WWJD0824", guestName: "Jane & Michael Doe", partySize: 2),
            GuestManifestItem(id: "g2", serial: "WWMF0104", guestName: "Musarurwa Family", partySize: 4)
        ]

        // 1. Manifest downloaded & saved to persistent disk
        var store = OfflineManifestStore(storageDirectory: tempDir)
        try await store.saveManifest(weddingId: weddingId, items: initialItems)

        // 2. Network disabled & App terminated/restarted (New store instance initialized from same storage dir)
        store = OfflineManifestStore(storageDirectory: tempDir)

        // 3. Manifest still available after app restart
        let loaded = await store.getManifest(weddingId: weddingId)
        XCTAssertEqual(loaded.count, 2)
        XCTAssertEqual(loaded.first(where: { $0.serial == "WWJD0824" })?.guestName, "Jane & Michael Doe")

        // 4. Guest 1 scanned offline (Admit 2 of 2)
        let res1 = try await store.recordOfflineCheckIn(weddingId: weddingId, serial: "WWJD0824", count: 2, usherId: "gate_usher_1")
        XCTAssertEqual(res1.status, .validPass)
        XCTAssertEqual(res1.checkedInCount, 2)

        // 5. Audit queued locally
        var pending = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending[0].passSerial, "WWJD0824")
        XCTAssertEqual(pending[0].count, 2)
        XCTAssertFalse(pending[0].synced)

        // 6. Guest 2 scanned offline (Partial arrival: admit 2 of 4)
        let res2 = try await store.recordOfflineCheckIn(weddingId: weddingId, serial: "WWMF0104", count: 2, usherId: "gate_usher_1")
        XCTAssertEqual(res2.status, .validPass)
        XCTAssertEqual(res2.checkedInCount, 2)

        // App restart simulation while offline (crashed / battery died)
        store = OfflineManifestStore(storageDirectory: tempDir)
        pending = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertEqual(pending.count, 2) // Both queued records survived crash/restart!

        // 7. Connectivity restored -> queued records synchronize
        for rec in pending {
            try await store.markCheckInSynced(id: rec.id)
        }
        let remainingPending = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertEqual(remainingPending.count, 0)

        // 8. Duplicates / conflicts reconciled: Duplicate attempt rejected
        let dupRes = try await store.recordOfflineCheckIn(weddingId: weddingId, serial: "WWJD0824", count: 1, usherId: "gate_usher_2")
        XCTAssertEqual(dupRes.status, .capacityExceeded)
    }
}


