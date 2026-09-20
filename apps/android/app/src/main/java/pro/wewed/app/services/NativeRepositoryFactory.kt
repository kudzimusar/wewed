package pro.wewed.app.services

import pro.wewed.app.BuildConfig
import pro.wewed.app.models.NativeDataEnvironment

sealed class NativeRepositoryFactoryError(message: String) : IllegalStateException(message) {
    data object ProductionReadVerifyNotConfigured :
        NativeRepositoryFactoryError("Production read verification is not configured for this sprint.")

    data object ProductionDisabled :
        NativeRepositoryFactoryError("Production native repositories are disabled during the shadow parity sprint.")

    data object ShadowOnProductionIdentityForbidden :
        NativeRepositoryFactoryError("Mutable native Shadow runtimes may not execute under the Google Play package identity.")

    class PrivateRealShadowFixtureMissing(message: String) :
        NativeRepositoryFactoryError(message)
}

data class NativeRepositoryBundle(
    val wedding: WeddingRepository,
    val planner: PlannerDashboardRepository,
    val environment: NativeDataEnvironment,
    val baseUrl: String? = null
)

object NativeRepositoryFactory {
    fun make(
        environment: NativeDataEnvironment,
        baseUrl: String? = null
    ): NativeRepositoryBundle {
        if (BuildConfig.APPLICATION_ID == "pro.wewed.app" && environment.allowsMutableNativeDevelopment) {
            throw NativeRepositoryFactoryError.ShadowOnProductionIdentityForbidden
        }
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
                    baseUrl = baseUrl
                )
            }

            NativeDataEnvironment.PRODUCTION_READ_VERIFY ->
                throw NativeRepositoryFactoryError.ProductionReadVerifyNotConfigured

            NativeDataEnvironment.PRODUCTION ->
                throw NativeRepositoryFactoryError.ProductionDisabled
        }
    }
}

/**
 * Binds this bundle's wedding source to the single wedding it serves.
 *
 * Shadow and fixture bundles each carry exactly one wedding graph, so this resolves that identity
 * explicitly instead of letting a caller read the source unscoped.
 */
suspend fun NativeRepositoryBundle.scopedWedding(): ScopedWeddingRepository = wedding.forOnlyWedding()
