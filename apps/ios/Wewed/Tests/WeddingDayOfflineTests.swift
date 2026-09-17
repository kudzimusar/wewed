import XCTest
@testable import WewedKit

final class WeddingDayOfflineTests: XCTestCase {
    func testOfflineQueueSurvivesRestartWithExactAttendeeKeys() async throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }

        let weddingId = "wedding-1"
        var store = OfflineManifestStore(storageDirectory: dir, deviceId: "ios-gate-a")
        try await store.saveManifest(
            weddingId: weddingId,
            items: [
                GuestManifestItem(
                    id: "guest-1",
                    serial: "WWABC1234",
                    guestName: "Doe Household",
                    partySize: 3,
                    checkedInCount: 1,
                    tableAssignment: "Table 9",
                    eventBitmask: 0x0e,
                    signingKeyId: "key-v2",
                    nonce: "66f001ab",
                    attendeeKeys: ["primary", "plus-one", "child-1"],
                    checkedInAttendeeKeys: ["primary"],
                    eligible: true
                )
            ]
        )

        let result = try await store.recordOfflineCheckIn(
            weddingId: weddingId,
            serial: "WWABC1234",
            count: 1,
            usherId: "usher-1"
        )
        XCTAssertEqual(result.alreadyCheckedInCount, 2)
        XCTAssertEqual(result.remainingCount, 1)

        var pending = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(pending[0].attendeeKeys, ["plus-one"])
        XCTAssertEqual(pending[0].deviceId, "ios-gate-a")

        store = OfflineManifestStore(storageDirectory: dir, deviceId: "ios-gate-a")
        let restored = await store.lookupBySerial(weddingId: weddingId, serial: "WWABC1234")
        XCTAssertEqual(restored?.checkedInAttendeeKeys, ["primary", "plus-one"])
        pending = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertEqual(pending[0].attendeeKeys, ["plus-one"])
        XCTAssertFalse(pending[0].synced)

        try await store.markCheckInSynced(id: pending[0].id)
        store = OfflineManifestStore(storageDirectory: dir, deviceId: "ios-gate-a")
        let remainingPending = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertTrue(remainingPending.isEmpty)
    }

    func testRevokedCredentialIsRejectedOffline() async throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }

        let store = OfflineManifestStore(storageDirectory: dir)
        try await store.saveManifest(
            weddingId: "wedding-1",
            items: [
                GuestManifestItem(
                    id: "guest-1",
                    serial: "WWREVOKED",
                    guestName: "Revoked Guest",
                    partySize: 1,
                    attendeeKeys: ["primary"],
                    eligible: true,
                    revokedAt: "2026-09-17T00:00:00.000Z"
                )
            ]
        )

        let result = try await store.recordOfflineCheckIn(
            weddingId: "wedding-1",
            serial: "WWREVOKED",
            count: 1,
            usherId: "usher-1"
        )
        XCTAssertEqual(result.status, .invalidPass)
        let pending = await store.getPendingCheckIns(weddingId: "wedding-1")
        XCTAssertTrue(pending.isEmpty)
    }

    func testVerifiedTrustAndRotatedKeysSurviveRestart() async throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }

        var trustStore = WeddingDayManifestTrustStore(storageDirectory: dir)
        try await trustStore.save(
            VerifiedWeddingDayManifestTrust(
                weddingId: "wedding-1",
                weddingShortId: "abc12345",
                eventKey: "wedding-day",
                generatedAt: "2026-09-17T00:00:00.000Z",
                expiresAt: "2026-09-18T00:00:00.000Z",
                rootKeyId: "root-v1",
                keys: [
                    WeddingDayManifestKey(
                        keyId: "key-v1",
                        algorithm: "ECDSA_P256_SHA256",
                        publicKeyDerBase64: "old-key",
                        status: "retired",
                        activeFrom: "2026-09-01T00:00:00.000Z"
                    ),
                    WeddingDayManifestKey(
                        keyId: "key-v2",
                        algorithm: "ECDSA_P256_SHA256",
                        publicKeyDerBase64: "new-key",
                        status: "active",
                        activeFrom: "2026-09-17T00:00:00.000Z"
                    )
                ]
            )
        )

        trustStore = WeddingDayManifestTrustStore(storageDirectory: dir)
        let activeKey = await trustStore.signingKey(weddingId: "wedding-1", keyId: "key-v2")
        let retiredKey = await trustStore.signingKey(weddingId: "wedding-1", keyId: "key-v1")
        XCTAssertEqual(activeKey?.publicKeyDerBase64, "new-key")
        XCTAssertEqual(retiredKey?.publicKeyDerBase64, "old-key")
    }

    func testP1363VerifierAcceptsCanonicalPayloadAndRejectsTampering() {
        let publicKeyDerBase64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEPSF40dU2YlZRMbV5EweSiFFtJbrJmwtufFc4Bx2eJrC2erZirTgNiKFYBjAIgZsNpWDsGhWRsxToZUz+mdHSNQ=="
        let token = "WW2.wedts26.WWJD0824.0e.66f001ab.8d4ba7eca9ef156da73f31e98456a9eaae676f66e4e33d4afaeb5f36cc5f4e06d612a90d0519d343346872759e675437934043ba97fec6a763b7ae3430d6ab30"
        let parts = token.split(separator: ".").map(String.init)
        let payload = parts.prefix(5).joined(separator: ".")
        let signature = parts[5]

        XCTAssertTrue(TokenVerifier.verifyP1363(
            payload: payload,
            signatureHex: signature,
            publicKeyDerBase64: publicKeyDerBase64
        ))
        XCTAssertFalse(TokenVerifier.verifyP1363(
            payload: payload + "tampered",
            signatureHex: signature,
            publicKeyDerBase64: publicKeyDerBase64
        ))
    }
}
