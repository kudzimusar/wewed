package pro.wewed.app.services

import pro.wewed.app.models.CheckInVerificationResult

interface WeddingDayGateOperations {
    suspend fun refreshManifest()
    suspend fun checkIn(qrPayload: String, count: Int, usherId: String): CheckInVerificationResult
    suspend fun reconcilePending(): WeddingDaySyncResult
}

/**
 * Opt-in isolated Wedding Day gate runtime. Nothing instantiates this by default, so landing it
 * cannot connect the protected Android build to a backend without explicit integration config.
 */
class ManifestBackedWeddingDayGate(
    private val bearerToken: String,
    private val weddingId: String,
    private val gateId: String? = null,
    private val offlineStore: OfflineManifestStoreProtocol,
    private val trustStore: WeddingDayManifestTrustStore,
    private val syncService: WeddingDaySyncService
) : WeddingDayGateOperations {
    override suspend fun refreshManifest() {
        syncService.downloadAndCacheManifest(
            bearerToken = bearerToken,
            expectedWeddingId = weddingId,
            offlineStore = offlineStore,
            trustStore = trustStore
        )
    }

    override suspend fun checkIn(
        qrPayload: String,
        count: Int,
        usherId: String
    ): CheckInVerificationResult {
        val item = syncService.verifyOfflinePass(
            token = qrPayload,
            weddingId = weddingId,
            offlineStore = offlineStore,
            trustStore = trustStore
        )
        return offlineStore.recordOfflineCheckIn(
            weddingId = weddingId,
            serial = item.serial,
            count = count,
            usherId = usherId
        )
    }

    override suspend fun reconcilePending(): WeddingDaySyncResult = syncService.syncPendingCheckIns(
        bearerToken = bearerToken,
        weddingId = weddingId,
        gateId = gateId,
        offlineStore = offlineStore,
        trustStore = trustStore
    )
}
