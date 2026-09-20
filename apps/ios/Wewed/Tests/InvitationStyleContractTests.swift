import XCTest
@testable import WewedKit

/// The native invitation catalogue must equal the web one.
///
/// `src/lib/digital-invitation-card.ts` is the registry the website renders from. The invitation is
/// a wedding-configured product object: a wedding saved as one design must render as THAT design.
///
/// This test exists because it did not. An earlier native build aliased `botanical`, `ivory`,
/// `ivory-floral`, `floral-gold` and an empty value all onto Ivory Floral Gold. `botanical` is
/// Garden Romance — a different palette, a different motif and a different reveal — and it is the
/// design the real UAT wedding is saved with, so every guest of that wedding would have been shown
/// another couple's stationery while the build reported invitation parity.
///
/// `mobile/contracts/invitation-styles.json` is generated from the web registry. Android asserts
/// the same contract, so the three cannot diverge silently.
final class InvitationStyleContractTests: XCTestCase {

    private struct Style: Decodable {
        let id: String
        let name: String
        let category: String
        let motion: String
        let atmosphere: String
        let nativeRenderer: Bool
    }

    private struct Contract: Decodable {
        let contract: String
        let fallbackStyleId: String
        let styles: [Style]
    }

    private static func loadContract() throws -> Contract {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent("mobile/contracts/invitation-styles.json")
            if FileManager.default.fileExists(atPath: candidate.path) {
                return try JSONDecoder().decode(Contract.self,
                                                from: try Data(contentsOf: candidate))
            }
            dir = dir.deletingLastPathComponent()
        }
        throw NSError(domain: "InvitationStyleContractTests", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "Shared invitation style contract not found"])
    }

    private var contract: Contract!

    override func setUpWithError() throws {
        contract = try Self.loadContract()
    }

    /// Every style the website offers is a style native can at least NAME.
    func testEveryWebStyleHasANativeIdentity() {
        let native = Set(InvitationStyle.allCases.map(\.wire))
        for style in contract.styles {
            XCTAssertTrue(native.contains(style.id),
                          "Web style '\(style.id)' has no native identity")
        }
    }

    /// And native invents none of its own beyond the explicit unknown sentinel.
    func testNativeInventsNoStyleTheWebDoesNotHave() {
        let web = Set(contract.styles.map(\.id))
        for style in InvitationStyle.allCases where style != .unknownStyle {
            XCTAssertTrue(web.contains(style.wire),
                          "Native style '\(style.wire)' is not in the web registry")
        }
    }

    /// Names must match exactly: they are shown to guests.
    func testDisplayNamesMatchTheWebRegistry() {
        for style in contract.styles {
            XCTAssertEqual(InvitationStyle.fromWire(style.id).displayName, style.name)
        }
    }

    /// A renderer claim is a claim of exact reproduction. Exactly one design carries it today.
    func testRendererClaimsMatchTheContract() {
        for style in contract.styles {
            XCTAssertEqual(InvitationStyle.fromWire(style.id).hasNativeRenderer,
                           style.nativeRenderer,
                           "Renderer claim for '\(style.id)'")
        }
        XCTAssertEqual(InvitationStyle.allCases.filter(\.hasNativeRenderer), [.ivoryFloralGold])
    }

    /// The regression itself: Garden Romance is not Ivory Floral Gold.
    func testBotanicalIsNotAliasedToIvoryFloralGold() {
        let botanical = InvitationStyle.fromWire("botanical")
        XCTAssertEqual(botanical, .botanical)
        XCTAssertNotEqual(botanical, .ivoryFloralGold)
        XCTAssertFalse(botanical.hasNativeRenderer)
    }

    /// An absent value resolves the way the server resolves it, not to whatever native can draw.
    func testMissingStyleResolvesToTheServerFallback() {
        XCTAssertEqual(InvitationStyle.fromWire(contract.fallbackStyleId), InvitationStyle.default)
        XCTAssertEqual(InvitationStyle.fromWire(nil), InvitationStyle.default)
        XCTAssertEqual(InvitationStyle.fromWire("   "), InvitationStyle.default)
        XCTAssertNotEqual(InvitationStyle.default, .ivoryFloralGold,
                          "The fallback must not be whichever style native happens to render")
    }

    /// A style id this build has never heard of is named as unknown, never silently substituted.
    func testUnrecognisedStyleIsNotSubstituted() {
        let unknown = InvitationStyle.fromWire("hand-lettered-vellum")
        XCTAssertEqual(unknown, .unknownStyle)
        XCTAssertFalse(unknown.hasNativeRenderer)
    }

    /// Casing and underscores travel through older links; the design must not change because of it.
    func testWireValuesAreNormalisedWithoutChangingTheDesign() {
        XCTAssertEqual(InvitationStyle.fromWire("Ivory-Floral-Gold"), .ivoryFloralGold)
        XCTAssertEqual(InvitationStyle.fromWire("ivory_floral_gold"), .ivoryFloralGold)
        XCTAssertEqual(InvitationStyle.fromWire(" royal_emerald "), .royalEmerald)
    }
}
