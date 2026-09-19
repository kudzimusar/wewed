import XCTest
@testable import WewedKit

final class NativeDeepLinkTests: XCTestCase {
    func testParsesPersonalInvitationLink() {
        let link = NativeDeepLinkParser.parse(
            "https://wewed.pro/invite/charity-and-kudzie?rsvp=guest-token-123"
        )
        XCTAssertEqual(
            link,
            .invitation(
                InvitationDeepLink(
                    weddingSlug: "charity-and-kudzie",
                    rsvpToken: "guest-token-123"
                )
            )
        )
    }

    func testParsesPassAndWeddingLinks() {
        XCTAssertEqual(
            NativeDeepLinkParser.parse("https://wewed.pro/pass/example"),
            .pass
        )
        XCTAssertEqual(
            NativeDeepLinkParser.parse("https://wewed.pro/w/charity-and-kudzie"),
            .wedding("charity-and-kudzie")
        )
    }

    func testFailsClosedForForeignHostsAndInvitationWithoutCredential() {
        XCTAssertNil(
            NativeDeepLinkParser.parse(
                "https://example.com/invite/charity-and-kudzie?rsvp=guest-token-123"
            )
        )
        XCTAssertNil(
            NativeDeepLinkParser.parse(
                "https://wewed.pro/invite/charity-and-kudzie"
            )
        )
        XCTAssertNil(
            NativeDeepLinkParser.parse(
                "http://wewed.pro/invite/charity-and-kudzie?rsvp=guest-token-123"
            )
        )
    }

    func testAppStateRoutesInvitationBeforeAuthenticationShell() {
        let state = AppState()
        let url = URL(
            string: "wewed://invite/charity-and-kudzie?rsvp=guest-token-123"
        )!

        state.handleIncomingURL(url)

        XCTAssertEqual(
            state.pendingInvitationDeepLink,
            InvitationDeepLink(
                weddingSlug: "charity-and-kudzie",
                rsvpToken: "guest-token-123"
            )
        )
        XCTAssertEqual(state.selectedTab, .home)
    }

    func testAppStateRoutesPassWithoutGuestCredentialLeakage() {
        let state = AppState()
        state.pendingInvitationDeepLink = InvitationDeepLink(
            weddingSlug: "old",
            rsvpToken: "old-token"
        )

        state.handleIncomingURL(URL(string: "wewed://pass/example")!)

        XCTAssertNil(state.pendingInvitationDeepLink)
        XCTAssertEqual(state.selectedTab, .pass)
    }

    func testParsesCustomSchemeInvitation() {
        XCTAssertEqual(
            NativeDeepLinkParser.parse(
                "wewed://invite/charity-and-kudzie?rsvp=guest-token-123"
            ),
            .invitation(
                InvitationDeepLink(
                    weddingSlug: "charity-and-kudzie",
                    rsvpToken: "guest-token-123"
                )
            )
        )
    }
}
