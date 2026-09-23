import Foundation

public enum NativeRepositoryFactoryError: Error, Equatable, Sendable {
    case productionReadVerifyNotConfigured
    case productionDisabled
    case shadowOnProductionIdentityForbidden
    case privateRealShadowFixtureMissing(String)
}

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure round 4 §1
/// (NativeRepositoryFactory.PRODUCTION closure — for real this time).
///
/// Every non-production environment carries a real, fixed, single-account repository pair for its
/// whole lifetime — `.nonProduction` models that directly. PRODUCTION carries none at construction
/// time: there is no verified account or grant yet, so there is nothing honest to hand a caller as a
/// `WeddingRepositoryProtocol`/`PlannerDashboardRepositoryProtocol` at all. `.productionBootstrap`
/// models that explicitly — it is not a repository-shaped value, has no `wedding`/`planner`
/// associated value, and cannot be mistaken for one. A mature production repository only ever comes
/// from `AppState.bindProductionRepositories` once a real `(accessUserId, grantId)` binding exists —
/// see `ProductionBinding` in `AppState.swift`. The Android sibling is `NativeRepositoryOutcome`.
public enum NativeRepositoryOutcome: Sendable {
    case nonProduction(
        wedding: WeddingRepositoryProtocol,
        planner: PlannerDashboardRepositoryProtocol,
        environment: NativeDataEnvironment,
        baseURL: URL?
    )
    case productionBootstrap(baseURL: URL?)

    public var environment: NativeDataEnvironment {
        switch self {
        case let .nonProduction(_, _, environment, _):
            return environment
        case .productionBootstrap:
            return .production
        }
    }
}

public enum NativeRepositoryFactory {
    public static func make(
        environment: NativeDataEnvironment,
        baseURL: URL? = nil
    ) throws -> NativeRepositoryOutcome {
        if Bundle.main.bundleIdentifier == "pro.wewed.app",
           environment.allowsMutableNativeDevelopment {
            throw NativeRepositoryFactoryError.shadowOnProductionIdentityForbidden
        }
        try NativeEnvironmentGuard.validate(baseURL: baseURL, environment: environment)

        switch environment {
        case .fixture:
            return .nonProduction(
                wedding: FixtureWeddingRepository(),
                planner: FixturePlannerDashboardRepository(),
                environment: .fixture,
                baseURL: nil
            )

        case .shadow, .sanitizedShadow:
            return .nonProduction(
                wedding: ShadowReferenceWeddingRepository(),
                planner: ShadowReferencePlannerRepository(),
                environment: environment,
                baseURL: baseURL
            )

        case .privateRealShadow:
            // Load once so all native projections are initialized from the exact same account snapshot.
            // Explicit private-real selection fails here when the protected file is unavailable.
            let snapshot = try PrivateRealShadowWeddingRepository.loadSnapshotData()
            return .nonProduction(
                wedding: try PrivateRealShadowWeddingRepository(jsonData: snapshot),
                planner: try PrivateRealShadowPlannerRepository(jsonData: snapshot),
                environment: .privateRealShadow,
                baseURL: baseURL
            )

        case .productionReadVerify:
            // The plan permits this only after the Shadow contracts mature and
            // a separately authorized, read-only production endpoint exists.
            throw NativeRepositoryFactoryError.productionReadVerifyNotConfigured

        case .production:
            // Master plan Phase 8 closure round 4 §1 — no wedding/planner repository of any kind is
            // constructed here, boundary or otherwise. Production starts with nothing repository-
            // shaped at all; AppState's ProductionBinding is the ONLY path to a real one.
            return .productionBootstrap(baseURL: baseURL)
        }
    }
}
