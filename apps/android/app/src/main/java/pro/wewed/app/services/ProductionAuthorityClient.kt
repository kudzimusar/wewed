package pro.wewed.app.services

import org.json.JSONObject
import java.net.URLEncoder
import pro.wewed.app.navigation.ProductionAuthority
import pro.wewed.app.navigation.ProductionAuthorityDecoder

/**
 * Native account identity + production authority client — master plan Phase 5.
 *
 * Talks to exactly the two Phase-5 server endpoints:
 *  - `POST /api/native/account/signin` — verifies email/password against Supabase, returns an
 *    opaque identity session. It proves identity only; it grants no role or wedding.
 *  - `GET /api/native/account/authority` — `Authorization: Bearer <session>`, returns
 *    `WewedProductionAuthorityV1` as-is. Every call re-resolves the account's real grants; nothing
 *    from a prior call is trusted.
 *
 * Deliberately reuses [WeddingDayHttpTransport] rather than a near-identical interface: it is
 * already a plain, injectable get/post-with-headers seam with nothing Wedding-Day specific in its
 * shape, and it is the one HTTP abstraction the app already tests against a fake transport.
 */

data class ProductionWeddingSummary(
    val id: String,
    val slug: String,
    val title: String,
    val date: String,
    val venue: String,
    val venueCity: String,
    val venueCountry: String,
    val lifecycle: String,
    val coupleNames: String,
)

data class ProductionWorkspaceSnapshot(
    val grantId: String,
    val workspaceKind: String,
    val scopeKind: String,
    val weddingId: String?,
    val weddingTitle: String?,
    val businessAccountId: String?,
    val businessName: String?,
    val vendorId: String?,
    val serviceEngagementIds: List<String>,
    val permissions: List<String>,
    val platformRoles: List<String>,
    val wedding: ProductionWeddingSummary?,
)

sealed interface ProductionWorkspaceFetch {
    data class Success(val workspace: ProductionWorkspaceSnapshot) : ProductionWorkspaceFetch
    object SessionInvalid : ProductionWorkspaceFetch
    object GrantRevoked : ProductionWorkspaceFetch
    data class Transport(val status: Int) : ProductionWorkspaceFetch
}

sealed interface NativeAccountSignInOutcome {
    data class Success(val sessionToken: String) : NativeAccountSignInOutcome
    object InvalidCredentials : NativeAccountSignInOutcome
    data class Transport(val status: Int) : NativeAccountSignInOutcome
}

sealed interface ProductionAuthorityFetch {
    data class Success(val authority: ProductionAuthority) : ProductionAuthorityFetch
    /** The stored identity session itself is no longer valid; the caller must clear it. */
    object SessionInvalid : ProductionAuthorityFetch
    data class Transport(val status: Int) : ProductionAuthorityFetch
}

class ProductionAuthorityClient(
    private val transport: WeddingDayHttpTransport
) {
    suspend fun signIn(email: String, password: String): NativeAccountSignInOutcome {
        val body = JSONObject().put("email", email).put("password", password).toString()
        val response = runCatching {
            transport.post(
                "api/native/account/signin",
                mapOf("Content-Type" to "application/json"),
                body,
            )
        }.getOrElse { return NativeAccountSignInOutcome.Transport(-1) }

        if (response.status == 400 || response.status == 401) {
            return NativeAccountSignInOutcome.InvalidCredentials
        }
        if (response.status !in 200..299) return NativeAccountSignInOutcome.Transport(response.status)

        val sessionToken = runCatching {
            JSONObject(response.body).optString("sessionToken").takeIf { it.isNotBlank() }
        }.getOrNull() ?: return NativeAccountSignInOutcome.Transport(response.status)

        return NativeAccountSignInOutcome.Success(sessionToken)
    }

    suspend fun fetchAuthority(sessionToken: String): ProductionAuthorityFetch {
        val response = runCatching {
            transport.get(
                "api/native/account/authority",
                mapOf("Authorization" to "Bearer $sessionToken"),
            )
        }.getOrElse { return ProductionAuthorityFetch.Transport(-1) }

        if (response.status == 401) return ProductionAuthorityFetch.SessionInvalid
        if (response.status !in 200..299) return ProductionAuthorityFetch.Transport(response.status)

        val authorityJson = runCatching { JSONObject(response.body).optJSONObject("authority") }
            .getOrNull() ?: return ProductionAuthorityFetch.Transport(response.status)
        val authority = ProductionAuthorityDecoder.decode(authorityJson.toString())
            ?: return ProductionAuthorityFetch.Transport(response.status)

        return ProductionAuthorityFetch.Success(authority)
    }
    suspend fun fetchWorkspace(sessionToken: String, grantId: String): ProductionWorkspaceFetch {
        val encodedGrant = URLEncoder.encode(grantId, Charsets.UTF_8.name())
        val response = runCatching {
            transport.get(
                "api/native/account/workspace?grantId=$encodedGrant",
                mapOf("Authorization" to "Bearer $sessionToken"),
            )
        }.getOrElse { return ProductionWorkspaceFetch.Transport(-1) }

        if (response.status == 401) return ProductionWorkspaceFetch.SessionInvalid
        if (response.status == 403 || response.status == 404) return ProductionWorkspaceFetch.GrantRevoked
        if (response.status !in 200..299) return ProductionWorkspaceFetch.Transport(response.status)

        return runCatching {
            val root = JSONObject(response.body).getJSONObject("workspace")
            val weddingJson = root.optJSONObject("wedding")
            val wedding = weddingJson?.let {
                ProductionWeddingSummary(
                    id = it.getString("id"),
                    slug = it.getString("slug"),
                    title = it.getString("title"),
                    date = it.getString("date"),
                    venue = it.getString("venue"),
                    venueCity = it.getString("venueCity"),
                    venueCountry = it.getString("venueCountry"),
                    lifecycle = it.getString("lifecycle"),
                    coupleNames = it.getString("coupleNames"),
                )
            }
            ProductionWorkspaceFetch.Success(
                ProductionWorkspaceSnapshot(
                    grantId = root.getString("grantId"),
                    workspaceKind = root.getString("workspaceKind"),
                    scopeKind = root.getString("scopeKind"),
                    weddingId = root.optString("weddingId").takeIf { !root.isNull("weddingId") && it.isNotBlank() },
                    weddingTitle = root.optString("weddingTitle").takeIf { !root.isNull("weddingTitle") && it.isNotBlank() },
                    businessAccountId = root.optString("businessAccountId").takeIf { !root.isNull("businessAccountId") && it.isNotBlank() },
                    businessName = root.optString("businessName").takeIf { !root.isNull("businessName") && it.isNotBlank() },
                    vendorId = root.optString("vendorId").takeIf { !root.isNull("vendorId") && it.isNotBlank() },
                    serviceEngagementIds = root.getJSONArray("serviceEngagementIds").let { array ->
                        (0 until array.length()).map { array.getString(it) }
                    },
                    permissions = root.getJSONArray("permissions").let { array ->
                        (0 until array.length()).map { array.getString(it) }
                    },
                    platformRoles = root.getJSONArray("platformRoles").let { array ->
                        (0 until array.length()).map { array.getString(it) }
                    },
                    wedding = wedding,
                )
            )
        }.getOrElse { ProductionWorkspaceFetch.Transport(response.status) }
    }

}
