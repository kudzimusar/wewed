import XCTest
@testable import WewedKit

final class NativeLaunchConfigurationTests: XCTestCase {
    func testDefaultsToFixture() {
        let config = NativeLaunchConfiguration.resolve(environment: [:])
        XCTAssertEqual(config.environment, .fixture)
        XCTAssertNil(config.baseURL)
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
}
