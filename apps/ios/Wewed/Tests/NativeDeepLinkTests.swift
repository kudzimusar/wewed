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
