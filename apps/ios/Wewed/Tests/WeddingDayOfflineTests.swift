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
        XCTAssertEqual(pending[0].usherId, "")

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

    func testFutureOrMalformedSigningKeyActivationFailsClosedOffline() async throws {
        let token = "WW2.wedts26.WWJD0824.0e.66f001ab.8d4ba7eca9ef156da73f31e98456a9eaae676f66e4e33d4afaeb5f36cc5f4e06d612a90d0519d343346872759e675437934043ba97fec6a763b7ae3430d6ab30"
        let publicKeyDerBase64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEPSF40dU2YlZRMbV5EweSiFFtJbrJmwtufFc4Bx2eJrC2erZirTgNiKFYBjAIgZsNpWDsGhWRsxToZUz+mdHSNQ=="
        let store = OfflineManifestStore(storageDirectory: nil)
        try await store.saveManifest(
            weddingId: "wedding-1",
            items: [
                GuestManifestItem(
                    id: "guest-1",
                    serial: "WWJD0824",
                    guestName: "Guest",
                    partySize: 1,
                    eventBitmask: 0x0e,
                    signingKeyId: "key-v1",
                    nonce: "66f001ab",
                    attendeeKeys: ["primary"],
                    eligible: true,
                    expiresAt: "2099-09-18T00:00:00.000Z"
                )
            ]
        )
        let trustStore = WeddingDayManifestTrustStore(storageDirectory: nil)
        let service = WeddingDaySyncService()

        func saveKey(_ activeFrom: String) async throws {
            try await trustStore.save(
                VerifiedWeddingDayManifestTrust(
                    weddingId: "wedding-1",
                    weddingShortId: "wedts26",
                    eventKey: "wedding-day",
                    generatedAt: "2026-09-17T00:00:00.000Z",
                    expiresAt: "2099-09-18T00:00:00.000Z",
                    rootKeyId: "root-v1",
                    keys: [
                        WeddingDayManifestKey(
                            keyId: "key-v1",
                            algorithm: "ECDSA_P256_SHA256",
                            publicKeyDerBase64: publicKeyDerBase64,
                            status: "active",
                            activeFrom: activeFrom
                        )
                    ]
                )
            )
        }

        try await saveKey("2099-09-17T00:00:00.000Z")
        do {
            _ = try await service.verifyOfflinePass(
                token: token,
                weddingId: "wedding-1",
                offlineStore: store,
                trustStore: trustStore
            )
            XCTFail("future signing key must not verify")
        } catch let error as WeddingDaySyncError {
            XCTAssertEqual(error, .signingKeyInactive)
        }

        try await saveKey("not-an-iso-date")
        do {
            _ = try await service.verifyOfflinePass(
                token: token,
                weddingId: "wedding-1",
                offlineStore: store,
                trustStore: trustStore
            )
            XCTFail("malformed signing-key activation must not verify")
        } catch let error as WeddingDaySyncError {
            XCTAssertEqual(error, .signingKeyInactive)
        }
    }


    func testOfflineSyncBodyCarriesOperationDataButNoAuthorityClaims() throws {
        let body = OfflineSyncBody(
            passSerial: "WWABC1234",
            attendeeKeys: ["primary", "plus-one"],
            deviceId: "ios-device-1",
            clientEventId: "queue-event-1"
        )
        let data = try JSONEncoder().encode(body)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(Set(json.keys), Set([
            "passSerial",
            "attendeeKeys",
            "deviceId",
            "clientEventId",
        ]))
        for forbidden in [
            "guestId", "weddingId", "gateId", "usherId",
            "operatorUserId", "source", "eventKey"
        ] {
            XCTAssertNil(json[forbidden])
        }
    }

    func testRevokePassCallsRevokeEndpoint() async throws {
        RevokeStubProtocol.lastRequest = nil
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [RevokeStubProtocol.self]
        let session = URLSession(configuration: config)
        let service = WeddingDaySyncService(session: session)

        let success = await service.revokePass(
            baseURL: URL(string: "https://example.com")!,
            bearerToken: "test-token",
            passSerial: "WWTEST999",
            reason: "Lost pass",
            grantId: "grant-456"
        )
        XCTAssertTrue(success)
        let req = try XCTUnwrap(RevokeStubProtocol.lastRequest)
        XCTAssertEqual(req.url?.path, "/api/native/gate/wedding-day/pass/revoke")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Authorization"), "Bearer test-token")
        XCTAssertEqual(req.value(forHTTPHeaderField: "x-wewed-grant-id"), "grant-456")
        XCTAssertEqual(req.httpMethod, "POST")
    }
}

private final class RevokeStubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var lastRequest: URLRequest?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        RevokeStubProtocol.lastRequest = request
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data("{\"success\":true}".utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}
