package pro.wewed.app.navigation

import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.InvitationContext

/**
 * Launch routing.
 *
 * These rules used to live in the ORDER of early returns inside the root composable: resolve a
 * link, then check authentication, then resolve a context. Nothing stated them, so the most
 * important one — that an invitation outranks a sign-in form — could be undone by moving a block.
 * Routing is now a pure function, and each rule is a test.
 */
class LaunchRouterTest {

    private fun invitation(confirmed: Boolean = false, declined: Boolean = false) =
        InvitationContext(
            weddingSlug = "charity-and-kudzie",
            guestToken = "token-under-test",
            coupleNames = "Charity & Kudzie",
            guestName = "Invited Guest",
            partySize = 2,
            weddingDate = "2026-12-23T14:00:00",
            venueName = "Imba Manor",
            venueCity = "Harare, Zimbabwe",
            isConfirmed = confirmed,
            isDeclined = declined
        )

    // -----------------------------------------------------------------------------------
    // The rule that outranks everything else
    // -----------------------------------------------------------------------------------

    /**
     * An invited guest must never be asked to create an account in order to RSVP. The invitation
     * credential IS the guest-entry authorization.
     */
    @Test
    fun invitationOutranksSignInForAnUnauthenticatedGuest() {
        val state = LaunchRouter.route(
            invitation = invitation(),
            hasValidSession = false,
            authorizedRoles = emptyList(),
            hasResolvedContext = false
        )
        assertTrue("an invitation must not route to Welcome", state is NativeAppEntryState.Invitation)
        assertEquals(
            InvitationEntryStage.PENDING,
            (state as NativeAppEntryState.Invitation).stage
        )
    }

    /** The same holds when a session exists: the link they opened is what they asked for. */
    @Test
    fun invitationOutranksAnExistingSession() {
        val state = LaunchRouter.route(
            invitation = invitation(),
            hasValidSession = true,
            authorizedRoles = listOf(AppRole.COUPLE),
            hasResolvedContext = true
        )
        assertTrue(state is NativeAppEntryState.Invitation)
    }

    /** A guest who already accepted goes to their pass, not back through RSVP. */
    @Test
    fun confirmedGuestSkipsRsvp() {
        val state = LaunchRouter.route(
            invitation = invitation(confirmed = true),
            hasValidSession = false,
            authorizedRoles = emptyList(),
            hasResolvedContext = false
        ) as NativeAppEntryState.Invitation
        assertEquals(InvitationEntryStage.CONFIRMED, state.stage)
    }

    /** A guest who declined is not asked the question again. */
    @Test
    fun declinedGuestSeesTheirResponseNotTheRsvpForm() {
        val state = LaunchRouter.route(
            invitation = invitation(declined = true),
            hasValidSession = false,
            authorizedRoles = emptyList(),
            hasResolvedContext = false
        ) as NativeAppEntryState.Invitation
        assertEquals(InvitationEntryStage.DECLINED, state.stage)
    }

    // -----------------------------------------------------------------------------------
    // Ordinary launches
    // -----------------------------------------------------------------------------------

    @Test
    fun freshInstallWithNoInvitationShowsWelcome() {
        val state = LaunchRouter.route(
            invitation = null,
            hasValidSession = false,
            authorizedRoles = emptyList(),
            hasResolvedContext = false
        )
        assertEquals(NativeAppEntryState.Welcome, state)
    }

    @Test
    fun aSingleAuthorizedRoleGoesStraightToItsWorkspace() {
        val state = LaunchRouter.route(
            invitation = null,
            hasValidSession = true,
            authorizedRoles = listOf(AppRole.COUPLE),
            hasResolvedContext = true
        )
        assertEquals(NativeAppEntryState.Workspace(AppRole.COUPLE), state)
    }

    /** Asking someone to choose when there is only one answer is a step with no purpose. */
    @Test
    fun aSingleAuthorizedRoleIsNeverOfferedAChooser() {
        val state = LaunchRouter.route(
            invitation = null,
            hasValidSession = true,
            authorizedRoles = listOf(AppRole.PLANNER),
            hasResolvedContext = true
        )
        assertFalse(state is NativeAppEntryState.RoleSelection)
    }

    @Test
    fun severalAuthorizedRolesOfferAChooserListingOnlyThoseRoles() {
        val roles = listOf(AppRole.PLANNER, AppRole.COORDINATOR)
        val state = LaunchRouter.route(
            invitation = null,
            hasValidSession = true,
            authorizedRoles = roles,
            hasResolvedContext = true
        )
        assertTrue(state is NativeAppEntryState.RoleSelection)
        assertEquals(roles, (state as NativeAppEntryState.RoleSelection).authorizedRoles)
        // The chooser lists authorizations, never the full role taxonomy.
        assertFalse(state.authorizedRoles.contains(AppRole.ADMIN))
    }

    @Test
    fun anUnresolvedWeddingContextAsksForOneRatherThanOpeningAnEmptyWorkspace() {
        val state = LaunchRouter.route(
            invitation = null,
            hasValidSession = true,
            authorizedRoles = listOf(AppRole.PLANNER),
            hasResolvedContext = false
        )
        assertEquals(NativeAppEntryState.ContextSelection(AppRole.PLANNER), state)
    }

    /**
     * An authenticated identity the server authorized for nothing is an explicit state, not a
     * silent fallback into someone else's workspace.
     */
    @Test
    fun anAuthenticatedIdentityWithNoAuthorizationIsAnHonestError() {
        val state = LaunchRouter.route(
            invitation = null,
            hasValidSession = true,
            authorizedRoles = emptyList(),
            hasResolvedContext = false
        )
        assertTrue(state is NativeAppEntryState.Error)
    }

    @Test
    fun onboardingRunsAfterAuthorizationNotBeforeIt() {
        val state = LaunchRouter.route(
            invitation = null,
            hasValidSession = true,
            authorizedRoles = listOf(AppRole.COUPLE),
            hasResolvedContext = true,
            needsOnboarding = true
        )
        assertEquals(NativeAppEntryState.Onboarding(AppRole.COUPLE), state)
    }
}
