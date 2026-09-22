package pro.wewed.app

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.CheckInStatus
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.models.PassStage
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.services.scopedWedding
import pro.wewed.app.services.forOnlyWedding
import pro.wewed.app.services.NativeEnvironmentGuardError
import pro.wewed.app.services.ProductionBoundaryWeddingRepository
import pro.wewed.app.services.ProductionBoundaryPlannerRepository
import pro.wewed.app.services.NativeRepositoryFactory
import pro.wewed.app.services.NativeRepositoryFactoryError
import pro.wewed.app.services.ShadowReferenceWeddingRepository

class ShadowReferenceRepositoryTest {

    @Test
    fun shadowFactoryBuildsCoherentCharityAndKudzieGraph() = runBlocking {
        val bundle = NativeRepositoryFactory.make(NativeDataEnvironment.SHADOW)
        assertEquals(NativeDataEnvironment.SHADOW, bundle.environment)

        val wedding = bundle.scopedWedding().getWedding()
        val dashboard = bundle.planner.getDashboard()
        val invitation = bundle.scopedWedding().resolveInvitation(wedding.id, "native-reference-guest")
        val pass = bundle.scopedWedding().getWeddingPass("native-reference-guest")
        val guests = bundle.scopedWedding().getGuests()

        assertEquals("Charity & Kudzie", wedding.coupleNames)
        assertEquals(wedding.coupleNames, dashboard.coupleNames)
        assertEquals(wedding.coupleNames, invitation.coupleNames)
        assertEquals(wedding.id, pass.weddingId)
        assertEquals(wedding.coupleNames, pass.coupleNames)

        val passGuest = guests.first { it.id == "shadow_guest_011" }
        assertEquals(passGuest.name, pass.guestName)
        assertEquals(passGuest.tableName, pass.tableName)
        assertTrue(pass.qrPayload.contains("NOT_A_PRODUCTION_CREDENTIAL"))
    }

    @Test
    fun shadowDeclineChangesGuestStateWithoutGrantingAdmissionStage() = runBlocking {
        val repository = ShadowReferenceWeddingRepository().forOnlyWedding()
        val returned = repository.confirmRsvp(
            "shadow_ref_charity_kudzie",
            "native-reference-guest",
            false
        )
        val guest = repository.getGuests().first { it.id == "shadow_guest_011" }

        assertEquals(RSVPStatus.DECLINED, guest.rsvpStatus)
        assertEquals(PassStage.INVITATION, returned.currentStage)
        assertEquals("SHADOW_DECLINED_NO_ADMISSION", returned.qrPayload)
    }

    @Test
    fun plannerReferenceRelationshipsStayConnected() = runBlocking {
        val planner = NativeRepositoryFactory.make(NativeDataEnvironment.SHADOW).planner
        val budget = planner.getBudgetLines()
        val contributions = planner.getContributions()
        val vendors = planner.getVendorEngagements()
        val seating = planner.getSeatingTables()
        val timeline = planner.getTimelineEntries()

        assertEquals(22, budget.size)
        assertEquals(7, vendors.size)
        assertEquals(8, seating.size)
        assertEquals(13, timeline.size)
        assertEquals(4, contributions.size)

        seating.forEach { table ->
            assertTrue("Assigned seating must not exceed capacity.", table.assigned <= table.capacity)
        }
    }

    @Test
    fun pendingInvitationTransitionsToAttendingPassWithoutChangingExistingAttendee() = runBlocking {
        val repository = ShadowReferenceWeddingRepository().forOnlyWedding()
        val invitation = repository.resolveInvitation(
            "shadow_ref_charity_kudzie",
            "shadow-pending-guest"
        )
        assertFalse(invitation.isConfirmed)
        assertEquals("Guest G001", invitation.guestName)

        val pass = repository.confirmRsvp(
            "shadow_ref_charity_kudzie",
            "shadow-pending-guest",
            true
        )
        val guests = repository.getGuests()
        val converted = guests.first { it.id == "shadow_guest_001" }
        val existing = guests.first { it.id == "shadow_guest_011" }

        assertEquals(RSVPStatus.ATTENDING, converted.rsvpStatus)
        assertNotNull(converted.passSerial)
        assertEquals(converted.name, pass.guestName)
        assertEquals(PassStage.ATTENDING, pass.currentStage)
        assertEquals(RSVPStatus.ATTENDING, existing.rsvpStatus)
    }

