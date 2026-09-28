import XCTest
import CryptoKit
@testable import WewedKit

/// Signs real WW2 tokens with a throwaway P-256 key, exactly as the server does: the five-field
/// payload `WW2.<shortId>.<serial>.<bitmask>.<nonce>` with an IEEE-P1363 (raw r||s) signature.
enum WW2TestSigner {
    static func token(
        key: P256.Signing.PrivateKey,
        shortId: String,
        serial: String,
        bitmask: UInt8 = 0x0e,
        nonce: String
    ) throws -> String {
        let payload = "WW2.\(shortId).\(serial).\(String(format: "%02x", bitmask)).\(nonce)"
        let signature = try key.signature(for: Data(payload.utf8))
        return payload + "." + signature.rawRepresentation.map { String(format: "%02x", $0) }.joined()
    }

    static func publicKeyDerBase64(_ key: P256.Signing.PrivateKey) -> String {
        key.publicKey.derRepresentation.base64EncodedString()
    }
}

/// LQR01 Workstream 1 — the offline queue retains the exact scanned WW2 credential (in the
/// OS-protected vault, never the cache file) and reconciles only with that exact credential.
final class WeddingDayExactTokenQueueTests: XCTestCase {
    private let weddingId = "wedding-1"
    private let shortId = "wedts26"
    private let serial = "WWEXACT01"
    private let nonce = "66f001ab"

    private var dir: URL!
    private var vault: InMemorySecureStorage!
    private var key: P256.Signing.PrivateKey!
    private var token: String!
    private var trustStore: WeddingDayManifestTrustStore!

    override func setUp() async throws {
        try await super.setUp()
        CheckInStub.reset()
        dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        vault = InMemorySecureStorage()
        key = P256.Signing.PrivateKey()
        token = try WW2TestSigner.token(key: key, shortId: shortId, serial: serial, nonce: nonce)
        trustStore = WeddingDayManifestTrustStore(storageDirectory: dir)
        try await trustStore.save(trust(generatedAt: Date(), expiresAt: Date().addingTimeInterval(12 * 3600)))
    }

    override func tearDown() async throws {
        if let dir { try? FileManager.default.removeItem(at: dir) }
        CheckInStub.reset()
        try await super.tearDown()
    }

    // MARK: - Fixtures

