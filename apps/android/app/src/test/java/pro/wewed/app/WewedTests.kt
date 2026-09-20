package pro.wewed.app

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.CheckInStatus
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.models.TaskPriority
import pro.wewed.app.models.TaskStatus
import pro.wewed.app.services.forOnlyWedding
import pro.wewed.app.services.FixtureWeddingRepository
import pro.wewed.app.services.InMemorySecureStorage
import pro.wewed.app.services.TokenVerificationResult
import pro.wewed.app.services.TokenVerifier
import pro.wewed.app.state.SessionViewModel

class WewedTests {

    @Test
    fun testTokenParsingValidFormat() {
        val token = "WW1.wedts26.WWJD0824.0e.66f001ab.3f9a7c2b4d1e809f"
        val result = TokenVerifier.parse(token)

        assertTrue(result is TokenVerificationResult.Success)
        val parsed = (result as TokenVerificationResult.Success).token
        assertEquals("WW1", parsed.version)
        assertEquals("wedts26", parsed.weddingShortId)
        assertEquals("WWJD0824", parsed.passSerial)
        assertEquals(0x0E, parsed.eventBitmask)
        assertEquals("66f001ab", parsed.nonce)
        assertEquals("3f9a7c2b4d1e809f", parsed.signature)
    }

    @Test
    fun testTokenParsingInvalidFormat() {
        val invalidToken = "WW1.too.short"
        val result = TokenVerifier.parse(invalidToken)
        assertTrue(result is TokenVerificationResult.Failure)
    }

    @Test
    fun testTokenVerificationUnauthorizedEvent() {
        val token = "WW1.wedts26.WWJD0824.02.66f001ab.3f9a7c2b4d1e809f" // Only bit 0x02
        val result = TokenVerifier.verify(token, "secret", requiredEventBit = 0x04) // Requires bit 0x04
        assertTrue(result is TokenVerificationResult.Failure)
        assertEquals("Unauthorized for this wedding event.", (result as TokenVerificationResult.Failure).reason)
    }

    @Test
    fun testFixtureRepositoryLifecycle() = runBlocking {
        val repo = FixtureWeddingRepository().forOnlyWedding()
        // 1. Get Wedding
        val wedding = repo.getWedding()
        assertEquals("Tariro & Shadreck", wedding.coupleNames)
        assertEquals(5, wedding.programme.size)

        // 2. Tasks
        val initialTasks = repo.getTasks()
        assertEquals(5, initialTasks.size)

        val createdTask = repo.createTask("Test Android Task", TaskPriority.HIGH, "Test")
        assertEquals(TaskStatus.TODO, createdTask.status)

        val toggled = repo.toggleTask(createdTask.id)
        assertEquals(TaskStatus.DONE, toggled.status)

        // 3. Guests
        val guests = repo.getGuests()
        assertEquals(4, guests.size)

        // 4. Search
        val searchRes = repo.searchGuests("Musarurwa")
        assertEquals(1, searchRes.size)
        assertEquals("Musarurwa Household", searchRes.first().householdName)
    }

    @Test
    fun testGateCheckInFullParty() = runBlocking {
        val repo = FixtureWeddingRepository().forOnlyWedding()
        val tokenJane = "WW1.wedts26.WWJD0824.0e.66f001ab.3f9a7c2b4d1e809f"

        // Admit entire party of 2
        val res = repo.checkInGuest(tokenJane, 2, "usher_android_gate1")
        assertEquals(CheckInStatus.VALID_PASS, res.status)
        assertEquals("Jane & Michael Doe", res.guestName)
        assertEquals(2, res.partySize)
        assertEquals(2, res.alreadyCheckedInCount)
        assertEquals(0, res.remainingCount)
        assertEquals(8, res.tableNumber)

        // Duplicate scan rejection
        val dupRes = repo.checkInGuest(tokenJane, 1, "usher_android_gate1")
        assertEquals(CheckInStatus.ALREADY_CHECKED_IN, dupRes.status)
        assertEquals(0, dupRes.remainingCount)
    }