    @Test
    fun partyOfFourCheckInLifecycle() = runBlocking {
        val repository = ShadowReferenceWeddingRepository().forOnlyWedding()
        val guests = repository.getGuests()
        val party4Guest = guests.first { it.id == "shadow_guest_007" }
        assertEquals(4, party4Guest.partySize)
        assertEquals(1, party4Guest.checkedInCount)

        // 1. Partial check-in of 2 more guests (1 + 2 = 3 admitted, 1 remaining)
        val partial = repository.checkInGuest("SHDWGSTP04", 2, "usher_1")
        assertEquals(CheckInStatus.PARTIAL_CHECKED_IN, partial.status)
        assertEquals(3, partial.alreadyCheckedInCount)
        assertEquals(1, partial.remainingCount)

        // 2. Capacity exceeded check (requesting 2 when 1 remaining)
        val exceeded = repository.checkInGuest("SHDWGSTP04", 2, "usher_1")
        assertEquals(CheckInStatus.CAPACITY_EXCEEDED, exceeded.status)
        assertEquals(1, exceeded.remainingCount)

        // 3. Complete check-in of last guest (3 + 1 = 4 admitted, 0 remaining)
        val complete = repository.checkInGuest("SHDWGSTP04", 1, "usher_1")
        assertEquals(CheckInStatus.VALID_PASS, complete.status)
        assertEquals(4, complete.alreadyCheckedInCount)
        assertEquals(0, complete.remainingCount)

        // 4. Duplicate scan
        val duplicate = repository.checkInGuest("SHDWGSTP04", 1, "usher_1")
        assertEquals(CheckInStatus.ALREADY_CHECKED_IN, duplicate.status)
        assertEquals(0, duplicate.remainingCount)
    }

    @Test(expected = NativeRepositoryFactoryError.ProductionReadVerifyNotConfigured::class)
    fun productionReadVerifyRemainsLocked() {
        NativeRepositoryFactory.make(NativeDataEnvironment.PRODUCTION_READ_VERIFY)
    }

    @Test
    fun phase5ProductionUsesOnlyFailClosedBoundaryRepositories() {
        val production = NativeRepositoryFactory.make(NativeDataEnvironment.PRODUCTION)
        assertTrue(production.wedding is ProductionBoundaryWeddingRepository)
        assertTrue(production.planner is ProductionBoundaryPlannerRepository)
    }

    @Test
    fun sanitizedShadowFactoryBuildsValidBundle() = runBlocking {
        val bundle = NativeRepositoryFactory.make(NativeDataEnvironment.SANITIZED_SHADOW)
        assertEquals(NativeDataEnvironment.SANITIZED_SHADOW, bundle.environment)
    }

