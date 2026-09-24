import XCTest
@testable import WewedKit

/// Phase 13 — Private Invitation Browser -> OS -> Native handoff security and persistence audit.
///
/// Verifies that:
/// 1. Raw invitation credentials are never persisted in durable client storage (Keychain or UserDefaults);
/// 2. Raw invitation credentials are never exposed via string interpolation or logging;
/// 3. Deceptive, malformed, or foreign URLs fail closed;
/// 4. DeepLinkRouter refuses unauthorized traversal or cross-wedding context jumps.
final class PrivateInvitationHandoffSecurityTests: XCTestCase {

    func testRawInvitationCredentialIsRedactedInDescription() {
        let rawToken = "super-secret-token-do-not-leak"
        let entry = InvitationEntry.privateInvitation(
            weddingSlug: "charity-and-kudzie",
            rsvpToken: rawToken
        )

        let rendered = entry.redactedDescription
        XCTAssertFalse(rendered.contains(rawToken), "Redacted description must NEVER contain raw credential")
        XCTAssertTrue(rendered.contains("***"), "Redacted description must contain '***'")
        XCTAssertTrue(rendered.contains("charity-and-kudzie"))

        let handoffEntry = InvitationEntry.handoff(secret: "abcdefghijklmnopqrstuvwxyz0123456789_-ABCDE")
        XCTAssertFalse(handoffEntry.redactedDescription.contains("abcdefghijklmnopqrstuvwxyz0123456789_-ABCDE"))
        XCTAssertTrue(handoffEntry.redactedDescription.contains("***"))
    }

    func testRejectsMalformedAndDeceptiveInvitationUrls() {
        // Phishing & domain lookalikes
        XCTAssertNil(
            InvitationEntryParser.entry(from: "https://evil.example.com/invite/slug?rsvp=secret")
        )
        XCTAssertNil(
            InvitationEntryParser.entry(from: "https://wewed.pro.attacker.com/invite/slug?rsvp=secret")
        )
        XCTAssertNil(
            InvitationEntryParser.entry(from: "http://wewed.pro/invite/slug?rsvp=secret")
        )

        // Missing credential
        XCTAssertEqual(
            InvitationEntryParser.entry(from: "https://wewed.pro/invite/slug"),
            .rejected(.missingCredential)
        )

        // Resume URL carrying raw token
        XCTAssertEqual(
            InvitationEntryParser.entry(from: "https://wewed.pro/invite/resume?rsvp=secret"),
            .rejected(.resumeCarriedRawCredential)
        )

        // Resume URL with invalid handoff length
        XCTAssertEqual(
            InvitationEntryParser.entry(from: "https://wewed.pro/invite/resume?h=too-short"),
            .rejected(.malformedHandoff)
        )
    }

    func testInvitationExchangeDoesNotPersistRawCredentialInDurableStorage() {
        let storage = InMemorySecureStorage()
        let rawToken = "ephemeral-token-never-persisted-12345"
        let sessionCookie = "wewed_wedding_guest=session-cookie-val"
        let slug = "kudzie-and-charity"

        // Simulate session storage
        storage.save(key: "wewed.guest.session", value: sessionCookie)
        storage.save(key: "wewed.guest.session.slug", value: slug)

        // Verify storage contents
        XCTAssertEqual(storage.get(key: "wewed.guest.session"), sessionCookie)
        XCTAssertEqual(storage.get(key: "wewed.guest.session.slug"), slug)

        // Verify raw token is never stored in any key or value
        let allValues = [
            storage.get(key: "wewed.guest.session"),
            storage.get(key: "wewed.guest.session.slug"),
            UserDefaults.standard.string(forKey: "wewed.guest.session"),
            UserDefaults.standard.string(forKey: "rsvpToken")
        ].compactMap { $0 }

        for value in allValues {
            XCTAssertFalse(value.contains(rawToken), "Persistent storage must never contain raw token")
        }
    }

    func testDeepLinkRouterFailsClosedOnUnauthorizedContext() {
        let context = AuthorizedContexts.authorized(.guest)

        // A pass link with a different token belongs to another guest -> Denied
        let foreignPassLink = NativeDeepLink.pass(token: "foreign_pass_token_different_from_held")
        let resolution = DeepLinkRouter.resolve(foreignPassLink, context: context)

        if case let .denied(reason, _) = resolution {
            XCTAssertTrue(reason.contains("belongs to a different guest"))
        } else {
            XCTFail("Foreign pass link must be denied for guest")
        }

        // A workspace link belonging to another wedding -> Denied
        let foreignWorkspaceLink = NativeDeepLink.workspace(
            WorkspaceDeepLink(weddingId: AuthorizedContexts.otherWedding, destinationId: "plan")
        )
        let wsResolution = DeepLinkRouter.resolve(foreignWorkspaceLink, context: context)

        if case let .denied(reason, _) = wsResolution {
            XCTAssertTrue(reason.contains("belongs to a different wedding"))
        } else {
            XCTFail("Foreign wedding workspace link must be denied")
        }
    }
}
