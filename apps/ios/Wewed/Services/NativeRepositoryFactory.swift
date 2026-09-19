import Foundation

public enum NativeRepositoryFactoryError: Error, Equatable, Sendable {
    case productionReadVerifyNotConfigured
    case productionDisabled
    case privateRealShadowFixtureMissing(String)
}

public struct NativeRepositoryBundle: Sendable {
    public let wedding: WeddingRepositoryProtocol
    public let planner: PlannerDashboardRepositoryProtocol
    public let environment: NativeDataEnvironment
    public let baseURL: URL?

    public init(
        wedding: WeddingRepositoryProtocol,
        planner: PlannerDashboardRepositoryProtocol,
        environment: NativeDataEnvironment,
        baseURL: URL? = nil
    ) {
        self.wedding = wedding
        self.planner = planner
        self.environment = environment
        self.baseURL = baseURL
    }
}

public enum NativeRepositoryFactory {
    public static func make(
        environment: NativeDataEnvironment,
        baseURL: URL? = nil
    ) throws -> NativeRepositoryBundle {
        try NativeEnvironmentGuard.validate(baseURL: baseURL, environment: environment)

        switch environment {
        case .fixture:
            return NativeRepositoryBundle(
                wedding: FixtureWeddingRepository(),
                planner: FixturePlannerDashboardRepository(),
                environment: .fixture
            )

        case .shadow, .sanitizedShadow:
            return NativeRepositoryBundle(
                wedding: ShadowReferenceWeddingRepository(),
                planner: ShadowReferencePlannerRepository(),
                environment: environment,
                baseURL: baseURL
            )

        case .privateRealShadow:
            // Load once so all native projections are initialized from the exact same account snapshot.
            // Explicit private-real selection fails here when the protected file is unavailable.
            let snapshot = try PrivateRealShadowWeddingRepository.loadSnapshotData()
            return NativeRepositoryBundle(
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
            throw NativeRepositoryFactoryError.productionDisabled
        }
    }
}
