package pro.wewed.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import pro.wewed.app.models.InvitationDeepLink
import pro.wewed.app.models.NativeDeepLink
import pro.wewed.app.models.NativeDeepLinkParser
import pro.wewed.app.services.FixturePlannerDashboardRepository
import pro.wewed.app.services.FixtureWeddingRepository
import pro.wewed.app.state.AppTab
import pro.wewed.app.state.AppViewModel

private fun fixtureAppViewModel() = AppViewModel(
    baseRepository = FixtureWeddingRepository(),
    plannerRepository = FixturePlannerDashboardRepository(),
)

class NativeDeepLinkTest {
    @Test
    fun parsesPersonalInvitationLink() {
        assertEquals(
            NativeDeepLink.Invitation(
                InvitationDeepLink(
                    weddingSlug = "charity-and-kudzie",
                    rsvpToken = "guest-token-123"
                )
            ),
            NativeDeepLinkParser.parse(
                "https://wewed.pro/invite/charity-and-kudzie?rsvp=guest-token-123"
            )
        )
    }

    @Test
    fun parsesPassAndWeddingLinks() {
        // P0-9: the pass credential must survive parsing rather than being discarded.
        assertEquals(
            NativeDeepLink.Pass("example"),
            NativeDeepLinkParser.parse("https://wewed.pro/pass/example")
        )
        assertEquals(
            NativeDeepLink.Pass(null),
            NativeDeepLinkParser.parse("https://wewed.pro/pass")
        )
        assertEquals(
            NativeDeepLink.Wedding("charity-and-kudzie"),
            NativeDeepLinkParser.parse("https://wewed.pro/w/charity-and-kudzie")
        )
    }

    @Test
    fun failsClosedForForeignHostsAndInvitationWithoutCredential() {
        assertNull(
            NativeDeepLinkParser.parse(
                "https://example.com/invite/charity-and-kudzie?rsvp=guest-token-123"
            )
        )
        assertNull(
            NativeDeepLinkParser.parse(
                "https://wewed.pro/invite/charity-and-kudzie"
            )
        )
        assertNull(
            NativeDeepLinkParser.parse(
                "http://wewed.pro/invite/charity-and-kudzie?rsvp=guest-token-123"
            )
        )
    }

    @Test
    fun appViewModelRoutesInvitationBeforeAuthenticationShell() {
        val state = fixtureAppViewModel()

        state.handleIncomingUrl(
            "wewed://invite/charity-and-kudzie?rsvp=guest-token-123"
        )

        assertEquals(
            InvitationDeepLink(
                weddingSlug = "charity-and-kudzie",
                rsvpToken = "guest-token-123"
            ),
            state.pendingInvitationDeepLink.value
        )
        assertEquals(AppTab.HOME, state.selectedTab.value)
    }

    @Test
    fun appViewModelRoutesPassWithoutGuestCredentialLeakage() {
        val state = fixtureAppViewModel()
        state.handleIncomingUrl(
            "wewed://invite/charity-and-kudzie?rsvp=old-token"
        )

        state.handleIncomingUrl("wewed://pass/example")

        assertNull(state.pendingInvitationDeepLink.value)
        assertEquals(AppTab.WEDDING_DAY, state.selectedTab.value)
    }

    @Test
    fun parsesCustomSchemeInvitation() {
        assertEquals(
            NativeDeepLink.Invitation(
                InvitationDeepLink(
                    weddingSlug = "charity-and-kudzie",
                    rsvpToken = "guest-token-123"
                )
            ),
            NativeDeepLinkParser.parse(
                "wewed://invite/charity-and-kudzie?rsvp=guest-token-123"
            )
        )
    }
}
