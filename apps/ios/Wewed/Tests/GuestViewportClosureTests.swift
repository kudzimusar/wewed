import XCTest
import CoreGraphics
@testable import WewedKit

/// NM05 protects the live Guest shell with the same responsive contract already qualified by
/// Sanitized Shadow, while preserving NM04's RSVP and Couple Note closures.
///
/// These tests assert the width chain and source composition. Device visual acceptance remains a
/// separate LNM gate because SwiftUI proposal behavior and safe-area rendering must still be seen.
final class GuestViewportClosureTests: XCTestCase {
    private let phoneWidths: [CGFloat] = [360, 375, 393, 402, 430]

    private static func repositoryFile(_ path: String) throws -> URL {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent(path)
            if FileManager.default.fileExists(atPath: candidate.path) { return candidate }
            dir = dir.deletingLastPathComponent()
        }
        throw NSError(
            domain: "GuestViewportClosureTests",
            code: 1,
            userInfo: [NSLocalizedDescriptionKey: "Repository file not found: \(path)"]
        )
    }

    func testGuestShellAndCountdownWidthChainFitsRepresentativeIPhones() {
        for viewport in phoneWidths {
            let content = GuestViewportGeometry.shellContentWidth(viewportWidth: viewport)
            let row = GuestViewportGeometry.countdownRowWidth(heroWidth: content)
            let tile = GuestViewportGeometry.countdownTileWidth(rowWidth: row)
            let reconstructed =
                tile * GuestViewportGeometry.countdownTileCount +
                GuestViewportGeometry.countdownInterTileSpacing *
                    (GuestViewportGeometry.countdownTileCount - 1)

            XCTAssertEqual(
                content + GuestViewportGeometry.shellHorizontalInset * 2,
                viewport,
                accuracy: 0.001
            )
            XCTAssertEqual(
                row + GuestViewportGeometry.heroInternalPadding * 2,
                content,
                accuracy: 0.001
            )
            XCTAssertEqual(reconstructed, row, accuracy: 0.001)
            XCTAssertLessThanOrEqual(row, content)
            XCTAssertLessThanOrEqual(content, viewport)
            XCTAssertGreaterThan(tile, 0)
        }
    }

    func testLiveGuestShellReusesShadowResponsiveContainerAndNativeTabBar() throws {
        let source = try String(
            contentsOf: Self.repositoryFile(
                "apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift"
            ),
            encoding: .utf8
        )

        XCTAssertTrue(source.contains("WewedScreenContainer {"))
        XCTAssertTrue(source.contains("TabView(selection: tabSelection)"))
        XCTAssertTrue(source.contains(".tabItem {"))
        XCTAssertTrue(source.contains("Label(candidate.label, systemImage: candidate.icon)"))
        XCTAssertTrue(source.contains("GuestViewportGeometry.shellContentWidth"))
        XCTAssertFalse(source.contains("private func guestBottomNavigation"))
        XCTAssertFalse(source.contains(".safeAreaInset(edge: .bottom"))
    }

    func testGuestHeroUsesBoundedShadowMediaContractAndNoNestedRowGeometryReader() throws {
        let source = try String(
            contentsOf: Self.repositoryFile(
                "apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift"
            ),
            encoding: .utf8
        )
        let heroStart = try XCTUnwrap(source.range(of: "private func guestHero(width: CGFloat)"))
        let passStart = try XCTUnwrap(
            source.range(of: "/// Admission only", range: heroStart.upperBound..<source.endIndex)
        )
        let hero = String(source[heroStart.lowerBound..<passStart.lowerBound])

        XCTAssertTrue(hero.contains("GuestViewportGeometry.countdownRowWidth(heroWidth: width)"))
        XCTAssertTrue(hero.contains(".wewedMedia("))
        XCTAssertTrue(hero.contains("GuestViewportGeometry.shellHorizontalInset * 2"))
        XCTAssertTrue(hero.contains("GuestViewportGeometry.countdownTileWidth(rowWidth: rowWidth)"))
        XCTAssertTrue(hero.contains("guestCountdownTile(countdown.days, \"Days\", width: tileWidth)"))
        XCTAssertTrue(hero.contains("guestCountdownTile(countdown.hours, \"Hours\", width: tileWidth)"))
        XCTAssertTrue(hero.contains("guestCountdownTile(countdown.minutes, \"Mins\", width: tileWidth)"))
        XCTAssertTrue(hero.contains("guestCountdownTile(countdown.seconds, \"Secs\", width: tileWidth)"))
        XCTAssertTrue(hero.contains(".frame(width: rowWidth, alignment: .leading)"))
        XCTAssertTrue(hero.contains(".frame(width: width, height: 350)"))
        XCTAssertFalse(hero.contains("GeometryReader { rowProxy in"))
    }

    func testStandaloneInvitationAlsoPublishesBoundedViewport() throws {
        let source = try String(
            contentsOf: Self.repositoryFile(
                "apps/ios/Wewed/Views/Invitation/LiveGuestInvitationView.swift"
            ),
            encoding: .utf8
        )
        let bodyStart = try XCTUnwrap(source.range(of: "public var body: some View"))
        let venueStart = try XCTUnwrap(
            source.range(of: "private var venueDestination", range: bodyStart.upperBound..<source.endIndex)
        )
        let body = String(source[bodyStart.lowerBound..<venueStart.lowerBound])

        XCTAssertTrue(body.contains("WewedScreenContainer {"))
        XCTAssertTrue(body.contains("NativeInvitationExperience("))
    }

    func testRsvpWidthChainFitsRepresentativeIPhones() {
        for viewport in phoneWidths {
            let sheet = GuestViewportGeometry.rsvpSheetWidth(viewportWidth: viewport)
            let content = GuestViewportGeometry.rsvpContentWidth(viewportWidth: viewport)
            let choice = GuestViewportGeometry.rsvpAttendanceChoiceWidth(viewportWidth: viewport)

            XCTAssertEqual(
                sheet,
                viewport - GuestViewportGeometry.rsvpOuterInset * 2,
                accuracy: 0.001
            )
            XCTAssertEqual(
                content,
                sheet - GuestViewportGeometry.rsvpInternalPadding * 2,
                accuracy: 0.001
            )
            XCTAssertEqual(
                choice * 2 + GuestViewportGeometry.rsvpAttendanceSpacing,
                content,
                accuracy: 0.001
            )
            XCTAssertLessThanOrEqual(sheet, viewport)
            XCTAssertGreaterThan(choice, 0)
        }
    }

    func testRsvpRootIsVerticalAndMealCarouselIsTheOnlyHorizontalScrollRegion() throws {
        let source = try String(
            contentsOf: Self.repositoryFile(
                "apps/ios/Wewed/Views/Invitation/LiveGuestInvitationView.swift"
            ),
            encoding: .utf8
        )
        let start = try XCTUnwrap(source.range(of: "private struct LiveRsvpFormView"))
        let rsvp = String(source[start.lowerBound...])

        XCTAssertTrue(rsvp.contains("ScrollView(.vertical, showsIndicators: false)"))
        XCTAssertEqual(
            rsvp.components(separatedBy: "ScrollView(.horizontal, showsIndicators: false)").count - 1,
            1,
            "only the meal-option carousel may horizontally scroll"
        )
        XCTAssertTrue(rsvp.contains("frame(width: contentWidth)"))
        XCTAssertTrue(rsvp.contains("fixedWidth: attendanceChoiceWidth"))
        XCTAssertTrue(rsvp.contains("invitation-rsvp-meal-carousel"))
        XCTAssertTrue(rsvp.contains(".frame(width: contentWidth)"))
        XCTAssertTrue(rsvp.contains(".frame(minHeight: 50)"))
        XCTAssertFalse(rsvp.contains("ScrollView([.horizontal, .vertical]"))
    }

    func testCoupleNoteSurfaceAndTextRemainInsideRepresentativeIPhones() {
        for viewport in phoneWidths {
            let surface = GuestViewportGeometry.noteSurfaceWidth(viewportWidth: viewport)
            let text = GuestViewportGeometry.noteTextWidth(viewportWidth: viewport)

            XCTAssertLessThanOrEqual(surface, viewport)
            XCTAssertLessThanOrEqual(surface, GuestViewportGeometry.noteMaximumWidth)
            XCTAssertEqual(
                text + GuestViewportGeometry.noteInternalPadding * 2,
                surface,
                accuracy: 0.001
            )
            XCTAssertGreaterThan(text, 0)
        }
    }

    func testCoupleNoteUsesBoundedMultilineTextAndVisibleDismissal() throws {
        let source = try String(
            contentsOf: Self.repositoryFile(
                "apps/ios/Wewed/Views/Invitation/LiveGuestInvitationView.swift"
            ),
            encoding: .utf8
        )
        let start = try XCTUnwrap(source.range(of: "private func noteFromTheCouple"))
        let end = try XCTUnwrap(
            source.range(of: "/// The public couple site", range: start.upperBound..<source.endIndex)
        )
        let note = String(source[start.lowerBound..<end.lowerBound])

        XCTAssertTrue(note.contains("GuestViewportGeometry.noteSurfaceWidth"))
        XCTAssertTrue(note.contains("GuestViewportGeometry.noteTextWidth"))
        XCTAssertTrue(note.contains(".frame(width: textWidth, alignment: .center)"))
        XCTAssertTrue(note.contains(".fixedSize(horizontal: false, vertical: true)"))
        XCTAssertTrue(note.contains("invitation-note-dismiss"))
        XCTAssertTrue(note.contains("invitation-note-message"))
        XCTAssertFalse(note.contains(".lineLimit(1)"))
        XCTAssertFalse(note.contains("ScrollView(.horizontal"))
    }

    func testIvoryDynamicTextScalesInsideAuthoredRegions() throws {
        let source = try String(
            contentsOf: Self.repositoryFile(
                "apps/ios/Wewed/Views/Invitation/Ivory/IvoryFloralGoldNative.swift"
            ),
            encoding: .utf8
        )

        XCTAssertTrue(source.contains(".minimumScaleFactor(0.52)"))
        XCTAssertTrue(source.contains(".minimumScaleFactor(0.50)"))
        XCTAssertTrue(source.contains(".minimumScaleFactor(0.65)"))
        XCTAssertTrue(source.contains(".minimumScaleFactor(0.70)"))
    }
}
