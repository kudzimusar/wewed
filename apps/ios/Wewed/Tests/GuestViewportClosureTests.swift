import XCTest
import CoreGraphics
@testable import WewedKit

/// NM04 protects only the three device-observed iOS viewport defects.
///
/// These tests deliberately assert geometry and source composition, not screenshot perfection.
/// Device visual acceptance remains the next LNM gate.
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

    func testCountdownPartitionsAnyBoundedParentWidthIntoFourEqualCells() {
        // NM05 no longer pretends to derive the SwiftUI proposal from guessed outer padding.
        // The shared WewedScreenContainer contract proves the parent is bounded; this pure helper
        // only proves that whatever bounded width the row actually receives is divided exactly.
        for rowWidth: CGFloat in [260, 280, 300, 320, 350] {
            let tile = GuestViewportGeometry.countdownTileWidth(rowWidth: rowWidth)
            let reconstructed =
                tile * GuestViewportGeometry.countdownTileCount +
                GuestViewportGeometry.countdownInterTileSpacing *
                    (GuestViewportGeometry.countdownTileCount - 1)

            XCTAssertEqual(reconstructed, rowWidth, accuracy: 0.001)
            XCTAssertGreaterThan(tile, 0)
        }
    }

    func testCountdownSourcePinsDaysHoursMinsSecsToMeasuredEqualWidths() throws {
        let source = try String(
            contentsOf: Self.repositoryFile(
                "apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift"
            ),
            encoding: .utf8
        )
        let heroStart = try XCTUnwrap(source.range(of: "private var guestHero"))
        let passStart = try XCTUnwrap(
            source.range(of: "/// Admission only", range: heroStart.upperBound..<source.endIndex)
        )
        let hero = String(source[heroStart.lowerBound..<passStart.lowerBound])

        XCTAssertTrue(hero.contains("GeometryReader { rowProxy in"))
        XCTAssertTrue(hero.contains("GuestViewportGeometry.countdownTileWidth"))
        XCTAssertTrue(hero.contains("guestCountdownTile(countdown.days, \"Days\", width: tileWidth)"))
        XCTAssertTrue(hero.contains("guestCountdownTile(countdown.hours, \"Hours\", width: tileWidth)"))
        XCTAssertTrue(hero.contains("guestCountdownTile(countdown.minutes, \"Mins\", width: tileWidth)"))
        XCTAssertTrue(hero.contains("guestCountdownTile(countdown.seconds, \"Secs\", width: tileWidth)"))
        XCTAssertTrue(hero.contains(".frame(width: width)"))
        XCTAssertFalse(hero.contains("guestCountdownTile(_ value: Int, _ label: String)"))
    }

    // NM06: even if an inner GeometryReader is accidentally offered more width than the phone,
    // the published physical Guest viewport remains the invitation's sizing authority.
    func testInvitationStageNeverExceedsPublishedPhysicalViewport() {
        for viewport in phoneWidths {
            let resolved = IvoryViewportGeometry.boundedViewportWidth(
                proposedWidth: viewport + 120,
                publishedWidth: viewport
            )
            let stage = IvoryViewportGeometry.stageWidth(
                proposedWidth: viewport + 120,
                publishedWidth: viewport
            )

            XCTAssertEqual(resolved, viewport, accuracy: 0.001)
            XCTAssertLessThanOrEqual(stage, viewport)
            XCTAssertLessThanOrEqual(stage, IvoryGeometry.maxStageWidth)
        }
    }

    func testInvitationDetailFooterPairAlwaysFitsAuthoredStage() {
        for viewport in phoneWidths {
            let stage = IvoryViewportGeometry.stageWidth(
                proposedWidth: viewport,
                publishedWidth: viewport
            )
            let content = IvoryViewportGeometry.detailFooterContentWidth(stageWidth: stage)
            let button = IvoryViewportGeometry.detailFooterButtonWidth(
                stageWidth: stage,
                includesPass: true
            )
            let reconstructed =
                button * 2 +
                IvoryViewportGeometry.detailFooterSpacing +
                IvoryViewportGeometry.detailFooterInset * 2

            XCTAssertEqual(reconstructed, stage, accuracy: 0.001)
            XCTAssertLessThanOrEqual(content, stage)
            XCTAssertGreaterThan(button, 0)
        }
    }

    func testCanonicalWeddingPassWidthChainFitsRepresentativeIPhones() {
        for viewport in phoneWidths {
            let resolved = WeddingPassViewportGeometry.boundedViewportWidth(
                proposedWidth: viewport + 96,
                publishedWidth: viewport
            )
            let card = WeddingPassViewportGeometry.cardWidth(viewportWidth: resolved)
            let content = WeddingPassViewportGeometry.cardContentWidth(viewportWidth: resolved)
            let qrPlate = WeddingPassViewportGeometry.qrPlateWidth(viewportWidth: resolved)
            let qr = WeddingPassViewportGeometry.qrCodeWidth(viewportWidth: resolved)

            XCTAssertEqual(resolved, viewport, accuracy: 0.001)
            XCTAssertEqual(
                card + WeddingPassViewportGeometry.outerInset * 2,
                viewport,
                accuracy: 0.001
            )
            XCTAssertEqual(
                content + WeddingPassViewportGeometry.cardPadding * 2,
                card,
                accuracy: 0.001
            )
            XCTAssertLessThanOrEqual(card, viewport)
            XCTAssertLessThanOrEqual(qrPlate, content)
            XCTAssertLessThanOrEqual(qr, qrPlate)
            XCTAssertGreaterThan(qr, 0)
        }
    }

    func testCanonicalPassDecorationCannotBecomeSizingAuthorityAndTextWraps() throws {
        let source = try String(
            contentsOf: Self.repositoryFile(
                "apps/ios/Wewed/Views/Pass/WeddingReferencePassView.swift"
            ),
            encoding: .utf8
        )
        let start = try XCTUnwrap(source.range(of: "private func passCard("))
        let end = try XCTUnwrap(
            source.range(of: "private func preparePass()", range: start.upperBound..<source.endIndex)
        )
        let card = String(source[start.lowerBound..<end.lowerBound])

        XCTAssertTrue(card.contains(".frame(width: cardWidth)"))
        XCTAssertTrue(card.contains(".background {"))
        XCTAssertTrue(card.contains("WewedMediaImage(WewedAsset.ornamentFrame)"))
        XCTAssertFalse(
            card.contains("ZStack {\n            WewedMediaImage(WewedAsset.ornamentFrame)"),
            "ornament must remain decoration, never a child that participates in card sizing"
        )
        XCTAssertGreaterThanOrEqual(
            card.components(separatedBy: ".fixedSize(horizontal: false, vertical: true)").count - 1,
            5,
            "dynamic Pass strings must wrap vertically inside the bounded content width"
        )
    }

}
