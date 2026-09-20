import XCTest
@testable import WewedKit

/// The same real-world wedding has a different canonical identity in each environment.
///
/// These tests exist because a development persona must represent an authorized *scenario*, not an
/// id: binding the runtime to an id from another identity space produced a context that no loaded
/// repository could answer for. Mirrors the Android suite.
final class EnvironmentWeddingDirectoryTests: XCTestCase {

    private let scenario = AuthorizedScenario.charityAndKudzie

    func testEachEnvironmentDeclaresItsOwnCanonicalWeddingIdentity() {
        XCTAssertEqual(
            EnvironmentWeddingDirectory.declaredWeddingId(scenario: scenario, environment: .fixture),
            "wed_tariro_shadreck_2026"
        )
        XCTAssertEqual(
            EnvironmentWeddingDirectory.declaredWeddingId(scenario: scenario, environment: .sanitizedShadow),
            "shadow_ref_charity_kudzie"
        )
        XCTAssertEqual(
            EnvironmentWeddingDirectory.declaredWeddingId(scenario: scenario, environment: .shadow),
            "shadow_ref_charity_kudzie"
        )
        // Confirmed against the protected snapshot's own wedding.id.
        XCTAssertEqual(
            EnvironmentWeddingDirectory.declaredWeddingId(scenario: scenario, environment: .privateRealShadow),
            "cmqos70cb0004q6vxe9g9aiu5"
        )
        XCTAssertEqual(
            EnvironmentWeddingDirectory.declaredWeddingId(scenario: scenario, environment: .production),
            "cmqos70cb0004q6vxe9g9aiu5"
        )
    }

    func testSanitizedAndPrivateRealIdentitiesAreNeverInterchangeable() {
        let sanitized = EnvironmentWeddingDirectory.declaredWeddingId(scenario: scenario, environment: .sanitizedShadow)
        let privateReal = EnvironmentWeddingDirectory.declaredWeddingId(scenario: scenario, environment: .privateRealShadow)
        XCTAssertNotEqual(sanitized, privateReal)
    }

    func testResolutionRequiresLoadedRepositoryToServeDeclaredIdentity() async {
        let sanitized = await EnvironmentWeddingDirectory.resolveWeddingId(
            repository: ShadowReferenceWeddingRepository(),
            scenario: scenario,
            environment: .sanitizedShadow
        )
        XCTAssertEqual(sanitized, "shadow_ref_charity_kudzie")

        // The same source cannot satisfy PRIVATE_REAL_SHADOW: the declared production-derived id
        // is not one it serves, so nothing is resolved rather than substituting its own wedding.
        let mismatched = await EnvironmentWeddingDirectory.resolveWeddingId(
            repository: ShadowReferenceWeddingRepository(),
            scenario: scenario,
            environment: .privateRealShadow
        )
        XCTAssertNil(mismatched, "A misprovisioned environment must not fall back to another identity space")
    }

    func testFixtureResolvesToOfflineDemoWedding() async {
        let resolved = await EnvironmentWeddingDirectory.resolveWeddingId(
            repository: FixtureWeddingRepository(),
            scenario: scenario,
            environment: .fixture
        )
        XCTAssertEqual(resolved, "wed_tariro_shadreck_2026")
        XCTAssertNotEqual(resolved, "cmqos70cb0004q6vxe9g9aiu5")
    }

    func testAssignmentsRefusedWhenEnvironmentIsMisprovisioned() async {
        let source = ShadowActorAssignmentSource(
            repository: ShadowReferenceWeddingRepository(),
            environment: .privateRealShadow
        )
        let result = await source.assignments(actorId: "couple_owner")
        XCTAssertTrue(result.isEmpty, "No assignment may be issued when declared and served identities disagree")
    }

    func testPersonaIdIsNeverUsedAsActiveWeddingId() async throws {
        // The persona carries the production id; under SANITIZED_SHADOW the context must bind to
        // the sanitized identity instead.
        let source = ShadowActorAssignmentSource(
            repository: ShadowReferenceWeddingRepository(),
            environment: .sanitizedShadow
        )
        let assignments = await source.assignments(actorId: "couple_owner")
        let assignment = try XCTUnwrap(assignments.first)
        XCTAssertEqual(assignment.weddingId, "shadow_ref_charity_kudzie")
        XCTAssertNotEqual(assignment.weddingId, "cmqos70cb0004q6vxe9g9aiu5")
    }

    func testFixtureEnvironmentIssuesAssignmentsAgainstFixtureWedding() async throws {
        let source = ShadowActorAssignmentSource(
            repository: FixtureWeddingRepository(),
            environment: .fixture
        )
        let assignments = await source.assignments(actorId: "couple_owner")
        let assignment = try XCTUnwrap(assignments.first)
        XCTAssertEqual(assignment.weddingId, "wed_tariro_shadreck_2026")
    }
}
