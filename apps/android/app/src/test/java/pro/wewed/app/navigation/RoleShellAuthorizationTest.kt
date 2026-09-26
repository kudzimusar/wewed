package pro.wewed.app.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.AppRole

/**
 * Phase 1 independent review — the role shell renders content only for a destination that
 * [Entitlements.resolve] allowed for a context that holds a verified assignment.
 *
 * The iOS counterpart (`RoleShellAuthorizationTests`) asserts the same rules.
 */
class RoleShellAuthorizationTest {

    private fun firstDestination(role: AppRole) = IANavigationContract.forRole(role).primary.first().id

    @Test
    fun aRoleWithNoAssignmentOpensNoWorkspaceAndRendersNothing() {
        AppRole.entries.forEach { role ->
            val context = AuthorizedContexts.unassigned(role)
            assertFalse("$role without an assignment", RoleShellAuthorization.admitsWorkspace(context))
            val shell = RoleShellAuthorization.initial(context)
            assertNull("$role renders no destination", shell.visibleDestinationId)
            assertFalse(shell.canDismissDenial)
        }
    }

    /** A system-scoped Admin may have no wedding, but never no assignment. */
    @Test
    fun aSystemAdminNeedsARealSystemScopeAssignment() {
        val admin = AuthorizedContexts.authorized(AppRole.ADMIN)
        assertNull(admin.assignment!!.weddingId)
        assertTrue(RoleShellAuthorization.admitsWorkspace(admin))
        assertFalse(RoleShellAuthorization.admitsWorkspace(AuthorizedContexts.unassigned(AppRole.ADMIN)))
    }

    @Test
    fun anAssignmentMissingARequiredScopeRendersNoDestination() {
        listOf(
            AuthorizedContexts.authorized(AppRole.GUEST).copy(activeGuestId = null),
            AuthorizedContexts.authorized(AppRole.USHER).copy(activeGateId = null),
            AuthorizedContexts.authorized(AppRole.VENDOR).copy(activeVendorId = null),
            AuthorizedContexts.authorized(AppRole.COUPLE).copy(activeWeddingId = "")
        ).forEach { context ->
            assertFalse(context.isComplete)
            assertFalse(RoleShellAuthorization.admitsWorkspace(context))
            assertNull(RoleShellAuthorization.initial(context).visibleDestinationId)
        }
    }

    @Test
    fun anAssignmentHeldByAnotherActorIsDenied() {
        val context = AuthorizedContexts.authorized(AppRole.PLANNER).copy(actorId = "someone_else")
        assertTrue("scopes are present", context.isComplete)
        assertFalse(RoleShellAuthorization.admitsWorkspace(context))
        assertNull(RoleShellAuthorization.initial(context).visibleDestinationId)
    }

    @Test
    fun anAssignmentForAnotherWeddingIsDenied() {
        val context = AuthorizedContexts.authorized(AppRole.COUPLE)
            .copy(activeWeddingId = AuthorizedContexts.OTHER_WEDDING)
        assertTrue(context.isComplete)
        assertFalse(RoleShellAuthorization.admitsWorkspace(context))
        assertNull(RoleShellAuthorization.initial(context).visibleDestinationId)
    }

    @Test
    fun aValidCompleteAssignmentAuthorizesTheInitialDestination() {
        AppRole.entries.forEach { role ->
            val context = AuthorizedContexts.authorized(role)
            assertTrue("$role", RoleShellAuthorization.admitsWorkspace(context))
            val shell = RoleShellAuthorization.initial(context)
            assertEquals(firstDestination(role), shell.visibleDestinationId)
            assertEquals(
                "the initial destination is exactly what Entitlements.resolve allows",
                Entitlements.resolve(context, firstDestination(role)),
                Entitlements.Resolution.Allowed(
                    IANavigationContract.forRole(role).primary.first(), context
                )
            )
        }
    }

    /**
     * The bypass this closes: a denial used to move the selection to its safe return, so "Go back"
     * showed that destination without it ever having been resolved. With nothing authorized, the
     * actor stays at the boundary.
     */
    @Test
    fun dismissingADeniedDeepLinkCannotRevealSafeReturnContentWithoutAuthorization() {
        val unauthorized = AuthorizedContexts.unassigned(AppRole.PLANNER)
        val denied = Entitlements.resolve(unauthorized, "clients")
        assertTrue(denied is Entitlements.Resolution.Denied)

        val shell = RoleShellAuthorization.initial(unauthorized).applying(denied)
        assertNull(shell.visibleDestinationId)
        assertFalse("there is nowhere authorized to go back to", shell.canDismissDenial)
        val dismissed = shell.dismissingDenial()
        assertNull("dismissal must not reveal the safe return", dismissed.visibleDestinationId)
        assertEquals(shell, dismissed)
    }

    /** With a valid context, dismissal returns to the last AUTHORIZED destination, not the safe return. */
    @Test
    fun dismissalReturnsOnlyToTheLastAuthorizedDestination() {
        val context = AuthorizedContexts.authorized(AppRole.PLANNER)
        val onClients = RoleShellAuthorization.initial(context).selecting(context, "clients")
        assertEquals("clients", onClients.visibleDestinationId)

        val denied = onClients.applying(
            Entitlements.Resolution.Denied("Not part of this workspace.", safeReturnDestinationId = "workspace")
        )
        assertNull("a denial renders the boundary, not content", denied.visibleDestinationId)
        assertEquals("clients", denied.authorizedDestinationId)

        val dismissed = denied.dismissingDenial()
        assertEquals("clients", dismissed.visibleDestinationId)
    }

    @Test
    fun aTabTapIsResolvedLikeADeepLink() {
        val context = AuthorizedContexts.authorized(AppRole.GUEST)
        val shell = RoleShellAuthorization.initial(context).selecting(context, "not_a_guest_destination")
        assertNull(shell.visibleDestinationId)
        assertEquals(firstDestination(AppRole.GUEST), shell.authorizedDestinationId)
    }
}
