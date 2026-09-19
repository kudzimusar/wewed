package pro.wewed.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import pro.wewed.app.models.InvitationDeepLink
import pro.wewed.app.models.NativeDeepLink
import pro.wewed.app.models.NativeDeepLinkParser

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
        assertEquals(
            NativeDeepLink.Pass,
            NativeDeepLinkParser.parse("https://wewed.pro/pass/example")
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