    @Test
    fun testGateCheckInPartialHouseholdAndCapacityLimits() = runBlocking {
        val repo = FixtureWeddingRepository().forOnlyWedding()
        val tokenMusarurwa = "WW1.wedts26.WWMF0104.0e.77a002bc.5a8c9e1f2b3d4e6a"

        // Step 1: Partial arrival of 2 out of 4
        val step1 = repo.checkInGuest(tokenMusarurwa, 2, "usher_android_north")
        assertEquals(CheckInStatus.PARTIAL_CHECKED_IN, step1.status)
        assertEquals(4, step1.partySize)
        assertEquals(2, step1.alreadyCheckedInCount)
        assertEquals(2, step1.remainingCount)

        // Step 2: Over-capacity check-in attempt (trying to admit 3 when only 2 remain)
        val step2 = repo.checkInGuest(tokenMusarurwa, 3, "usher_android_north")
        assertEquals(CheckInStatus.CAPACITY_EXCEEDED, step2.status)
        assertEquals(2, step2.remainingCount)

        // Step 3: Second partial arrival (remaining 2 arrive)
        val step3 = repo.checkInGuest(tokenMusarurwa, 2, "usher_android_north")
        assertEquals(CheckInStatus.VALID_PASS, step3.status)
        assertEquals(4, step3.partySize)
        assertEquals(4, step3.alreadyCheckedInCount)
        assertEquals(0, step3.remainingCount)

        // Step 4: Subsequent scan after household is full
        val step4 = repo.checkInGuest(tokenMusarurwa, 1, "usher_android_north")
        assertEquals(CheckInStatus.ALREADY_CHECKED_IN, step4.status)

        // Verify local gate audit records were persisted
        val audit = repo.getAuditRecords()
        assertEquals(2, audit.size)
        assertEquals(2, audit[0].countAdmitted)
        assertEquals("WWMF0104", audit[0].passSerial)
        assertEquals(2, audit[1].countAdmitted)
    }

    @Test
    fun testGateCheckInInvalidPass() = runBlocking {
        val repo = FixtureWeddingRepository().forOnlyWedding()
        val fakeToken = "WW1.wedts26.FAKE9999.0e.00000000.signature"
        val res = repo.checkInGuest(fakeToken, 1, "usher_gate")
        assertEquals(CheckInStatus.INVALID_PASS, res.status)
        assertEquals("Unknown Guest", res.guestName)
    }

    @Test
    fun testSessionStore() {
        val storage = InMemorySecureStorage()
        val session = SessionViewModel(storage)
        assertFalse(session.isAuthenticated.value)

        session.login("tariro@wewed.pro", "couple")
        assertTrue(session.isAuthenticated.value)
        assertEquals("couple", session.currentUserRole.value)

        // Restore in new session instance
        val restoredSession = SessionViewModel(storage)
        assertTrue(restoredSession.isAuthenticated.value)

        restoredSession.logout()
        assertFalse(restoredSession.isAuthenticated.value)
    }

    @Test
    fun testBudgetCalculations() = runBlocking {
        val repo = FixtureWeddingRepository().forOnlyWedding()
        val budget = repo.getBudget()

        assertEquals(35000.0, budget.totalBudget, 0.001)
        assertEquals(32400.0, budget.totalAllocated, 0.001)
        assertEquals(24800.0, budget.totalPaid, 0.001)
        assertEquals("USD", budget.currency)
        assertEquals(5, budget.categories.size)
        val venueCategory = budget.categories.first { it.name == "Venue & Decor" }
        assertNotNull(venueCategory)
        assertEquals(12000.0, venueCategory.allocated, 0.001)
    }

    @Test
    fun testGuestRosterAggregation() = runBlocking {
        val repo = FixtureWeddingRepository().forOnlyWedding()
        val guests = repo.getGuests()

        val attending = guests.filter { it.rsvpStatus == RSVPStatus.ATTENDING }
        val totalPartyAttending = attending.sumOf { it.partySize }

        assertEquals(3, attending.size)
        assertEquals(7, totalPartyAttending) // Jane (2) + Musarurwa (4) + Sarah (1)
    }

