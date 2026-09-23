package pro.wewed.app.navigation

import org.json.JSONArray
import org.json.JSONObject
import pro.wewed.app.models.AppRole

/**
 * Native view of the shared server contract `WewedProductionAuthorityV1` (master plan Phase 2).
 * Specification: docs/native-mobile/WEWED_PRODUCTION_AUTHORITY_CONTRACT_V1.md.
 *
 * PURE and NOT ACTIVATED. Nothing in SessionViewModel, ActorAssignmentSources,
 * NativeRepositoryFactory or RootScreen uses these types yet; activation is Phase 5.
 *
 * Two levels are kept apart on purpose:
 *
 *     available server workspace grants   (everything the account may open)
 *            ↓ the person selects one — later, Phase 5
 *     one active ActorAssignment          (what the app is operating as right now)
 *
 * A Planner portfolio or a Vendor business is real authority with no wedding in it. It stays a
 * grant until a real wedding is selected. It is never forced into an ActorAssignment, and
 * NavigationContext keeps its required wedding scope.
 *
 * Roles are never derived from raw server strings, and the flat AppRole id parser is never used on server
 * data. The mapper reads only the server's explicit `workspaceKind` + `scopeKind`.
 */

/** Workspace kinds the contract can prove. Anything else — guest, usher, future kinds — is UNKNOWN. */
enum class GrantWorkspaceKind(val wire: String?) {
    COUPLE("couple"),
    PLANNER("planner"),
    COORDINATOR("coordinator"),
    VENDOR("vendor"),
    ADMIN("admin"),
    UNKNOWN(null);

    companion object {
        fun fromWire(value: String): GrantWorkspaceKind = entries.firstOrNull { it.wire == value } ?: UNKNOWN
    }
}

enum class GrantScopeKind(val wire: String?) {
    WEDDING("wedding"),
    PORTFOLIO("portfolio"),
    BUSINESS("business"),
    SYSTEM("system"),
    UNKNOWN(null);

    companion object {
        fun fromWire(value: String): GrantScopeKind = entries.firstOrNull { it.wire == value } ?: UNKNOWN
    }
}

data class ProductionWorkspaceGrant(
    val grantId: String,
    /** The kind exactly as the server sent it, kept for diagnostics. */
    val workspaceKindWire: String,
    val workspaceKind: GrantWorkspaceKind,
    val scopeKindWire: String,
    val scopeKind: GrantScopeKind,
    val weddingId: String?,
    val weddingTitle: String?,
    val coupleId: String?,
    val businessAccountId: String?,
    val vendorId: String?,
    /** Real ServiceEngagement ids only. */
    val serviceEngagementIds: List<String>,
    val permissions: List<String>,
    val platformRoles: List<String>
)

data class ProductionContextSelection(
    val workspaceKindWire: String,
    val grantIds: List<String>,
    val selectionRequired: Boolean
)

data class ProductionOperationalGrant(
    val grantId: String,
    val kind: String,
    val assignmentId: String,
    val weddingId: String,
    val weddingTitle: String,
    val gateId: String,
    val gateName: String,
    val operatorUserId: String,
    val capabilities: List<String>
)

data class ProductionGateContextSelection(
    val kind: String,
    val grantIds: List<String>,
    val selectionRequired: Boolean
)

data class ProductionAuthority(
    val contract: String,
    val version: Int,
    val accountStatus: String,
    val accessUserId: String?,
    /** The dashboard/account class axis as stored. Evidence only — never a workspace. */
    val dashboardClass: String?,
    val grants: List<ProductionWorkspaceGrant>,
    val contextSelection: List<ProductionContextSelection>,
    val operationalGrants: List<ProductionOperationalGrant> = emptyList(),
    val gateContextSelection: ProductionGateContextSelection? = null,
    /** Authority the account contract refuses by design, e.g. "guest". */
    val unsupportedAuthorities: List<String>,
    val platformEffectiveRole: String?,
    /** Presentation-only names already carried by the server authority evidence. Never authority. */
    val businessNamesById: Map<String, String> = emptyMap(),
    val vendorNamesById: Map<String, String> = emptyMap(),
) {
    companion object {
        const val CONTRACT = "WewedProductionAuthorityV1"
        const val VERSION = 1
    }
}

