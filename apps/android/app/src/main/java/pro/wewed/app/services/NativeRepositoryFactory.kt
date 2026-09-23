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

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure round 4 §1
 * (NativeRepositoryFactory.PRODUCTION closure — for real this time).
 *
 * Every non-production environment carries a real, fixed, single-account repository pair for its
 * whole lifetime — [NonProduction] models that directly. PRODUCTION carries none at construction
 * time: there is no verified account or grant yet, so there is nothing honest to hand a caller as a
 * `WeddingRepository`/`PlannerDashboardRepository` at all. [ProductionBootstrap] models that
 * explicitly — it is not a repository-shaped value, has no `wedding`/`planner` field, and cannot be
 * mistaken for one. A mature production repository only ever comes from
 * [AppViewModel.bindProductionRepositories] once a real `(accessUserId, grantId)` binding exists —
 * see `ProductionBinding` in `AppState.kt`.
 */
sealed interface NativeRepositoryOutcome {
    val environment: NativeDataEnvironment

    data class NonProduction(
        val wedding: WeddingRepository,
        val planner: PlannerDashboardRepository,
        override val environment: NativeDataEnvironment,
        val baseUrl: String? = null,
    ) : NativeRepositoryOutcome

    data class ProductionBootstrap(
        val baseUrl: String?,
    ) : NativeRepositoryOutcome {
        override val environment: NativeDataEnvironment get() = NativeDataEnvironment.PRODUCTION
    }
}

object NativeRepositoryFactory {
    fun make(
        environment: NativeDataEnvironment,
        baseUrl: String? = null
    ): NativeRepositoryOutcome {
        if (BuildConfig.APPLICATION_ID == "pro.wewed.app" && environment.allowsMutableNativeDevelopment) {
            throw NativeRepositoryFactoryError.ShadowOnProductionIdentityForbidden
        }
        NativeEnvironmentGuard.validate(baseUrl, environment)

        return when (environment) {
            NativeDataEnvironment.FIXTURE -> NativeRepositoryOutcome.NonProduction(
                wedding = FixtureWeddingRepository(),
                planner = FixturePlannerDashboardRepository(),
                environment = NativeDataEnvironment.FIXTURE
            )

            NativeDataEnvironment.SHADOW, NativeDataEnvironment.SANITIZED_SHADOW -> NativeRepositoryOutcome.NonProduction(
                wedding = ShadowReferenceWeddingRepository(),
                planner = ShadowReferencePlannerRepository(),
                environment = environment,
                baseUrl = baseUrl
            )

            NativeDataEnvironment.PRIVATE_REAL_SHADOW -> {
                // Load once so every native projection is built from the exact same account snapshot.
                // Explicit private-real selection still fails here if the protected snapshot is absent.
                val snapshot = PrivateRealShadowWeddingRepository.loadSnapshotString()
                NativeRepositoryOutcome.NonProduction(
                    wedding = PrivateRealShadowWeddingRepository(jsonString = snapshot),
                    planner = PrivateRealShadowPlannerRepository(jsonString = snapshot),
                    environment = NativeDataEnvironment.PRIVATE_REAL_SHADOW,
                    baseUrl = baseUrl
                )
            }

            NativeDataEnvironment.PRODUCTION_READ_VERIFY ->
                throw NativeRepositoryFactoryError.ProductionReadVerifyNotConfigured

            // Master plan Phase 8 closure round 4 §1 — no wedding/planner repository of any kind is
            // constructed here, boundary or otherwise. Production starts with nothing repository-
            // shaped at all; AppViewModel's ProductionBinding is the ONLY path to a real one.
            NativeDataEnvironment.PRODUCTION -> NativeRepositoryOutcome.ProductionBootstrap(baseUrl)
        }
    }
}

/**
 * Binds this bundle's wedding source to the single wedding it serves.
 *
 * Shadow and fixture bundles each carry exactly one wedding graph, so this resolves that identity
 * explicitly instead of letting a caller read the source unscoped. Only ever defined for
 * [NativeRepositoryOutcome.NonProduction] — a [NativeRepositoryOutcome.ProductionBootstrap] has no
 * wedding to scope.
 */
suspend fun NativeRepositoryOutcome.NonProduction.scopedWedding(): ScopedWeddingRepository = wedding.forOnlyWedding()
