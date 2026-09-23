import XCTest
@testable import WewedKit

final class AppLaunchModeResolverTests: XCTestCase {
    func testProductionResolvesToReadOnlyWorkspace() throws {
        let config = NativeLaunchConfiguration(environment: .production, baseURL: nil)
        let mode = try AppLaunchModeResolver.resolve(configuration: config)
        switch mode {
        case .workspace(let appState):
            XCTAssertEqual(appState.dataEnvironment, .production)
            // Master plan Phase 8 closure round 4 §1 — PRODUCTION resolves to an AppState with no
            // wedding/planner repository bound at all yet; reading either now throws
            // `ProductionRepositoryUnbound` rather than returning a boundary placeholder.
            XCTAssertThrowsError(try appState.repository) { error in
                XCTAssertTrue(error is ProductionRepositoryUnbound)
            }
            XCTAssertThrowsError(try appState.plannerRepository) { error in
                XCTAssertTrue(error is ProductionRepositoryUnbound)
            }
        case .guestOnly:
            XCTFail("Production account bootstrap must reach the read-only workspace host")
        }
    }

    func testUnexpectedProductionConstructionErrorIsNotSwallowed() {
        let config = NativeLaunchConfiguration(environment: .production, baseURL: nil)
        XCTAssertThrowsError(
            try AppLaunchModeResolver.resolve(configuration: config) { _, _ in
                throw NativeRepositoryFactoryError.shadowOnProductionIdentityForbidden
            }
        ) { error in
            XCTAssertEqual(error as? NativeRepositoryFactoryError, .shadowOnProductionIdentityForbidden)
        }
    }

    func testProductionReadVerifyThrowsVisibly() {
        let config = NativeLaunchConfiguration(environment: .productionReadVerify, baseURL: nil)
        XCTAssertThrowsError(try AppLaunchModeResolver.resolve(configuration: config)) { error in
            XCTAssertEqual(error as? NativeRepositoryFactoryError, .productionReadVerifyNotConfigured)
        }
    }

    func testShadowPointingToProductionHostThrowsVisibly() {
        let prodHostURL = URL(string: "https://wewed.pro")!
        let config = NativeLaunchConfiguration(environment: .shadow, baseURL: prodHostURL)
        XCTAssertThrowsError(try AppLaunchModeResolver.resolve(configuration: config)) { error in
            XCTAssertEqual(error as? NativeEnvironmentGuardError, .shadowPointsToProductionHost("wewed.pro"))
        }
    }

    func testSanitizedShadowResolvesToWorkspace() throws {
        let config = NativeLaunchConfiguration(environment: .sanitizedShadow, baseURL: nil)
        let mode = try AppLaunchModeResolver.resolve(configuration: config)
        switch mode {
        case .workspace(let appState):
            XCTAssertEqual(appState.dataEnvironment, .sanitizedShadow)
        case .guestOnly:
            XCTFail("Sanitized shadow must resolve to workspace launch mode")
        }
    }

    func testPrivateRealShadowResolvesToWorkspaceWhenAvailable() throws {
        try XCTSkipUnless(FileManager.default.fileExists(atPath: PrivateRealShadowWeddingRepository.defaultSnapshotPath()))
        let config = NativeLaunchConfiguration(environment: .privateRealShadow, baseURL: nil)
        let mode = try AppLaunchModeResolver.resolve(configuration: config)
        switch mode {
        case .workspace(let appState):
            XCTAssertEqual(appState.dataEnvironment, .privateRealShadow)
        case .guestOnly:
            XCTFail("Private real shadow must resolve to workspace launch mode")
        }
    }
}
