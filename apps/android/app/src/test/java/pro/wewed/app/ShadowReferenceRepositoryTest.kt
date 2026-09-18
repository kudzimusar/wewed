package pro.wewed.app

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.CheckInStatus
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.models.PassStage
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.services.NativeEnvironmentGuardError
import pro.wewed.app.services.NativeRepositoryFactory
import pro.wewed.app.services.NativeRepositoryFactoryError
import pro.wewed.app.services.ShadowReferenceWeddingRepository

class ShadowReferenceRepositoryTest {

    @Test
    fun shadowFactoryBuildsCoherentCharityAndKudzieGraph() = runBlocking {
        val bundle = NativeRepositoryFactory.make(NativeDataEnvironment.SHADOW)
        assertEquals(NativeDataEnvironment.SHADOW, bundle.environment)

        val wedding = bundle.wedding.getWedding()
        val dashboard = bundle.planner.getDashboard()
        val invitation = bundle.wedding.resolveInvitation(wedding.id, "native-reference-guest")
        val pass = bundle.wedding.getWeddingPass("native-reference-guest")
        val guests = bundle.wedding.getGuests()

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
        val repository = ShadowReferenceWeddingRepository()

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
        val repository = ShadowReferenceWeddingRepository()

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
        val repository = ShadowReferenceWeddingRepository()
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

    @Test(expected = NativeEnvironmentGuardError.ProductionDisabled::class)
    fun productionRepositoryRemainsLocked() {
        NativeRepositoryFactory.make(NativeDataEnvironment.PRODUCTION)
    }
}
