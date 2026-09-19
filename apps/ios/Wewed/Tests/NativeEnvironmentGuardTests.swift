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

    func testProductionRuntimeIsDisabledDuringShadowSprint() {
        XCTAssertThrowsError(
            try NativeEnvironmentGuard.validate(
                baseURL: URL(string: "https://wewed.pro"),
                environment: .production
            )
        )
    }
}
