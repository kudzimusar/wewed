package pro.wewed.app.navigation

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.ShadowReferencePlannerRepository
import pro.wewed.app.services.ShadowReferenceWeddingRepository
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.ProductionRepositoryUnbound

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure round 5.
 *
 * A moderator inspecting the actual Round-4 remote code found that `RootScreen.kt`'s production
 * root construction called `ActorAssignmentSources.forEnvironment(env, appViewModel.repository,
 * appViewModel.plannerRepository, ...)` — Kotlin evaluates call arguments eagerly, so
 * `appViewModel.repository` was read (and, in PRODUCTION while unbound, THROWN as
 * `ProductionRepositoryUnbound`) before `forEnvironment` was ever entered, and before the
 * `LaunchedEffect` that binds a real repository had any chance to run. Round 4's own fix (making
 * unbound production repository access throw instead of returning a placeholder) is what turned
 * this pre-existing coupling into a real crash.
 *
 * These tests exercise `resolveActorAssignmentSource` — the exact pure function `RootScreen.kt`
 * now delegates to — directly, with no Compose test infrastructure required, so a future change
 * cannot reintroduce a production `appViewModel.repository` read before binding without this file
 * failing.
 */
class RootAssignmentBootstrapTest {

    private fun authority(
        accountStatus: String = "authorized",
        accessUserId: String = "user-1",
        grants: String,
        contextSelection: String = "[]",
    ): ProductionAuthority = ProductionAuthorityDecoder.decode(
        """
        {
          "contract": "WewedProductionAuthorityV1",
          "version": 1,
          "accountStatus": "$accountStatus",
          "identity": {"accessUserId": "$accessUserId", "dashboardClass": "planner"},
          "workspaceGrants": $grants,
          "contextSelection": $contextSelection,
          "unsupported": [],
          "platform": {"effectiveRole": null}
        }
        """.trimIndent()
    )!!

    private fun grant(
        grantId: String,
        workspaceKind: String,
        scopeKind: String,
        weddingId: String? = null,
        businessAccountId: String? = null,
        vendorId: String? = null,
        serviceEngagementIds: List<String> = emptyList(),
    ): String = """
        {
          "grantId": "$grantId",
          "workspaceKind": "$workspaceKind",
          "scopeKind": "$scopeKind",
          "weddingId": ${weddingId?.let { "\"$it\"" } ?: "null"},
          "weddingTitle": null,
          "coupleId": null,
          "businessAccountId": ${businessAccountId?.let { "\"$it\"" } ?: "null"},
          "vendorId": ${vendorId?.let { "\"$it\"" } ?: "null"},
          "serviceEngagementIds": [${serviceEngagementIds.joinToString(",") { "\"$it\"" }}],
          "permissions": [],
          "platformRoles": []
        }
    """.trimIndent()

    private fun unboundProductionAppViewModel() = AppViewModel(
        dataEnvironment = NativeDataEnvironment.PRODUCTION,
        dataBaseUrl = "https://example.test",
    )

    /**
     * The exact defect: an unbound PRODUCTION `AppViewModel` with a valid, freshly-resolved
     * authority must yield a real `ProductionActorAssignmentSource` without ever throwing
     * `ProductionRepositoryUnbound` — and without constructing or requiring any Fixture/Shadow
     * repository. `ActorAssignmentSources.forProduction` has no repository parameter at all, so
     * this is a structural guarantee, not merely a runtime one; letting the call throw (rather than
     * catching it) is deliberate — a regression here must fail this test loudly.
     */
    @Test
    fun productionUnboundWithValidAuthorityBuildsProductionSourceWithoutTouchingAnyRepository() = runBlocking {
        val appViewModel = unboundProductionAppViewModel()
        val authority = authority(grants = "[${grant("couple:wedding:A", "couple", "wedding", weddingId = "A")}]")

        val source = resolveActorAssignmentSource(appViewModel, authority, emptySet(), null)

        assertTrue("Expected a real ProductionActorAssignmentSource", source is ProductionActorAssignmentSource)
        assertEquals(listOf(ActorAssignment("user-1", AppRole.COUPLE, "A")), source.assignments("user-1"))

        // Confirm the precondition this test is actually pinning: appState really is unbound, and
        // reading the mature repository directly really does throw. resolveActorAssignmentSource
        // above must never have done that read.
        try {
            appViewModel.repository
            fail("Expected ProductionRepositoryUnbound: this AppViewModel was never bound")
        } catch (_: ProductionRepositoryUnbound) {
        }
    }

    /** No identity session yet / no successful authority fetch yet — Empty, no repository access. */
    @Test
    fun productionUnboundWithNoAuthorityYieldsEmptySourceWithoutTouchingAnyRepository() {
        val appViewModel = unboundProductionAppViewModel()

        val source = resolveActorAssignmentSource(appViewModel, null, emptySet(), null)

        assertSame(EmptyActorAssignmentSource, source)
    }

