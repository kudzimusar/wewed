package pro.wewed.app.services

import pro.wewed.app.models.NativeDataEnvironment

sealed class NativeRepositoryFactoryError(message: String) : IllegalStateException(message) {
    data object ProductionReadVerifyNotConfigured :
        NativeRepositoryFactoryError("Production read verification is not configured for this sprint.")

    data object ProductionDisabled :
        NativeRepositoryFactoryError("Production native repositories are disabled during the shadow parity sprint.")

    class PrivateRealShadowFixtureMissing(message: String) :
        NativeRepositoryFactoryError(message)
}

data class NativeRepositoryBundle(
    val wedding: WeddingRepository,
    val planner: PlannerDashboardRepository,
    val environment: NativeDataEnvironment,
    val baseUrl: String? = null,
    /** SHA-256 of the exact private snapshot bytes loaded; null for datasets compiled into the app. */
    val dataFingerprint: String? = null
)

internal fun sha256Hex(bytes: ByteArray): String =
    java.security.MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

object NativeRepositoryFactory {
    fun make(
        environment: NativeDataEnvironment,
        baseUrl: String? = null
    ): NativeRepositoryBundle {
        NativeEnvironmentGuard.validate(baseUrl, environment)

        return when (environment) {
            NativeDataEnvironment.FIXTURE -> NativeRepositoryBundle(
                wedding = FixtureWeddingRepository(),
                planner = FixturePlannerDashboardRepository(),
                environment = NativeDataEnvironment.FIXTURE
            )

            NativeDataEnvironment.SHADOW, NativeDataEnvironment.SANITIZED_SHADOW -> NativeRepositoryBundle(
                wedding = ShadowReferenceWeddingRepository(),
                planner = ShadowReferencePlannerRepository(),
                environment = environment,
                baseUrl = baseUrl
            )

            NativeDataEnvironment.PRIVATE_REAL_SHADOW -> {
                // Load once so every native projection is built from the exact same account snapshot.
                // Explicit private-real selection still fails here if the protected snapshot is absent.
                val snapshot = PrivateRealShadowWeddingRepository.loadSnapshotString()
                NativeRepositoryBundle(
                    wedding = PrivateRealShadowWeddingRepository(jsonString = snapshot),
                    planner = PrivateRealShadowPlannerRepository(jsonString = snapshot),
                    environment = NativeDataEnvironment.PRIVATE_REAL_SHADOW,
                    baseUrl = baseUrl,
                    dataFingerprint = sha256Hex(snapshot.toByteArray(Charsets.UTF_8))
                )
            }

            NativeDataEnvironment.PRODUCTION_READ_VERIFY ->
                throw NativeRepositoryFactoryError.ProductionReadVerifyNotConfigured

            NativeDataEnvironment.PRODUCTION ->
                throw NativeRepositoryFactoryError.ProductionDisabled
        }
    }
}
