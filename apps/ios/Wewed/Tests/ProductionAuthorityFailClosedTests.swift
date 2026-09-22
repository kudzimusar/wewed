import XCTest
@testable import WewedKit

/// Master plan Phase 1 — native state is honest and fails closed.
///
/// Enabling production connectivity later must not be able to expose a test wedding, a test
/// persona or a privileged fallback role. Each test here pins one of the ways it previously could.
/// The Android counterpart (`ProductionAuthorityFailClosedTest`) asserts the same rules.
final class ProductionAuthorityFailClosedTests: XCTestCase {

    private let productionEnvironments: [NativeDataEnvironment] = [.production, .productionReadVerify]

    // MARK: - AppRole never falls back (§8.1)

    /// Real server role strings from every authority axis. Most name no native workspace at all,
    /// and none may fall through to Couple — or to any other workspace — by default.
    func testServerRoleStringsWithNoNativeWorkspaceAreDenied() {
        let noWorkspace = [
            "owner", "viewer", "business_owner", "vendor_manager", "venue_manager", "couple_owner",
            "member", "billing_manager", "wewed_super_admin",
            "", "unknown", "COUPLE", " couple", "Planner"
        ]
        for role in noWorkspace {
            XCTAssertNil(AppRole.from(roleId: role), "'\(role)' must not open a workspace")
        }
    }

    func testViewerNeverBecomesCouple() {
        XCTAssertNotEqual(AppRole.from(roleId: "viewer"), .couple)
        XCTAssertNil(AppRole.from(roleId: "viewer"))
    }

    func testBusinessOwnerNeverBecomesCouple() {
        XCTAssertNotEqual(AppRole.from(roleId: "business_owner"), .couple)
        XCTAssertNil(AppRole.from(roleId: "business_owner"))
    }

    /// `planner`, `coordinator`, `admin` and `vendor` are server strings too, but a match here is
    /// only lexical: `from(roleId:)` parses native workspace ids and is not an authority mapper.
    /// `planner` alone exists on BusinessAccountMember AND WeddingMembership with different
    /// meanings, which is why the flat role cannot be the production contract (Rule 3, Phase 2).
    func testOnlyExactNativeWorkspaceIdsParse() {
        for role in AppRole.allCases { XCTAssertEqual(AppRole.from(roleId: role.roleId), role) }
    }

    // MARK: - The session starts empty, and Shadow personas stay in Shadow (§8.2, §8.8)

    func testProductionSessionStartsWithNoIdentityRoleOrWedding() {
        let session = SessionStore()
        XCTAssertFalse(session.isAuthenticated)
        XCTAssertNil(session.currentRole)
        XCTAssertNil(session.currentUserRole)
        XCTAssertNil(session.currentUserName)
        XCTAssertNil(session.activePersona)
        XCTAssertNil(session.weddingId)
        XCTAssertNil(session.weddingTitle)
        XCTAssertTrue(session.authorizedRoles.isEmpty)
    }

    func testADevelopmentSessionAlsoStartsEmptyUntilAPersonaIsChosen() {
        let session = SessionStore(environment: .sanitizedShadow)
        XCTAssertNil(session.currentRole)
        XCTAssertNil(session.weddingId)
        XCTAssertNil(session.currentUserName)
    }

    func testShadowPersonasCannotActivateInProduction() {
        for environment in productionEnvironments {
            let session = SessionStore(environment: environment)
            for persona in DevelopmentPersona.allPersonas {
                XCTAssertFalse(session.switchPersona(persona))
            }
            XCTAssertFalse(session.enterShadowSession())
            XCTAssertFalse(session.isAuthenticated)
            XCTAssertNil(session.currentRole)
            XCTAssertNil(session.weddingId)
            XCTAssertTrue(session.authorizedRoles.isEmpty)
        }
    }

    func testShadowPersonasStillWorkInDevelopmentEnvironments() {
        for environment in NativeDataEnvironment.allCases where environment.allowsDevelopmentPersonaSwitching {
            let session = SessionStore(environment: environment)
            let planner = DevelopmentPersona.allPersonas.first { $0.role == .planner }!
            XCTAssertTrue(session.switchPersona(planner))
            XCTAssertEqual(session.currentRole, .planner)
            XCTAssertEqual(session.authorizedRoles, [.planner])
            XCTAssertEqual(session.activePersona?.id, planner.id)
        }
    }

