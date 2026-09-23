import Foundation

public protocol WeddingDayGateOperations: Sendable {
    var gateContext: GateOperationalContext { get }
    func refreshManifest() async throws
    func checkIn(qrPayload: String, count: Int) async throws -> CheckInVerificationResult
    func reconcilePending() async -> WeddingDaySyncResult
}

/// Opt-in Wedding Day gate runtime used by isolated integration builds/tests.
///
/// Phase 10 hardens only the authority seam. The runtime remains opt-in and is not connected to
/// Production until Phase 11. Wedding, gate and operator identity come from one immutable
/// server-derived GateOperationalContext rather than caller-controlled strings.
public actor ManifestBackedWeddingDayGate: WeddingDayGateOperations {
    private let baseURL: URL
    private let bearerToken: String
    public nonisolated let gateContext: GateOperationalContext
    private let trustedRootPublicKeyDerBase64: String
    private let trustedRootKeyId: String?
    private let offlineStore: OfflineManifestStoreProtocol
    private let trustStore: WeddingDayManifestTrustStore
    private let syncService: WeddingDaySyncService

    public init(
        baseURL: URL,
        bearerToken: String,
        gateContext: GateOperationalContext,
        trustedRootPublicKeyDerBase64: String,
        trustedRootKeyId: String? = nil,
        offlineStore: OfflineManifestStoreProtocol,
        trustStore: WeddingDayManifestTrustStore,
        syncService: WeddingDaySyncService = WeddingDaySyncService()
    ) {
        precondition(gateContext.capabilities.contains("gate.manifest.read"),
                     "Gate context does not authorize manifest access.")
        precondition(gateContext.capabilities.contains("gate.checkin.write"),
                     "Gate context does not authorize check-in.")
        self.baseURL = baseURL
        self.bearerToken = bearerToken
        self.gateContext = gateContext
        self.trustedRootPublicKeyDerBase64 = trustedRootPublicKeyDerBase64
        self.trustedRootKeyId = trustedRootKeyId
        self.offlineStore = offlineStore
        self.trustStore = trustStore
        self.syncService = syncService
    }

    public func refreshManifest() async throws {
        _ = try await syncService.downloadAndCacheManifest(
            baseURL: baseURL,
            bearerToken: bearerToken,
            expectedWeddingId: gateContext.weddingId,
            trustedRootPublicKeyDerBase64: trustedRootPublicKeyDerBase64,
            trustedRootKeyId: trustedRootKeyId,
            grantId: gateContext.grantId,
            offlineStore: offlineStore,
            trustStore: trustStore
        )
    }

    public func checkIn(
        qrPayload: String,
        count: Int
    ) async throws -> CheckInVerificationResult {
        _ = try await syncService.verifyOfflinePass(
            token: qrPayload,
            weddingId: gateContext.weddingId,
            offlineStore: offlineStore,
            trustStore: trustStore
        )
        let result = try await offlineStore.recordOfflineCheckIn(
            weddingId: gateContext.weddingId,
            serial: passSerial(from: qrPayload),
            count: count,
            usherId: gateContext.operatorUserId
        )

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
            weddingId: gateContext.weddingId,
            gateId: gateContext.gateId,
            grantId: gateContext.grantId,
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
