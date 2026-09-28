package pro.wewed.app.services

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.*

/**
 * P0-1 proof: the active wedding is a real repository scope, not a reload key.
 *
 * [TwoWeddingTestRepository] genuinely serves two different wedding graphs, so these tests can
 * distinguish "reloaded" from "reloaded the correct wedding" — which a single-wedding fixture
 * could never do.
 */
class WeddingScopeTest {

    private val weddingA = "wed_a"
    private val weddingB = "wed_b"

    /** A source holding two distinct wedding graphs. */
    private class TwoWeddingTestRepository : WeddingRepository {
        private val graphs = mapOf(
            "wed_a" to Graph(
                wedding = Wedding(
                    "wed_a", "Amara & Anesu", "2026-10-24T14:00:00Z", "Venue A", "Address A",
                    "Harare", "Zimbabwe", "before",
                    listOf(ProgrammeItem("pa", "Ceremony A", "14:00", "Chapel A", "A"))
                ),
                guests = listOf(Guest("ga1", "Guest A One", "Household A", 2, "Bride", RSVPStatus.ATTENDING, 1, "Table A", false, 0, "PASSA1")),
                tasks = listOf(PlannerTask("ta1", "Task A", TaskStatus.TODO, TaskPriority.HIGH, "Cat A")),
                vendors = listOf(VendorPresence("va1", "Vendor A", "Decor", "Area A", VendorPresenceState.ARRIVED, "10:00")),
                announcements = listOf(WeddingAnnouncement("aa1", "Announce A", "Body A", AnnouncementUrgency.INFO))
            ),
            "wed_b" to Graph(
                wedding = Wedding(
                    "wed_b", "Bongai & Blessing", "2026-12-12T11:00:00Z", "Venue B", "Address B",
                    "Bulawayo", "Zimbabwe", "before",
                    listOf(ProgrammeItem("pb", "Ceremony B", "11:00", "Chapel B", "B"))
                ),
                guests = listOf(Guest("gb1", "Guest B One", "Household B", 4, "Groom", RSVPStatus.PENDING, 2, "Table B", false, 0, "PASSB1")),
                tasks = listOf(PlannerTask("tb1", "Task B", TaskStatus.DONE, TaskPriority.LOW, "Cat B")),
                vendors = listOf(VendorPresence("vb1", "Vendor B", "Sound", "Area B", VendorPresenceState.EN_ROUTE, "09:00")),
                announcements = listOf(WeddingAnnouncement("ab1", "Announce B", "Body B", AnnouncementUrgency.ALERT))
            )
        )

        private class Graph(
            val wedding: Wedding,
            val guests: List<Guest>,
            val tasks: List<PlannerTask>,
            val vendors: List<VendorPresence>,
            val announcements: List<WeddingAnnouncement>
        )

        private fun graph(weddingId: String) = graphs[weddingId]
            ?: throw WeddingScopeMismatch(weddingId, graphs.keys.toList())

        override suspend fun availableWeddingIds(): List<String> = graphs.keys.toList()
        override suspend fun resolveGuestIdentity(token: String): GuestIdentity? =
            graphs.entries.firstNotNullOfOrNull { (weddingId, g) ->
                g.guests.firstOrNull { it.passSerial == token }
                    ?.let { GuestIdentity(it.id, it.name, weddingId, token) }
            }
        override suspend fun getWedding(weddingId: String) = graph(weddingId).wedding
        override suspend fun getTasks(weddingId: String) = graph(weddingId).tasks
        override suspend fun getGuests(weddingId: String) = graph(weddingId).guests
        override suspend fun getVendors(weddingId: String) = graph(weddingId).vendors
        override suspend fun getAnnouncements(weddingId: String) = graph(weddingId).announcements
        override suspend fun getBudget(weddingId: String): BudgetSummary {
            graph(weddingId)
            return BudgetSummary("USD", 1.0, 1.0, 1.0, emptyList())
        }
        override suspend fun getAuditRecords(weddingId: String): List<CheckInAuditRecord> {
            graph(weddingId); return emptyList()
        }
        override suspend fun searchGuests(weddingId: String, query: String) =
            graph(weddingId).guests.filter { it.name.contains(query, true) }
        override suspend fun createTask(weddingId: String, title: String, priority: TaskPriority, category: String): PlannerTask {
            graph(weddingId); return PlannerTask("new", title, TaskStatus.TODO, priority, category)
        }
        override suspend fun toggleTask(weddingId: String, taskId: String) = graph(weddingId).tasks.first()
        override suspend fun checkInGuest(weddingId: String, qrPayload: String, count: Int, usherId: String): CheckInVerificationResult {
            graph(weddingId)
            return CheckInVerificationResult(CheckInStatus.INVALID_PASS, "", null, 0, 0, 0, null, null, "")
        }
        override suspend fun updateVendorState(weddingId: String, id: String, state: VendorPresenceState) =
            graph(weddingId).vendors.first()
        override suspend fun postAnnouncement(weddingId: String, title: String, message: String, urgency: AnnouncementUrgency) =
            graph(weddingId).announcements.first()
        override suspend fun getWeddingPass(token: String): WeddingPass = throw NotImplementedError()
        override suspend fun resolveInvitation(weddingSlug: String, token: String): InvitationContext = throw NotImplementedError()
        override suspend fun confirmRsvp(weddingSlug: String, token: String, attending: Boolean): WeddingPass = throw NotImplementedError()
    }

