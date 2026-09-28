import XCTest
@testable import WewedKit

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure round 5.
///
/// A moderator inspecting the actual Round-4 remote code found that `RootView.resolveContext()`
/// called `ActorAssignmentSources.forEnvironment(_:repository:...)` with
/// `(try? appState.repository) ?? FixtureWeddingRepository()` — an invalid production fallback that
/// existed only because that API still demanded a repository parameter PRODUCTION never needed.
///
/// These tests exercise `resolveActorAssignmentSource` — the exact pure function
/// `RootView.resolveContext()` now delegates to — directly, with no SwiftUI test infrastructure
/// required, so a future change cannot reintroduce a Fixture/Shadow fallback (or an unbound
/// production repository read) without this file failing. The Android counterpart is
/// `RootAssignmentBootstrapTest`.
final class RootAssignmentBootstrapTests: XCTestCase {

    private func authority(
        accountStatus: String = "authorized",
        accessUserId: String = "user-1",
        grants: String,
        contextSelection: String = "[]"
    ) throws -> ProductionAuthority {
        let json = """
        {
          "contract": "WewedProductionAuthorityV1",
          "version": 1,
          "accountStatus": "\(accountStatus)",
          "identity": {"accessUserId": "\(accessUserId)", "dashboardClass": "planner"},
          "workspaceGrants": \(grants),
          "contextSelection": \(contextSelection),
          "unsupported": [],
          "platform": {"effectiveRole": null}
        }
        """
        return try XCTUnwrap(ProductionAuthority.decode(Data(json.utf8)))
    }

    private func grant(
        _ grantId: String,
        workspaceKind: String,
        scopeKind: String,
        weddingId: String? = nil,
        businessAccountId: String? = nil,
        vendorId: String? = nil,
        serviceEngagementIds: [String] = []
    ) -> String {
        let weddingValue = weddingId.map { "\"\($0)\"" } ?? "null"
        let businessValue = businessAccountId.map { "\"\($0)\"" } ?? "null"
        let vendorValue = vendorId.map { "\"\($0)\"" } ?? "null"
        let engagementValues = serviceEngagementIds.map { "\"\($0)\"" }.joined(separator: ",")
        return """
        {
          "grantId": "\(grantId)",
          "workspaceKind": "\(workspaceKind)",
          "scopeKind": "\(scopeKind)",
          "weddingId": \(weddingValue),
          "weddingTitle": null,
          "coupleId": null,
          "businessAccountId": \(businessValue),
          "vendorId": \(vendorValue),
          "serviceEngagementIds": [\(engagementValues)],
          "permissions": [],
          "platformRoles": []
        }
        """
    }

    private func unboundProductionAppState() -> AppState {
        AppState(dataEnvironment: .production, dataBaseURL: URL(string: "https://example.test"))
    }

    /// The exact defect: an unbound PRODUCTION `AppState` with a valid, freshly-resolved authority
    /// must yield a real `ProductionActorAssignmentSource` without ever throwing
    /// `ProductionRepositoryUnbound` — and without constructing or requiring any Fixture/Shadow
    /// repository. `ActorAssignmentSources.forProduction` has no repository parameter at all, so
    /// this is a structural guarantee, not merely a runtime one; letting the call throw (rather than
    /// catching it) is deliberate — a regression here must fail this test loudly.
    func testProductionUnboundWithValidAuthorityBuildsProductionSourceWithoutTouchingAnyRepository() async throws {
        let appState = unboundProductionAppState()
        let authority = try authority(grants: "[\(grant("couple:wedding:A", workspaceKind: "couple", scopeKind: "wedding", weddingId: "A"))]")

        let source = resolveActorAssignmentSource(
            appState: appState, productionAuthority: authority, selectedGrantIds: [], selectedEngagementId: nil
        )

        XCTAssertTrue(source is ProductionActorAssignmentSource, "Expected a real ProductionActorAssignmentSource")
        let assignments = await source.assignments(actorId: "user-1")
        XCTAssertEqual(assignments, [ActorAssignment(actorId: "user-1", role: .couple, weddingId: "A")])

        // Confirm the precondition this test is actually pinning: appState really is unbound, and
        // reading the mature repository directly really does throw. resolveActorAssignmentSource
        // above must never have done that read.
        XCTAssertThrowsError(try appState.repository) { error in
            XCTAssertTrue(error is ProductionRepositoryUnbound)
        }
    }

    /// No identity session yet / no successful authority fetch yet — Empty, no repository access.
    func testProductionUnboundWithNoAuthorityYieldsEmptySourceWithoutTouchingAnyRepository() {
        let appState = unboundProductionAppState()

        let source = resolveActorAssignmentSource(
            appState: appState, productionAuthority: nil, selectedGrantIds: [], selectedEngagementId: nil
        )

        XCTAssertTrue(source is EmptyActorAssignmentSource)
    }

    /// Shadow/dev-persona environments are completely unchanged: a real repository is still required.
    func testShadowStillRequiresARealRepositoryAndBehavesExactlyAsBefore() async {
        let appState = AppState(
            repository: ShadowReferenceWeddingRepository(),
            plannerRepository: ShadowReferencePlannerRepository(),
            dataEnvironment: .sanitizedShadow
        )

        let source = resolveActorAssignmentSource(
            appState: appState, productionAuthority: nil, selectedGrantIds: [], selectedEngagementId: nil
        )

        XCTAssertTrue(source is ShadowActorAssignmentSource)
        let assignments = await source.assignments(actorId: DevelopmentPersona.defaultShadowPersonaId)
        XCTAssertEqual(assignments.first?.weddingId, "shadow_ref_charity_kudzie")
    }

