import Foundation

public protocol WeddingDayGateOperations: Sendable {
    func refreshManifest() async throws
    func checkIn(qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult
    func reconcilePending() async -> WeddingDaySyncResult
}

/// Opt-in Wedding Day gate runtime used by isolated integration builds/tests.
///
/// AppState continues to default to FixtureWeddingRepository, so merely landing this type does not
/// connect the protected native build to a backend. A caller must explicitly inject this runtime
/// with an isolated base URL, operator bearer token, wedding id and trusted root public key.
public actor ManifestBackedWeddingDayGate: WeddingDayGateOperations {
    private let baseURL: URL
    private let bearerToken: String
    private let weddingId: String
    private let trustedRootPublicKeyDerBase64: String
    private let trustedRootKeyId: String?
    private let gateId: String?
    private let offlineStore: OfflineManifestStoreProtocol
    private let trustStore: WeddingDayManifestTrustStore
    private let syncService: WeddingDaySyncService

    public init(
        baseURL: URL,
        bearerToken: String,
        weddingId: String,
        trustedRootPublicKeyDerBase64: String,
        trustedRootKeyId: String? = nil,
        gateId: String? = nil,
        offlineStore: OfflineManifestStoreProtocol,
        trustStore: WeddingDayManifestTrustStore,
        syncService: WeddingDaySyncService = WeddingDaySyncService()
    ) {
        self.baseURL = baseURL
        self.bearerToken = bearerToken
        self.weddingId = weddingId
        self.trustedRootPublicKeyDerBase64 = trustedRootPublicKeyDerBase64
        self.trustedRootKeyId = trustedRootKeyId
        self.gateId = gateId
        self.offlineStore = offlineStore
        self.trustStore = trustStore
        self.syncService = syncService
    }

    public func refreshManifest() async throws {
        _ = try await syncService.downloadAndCacheManifest(
            baseURL: baseURL,
            bearerToken: bearerToken,
            expectedWeddingId: weddingId,
            trustedRootPublicKeyDerBase64: trustedRootPublicKeyDerBase64,
            trustedRootKeyId: trustedRootKeyId,
            offlineStore: offlineStore,
            trustStore: trustStore
        )
    }

    public func checkIn(
        qrPayload: String,
        count: Int,
        usherId: String
    ) async throws -> CheckInVerificationResult {
        _ = try await syncService.verifyOfflinePass(
            token: qrPayload,
            weddingId: weddingId,
            offlineStore: offlineStore,
            trustStore: trustStore
        )
        let result = try await offlineStore.recordOfflineCheckIn(
            weddingId: weddingId,
            serial: passSerial(from: qrPayload),
            count: count,
            usherId: usherId
        )

        // The legacy iOS store historically returned VALID_PASS for both partial and full offline
        // admissions. Normalize only at this runtime seam so existing fixture contracts remain stable.
        if result.status == .validPass && result.remainingCount > 0 {
            return CheckInVerificationResult(
                status: .partialCheckedIn,
                guestName: result.guestName,
                householdName: result.householdName,
                partySize: result.partySize,
                alreadyCheckedInCount: result.alreadyCheckedInCount,
                remainingCount: result.remainingCount,
                tableNumber: result.tableNumber,
                tableName: result.tableName,
                gateMessage: result.gateMessage
            )
        }
        return result
    }

    public func reconcilePending() async -> WeddingDaySyncResult {
        await syncService.syncPendingCheckIns(
            baseURL: baseURL,
            bearerToken: bearerToken,
            weddingId: weddingId,
            gateId: gateId,
            offlineStore: offlineStore,
            trustStore: trustStore
        )
    }

    private func passSerial(from token: String) -> String {
        switch TokenVerifier.parse(token: token) {
        case .success(let parsed): return parsed.passSerial
        case .failure: return ""
        }
    }
}
