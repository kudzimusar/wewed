import XCTest
@testable import WewedKit

/// NM05 protects the structural responsive contract that the device evidence exposed.
///
/// These tests do not pretend to certify screenshots. They pin the proposal/safe-area architecture:
/// physical viewport -> WewedScreenContainer -> bounded child/media -> native TabView safe area.
final class GuestResponsiveRootClosureTests: XCTestCase {
    private static func repositoryFile(_ path: String) throws -> URL {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent(path)
            if FileManager.default.fileExists(atPath: candidate.path) { return candidate }
            dir = dir.deletingLastPathComponent()
        }
        throw NSError(
            domain: "GuestResponsiveRootClosureTests",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Repository file not found: \(path)"]
        )
    }

    private static func source(_ path: String) throws -> String {
        try String(contentsOf: repositoryFile(path), encoding: .utf8)
    }

    func testSharedScreenContainerPublishesThePhysicalViewportWidth() throws {
        let source = try Self.source("apps/ios/Wewed/Theme/WewedScreenContainer.swift")

        XCTAssertTrue(source.contains("GeometryReader { proxy in"))
        XCTAssertTrue(source.contains(".frame(width: proxy.size.width, height: proxy.size.height"))
        XCTAssertTrue(source.contains(".environment(\\.wewedContentWidth, proxy.size.width)"))
        XCTAssertTrue(source.contains("func wewedMedia(height: CGFloat, horizontalInset: CGFloat = 0)"))
        XCTAssertTrue(source.contains("frame(width: max(containerWidth - horizontalInset, 1), height: height)"))
    }

    func testLiveGuestUsesNativeTabViewAndSharedBoundedViewport() throws {
        let source = try Self.source(
            "apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift"
        )

        XCTAssertTrue(source.contains("TabView(selection: tabSelection)"))
        XCTAssertTrue(source.contains("WewedScreenContainer {"))
        XCTAssertTrue(source.contains(".tabItem {"))
        XCTAssertTrue(source.contains("Label(candidate.label, systemImage: candidate.icon)"))
        XCTAssertTrue(source.contains(".tint(WeddingIdentityPalette.champagneDeep)"))

        XCTAssertFalse(source.contains("guestBottomNavigation("))
        XCTAssertFalse(source.contains(".safeAreaInset(edge: .bottom"))
        XCTAssertFalse(source.contains("GeometryReader { viewport in"))
    }

    func testHomeHeroMediaCannotDetermineRootWidth() throws {
        let source = try Self.source(
            "apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift"
        )
        let heroStart = try XCTUnwrap(source.range(of: "private var guestHero"))
        let passStart = try XCTUnwrap(
            source.range(of: "/// Admission only", range: heroStart.upperBound..<source.endIndex)
        )
        let hero = String(source[heroStart.lowerBound..<passStart.lowerBound])

        XCTAssertTrue(hero.contains(".wewedMedia(height: 350, horizontalInset: 40)"))
        XCTAssertTrue(hero.contains(".wewedBoundedWidth(horizontalInset: 40)"))
        XCTAssertFalse(hero.contains(".scaledToFill()\n                .frame(maxWidth: .infinity)"))
    }

    func testPersistentGuestScreensDoNotUseWholeScreenHorizontalScrolling() throws {
        let shell = try Self.source(
            "apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift"
        )
        XCTAssertFalse(shell.contains("ScrollView(.horizontal"))
        XCTAssertFalse(shell.contains("ScrollView([.horizontal"))

        let invitation = try Self.source(
            "apps/ios/Wewed/Views/Invitation/LiveGuestInvitationView.swift"
        )
        let rsvpStart = try XCTUnwrap(invitation.range(of: "private struct LiveRsvpFormView"))
        let rsvp = String(invitation[rsvpStart.lowerBound...])
        XCTAssertEqual(
            rsvp.components(separatedBy: "ScrollView(.horizontal, showsIndicators: false)").count - 1,
            1,
            "the bounded meal selector is the only intentional horizontal RSVP scroller"
        )
    }

    func testLiveGuestStillUsesCanonicalPassAndGuestOnlyAuthority() throws {
        let shell = try Self.source(
            "apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift"
        )
        XCTAssertTrue(shell.contains("WeddingReferencePassView(pass: pass, showScanner: false)"))
        XCTAssertTrue(shell.contains("coordinator.weddingPass(guestId: profile.guestId)"))
        XCTAssertFalse(shell.contains("WeddingRepository"))
        XCTAssertFalse(shell.contains("WeddingGraphState"))
        XCTAssertFalse(shell.contains("QRCodeGenerator("))
    }

    func testIvoryDynamicTextUsesFittingVariantsWithoutRewritingSourceStrings() throws {
        let ivory = try Self.source(
            "apps/ios/Wewed/Views/Invitation/Ivory/IvoryFloralGoldNative.swift"
        )
        XCTAssertTrue(ivory.contains("ViewThatFits(in: .vertical)"))
        XCTAssertTrue(ivory.contains("fixedSize(horizontal: false, vertical: true)"))
        XCTAssertTrue(ivory.contains("fittedScriptText("))
        XCTAssertTrue(ivory.contains("fittedBodyText("))
        XCTAssertTrue(ivory.contains("fittedVenueText("))
        XCTAssertTrue(ivory.contains("fittedGuestPersonalization(w: w)"))

        // NM05 must fit the authoritative string, not manufacture or strip an ellipsis.
        XCTAssertFalse(ivory.contains("replacingOccurrences(of: \"...\""))
        XCTAssertFalse(ivory.contains("prefix("))
    }

    func testLiveInvitationDataTracePreservesServerDynamicFields() throws {
        let presentation = try Self.source(
            "apps/ios/Wewed/Invitation/LiveInvitationPresentation.swift"
        )
        XCTAssertTrue(presentation.contains("coupleNames: snapshot.title"))
        XCTAssertTrue(presentation.contains("monogram: snapshot.monogram"))
        XCTAssertTrue(presentation.contains("tagline: snapshot.tagline"))
        XCTAssertTrue(presentation.contains("weddingDate: snapshot.date"))
        XCTAssertTrue(presentation.contains("venue: snapshot.venue"))
        XCTAssertTrue(presentation.contains("rsvpDeadline: snapshot.rsvpDeadline"))

        let invitation = try Self.source(
            "apps/ios/Wewed/Views/Invitation/LiveGuestInvitationView.swift"
        )
        XCTAssertTrue(invitation.contains("coupleNames: coupleNames"))
        XCTAssertTrue(invitation.contains("monogram: monogram ?? initials"))
        XCTAssertTrue(invitation.contains("tagline: tagline"))
        XCTAssertTrue(invitation.contains("guestName: guestName"))
        XCTAssertTrue(invitation.contains("rsvpDeadlineLabel: rsvpDeadline"))
    }

    func testCoupleNoteHotspotUsesHighPriorityGestureInsideScrollableDetails() throws {
        let ivory = try Self.source(
            "apps/ios/Wewed/Views/Invitation/Ivory/IvoryFloralGoldNative.swift"
        )

        XCTAssertTrue(ivory.contains("gestureHit("))
        XCTAssertTrue(ivory.contains("IvoryGeometry.hitNote"))
        XCTAssertTrue(ivory.contains(".highPriorityGesture("))
        XCTAssertTrue(ivory.contains("TapGesture().onEnded { action() }"))
        XCTAssertTrue(ivory.contains(".accessibilityAction { action() }"))
        XCTAssertTrue(ivory.contains(".accessibilityIdentifier(identifier)"))
    }

    func testIvoryDetailHotspotsUseNativeButtonsForReliableActivation() throws {
        let ivory = try Self.source(
            "apps/ios/Wewed/Views/Invitation/Ivory/IvoryFloralGoldNative.swift"
        )
        let hitStart = try XCTUnwrap(ivory.range(of: "private func hit("))
        let openDoors = try XCTUnwrap(
            ivory.range(of: "private func openDoors()", range: hitStart.upperBound..<ivory.endIndex)
        )
        let hit = String(ivory[hitStart.lowerBound..<openDoors.lowerBound])

        XCTAssertTrue(hit.contains("Button(action: action)"))
        XCTAssertTrue(hit.contains(".buttonStyle(.plain)"))
        XCTAssertTrue(hit.contains(".accessibilityIdentifier(identifier)"))
        XCTAssertFalse(hit.contains(".onTapGesture(perform: action)"))
    }

    func testAllFiveGuestDestinationsRemainPresent() {
        XCTAssertEqual(
            GuestSection.allCases.map(\.label),
            ["Home", "Invitation", "Pass", "Wedding Day", "More"]
        )
    }
}
