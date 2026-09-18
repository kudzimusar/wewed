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
    val baseUrl: String? = null
)

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

            NativeDataEnvironment.PRIVATE_REAL_SHADOW -> NativeRepositoryBundle(
                wedding = PrivateRealShadowWeddingRepository(),
                planner = PrivateRealShadowPlannerRepository(),
                environment = NativeDataEnvironment.PRIVATE_REAL_SHADOW,
                baseUrl = baseUrl
            )

            NativeDataEnvironment.PRODUCTION_READ_VERIFY ->
                throw NativeRepositoryFactoryError.ProductionReadVerifyNotConfigured

            NativeDataEnvironment.PRODUCTION ->
                throw NativeRepositoryFactoryError.ProductionDisabled
        }
    }
}
