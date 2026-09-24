import XCTest

/// Pins the non-store UAT identity and the sign-in screen's binding to real async session state.
final class NativeUatAndAuthUiContractTests: XCTestCase {
    private static func repoFile(_ relativePath: String) throws -> String {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent(relativePath)
            if FileManager.default.fileExists(atPath: candidate.path) {
                return try String(contentsOf: candidate, encoding: .utf8)
            }
            dir.deleteLastPathComponent()
        }
        throw XCTSkip("Not found relative to any ancestor: \(relativePath)")
    }

    func testUatConfigurationIsReleaseLikeAndNotStoreIdentity() throws {
        let project = try Self.repoFile("apps/ios/project.yml")
        XCTAssertTrue(project.contains("UAT: release"))
        XCTAssertTrue(project.contains("PRODUCT_BUNDLE_IDENTIFIER: pro.wewed.app.uatdev"))
        XCTAssertTrue(project.contains("Release:\n          PRODUCT_BUNDLE_IDENTIFIER: pro.wewed.app"))
    }

    func testLoginViewUsesSessionAsyncStateRatherThanLocalFakeSubmittingState() throws {
        let source = try Self.repoFile("apps/ios/Wewed/Views/Auth/LoginView.swift")
        XCTAssertTrue(source.contains("!session.isSigningIn"))
        XCTAssertTrue(source.contains("validationError ?? session.authenticationError"))
        XCTAssertTrue(source.contains("session.isSigningIn ? \"Signing in…\" : \"Sign In\""))
        XCTAssertTrue(source.contains("session.clearAuthenticationError()"))
        XCTAssertFalse(source.contains("@State private var submitting"))
    }
}
