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

    /// A renderer claim is a claim of exact reproduction. All 12 supported styles carry native renderers,
    /// while unknownStyle fails closed.
    func testRendererClaimsMatchTheContract() {
        for style in contract.styles {
            XCTAssertEqual(InvitationStyle.fromWire(style.id).hasNativeRenderer,
                           style.nativeRenderer,
                           "Renderer claim for '\(style.id)'")
        }
        let rendering = InvitationStyle.allCases.filter(\.hasNativeRenderer)
        XCTAssertEqual(rendering.count, 12)
        XCTAssertTrue(InvitationStyle.allCases.filter { $0 != .unknownStyle }.allSatisfy(\.hasNativeRenderer))
        XCTAssertFalse(InvitationStyle.unknownStyle.hasNativeRenderer)
    }

    /// The regression itself: Garden Romance is not Ivory Floral Gold, but both render natively.
    func testBotanicalIsNotAliasedToIvoryFloralGold() {
        let botanical = InvitationStyle.fromWire("botanical")
        XCTAssertEqual(botanical, .botanical)
        XCTAssertNotEqual(botanical, .ivoryFloralGold)
        XCTAssertTrue(botanical.hasNativeRenderer)
    }

    /// Source contract parity: ensures that any style added to the authoritative web registry
    /// (`src/lib/digital-invitation-card.ts`) is present in native with a native renderer.
    func testWebSourceStyleRegistryMatchesNativeRenderers() throws {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        var sourceUrl: URL?
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent("src/lib/digital-invitation-card.ts")
            if FileManager.default.fileExists(atPath: candidate.path) {
                sourceUrl = candidate
                break
            }
            dir = dir.deletingLastPathComponent()
        }
        guard let url = sourceUrl else {
            XCTFail("src/lib/digital-invitation-card.ts not found")
            return
        }
        let content = try String(contentsOf: url, encoding: .utf8)
        let regex = try NSRegularExpression(pattern: #"id:\s*['"]([a-z0-9-]+)['"]"#)
        let matches = regex.matches(in: content, range: NSRange(content.startIndex..., in: content))
        var foundIds = Set<String>()
        for match in matches {
            if let range = Range(match.range(at: 1), in: content) {
                foundIds.insert(String(content[range]))
            }
        }
        XCTAssertFalse(foundIds.isEmpty, "Web source must declare styles")
        for styleId in foundIds {
            let style = InvitationStyle.fromWire(styleId)
            XCTAssertNotEqual(style, .unknownStyle, "Style \(styleId) from web source must not be unknownStyle")
            XCTAssertTrue(style.hasNativeRenderer, "Style \(styleId) from web source must have a native renderer")
        }
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
