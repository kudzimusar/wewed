package pro.wewed.app.services

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §A/§13.
 *
 * `ProductionVendorBusinessRepository` against a fake transport: proves the real business-scoped
 * Vendor adapter calls `/api/native/vendor/{business,catalog,bookings}` — never the wedding graph
 * — maps real rows without fabrication, and reports UNAVAILABLE (not an invented empty catalog)
 * when a call fails.
 */
class ProductionVendorBusinessRepositoryTest {

    private class FakeTransport(private val responses: Map<String, WeddingDayHttpResponse>) : WeddingDayHttpTransport {
        override suspend fun get(path: String, headers: Map<String, String>): WeddingDayHttpResponse =
            responses[path.substringBefore('?')] ?: WeddingDayHttpResponse(503, "")
        override suspend fun post(path: String, headers: Map<String, String>, body: String): WeddingDayHttpResponse =
            WeddingDayHttpResponse(503, "")
    }

    private val grantId = "vendor:business:biz-1"
    private val token = "test-session-token"

    @Test
    fun `business identity, catalog and bookings map real rows`() = runBlocking {
        val transport = FakeTransport(
            mapOf(
                "api/native/vendor/business" to WeddingDayHttpResponse(200, """
                    {"success":true,"business":{"businessAccountId":"biz-1","businessName":"Shandy Events","businessType":"vendor","businessStatus":"active","onboardingStatus":"complete","role":"business_owner"}}
                """.trimIndent()),
                "api/native/vendor/catalog" to WeddingDayHttpResponse(200, """
                    {"success":true,"data":{"businessAccountId":"biz-1","offerings":[{"id":"off-1","category":"decor","displayName":"Decor","status":"published"}],"items":[{"id":"item-1","name":"Floral Arch","category":"decor","status":"published","bookingMode":"request","basePriceCents":50000,"currency":"USD"}]}}
                """.trimIndent()),
                "api/native/vendor/bookings" to WeddingDayHttpResponse(200, """
                    {"success":true,"count":1,"data":[{"id":"bk-1","publicReference":"WW-BKG-1","status":"confirmed","weddingTitle":"A & B","category":"decor","totalCents":50000,"currency":"USD","eventDate":"2027-01-01"}]}
                """.trimIndent()),
            ),
        )
        val repo = ProductionVendorBusinessRepository(NativeDomainApiClient(transport), token, grantId)

        val identity = repo.getBusinessIdentity()
        assertTrue(identity is VendorBusinessFetch.Success)
        assertEquals("Shandy Events", (identity as VendorBusinessFetch.Success).value.businessName)

        val catalog = repo.getCatalogItems()
        assertTrue(catalog is VendorBusinessFetch.Success)
        assertEquals("Floral Arch", (catalog as VendorBusinessFetch.Success).value.first().name)

        val offerings = repo.getCatalogOfferings()
        assertTrue(offerings is VendorBusinessFetch.Success)
        assertEquals("decor", (offerings as VendorBusinessFetch.Success).value.first().category)

        val bookings = repo.getBookings()
        assertTrue(bookings is VendorBusinessFetch.Success)
        assertEquals("WW-BKG-1", (bookings as VendorBusinessFetch.Success).value.first().publicReference)
    }

    @Test
    fun `a failed call reports Unavailable, never an invented empty result`() = runBlocking {
        val repo = ProductionVendorBusinessRepository(NativeDomainApiClient(FakeTransport(emptyMap())), token, grantId)
        assertTrue(repo.getBusinessIdentity() is VendorBusinessFetch.Unavailable)
        assertTrue(repo.getCatalogItems() is VendorBusinessFetch.Unavailable)
        assertTrue(repo.getBookings() is VendorBusinessFetch.Unavailable)
    }
}
