package pro.wewed.app.services

import pro.wewed.app.models.CheckInVerificationResult
import pro.wewed.app.navigation.GateOperationalContext

interface WeddingDayGateOperations {
    val gateContext: GateOperationalContext
    suspend fun refreshManifest()
    suspend fun checkIn(qrPayload: String, count: Int): CheckInVerificationResult
    suspend fun reconcilePending(): WeddingDaySyncResult
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
            trustStore = trustStore
        )
    }

    override suspend fun checkIn(
        qrPayload: String,
        count: Int
    ): CheckInVerificationResult {
        val item = syncService.verifyOfflinePass(
            token = qrPayload,
            weddingId = gateContext.weddingId,
            offlineStore = offlineStore,
            trustStore = trustStore
        )
        return offlineStore.recordOfflineCheckIn(
            weddingId = gateContext.weddingId,
            serial = item.serial,
            count = count,
            usherId = gateContext.operatorUserId
        )
    }

    override suspend fun reconcilePending(): WeddingDaySyncResult = syncService.syncPendingCheckIns(
        bearerToken = bearerToken,
        weddingId = gateContext.weddingId,
        gateId = gateContext.gateId,
        offlineStore = offlineStore,
        trustStore = trustStore
    )
}
