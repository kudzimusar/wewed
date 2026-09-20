import XCTest
@testable import WewedKit

/// The Ivory Floral Gold renderer must reproduce the approved stationery, not resemble it.
///
/// "Ivory background + gold border + a floral ornament" is explicitly not a pass. What makes it the
/// same object is the artwork, the geometry it is laid out on and the motion it opens with, so those
/// are pinned in `mobile/contracts/ivory-invitation-art-provenance.json` and asserted on both
/// platforms rather than living only in whichever file was edited last.
final class IvoryInvitationGeometryTests: XCTestCase {

    private struct Asset: Decodable {
        let source: String
        let sourceSha256: String
        let android: String
        let ios: String
    }

    private struct Geometry: Decodable {
        let aspectWidth: Double
        let aspectHeight: Double
        let perspectivePx: Double
        let openingMillis: Int
        let maxStageWidthPx: Double
        let doorEasing: [Double]
        let regions: [String: [Double]]
        let hitLeftPercent: Double
        let hitWidthPercent: Double
        let hits: [String: [Double]]
        let testIdentifiers: [String]
    }

    private struct Contract: Decodable {
        let style: String
        let assets: [String: Asset]
        let geometry: Geometry
    }

    private static func loadContract() throws -> Contract {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir
                .appendingPathComponent("mobile/contracts/ivory-invitation-art-provenance.json")
            if FileManager.default.fileExists(atPath: candidate.path) {
                return try JSONDecoder().decode(Contract.self,
                                                from: try Data(contentsOf: candidate))
            }
            dir = dir.deletingLastPathComponent()
        }
        throw NSError(domain: "IvoryInvitationGeometryTests", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "Ivory art provenance contract not found"])
    }

    private var contract: Contract!

    override func setUpWithError() throws {
        contract = try Self.loadContract()
    }

    func testStageMatchesTheApprovedStage() {
        let g = contract.geometry
        XCTAssertEqual(Double(IvoryGeometry.aspect), g.aspectWidth / g.aspectHeight, accuracy: 0.0001)
        XCTAssertEqual(Double(IvoryGeometry.perspective), g.perspectivePx, accuracy: 0.01)
        XCTAssertEqual(IvoryGeometry.openingSeconds, Double(g.openingMillis) / 1000, accuracy: 0.0001)
        XCTAssertEqual(IvoryGeometry.doorEasing, g.doorEasing)
        XCTAssertEqual(Double(IvoryGeometry.maxStageWidth), g.maxStageWidthPx, accuracy: 0.01)
    }

    /// Every text region sits where the web puts it, to the tenth of a percent.
    func testRegionBoxesMatchTheContract() throws {
        let expected: [String: [CGFloat]] = [
            "names": IvoryGeometry.names,
            "message": IvoryGeometry.message,
            "date": IvoryGeometry.date,
            "location": IvoryGeometry.location,
            "tagline": IvoryGeometry.tagline,
            "guest": IvoryGeometry.guest,
            "monogram": IvoryGeometry.monogram,
            "detailCouple": IvoryGeometry.detailCouple,
            "detailNoteIntro": IvoryGeometry.detailNoteIntro,
            "detailVenue": IvoryGeometry.detailVenue,
            "detailNote": IvoryGeometry.detailNote,
        ]
        for (name, actual) in expected {
            let box = try XCTUnwrap(contract.geometry.regions[name], "region '\(name)'")
            XCTAssertEqual(actual.map(Double.init), box, "region '\(name)'")
        }
    }

    func testDetailHitsMatchTheContract() throws {
        XCTAssertEqual(Double(IvoryGeometry.hitLeft), contract.geometry.hitLeftPercent)
        XCTAssertEqual(Double(IvoryGeometry.hitWidth), contract.geometry.hitWidthPercent)
        let expected: [String: [CGFloat]] = [
            "rsvp": IvoryGeometry.hitRsvp,
            "calendar": IvoryGeometry.hitCalendar,
            "venue": IvoryGeometry.hitVenue,
            "registry": IvoryGeometry.hitRegistry,
            "note": IvoryGeometry.hitNote,
        ]
        for (name, actual) in expected {
            let hit = try XCTUnwrap(contract.geometry.hits[name], "hit '\(name)'")
            XCTAssertEqual(actual.map(Double.init), hit, "hit '\(name)'")
        }
    }

    /// The artwork is imported, never redrawn: the contract names a source commit for each file.
    func testEveryArtworkAssetDeclaresItsSource() {
        XCTAssertGreaterThanOrEqual(contract.assets.count, 6)
        for (key, asset) in contract.assets {
            XCTAssertTrue(asset.source.hasPrefix("origin/main:"), "\(key) source")
            XCTAssertEqual(asset.sourceSha256.count, 64, "\(key) sha")
            XCTAssertFalse(asset.android.isEmpty, "\(key) android")
            XCTAssertFalse(asset.ios.isEmpty, "\(key) ios")
        }
    }

    /// Each declared iOS asset is actually in the bundle. A missing file renders as nothing, which
    /// looks like a plain ivory rectangle — the exact failure this rule exists to prevent.
    func testDeclaredIosAssetsArePresent() throws {
        var root = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while root.path != "/",
              !FileManager.default.fileExists(
                atPath: root.appendingPathComponent("apps/ios/Package.swift").path) {
            root = root.deletingLastPathComponent()
        }
        for (key, asset) in contract.assets {
            let path = root.appendingPathComponent("apps/ios").appendingPathComponent(asset.ios)
            XCTAssertTrue(FileManager.default.fileExists(atPath: path.path),
                          "\(key): \(asset.ios) is declared but not present")
        }
    }

    /// Presentation and RSVP are separate axes.
    ///
    /// Collapsing them is the original defect: a confirmed guest was handed a different screen
    /// instead of their invitation. Every combination has to be expressible.
    func testPresentationStateIsIndependentOfRsvpState() {
        let presentations: [InvitationPresentationState] = [.closed, .opening, .open, .details]
        let statuses: [RSVPStatus] = [.pending, .attending, .declined]
        var combinations: [(InvitationPresentationState, IvoryRsvpState)] = []
        for presentation in presentations {
            for status in statuses {
                combinations.append((presentation, ivoryRsvpState(from: status)))
            }
        }
        XCTAssertEqual(combinations.count, presentations.count * statuses.count)
        // Specifically: a returning confirmed guest starts closed, like everyone else.
        XCTAssertEqual(ivoryRsvpState(from: .attending).answer, .attending)
    }

    /// An answered guest is never asked again, whichever way they answered.
    func testAnAnsweredGuestIsNeverAskedAgain() {
        XCTAssertTrue(ivoryRsvpState(from: .pending).awaitsResponse)
        XCTAssertFalse(ivoryRsvpState(from: .attending).awaitsResponse)
        XCTAssertFalse(ivoryRsvpState(from: .declined).awaitsResponse)
    }

    /// A declined guest keeps the invitation and never gets a pass.
    func testADeclinedGuestNeverGetsAPass() {
        XCTAssertFalse(ivoryRsvpState(from: .declined).offersPass)
        XCTAssertFalse(ivoryRsvpState(from: .pending).offersPass)
        XCTAssertTrue(ivoryRsvpState(from: .attending).offersPass)
    }

    /// Attending and declined are distinguishable outcomes, not one "answered" state.
    func testTheTwoAnsweredStatesAreDistinguishable() {
        let attending = ivoryRsvpState(from: .attending)
        let declined = ivoryRsvpState(from: .declined)
        XCTAssertNotEqual(attending.answer, declined.answer)
        XCTAssertNotEqual(attending.statusLabel, declined.statusLabel)
        XCTAssertNotNil(attending.statusLabel)
        XCTAssertNotNil(declined.statusLabel)
        XCTAssertNil(ivoryRsvpState(from: .pending).statusLabel)
    }
}