object ProductionAuthorityDecoder {
    /** Decodes the contract. Returns null for malformed JSON; it never guesses missing fields. */
    fun decode(json: String): ProductionAuthority? = runCatching {
        val root = JSONObject(json)
        val identity = root.optJSONObject("identity")
        val gateSelectionObj = root.optJSONObject("gateContextSelection")
        ProductionAuthority(
            contract = root.getString("contract"),
            version = root.getInt("version"),
            accountStatus = root.getString("accountStatus"),
            accessUserId = identity?.nullableString("accessUserId"),
            dashboardClass = identity?.nullableString("dashboardClass"),
            grants = root.getJSONArray("workspaceGrants").objects().map(::grant),
            contextSelection = root.getJSONArray("contextSelection").objects().map {
                ProductionContextSelection(
                    workspaceKindWire = it.getString("workspaceKind"),
                    grantIds = it.getJSONArray("grantIds").strings(),
                    selectionRequired = it.getBoolean("selectionRequired")
                )
            },
            operationalGrants = root.optJSONArray("operationalGrants")?.objects()?.map(::operationalGrant) ?: emptyList(),
            gateContextSelection = gateSelectionObj?.let {
                ProductionGateContextSelection(
                    kind = it.getString("kind"),
                    grantIds = it.getJSONArray("grantIds").strings(),
                    selectionRequired = it.getBoolean("selectionRequired")
                )
            },
            unsupportedAuthorities = root.getJSONArray("unsupported").objects().map { it.getString("authority") },
            platformEffectiveRole = root.optJSONObject("platform")?.nullableString("effectiveRole"),
            businessNamesById = root.optJSONArray("businessMemberships")
                ?.objects()
                ?.associate { it.getString("businessAccountId") to it.getString("businessName") }
                ?: emptyMap(),
            vendorNamesById = root.optJSONArray("vendorEngagements")
                ?.objects()
                ?.associate { it.getString("vendorId") to it.getString("vendorName") }
                ?: emptyMap(),
        )
    }.getOrNull()

    private fun operationalGrant(o: JSONObject): ProductionOperationalGrant {
        return ProductionOperationalGrant(
            grantId = o.getString("grantId"),
            kind = o.getString("kind"),
            assignmentId = o.getString("assignmentId"),
            weddingId = o.getString("weddingId"),
            weddingTitle = o.getString("weddingTitle"),
            gateId = o.getString("gateId"),
            gateName = o.getString("gateName"),
            operatorUserId = o.getString("operatorUserId"),
            capabilities = o.getJSONArray("capabilities").strings()
        )
    }

    private fun grant(o: JSONObject): ProductionWorkspaceGrant {
        val kind = o.getString("workspaceKind")
        val scope = o.getString("scopeKind")
        return ProductionWorkspaceGrant(
            grantId = o.getString("grantId"),
            workspaceKindWire = kind,
            workspaceKind = GrantWorkspaceKind.fromWire(kind),
            scopeKindWire = scope,
            scopeKind = GrantScopeKind.fromWire(scope),
            weddingId = o.nullableString("weddingId"),
            weddingTitle = o.nullableString("weddingTitle"),
            coupleId = o.nullableString("coupleId"),
            businessAccountId = o.nullableString("businessAccountId"),
            vendorId = o.nullableString("vendorId"),
            serviceEngagementIds = o.getJSONArray("serviceEngagementIds").strings(),
            permissions = o.getJSONArray("permissions").strings(),
            platformRoles = o.getJSONArray("platformRoles").strings()
        )
    }

    private fun JSONObject.nullableString(key: String): String? =
        if (!has(key) || isNull(key)) null else getString(key)

    private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

    private fun JSONArray.strings(): List<String> = (0 until length()).map { getString(it) }
}

/**
 * Proves which ONE selected grant may become an [ActorAssignment]. Conservative: anything not
 * explicitly mapped is denied.
 */
object ProductionGrantMapper {

    sealed interface Outcome {
        data class Assigned(val assignment: ActorAssignment) : Outcome

