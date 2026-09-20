package pro.wewed.app.navigation

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.ShadowReferenceWeddingRepository
import pro.wewed.app.services.forOnlyWedding

/**
 * P0-2 — authorization is actor + role + wedding + sub-scope + relationship.
 *
 * Every case here holds a legitimate *role* and is still denied, because the relationship does not
 * hold. A role-only model would have allowed all of them.
 */
class RelationshipAuthorizationTest {

    private fun denied(context: NavigationContext, destinationId: String): Entitlements.Resolution.Denied {
        val resolution = Entitlements.resolve(context, destinationId)
        assertTrue(
            "Expected denial for ${context.activeRole.roleId}/$destinationId but got $resolution",
            resolution is Entitlements.Resolution.Denied
        )
        return resolution as Entitlements.Resolution.Denied
    }

    @Test
    fun `planner role without any assignment is denied its own workspace`() {
        val context = AuthorizedContexts.unassigned(AppRole.PLANNER)
        denied(context, "workspace")
        assertFalse(Entitlements.relationshipHolds(context))
    }

    @Test
    fun `planner assigned to a different wedding is denied this wedding`() {
        val context = AuthorizedContexts.authorized(AppRole.PLANNER).copy(
            assignment = AuthorizedContexts.assignment(
                AppRole.PLANNER,
                weddingId = AuthorizedContexts.OTHER_WEDDING
            )
        )
        val denial = denied(context, "workspace")
        assertTrue(denial.reason.contains("not assigned", ignoreCase = true))
    }

    @Test
    fun `vendor holding the wrong engagement is denied`() {
        val context = AuthorizedContexts.authorized(AppRole.VENDOR)
            .copy(activeEngagementId = AuthorizedContexts.OTHER_ENGAGEMENT)
        denied(context, "jobs")
    }

    @Test
    fun `vendor with no engagement at all is denied rather than defaulted`() {
        val context = AuthorizedContexts.authorized(AppRole.VENDOR).copy(activeEngagementId = null)
        val denial = denied(context, "jobs")
        assertTrue(denial.reason.contains("engagement", ignoreCase = true))
    }

    @Test
    fun `guest bound to a different guest record is denied`() {
        val context = AuthorizedContexts.authorized(AppRole.GUEST)
            .copy(activeGuestId = AuthorizedContexts.OTHER_GUEST)
        denied(context, "invitation")
    }

    @Test
    fun `guest with no identity binding is denied rather than shown a default guest`() {
        val context = AuthorizedContexts.authorized(AppRole.GUEST).copy(activeGuestId = null)
        val denial = denied(context, "pass")
        assertTrue(denial.reason.contains("invitation", ignoreCase = true))
    }

    @Test
    fun `usher assigned to a different gate is denied`() {
        val context = AuthorizedContexts.authorized(AppRole.USHER)
            .copy(activeGateId = AuthorizedContexts.OTHER_GATE)
        denied(context, "scan")
    }

    @Test
    fun `usher with no gate assignment is denied rather than given a default gate`() {
        val context = AuthorizedContexts.authorized(AppRole.USHER).copy(activeGateId = null)
        val denial = denied(context, "scan")
        assertTrue(denial.reason.contains("gate", ignoreCase = true))
    }

    @Test
    fun `coordinator not assigned to the wedding is denied`() {
        val context = AuthorizedContexts.authorized(AppRole.COORDINATOR).copy(
            assignment = AuthorizedContexts.assignment(
                AppRole.COORDINATOR,
                weddingId = AuthorizedContexts.OTHER_WEDDING
            )
        )
        denied(context, "today")
    }

    @Test
    fun `an assignment belonging to a different actor does not authorize this actor`() {
        val context = AuthorizedContexts.authorized(AppRole.PLANNER)
            .copy(assignment = AuthorizedContexts.assignment(AppRole.PLANNER, actorId = "someone_else"))
        denied(context, "workspace")
    }

    @Test
    fun `an assignment for a different role does not authorize this role`() {
        val context = AuthorizedContexts.authorized(AppRole.COORDINATOR)
            .copy(assignment = AuthorizedContexts.assignment(AppRole.PLANNER))
        denied(context, "today")
    }

