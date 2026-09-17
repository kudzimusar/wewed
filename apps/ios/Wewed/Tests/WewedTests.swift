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

    func testSessionStore() {
        let storage = InMemorySecureStorage()
        let session = SessionStore(storage: storage)
        XCTAssertFalse(session.isAuthenticated)

        session.login(email: "tariro@wewed.pro", role: "couple")
        XCTAssertTrue(session.isAuthenticated)
        XCTAssertEqual(session.currentUserRole, "couple")

        // Restore in new session instance
        let restoredSession = SessionStore(storage: storage)
        XCTAssertTrue(restoredSession.isAuthenticated)

        restoredSession.logout()
        XCTAssertFalse(restoredSession.isAuthenticated)
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
}

