import XCTest

/// The welcome screen's Guest door must stay in the Guest identity domain.
///
/// A regression wired "I Have an Invitation" to `authMode = .signIn`, which contradicted the
/// invitation contract and sent an invited guest to account authentication. This source-level
/// contract pins the root wiring because the defect was in view composition, not LaunchRouter.
final class WelcomeInvitationEntryContractTests: XCTestCase {
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

    func testInvitationWelcomeDoorNeverRoutesToAccountSignIn() throws {
        let source = try Self.repoFile("apps/ios/Wewed/Views/RootView.swift")
        XCTAssertTrue(source.contains("onOpenInvitation: { showingInvitationHelp = true }"))
        XCTAssertFalse(source.contains("onOpenInvitation: { authMode = .signIn }"))
        XCTAssertTrue(source.contains("InvitationLinkEntryView(onBack:"))
    }
}
