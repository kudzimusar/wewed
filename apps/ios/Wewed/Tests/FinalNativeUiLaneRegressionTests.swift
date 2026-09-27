import XCTest
@testable import WewedKit

/// QRO04-UI01 regression guards (D-084/D-085). Shadow is a qualification harness, never product
/// evidence: production_preview must resolve the real production runtime, never apply a persona or
/// offer persona switching, route an invitation-bound Guest to the final Live Guest shell, and the
/// workspace selector / context switcher must never show an internal identifier.
final class FinalNativeUiLaneRegressionTests: XCTestCase {
    private let previewEnv = [
        "WEWED_NATIVE_ENV": "production_preview",
        "WEWED_PREVIEW_ORIGIN": "https://wewed-abc123def-11-11.vercel.app",
    ]

    // MARK: production_preview is production, never Shadow

    func testProductionPreviewResolvesTheProductionEnvironment() {
        let launch = NativeLaunchConfiguration.resolve(environment: previewEnv, arguments: [], isDebugBuild: true)
        XCTAssertEqual(launch.environment, .production)
        XCTAssertTrue(launch.lane.isPreview)
    }

    func testProductionPreviewCannotApplyADevelopmentPersona() {
        let launch = NativeLaunchConfiguration.resolve(
            environment: previewEnv.merging(["wewed_native_persona": "attending_guest"]) { $1 },
            arguments: ["-wewed_native_persona", "attending_guest"],
            isDebugBuild: true
        )
        XCTAssertEqual(launch.environment, .production)
        XCTAssertFalse(launch.environment.allowsDevelopmentPersonaSwitching,
                       "a persona launch input must be ignored on production_preview")
    }

    func testProductionEnvironmentsNeverOfferPersonaSwitchingOrAShadowEntry() {
        for environment in [NativeDataEnvironment.production, .productionReadVerify] {
            XCTAssertFalse(environment.allowsDevelopmentPersonaSwitching, "\(environment)")
            XCTAssertFalse(environment.allowsMutableNativeDevelopment, "\(environment)")
        }
    }

    func testPersonaPickerAndShadowEntryAreGatedOnPersonaSwitching() throws {
        let main = try source("AppTarget/WewedMainApp.swift")
        XCTAssertTrue(main.contains("if launch.environment.allowsDevelopmentPersonaSwitching,\n           let requested = NativeLaunchConfiguration.requestedPersonaId()"))
        let root = try source("Views/RootView.swift")
        XCTAssertTrue(root.contains("if appState.dataEnvironment.allowsDevelopmentPersonaSwitching {"),
                      "the Switch Persona picker must only render where persona switching is allowed")
        let login = try source("Views/Auth/LoginView.swift")
        XCTAssertTrue(login.contains("if appState.dataEnvironment.allowsDevelopmentPersonaSwitching {"),
                      "the Shadow sign-in entry must only render where persona switching is allowed")
    }

    // MARK: invitation-bound production Guest → final Live Guest shell, never Shadow GuestShellView

