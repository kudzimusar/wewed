import XCTest

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 7 §16 — this phase reconciles the
/// server onboarding graph but does not build native onboarding. It requires proof that native's
/// existing "Create account" affordance remains a dead end: tappable, but never reaching a
/// distinct account-creation screen or a `/api/auth/register` call.
///
/// This is a structural/source-level test, not a UI test — mirroring the server side's
/// `native-account-contract.test.ts` and this same module's `InvitationProtocolContractTests`,
/// which pin shape invariants against source/contract text the same way.
final class NativeOnboardingUnavailableTests: XCTestCase {

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

    private func rootViewSource() throws -> String {
        try Self.repoFile("apps/ios/Wewed/Views/RootView.swift")
    }

    func testCreateAccountTapOnlySetsAuthModeAndNeverBranchesOnIt() throws {
        let source = try rootViewSource()

        // The welcome screen's "Create account" affordance exists...
        XCTAssertTrue(
            source.contains("onCreateAccount: { authMode = .createAccount }"),
            "Expected WewedWelcomeView's onCreateAccount to set authMode = .createAccount"
        )

        // ...but RootView must never read authMode back to decide what to render. The only
        // legitimate reads are the welcome-screen guard (`authMode == nil`) and the final
        // catch-all `else`. Any explicit branch on `.createAccount` would mean a distinct
        // creation path now exists and this test must be revisited deliberately, not silently
        // pass.
        let illegalReads = [
            "authMode == .createAccount",
            "case .createAccount",
            "switch authMode",
        ]
        for pattern in illegalReads {
            XCTAssertFalse(
                source.contains(pattern),
                "RootView.swift now branches on .createAccount ('\(pattern)') — native onboarding " +
                "may have been activated. This requires a deliberate Phase 8+ decision, not a silent change."
            )
        }
    }

    func testNonNilAuthModeAlwaysFallsThroughToLoginView() throws {
        let source = try rootViewSource()

        // `} else if authMode == nil { <welcome> } else { LoginView(...) }` — the final else must
        // render LoginView for EVERY non-nil authMode, including .createAccount, with no
        // authMode-keyed branch in between.
        guard let welcomeRange = source.range(of: "} else if authMode == nil {") else {
            return XCTFail("Expected the 'else if authMode == nil' branch in RootView.swift")
        }
        let tail = String(source[welcomeRange.upperBound...])
        guard let elseRange = tail.range(of: "} else {") else {
            return XCTFail("Expected a final unconditional else branch after the welcome screen")
        }
        let finalElseBlock = String(tail[elseRange.upperBound...].prefix(200))
        XCTAssertTrue(
            finalElseBlock.contains("LoginView("),
            "The final else branch must render LoginView for every non-nil authMode"
        )
        XCTAssertFalse(
            finalElseBlock.contains("authMode:"),
            "LoginView must not be passed authMode — it has no distinct creation UI to select"
        )
    }

    func testNoNativeCodeCallsTheRegistrationEndpoint() throws {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent("apps/ios/Wewed")
            if FileManager.default.fileExists(atPath: candidate.path) {
                let enumerator = FileManager.default.enumerator(at: candidate, includingPropertiesForKeys: nil)
                var offenders: [String] = []
                while let file = enumerator?.nextObject() as? URL {
                    guard file.pathExtension == "swift" else { continue }
                    // Scan production/app source only — this test file itself is under Tests/ and
                    // necessarily mentions the endpoint in its own assertions and comments.
                    guard !file.path.contains("/Tests/") else { continue }
                    if let text = try? String(contentsOf: file, encoding: .utf8), text.contains("/api/auth/register") {
                        offenders.append(file.path)
                    }
                }
                XCTAssertTrue(
                    offenders.isEmpty,
                    "No native source file should reference /api/auth/register yet (native onboarding " +
                    "is not activated in this phase). Found: \(offenders)"
                )
                return
            }
            dir.deleteLastPathComponent()
        }
        throw XCTSkip("Could not resolve apps/ios/Wewed")
    }
}
