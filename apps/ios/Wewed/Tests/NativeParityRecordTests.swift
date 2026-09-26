import XCTest
@testable import WewedKit

/// QRO 01 §13–§15 — the iOS wewed.parity.v1 record must be byte-compatible with the server's
/// checker (`mobile/contracts/wewed-parity-v1.json`): exact field set, identical digests, and no
/// secret material, ever.
final class NativeParityRecordTests: XCTestCase {
    private struct Contract: Decodable {
        struct Vector: Decodable { let input: String; let digest: String }
        let fields: [String]
        let textDigestVectors: [Vector]
        let passDigestVector: Vector
    }

    private func contract() throws -> Contract {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent("mobile/contracts/wewed-parity-v1.json")
            if FileManager.default.fileExists(atPath: candidate.path) {
                return try JSONDecoder().decode(Contract.self, from: Data(contentsOf: candidate))
            }
            dir = dir.deletingLastPathComponent()
        }
        throw NSError(domain: "NativeParityRecordTests", code: 1)
    }

    private func snapshot() -> GuestInvitationSnapshot {
        var snapshot = GuestInvitationSnapshot(
            weddingSlug: "synthetic", title: "Synthetic Parity Wedding", monogram: nil, tagline: nil,
            date: "2026-12-25T09:30:00.000Z", venue: "Synthetic Hall", venueMapUrl: nil, venueCity: nil,
            venueCountry: nil, invitationCardStyle: "ivory-floral-gold", invitationCardMessage: "Synthetic authored message",
            rsvpDeadline: nil, childrenPolicy: nil, guestId: "guest-1", guestName: "Synthetic Guest", email: nil,
            tableNumber: 3, tableName: "Acacia", attending: true, mealChoice: "beef", plusOne: true, plusOneName: nil,
            plusOneMeal: nil, kidsAttending: false, kidsCount: 0, dietaryNotes: nil, message: nil, checkedIn: false,
            checkedInAt: nil
        )
        snapshot.weddingId = "wedding-1"
        snapshot.seatingTableId = "table-1"
        snapshot.partySize = 2
        return snapshot
    }

    func testDigestsMatchTheServerCheckerVectors() throws {
        let contract = try contract()
        for vector in contract.textDigestVectors {
            XCTAssertEqual(NativeParityRecord.textDigest(vector.input), vector.digest, vector.input)
        }
        XCTAssertEqual(NativeParityRecord.sha256Hex(contract.passDigestVector.input), contract.passDigestVector.digest)
        XCTAssertNil(NativeParityRecord.textDigest("   "))
    }

    func testGuestRecordHasExactlyTheContractFieldsAndIdentity() throws {
        let record = NativeParityRecord.guestRecord(
            label: "G", baseUrl: "https://wewed-x-11-11.vercel.app", commitSha: "abcdef1",
            snapshot: snapshot(), passState: "not_yet_issuable", passSerial: nil, passToken: nil
        )
        XCTAssertEqual(Set(record.keys), Set(try contract().fields))
        XCTAssertEqual(record["client"] as? String, "ios")
        XCTAssertEqual(record["weddingId"] as? String, "wedding-1")
        XCTAssertEqual(record["guestId"] as? String, "guest-1")
        XCTAssertEqual(record["tableId"] as? String, "table-1")
        XCTAssertEqual(record["partySize"] as? Int, 2)
        XCTAssertEqual(record["rsvpStatus"] as? String, "attending")
        XCTAssertEqual(record["weddingDate"] as? String, "2026-12-25")
        XCTAssertEqual(record["guestNameDigest"] as? String, NativeParityRecord.textDigest("Synthetic Guest"))
        XCTAssertTrue(record["accessUserId"] is NSNull, "a Guest never carries account identity")
        XCTAssertTrue(record["passDigest"] is NSNull)
    }

    func testAnActivePassIsRecordedOnlyAsItsDigestNeverTheToken() throws {
        let token = "WW2.synthetic.vector"
        let record = NativeParityRecord.guestRecord(
            label: "G", baseUrl: "https://wewed-x-11-11.vercel.app", commitSha: "abcdef1",
            snapshot: snapshot(), passState: "active", passSerial: "WWSYN-001", passToken: token
        )
        XCTAssertEqual(record["passDigest"] as? String, try contract().passDigestVector.digest)
        let json = String(decoding: try JSONSerialization.data(withJSONObject: record), as: UTF8.self)
        XCTAssertFalse(json.contains("WW2."), "the raw credential must never be written")
    }

    func testTheSnapshotParsesServerIdentityAndPartySize() {
        // Older servers without the identity fields leave them nil rather than inventing values.
        let legacy = GuestInvitationSnapshot(
            weddingSlug: "s", title: "t", monogram: nil, tagline: nil, date: nil, venue: nil, venueMapUrl: nil,
            venueCity: nil, venueCountry: nil, invitationCardStyle: nil, invitationCardMessage: nil, rsvpDeadline: nil,
            childrenPolicy: nil, guestId: "g", guestName: "n", email: nil, tableNumber: nil, tableName: nil,
            attending: nil, mealChoice: nil, plusOne: false, plusOneName: nil, plusOneMeal: nil, kidsAttending: false,
            kidsCount: nil, dietaryNotes: nil, message: nil, checkedIn: false, checkedInAt: nil
        )
        XCTAssertNil(legacy.weddingId)
        XCTAssertNil(legacy.seatingTableId)
        XCTAssertNil(legacy.partySize)
    }
}
