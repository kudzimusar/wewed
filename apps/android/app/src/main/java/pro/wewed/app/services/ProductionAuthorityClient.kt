package pro.wewed.app.services

import org.json.JSONObject
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
}
