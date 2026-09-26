package pro.wewed.app.navigation

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.DevelopmentPersona
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.ShadowReferencePlannerRepository
import pro.wewed.app.services.ShadowReferenceWeddingRepository
import pro.wewed.app.state.NativeLaunchConfiguration
import pro.wewed.app.state.SessionViewModel

/**
 * Master plan Phase 1 — native state is honest and fails closed.
 *
 * Enabling production connectivity later must not be able to expose a test wedding, a test persona
 * or a privileged fallback role. Each test here pins one of the ways it previously could.
 */
class ProductionAuthorityFailClosedTest {

    private val productionEnvironments =
        listOf(NativeDataEnvironment.PRODUCTION, NativeDataEnvironment.PRODUCTION_READ_VERIFY)

    // -------------------------------------------------------------------------------------------
    // AppRole never falls back (§8.1)
    // -------------------------------------------------------------------------------------------

    /**
     * Real server role strings from every authority axis. Most name no native workspace at all, and
     * none may fall through to Couple — or to any other workspace — by default.
     */
    @Test
    fun serverRoleStringsWithNoNativeWorkspaceAreDenied() {
        val noWorkspace = listOf(
            "owner", // WeddingMembership
            "viewer", // WeddingMembership, BusinessAccountMember, User default
            "business_owner", // BusinessAccountMember
            "vendor_manager", // BusinessAccountMember
            "venue_manager", // BusinessAccountMember
            "couple_owner", // BusinessAccountMember
            "member", // BusinessAccountMember default
            "billing_manager", // BusinessAccountMember
            "wewed_super_admin", // Wewed internal
            "", "unknown", "COUPLE", " couple", "Planner"
        )
        noWorkspace.forEach { assertNull("'$it' must not open a workspace", AppRole.fromId(it)) }
    }

    @Test
    fun viewerNeverBecomesCouple() {
        assertFalse(AppRole.fromId("viewer") == AppRole.COUPLE)
        assertNull(AppRole.fromId("viewer"))
    }

    @Test
    fun businessOwnerNeverBecomesCouple() {
        assertFalse(AppRole.fromId("business_owner") == AppRole.COUPLE)
        assertNull(AppRole.fromId("business_owner"))
    }

    /**
     * `planner`, `coordinator`, `admin` and `vendor` are server strings too, but a match here is
     * only lexical: `fromId` parses native workspace ids and is not an authority mapper. `planner`
     * alone exists on BusinessAccountMember AND WeddingMembership with different meanings, which is
     * why the flat role cannot be the production contract (master plan Rule 3, Phase 2).
     */
    @Test
    fun onlyExactNativeWorkspaceIdsParse() {
        AppRole.entries.forEach { assertEquals(it, AppRole.fromId(it.roleId)) }
        assertEquals(7, AppRole.entries.count { AppRole.fromId(it.roleId) != null })
    }

    // -------------------------------------------------------------------------------------------
    // The session starts empty, and Shadow personas stay in Shadow (§8.2, §8.8)
    // -------------------------------------------------------------------------------------------

    @Test
    fun productionSessionStartsWithNoIdentityRoleOrWedding() {
        val session = SessionViewModel()
        assertFalse(session.isAuthenticated.value)
        assertNull(session.currentRole.value)
        assertNull(session.currentUserRole.value)
        assertNull(session.currentUserName.value)
        assertNull(session.activePersonaId.value)
        assertNull(session.weddingId.value)
        assertNull(session.weddingTitle.value)
        assertTrue(session.authorizedRoles.value.isEmpty())
    }

    @Test
    fun aDevelopmentSessionAlsoStartsEmptyUntilAPersonaIsChosen() {
        val session = SessionViewModel(environment = NativeDataEnvironment.SANITIZED_SHADOW)
        assertNull(session.currentRole.value)
        assertNull(session.weddingId.value)
        assertNull(session.currentUserName.value)
    }

    @Test
    fun shadowPersonasCannotActivateInProduction() {
        productionEnvironments.forEach { environment ->
            val session = SessionViewModel(environment = environment)
            DevelopmentPersona.allPersonas.forEach { persona ->
                assertFalse(session.switchPersona(persona))
            }
            assertFalse(session.enterShadowSession())
            assertFalse(session.isAuthenticated.value)
            assertNull(session.currentRole.value)
            assertNull(session.weddingId.value)
            assertTrue(session.authorizedRoles.value.isEmpty())
        }
    }

