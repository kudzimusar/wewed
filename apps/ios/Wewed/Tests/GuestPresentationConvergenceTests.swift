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

    func testNM03GuestTabsHaveDistinctResponsibilities() throws {
        let url = try Self.repositoryFile(
            "apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift"
        )
        let source = try String(contentsOf: url, encoding: .utf8)

        func section(_ start: String, _ end: String) -> String {
            guard let startRange = source.range(of: start),
                  let endRange = source.range(of: end, range: startRange.upperBound..<source.endIndex)
            else { return "" }
            return String(source[startRange.upperBound..<endRange.lowerBound])
        }

        let home = section("private var home: some View", "private func openVenue()")
        XCTAssertTrue(home.contains("Directions to Venue"))
        XCTAssertTrue(home.contains("guest-home-pass"))
        XCTAssertTrue(home.contains("guest-home-digital-invitation"))
        XCTAssertTrue(home.contains("guest-home-next-programme"))
        XCTAssertTrue(home.contains("guest-home-announcement"))
        for forbidden in ["\"Meal\"", "\"Dietary / access\"", "\"Your message\"", "\"Your table\""] {
            XCTAssertFalse(home.contains(forbidden), "Home must not become Profile again via \(forbidden)")
        }

        let more = section("private var guestProfile: some View", "private var encodedWeddingSlug")
        for expected in ["Our Story", "Couple Website", "Gift & Contribution Info", "Help",
                         "Privacy & Legal", "My details", "This device"] {
            XCTAssertTrue(more.contains(expected), "More is missing \(expected)")
        }
        for forbidden in ["\"Meal\"", "\"Plus one\"", "\"Dietary / access\"", "\"Your message\"", "\"Table\""] {
            XCTAssertFalse(more.contains(forbidden), "More must not duplicate profile via \(forbidden)")
        }

        let day = section("private struct LiveGuestDayDataView: View", "private struct GuestPresentationSectionHeading")
        let programme = day.range(of: "\"Programme\"")
        let venue = day.range(of: "\"Venue & directions\"")
        let announcements = day.range(of: "\"Announcements\"")
        let arrival = day.range(of: "\"Arrival\"")
        XCTAssertNotNil(programme)
        XCTAssertNotNil(venue)
        XCTAssertNotNil(announcements)
        XCTAssertNotNil(arrival)
        if let programme, let venue, let announcements, let arrival {
            XCTAssertLessThan(programme.lowerBound, venue.lowerBound)
            XCTAssertLessThan(venue.lowerBound, announcements.lowerBound)
            XCTAssertLessThan(announcements.lowerBound, arrival.lowerBound)
        }
    }

    func testNM03GuestActionsUseWewedPaletteAndNoAlternateAuthority() throws {
        let invitation = try String(
            contentsOf: Self.repositoryFile(
                "apps/ios/Wewed/Views/Invitation/LiveGuestInvitationView.swift"
            ),
            encoding: .utf8
        )
        let shell = try String(
            contentsOf: Self.repositoryFile(
                "apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift"
            ),
            encoding: .utf8
        )

        for source in [invitation, shell] {
            XCTAssertFalse(source.contains("WewedColors.emerald"))
            XCTAssertFalse(source.contains(".foregroundStyle(.blue)"))
            XCTAssertFalse(source.contains(".foregroundColor(.blue)"))
            XCTAssertFalse(source.contains("WeddingGraphState"))
            XCTAssertFalse(source.contains("WeddingQRCodeView("))
            XCTAssertFalse(source.contains("QRCodeGenerator("))
        }
        XCTAssertTrue(invitation.contains("WeddingIdentityPalette.champagneDeep"))
        XCTAssertTrue(invitation.contains(".buttonStyle(.plain)"))
        XCTAssertTrue(shell.contains("Directions to Venue"))
        XCTAssertTrue(shell.contains("WeddingReferencePassView(pass: pass, showScanner: false)"))
        XCTAssertTrue(shell.contains("Update RSVP in Invitation"))
        XCTAssertTrue(shell.contains("safeAreaInset(edge: .bottom"))
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