    func testEnteringShadowOpensTheExplicitDefaultPersonaNotASessionDefault() {
        let session = SessionStore(environment: .shadow)
        XCTAssertTrue(session.enterShadowSession())
        XCTAssertEqual(session.activePersona?.id, DevelopmentPersona.defaultShadowPersonaId)
        XCTAssertEqual(session.currentRole, DevelopmentPersona.defaultShadowPersona.role)
    }

    func testAStoredTokenGrantsNoRoleOnRestore() {
        let storage = InMemorySecureStorage()
        storage.save(key: "wewed_session_token", value: "token_from_an_earlier_launch")
        for environment in productionEnvironments + [.sanitizedShadow] {
            let session = SessionStore(storage: storage, environment: environment)
            XCTAssertTrue(session.sessionRestored)
            XCTAssertFalse(session.isAuthenticated)
            XCTAssertNil(session.currentRole)
            XCTAssertTrue(session.authorizedRoles.isEmpty)
        }
    }

    func testSignOutClearsEveryResolvedAnswer() {
        let session = SessionStore(environment: .sanitizedShadow)
        session.enterShadowSession()
        session.signOut()
        XCTAssertFalse(session.isAuthenticated)
        XCTAssertNil(session.currentRole)
        XCTAssertNil(session.activePersona)
        XCTAssertNil(session.weddingId)
        XCTAssertNil(session.weddingTitle)
        XCTAssertNil(session.currentUserName)
    }

    // MARK: - Production resolves no Shadow authority and no wedding (§8.2, §8.9)

    func testProductionSelectsNoAssignmentSource() {
        for environment in productionEnvironments {
            let source = ActorAssignmentSources.forEnvironment(
                environment, repository: ShadowReferenceWeddingRepository())
            XCTAssertTrue(source is EmptyActorAssignmentSource)
        }
    }

    func testDevelopmentEnvironmentsStillSelectShadowAuthority() async {
        let source = ActorAssignmentSources.forEnvironment(
            .sanitizedShadow,
            repository: ShadowReferenceWeddingRepository(),
            plannerRepository: ShadowReferencePlannerRepository()
        )
        XCTAssertTrue(source is ShadowActorAssignmentSource)
        let assignments = await source.assignments(actorId: DevelopmentPersona.defaultShadowPersonaId)
        XCTAssertEqual(assignments.first?.weddingId, "shadow_ref_charity_kudzie")
        XCTAssertEqual(assignments.count, 1)
    }

    /// Even constructed directly, the Shadow source yields nothing outside development.
    func testTheShadowSourceItselfRefusesProduction() async {
        for environment in productionEnvironments {
            let source = ShadowActorAssignmentSource(
                repository: ShadowReferenceWeddingRepository(), environment: environment)
            for persona in DevelopmentPersona.allPersonas {
                let assignments = await source.assignments(actorId: persona.id)
                XCTAssertTrue(assignments.isEmpty)
            }
        }
    }

    func testProductionHasNoHardcodedActiveWedding() {
        for environment in productionEnvironments {
            XCTAssertNil(EnvironmentWeddingDirectory.declaredWeddingId(
                scenario: .charityAndKudzie, environment: environment))
        }
    }

    // MARK: - A release binary is Production whatever it is launched with (§8.10)

    func testAReleaseBuildIgnoresEnvironmentLaunchInputs() {
        let requested = ["shadow", "sanitized_shadow", "private_real_shadow", "private", "fixture",
                         "production_read_verify", "production", "anything"]
        for raw in requested {
            let fromEnv = NativeLaunchConfiguration.resolve(
                environment: ["WEWED_NATIVE_ENV": raw, "WEWED_SHADOW_API_BASE_URL": "http://127.0.0.1:8787"],
                arguments: [],
                isDebugBuild: false
            )
            let fromArgs = NativeLaunchConfiguration.resolve(
                environment: [:],
                arguments: ["-wewed_native_env", raw],
                isDebugBuild: false
            )
            for config in [fromEnv, fromArgs] {
                XCTAssertEqual(config.environment, .production, "release + '\(raw)'")
                XCTAssertNil(config.baseURL)
                XCTAssertFalse(config.environment.allowsDevelopmentPersonaSwitching)
            }
        }
    }
}
