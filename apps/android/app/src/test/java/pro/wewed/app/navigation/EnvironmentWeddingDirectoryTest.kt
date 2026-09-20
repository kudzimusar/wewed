package pro.wewed.app.navigation

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.FixtureWeddingRepository
import pro.wewed.app.services.ShadowReferenceWeddingRepository

/**
 * The same real-world wedding has a different canonical identity in each environment.
 *
 * These tests exist because a development persona must represent an authorized *scenario*, not an
 * id: binding the runtime to an id from another identity space produced a context that no loaded
 * repository could answer for.
 */
class EnvironmentWeddingDirectoryTest {

    private val scenario = AuthorizedScenario.CHARITY_AND_KUDZIE

    @Test
    fun `each environment declares its own canonical wedding identity`() {
        assertEquals(
            "wed_tariro_shadreck_2026",
            EnvironmentWeddingDirectory.declaredWeddingId(scenario, NativeDataEnvironment.FIXTURE)
        )
        assertEquals(
            "shadow_ref_charity_kudzie",
            EnvironmentWeddingDirectory.declaredWeddingId(scenario, NativeDataEnvironment.SANITIZED_SHADOW)
        )
        assertEquals(
            "shadow_ref_charity_kudzie",
            EnvironmentWeddingDirectory.declaredWeddingId(scenario, NativeDataEnvironment.SHADOW)
        )
        // Confirmed against the protected snapshot's own wedding.id.
        assertEquals(
            "cmqos70cb0004q6vxe9g9aiu5",
            EnvironmentWeddingDirectory.declaredWeddingId(scenario, NativeDataEnvironment.PRIVATE_REAL_SHADOW)
        )
        assertEquals(
            "cmqos70cb0004q6vxe9g9aiu5",
            EnvironmentWeddingDirectory.declaredWeddingId(scenario, NativeDataEnvironment.PRODUCTION)
        )
    }

    @Test
    fun `sanitized and private-real identities are never interchangeable`() {
        val sanitized = EnvironmentWeddingDirectory.declaredWeddingId(scenario, NativeDataEnvironment.SANITIZED_SHADOW)
        val privateReal = EnvironmentWeddingDirectory.declaredWeddingId(scenario, NativeDataEnvironment.PRIVATE_REAL_SHADOW)
        assertNotEquals(
            "Sanitized Shadow must not share the production-derived wedding identity",
            sanitized,
            privateReal
        )
    }

    @Test
    fun `resolution requires the loaded repository to serve the declared identity`() = runBlocking {
        // The sanitized source serves shadow_ref_charity_kudzie, so SANITIZED_SHADOW resolves.
        val sanitized = EnvironmentWeddingDirectory.resolveWeddingId(
            ShadowReferenceWeddingRepository(),
            scenario,
            NativeDataEnvironment.SANITIZED_SHADOW
        )
        assertEquals("shadow_ref_charity_kudzie", sanitized)

        // The same source cannot satisfy PRIVATE_REAL_SHADOW: the declared production-derived id
        // is not one it serves, so nothing is resolved rather than substituting its own wedding.
        val mismatched = EnvironmentWeddingDirectory.resolveWeddingId(
            ShadowReferenceWeddingRepository(),
            scenario,
            NativeDataEnvironment.PRIVATE_REAL_SHADOW
        )
        assertNull("A misprovisioned environment must not fall back to another identity space", mismatched)
    }

    @Test
    fun `fixture resolves to the offline demo wedding, not the Charity and Kudzie identity`() = runBlocking {
        val resolved = EnvironmentWeddingDirectory.resolveWeddingId(
            FixtureWeddingRepository(),
            scenario,
            NativeDataEnvironment.FIXTURE
        )
        assertEquals("wed_tariro_shadreck_2026", resolved)
        assertNotEquals("cmqos70cb0004q6vxe9g9aiu5", resolved)
    }

    @Test
    fun `assignments are refused when the environment is misprovisioned`() = runBlocking {
        // Sanitized repository declared as PRIVATE_REAL_SHADOW: identity spaces disagree.
        val source = ShadowActorAssignmentSource(
            ShadowReferenceWeddingRepository(),
            NativeDataEnvironment.PRIVATE_REAL_SHADOW
        )
        assertTrue(
            "No assignment may be issued when the declared and served identities disagree",
            source.assignments("couple_owner").isEmpty()
        )
    }

    @Test
    fun `the persona id is never used as the active wedding id`() = runBlocking {
        // The persona carries the production id; under SANITIZED_SHADOW the context must bind to
        // the sanitized identity instead.
        val source = ShadowActorAssignmentSource(
            ShadowReferenceWeddingRepository(),
            NativeDataEnvironment.SANITIZED_SHADOW
        )
        val assignment = source.assignments("couple_owner").first()
        assertEquals("shadow_ref_charity_kudzie", assignment.weddingId)
        assertNotEquals("cmqos70cb0004q6vxe9g9aiu5", assignment.weddingId)
    }

    @Test
    fun `fixture environment issues assignments against the fixture wedding`() = runBlocking {
        val source = ShadowActorAssignmentSource(
            FixtureWeddingRepository(),
            NativeDataEnvironment.FIXTURE
        )
        val assignment = source.assignments("couple_owner").first()
        assertEquals("wed_tariro_shadreck_2026", assignment.weddingId)
    }
}