    private func iso(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    private func trust(generatedAt: Date, expiresAt: Date) -> VerifiedWeddingDayManifestTrust {
        VerifiedWeddingDayManifestTrust(
            weddingId: weddingId,
            weddingShortId: shortId,
            eventKey: "wedding-day",
            generatedAt: iso(generatedAt),
            expiresAt: iso(expiresAt),
            rootKeyId: "root-v1",
            keys: [
                WeddingDayManifestKey(
                    keyId: "key-v1",
                    algorithm: "ECDSA_P256_SHA256",
                    publicKeyDerBase64: WW2TestSigner.publicKeyDerBase64(key),
                    status: "active",
                    activeFrom: "2026-01-01T00:00:00.000Z"
                )
            ]
        )
    }

    private func makeStore(vault: SecureStorageProtocol? = nil) -> OfflineManifestStore {
        OfflineManifestStore(storageDirectory: dir, deviceId: "ios-gate-a", credentialVault: vault ?? self.vault)
    }

    private func seededStore() async throws -> OfflineManifestStore {
        let store = makeStore()
        try await store.saveManifest(
            weddingId: weddingId,
            items: [
                GuestManifestItem(
                    id: "guest-1",
                    serial: serial,
                    guestName: "Doe Household",
                    partySize: 2,
                    eventBitmask: 0x0e,
                    signingKeyId: "key-v1",
                    nonce: nonce,
                    attendeeKeys: ["primary", "plus-one"],
                    checkedInAttendeeKeys: [],
                    eligible: true,
                    expiresAt: "2099-09-18T00:00:00.000Z"
                )
            ]
        )
        return store
    }

    private func service() -> WeddingDaySyncService {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [CheckInStub.self]
        return WeddingDaySyncService(session: URLSession(configuration: configuration))
    }

    private func sync(_ store: OfflineManifestStore) async -> WeddingDaySyncResult {
        await service().syncPendingCheckIns(
            baseURL: URL(string: "https://example.com")!,
            bearerToken: "operator-bearer",
            weddingId: weddingId,
            grantId: "grant-1",
            offlineStore: store,
            trustStore: trustStore
        )
    }

    private func firstPending(_ store: OfflineManifestStore) async throws -> QueuedCheckIn {
        let pending = await store.getPendingCheckIns(weddingId: weddingId)
        return try XCTUnwrap(pending.first)
    }

    private func cacheFileBytes() throws -> Data {
        try Data(contentsOf: dir.appendingPathComponent("wewed_offline_manifest.json"))
    }

    // MARK: - Recording

    func testRecordOfflineCheckInKeepsTheExactTokenOnlyInTheVault() async throws {
        let store = try await seededStore()
        let result = try await store.recordOfflineCheckIn(weddingId: weddingId, token: token, count: 1)
        XCTAssertEqual(result.status, .validPass)

        let pending = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertEqual(pending.count, 1)
        let record = pending[0]
        XCTAssertEqual(record.passSerial, serial)
        XCTAssertEqual(record.attendeeKeys, ["primary"])
        XCTAssertEqual(record.credentialRef, "ww2.offline.\(record.id)")
        XCTAssertNil(record.rejectionCode)
        XCTAssertEqual(vault.get(key: "ww2.offline.\(record.id)"), token)
        let vaultToken = await store.credential(for: record)
        XCTAssertEqual(vaultToken, token)
        XCTAssertEqual(QueuedCheckInReconciliation.classify(record, vaultToken: vaultToken), .exactCredential)

        // The ordinary durable cache holds queue metadata only — never the bearer credential.
        let bytes = try cacheFileBytes()
        let signature = String(token.split(separator: ".")[5])
        XCTAssertNil(bytes.range(of: Data(token.utf8)), "the WW2 token must never reach the cache file")
        XCTAssertNil(bytes.range(of: Data(signature.utf8)), "the WW2 signature must never reach the cache file")
        XCTAssertNotNil(bytes.range(of: Data("ww2.offline.\(record.id)".utf8)))
    }

    func testRecordOfflineCheckInRefusesAPayloadThatIsNotAWw2Credential() async throws {
        let store = try await seededStore()
        for payload in [serial, "WW1.\(shortId).\(serial).0e.\(nonce).deadbeef", "not-a-pass"] {
            let result = try await store.recordOfflineCheckIn(weddingId: weddingId, token: payload, count: 1)
            XCTAssertEqual(result.status, .invalidPass)
        }
        let pending = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertTrue(pending.isEmpty)
        let item = await store.lookupBySerial(weddingId: weddingId, serial: serial)
        XCTAssertEqual(item?.checkedInAttendeeKeys, [])
    }

    func testGateCheckInQueuesTheExactScannedPayload() async throws {
        let store = try await seededStore()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [CheckInStub.self]
        let gate = ManifestBackedWeddingDayGate(
            baseURL: URL(string: "https://example.com")!,
            bearerToken: "operator-bearer",
            gateContext: GateOperationalContext(
                grantId: "grant-1",
                assignmentId: "assignment-1",
                weddingId: weddingId,
                weddingTitle: "Wedding",
                gateId: "gate-1",
                gateName: "Main Gate",
                operatorUserId: "operator-1",
                capabilities: ["gate.manifest.read", "gate.checkin.write"]
            ),
            trustedRootPublicKeyDerBase64: WW2TestSigner.publicKeyDerBase64(key),
            offlineStore: store,
            trustStore: trustStore,
            syncService: WeddingDaySyncService(session: URLSession(configuration: configuration))
        )

        let result = try await gate.checkIn(qrPayload: token, count: 1)
        XCTAssertEqual(result.status, .partialCheckedIn)
        let pending = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertEqual(pending.count, 1)
        XCTAssertEqual(vault.get(key: try XCTUnwrap(pending[0].credentialRef)), token)

        let synced = await gate.reconcilePending()
        XCTAssertEqual(synced.syncedIds, [pending[0].id])
        let body = try XCTUnwrap(CheckInStub.jsonBodies.last)
        XCTAssertEqual(body["token"] as? String, token)
    }

    // MARK: - Sync

    func testSyncPostsTheExactScannedTokenAndNoPassSerial() async throws {
        let store = try await seededStore()
        _ = try await store.recordOfflineCheckIn(weddingId: weddingId, token: token, count: 1)
        let record = try await firstPending(store)

        let result = await sync(store)
        XCTAssertEqual(result.syncedIds, [record.id])
        XCTAssertEqual(result.failedIds, [])
        XCTAssertEqual(result.rejectedIds, [])
        XCTAssertEqual(result.blockedLegacyIds, [])

        XCTAssertEqual(CheckInStub.requests.count, 1)
        let request = CheckInStub.requests[0]
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/api/native/gate/wedding-day/check-in")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer operator-bearer")
        XCTAssertEqual(request.value(forHTTPHeaderField: "x-wewed-grant-id"), "grant-1")

        let json = try XCTUnwrap(CheckInStub.jsonBodies.first)
        XCTAssertEqual(Set(json.keys), ["token", "attendeeKeys", "clientEventId", "deviceId"])
        let sentToken = try XCTUnwrap(json["token"] as? String)
        XCTAssertEqual(Data(sentToken.utf8), Data(token.utf8), "the token must be sent byte-for-byte")
        XCTAssertEqual(json["attendeeKeys"] as? [String], ["primary"])
        XCTAssertEqual(json["clientEventId"] as? String, record.id)
        XCTAssertEqual(json["deviceId"] as? String, "ios-gate-a")
        XCTAssertNil(json["passSerial"], "serial-only admission is not supported by the server")

        // 2xx: synced and the bearer credential is no longer retained on this device.
        let remaining = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertTrue(remaining.isEmpty)
        XCTAssertNil(vault.get(key: try XCTUnwrap(record.credentialRef)))
    }

