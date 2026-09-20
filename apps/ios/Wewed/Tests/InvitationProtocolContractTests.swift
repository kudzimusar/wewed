import XCTest
@testable import WewedKit

/// Native must speak the invitation protocol that already exists.
///
/// A private invitation is a security protocol, not a URL convention: a second implementation that
/// merely looks similar is a second auth model. `mobile/contracts/invitation-protocol.json` is
/// generated from `origin/main`, and this test holds the native parser to it — including the
/// refusals, which are the part most easily lost.
final class InvitationProtocolContractTests: XCTestCase {

    private struct Handoff: Decodable {
        let secretPattern: String
        let resumePath: String
        let resumeQueryParam: String
        let androidIntentExtra: String
        let playInstallReferrerKey: String
        let forbiddenResumeParam: String
    }

    private struct Entry: Decodable {
        let inviteePath: String
        let inviteeQueryParam: String
        let cardQueryParamIsAdvisoryOnly: Bool
    }

    private struct Contract: Decodable {
        let contract: String
        let authority: String
        let handoff: Handoff
        let entry: Entry
    }

    private static func loadContract() throws -> Contract {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent("mobile/contracts/invitation-protocol.json")
            if FileManager.default.fileExists(atPath: candidate.path) {
                return try JSONDecoder().decode(Contract.self,
                                                from: try Data(contentsOf: candidate))
            }
            dir = dir.deletingLastPathComponent()
        }
        throw NSError(domain: "InvitationProtocolContractTests", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "Invitation protocol contract not found"])
    }

    private var contract: Contract!
    /// A handoff that is 43 base64url characters, as the server issues.
    private let validHandoff = String(repeating: "A", count: 43)

    override func setUpWithError() throws {
        contract = try Self.loadContract()
    }

    func testContractIsDerivedFromProductionMain() {
        XCTAssertEqual(contract.contract, "wewed-invitation-protocol/1")
        XCTAssertEqual(contract.authority, "origin/main")
    }

    func testHandoffShapeMatchesTheServerPattern() {
        XCTAssertTrue(InvitationEntryParser.isValidHandoff(validHandoff))
        for bad in [String(repeating: "A", count: 42),
                    String(repeating: "A", count: 44),
                    String(repeating: "A", count: 42) + "+"] {
            XCTAssertFalse(InvitationEntryParser.isValidHandoff(bad), "'\(bad)' must not be accepted")
        }
    }

    func testReferrerKeyMatchesTheServer() {
        XCTAssertEqual(InvitationEntryParser.playReferrerKey,
                       contract.handoff.playInstallReferrerKey)
    }

    func testPrivateInvitationLinkIsParsed() {
        let entry = InvitationEntryParser.entry(
            from: "https://wewed.pro/invite/charity-and-kudzie?rsvp=SECRET-TOKEN&card=ivory-floral-gold"
        )
        XCTAssertEqual(entry, .privateInvitation(weddingSlug: "charity-and-kudzie",
                                                 rsvpToken: "SECRET-TOKEN"))
    }

    /// The saved wedding design is authoritative. A forwarded or long-lived link must not be able
    /// to select someone else's stationery, so `card` is read by nobody on this side.
    func testCardParameterIsAdvisoryOnly() {
        XCTAssertTrue(contract.entry.cardQueryParamIsAdvisoryOnly)
        XCTAssertEqual(
            InvitationEntryParser.entry(from: "https://wewed.pro/invite/s?rsvp=T&card=midnight"),
            InvitationEntryParser.entry(from: "https://wewed.pro/invite/s?rsvp=T")
        )
    }

    func testResumeLinkYieldsAnOpaqueHandoff() {
        let url = "https://wewed.pro\(contract.handoff.resumePath)"
            + "?\(contract.handoff.resumeQueryParam)=\(validHandoff)"
        XCTAssertEqual(InvitationEntryParser.entry(from: url), .handoff(secret: validHandoff))
    }

    /// The refusal that matters most: `buildAndroidInvitationIntentUrl` will not emit a resume URL
    /// carrying `rsvp`, so one arriving here did not come from Wewed.
    func testResumeCarryingARawCredentialIsRefused() {
        let url = "https://wewed.pro/invite/resume?h=\(validHandoff)"
            + "&\(contract.handoff.forbiddenResumeParam)=LEAKED"
        XCTAssertEqual(InvitationEntryParser.entry(from: url), .rejected(.resumeCarriedRawCredential))
    }

    func testMalformedHandoffFailsClosed() {
        XCTAssertEqual(
            InvitationEntryParser.entry(from: "https://wewed.pro/invite/resume?h=too-short"),
            .rejected(.malformedHandoff)
        )
    }

    func testInviteLinkWithoutACredentialIdentifiesNobody() {
        XCTAssertEqual(
            InvitationEntryParser.entry(from: "https://wewed.pro/invite/charity-and-kudzie"),
            .rejected(.missingCredential)
        )
    }

    /// Only Wewed's own origins are invitation entry.
    func testForeignOriginsAreNotInvitationEntry() {
        XCTAssertNil(InvitationEntryParser.entry(from: "https://evil.example/invite/x?rsvp=T"))
        XCTAssertNil(InvitationEntryParser.entry(from: "http://wewed.pro.evil/invite/x?rsvp=T"))
    }

    /// A fresh explicit link outranks any stale deferred-install record.
    func testExplicitLaunchIsRecognised() {
        XCTAssertTrue(InvitationEntryParser.isExplicitInvitationLaunch(
            "https://wewed.pro/invite/slug?rsvp=T"))
        XCTAssertFalse(InvitationEntryParser.isExplicitInvitationLaunch("wewed://pass"))
        XCTAssertFalse(InvitationEntryParser.isExplicitInvitationLaunch(nil))
    }

    /// No credential may reach a log line through string interpolation.
    func testCredentialsAreRedactedInDescriptions() {
        let invitation = InvitationEntry.privateInvitation(weddingSlug: "slug",
                                                           rsvpToken: "SUPER-SECRET-TOKEN")
        XCTAssertFalse(invitation.redactedDescription.contains("SUPER-SECRET-TOKEN"))
        XCTAssertTrue(invitation.redactedDescription.contains("slug"))
        XCTAssertFalse(InvitationEntry.handoff(secret: validHandoff)
            .redactedDescription.contains(validHandoff))
    }
}