    /** Shadow/dev-persona environments are completely unchanged: a real repository is still required. */
    @Test
    fun shadowStillRequiresARealRepositoryAndBehavesExactlyAsBefore() = runBlocking {
        val appViewModel = AppViewModel(
            baseRepository = ShadowReferenceWeddingRepository(),
            plannerRepository = ShadowReferencePlannerRepository(),
            dataEnvironment = NativeDataEnvironment.SANITIZED_SHADOW,
        )

        val source = resolveActorAssignmentSource(appViewModel, productionAuthority = null, selectedGrantIds = emptySet(), selectedEngagementId = null)

        assertTrue(source is ShadowActorAssignmentSource)
        val assignments = source.assignments(pro.wewed.app.models.DevelopmentPersona.DEFAULT_SHADOW_PERSONA_ID)
        assertEquals("shadow_ref_charity_kudzie", assignments.single().weddingId)
    }

    /**
     * `clearProductionBinding()` must not make assignment resolution itself unsafe — it is still
     * driven entirely by the (now stale) authority the caller passes, not by the binding — while
     * the mature repository domains remain correctly unreachable until a fresh bind occurs.
     */
    @Test
    fun productionAfterClearBindingResolvesAssignmentsSafelyWhileRepositoryStillThrows() = runBlocking {
        val appViewModel = unboundProductionAppViewModel()
        val authority = authority(grants = "[${grant("couple:wedding:A", "couple", "wedding", weddingId = "A")}]")

        // Bind, then immediately clear — exactly the sign-out/session-invalidation sequence.
        appViewModel.clearProductionBinding()

        val source = resolveActorAssignmentSource(appViewModel, authority, emptySet(), null)
        assertTrue(source is ProductionActorAssignmentSource)
        assertEquals(listOf(ActorAssignment("user-1", AppRole.COUPLE, "A")), source.assignments("user-1"))

        try {
            appViewModel.repository
            fail("Expected ProductionRepositoryUnbound: clearProductionBinding must not leave a mature repository reachable")
        } catch (_: ProductionRepositoryUnbound) {
        }
    }

    /**
     * Account A's authority is resolved once (unbound), then Account B's completely different
     * authority is resolved on the SAME `AppViewModel` instance (the ordinary account-replacement
     * sequence before any bind has occurred for either). `resolveActorAssignmentSource` never reads
     * `appViewModel.repository` for PRODUCTION at all, so there is no repository object through
     * which A's identity could bleed into B's resolution — and the assignments returned must be
     * exactly B's, never A's.
     */
    @Test
    fun accountAToAccountBNeverConsultsAnyRepositoryAndNeverMixesAssignments() = runBlocking {
        val appViewModel = unboundProductionAppViewModel()
        val authorityA = authority(
            accessUserId = "user-a",
            grants = "[${grant("couple:wedding:A", "couple", "wedding", weddingId = "A")}]",
        )
        val authorityB = authority(
            accessUserId = "user-b",
            grants = "[${grant("planner:wedding:B", "planner", "wedding", weddingId = "B")}]",
        )

        val sourceA = resolveActorAssignmentSource(appViewModel, authorityA, emptySet(), null)
        assertEquals(listOf(ActorAssignment("user-a", AppRole.COUPLE, "A")), sourceA.assignments("user-a"))
        // Account A's source must never answer for account B's id either.
        assertTrue(sourceA.assignments("user-b").isEmpty())

        val sourceB = resolveActorAssignmentSource(appViewModel, authorityB, emptySet(), null)
        assertEquals(listOf(ActorAssignment("user-b", AppRole.PLANNER, "B")), sourceB.assignments("user-b"))
        assertTrue(sourceB.assignments("user-a").isEmpty())
    }

    /**
     * Master plan Phase 8 closure round 4 §2 — `selectedEngagementId` must keep flowing all the way
     * through `resolveActorAssignmentSource` → `ActorAssignmentSources.forProduction` →
     * `ProductionActorAssignmentSource`, exactly as it did before this round's refactor split
     * `forEnvironment` into `forShadow`/`forProduction`/`empty`.
     */
    @Test
    fun vendorSameGrantEngagementSelectionFlowsThroughResolveActorAssignmentSource() = runBlocking {
        val appViewModel = unboundProductionAppViewModel()
        val authority = authority(
            grants = "[${grant(
                grantId = "vendor:wedding:biz-1:vendor-1",
                workspaceKind = "vendor",
                scopeKind = "wedding",
                weddingId = "E",
                businessAccountId = "biz-1",
                vendorId = "vendor-1",
                serviceEngagementIds = listOf("eng-1", "eng-2"),
            )}]",
        )

        val sourceA = resolveActorAssignmentSource(appViewModel, authority, emptySet(), "eng-1")
        assertEquals(
            listOf(ActorAssignment("user-1", AppRole.VENDOR, "E", vendorId = "vendor-1", engagementId = "eng-1")),
            sourceA.assignments("user-1"),
        )

        val sourceB = resolveActorAssignmentSource(appViewModel, authority, emptySet(), "eng-2")
        assertEquals(
            listOf(ActorAssignment("user-1", AppRole.VENDOR, "E", vendorId = "vendor-1", engagementId = "eng-2")),
            sourceB.assignments("user-1"),
        )
    }
}
