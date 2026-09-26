package pro.wewed.app.services

import org.json.JSONObject

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §A.
 *
 * Real production adapter for a `vendor:business:...` grant (a Vendor business-portfolio identity
 * with no wedding ActorAssignment — see `RootScreen`'s early "portfolio/business authority" branch).
 * This is NOT the wedding graph: it reads `/api/native/vendor/{business,catalog,bookings}` only.
 * F-3 remains binding — nothing here infers or fabricates a wedding-scoped Vendor relationship;
 * that stays gated entirely by whatever real `vendor:wedding:...` grant (if any) the account
 * separately holds, unrelated to this business-scoped repository.
 */
data class VendorBusinessIdentity(
    val businessAccountId: String,
    val businessName: String,
    val businessType: String,
    val businessStatus: String,
    val onboardingStatus: String,
    val role: String,
)

data class VendorCatalogItem(
    val id: String,
    val name: String,
    val category: String,
    val status: String,
    val bookingMode: String,
    val basePriceCents: Long?,
    val currency: String,
)

data class VendorCatalogOffering(
    val id: String,
    val category: String,
    val displayName: String,
    val status: String,
)

data class VendorBooking(
    val id: String,
    val publicReference: String,
    val status: String,
    val weddingTitle: String?,
    val category: String?,
    val totalCents: Long?,
    val currency: String?,
    val eventDate: String?,
)

sealed interface VendorBusinessFetch<out T> {
    data class Success<T>(val value: T) : VendorBusinessFetch<T>
    object Unavailable : VendorBusinessFetch<Nothing>
}

interface VendorBusinessRepository {
    suspend fun getBusinessIdentity(): VendorBusinessFetch<VendorBusinessIdentity>
    suspend fun getCatalogItems(): VendorBusinessFetch<List<VendorCatalogItem>>
    suspend fun getCatalogOfferings(): VendorBusinessFetch<List<VendorCatalogOffering>>
    suspend fun getBookings(): VendorBusinessFetch<List<VendorBooking>>
}

class ProductionVendorBusinessRepository(
    private val client: NativeDomainApiClient,
    private val sessionToken: String,
    private val grantId: String,
) : VendorBusinessRepository {

    override suspend fun getBusinessIdentity(): VendorBusinessFetch<VendorBusinessIdentity> {
        val root = when (val fetch = client.vendorBusiness(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> return VendorBusinessFetch.Unavailable
        }
        val business = root.optJSONObject("business") ?: return VendorBusinessFetch.Unavailable
        return VendorBusinessFetch.Success(
            VendorBusinessIdentity(
                businessAccountId = business.getString("businessAccountId"),
                businessName = business.optString("businessName"),
                businessType = business.optString("businessType"),
                businessStatus = business.optString("businessStatus"),
                onboardingStatus = business.optString("onboardingStatus"),
                role = business.optString("role"),
            ),
        )
    }

    private suspend fun catalogRoot(): JSONObject? =
        when (val fetch = client.vendorCatalog(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value.optJSONObject("data")
            else -> null
        }

    override suspend fun getCatalogItems(): VendorBusinessFetch<List<VendorCatalogItem>> {
        val data = catalogRoot() ?: return VendorBusinessFetch.Unavailable
        val items = data.optJSONArray("items")?.toObjectList().orEmpty().map { item ->
            VendorCatalogItem(
                id = item.getString("id"),
                name = item.optString("name"),
                category = item.optString("category"),
                status = item.optString("status"),
                bookingMode = item.optString("bookingMode"),
                basePriceCents = if (item.has("basePriceCents") && !item.isNull("basePriceCents")) item.optLong("basePriceCents") else null,
                currency = item.optString("currency", "USD"),
            )
        }
        return VendorBusinessFetch.Success(items)
    }

    override suspend fun getCatalogOfferings(): VendorBusinessFetch<List<VendorCatalogOffering>> {
        val data = catalogRoot() ?: return VendorBusinessFetch.Unavailable
        val offerings = data.optJSONArray("offerings")?.toObjectList().orEmpty().map { offering ->
            VendorCatalogOffering(
                id = offering.getString("id"),
                category = offering.optString("category"),
                displayName = offering.optString("displayName"),
                status = offering.optString("status"),
            )
        }
        return VendorBusinessFetch.Success(offerings)
    }

    override suspend fun getBookings(): VendorBusinessFetch<List<VendorBooking>> {
        val array = when (val fetch = client.vendorBookings(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> return VendorBusinessFetch.Unavailable
        }
        val bookings = array.toObjectList().map { booking ->
            VendorBooking(
                id = booking.getString("id"),
                publicReference = booking.optString("publicReference"),
                status = booking.optString("status"),
                weddingTitle = booking.optString("weddingTitle").takeIf { !booking.isNull("weddingTitle") && it.isNotBlank() },
                category = booking.optString("category").takeIf { !booking.isNull("category") && it.isNotBlank() },
                totalCents = if (booking.has("totalCents") && !booking.isNull("totalCents")) booking.optLong("totalCents") else null,
                currency = booking.optString("currency").takeIf { !booking.isNull("currency") && it.isNotBlank() },
                eventDate = booking.optString("eventDate").takeIf { !booking.isNull("eventDate") && it.isNotBlank() },
            )
        }
        return VendorBusinessFetch.Success(bookings)
    }
}