        /**
         * Real authority with no wedding in it (Planner portfolio, Vendor business). A wedding must
         * be selected from the account's real wedding-scoped grants first; none is invented.
         */
        data class RequiresWeddingSelection(val grant: ProductionWorkspaceGrant) : Outcome

        data class Denied(val reason: String) : Outcome
    }

    /** The account is usable only for the exact contract, version and an authorized identity. */
    fun isUsable(authority: ProductionAuthority): Boolean =
        authority.contract == ProductionAuthority.CONTRACT &&
            authority.version == ProductionAuthority.VERSION &&
            authority.accountStatus == "authorized" &&
            !authority.accessUserId.isNullOrBlank()

    /**
     * Maps the grant the person selected.
     *
     * @param selectedEngagementId for a Vendor wedding grant, the engagement the person chose. It
     *   must be one of the grant's real engagements. With none chosen, an engagement is filled in
     *   only when exactly one exists.
     */
    fun map(
        authority: ProductionAuthority,
        grantId: String,
        selectedEngagementId: String? = null
    ): Outcome {
        if (!isUsable(authority)) return Outcome.Denied("The account authority is not usable.")
        val grant = authority.grants.firstOrNull { it.grantId == grantId }
            ?: return Outcome.Denied("No such grant for this account.")
        val actorId = authority.accessUserId!!

        return when (grant.workspaceKind to grant.scopeKind) {
            GrantWorkspaceKind.COUPLE to GrantScopeKind.WEDDING ->
                weddingAssignment(grant, AppRole.COUPLE, actorId)
            GrantWorkspaceKind.PLANNER to GrantScopeKind.WEDDING ->
                weddingAssignment(grant, AppRole.PLANNER, actorId)
            GrantWorkspaceKind.COORDINATOR to GrantScopeKind.WEDDING ->
                weddingAssignment(grant, AppRole.COORDINATOR, actorId)
            GrantWorkspaceKind.VENDOR to GrantScopeKind.WEDDING -> vendorAssignment(grant, actorId, selectedEngagementId)
            GrantWorkspaceKind.ADMIN to GrantScopeKind.SYSTEM -> Outcome.Assigned(
                ActorAssignment(actorId = actorId, role = AppRole.ADMIN, weddingId = null)
            )
            GrantWorkspaceKind.PLANNER to GrantScopeKind.PORTFOLIO,
            GrantWorkspaceKind.VENDOR to GrantScopeKind.BUSINESS ->
                if (grant.businessAccountId.isNullOrBlank()) Outcome.Denied("A business grant must name its business.")
                else Outcome.RequiresWeddingSelection(grant)
            else -> Outcome.Denied(
                "Grant kind '${grant.workspaceKindWire}/${grant.scopeKindWire}' is not a supported native workspace."
            )
        }
    }

    private fun weddingAssignment(grant: ProductionWorkspaceGrant, role: AppRole, actorId: String): Outcome {
        val weddingId = grant.weddingId?.takeIf { it.isNotBlank() }
            ?: return Outcome.Denied("A wedding-scoped grant must name its wedding.")
        return Outcome.Assigned(ActorAssignment(actorId = actorId, role = role, weddingId = weddingId))
    }

    private fun vendorAssignment(grant: ProductionWorkspaceGrant, actorId: String, selectedEngagementId: String?): Outcome {
        val weddingId = grant.weddingId?.takeIf { it.isNotBlank() }
            ?: return Outcome.Denied("A Vendor wedding grant must name its wedding.")
        val vendorId = grant.vendorId?.takeIf { it.isNotBlank() }
            ?: return Outcome.Denied("A Vendor wedding grant must name its vendor.")
        val engagementId = when {
            selectedEngagementId != null ->
                selectedEngagementId.takeIf { it in grant.serviceEngagementIds }
                    ?: return Outcome.Denied("That engagement is not part of this grant.")
            else -> grant.serviceEngagementIds.singleOrNull()
        }
        return Outcome.Assigned(
            ActorAssignment(
                actorId = actorId,
                role = AppRole.VENDOR,
                weddingId = weddingId,
                vendorId = vendorId,
                engagementId = engagementId
            )
        )
    }
}
