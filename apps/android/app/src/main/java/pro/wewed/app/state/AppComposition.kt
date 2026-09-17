package pro.wewed.app.state

import pro.wewed.app.services.FixtureWeddingRepository
import pro.wewed.app.services.ManifestBackedWeddingDayGate
import pro.wewed.app.services.OfflineManifestStore
import pro.wewed.app.services.ServerBackedWeddingDayOperations
import pro.wewed.app.services.UrlConnectionWeddingDayTransport
import pro.wewed.app.services.WeddingDayGateAwareRepository
import pro.wewed.app.services.WeddingDayManifestTrustStore
import pro.wewed.app.services.WeddingDaySyncService
import pro.wewed.app.services.WeddingRepository
import java.io.File
import kotlin.io.path.createTempDirectory

/**
 * Composition modes for the Wewed Android application.
 *
 * - FIXTURE:                 Fully local/offline fixture data (default; no backend required).
 * - ISOLATED_WEDDING_DAY:    Isolated integration mode pointing at a local/CI Next.js server.
 * - PRODUCTION:              Production Next.js backend with a real wedding credential manifest.
 */
enum class AppCompositionMode {
    FIXTURE,
    ISOLATED_WEDDING_DAY,
    PRODUCTION
}

/**
 * Resolved composition handed to [AppViewModel]. Factories below build the correct
 * dependency graph without exposing construction details to ViewModels or UI.
 */
data class AppComposition(
    val mode: AppCompositionMode,
    val repository: WeddingRepository,
    val gate: ManifestBackedWeddingDayGate?,
    val server: ServerBackedWeddingDayOperations?,
    val showDemoSimulations: Boolean
) {
    companion object {
        /** Fully local fixture composition — default for development and standard tests. */
        fun fixture(base: WeddingRepository = FixtureWeddingRepository()): AppComposition =
            AppComposition(
                mode = AppCompositionMode.FIXTURE,
                repository = base,
                gate = null,
                server = null,
                showDemoSimulations = true
            )

        /**
         * Isolated Wedding Day composition.
         * Points at a local/CI Next.js server. Demo simulation buttons remain visible.
         */
        fun isolatedWeddingDay(
            baseUrl: String,
            bearerToken: String,
            weddingId: String,
            trustedRootPublicKeyDerBase64: String = "",
            trustedRootKeyId: String? = null,
            base: WeddingRepository = FixtureWeddingRepository(),
            storageDir: File? = null
        ): AppComposition {
            val transport = UrlConnectionWeddingDayTransport(baseUrl)
            val server = ServerBackedWeddingDayOperations(transport, bearerToken, weddingId)
            val dir = storageDir ?: createTempDirectory("wewed_isolated").toFile()
            val offlineStore = OfflineManifestStore(dir)
            val trustStore = WeddingDayManifestTrustStore(dir)
            val syncService = WeddingDaySyncService(
                transport = transport,
                trustedRootPublicKeyDerBase64 = trustedRootPublicKeyDerBase64,
                trustedRootKeyId = trustedRootKeyId
            )
            val gate = ManifestBackedWeddingDayGate(
                bearerToken = bearerToken,
                weddingId = weddingId,
                offlineStore = offlineStore,
                trustStore = trustStore,
                syncService = syncService
            )
            val repo = WeddingDayGateAwareRepository(base, gate, server)
            return AppComposition(
                mode = AppCompositionMode.ISOLATED_WEDDING_DAY,
                repository = repo,
                gate = gate,
                server = server,
                showDemoSimulations = true
            )
        }

        /**
         * Production composition.
         * Connects to the live Next.js backend. Demo simulation buttons are hidden.
         */
        fun production(
            baseUrl: String,
            bearerToken: String,
            weddingId: String,
            trustedRootPublicKeyDerBase64: String,
            trustedRootKeyId: String? = null,
            base: WeddingRepository = FixtureWeddingRepository(),
            storageDir: File
        ): AppComposition {
            val transport = UrlConnectionWeddingDayTransport(baseUrl)
            val server = ServerBackedWeddingDayOperations(transport, bearerToken, weddingId)
            val offlineStore = OfflineManifestStore(storageDir)
            val trustStore = WeddingDayManifestTrustStore(storageDir)
            val syncService = WeddingDaySyncService(
                transport = transport,
                trustedRootPublicKeyDerBase64 = trustedRootPublicKeyDerBase64,
                trustedRootKeyId = trustedRootKeyId
            )
            val gate = ManifestBackedWeddingDayGate(
                bearerToken = bearerToken,
                weddingId = weddingId,
                offlineStore = offlineStore,
                trustStore = trustStore,
                syncService = syncService
            )
            val repo = WeddingDayGateAwareRepository(base, gate, server)
            return AppComposition(
                mode = AppCompositionMode.PRODUCTION,
                repository = repo,
                gate = gate,
                server = server,
                showDemoSimulations = false
            )
        }
    }
}
