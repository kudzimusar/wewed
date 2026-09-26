import XCTest
@testable import WewedKit

final class NativeLaunchConfigurationTests: XCTestCase {
    func testDefaultNeverSilentlyUsesFixture() {
        let config = NativeLaunchConfiguration.resolve(environment: [:])
        XCTAssertTrue([.privateRealShadow, .sanitizedShadow].contains(config.environment))
        XCTAssertNil(config.baseURL)
    }

    func testFixtureRequiresExplicitSelection() {
        let config = NativeLaunchConfiguration.resolve(environment: ["WEWED_NATIVE_ENV": "fixture"])
        XCTAssertEqual(config.environment, .fixture)
    }

    func testShadowConfigurationUsesExplicitBaseURL() {
        let config = NativeLaunchConfiguration.resolve(environment: [
            "WEWED_NATIVE_ENV": "shadow",
            "WEWED_SHADOW_API_BASE_URL": "http://127.0.0.1:8787"
        ])
        XCTAssertEqual(config.environment, .shadow)
        XCTAssertEqual(config.baseURL?.absoluteString, "http://127.0.0.1:8787")
    }

    func testProductionStringDoesNotSilentlyDowngrade() {
        let config = NativeLaunchConfiguration.resolve(environment: [
            "WEWED_NATIVE_ENV": "production"
        ])
        XCTAssertEqual(config.environment, .production)
    }

    func testSanitizedAndPrivateRealShadowParsing() {
        let sanitized = NativeLaunchConfiguration.resolve(
            environment: ["WEWED_NATIVE_ENV": "sanitized_shadow"],
            arguments: []
        )
        XCTAssertEqual(sanitized.environment, .sanitizedShadow)

        let privateReal = NativeLaunchConfiguration.resolve(
            environment: ["WEWED_NATIVE_ENV": "private_real_shadow"],
            arguments: []
        )
        XCTAssertEqual(privateReal.environment, .privateRealShadow)
    }

    func testPrivateRealShadowCanBeForcedWithLaunchArgument() {
        let config = NativeLaunchConfiguration.resolve(
            environment: [:],
            arguments: ["Wewed", "wewed_native_env", "private_real_shadow"]
        )
        XCTAssertEqual(config.environment, .privateRealShadow)
    }

    func testEnvironmentVariableWinsOverLaunchArgument() {
        let config = NativeLaunchConfiguration.resolve(
            environment: ["WEWED_NATIVE_ENV": "sanitized_shadow"],
            arguments: ["Wewed", "wewed_native_env=private_real_shadow"]
        )
        XCTAssertEqual(config.environment, .sanitizedShadow)
    }

    /// An ordinary launch must not depend on a qualification artefact.
    ///
    /// This is the defect the UAT qualification found: the resolver checked whether the Private
    /// Real Shadow snapshot existed on disk and silently selected that environment when it did. The
    /// guest invitation journey — a Universal Link from Safari, a tap in WhatsApp — therefore
    /// changed data source depending on a file, and surfaced "Private Real Shadow is not available"
    /// in the middle of an ordinary invitation when that file could not be read.
    func testAnOrdinaryLaunchNeverSelectsPrivateRealShadow() {
        for raw in [[String: String](), ["WEWED_NATIVE_ENV": ""], ["WEWED_NATIVE_ENV": "unrecognised"]] {
            let resolved = NativeLaunchConfiguration.resolve(
                environment: raw, arguments: [], isDebugBuild: true
            )
            XCTAssertNotEqual(resolved.environment, .privateRealShadow,
                              "an ordinary launch must not open Private Real Shadow")
            XCTAssertEqual(resolved.environment, .sanitizedShadow)
        }
    }

    /// Private Real Shadow is a qualification configuration, entered only when asked for.
    func testPrivateRealShadowRequiresAnExplicitRequest() {
        for name in ["private", "private_shadow", "private-real-shadow", "private_real_shadow"] {
            let resolved = NativeLaunchConfiguration.resolve(
                environment: ["WEWED_NATIVE_ENV": name], arguments: [], isDebugBuild: true
            )
            XCTAssertEqual(resolved.environment, .privateRealShadow)
        }
    }

    /// A release build with no environment named falls through to production, which the repository
    /// factory refuses. Refusing to start is correct for a release build with no live data path;
    /// silently showing a real guest demo data is not.
    func testAReleaseBuildNeverSilentlyFallsBackToDemoData() {
        let resolved = NativeLaunchConfiguration.resolve(
            environment: [:], arguments: [], isDebugBuild: false
        )
        XCTAssertEqual(resolved.environment, .production)
        XCTAssertFalse(resolved.environment.allowsMutableNativeDevelopment,
                       "a release build must not open a development data environment")
    }
}
