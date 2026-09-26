import XCTest
@testable import WewedKit

/// INV-CANON01 — the approved Wewed digital invitation (ornate ivory/gold floral doors, "A special
/// invitation awaits", CLOSED → OPENING → OPEN → DETAILS) is `ivory-floral-gold`, rendered only by
/// `IvoryFloralGoldNative`. A change that routes it into GenericMotion must fail here.
final class CanonicalInvitationDispatchTests: XCTestCase {
    func testTheCanonicalStyleResolvesToTheDedicatedIvoryRenderer() {
        XCTAssertEqual(InvitationStyle.fromWire("ivory-floral-gold"), .ivoryFloralGold)
        XCTAssertEqual(rendererFor(.ivoryFloralGold), .ivoryCustom)
        XCTAssertNotEqual(rendererFor(.ivoryFloralGold), .genericMotion)
    }

    func testTheDispatcherSendsIvoryToIvoryFloralGoldNativeAndNeverGenericMotion() throws {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        var source: String?
        while dir.path != "/", source == nil {
            let candidate = dir.appendingPathComponent("Views/Invitation/NativeInvitationExperience.swift")
            if FileManager.default.fileExists(atPath: candidate.path) { source = try String(contentsOf: candidate, encoding: .utf8) }
            dir = dir.deletingLastPathComponent()
        }
        let text = try XCTUnwrap(source)
        let start = try XCTUnwrap(text.range(of: "case .ivoryCustom:"))
        let end = try XCTUnwrap(text.range(of: "case .genericMotion:", range: start.upperBound..<text.endIndex))
        let ivoryBranch = String(text[start.upperBound..<end.lowerBound])
        XCTAssertTrue(ivoryBranch.contains("IvoryFloralGoldNative("))
        XCTAssertFalse(ivoryBranch.contains("GenericMotion"), "the canonical invitation must never render through GenericMotion")
    }
}
