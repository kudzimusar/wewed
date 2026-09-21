import XCTest
@testable import WewedKit

final class AppLaunchModeResolverTests: XCTestCase {
    func testProductionDegradesToGuestOnly() throws {
        let config = NativeLaunchConfiguration(environment: .production, baseURL: nil)
        let mode = try AppLaunchModeResolver.resolve(configuration: config)
        switch mode {
        case .guestOnly:
            break
        case .workspace:
            XCTFail("Production configuration must degrade to guestOnly launch mode")
        }
    }

    /// The regression this task exists for. A `catch { return .guestOnly }` that ignores the
    /// error's identity would pass `testProductionDegradesToGuestOnly` above and still be wrong:
    /// it would show the same guest-only screen for a guard rejection or a construction bug as it
    /// does for the one deliberate shutdown. Only `productionDisabled` may degrade; anything else
    /// production throws must reach the caller.
    func testUnexpectedProductionErrorIsNotSwallowed() {
        let config = NativeLaunchConfiguration(environment: .production, baseURL: nil)
        XCTAssertThrowsError(
            try AppLaunchModeResolver.resolve(configuration: config) { _, _ in
                // Any real `NativeRepositoryFactoryError` other than `productionDisabled` stands
                // in for "unexpected": the factory throws this one for an unrelated reason (a
                // Shadow-on-production-identity build), not as an expected production shutdown.
                throw NativeRepositoryFactoryError.shadowOnProductionIdentityForbidden
            }
        ) { error in
            XCTAssertEqual(error as? NativeRepositoryFactoryError, .shadowOnProductionIdentityForbidden)
        }
    }

    /// `productionDisabled` is only ever the expected shutdown when production is what was asked
    /// for. A non-production environment that somehow produced this error would be an unrelated,
    /// unexpected failure of its own and must not be reinterpreted as production's known case.
    func testProductionDisabledFromANonProductionEnvironmentIsNotReinterpreted() {
        let config = NativeLaunchConfiguration(environment: .shadow, baseURL: nil)
        XCTAssertThrowsError(
            try AppLaunchModeResolver.resolve(configuration: config) { _, _ in
                throw NativeRepositoryFactoryError.productionDisabled
            }
        ) { error in
            XCTAssertEqual(error as? NativeRepositoryFactoryError, .productionDisabled)
        }
    }

    /// The signal the *real* path actually produces. `NativeEnvironmentGuard.validate` rejects
    /// `.production` before `NativeRepositoryFactory.make`'s own switch ever reaches its
    /// `.production` case, so this — not `NativeRepositoryFactoryError.productionDisabled` — is
    /// what `testProductionDegradesToGuestOnly` above exercises through the real, uninjected
    /// factory. Both must degrade, because both mean the same thing from two different layers.
    func testGuardLevelProductionDisabledAlsoDegradesToGuestOnly() throws {
        let config = NativeLaunchConfiguration(environment: .production, baseURL: nil)
        let mode = try AppLaunchModeResolver.resolve(configuration: config) { _, _ in
            throw NativeEnvironmentGuardError.productionDisabled
        }
        switch mode {
        case .guestOnly: break
        case .workspace: XCTFail("Guard-level productionDisabled must also degrade to guestOnly")
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
