package pro.wewed.app.services

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure round 3 §6.
 *
 * The Vendor's OWN wedding-engagement identity — a completely separate authority axis from the
 * Vendor business-portfolio shell ([VendorBusinessRepository]) and from the Planner/Couple/
 * Coordinator Contracts list ([ContractsRepository]/[ServiceEngagementSummary]), even though all
 * three ultimately read from the same `ServiceEngagement`/`Contract` tables. A distinct DTO on
 * purpose: this Vendor is one PARTY to one engagement, never a list of every engagement on the
 * wedding, so it is shaped around "my engagement" rather than "the wedding's contracts".
 */
data class VendorEngagementDetail(
    val id: String,
    val weddingId: String,
    val serviceCategory: String,
    val lifecycleStatus: String,
    val agreedAmount: String?,
    val currency: String,
    val contracts: List<ContractSummary>,
)

interface VendorEngagementRepository {
    suspend fun getMyEngagement(): VendorEngagementDetail
}

/** No Shadow/Fixture data exists for this brand-new-this-phase capability — see [EmptyContractsRepository]'s identical reasoning. */
object EmptyVendorEngagementRepository : VendorEngagementRepository {
    override suspend fun getMyEngagement(): VendorEngagementDetail = throw ProductionReadOnlyDomainUnavailable()
}

/**
 * Reads the SAME `getServiceEngagementDealRoom` engine [ProductionContractsRepository] uses, via
 * `/api/native/vendor/engagement` — a completely separate, Vendor-only, wedding-scoped route that a
 * Planner/Couple/Coordinator grant can never satisfy (`GRANT_SCOPE_INVALID`), and that a Vendor
 * business-portfolio grant (no wedding) can never satisfy either.
 *
 * Master plan Phase 8 closure round 4 §2 — [engagementId] is threaded straight through to
 * [NativeDomainApiClient.vendorEngagement] verbatim: this repository never guesses or auto-selects
 * an engagement itself. `null` is only ever passed by a caller that already knows the grant has
 * exactly one engagement (see `RootScreen.kt`'s bind effect); the server independently enforces the
 * same "no silent auto-select for a multi-engagement grant" rule regardless.
 */
class ProductionVendorEngagementRepository(
    private val client: NativeDomainApiClient,
    private val sessionToken: String,
    private val grantId: String,
    private val engagementId: String? = null,
) : VendorEngagementRepository {
    override suspend fun getMyEngagement(): VendorEngagementDetail {
        val root = when (val fetch = client.vendorEngagement(sessionToken, grantId, engagementId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> throw ProductionReadOnlyDomainUnavailable()
        }
        val item = root.getJSONObject("data")
        val contracts = item.optJSONArray("contracts")?.toObjectList().orEmpty().map { contract ->
            ContractSummary(
                id = contract.getString("id"),
                contractNumber = contract.optString("contractNumber"),
                status = contract.optString("status"),
                currentVersionNumber = contract.optInt("currentVersionNumber"),
            )
        }
        return VendorEngagementDetail(
            id = item.getString("id"),
            weddingId = item.optString("weddingId"),
            serviceCategory = item.optString("serviceCategory"),
            lifecycleStatus = item.optString("lifecycleStatus"),
            agreedAmount = if (item.isNull("agreedAmount")) null else item.optString("agreedAmount").takeIf { it.isNotBlank() },
            currency = item.optString("currency", "USD"),
            contracts = contracts,
        )
    }
}