    func testResendingTheSameEventIsIdempotentAndASyncedEventIsNotResent() async throws {
        let store = try await seededStore()
        _ = try await store.recordOfflineCheckIn(weddingId: weddingId, token: token, count: 1)
        let record = try await firstPending(store)

        // The first attempt's response is lost: the event stays pending and is resent as the SAME
        // clientEventId with the SAME token, which the server de-duplicates.
        CheckInStub.failWithNetworkError = true
        let lost = await sync(store)
        XCTAssertEqual(lost.failedIds, [record.id])
        CheckInStub.failWithNetworkError = false
        let retried = await sync(store)
        XCTAssertEqual(retried.syncedIds, [record.id])
        XCTAssertEqual(CheckInStub.jsonBodies.count, 2)
        XCTAssertEqual(CheckInStub.jsonBodies[0]["clientEventId"] as? String, record.id)
        XCTAssertEqual(CheckInStub.jsonBodies[1]["clientEventId"] as? String, record.id)
        XCTAssertEqual(CheckInStub.jsonBodies[0]["token"] as? String, token)
        XCTAssertEqual(CheckInStub.jsonBodies[1]["token"] as? String, token)

        // Once synced, nothing is sent again.
        let again = await sync(store)
        XCTAssertEqual(again, WeddingDaySyncResult(syncedIds: [], failedIds: [], blockedLegacyIds: []))
        XCTAssertEqual(CheckInStub.requests.count, 2)
    }