    @Test
    fun `wedding A context loads the wedding A graph`() = runBlocking {
        val scoped = TwoWeddingTestRepository().forWedding(weddingA)
        assertEquals(weddingA, scoped.getWedding().id)
        assertEquals("Amara & Anesu", scoped.getWedding().coupleNames)
        assertEquals(listOf("Guest A One"), scoped.getGuests().map { it.name })
        assertEquals(listOf("Task A"), scoped.getTasks().map { it.title })
        assertEquals(listOf("Vendor A"), scoped.getVendors().map { it.vendorName })
    }

    @Test
    fun `wedding B context loads the wedding B graph`() = runBlocking {
        val scoped = TwoWeddingTestRepository().forWedding(weddingB)
        assertEquals(weddingB, scoped.getWedding().id)
        assertEquals("Bongai & Blessing", scoped.getWedding().coupleNames)
        assertEquals(listOf("Guest B One"), scoped.getGuests().map { it.name })
        assertEquals(listOf("Task B"), scoped.getTasks().map { it.title })
        assertEquals(listOf("Vendor B"), scoped.getVendors().map { it.vendorName })
    }

    @Test
    fun `switching context cannot continue rendering the previous wedding`() = runBlocking {
        val source = TwoWeddingTestRepository()
        val a = source.forWedding(weddingA)
        val b = source.forWedding(weddingB)

        assertNotEquals(a.getGuests(), b.getGuests())
        assertNotEquals(a.getWedding().coupleNames, b.getWedding().coupleNames)
        // The wedding-A binding can never answer with wedding-B rows and vice versa.
        assertTrue(b.getGuests().none { it.name in a.getGuests().map { g -> g.name } })
    }

    @Test
    fun `a scoped repository always reports the wedding it is bound to`() = runBlocking {
        val source = TwoWeddingTestRepository()
        assertEquals(weddingA, source.forWedding(weddingA).weddingId)
        assertEquals(weddingB, source.forWedding(weddingB).weddingId)
    }

    @Test
    fun `requesting an unserved wedding is rejected rather than silently substituted`() = runBlocking {
        val source = TwoWeddingTestRepository()
        val failure = assertThrows(WeddingScopeMismatch::class.java) {
            runBlocking { source.forWedding("wed_not_mine") }
        }
        assertEquals("wed_not_mine", failure.requestedWeddingId)
    }

    @Test
    fun `a single wedding source rejects any other wedding`() = runBlocking {
        val fixture = FixtureWeddingRepository()
        val own = fixture.availableWeddingIds().single()
        // Its own wedding resolves.
        assertEquals(own, fixture.forWedding(own).getWedding().id)
        // Another wedding is refused instead of returning this source's graph.
        assertThrows(WeddingScopeMismatch::class.java) {
            runBlocking { fixture.forWedding("wed_someone_else") }
        }
        Unit
    }

    @Test
    fun `shadow reference source rejects a foreign wedding`() = runBlocking {
        val shadow = ShadowReferenceWeddingRepository()
        val own = shadow.availableWeddingIds().single()
        assertEquals(own, shadow.forWedding(own).getWedding().id)
        assertThrows(WeddingScopeMismatch::class.java) {
            runBlocking { shadow.forWedding("wed_someone_else") }
        }
        Unit
    }

    @Test
    fun `direct source calls for a foreign wedding are refused at every read`() = runBlocking {
        val shadow = ShadowReferenceWeddingRepository()
        val foreign = "wed_someone_else"
        assertThrows(WeddingScopeMismatch::class.java) { runBlocking { shadow.getWedding(foreign) } }
        assertThrows(WeddingScopeMismatch::class.java) { runBlocking { shadow.getGuests(foreign) } }
        assertThrows(WeddingScopeMismatch::class.java) { runBlocking { shadow.getTasks(foreign) } }
        assertThrows(WeddingScopeMismatch::class.java) { runBlocking { shadow.getBudget(foreign) } }
        assertThrows(WeddingScopeMismatch::class.java) { runBlocking { shadow.getVendors(foreign) } }
        assertThrows(WeddingScopeMismatch::class.java) { runBlocking { shadow.getAnnouncements(foreign) } }
        assertThrows(WeddingScopeMismatch::class.java) { runBlocking { shadow.getAuditRecords(foreign) } }
        Unit
    }
}
