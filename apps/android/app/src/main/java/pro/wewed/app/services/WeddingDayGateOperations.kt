package pro.wewed.app.services

import pro.wewed.app.models.CheckInVerificationResult
import pro.wewed.app.navigation.GateOperationalContext

interface WeddingDayGateOperations {
    val gateContext: GateOperationalContext
    suspend fun refreshManifest()
    suspend fun checkIn(qrPayload: String, count: Int): CheckInVerificationResult
    suspend fun reconcilePending(): WeddingDaySyncResult
    suspend fun revokePass(passSerial: String, reason: String): WeddingDayRevokeResult

    /**
     * LQR01 — how old the cached, root-verified authority this device admits against is, at [now]
     * (epoch millis). Observability only: it never blocks admission or changes the manifest TTL.
     * Null when no verified manifest is cached or the gate cannot say.
     */
    suspend fun authorityStatus(now: Long): WeddingDayAuthorityStatus? = null
}

/**
 * Opt-in isolated Wedding Day gate runtime. Phase 10 hardens its authority seam without activating
 * Wedding Day in production: wedding/gate/operator identity is one immutable server-derived
 * [GateOperationalContext], never free caller strings.
 */
class ManifestBackedWeddingDayGate(
    private val bearerToken: String,
    override val gateContext: GateOperationalContext,
    private val offlineStore: OfflineManifestStoreProtocol,
    private val trustStore: WeddingDayManifestTrustStore,
    private val syncService: WeddingDaySyncService
) : WeddingDayGateOperations {
    init {
        require("gate.manifest.read" in gateContext.capabilities) {
            "Gate context does not authorize manifest access."
        }
        require("gate.checkin.write" in gateContext.capabilities) {
            "Gate context does not authorize check-in."
        }
    }

    override suspend fun refreshManifest() {
        syncService.downloadAndCacheManifest(
            bearerToken = bearerToken,
            expectedWeddingId = gateContext.weddingId,
            offlineStore = offlineStore,
            trustStore = trustStore,
            grantId = gateContext.grantId
        )
    }

    override suspend fun checkIn(
        qrPayload: String,
        count: Int
    ): CheckInVerificationResult {
        syncService.verifyOfflinePass(
            token = qrPayload,
            weddingId = gateContext.weddingId,
            offlineStore = offlineStore,
            trustStore = trustStore
        )
        // LQR01: the exact scanned credential — not its serial — is what gets queued, so sync can
        // present it for server re-verification. New records carry no operator authority either;
        // the server derives the operator from the live grant.
        return offlineStore.recordOfflineCheckIn(
            weddingId = gateContext.weddingId,
            token = qrPayload,
            count = count
        )
    }

    override suspend fun authorityStatus(now: Long): WeddingDayAuthorityStatus? {
        val trust = trustStore.manifest(gateContext.weddingId) ?: return null
        return WeddingDayAuthorityStatus.from(trust, now)
    }

    override suspend fun reconcilePending(): WeddingDaySyncResult = syncService.syncPendingCheckIns(
        bearerToken = bearerToken,
        weddingId = gateContext.weddingId,
        grantId = gateContext.grantId,
        offlineStore = offlineStore,
        trustStore = trustStore
    )

    override suspend fun revokePass(passSerial: String, reason: String): WeddingDayRevokeResult {
        if ("gate.pass.revoke" !in gateContext.capabilities) {
            return WeddingDayRevokeResult(
                success = false,
                code = "GATE_PASS_REVOKE_FORBIDDEN",
                error = "This gate assignment does not authorize pass revocation."
            )
        }

        val result = syncService.revokePass(
            bearerToken = bearerToken,
            passSerial = passSerial,
            reason = reason,
            grantId = gateContext.grantId
        )
        if (!result.success) return result

        return try {
            offlineStore.markPassRevoked(gateContext.weddingId, passSerial)
            result
        } catch (_: Exception) {
            WeddingDayRevokeResult(
                success = false,
                code = "REVOCATION_APPLIED_CACHE_UPDATE_FAILED",
                error = "The pass was revoked on the server, but this device could not update its offline cache. Refresh the manifest before scanning again."
            )
        }
    }
}
