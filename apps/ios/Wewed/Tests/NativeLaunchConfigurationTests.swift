import XCTest
@testable import WewedKit

final class NativeLaunchConfigurationTests: XCTestCase {
    func testDefaultIsDeterministicallySanitizedNeverImplicitPrivate() {
        // Private real data must be requested explicitly, even when a snapshot exists on this machine.
        let config = NativeLaunchConfiguration.resolve(environment: [:], arguments: [])
        XCTAssertEqual(config.environment, .sanitizedShadow)
        XCTAssertNil(config.baseURL)
        XCTAssertEqual(config.shadowAccount, .couple)
        XCTAssertNil(config.invitationToken)
    }

    func testShadowAccountAndInvitationTokenParsing() {
        let guest = NativeLaunchConfiguration.resolve(
            environment: [:],
            arguments: ["Wewed", "wewed_native_env", "private_real_shadow", "wewed_shadow_account", "guest", "wewed_invitation_token", " shadow-pending-guest "]
        )
        XCTAssertEqual(guest.shadowAccount, .guest)
        XCTAssertEqual(guest.invitationToken, "shadow-pending-guest")
        XCTAssertEqual(
            NativeLaunchConfiguration.resolve(environment: [:], arguments: ["Wewed", "wewed_shadow_account=couple-planner"]).shadowAccount,
            .coupleAndPlanner
        )
        // Unknown account strings never grant a broader role; they fall back to the wedding owner.
        XCTAssertEqual(
            NativeLaunchConfiguration.resolve(environment: [:], arguments: ["Wewed", "wewed_shadow_account", "superuser"]).shadowAccount,
            .couple
        )
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
}