    @Test
    fun privateRealShadowLoadsWhenSnapshotAvailable() = runBlocking {
        val path = pro.wewed.app.services.PrivateRealShadowWeddingRepository.defaultSnapshotPath()
        if (!java.io.File(path).exists()) {
            try {
                NativeRepositoryFactory.make(NativeDataEnvironment.PRIVATE_REAL_SHADOW)
                fail("Expected PrivateRealShadowFixtureMissing exception")
            } catch (e: NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing) {
                assertTrue(e.message!!.contains("Private real shadow fixture not found"))
            }
            return@runBlocking
        }

        val bundle = NativeRepositoryFactory.make(NativeDataEnvironment.PRIVATE_REAL_SHADOW)
        assertEquals(NativeDataEnvironment.PRIVATE_REAL_SHADOW, bundle.environment)

        val wedding = bundle.scopedWedding().getWedding()
        val tasks = bundle.scopedWedding().getTasks()
        val guests = bundle.scopedWedding().getGuests()
        val budget = bundle.scopedWedding().getBudget()
        val vendors = bundle.scopedWedding().getVendors()
        val announcements = bundle.scopedWedding().getAnnouncements()
        val dashboard = bundle.planner.getDashboard()
        val budgetLines = bundle.planner.getBudgetLines()
        val contributions = bundle.planner.getContributions()
        val vendorEngagements = bundle.planner.getVendorEngagements()
        val seatingTables = bundle.planner.getSeatingTables()
        val timelineEntries = bundle.planner.getTimelineEntries()
        val documents = bundle.planner.getDocuments()

        // 1. Wedding metadata
        assertEquals("Charity & Kudzie", wedding.coupleNames)
        assertEquals("Imba Manor", wedding.venueName)
        assertEquals("Harare", wedding.city)
        assertEquals("Zimbabwe", wedding.country)
        assertEquals("before", wedding.lifecycle)

        // 2. Tasks (42 tasks, 7 done, 13 high priority)
        assertEquals(42, tasks.size)
        assertEquals(7, tasks.count { it.status == pro.wewed.app.models.TaskStatus.DONE })
        assertEquals(13, tasks.count { it.priority == pro.wewed.app.models.TaskPriority.HIGH })

        // 3. Guests.
        //
        // Reconciled 2026-09-20: production moved from 174 to 175 guests because one bridal-party
        // guest was created on 2026-09-19, after the September-18 export. All 175 are scoped to
        // this wedding, all 175 have exactly one RSVP row, and there are no orphans. 175 rows
        // carry 174 distinct names: one name is held by two separate production rows created six
        // minutes apart with different sides and roles. Both are rendered — deduplicating them
        // here would hide a production fact.
        //
        // The count is asserted against the snapshot's own manifest as well as the reconciled
        // number, so a stale snapshot fails loudly instead of quietly re-baselining.
        val manifest = bundle.scopedWedding().snapshotManifest()
        assertNotNull("Private Real UAT snapshot must carry a manifest", manifest)
        assertEquals("private-real-uat/2", manifest!!.schemaVersion)
        assertEquals(manifest.count("guests"), guests.size)
        assertEquals(175, guests.size)
        assertEquals(174, guests.map { it.name }.toSet().size)

        val guestPseudonymRegex = Regex("""Guest G\d+""")
        guests.forEach { guest ->
            assertFalse("Private real shadow guest name '${guest.name}' must not match pseudonym pattern", guestPseudonymRegex.containsMatchIn(guest.name))
        }
        // Party size is derived from the real RSVP row (guest + confirmed plus-one + children),
        // because production's Guest table has no partySize column.
        val totalInvitedCapacity = guests.sumOf { it.partySize }
        assertEquals(178, totalInvitedCapacity)
        assertEquals(2, guests.count { it.rsvpStatus == RSVPStatus.ATTENDING })
        assertEquals(173, guests.count { it.rsvpStatus == RSVPStatus.PENDING })
        assertEquals(0, guests.count { it.rsvpStatus == RSVPStatus.DECLINED })
        val attendingPassSerials = guests
            .filter { it.rsvpStatus == RSVPStatus.ATTENDING }
            .mapNotNull { it.passSerial }
        assertEquals(2, attendingPassSerials.size)
        assertEquals(attendingPassSerials.size, attendingPassSerials.toSet().size)
        assertTrue(attendingPassSerials.all { it.startsWith("SHDW") })

        // 4. Seating Tables (8 tables, 22 assigned, 64 capacity, 42 free)
        assertEquals(8, seatingTables.size)
        val totalSeatingCapacity = seatingTables.sumOf { it.capacity }
        val totalAssigned = seatingTables.sumOf { it.assigned }
        assertEquals(64, totalSeatingCapacity)
        assertEquals(22, totalAssigned)
        assertEquals(42, totalSeatingCapacity - totalAssigned)

        // 5. Budget (22 lines, $30,380 est, $8,690 act, $3,875 paid)
        assertEquals(22, budgetLines.size)
        assertEquals(30380.0, budget.totalBudget, 0.01)
        assertEquals(8690.0, budget.totalAllocated, 0.01)
        assertEquals(3875.0, budget.totalPaid, 0.01)

        // 6. Vendors (7 vendors, 8 service engagements)
        assertEquals(7, vendors.size)
        assertEquals(8, vendorEngagements.size)

        // 7. Contributions (4 non-monetary guest contributions).
        // Do not commit private contributor names into the test contract.
        assertEquals(4, contributions.size)
        val contributorPseudonymRegex = Regex("""Guest Contributor|Guest G\d+""")
        for (contribution in contributions) {
            assertEquals(0.0, contribution.value, 0.01)
            assertTrue(contribution.contributorLabel.isNotBlank())
            assertFalse("Contribution author must not match generic pseudonym", contributorPseudonymRegex.containsMatchIn(contribution.contributorLabel))
            assertTrue(contribution.typeLabel.isNotBlank())
            assertTrue(contribution.allocationLabel.isNotBlank())
        }
        val contributionModule = dashboard.modules.first { it.id == "contributions" }
        assertEquals("4 messages", contributionModule.value)
        assertEquals("Non-monetary", contributionModule.attention)

        // 8. Timeline (13 programme items)
        assertEquals(13, timelineEntries.size)

        // 9. Documents/contracts and announcements are honest real empty states.
        assertEquals(0, documents.size)
        assertEquals(0, announcements.size)

        // 10. Planner Dashboard
        assertEquals("Eleven Eleven Testing", dashboard.plannerContext)
        assertEquals("7 / 42", dashboard.taskCompletionLabel)
    }

