package pro.wewed.app

import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.models.PassStage
import pro.wewed.app.models.RSVPStatus
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

        val passGuest = guests.first { it.id == "shadow_guest_a" }
        assertEquals(passGuest.name, pass.guestName)
        assertEquals(passGuest.householdName, pass.householdName)
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
        val guest = repository.getGuests().first { it.id == "shadow_guest_a" }

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

        val vendorNames = vendors.map { it.vendorName }.toSet()
        budget.mapNotNull { it.vendorName }.forEach { vendorName ->
            assertTrue("Budget vendor must exist in vendor engagements: $vendorName", vendorName in vendorNames)
        }

        val budgetCategories = budget.map { it.category }.toSet()
        contributions.filter { it.allocationLabel != "Unallocated" }.forEach { contribution ->
            assertTrue(
                "Contribution allocation must map to represented budget domain or explicit pending Transport.",
                contribution.allocationLabel in budgetCategories || contribution.allocationLabel == "Transport"
            )
        }

        seating.forEach { table ->
            assertTrue("Assigned seating must not exceed capacity.", table.assigned <= table.capacity)
        }

        timeline.mapNotNull { it.linkedVendor }.forEach { vendorName ->
            assertTrue("Timeline vendor must exist in vendor engagements: $vendorName", vendorName in vendorNames)
        }
    }

    @Test(expected = NativeRepositoryFactoryError.ProductionReadVerifyNotConfigured::class)
    fun productionReadVerifyRemainsLocked() {
        NativeRepositoryFactory.make(NativeDataEnvironment.PRODUCTION_READ_VERIFY)
    }

    @Test(expected = NativeRepositoryFactoryError.ProductionDisabled::class)
    fun productionRepositoryRemainsLocked() {
        NativeRepositoryFactory.make(NativeDataEnvironment.PRODUCTION)
    }
}
