package pro.wewed.app.services

import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8.
 *
 * Talks to the native-safe mature-domain endpoints under `/api/native/wedding`, `/api/native/vendor`
 * and `/api/native/admin` (server: `backend/native-workspace-parity-phase8-20260922`). Every call re-validates the caller's
 * fresh production-authority grant server-side; this client passes only `grantId` (a selection
 * hint, exactly like `ProductionAuthorityClient.fetchWorkspace`) and never a weddingId/
 * businessAccountId directly. Reuses [WeddingDayHttpTransport] — the same injectable, already
 * fake-transport-testable HTTP seam [ProductionAuthorityClient] uses — rather than a second HTTP
 * stack.
 */

sealed interface NativeDomainFetch<out T> {
    data class Success<T>(val value: T) : NativeDomainFetch<T>
    object SessionInvalid : NativeDomainFetch<Nothing>
    object GrantRevoked : NativeDomainFetch<Nothing>
    object Forbidden : NativeDomainFetch<Nothing>
    data class Transport(val status: Int) : NativeDomainFetch<Nothing>
}

class NativeDomainApiClient(
    private val transport: WeddingDayHttpTransport,
    private val onSessionInvalid: () -> Unit = {},
    private val onGrantRevoked: (String) -> Unit = {},
) {
    private fun <T> statusToFetch(status: Int, rawBody: String, grantId: String): NativeDomainFetch<T>? {
        val code = runCatching { JSONObject(rawBody).optString("code") }.getOrDefault("")
        val result: NativeDomainFetch<T>? = when {
            status == 401 -> NativeDomainFetch.SessionInvalid
            status == 403 && (code == "GRANT_REVOKED" || code == "AUTHORITY_UNAVAILABLE") ->
                NativeDomainFetch.GrantRevoked
            status == 403 -> NativeDomainFetch.Forbidden
            status == 404 -> NativeDomainFetch.Transport(status)
            status !in 200..299 -> NativeDomainFetch.Transport(status)
            else -> null
        }
        when (result) {
            is NativeDomainFetch.SessionInvalid -> onSessionInvalid()
            is NativeDomainFetch.GrantRevoked -> onGrantRevoked(grantId)
            else -> Unit
        }
        return result
    }

    private suspend fun get(path: String, sessionToken: String, grantId: String, extraQuery: String = ""): Pair<Int, String> {
        val encodedGrant = URLEncoder.encode(grantId, Charsets.UTF_8.name())
        val response = transport.get(
            "$path?grantId=$encodedGrant$extraQuery",
            mapOf("Authorization" to "Bearer $sessionToken"),
        )
        return response.status to response.body
    }

    private suspend fun post(path: String, sessionToken: String, grantId: String, body: String): Pair<Int, String> {
        val encodedGrant = URLEncoder.encode(grantId, Charsets.UTF_8.name())
        val response = transport.post(
            "$path?grantId=$encodedGrant",
            mapOf("Authorization" to "Bearer $sessionToken", "Content-Type" to "application/json"),
            body,
        )
        return response.status to response.body
    }

    private suspend fun patch(path: String, sessionToken: String, grantId: String, body: String): Pair<Int, String> {
        val encodedGrant = URLEncoder.encode(grantId, Charsets.UTF_8.name())
        val response = transport.patch(
            "$path?grantId=$encodedGrant",
            mapOf("Authorization" to "Bearer $sessionToken", "Content-Type" to "application/json"),
            body,
        )
        return response.status to response.body
    }

    suspend fun overview(sessionToken: String, grantId: String): NativeDomainFetch<JSONObject> =
        runGet("api/native/wedding/overview", sessionToken, grantId)

    suspend fun tasks(sessionToken: String, grantId: String): NativeDomainFetch<JSONArray> =
        runGetArray("api/native/wedding/tasks", sessionToken, grantId, "data")

    suspend fun createTask(sessionToken: String, grantId: String, body: JSONObject): NativeDomainFetch<JSONObject> =
        runPost("api/native/wedding/tasks", sessionToken, grantId, body.toString(), "data")

    suspend fun updateTask(sessionToken: String, grantId: String, taskId: String, body: JSONObject): NativeDomainFetch<JSONObject> {
        val (status, raw) = patch("api/native/wedding/tasks/$taskId", sessionToken, grantId, body.toString())
        statusToFetch<JSONObject>(status, raw, grantId)?.let { return it }
        return runCatching { NativeDomainFetch.Success(JSONObject(raw).getJSONObject("data")) }
            .getOrElse { NativeDomainFetch.Transport(status) }
    }

    suspend fun budget(sessionToken: String, grantId: String): NativeDomainFetch<JSONObject> =
        runGet("api/native/wedding/budget", sessionToken, grantId)

    suspend fun guests(sessionToken: String, grantId: String, query: String = ""): NativeDomainFetch<JSONArray> =
        runGetArray("api/native/wedding/guests", sessionToken, grantId, "data", extraQuery = if (query.isNotBlank()) "&q=${URLEncoder.encode(query, Charsets.UTF_8.name())}" else "")

    suspend fun seating(sessionToken: String, grantId: String): NativeDomainFetch<JSONArray> =
        runGetArray("api/native/wedding/seating", sessionToken, grantId, "data")

    suspend fun timeline(sessionToken: String, grantId: String): NativeDomainFetch<JSONArray> =
        runGetArray("api/native/wedding/timeline", sessionToken, grantId, "data")

    suspend fun vendors(sessionToken: String, grantId: String): NativeDomainFetch<JSONArray> =
        runGetArray("api/native/wedding/vendors", sessionToken, grantId, "data")

    suspend fun vendorBusiness(sessionToken: String, grantId: String): NativeDomainFetch<JSONObject> =
        runGet("api/native/vendor/business", sessionToken, grantId)

    suspend fun vendorCatalog(sessionToken: String, grantId: String): NativeDomainFetch<JSONObject> =
        runGet("api/native/vendor/catalog", sessionToken, grantId)

    suspend fun vendorBookings(sessionToken: String, grantId: String): NativeDomainFetch<JSONArray> =
        runGetArray("api/native/vendor/bookings", sessionToken, grantId, "data")

    suspend fun adminOverview(sessionToken: String, grantId: String): NativeDomainFetch<JSONObject> =
        runGet("api/native/admin/overview", sessionToken, grantId)

    suspend fun contributions(sessionToken: String, grantId: String): NativeDomainFetch<JSONObject> =
        runGet("api/native/wedding/contributions", sessionToken, grantId)

    suspend fun vault(sessionToken: String, grantId: String): NativeDomainFetch<JSONArray> =
        runGetArray("api/native/wedding/vault", sessionToken, grantId, "data")

    private suspend fun runGet(path: String, sessionToken: String, grantId: String, extraQuery: String = ""): NativeDomainFetch<JSONObject> {
        val (status, body) = runCatching { get(path, sessionToken, grantId, extraQuery) }
            .getOrElse { return NativeDomainFetch.Transport(-1) }
        statusToFetch<JSONObject>(status, body, grantId)?.let { return it }
        return runCatching { NativeDomainFetch.Success(JSONObject(body)) }
            .getOrElse { NativeDomainFetch.Transport(status) }
    }

    private suspend fun runGetArray(path: String, sessionToken: String, grantId: String, arrayField: String, extraQuery: String = ""): NativeDomainFetch<JSONArray> {
        val (status, body) = runCatching { get(path, sessionToken, grantId, extraQuery) }
            .getOrElse { return NativeDomainFetch.Transport(-1) }
        statusToFetch<JSONArray>(status, body, grantId)?.let { return it }
        return runCatching { NativeDomainFetch.Success(JSONObject(body).getJSONArray(arrayField)) }
            .getOrElse { NativeDomainFetch.Transport(status) }
    }

    private suspend fun runPost(path: String, sessionToken: String, grantId: String, requestBody: String, resultField: String): NativeDomainFetch<JSONObject> {
        val (status, body) = runCatching { post(path, sessionToken, grantId, requestBody) }
            .getOrElse { return NativeDomainFetch.Transport(-1) }
        statusToFetch<JSONObject>(status, body, grantId)?.let { return it }
        return runCatching { NativeDomainFetch.Success(JSONObject(body).getJSONObject(resultField)) }
            .getOrElse { NativeDomainFetch.Transport(status) }
    }
}

fun JSONArray.toObjectList(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