    @Test
    fun shadowPersonasStillWorkInDevelopmentEnvironments() {
        NativeDataEnvironment.entries.filter { it.allowsDevelopmentPersonaSwitching }.forEach { env ->
            val session = SessionViewModel(environment = env)
            val planner = DevelopmentPersona.allPersonas.first { it.role == AppRole.PLANNER }
            assertTrue(session.switchPersona(planner))
            assertEquals(AppRole.PLANNER, session.currentRole.value)
            assertEquals(listOf(AppRole.PLANNER), session.authorizedRoles.value)
            assertEquals(planner.id, session.activePersonaId.value)
        }
    }

    @Test
    fun enteringShadowOpensTheExplicitDefaultPersonaNotASessionDefault() {
        val session = SessionViewModel(environment = NativeDataEnvironment.SHADOW)
        assertTrue(session.enterShadowSession())
        assertEquals(DevelopmentPersona.DEFAULT_SHADOW_PERSONA_ID, session.activePersonaId.value)
        assertEquals(DevelopmentPersona.defaultShadowPersona.role, session.currentRole.value)
    }

    @Test
    fun aStoredTokenGrantsNoRoleOnRestore() {
        val storage = pro.wewed.app.services.InMemorySecureStorage()
        storage.save("wewed_session_token", "token_from_an_earlier_launch")
        productionEnvironments.plus(NativeDataEnvironment.SANITIZED_SHADOW).forEach { env ->
            val session = SessionViewModel(storage, env)
            assertTrue(session.sessionRestored.value)
            assertFalse(session.isAuthenticated.value)
            assertNull(session.currentRole.value)
            assertTrue(session.authorizedRoles.value.isEmpty())
        }
    }

    @Test
    fun signOutClearsEveryResolvedAnswer() {
        val session = SessionViewModel(environment = NativeDataEnvironment.SANITIZED_SHADOW)
        session.enterShadowSession()
        session.signOut()
        assertFalse(session.isAuthenticated.value)
        assertNull(session.currentRole.value)
        assertNull(session.activePersonaId.value)
        assertNull(session.weddingId.value)
        assertNull(session.weddingTitle.value)
        assertNull(session.currentUserName.value)
    }

    // -------------------------------------------------------------------------------------------
    // Production resolves no Shadow authority and no wedding (§8.2, §8.9)
    // -------------------------------------------------------------------------------------------

    /**
     * Master plan Phase 8 closure round 5 — `ActorAssignmentSources.empty()` takes no repository
     * parameter at all, so this proves "no authority yet" is resolved without ever needing, reading
     * or constructing a repository of any kind (not even a Shadow/Fixture one).
     */
    @Test
    fun productionSelectsNoAssignmentSource() {
        productionEnvironments.forEach { _ ->
            assertSame(EmptyActorAssignmentSource, ActorAssignmentSources.empty())
        }
    }

    @Test
    fun developmentEnvironmentsStillSelectShadowAuthority() {
        val source = ActorAssignmentSources.forShadow(
            ShadowReferenceWeddingRepository(),
            ShadowReferencePlannerRepository(),
            NativeDataEnvironment.SANITIZED_SHADOW
        )
        assertTrue(source is ShadowActorAssignmentSource)
        val assignments = runBlocking { source.assignments(DevelopmentPersona.DEFAULT_SHADOW_PERSONA_ID) }
        assertEquals("shadow_ref_charity_kudzie", assignments.single().weddingId)
    }

    /** Even constructed directly, the Shadow source yields nothing outside development. */
    @Test
    fun theShadowSourceItselfRefusesProduction() = runBlocking {
        productionEnvironments.forEach { env ->
            val source = ShadowActorAssignmentSource(ShadowReferenceWeddingRepository(), env)
            DevelopmentPersona.allPersonas.forEach { persona ->
                assertTrue(source.assignments(persona.id).isEmpty())
            }
        }
    }

    @Test
    fun productionHasNoHardcodedActiveWedding() {
        AuthorizedScenario.entries.forEach { scenario ->
            productionEnvironments.forEach { env ->
                assertNull(EnvironmentWeddingDirectory.declaredWeddingId(scenario, env))
            }
        }
    }

    // -------------------------------------------------------------------------------------------
    // A release binary is Production whatever it is launched with (§8.10)
    // -------------------------------------------------------------------------------------------

    @Test
    fun aReleaseBuildIgnoresEnvironmentLaunchInputs() {
        listOf(
            "shadow", "sanitized_shadow", "private_real_shadow", "private", "fixture",
            "production_read_verify", "production", null, "anything"
        ).forEach { raw ->
            val config = NativeLaunchConfiguration.resolve(
                rawEnvironment = raw,
                shadowBaseUrl = "http://127.0.0.1:8787",
                isDebugBuild = false
            )
            assertEquals("release + '$raw'", NativeDataEnvironment.PRODUCTION, config.environment)
            assertNull(config.baseUrl)
            assertFalse(config.environment.allowsDevelopmentPersonaSwitching)
        }
    }
}
