package pro.wewed.app.navigation

import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.WeddingRepository

/**
 * Resolves the *environment-canonical* wedding identity for an authorized scenario.
 *
 * Wewed has several identity spaces for the same real-world wedding:
 *
 *   FIXTURE                → the offline demo wedding (a different couple entirely)
 *   SHADOW / SANITIZED     → `shadow_ref_charity_kudzie`
 *   PRIVATE_REAL_SHADOW    → `cmqos70cb0004q6vxe9g9aiu5` (production-derived snapshot)
 *   PRODUCTION*            → nothing. Deliberately.
 *
 * Production and production-read-verify declare no wedding at all. A production app does not have
 * "the" wedding: which weddings an actor may open is a server answer about that actor (master plan
 * Phases 2 and 5), never a constant compiled into the binary. This table used to map both to one
 * real wedding id, which meant the first production connection would have opened that couple's
 * wedding for whoever asked (master plan §8.2).
 *
 * A development persona therefore represents an **authorized scenario and actor**, not a wedding
 * id. Binding the runtime to an id from a different identity space is what previously produced a
 * context no repository could answer for.
 *
 * Resolution deliberately requires two independent agreements:
 *   1. the directory *declares* what this environment's canonical wedding should be, and
 *   2. the loaded repository must actually serve that id.
 * If they disagree the environment is misprovisioned, and no wedding is resolved — rather than
 * silently adopting whatever the repository happens to hold.
 */
/** A Shadow/fixture qualification scenario. It has no production meaning and no production mapping. */
enum class AuthorizedScenario(val key: String) {
    /** The Charity & Kudzie reference wedding used throughout Shadow qualification. */
    CHARITY_AND_KUDZIE("charity-and-kudzie")
}

object EnvironmentWeddingDirectory {

    /**
     * Declared canonical wedding identity per environment.
     *
     * FIXTURE intentionally maps to its own offline demo wedding: the fixture environment does not
     * contain the Charity & Kudzie graph at all, and pretending otherwise would be a fabrication.
     */
    private val declared: Map<AuthorizedScenario, Map<NativeDataEnvironment, String>> = mapOf(
        AuthorizedScenario.CHARITY_AND_KUDZIE to mapOf(
            NativeDataEnvironment.FIXTURE to "wed_tariro_shadreck_2026",
            NativeDataEnvironment.SHADOW to "shadow_ref_charity_kudzie",
            NativeDataEnvironment.SANITIZED_SHADOW to "shadow_ref_charity_kudzie",
            NativeDataEnvironment.PRIVATE_REAL_SHADOW to "cmqos70cb0004q6vxe9g9aiu5"
        )
    )

    /** What this environment's canonical wedding id for [scenario] is declared to be. */
    fun declaredWeddingId(
        scenario: AuthorizedScenario,
        environment: NativeDataEnvironment
    ): String? = declared[scenario]?.get(environment)

    /**
     * The canonical wedding id for this scenario in this environment, confirmed against the
     * repository that is actually loaded. Returns null when the environment is unmapped or the
     * loaded source does not serve the declared identity.
     */
    suspend fun resolveWeddingId(
        repository: WeddingRepository,
        scenario: AuthorizedScenario,
        environment: NativeDataEnvironment
    ): String? {
        val expected = declaredWeddingId(scenario, environment) ?: return null
        val served = runCatching { repository.availableWeddingIds() }.getOrNull() ?: return null
        return expected.takeIf { served.contains(it) }
    }
}
