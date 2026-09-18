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

    func testShadowAcceptsLocalhost() {
        XCTAssertNoThrow(
            try NativeEnvironmentGuard.validate(
                baseURL: URL(string: "http://127.0.0.1:8787"),
                environment: .shadow
            )
        )
    }

    func testProductionRuntimeIsDisabledDuringShadowSprint() {
        XCTAssertThrowsError(
            try NativeEnvironmentGuard.validate(
                baseURL: URL(string: "https://wewed.pro"),
                environment: .production
            )
        )
    }
}