    @Test
    fun testSecureStorageDirectOperations() {
        val storage = InMemorySecureStorage()
        assertNull(storage.get("test_key"))

        storage.save("test_key", "test_secret_value")
        assertEquals("test_secret_value", storage.get("test_key"))

        storage.delete("test_key")
        assertNull(storage.get("test_key"))

        storage.save("k1", "v1")
        storage.save("k2", "v2")
        storage.clear()
        assertNull(storage.get("k1"))
        assertNull(storage.get("k2"))
    }

    @Test
    fun testOfflineManifestSaveAndLookup() = runBlocking {
        val store = pro.wewed.app.services.OfflineManifestStore()
        val weddingId = "wedts26"
        val items = listOf(
            pro.wewed.app.services.GuestManifestItem(id = "g1", serial = "SERIAL01", guestName = "Tendai Moyo", partySize = 3, tableAssignment = "Table 4"),
            pro.wewed.app.services.GuestManifestItem(id = "g2", serial = "SERIAL02", guestName = "Chipo Ndlovu", partySize = 1, tableAssignment = "Table 1")
        )

        store.clearManifest(weddingId)
        store.saveManifest(weddingId, items)

        val manifest = store.getManifest(weddingId)
        assertEquals(2, manifest.size)

        val found = store.lookupBySerial(weddingId, "SERIAL01")
        assertNotNull(found)
        assertEquals("Tendai Moyo", found?.guestName)
        assertEquals(3, found?.partySize)

        val notFound = store.lookupBySerial(weddingId, "NONEXISTENT")
        assertNull(notFound)
    }

    @Test
    fun testOfflineCheckInAndCapacity() = runBlocking {
        val store = pro.wewed.app.services.OfflineManifestStore()
        val weddingId = "wedts26"
        val items = listOf(
            pro.wewed.app.services.GuestManifestItem(id = "g1", serial = "SERIAL01", guestName = "Tendai Moyo", partySize = 2)
        )
        store.saveManifest(weddingId, items)

        // 1. Valid partial admission (1 of 2)
        val res1 = store.recordOfflineCheckIn(weddingId, "SERIAL01", 1, "usher_gate")
        assertEquals(CheckInStatus.PARTIAL_CHECKED_IN, res1.status)
        assertEquals(1, res1.alreadyCheckedInCount)

        // 2. Capacity exceeded (trying to admit 2 more when only 1 spot is left)
        val res2 = store.recordOfflineCheckIn(weddingId, "SERIAL01", 2, "usher_gate")
        assertEquals(CheckInStatus.CAPACITY_EXCEEDED, res2.status)

        // 3. Final admission of remaining 1
        val res3 = store.recordOfflineCheckIn(weddingId, "SERIAL01", 1, "usher_gate")
        assertEquals(CheckInStatus.VALID_PASS, res3.status)
        assertEquals(2, res3.alreadyCheckedInCount)
    }

    @Test
    fun testOfflineCheckInSyncQueue() = runBlocking {
        val store = pro.wewed.app.services.OfflineManifestStore()
        val weddingId = "wedts26"
        val items = listOf(
            pro.wewed.app.services.GuestManifestItem(id = "g1", serial = "SYNC_SERIAL", guestName = "Farai Sithole", partySize = 2)
        )
        store.clearManifest(weddingId)
        store.saveManifest(weddingId, items)

        store.recordOfflineCheckIn(weddingId, "SYNC_SERIAL", 2, "usher_offline_1")

        val pending = store.getPendingCheckIns(weddingId)
        assertEquals(1, pending.size)
        assertEquals("SYNC_SERIAL", pending.first().passSerial)
        assertEquals(2, pending.first().count)
        assertFalse(pending.first().synced)

        val checkInId = pending.first().id
        store.markCheckInSynced(checkInId)
        val remaining = store.getPendingCheckIns(weddingId)
        assertEquals(0, remaining.size)
    }

