import XCTest
@testable import WewedKit

final class NativeEnvironmentGuardTests: XCTestCase {
    func testShadowRejectsProductionHost() {
        XCTAssertThrowsError(
            try NativeEnvironmentGuard.validate(
                baseURL: URL(string: "https://wewed.pro/api"),
                environment: .shadow
            )
        )
    }

    func testEveryMutableShadowRuntimeRejectsProductionHost() {
        for environment in [
            NativeDataEnvironment.shadow,
            .sanitizedShadow,
            .privateRealShadow
        ] {
            XCTAssertThrowsError(
                try NativeEnvironmentGuard.validate(
                    baseURL: URL(string: "https://wewed.pro/api"),
                    environment: environment
                )
            )
        }
    }

    func testShadowAcceptsLocalhost() {
        for environment in [
            NativeDataEnvironment.shadow,
            .sanitizedShadow,
            .privateRealShadow
        ] {
            XCTAssertNoThrow(
                try NativeEnvironmentGuard.validate(
                    baseURL: URL(string: "http://127.0.0.1:8787"),
                    environment: environment
                )
            )
        }
    }

    func testProductionRuntimeIsAllowedForPhase5ReadOnlyBootstrap() {
        XCTAssertNoThrow(
            try NativeEnvironmentGuard.validate(
                baseURL: URL(string: "https://wewed.pro"),
                environment: .production
            )
        )
    }

    /// Master plan Phase 8 closure round 4 §1 — the Android sibling is
    /// `productionFactoryYieldsBootstrapWithNoRepositoryValuedBoundaryObject`.
    func testProductionFactoryYieldsBootstrapWithNoRepositoryValuedBoundaryObject() throws {
        let outcome = try NativeRepositoryFactory.make(
            environment: .production,
            baseURL: URL(string: "https://wewed.pro")
        )
        guard case .productionBootstrap = outcome else {
            return XCTFail("PRODUCTION must never construct a wedding/planner-carrying outcome, boundary or otherwise.")
        }
    }
}
