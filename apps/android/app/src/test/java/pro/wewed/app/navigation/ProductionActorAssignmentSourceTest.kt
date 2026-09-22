package pro.wewed.app.navigation

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.AppRole

/**
 * `ProductionActorAssignmentSource` (master plan Phase 5). The shared fixture
 * (`ProductionAuthorityContractTest`) has one grant per kind, so this file builds its own JSON to
 * exercise the multi-grant selection path directly. The iOS counterpart is
 * `ProductionActorAssignmentSourceTests`.
 */
class ProductionActorAssignmentSourceTest {

    private fun authority(
        accountStatus: String = "authorized",
        accessUserId: String? = "user-1",
        grants: String,
        contextSelection: String = "[]",
    ): ProductionAuthority = ProductionAuthorityDecoder.decode(
        """
        {
          "contract": "WewedProductionAuthorityV1",
          "version": 1,
          "accountStatus": "$accountStatus",
          "identity": ${if (accessUserId == null) "null" else """{"accessUserId": "$accessUserId", "dashboardClass": "planner"}"""},
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
        weddingTitle: String? = null,
        businessAccountId: String? = null,
        vendorId: String? = null,
        serviceEngagementIds: List<String> = emptyList(),
    ): String = """
        {
          "grantId": "$grantId",
          "workspaceKind": "$workspaceKind",
          "scopeKind": "$scopeKind",
          "weddingId": ${weddingId?.let { "\"$it\"" } ?: "null"},
          "weddingTitle": ${weddingTitle?.let { "\"$it\"" } ?: "null"},
          "coupleId": null,
          "businessAccountId": ${businessAccountId?.let { "\"$it\"" } ?: "null"},
          "vendorId": ${vendorId?.let { "\"$it\"" } ?: "null"},
          "serviceEngagementIds": [${serviceEngagementIds.joinToString(",") { "\"$it\"" }}],
          "permissions": [],
          "platformRoles": []
        }
    """.trimIndent()

    @Test
    fun aSingleGrantOfItsKindIsAssignedWithoutAnySelection() = runBlocking {
        val authority = authority(
            grants = "[${grant("couple:wedding:A", "couple", "wedding", weddingId = "A")}]",
        )
        val source = ProductionActorAssignmentSource(authority)
        val assignments = source.assignments("user-1")
        assertEquals(listOf(ActorAssignment("user-1", AppRole.COUPLE, "A")), assignments)
    }

    @Test
    fun multipleGrantsOfOneKindYieldNothingUntilExplicitlySelected() = runBlocking {
        val authority = authority(
            grants = "[" +
                grant("planner:wedding:A", "planner", "wedding", weddingId = "A", weddingTitle = "Wedding A") + "," +
                grant("planner:wedding:B", "planner", "wedding", weddingId = "B", weddingTitle = "Wedding B") +
                "]",
            contextSelection = """[{"workspaceKind":"planner","grantIds":["planner:wedding:A","planner:wedding:B"],"selectionRequired":true}]""",
        )
        assertTrue(ProductionActorAssignmentSource(authority).assignments("user-1").isEmpty())

        val withSelection = ProductionActorAssignmentSource(authority, selectedGrantIds = setOf("planner:wedding:B"))
        assertEquals(
            listOf(ActorAssignment("user-1", AppRole.PLANNER, "B")),
            withSelection.assignments("user-1"),
        )
    }

    @Test
    fun twoSelectedGrantsOfTheSameKindFailClosed() = runBlocking {
        val authority = authority(
            grants = "[" +
                grant("planner:wedding:A", "planner", "wedding", weddingId = "A") + "," +
                grant("planner:wedding:B", "planner", "wedding", weddingId = "B") +
                "]",
            contextSelection = """[{"workspaceKind":"planner","grantIds":["planner:wedding:A","planner:wedding:B"],"selectionRequired":true}]""",
        )
        val source = ProductionActorAssignmentSource(
            authority,
            selectedGrantIds = setOf("planner:wedding:A", "planner:wedding:B"),
        )
        assertTrue(source.assignments("user-1").isEmpty())
    }

    @Test
    fun aSelectedGrantThatNoLongerExistsHasNoEffect() = runBlocking {
        // Only grant A remains in this fresh authority; the previously-selected B has been revoked
        // (or never existed). The source must never invent an assignment for it.
        val authority = authority(
            grants = "[${grant("planner:wedding:A", "planner", "wedding", weddingId = "A")}]",
            contextSelection = """[{"workspaceKind":"planner","grantIds":["planner:wedding:A"],"selectionRequired":false}]""",
        )
        val source = ProductionActorAssignmentSource(authority, selectedGrantIds = setOf("planner:wedding:B"))
        assertEquals(listOf(ActorAssignment("user-1", AppRole.PLANNER, "A")), source.assignments("user-1"))
    }

    @Test
    fun portfolioAndBusinessGrantsNeverBecomeAFakeWeddingAssignment() = runBlocking {
        val authority = authority(
            grants = "[${grant("planner:portfolio:biz-1", "planner", "portfolio", businessAccountId = "biz-1")}]",
        )
        assertTrue(ProductionActorAssignmentSource(authority).assignments("user-1").isEmpty())
        // Even if a caller (incorrectly) "selects" the portfolio grant id, it still never becomes
        // an ActorAssignment: ProductionGrantMapper reports RequiresWeddingSelection, not Assigned.
        val withSelection = ProductionActorAssignmentSource(authority, selectedGrantIds = setOf("planner:portfolio:biz-1"))
        assertTrue(withSelection.assignments("user-1").isEmpty())
    }

    @Test
    fun selectedVendorEngagementFlowsIntoActorAssignment() = runBlocking {
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
        val source = ProductionActorAssignmentSource(
            authority = authority,
            selectedEngagementId = "eng-2",
        )
        assertEquals(
            listOf(
                ActorAssignment(
                    actorId = "user-1",
                    role = AppRole.VENDOR,
                    weddingId = "E",
                    vendorId = "vendor-1",
                    engagementId = "eng-2",
                )
            ),
            source.assignments("user-1"),
        )
    }

    @Test
    fun foreignVendorEngagementFailsClosedAtAssignmentBoundary() = runBlocking {
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
        val source = ProductionActorAssignmentSource(
            authority = authority,
            selectedEngagementId = "foreign-engagement",
        )
        assertTrue(source.assignments("user-1").isEmpty())
    }

    @Test
    fun anUnusableAuthorityYieldsNothing() = runBlocking {
        val banned = authority(accountStatus = "banned_identity", grants = "[]")
        assertTrue(ProductionActorAssignmentSource(banned).assignments("user-1").isEmpty())
    }

    @Test
    fun aMismatchedActorIdYieldsNothing() = runBlocking {
        val authority = authority(
            grants = "[${grant("couple:wedding:A", "couple", "wedding", weddingId = "A")}]",
        )
        assertTrue(ProductionActorAssignmentSource(authority).assignments("someone-else").isEmpty())
    }
}