    @Test
    fun privateRealShadowInvitationToRsvpToPassUsesSameGuest() = runBlocking {
        val path = pro.wewed.app.services.PrivateRealShadowWeddingRepository.defaultSnapshotPath()
        if (!java.io.File(path).exists()) return@runBlocking

        val bundle = NativeRepositoryFactory.make(NativeDataEnvironment.PRIVATE_REAL_SHADOW)
        val wedding = bundle.scopedWedding().getWedding()

        // 1. Resolve pending invitation
        val invitation = bundle.scopedWedding().resolveInvitation(wedding.id, "shadow-pending-guest")
        assertFalse(invitation.isConfirmed)
        assertFalse("Invitation guest name must not be generic pseudonym", Regex("""Guest G\d+""").containsMatchIn(invitation.guestName))

        // 2. Accept RSVP
        val pass = bundle.scopedWedding().confirmRsvp(wedding.id, "shadow-pending-guest", true)
        assertEquals(invitation.guestName, pass.guestName)
        assertEquals(PassStage.ATTENDING, pass.currentStage)
        assertTrue(pass.qrPayload.startsWith("REAL_SHADOW_ONLY"))

        // 3. Get wedding pass
        val retrievedPass = bundle.scopedWedding().getWeddingPass(pass.token)
        assertEquals(invitation.guestName, retrievedPass.guestName)
        assertEquals(pass.qrPayload, retrievedPass.qrPayload)

        // 4. Verify guest roster state
        val updatedGuest = bundle.scopedWedding().getGuests().first { it.name == invitation.guestName }
        assertEquals(RSVPStatus.ATTENDING, updatedGuest.rsvpStatus)
        assertNotNull(updatedGuest.passSerial)
    }

    @Test
    fun mapsUriQueryConstruction() {
        val venueName = "Imba Manor"
        val venueCity = "Harare, Zimbabwe"
        val queryAddress = "$venueName, $venueCity".trim()
        val encoded = java.net.URLEncoder.encode(queryAddress, "UTF-8").replace("+", "%20")
        val geoUri = "geo:0,0?q=$encoded"
        val browserUri = "https://www.google.com/maps/search/?api=1&query=$encoded"

        assertEquals("geo:0,0?q=Imba%20Manor%2C%20Harare%2C%20Zimbabwe", geoUri)
        assertEquals("https://www.google.com/maps/search/?api=1&query=Imba%20Manor%2C%20Harare%2C%20Zimbabwe", browserUri)
    }

    @Test
    fun privateRealShadowZeroProhibitedDemoData() {
        val prohibitedNames = listOf(
            "Faith Mutasa",
            "Uncle Farai",
            "Auntie Chipo",
            "Tony M.",
            "Chiedza Nyoni",
            "Ruvimbo & Farai",
            "Chido & Tinashe",
            "Honeyfund"
        )

        for (persona in pro.wewed.app.models.DevelopmentPersona.allPersonas) {
            for (prohibited in prohibitedNames) {
                assertFalse("Persona name ${persona.name} contains prohibited demo string $prohibited", persona.name.contains(prohibited))
            }
        }
    }

    @Test(expected = NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing::class)
    fun privateRealShadowFailsExplicitlyWhenFixtureMissing() {
        pro.wewed.app.services.PrivateRealShadowWeddingRepository(customPath = "/nonexistent/fixture.json")
    }

    @Test(expected = NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing::class)
    fun privateRealShadowPlannerFailsExplicitlyWhenFixtureMissing() {
        pro.wewed.app.services.PrivateRealShadowPlannerRepository(customPath = "/nonexistent/fixture.json")
    }
}