    /// `clearProductionBinding()` must not make assignment resolution itself unsafe — it is still
    /// driven entirely by the (now stale) authority the caller passes, not by the binding — while
    /// the mature repository domains remain correctly unreachable until a fresh bind occurs.
    func testProductionAfterClearBindingResolvesAssignmentsSafelyWhileRepositoryStillThrows() async throws {
        let appState = unboundProductionAppState()
        let authority = try authority(grants: "[\(grant("couple:wedding:A", workspaceKind: "couple", scopeKind: "wedding", weddingId: "A"))]")

        appState.clearProductionBinding()

        let source = resolveActorAssignmentSource(
            appState: appState, productionAuthority: authority, selectedGrantIds: [], selectedEngagementId: nil
        )
        XCTAssertTrue(source is ProductionActorAssignmentSource)
        let assignments = await source.assignments(actorId: "user-1")
        XCTAssertEqual(assignments, [ActorAssignment(actorId: "user-1", role: .couple, weddingId: "A")])

        XCTAssertThrowsError(try appState.repository) { error in
            XCTAssertTrue(error is ProductionRepositoryUnbound)
        }
    }

    /// Account A's authority is resolved once (unbound), then Account B's completely different
    /// authority is resolved on the SAME `AppState` instance (the ordinary account-replacement
    /// sequence before any bind has occurred for either). `resolveActorAssignmentSource` never reads
    /// `appState.repository` for PRODUCTION at all, so there is no repository object through which
    /// A's identity could bleed into B's resolution — and the assignments returned must be exactly
    /// B's, never A's.
    func testAccountAToAccountBNeverConsultsAnyRepositoryAndNeverMixesAssignments() async throws {
        let appState = unboundProductionAppState()
        let authorityA = try authority(
            accessUserId: "user-a",
            grants: "[\(grant("couple:wedding:A", workspaceKind: "couple", scopeKind: "wedding", weddingId: "A"))]"
        )
        let authorityB = try authority(
            accessUserId: "user-b",
            grants: "[\(grant("planner:wedding:B", workspaceKind: "planner", scopeKind: "wedding", weddingId: "B"))]"
        )

        let sourceA = resolveActorAssignmentSource(
            appState: appState, productionAuthority: authorityA, selectedGrantIds: [], selectedEngagementId: nil
        )
        let assignmentsA = await sourceA.assignments(actorId: "user-a")
        XCTAssertEqual(assignmentsA, [ActorAssignment(actorId: "user-a", role: .couple, weddingId: "A")])
        let crossA = await sourceA.assignments(actorId: "user-b")
        XCTAssertTrue(crossA.isEmpty)

        let sourceB = resolveActorAssignmentSource(
            appState: appState, productionAuthority: authorityB, selectedGrantIds: [], selectedEngagementId: nil
        )
        let assignmentsB = await sourceB.assignments(actorId: "user-b")
        XCTAssertEqual(assignmentsB, [ActorAssignment(actorId: "user-b", role: .planner, weddingId: "B")])
        let crossB = await sourceB.assignments(actorId: "user-a")
        XCTAssertTrue(crossB.isEmpty)
    }

    /// Master plan Phase 8 closure round 4 §2 — `selectedEngagementId` must keep flowing all the way
    /// through `resolveActorAssignmentSource` → `ActorAssignmentSources.forProduction` →
    /// `ProductionActorAssignmentSource`, exactly as it did before this round's refactor split
    /// `forEnvironment` into `forShadow`/`forProduction`/`empty`.
    func testVendorSameGrantEngagementSelectionFlowsThroughResolveActorAssignmentSource() async throws {
        let appState = unboundProductionAppState()
        let vendorGrant = grant(
            "vendor:wedding:biz-1:vendor-1",
            workspaceKind: "vendor",
            scopeKind: "wedding",
            weddingId: "E",
            businessAccountId: "biz-1",
            vendorId: "vendor-1",
            serviceEngagementIds: ["eng-1", "eng-2"]
        )
        let authority = try authority(grants: "[\(vendorGrant)]")

        let sourceA = resolveActorAssignmentSource(
            appState: appState, productionAuthority: authority, selectedGrantIds: [], selectedEngagementId: "eng-1"
        )
        let assignmentsA = await sourceA.assignments(actorId: "user-1")
        XCTAssertEqual(
            assignmentsA,
            [ActorAssignment(actorId: "user-1", role: .vendor, weddingId: "E", vendorId: "vendor-1", engagementId: "eng-1")]
        )

        let sourceB = resolveActorAssignmentSource(
            appState: appState, productionAuthority: authority, selectedGrantIds: [], selectedEngagementId: "eng-2"
        )
        let assignmentsB = await sourceB.assignments(actorId: "user-1")
        XCTAssertEqual(
            assignmentsB,
            [ActorAssignment(actorId: "user-1", role: .vendor, weddingId: "E", vendorId: "vendor-1", engagementId: "eng-2")]
        )
    }
}
