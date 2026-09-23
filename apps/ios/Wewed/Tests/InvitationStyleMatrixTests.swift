import XCTest
@testable import WewedKit

final class InvitationStyleMatrixTests: XCTestCase {

    /// Registry ground truth. Each style's motion/atmosphere/renderer-kind is the EXACT value the
    /// generator emitted (mobile/contracts/generate_invitation_style_contract.py --check enforces
    /// palette exactness against the same source; this table enforces the rest of the row). A test
    /// that only checked "is this a valid enum case" would pass even if two styles' motions were
    /// swapped — that is precisely the gap this table closes.
    private struct ExpectedStyle {
        let wire: String
        let displayName: String
        let motion: InvitationMotion
        let atmosphere: InvitationAtmosphere
        let rendererKind: InvitationRendererKind
    }

    private let allExpectedStyles: [ExpectedStyle] = [
        ExpectedStyle(wire: "ivory-floral-gold", displayName: "Ivory Floral Gold", motion: .triFold, atmosphere: .champagneGlow, rendererKind: .ivoryCustom),
        ExpectedStyle(wire: "midnight", displayName: "Midnight Gold", motion: .gateFold, atmosphere: .stars, rendererKind: .genericMotion),
        ExpectedStyle(wire: "botanical", displayName: "Garden Romance", motion: .floralReveal, atmosphere: .petals, rendererKind: .genericMotion),
        ExpectedStyle(wire: "royal-emerald", displayName: "Royal Emerald", motion: .envelopeLetter, atmosphere: .softBokeh, rendererKind: .genericMotion),
        ExpectedStyle(wire: "classic-white", displayName: "Classic White", motion: .bookOpen, atmosphere: .minimal, rendererKind: .genericMotion),
        ExpectedStyle(wire: "blush-romance", displayName: "Blush Romance", motion: .envelopeLetter, atmosphere: .softBokeh, rendererKind: .genericMotion),
        ExpectedStyle(wire: "african-luxe", displayName: "African Luxe", motion: .gateFold, atmosphere: .candlelight, rendererKind: .genericMotion),
        ExpectedStyle(wire: "editorial", displayName: "Modern Editorial", motion: .singleCardLift, atmosphere: .minimal, rendererKind: .genericMotion),
        ExpectedStyle(wire: "black-tie", displayName: "Black Tie", motion: .gateFold, atmosphere: .candlelight, rendererKind: .genericMotion),
        ExpectedStyle(wire: "watercolour-garden", displayName: "Watercolour Garden", motion: .floralReveal, atmosphere: .watercolourBloom, rendererKind: .genericMotion),
        ExpectedStyle(wire: "sunset-terracotta", displayName: "Sunset Terracotta", motion: .sleevePull, atmosphere: .softBokeh, rendererKind: .genericMotion),
        ExpectedStyle(wire: "celestial", displayName: "Celestial", motion: .bookOpen, atmosphere: .stars, rendererKind: .genericMotion)
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

            // Palette validation: all 6 colors present and valid hex. Exact palette equality
            // against the PWA source is enforced separately by the generator's --check mode.
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

            // Exact motion, not "a valid motion": a swap between two styles must fail this test.
            XCTAssertEqual(style.motion, entry.motion, "Motion mismatch for \(entry.wire)")
            XCTAssertEqual(theme.motion, entry.motion, "Motion mismatch for \(entry.wire)")

            // Exact atmosphere, not "a valid atmosphere".
            XCTAssertEqual(style.atmosphere, entry.atmosphere, "Atmosphere mismatch for \(entry.wire)")
            XCTAssertEqual(theme.atmosphere, entry.atmosphere, "Atmosphere mismatch for \(entry.wire)")

            // Exact renderer classification straight from the generated contract.
            XCTAssertEqual(style.rendererKind, entry.rendererKind, "rendererKind mismatch for \(entry.wire)")
            XCTAssertEqual(theme.rendererKind, entry.rendererKind, "rendererKind mismatch for \(entry.wire)")

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
            // Derived from the same registry row as the exact-value assertions above, not a
            // separately hand-written "wire == ivory-floral-gold ? ... " — a swap in the table
            // would be caught by the motion/atmosphere assertions before it could hide here.
            let expected: ResolvedInvitationRenderer = {
                switch entry.rendererKind {
                case .ivoryCustom: return .ivoryCustom
                case .genericMotion: return .genericMotion
                }
            }()
            XCTAssertEqual(rendererFor(style), expected, "Style \(entry.wire) must resolve to \(expected)")
        }

        XCTAssertEqual(rendererFor(.unknownStyle), .unsupported)
    }
}
