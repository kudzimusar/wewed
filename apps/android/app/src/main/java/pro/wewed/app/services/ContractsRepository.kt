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

/**
 * Master plan Phase 8 closure round 4 §3 — the mature Deal Room, distinct from
 * [ServiceEngagementSummary] (a list-row projection) the same way a detail screen is distinct from
 * its list. Field set mirrors exactly what the PWA's own `DealRoomRecord`
 * (`src/components/wedding/planner/modules/planner-vendor-deal-room.tsx`) consumes from the SAME
 * `getServiceEngagementDealRoom` engine — nothing here is invented or computed client-side.
 */
data class DealRoomVendor(
    val id: String,
    val name: String,
    val category: String,
    val email: String?,
    val phone: String?,
)

data class DealRoomParty(
    val id: String,
    val partyRole: String,
    val displayName: String,
    val email: String?,
    val phone: String?,
    val requiredForReview: Boolean,
)

data class DealRoomContractVersion(
    val id: String,
    val versionNumber: Int,
    val status: String,
    val issuedAt: String?,
    val createdAt: String,
)

data class DealRoomContractDetail(
    val id: String,
    val contractNumber: String,
    val status: String,
    val title: String,
    val currentVersionNumber: Int,
    val issuedAt: String?,
    val versions: List<DealRoomContractVersion>,
)

data class DealRoomBudgetItem(
    val id: String,
    val description: String,
    val estimatedCost: String,
    val actualCost: String?,
    val paidAmount: String,
    val currency: String,
)

data class DealRoomPayment(
    val id: String,
    val amount: String,
    val currency: String,
    val paidAt: String?,
    val reference: String?,
)

data class DealRoomDocument(
    val id: String,
    val displayName: String,
    val originalFilename: String,
    val mimeType: String,
    val byteSize: Long,
    val storageState: String,
    val scanState: String,
    val createdAt: String,
)

data class DealRoomDetail(
    val id: String,
    val serviceCategory: String,
    val serviceDescription: String?,
    val agreedAmount: String?,
    val currency: String,
    val serviceDate: String?,
    val serviceLocation: String?,
    val lifecycleStatus: String,
    val vendor: DealRoomVendor,
    val parties: List<DealRoomParty>,
    val budgetItems: List<DealRoomBudgetItem>,
    val payments: List<DealRoomPayment>,
    val contracts: List<DealRoomContractDetail>,
    val documents: List<DealRoomDocument>,
)

interface ContractsRepository {
    suspend fun getServiceEngagements(): List<ServiceEngagementSummary>

    /** Master plan Phase 8 closure round 4 §3 — the mature Deal Room for one engagement in this list. */
    suspend fun getDealRoom(engagementId: String): DealRoomDetail
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
    override suspend fun getDealRoom(engagementId: String): DealRoomDetail = throw ProductionReadOnlyDomainUnavailable()
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

    /**
     * Master plan Phase 8 closure round 4 §3 — reads the SAME `getServiceEngagementDealRoom` engine
     * the PWA's `/api/planner/engagements/[id]/deal-room` uses (via
     * `/api/native/wedding/engagements/{id}/deal-room`), never duplicating its business logic here.
     * Throws on ANY non-success fetch (foreign engagement 404, permission denial, session-invalid,
     * grant revocation) exactly like [getServiceEngagements] — a caller must never render a fabricated
     * empty Deal Room for a request that actually failed or was denied.
     */
    override suspend fun getDealRoom(engagementId: String): DealRoomDetail {
        val root = when (val fetch = client.dealRoom(sessionToken, grantId, engagementId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> throw ProductionReadOnlyDomainUnavailable()
        }
        val item = root.getJSONObject("data")
        val vendorJson = item.getJSONObject("vendor")
        val vendor = DealRoomVendor(
            id = vendorJson.getString("id"),
            name = vendorJson.optString("name"),
            category = vendorJson.optString("category"),
            email = vendorJson.optString("email").takeIf { it.isNotBlank() },
            phone = vendorJson.optString("phone").takeIf { it.isNotBlank() },
        )
        val parties = item.optJSONArray("parties")?.toObjectList().orEmpty().map { party ->
            DealRoomParty(
                id = party.getString("id"),
                partyRole = party.optString("partyRole"),
                displayName = party.optString("displayName"),
                email = party.optString("email").takeIf { it.isNotBlank() },
                phone = party.optString("phone").takeIf { it.isNotBlank() },
                requiredForReview = party.optBoolean("requiredForReview"),
            )
        }
        val budgetItems = item.optJSONArray("budgetItems")?.toObjectList().orEmpty().map { budget ->
            DealRoomBudgetItem(
                id = budget.getString("id"),
                description = budget.optString("description"),
                estimatedCost = budget.optString("estimatedCost"),
                actualCost = if (budget.isNull("actualCost")) null else budget.optString("actualCost").takeIf { it.isNotBlank() },
                paidAmount = budget.optString("paidAmount"),
                currency = budget.optString("currency", "USD"),
            )
        }
        val payments = item.optJSONArray("payments")?.toObjectList().orEmpty().map { payment ->
            DealRoomPayment(
                id = payment.getString("id"),
                amount = payment.optString("amount"),
                currency = payment.optString("currency", "USD"),
                paidAt = payment.optString("paidAt").takeIf { it.isNotBlank() },
                reference = payment.optString("reference").takeIf { it.isNotBlank() },
            )
        }
        val contracts = item.optJSONArray("contracts")?.toObjectList().orEmpty().map { contract ->
            val versions = contract.optJSONArray("versions")?.toObjectList().orEmpty().map { version ->
                DealRoomContractVersion(
                    id = version.getString("id"),
                    versionNumber = version.optInt("versionNumber"),
                    status = version.optString("status"),
                    issuedAt = version.optString("issuedAt").takeIf { it.isNotBlank() },
                    createdAt = version.optString("createdAt"),
                )
            }
            DealRoomContractDetail(
                id = contract.getString("id"),
                contractNumber = contract.optString("contractNumber"),
                status = contract.optString("status"),
                title = contract.optString("title"),
                currentVersionNumber = contract.optInt("currentVersionNumber"),
                issuedAt = contract.optString("issuedAt").takeIf { it.isNotBlank() },
                versions = versions,
            )
        }
        val documents = item.optJSONArray("documents")?.toObjectList().orEmpty().map { document ->
            DealRoomDocument(
                id = document.getString("id"),
                displayName = document.optString("displayName"),
                originalFilename = document.optString("originalFilename"),
                mimeType = document.optString("mimeType"),
                byteSize = document.optLong("byteSize"),
                storageState = document.optString("storageState"),
                scanState = document.optString("scanState"),
                createdAt = document.optString("createdAt"),
            )
        }
        return DealRoomDetail(
            id = item.getString("id"),
            serviceCategory = item.optString("serviceCategory"),
            serviceDescription = item.optString("serviceDescription").takeIf { it.isNotBlank() },
            agreedAmount = if (item.isNull("agreedAmount")) null else item.optString("agreedAmount").takeIf { it.isNotBlank() },
            currency = item.optString("currency", "USD"),
            serviceDate = item.optString("serviceDate").takeIf { it.isNotBlank() },
            serviceLocation = item.optString("serviceLocation").takeIf { it.isNotBlank() },
            lifecycleStatus = item.optString("lifecycleStatus"),
            vendor = vendor,
            parties = parties,
            budgetItems = budgetItems,
            payments = payments,
            contracts = contracts,
            documents = documents,
        )
    }
}
