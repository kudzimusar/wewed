import Foundation

/// A Shadow/fixture qualification scenario. It has no production meaning and no production mapping.
/// The Charity & Kudzie reference wedding used throughout Shadow qualification.
public enum AuthorizedScenario: String, Sendable {
    case charityAndKudzie = "charity-and-kudzie"
}

/// Resolves the *environment-canonical* wedding identity for an authorized scenario.
///
/// Wewed has several identity spaces for the same real-world wedding:
///
///   FIXTURE                → the offline demo wedding (a different couple entirely)
///   SHADOW / SANITIZED     → `shadow_ref_charity_kudzie`
///   PRIVATE_REAL_SHADOW    → `cmqos70cb0004q6vxe9g9aiu5` (production-derived snapshot)
///   PRODUCTION*            → nothing. Deliberately.
///
/// Production and production-read-verify declare no wedding at all. A production app does not have
/// "the" wedding: which weddings an actor may open is a server answer about that actor (master plan
/// Phases 2 and 5), never a constant compiled into the binary. This table used to map both to one
/// real wedding id, which meant the first production connection would have opened that couple's
/// wedding for whoever asked (master plan §8.2).
///
/// A development persona therefore represents an **authorized scenario and actor**, not a wedding
/// id. Binding the runtime to an id from a different identity space is what previously produced a
/// context no repository could answer for.
///
/// Resolution deliberately requires two independent agreements: the directory declares what this
/// environment's canonical wedding should be, and the loaded repository must actually serve it.
public enum EnvironmentWeddingDirectory {

    /// Declared canonical wedding identity per environment.
    ///
    /// FIXTURE intentionally maps to its own offline demo wedding: the fixture environment does not
    /// contain the Charity & Kudzie graph at all, and pretending otherwise would be a fabrication.
    private static let declared: [AuthorizedScenario: [NativeDataEnvironment: String]] = [
        .charityAndKudzie: [
            .fixture: "wed_tariro_shadreck_2026",
            .shadow: "shadow_ref_charity_kudzie",
            .sanitizedShadow: "shadow_ref_charity_kudzie",
            .privateRealShadow: "cmqos70cb0004q6vxe9g9aiu5"
        ]
    ]

    /// What this environment's canonical wedding id for `scenario` is declared to be.
    public static func declaredWeddingId(
        scenario: AuthorizedScenario,
        environment: NativeDataEnvironment
    ) -> String? {
        declared[scenario]?[environment]
    }

    /// The canonical wedding id for this scenario in this environment, confirmed against the
    /// repository that is actually loaded. Returns nil when the environment is unmapped or the
    /// loaded source does not serve the declared identity.
    public static func resolveWeddingId(
        repository: WeddingRepositoryProtocol,
        scenario: AuthorizedScenario,
        environment: NativeDataEnvironment
    ) async -> String? {
        guard let expected = declaredWeddingId(scenario: scenario, environment: environment),
              let served = try? await repository.availableWeddingIds(),
              served.contains(expected) else { return nil }
        return expected
    }
}