    func testTerminalRejectionIsRecordedAndNeverResent() async throws {
        let store = try await seededStore()
        _ = try await store.recordOfflineCheckIn(weddingId: weddingId, token: token, count: 1)
        let record = try await firstPending(store)

        CheckInStub.replies = [.init(
            status: 400,
            body: #"{"success":false,"code":"PASS_REVOKED_OR_EXPIRED","error":"PASS_REVOKED_OR_EXPIRED"}"#
        )]
        let result = await sync(store)
        XCTAssertEqual(result.rejectedIds, [record.id])
        XCTAssertEqual(result.syncedIds, [])
        XCTAssertEqual(result.failedIds, [])
        XCTAssertEqual(result.blockedLegacyIds, [])
        XCTAssertNil(vault.get(key: try XCTUnwrap(record.credentialRef)))
        let pending = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertTrue(pending.isEmpty)
        XCTAssertNotNil(try cacheFileBytes().range(of: Data("PASS_REVOKED_OR_EXPIRED".utf8)))

        let second = await sync(makeStore())
        XCTAssertEqual(second, WeddingDaySyncResult(syncedIds: [], failedIds: [], blockedLegacyIds: []))
        XCTAssertEqual(CheckInStub.requests.count, 1, "a terminally rejected event must never be resent")
    }

    func testEveryTerminalRejectionCodeIsTerminal() async throws {
        let codes = [
            "PASS_NOT_FOUND", "PASS_REVOKED_OR_EXPIRED", "INVALID_PASS_TOKEN", "PASS_WEDDING_MISMATCH",
            "PASS_EVENT_NOT_PERMITTED", "PASS_SIGNATURE_INVALID", "PASS_CREDENTIAL_MISMATCH",
            "PASS_TOKEN_REQUIRED", "SERIAL_ONLY_ADMISSION_UNSUPPORTED", "GUEST_INELIGIBLE",
            "INVALID_ATTENDEE_KEY",
        ]
        XCTAssertEqual(WeddingDaySyncService.terminalRejectionCodes, Set(codes))
    }