    @Test
    fun testIvoryInvitationResolutionAndRsvpLifecycle() = runBlocking {
        val repo = FixtureWeddingRepository().forOnlyWedding()
        val slug = "tariro-shadreck-2026"
        val token = "tok_jane_doe_2026"

        // 1. Resolve invitation
        val invitation = repo.resolveInvitation(slug, token)
        assertEquals(slug, invitation.weddingSlug)
        assertEquals("Jane & Michael Doe", invitation.guestName)
        assertEquals("Doe Household", invitation.householdName)
        assertEquals(2, invitation.partySize)
        assertEquals("ivory-floral-gold", invitation.cardStyle)
        assertFalse(invitation.isConfirmed)

        // 2. Confirm RSVP
        val pass = repo.confirmRsvp(slug, token, true)
        assertEquals("Jane & Michael Doe", pass.guestName)
        assertEquals(2, pass.partySize)
        assertEquals(8, pass.tableNumber)
    }

    @Test
    fun testVendorPresenceLifecycle() = runBlocking {
        val repo = FixtureWeddingRepository().forOnlyWedding()
        // 1. Initial list
        val initialVendors = repo.getVendors()
        assertEquals(3, initialVendors.size)
        val decor = initialVendors.firstOrNull { it.vendorName == "Shandy Events" }
        assertNotNull(decor)
        assertEquals(pro.wewed.app.models.VendorPresenceState.ARRIVED, decor?.state)

        // 2. Update status
        val updated = repo.updateVendorState("v1", pro.wewed.app.models.VendorPresenceState.SERVICE_ACTIVE)
        assertEquals(pro.wewed.app.models.VendorPresenceState.SERVICE_ACTIVE, updated.state)

        // 3. Verify persistence
        val reloaded = repo.getVendors()
        val reloadedDecor = reloaded.firstOrNull { it.id == "v1" }
        assertEquals(pro.wewed.app.models.VendorPresenceState.SERVICE_ACTIVE, reloadedDecor?.state)
    }

    @Test
    fun testWeddingAnnouncementsBroadcast() = runBlocking {
        val repo = FixtureWeddingRepository().forOnlyWedding()
        val initial = repo.getAnnouncements()
        assertEquals(2, initial.size)

        val posted = repo.postAnnouncement(
            "Photo Call",
            "Bridal party kindly gather at the fountain.",
            pro.wewed.app.models.AnnouncementUrgency.ACTION
        )
        assertEquals("Photo Call", posted.title)
        assertEquals(pro.wewed.app.models.AnnouncementUrgency.ACTION, posted.urgency)

        val updated = repo.getAnnouncements()
        assertEquals(3, updated.size)
        assertEquals("Photo Call", updated.first().title)
    }

    @Test
    fun testDeepLinkInvitationUriParsing() {
        val uri = java.net.URI.create("wewed://invite?wedding=tariro-shadreck-2026&token=tok_test_123&card=ivory-floral-gold")
        assertEquals("wewed", uri.scheme)
        assertEquals("invite", uri.host)

        val queryMap = uri.query.split("&").associate {
            val parts = it.split("=")
            parts[0] to parts[1]
        }

        assertEquals("tariro-shadreck-2026", queryMap["wedding"])
        assertEquals("tok_test_123", queryMap["token"])
        assertEquals("ivory-floral-gold", queryMap["card"])
    }

