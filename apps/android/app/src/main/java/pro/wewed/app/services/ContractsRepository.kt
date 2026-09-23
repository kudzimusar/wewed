package pro.wewed.app.services

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure round 3 §3.
 *
 * A distinct DTO for the managed-contract lifecycle (`ServiceEngagement` + `Contract` +
 * `ContractVersion`), deliberately NOT [pro.wewed.app.models.PlannerVendorEngagement] — that model
 * already represents a different, legitimate domain (the planning-side `Vendor.contractStatus`/
 * `paymentStatus` fields a Planner tracks manually), and reusing it here would conflate two real,
 * separately-persisted domains into one. Only fields the shared server result actually returns are
 * modelled; nothing here is computed or inferred client-side.
 */
data class ContractSummary(
    val id: String,
    val contractNumber: String,
    val status: String,
    val currentVersionNumber: Int,
)

data class ServiceEngagementSummary(
    val id: String,
    val vendorName: String,
    val serviceCategory: String,
    val lifecycleStatus: String,
    val agreedAmount: String?,
    val currency: String,
    val contracts: List<ContractSummary>,
)

interface ContractsRepository {
    suspend fun getServiceEngagements(): List<ServiceEngagementSummary>
}

/**
 * No Shadow/Fixture contract data is fabricated for this brand-new-this-phase capability — there is
 * no historical Shadow qualification fixture for the managed-contract lifecycle to read from, and
 * inventing one would be exactly the kind of fabrication master plan §8/§16 exists to prevent. Used
 * for every non-production environment; the "Contracts" destination shows this honestly as
 * UNSUPPORTED for those environments rather than calling this repository at all.
 */
object EmptyContractsRepository : ContractsRepository {
    override suspend fun getServiceEngagements(): List<ServiceEngagementSummary> = emptyList()
}

/**
 * Master plan Phase 8 closure round 3 §5 — the PRODUCTION default before a real binding exists.
 * Never fabricated: the one method throws, matching every other `ProductionBoundary*Repository` in
 * this codebase, so a caller can never mistake "not yet bound" for "fetched and empty".
 */
class ProductionBoundaryContractsRepository : ContractsRepository {
    override suspend fun getServiceEngagements(): List<ServiceEngagementSummary> = throw ProductionReadOnlyDomainUnavailable()
}

/**
 * Master plan Phase 8 closure round 3 §3 — reads the SAME `listManagedServiceEngagements` engine
 * the PWA's `/api/planner/engagements/current` uses (via `/api/native/wedding/engagements`), never a
 * second contract truth. Throws (never fabricates empty) on a live failure, matching every other
 * production repository's "this is only ever consulted once a real wedding-scoped grant has
 * rendered a role shell" contract.
 */
class ProductionContractsRepository(
    private val client: NativeDomainApiClient,
    private val sessionToken: String,
    private val grantId: String,
) : ContractsRepository {
    override suspend fun getServiceEngagements(): List<ServiceEngagementSummary> {
        val array = when (val fetch = client.engagements(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> throw ProductionReadOnlyDomainUnavailable()
        }
        return array.toObjectList().map { item ->
            val vendor = item.optJSONObject("vendor")
            val contracts = item.optJSONArray("contracts")?.toObjectList().orEmpty().map { contract ->
                ContractSummary(
                    id = contract.getString("id"),
                    contractNumber = contract.optString("contractNumber"),
                    status = contract.optString("status"),
                    currentVersionNumber = contract.optInt("currentVersionNumber"),
                )
            }
            ServiceEngagementSummary(
                id = item.getString("id"),
                vendorName = vendor?.optString("name")?.takeIf { it.isNotBlank() } ?: "Unknown vendor",
                serviceCategory = item.optString("serviceCategory"),
                lifecycleStatus = item.optString("lifecycleStatus"),
                agreedAmount = if (item.isNull("agreedAmount")) null else item.optString("agreedAmount").takeIf { it.isNotBlank() },
                currency = item.optString("currency", "USD"),
                contracts = contracts,
            )
        }
    }
}
