package pro.wewed.app.navigation

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.AppRole
import java.io.File

/**
 * WewedProductionAuthorityV1 on Android (master plan Phase 2). The fixture is produced by the
 * server's own builder (backend branch, grants.test.ts), so this decodes exactly what the server
 * emits. The iOS counterpart is ProductionAuthorityContractTests.
 */
class ProductionAuthorityContractTest {

    private val fixtureJson: String by lazy {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            val candidate = File(dir, "mobile/fixtures/production-authority-v1/multi-axis-actor.json")
            if (candidate.exists()) return@lazy candidate.readText()
            dir = dir.parentFile
        }
        throw IllegalStateException("Shared authority fixture not found")
    }

    private val authority: ProductionAuthority by lazy { ProductionAuthorityDecoder.decode(fixtureJson)!! }

    /** The fixture with one grant rewritten, for the negative cases. */
    private fun withGrant(grantId: String, edit: (JSONObject) -> Unit): ProductionAuthority {
        val root = JSONObject(fixtureJson)
        val grants = root.getJSONArray("workspaceGrants")
        for (i in 0 until grants.length()) {
            val grant = grants.getJSONObject(i)
            if (grant.getString("grantId") == grantId) edit(grant)
        }
        return ProductionAuthorityDecoder.decode(root.toString())!!
    }

    private fun withOperationalGrant(edit: (JSONObject) -> Unit): ProductionAuthority {
        val root = JSONObject(fixtureJson)
        edit(root.getJSONArray("operationalGrants").getJSONObject(0))
        return ProductionAuthorityDecoder.decode(root.toString())!!
    }

    private fun assigned(outcome: ProductionGrantMapper.Outcome): ActorAssignment =
        (outcome as ProductionGrantMapper.Outcome.Assigned).assignment

    @Test
    fun theServerFixtureDecodesCompletely() {
        assertEquals("WewedProductionAuthorityV1", authority.contract)
        assertEquals(1, authority.version)
        assertEquals("authorized", authority.accountStatus)
        assertEquals("user-1", authority.accessUserId)
        assertEquals(
            listOf(
                "couple:wedding:A",
                "planner:portfolio:planning-1",
                "planner:wedding:B",
                "coordinator:wedding:C",
                "vendor:business:vendor-1",
                "vendor:wedding:vendor-1:vendor-row-F",
                "admin:system"
            ),
            authority.grants.map { it.grantId }
        )
        assertEquals(listOf("guest"), authority.unsupportedAuthorities)
        assertEquals(
            listOf("gate_operator:B:gate-1"),
            authority.operationalGrants.map { it.grantId }
        )
        val opGrant = authority.operationalGrants.first()
        assertEquals("gate_operator", opGrant.kind)
        assertEquals("ga-1", opGrant.assignmentId)
        assertEquals("B", opGrant.weddingId)
        assertEquals("gate-1", opGrant.gateId)
        assertEquals("Gate gate-1", opGrant.gateName)
        assertEquals("user-1", opGrant.operatorUserId)
        assertEquals(
            listOf("gate.manifest.read", "gate.checkin.write", "gate.guest_search.read", "gate.audit.read"),
            opGrant.capabilities
        )
        assertNotNull(authority.gateContextSelection)
        assertEquals("gate_operator", authority.gateContextSelection?.kind)
        assertEquals(listOf("gate_operator:B:gate-1"), authority.gateContextSelection?.grantIds)
        assertEquals(false, authority.gateContextSelection?.selectionRequired)
        assertEquals("Business planning-1", authority.businessNamesById["planning-1"])
        assertEquals("Business vendor-1", authority.businessNamesById["vendor-1"])
        assertEquals("Vendor F", authority.vendorNamesById["vendor-row-F"])
        assertTrue(ProductionGrantMapper.isUsable(authority))
    }

    @Test
    fun weddingScopedGrantsBecomeAssignments() {
        assertEquals(
            ActorAssignment("user-1", AppRole.COUPLE, "A"),
            assigned(ProductionGrantMapper.map(authority, "couple:wedding:A"))
        )
        assertEquals(
            ActorAssignment("user-1", AppRole.PLANNER, "B"),
            assigned(ProductionGrantMapper.map(authority, "planner:wedding:B"))
        )
        assertEquals(
            ActorAssignment("user-1", AppRole.COORDINATOR, "C"),
            assigned(ProductionGrantMapper.map(authority, "coordinator:wedding:C"))
        )
    }

    @Test
    fun vendorWeddingGrantCarriesWeddingVendorAndOnlyARealEngagement() {
        val assignment = assigned(ProductionGrantMapper.map(authority, "vendor:wedding:vendor-1:vendor-row-F"))
        assertEquals(AppRole.VENDOR, assignment.role)
        assertEquals("F", assignment.weddingId)
        assertEquals("vendor-row-F", assignment.vendorId)
        assertEquals("se-1", assignment.engagementId) // exactly one real engagement
        assertFalse(assignment.isShadowTestAccess)

        val fabricated = ProductionGrantMapper.map(authority, "vendor:wedding:vendor-1:vendor-row-F", "se-invented")
        assertTrue(fabricated is ProductionGrantMapper.Outcome.Denied)
    }

    @Test
    fun vendorWithSeveralEngagementsLeavesTheChoiceOpen() {
        val many = withGrant("vendor:wedding:vendor-1:vendor-row-F") {
            it.put("serviceEngagementIds", org.json.JSONArray(listOf("se-1", "se-2")))
        }
        assertNull(assigned(ProductionGrantMapper.map(many, "vendor:wedding:vendor-1:vendor-row-F")).engagementId)
        assertEquals(
            "se-2",
            assigned(ProductionGrantMapper.map(many, "vendor:wedding:vendor-1:vendor-row-F", "se-2")).engagementId
        )
    }

    @Test
    fun adminSystemGrantIsSystemScopedWithNoWedding() {
        val assignment = assigned(ProductionGrantMapper.map(authority, "admin:system"))
        assertEquals(AppRole.ADMIN, assignment.role)
        assertNull(assignment.weddingId)
        assertTrue(assignment.isSystemScope)
        assertEquals(listOf("wewed_operations_admin"), authority.grants.last().platformRoles)
    }

    /** The Planner portfolio stays a portfolio grant. It is never forced into an assignment or a fake wedding. */
    @Test
    fun plannerPortfolioIsNotYetAnAssignment() {
        val outcome = ProductionGrantMapper.map(authority, "planner:portfolio:planning-1")
        assertTrue(outcome is ProductionGrantMapper.Outcome.RequiresWeddingSelection)
        val grant = (outcome as ProductionGrantMapper.Outcome.RequiresWeddingSelection).grant
        assertNull(grant.weddingId)
        assertEquals("planning-1", grant.businessAccountId)
    }

    @Test
    fun vendorBusinessIsNotYetAnAssignment() {
        assertTrue(
            ProductionGrantMapper.map(authority, "vendor:business:vendor-1") is
                ProductionGrantMapper.Outcome.RequiresWeddingSelection
        )
    }

    /** Viewer relationships produce no grant on the server, so there is nothing to map. */
    @Test
    fun viewerHasNoWorkspace() {
        assertTrue(authority.grants.none { it.weddingId == "D" })
        assertTrue(ProductionGrantMapper.map(authority, "viewer:wedding:D") is ProductionGrantMapper.Outcome.Denied)
    }

    @Test
    fun unknownGuestAndUsherGrantKindsAreDenied() {
        for (kind in listOf("guest", "usher", "gate", "support", "")) {
            val altered = withGrant("couple:wedding:A") { it.put("workspaceKind", kind) }
            val grant = altered.grants.first { it.grantId == "couple:wedding:A" }
            assertEquals(GrantWorkspaceKind.UNKNOWN, grant.workspaceKind)
            assertTrue(
                "'$kind' must be denied",
                ProductionGrantMapper.map(altered, "couple:wedding:A") is ProductionGrantMapper.Outcome.Denied
            )
        }
    }

    @Test
    fun anUnknownScopeOrAMismatchedScopeIsDenied() {
        val unknownScope = withGrant("couple:wedding:A") { it.put("scopeKind", "galaxy") }
        assertTrue(ProductionGrantMapper.map(unknownScope, "couple:wedding:A") is ProductionGrantMapper.Outcome.Denied)
        val coupleSystem = withGrant("couple:wedding:A") { it.put("scopeKind", "system") }
        assertTrue(ProductionGrantMapper.map(coupleSystem, "couple:wedding:A") is ProductionGrantMapper.Outcome.Denied)
        val noWedding = withGrant("planner:wedding:B") { it.put("weddingId", JSONObject.NULL) }
        assertTrue(ProductionGrantMapper.map(noWedding, "planner:wedding:B") is ProductionGrantMapper.Outcome.Denied)
    }

    @Test
    fun anUnauthorizedAccountOrAnotherContractVersionIsRefusedEntirely() {
        for (edit in listOf<(JSONObject) -> Unit>(
            { it.put("accountStatus", "inactive_identity") },
            // No verified auth identity was supplied: never usable (Phase 2 review closure).
            { it.put("accountStatus", "unverified_auth_identity") },
            { it.put("accountStatus", "unknown_identity") },
            { it.put("accountStatus", "some_future_status") },
            { it.put("accountStatus", "banned_identity") },
            { it.put("version", 2) },
            { it.put("contract", "SomethingElse") }
        )) {
            val root = JSONObject(fixtureJson).also(edit)
            val altered = ProductionAuthorityDecoder.decode(root.toString())!!
            assertFalse(ProductionGrantMapper.isUsable(altered))
            assertTrue(ProductionGrantMapper.map(altered, "couple:wedding:A") is ProductionGrantMapper.Outcome.Denied)
        }
    }

    @Test
    fun malformedPayloadsDecodeToNothing() {
        assertNull(ProductionAuthorityDecoder.decode("not json"))
        assertNull(ProductionAuthorityDecoder.decode("{}"))
        assertNotNull(ProductionAuthorityDecoder.decode(fixtureJson))
    }

    @Test
    fun gateOperationalGrantMapsToConcreteContextOnlyFromServerAuthority() {
        val outcome = ProductionGateGrantMapper.map(authority, "gate_operator:B:gate-1")
        assertTrue(outcome is ProductionGateGrantMapper.Outcome.Selected)
        val context = (outcome as ProductionGateGrantMapper.Outcome.Selected).context
        assertEquals("ga-1", context.assignmentId)
        assertEquals("B", context.weddingId)
        assertEquals("gate-1", context.gateId)
        assertEquals("user-1", context.operatorUserId)
        assertTrue("gate.checkin.write" in context.capabilities)
    }

    @Test
    fun gateOperationalGrantFailsClosedForUnknownKindCapabilityOrWrongActor() {
        val unknownKind = withOperationalGrant { it.put("kind", "future_gate_kind") }
        assertTrue(
            ProductionGateGrantMapper.map(unknownKind, "gate_operator:B:gate-1") is
                ProductionGateGrantMapper.Outcome.Denied
        )

        val unknownCapability = withOperationalGrant {
            it.put("capabilities", org.json.JSONArray(listOf("gate.checkin.write", "gate.superuser")))
        }
        assertTrue(
            ProductionGateGrantMapper.map(unknownCapability, "gate_operator:B:gate-1") is
                ProductionGateGrantMapper.Outcome.Denied
        )

        val wrongActor = withOperationalGrant { it.put("operatorUserId", "different-user") }
        assertTrue(
            ProductionGateGrantMapper.map(wrongActor, "gate_operator:B:gate-1") is
                ProductionGateGrantMapper.Outcome.Denied
        )
    }

    /** The server's raw role strings never pass through the flat AppRole parser. */
    @Test
    fun theMapperNeverParsesServerRoleStrings() {
        val source = File(
            System.getProperty("user.dir"),
            "src/main/java/pro/wewed/app/navigation/ProductionAuthority.kt"
        ).takeIf { it.exists() }?.readText()
        if (source != null) assertFalse(source.contains("AppRole.fromId"))
    }
}