    func testInvitationBoundProductionGuestDispatchesToTheLiveGuestShell() throws {
        let main = try source("AppTarget/WewedMainApp.swift")
        XCTAssertTrue(main.contains("case .guestOnly:"))
        XCTAssertTrue(main.contains("GuestOnlyInvitationShellView()"))
        let guestOnly = try source("Views/Invitation/GuestOnlyInvitationShellView.swift")
        XCTAssertTrue(guestOnly.contains("LiveGuestInvitationView("))
        XCTAssertTrue(guestOnly.contains("LiveGuestShellView("))
        XCTAssertNil(guestOnly.range(of: #"(?<!Live)GuestShellView\("#, options: .regularExpression),
                     "the final Guest-only shell must never host the Shadow GuestShellView")
        let root = try source("Views/RootView.swift")
        XCTAssertTrue(root.contains("} else if case let .presenting(snapshot) = liveInvitation {"))
        XCTAssertTrue(root.contains("LiveGuestInvitationView(\n                    presentation: LiveInvitationPresentation.from(snapshot)"))
    }

    func testPendingGuestCannotBypassRsvpAndCanLeaveRememberedWedding() throws {
        let invitation = try source("Views/Invitation/LiveGuestInvitationView.swift")
        XCTAssertTrue(invitation.contains("onContinue: presentation.attending == nil ? nil : onContinue"))
        XCTAssertTrue(invitation.contains("invitation-leave-wedding"))
        XCTAssertTrue(invitation.contains("presentation.attending == nil"))

        let shell = try source("Views/Invitation/GuestOnlyInvitationShellView.swift")
        XCTAssertTrue(shell.contains("GuestCapabilityPolicy.mayEnterPersistentExperience"))
        XCTAssertTrue(shell.contains("onLeaveWedding: forgetWedding"))
        XCTAssertTrue(shell.contains("onLeaveGuestMode?()"))

        let main = try source("AppTarget/WewedMainApp.swift")
        XCTAssertTrue(main.contains("restoreImmediately: !rememberedGuest"))
        XCTAssertTrue(main.contains("WEWED_GUEST_UI_CLEAR_SESSION"))
    }

    func testProductionReadOnlySurfaceDoesNotExposeRawPermissionKeysOrBlueFallbackLinks() throws {
        let readOnly = try source("Views/Roles/ProductionReadOnlyWorkspaceContent.swift")
        XCTAssertFalse(readOnly.contains("snapshot.permissions.joined"))
        XCTAssertTrue(readOnly.contains("authorized capabilities"))
        XCTAssertTrue(readOnly.contains(".buttonStyle(.plain)"))
        let login = try source("Views/Auth/LoginView.swift")
        XCTAssertTrue(login.contains("Color.clear"))
        XCTAssertTrue(login.contains("sign-in-root"))
        XCTAssertTrue(login.contains("sign-in-email"))
        XCTAssertTrue(login.contains("sign-in-password"))
        XCTAssertTrue(login.contains("sign-in-submit"))
    }

    // MARK: workspace selector / context switcher never show internal identifiers

    func testGrantTitlesPreferHumanNamesAndNeverFallBackToIdentifiers() throws {
        let portfolio = try grant(id: "planner-dea0757e-cc3d-42f6-a394-abf18e9cf742", kind: "planner", scope: "portfolio",
                                  business: "planner-dea0757e-cc3d-42f6-a394-abf18e9cf742")
        let unnamed = WorkspaceGrantPresentation(grant: portfolio)
        XCTAssertEqual(unnamed.title, "Planner Portfolio")
        XCTAssertEqual(unnamed.roleLabel, "Professional Planner")
        assertNoIdentifier(unnamed, portfolio)

        let named = WorkspaceGrantPresentation(grant: portfolio, businessNamesById: [portfolio.businessAccountId!: "Eleven Eleven Events"])
        XCTAssertEqual(named.title, "Eleven Eleven Events")

        let wedding = try grant(id: "planner:wedding:cmqos70cb0004q6vxe9g9aiu5", kind: "planner", scope: "wedding",
                                weddingId: "cmqos70cb0004q6vxe9g9aiu5", title: "Charity & Kudzie")
        XCTAssertEqual(WorkspaceGrantPresentation(grant: wedding).title, "Charity & Kudzie")

        let vendor = try grant(id: "vendor-7f0c2a4e-1111-4222-8333-944455556666", kind: "vendor", scope: "business",
                               vendor: "cm1vendor00000000000000000")
        XCTAssertEqual(WorkspaceGrantPresentation(grant: vendor).title, "Vendor Business")
        XCTAssertEqual(WorkspaceGrantPresentation(grant: vendor, vendorNamesById: ["cm1vendor00000000000000000": "FAUME MEDIA"]).title, "FAUME MEDIA")
        assertNoIdentifier(WorkspaceGrantPresentation(grant: vendor), vendor)

        let admin = try grant(id: "admin:system", kind: "admin", scope: "system")
        XCTAssertEqual(WorkspaceGrantPresentation(grant: admin).title, "Wewed Administration")

        // A "name" that is itself an identifier is refused, never displayed.
        let spoofed = WorkspaceGrantPresentation(grant: portfolio, businessNamesById: [portfolio.businessAccountId!: portfolio.grantId])
        XCTAssertEqual(spoofed.title, "Planner Portfolio")
    }

    func testSelectorAndSwitcherSourcesNeverRenderAGrantIdentifier() throws {
        for file in ["Views/GrantSelectionView.swift", "Views/ContextSwitcherSheet.swift"] {
            let text = try source(file)
            XCTAssertFalse(text.contains("?? grant.grantId"), file)
            XCTAssertFalse(text.contains("?? grant.businessAccountId"), file)
            XCTAssertNil(text.range(of: #"Text\([^)]*grant\.(grantId|businessAccountId|vendorId)"#, options: .regularExpression), file)
            XCTAssertTrue(text.contains("WorkspaceGrantPresentation"), file)
        }
    }


    func testReadOnlyWorkspaceShowsHumanRoleAndScopeNotWireValues() throws {
        let content = try source("Views/Roles/ProductionReadOnlyWorkspaceContent.swift")
        XCTAssertFalse(content.contains("snapshot.workspaceKind.capitalized) · \\(snapshot.scopeKind)"))
        XCTAssertTrue(content.contains("WorkspaceGrantPresentation.roleLabel(kind: GrantWorkspaceKind(wire: snapshot.workspaceKind)"))
        XCTAssertEqual(WorkspaceGrantPresentation.roleLabel(kind: .planner, scope: .portfolio), "Professional Planner")
        XCTAssertEqual(WorkspaceGrantPresentation.scopeLabel(.portfolio), "All weddings in your portfolio")
    }
    // MARK: helpers

    private func assertNoIdentifier(_ p: WorkspaceGrantPresentation, _ g: ProductionWorkspaceGrant, file: StaticString = #filePath, line: UInt = #line) {
        for visible in [p.title, p.roleLabel, p.scopeLabel] {
            for id in [g.grantId, g.businessAccountId, g.vendorId, g.weddingId].compactMap({ $0 }) {
                XCTAssertFalse(visible.contains(id), "\(visible) exposes \(id)", file: file, line: line)
            }
            XCTAssertFalse(WorkspaceGrantPresentation.looksLikeIdentifier(visible), visible, file: file, line: line)
        }
    }

    private func grant(id: String, kind: String, scope: String, weddingId: String? = nil, title: String? = nil,
                       business: String? = nil, vendor: String? = nil) throws -> ProductionWorkspaceGrant {
        func q(_ v: String?) -> String { v.map { "\"\($0)\"" } ?? "null" }
        let json = """
        {"grantId":"\(id)","workspaceKind":"\(kind)","scopeKind":"\(scope)","weddingId":\(q(weddingId)),"weddingTitle":\(q(title)),
         "coupleId":null,"businessAccountId":\(q(business)),"vendorId":\(q(vendor)),"serviceEngagementIds":[],"permissions":[],"platformRoles":[]}
        """
        return try JSONDecoder().decode(ProductionWorkspaceGrant.self, from: Data(json.utf8))
    }

    private func source(_ relative: String) throws -> String {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent(relative)
            if FileManager.default.fileExists(atPath: candidate.path) { return try String(contentsOf: candidate, encoding: .utf8) }
            dir = dir.deletingLastPathComponent()
        }
        throw NSError(domain: "FinalNativeUiLaneRegressionTests", code: 1, userInfo: [NSLocalizedDescriptionKey: relative])
    }
}