    @Test
    fun `a fully assigned actor is allowed`() {
        AppRole.entries.forEach { role ->
            val context = AuthorizedContexts.authorized(role)
            val first = IANavigationContract.forRole(role).primary.first().id
            assertTrue(
                "${role.roleId} should be authorized for its own workspace",
                Entitlements.resolve(context, first) is Entitlements.Resolution.Allowed
            )
        }
    }

    // --- P0-3: the assignment source must not invent scopes ---

    @Test
    fun `shadow assignment source resolves vendor engagement from the repository`() = runBlocking {
        val repository = ShadowReferenceWeddingRepository()
        val source = ShadowActorAssignmentSource(repository, NativeDataEnvironment.SANITIZED_SHADOW)
        val vendorAssignment = source.assignments("vendor_owner").firstOrNull()
        assertNotNull("FAUME MEDIA has a recorded engagement on this wedding", vendorAssignment)
        // The engagement id must be a real VendorPresence on the wedding, not a placeholder.
        val engagements = repository.forOnlyWedding().getVendors().map { it.id }
        assertTrue(engagements.contains(vendorAssignment!!.engagementId))
    }

    @Test
    fun `shadow assignment source never sets client id to the wedding id`() = runBlocking {
        val source = ShadowActorAssignmentSource(ShadowReferenceWeddingRepository(), NativeDataEnvironment.SANITIZED_SHADOW)
        val planner = source.assignments("pro_planner").first()
        assertNull("Client id must not be fabricated from the wedding id", planner.clientId)
        assertTrue("Shadow planner access is test access, not a production engagement", planner.isShadowTestAccess)
    }

    @Test
    fun `shadow assignment source resolves guest identity from a credential`() = runBlocking {
        val source = ShadowActorAssignmentSource(ShadowReferenceWeddingRepository(), NativeDataEnvironment.SANITIZED_SHADOW)
        val guest = source.assignments("attending_guest").first()
        assertEquals("shadow_guest_011", guest.guestId)
        assertEquals("shadow-attending-guest", guest.passToken)
    }

    @Test
    fun `two shadow guests resolve to two different identities`() = runBlocking {
        // P0-4: with two guests declared, an identity bug cannot pass by collection order.
        val source = ShadowActorAssignmentSource(ShadowReferenceWeddingRepository(), NativeDataEnvironment.SANITIZED_SHADOW)
        val first = source.assignments("attending_guest").first()
        val second = source.assignments("attending_guest_party4").first()
        assertEquals("shadow_guest_011", first.guestId)
        assertEquals("shadow_guest_007", second.guestId)
        assertTrue(first.guestId != second.guestId)
        assertTrue(first.passToken != second.passToken)
    }

    @Test
    fun `an actor with no persona gets no assignment`() = runBlocking {
        val source = ShadowActorAssignmentSource(ShadowReferenceWeddingRepository(), NativeDataEnvironment.SANITIZED_SHADOW)
        assertTrue(source.assignments("not_a_real_actor").isEmpty())
    }

    @Test
    fun `gate assignment comes from the declared shadow table, not a display string`() = runBlocking {
        val source = ShadowActorAssignmentSource(ShadowReferenceWeddingRepository(), NativeDataEnvironment.SANITIZED_SHADOW)
        val usher = source.assignments("gate_usher").first()
        assertEquals("gate_main_entrance", usher.gateId)
        // An actor absent from the gate table has no gate and therefore no Gate workspace.
        val noGate = ShadowActorAssignmentSource(
            ShadowReferenceWeddingRepository(),
            NativeDataEnvironment.SANITIZED_SHADOW,
            gateAssignments = emptyMap()
        ).assignments("gate_usher")
        assertTrue(noGate.isEmpty())
    }

    @Test
    fun `admin assignment is system scoped and needs no wedding`() = runBlocking {
        val source = ShadowActorAssignmentSource(ShadowReferenceWeddingRepository(), NativeDataEnvironment.SANITIZED_SHADOW)
        val admin = source.assignments("administrator").first()
        assertNull(admin.weddingId)
        assertTrue(admin.isSystemScope)

        // P0-15: the Admin console opens without any wedding context.
        val context = AuthorizedContexts.authorized(AppRole.ADMIN)
        assertEquals("", context.activeWeddingId)
        assertTrue(context.isComplete)
        assertTrue(Entitlements.resolve(context, "dashboard") is Entitlements.Resolution.Allowed)
    }
}
