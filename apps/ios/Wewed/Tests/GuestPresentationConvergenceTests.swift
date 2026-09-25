import XCTest
@testable import WewedKit

/// NM 02 contract: presentation may converge on the qualified Wewed UI, but Guest authority,
/// state-machine semantics and the canonical WW2 Pass must not broaden or fork.
final class GuestPresentationConvergenceTests: XCTestCase {
    private static func repositoryFile(_ path: String) throws -> URL {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent(path)
            if FileManager.default.fileExists(atPath: candidate.path) { return candidate }
            dir = dir.deletingLastPathComponent()
        }
        throw NSError(
            domain: "GuestPresentationConvergenceTests",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Repository file not found: \(path)"]
        )
    }

    func testGuestNavigationRemainsExactlyFiveDestinations() {
        XCTAssertEqual(
            GuestSection.allCases.map(\.label),
            ["Home", "Invitation", "Pass", "Wedding Day", "More"]
        )
    }

    func testPendingGateAndAnsweredAccessRemainUnchanged() {
        XCTAssertFalse(GuestCapabilityPolicy.mayEnterPersistentExperience(attending: nil))
        XCTAssertTrue(GuestCapabilityPolicy.mayEnterPersistentExperience(attending: true))
        XCTAssertTrue(GuestCapabilityPolicy.mayEnterPersistentExperience(attending: false))
    }

    func testGuestShellReusesQualifiedPresentationWithoutCoupleRepositoryAuthority() throws {
        let url = try Self.repositoryFile(
            "apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift"
        )
        let source = try String(contentsOf: url, encoding: .utf8)

        XCTAssertTrue(source.contains("IASectionList"))
        XCTAssertTrue(source.contains("IACard"))
        XCTAssertTrue(source.contains("WeddingBrandMark()"))
        XCTAssertTrue(source.contains("WewedAsset.heroWedding"))
        XCTAssertTrue(source.contains("WeddingReferencePassView(pass: pass, showScanner: false)"))
        XCTAssertTrue(source.contains("section == .pass && profile.attending == true"))
        XCTAssertTrue(source.contains("No venue admission pass is currently issued"))

        for forbidden in [
            "WeddingGraphState",
            "AppState",
            "WeddingRepository",
            "scopedRepository()",
            "getBudget()",
            "getTasks()",
            "getGuests()",
            "getVendors()"
        ] {
            XCTAssertFalse(
                source.contains(forbidden),
                "Live Guest must not bind Couple authority via \(forbidden)"
            )
        }

        XCTAssertFalse(source.contains("WeddingQRCodeView("))
        XCTAssertFalse(source.contains("QRCodeGenerator("))
    }

    func testInvitationKeepsCanonicalIvoryFullRsvpAndAuthoritativeNote() throws {
        let url = try Self.repositoryFile(
            "apps/ios/Wewed/Views/Invitation/LiveGuestInvitationView.swift"
        )
        let source = try String(contentsOf: url, encoding: .utf8)

        XCTAssertTrue(source.contains("NativeInvitationExperience("))
        XCTAssertTrue(source.contains("presentation.invitationCardMessage"))
        XCTAssertTrue(source.contains("WeddingFloralBackground"))
        XCTAssertTrue(source.contains("WeddingBrandMark()"))
        XCTAssertTrue(source.contains("WeddingPrimaryButtonLabel"))
        XCTAssertTrue(source.contains("GuestRsvpUpdate("))

        for field in [
            "attending: accepting",
            "mealChoice: accepting ?",
            "plusOne: accepting ? plusOne : false",
            "plusOneName: (accepting && plusOne)",
            "plusOneMeal: (accepting && plusOne)",
            "kidsAttending: (accepting && !adultsOnly)",
            "kidsCount: (accepting && !adultsOnly && kidsAttending)",
            "dietaryNotes: accepting ?",
            "message: message.trimmingCharacters"
        ] {
            XCTAssertTrue(source.contains(field), "Full RSVP contract lost field: \(field)")
        }
    }

    func testInvitationReopensThroughLiveIvoryInsteadOfShadowOrWebview() throws {
        let shell = try String(
            contentsOf: Self.repositoryFile(
                "apps/ios/Wewed/Views/Invitation/GuestOnlyInvitationShellView.swift"
            ),
            encoding: .utf8
        )
        let invitation = try String(
            contentsOf: Self.repositoryFile(
                "apps/ios/Wewed/Views/Invitation/LiveGuestInvitationView.swift"
            ),
            encoding: .utf8
        )

        XCTAssertTrue(shell.contains("LiveGuestInvitationView("))
        XCTAssertTrue(shell.contains("selectedDestination = .invitation"))
        XCTAssertTrue(invitation.contains("NativeInvitationExperience("))
        XCTAssertFalse(shell.contains("WeddingRepository"))
        XCTAssertFalse(invitation.contains("WKWebView"))
    }
}