    func testRetryableFailuresKeepTheEventPendingWithItsCredential() async throws {
        let store = try await seededStore()
        _ = try await store.recordOfflineCheckIn(weddingId: weddingId, token: token, count: 1)
        let record = try await firstPending(store)
        let ref = try XCTUnwrap(record.credentialRef)

        let retryable: [CheckInStub.Reply?] = [
            .init(status: 500, body: #"{"success":false,"code":"INTERNAL"}"#),
            .init(status: 400, body: #"{"success":false,"code":"PASS_SIGNING_KEY_INACTIVE","error":"PASS_SIGNING_KEY_INACTIVE"}"#),
            .init(status: 400, body: #"{"success":false,"code":"GATE_INACTIVE_OR_INVALID"}"#),
            .init(status: 401, body: #"{"success":false}"#),
            .init(status: 403, body: #"{"success":false,"code":"PASS_REVOKED_OR_EXPIRED"}"#),
            .init(status: 409, body: #"{"success":false}"#),
            .init(status: 429, body: ""),
            nil, // network error
        ]
        for reply in retryable {
            if let reply {
                CheckInStub.failWithNetworkError = false
                CheckInStub.replies = [reply]
            } else {
                CheckInStub.failWithNetworkError = true
            }
            let result = await sync(store)
            XCTAssertEqual(result.failedIds, [record.id], "\(String(describing: reply)) must be retryable")
            XCTAssertEqual(result.rejectedIds, [])
            XCTAssertEqual(result.syncedIds, [])
            let pending = await store.getPendingCheckIns(weddingId: weddingId)
            XCTAssertEqual(pending.map(\.id), [record.id])
            XCTAssertEqual(vault.get(key: ref), token)
        }
    }

    func testRestartWithTheSameVaultStillSyncsTheExactToken() async throws {
        let store = try await seededStore()
        _ = try await store.recordOfflineCheckIn(weddingId: weddingId, token: token, count: 2)

        let restarted = makeStore()
        let record = try await firstPending(restarted)
        XCTAssertEqual(record.attendeeKeys, ["primary", "plus-one"])
        let result = await sync(restarted)
        XCTAssertEqual(result.syncedIds, [record.id])
        XCTAssertEqual(CheckInStub.jsonBodies.first?["token"] as? String, token)
    }

    // MARK: - Legacy and unavailable credentials fail closed

    func testLegacySerialOnlyAndCountOnlyRecordsAreBlockedAndNeverSent() async throws {
        // A pre-LQR01 snapshot: one serial-only event (attendee keys, no credential) and one pre-v2
        // count-only event. Neither carries the exact scanned credential.
        let legacy = """
        {"manifests":{"wedding-1":{}},"syncQueues":{"wedding-1":[
          {"id":"legacy-serial","weddingId":"wedding-1","passSerial":"WWEXACT01","guestId":"guest-1",
           "count":1,"timestamp":0,"usherId":"","synced":false,"attendeeKeys":["primary"],"deviceId":"ios-gate-a"},
          {"id":"legacy-count","weddingId":"wedding-1","passSerial":"WWEXACT01","guestId":"guest-1",
           "count":2,"timestamp":0,"usherId":"usher-1","synced":false}
        ]}}
        """
        try Data(legacy.utf8).write(to: dir.appendingPathComponent("wewed_offline_manifest.json"))

        let store = makeStore()
        let pending = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertEqual(pending.map(\.id), ["legacy-serial", "legacy-count"])
        XCTAssertNil(pending[0].credentialRef)
        XCTAssertNil(pending[0].rejectionCode)
        XCTAssertEqual(QueuedCheckInReconciliation.classify(pending[0], vaultToken: nil), .legacySerialOnly)
        XCTAssertEqual(QueuedCheckInReconciliation.classify(pending[1], vaultToken: nil), .legacyCountOnly)

        let result = await sync(store)
        XCTAssertEqual(result.blockedLegacyIds, ["legacy-serial", "legacy-count"])
        XCTAssertEqual(result.syncedIds, [])
        XCTAssertEqual(result.failedIds, [])
        XCTAssertEqual(result.rejectedIds, [])
        XCTAssertTrue(CheckInStub.requests.isEmpty, "a legacy event must never be sent")
        let stillPending = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertEqual(stillPending.count, 2, "blocked events stay visible for operator resolution")
    }

    func testACredentialRefWhoseVaultEntryIsGoneIsBlocked() async throws {
        let store = try await seededStore()
        _ = try await store.recordOfflineCheckIn(weddingId: weddingId, token: token, count: 1)

        // Same cache directory, empty vault: e.g. the app was reinstalled or the Keychain wiped.
        let reinstalled = makeStore(vault: InMemorySecureStorage())
        let record = try await firstPending(reinstalled)
        let result = await sync(reinstalled)
        XCTAssertEqual(result.blockedLegacyIds, [record.id])
        XCTAssertEqual(result.syncedIds, [])
        XCTAssertTrue(CheckInStub.requests.isEmpty)
    }

    func testAVaultTokenForADifferentPassIsBlocked() async throws {
        let store = try await seededStore()
        _ = try await store.recordOfflineCheckIn(weddingId: weddingId, token: token, count: 1)
        let record = try await firstPending(store)
        let other = try WW2TestSigner.token(key: key, shortId: shortId, serial: "WWOTHER99", nonce: nonce)
        vault.save(key: try XCTUnwrap(record.credentialRef), value: other)

        let result = await sync(store)
        XCTAssertEqual(result.blockedLegacyIds, [record.id])
        XCTAssertTrue(CheckInStub.requests.isEmpty)
    }

    func testReconciliationClassification() throws {
        func record(keys: [String]?, ref: String?) -> QueuedCheckIn {
            QueuedCheckIn(
                id: "q1", weddingId: weddingId, passSerial: serial, guestId: "guest-1", count: 1,
                usherId: "", attendeeKeys: keys, deviceId: nil, credentialRef: ref
            )
        }
        let other = try WW2TestSigner.token(key: key, shortId: shortId, serial: "WWOTHER99", nonce: nonce)
        let ww1 = "WW1.\(shortId).\(serial).0e.\(nonce).deadbeef"

        XCTAssertEqual(QueuedCheckInReconciliation.classify(record(keys: nil, ref: nil), vaultToken: nil), .legacyCountOnly)
        XCTAssertEqual(QueuedCheckInReconciliation.classify(record(keys: [], ref: "ww2.offline.q1"), vaultToken: token), .legacyCountOnly)
        XCTAssertEqual(QueuedCheckInReconciliation.classify(record(keys: ["primary"], ref: nil), vaultToken: token), .legacySerialOnly)
        XCTAssertEqual(QueuedCheckInReconciliation.classify(record(keys: ["primary"], ref: "ww2.offline.q1"), vaultToken: nil), .credentialUnavailable)
        XCTAssertEqual(QueuedCheckInReconciliation.classify(record(keys: ["primary"], ref: "ww2.offline.q1"), vaultToken: ww1), .credentialUnavailable)
        XCTAssertEqual(QueuedCheckInReconciliation.classify(record(keys: ["primary"], ref: "ww2.offline.q1"), vaultToken: other), .credentialUnavailable)
        XCTAssertEqual(QueuedCheckInReconciliation.classify(record(keys: ["primary"], ref: "ww2.offline.q1"), vaultToken: "garbage"), .credentialUnavailable)
        XCTAssertEqual(QueuedCheckInReconciliation.classify(record(keys: ["primary"], ref: "ww2.offline.q1"), vaultToken: token), .exactCredential)
    }

    func testClearManifestAlsoDeletesQueuedCredentials() async throws {
        let store = try await seededStore()
        _ = try await store.recordOfflineCheckIn(weddingId: weddingId, token: token, count: 1)
        let record = try await firstPending(store)
        let ref = try XCTUnwrap(record.credentialRef)
        XCTAssertEqual(vault.get(key: ref), token)

        await store.clearManifest(weddingId: weddingId)
        XCTAssertNil(vault.get(key: ref))
        let pending = await store.getPendingCheckIns(weddingId: weddingId)
        XCTAssertTrue(pending.isEmpty)
    }

    // MARK: - Workstream 8: stale offline authority observability

    func testAuthorityStatusFreshStaleAndExpired() throws {
        let now = Date()
        let fresh = try XCTUnwrap(WeddingDayAuthorityStatus(
            trust: trust(generatedAt: now.addingTimeInterval(-600), expiresAt: now.addingTimeInterval(12 * 3600)),
            now: now
        ))
        XCTAssertEqual(fresh.age, 600, accuracy: 1)
        XCTAssertFalse(fresh.isStale)
        XCTAssertFalse(fresh.isExpired)
        XCTAssertTrue(fresh.relyingOnCachedAuthority)

        let stale = try XCTUnwrap(WeddingDayAuthorityStatus(
            trust: trust(generatedAt: now.addingTimeInterval(-3 * 3600), expiresAt: now.addingTimeInterval(9 * 3600)),
            now: now
        ))
        XCTAssertEqual(stale.age, 3 * 3600, accuracy: 1)
        XCTAssertTrue(stale.isStale)
        XCTAssertFalse(stale.isExpired)

        let expired = try XCTUnwrap(WeddingDayAuthorityStatus(
            trust: trust(generatedAt: now.addingTimeInterval(-13 * 3600), expiresAt: now.addingTimeInterval(-3600)),
            now: now
        ))
        XCTAssertTrue(expired.isStale)
        XCTAssertTrue(expired.isExpired)

        XCTAssertEqual(WeddingDayAuthorityStatus.staleAfter, 2 * 3600)
    }

    func testAuthorityStatusSummaryLine() throws {
        let generated = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-09-26T09:00:00Z"))
        let status = try XCTUnwrap(WeddingDayAuthorityStatus(
            trust: trust(generatedAt: generated, expiresAt: generated.addingTimeInterval(12 * 3600)),
            now: generated.addingTimeInterval(3 * 3600)
        ))
        let utc = try XCTUnwrap(TimeZone(identifier: "UTC"))
        XCTAssertEqual(
            status.summaryLine(timeZone: utc),
            "Offline authority · generated 09:00 · expires 21:00 · age 3h (stale)"
        )
        XCTAssertEqual(
            WeddingDayAuthorityStatus.cachedListNotice,
            "Admission is being checked against this device's cached list; revocations made after it was generated are not visible until refresh."
        )
    }

    func testUnparseableTrustTimesYieldNoAuthorityStatus() {
        let broken = VerifiedWeddingDayManifestTrust(
            weddingId: weddingId, weddingShortId: shortId, eventKey: "wedding-day",
            generatedAt: "not-a-date", expiresAt: "2099-01-01T00:00:00Z", rootKeyId: "root-v1", keys: []
        )
        XCTAssertNil(WeddingDayAuthorityStatus(trust: broken, now: Date()))
    }

    func testGateExposesAuthorityStatusAndFakesDefaultToNil() async throws {
        let store = try await seededStore()
        let gate = ManifestBackedWeddingDayGate(
            baseURL: URL(string: "https://example.com")!,
            bearerToken: "operator-bearer",
            gateContext: GateOperationalContext(
                grantId: "grant-1", assignmentId: "assignment-1", weddingId: weddingId,
                weddingTitle: "Wedding", gateId: "gate-1", gateName: "Main Gate",
                operatorUserId: "operator-1", capabilities: ["gate.manifest.read", "gate.checkin.write"]
            ),
            trustedRootPublicKeyDerBase64: WW2TestSigner.publicKeyDerBase64(key),
            offlineStore: store,
            trustStore: trustStore
        )
        let now = Date().addingTimeInterval(3 * 3600)
        let maybeStatus = await gate.authorityStatus(now: now)
        let status = try XCTUnwrap(maybeStatus)
        XCTAssertTrue(status.isStale)
        XCTAssertFalse(status.isExpired)

        try await trustStore.clear(weddingId: weddingId)
        let cleared = await gate.authorityStatus(now: now)
        XCTAssertNil(cleared)

        let fake: WeddingDayGateOperations = FakeGate()
        let fakeStatus = await fake.authorityStatus(now: now)
        XCTAssertNil(fakeStatus)
    }
}

/// A conformer that predates `authorityStatus(now:)` — it must still compile and report nil.
private struct FakeGate: WeddingDayGateOperations {
    var gateContext: GateOperationalContext {
        GateOperationalContext(
            grantId: "g", assignmentId: "a", weddingId: "w", weddingTitle: "W", gateId: "gate",
            gateName: "Gate", operatorUserId: "o", capabilities: []
        )
    }
    func refreshManifest() async throws {}
    func checkIn(qrPayload: String, count: Int) async throws -> CheckInVerificationResult {
        CheckInVerificationResult(status: .invalidPass, guestName: "", partySize: 0, checkedInCount: 0, message: "")
    }
    func reconcilePending() async -> WeddingDaySyncResult {
        WeddingDaySyncResult(syncedIds: [], failedIds: [], blockedLegacyIds: [])
    }
    func revokePass(passSerial: String, reason: String) async -> WeddingDayRevokeResult {
        WeddingDayRevokeResult(success: false)
    }
}

/// Records exactly what reached the wire for the Wedding Day check-in endpoint.
final class CheckInStub: URLProtocol, @unchecked Sendable {
    struct Reply: CustomStringConvertible {
        let status: Int
        let body: String
        var description: String { "HTTP \(status) \(body)" }
    }

    nonisolated(unsafe) static var replies: [Reply] = []
    nonisolated(unsafe) static var failWithNetworkError = false
    nonisolated(unsafe) static var requests: [URLRequest] = []
    nonisolated(unsafe) static var bodies: [Data] = []

    static var jsonBodies: [[String: Any]] {
        bodies.compactMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
    }

    static func reset() {
        replies = []
        failWithNetworkError = false
        requests = []
        bodies = []
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        CheckInStub.requests.append(request)
        if let body = request.httpBody {
            CheckInStub.bodies.append(body)
        } else if let stream = request.httpBodyStream {
            stream.open()
            var data = Data()
            var buffer = [UInt8](repeating: 0, count: 4096)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count <= 0 { break }
                data.append(contentsOf: buffer.prefix(count))
            }
            stream.close()
            CheckInStub.bodies.append(data)
        }
        if CheckInStub.failWithNetworkError {
            client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
            return
        }
        let reply = CheckInStub.replies.isEmpty
            ? Reply(status: 200, body: #"{"success":true}"#)
            : CheckInStub.replies.removeFirst()
        let response = HTTPURLResponse(
            url: request.url!, statusCode: reply.status, httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(reply.body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}