    @Test
    fun testAsymmetricECDSAVerification() {
        val pubDerBase64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEPSF40dU2YlZRMbV5EweSiFFtJbrJmwtufFc4Bx2eJrC2erZirTgNiKFYBjAIgZsNpWDsGhWRsxToZUz+mdHSNQ=="
        val validToken = "WW2.wedts26.WWJD0824.0e.66f001ab.8d4ba7eca9ef156da73f31e98456a9eaae676f66e4e33d4afaeb5f36cc5f4e06d612a90d0519d343346872759e675437934043ba97fec6a763b7ae3430d6ab30"

        // 1. Valid signature
        val res = TokenVerifier.verifyAsymmetric(validToken, pubDerBase64, requiredEventBit = 0x04)
        assertTrue("Expected Success, got $res", res is TokenVerificationResult.Success)
        val parsed = (res as TokenVerificationResult.Success).token
        assertEquals("WW2", parsed.version)
        assertEquals("wedts26", parsed.weddingShortId)
        assertEquals("WWJD0824", parsed.passSerial)
        assertEquals(0x0E, parsed.eventBitmask)

        // 2. Tampered token payload
        val tamperedToken = "WW2.wedts26.TAMPERED.0e.66f001ab.8d4ba7eca9ef156da73f31e98456a9eaae676f66e4e33d4afaeb5f36cc5f4e06d612a90d0519d343346872759e675437934043ba97fec6a763b7ae3430d6ab30"
        val tamperedRes = TokenVerifier.verifyAsymmetric(tamperedToken, pubDerBase64)
        assertTrue(tamperedRes is TokenVerificationResult.Failure)
        assertEquals("Signature mismatch.", (tamperedRes as TokenVerificationResult.Failure).reason)

        // 3. Unauthorized event
        val unauthRes = TokenVerifier.verifyAsymmetric(validToken, pubDerBase64, requiredEventBit = 0x20)
        assertTrue(unauthRes is TokenVerificationResult.Failure)
        assertEquals("Unauthorized for this wedding event.", (unauthRes as TokenVerificationResult.Failure).reason)
    }

    @Test
    fun testOfflinePersistenceAndSyncLifecycle() = runBlocking {
        val tempDir = java.nio.file.Files.createTempDirectory("wewed_offline_test").toFile()
        tempDir.deleteOnExit()

        val weddingId = "wedts26"
        val initialItems = listOf(
            pro.wewed.app.services.GuestManifestItem(id = "g1", serial = "WWJD0824", guestName = "Jane & Michael Doe", partySize = 2),
            pro.wewed.app.services.GuestManifestItem(id = "g2", serial = "WWMF0104", guestName = "Musarurwa Family", partySize = 4)
        )

        // 1. Manifest downloaded & saved to persistent disk
        var store = pro.wewed.app.services.OfflineManifestStore(tempDir)
        store.saveManifest(weddingId, initialItems)

        // 2. Network disabled & App terminated/restarted (New store instance initialized from same storage dir)
        store = pro.wewed.app.services.OfflineManifestStore(tempDir)

        // 3. Manifest still available after app restart
        val loaded = store.getManifest(weddingId)
        assertEquals(2, loaded.size)
        assertEquals("Jane & Michael Doe", loaded.first { it.serial == "WWJD0824" }.guestName)

        // 4. Guest 1 scanned offline (Admit 2 of 2)
        val res1 = store.recordOfflineCheckIn(weddingId, "WWJD0824", 2, "gate_usher_1")
        assertEquals(CheckInStatus.VALID_PASS, res1.status)
        assertEquals(2, res1.alreadyCheckedInCount)

        // 5. Audit queued locally
        var pending = store.getPendingCheckIns(weddingId)
        assertEquals(1, pending.size)
        assertEquals("WWJD0824", pending[0].passSerial)
        assertEquals(2, pending[0].count)
        assertFalse(pending[0].synced)

        // 6. Guest 2 scanned offline (Partial arrival: admit 2 of 4)
        val res2 = store.recordOfflineCheckIn(weddingId, "WWMF0104", 2, "gate_usher_1")
        assertEquals(CheckInStatus.PARTIAL_CHECKED_IN, res2.status)
        assertEquals(2, res2.alreadyCheckedInCount)

        // App restart simulation while offline (crashed / battery died)
        store = pro.wewed.app.services.OfflineManifestStore(tempDir)
        pending = store.getPendingCheckIns(weddingId)
        assertEquals(2, pending.size) // Both queued records survived crash/restart!

        // 7. Connectivity restored -> queued records synchronize
        for (rec in pending) {
            store.markCheckInSynced(rec.id)
        }
        val remainingPending = store.getPendingCheckIns(weddingId)
        assertEquals(0, remainingPending.size)

        // 8. Duplicates / conflicts reconciled: Duplicate attempt rejected
        val dupRes = store.recordOfflineCheckIn(weddingId, "WWJD0824", 1, "gate_usher_2")
        assertEquals(CheckInStatus.CAPACITY_EXCEEDED, dupRes.status)
    }
}


