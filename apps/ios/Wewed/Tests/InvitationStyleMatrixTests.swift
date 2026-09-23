import XCTest
@testable import WewedKit

final class InvitationStyleMatrixTests: XCTestCase {

    private let allExpectedStyles: [(wire: String, displayName: String)] = [
        ("ivory-floral-gold", "Ivory Floral Gold"),
        ("midnight", "Midnight Gold"),
        ("botanical", "Garden Romance"),
        ("royal-emerald", "Royal Emerald"),
        ("classic-white", "Classic White"),
        ("blush-romance", "Blush Romance"),
        ("african-luxe", "African Luxe"),
        ("editorial", "Modern Editorial"),
        ("black-tie", "Black Tie"),
        ("watercolour-garden", "Watercolour Garden"),
        ("sunset-terracotta", "Sunset Terracotta"),
        ("celestial", "Celestial")
    ]

    func testAllTwelveStylesHaveNativeRenderersAndDistinctDefinitions() {
        XCTAssertEqual(allExpectedStyles.count, 12, "Exactly 12 styles expected in matrix")

        var renderedStyles = Set<InvitationStyle>()

        for entry in allExpectedStyles {
            let style = InvitationStyle.fromWire(entry.wire)
            XCTAssertNotEqual(style, .unknownStyle, "Style \(entry.wire) must not resolve to unknownStyle")
            XCTAssertEqual(style.wire, entry.wire, "Style wire mismatch")
            XCTAssertEqual(style.displayName, entry.displayName, "Display name mismatch")
            XCTAssertTrue(style.hasNativeRenderer, "Style \(entry.wire) must have native renderer")

            guard let theme = style.themeDefinition else {
                XCTFail("themeDefinition must not be nil for \(entry.wire)")
                continue
            }
            XCTAssertEqual(theme.id, entry.wire)

            // Palette validation: all 6 colors present and valid hex
            let hexRegex = try! NSRegularExpression(pattern: "^#[0-9a-fA-F]{6}$")
            let colors = [
                ("stage", theme.palette.stageHex),
                ("paper", theme.palette.paperHex),
                ("ink", theme.palette.inkHex),
                ("primary", theme.palette.primaryHex),
                ("accent", theme.palette.accentHex),
                ("muted", theme.palette.mutedHex)
            ]
            for (name, hex) in colors {
                let range = NSRange(location: 0, length: hex.utf16.count)
                XCTAssertNotNil(hexRegex.firstMatch(in: hex, range: range),
                                "Color \(name) for \(entry.wire) must be valid hex: \(hex)")
            }

            // Motion preset validation
            let validMotions: Set<InvitationMotion> = [
                .triFold, .gateFold, .envelopeLetter, .bookOpen, .singleCardLift, .floralReveal, .sleevePull
            ]
            XCTAssertTrue(validMotions.contains(style.motion),
                          "Motion preset \(style.motion) for \(entry.wire) must be one of defined presets")

            // Atmosphere preset validation
            let validAtmospheres: Set<InvitationAtmosphere> = [
                .champagneGlow, .softBokeh, .petals, .candlelight, .stars, .watercolourBloom, .minimal
            ]
            XCTAssertTrue(validAtmospheres.contains(style.atmosphere),
                          "Atmosphere preset \(style.atmosphere) for \(entry.wire) must be one of defined atmospheres")

            // No substitution to Ivory Floral Gold
            if entry.wire != "ivory-floral-gold" {
                XCTAssertNotEqual(style, .ivoryFloralGold, "Style \(entry.wire) must not equal ivoryFloralGold")
            }

            renderedStyles.insert(style)
        }

        XCTAssertEqual(renderedStyles.count, 12, "All 12 styles must be unique")
    }

    func testFallbackResolvesToBotanicalGardenRomance() {
        let fallback = InvitationStyle.default
        XCTAssertEqual(fallback, .botanical)
        XCTAssertEqual(fallback.wire, "botanical")
        XCTAssertEqual(fallback.displayName, "Garden Romance")
        XCTAssertNotEqual(fallback, .ivoryFloralGold)

        XCTAssertEqual(InvitationStyle.fromWire(nil), .botanical)
        XCTAssertEqual(InvitationStyle.fromWire(""), .botanical)
        XCTAssertEqual(InvitationStyle.fromWire("   "), .botanical)
    }

    func testUnknownStyleFailsClosedWithoutNativeRenderer() {
        let unknown = InvitationStyle.fromWire("nonexistent-future-style")
        XCTAssertEqual(unknown, .unknownStyle)
        XCTAssertFalse(unknown.hasNativeRenderer, "unknownStyle must fail closed without native renderer")
    }

    func testRsvpActionModelPreservedAcrossStatusesForAllStyles() {
        for style in InvitationStyle.allCases where style.hasNativeRenderer {
            XCTAssertEqual(ivoryRsvpActionLabel(rsvp: ivoryRsvpState(from: .pending)), "RSVP")
            XCTAssertEqual(ivoryRsvpActionLabel(rsvp: ivoryRsvpState(from: .attending)), "Update RSVP")
            XCTAssertEqual(ivoryRsvpActionLabel(rsvp: ivoryRsvpState(from: .declined)), "Update RSVP")
        }
    }

    func testRendererForDispatchesCorrectlyAcrossAllStyles() {
        XCTAssertEqual(rendererFor(.ivoryFloralGold), .ivoryCustom)

        for entry in allExpectedStyles {
            let style = InvitationStyle.fromWire(entry.wire)
            let expected: ResolvedInvitationRenderer = (entry.wire == "ivory-floral-gold") ? .ivoryCustom : .genericMotion
            XCTAssertEqual(rendererFor(style), expected, "Style \(entry.wire) must resolve to \(expected)")
        }

        XCTAssertEqual(rendererFor(.unknownStyle), .unsupported)
    }
}
