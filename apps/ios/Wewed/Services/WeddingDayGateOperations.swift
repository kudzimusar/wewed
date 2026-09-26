import Foundation

public protocol WeddingDayGateOperations: Sendable {
    var gateContext: GateOperationalContext { get }
    func refreshManifest() async throws
    func checkIn(qrPayload: String, count: Int) async throws -> CheckInVerificationResult
    func reconcilePending() async -> WeddingDaySyncResult
    func revokePass(passSerial: String, reason: String) async -> WeddingDayRevokeResult
    /// Observability only: how old the cached, verified manifest authority is. Never gates admission.
    func authorityStatus(now: Date) async -> WeddingDayAuthorityStatus?
}

public extension WeddingDayGateOperations {
    func authorityStatus(now: Date) async -> WeddingDayAuthorityStatus? { nil }
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
        // The exact verified payload is queued — never a serial reconstructed from it — so sync can
        // present the same WW2 credential the server issued. New records carry no operator
        // authority; server sync derives the operator from the live Gate grant.
        let result = try await offlineStore.recordOfflineCheckIn(
            weddingId: gateContext.weddingId,
            token: qrPayload,
            count: count
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
            grantId: gateContext.grantId,
            offlineStore: offlineStore,
            trustStore: trustStore
        )
    }

    public func revokePass(passSerial: String, reason: String = "Revoked by gate operator") async -> WeddingDayRevokeResult {
        guard gateContext.capabilities.contains("gate.pass.revoke") else {
            return WeddingDayRevokeResult(
                success: false,
                code: "GATE_PASS_REVOKE_FORBIDDEN",
                error: "This gate assignment does not authorize pass revocation."
            )
        }

        let result = await syncService.revokePass(
            baseURL: baseURL,
            bearerToken: bearerToken,
            passSerial: passSerial,
            reason: reason,
            grantId: gateContext.grantId
        )
        guard result.success else { return result }

        do {
            try await offlineStore.markPassRevoked(weddingId: gateContext.weddingId, serial: passSerial)
            return result
        } catch {
            return WeddingDayRevokeResult(
                success: false,
                code: "REVOCATION_APPLIED_CACHE_UPDATE_FAILED",
                error: "The pass was revoked on the server, but this device could not update its offline cache. Refresh the manifest before scanning again."
            )
        }
    }

    public func authorityStatus(now: Date) async -> WeddingDayAuthorityStatus? {
        guard let trust = await trustStore.manifest(weddingId: gateContext.weddingId) else { return nil }
        return WeddingDayAuthorityStatus(trust: trust, now: now)
    }
}
