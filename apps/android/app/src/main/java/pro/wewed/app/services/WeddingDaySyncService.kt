package pro.wewed.app.services

import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class WeddingDayHttpResponse(val status: Int, val body: String)

interface WeddingDayHttpTransport {
    suspend fun get(path: String, headers: Map<String, String>): WeddingDayHttpResponse
    suspend fun post(path: String, headers: Map<String, String>, body: String): WeddingDayHttpResponse

    /**
     * Master plan Phase 8 — added for `NativeDomainApiClient`'s task-update call. Defaulted so the
     * existing fake transports in `SessionAccountAuthorityTest`/`MultiContextIsolationTest`, which
     * never exercise PATCH, need no change; only a caller that actually invokes it must override.
     */
    suspend fun patch(path: String, headers: Map<String, String>, body: String): WeddingDayHttpResponse =
        throw UnsupportedOperationException("patch is not implemented by this transport")
}

class UrlConnectionWeddingDayTransport(private val baseUrl: String) : WeddingDayHttpTransport {
    override suspend fun get(path: String, headers: Map<String, String>): WeddingDayHttpResponse =
        execute("GET", path, headers, null)

    override suspend fun post(path: String, headers: Map<String, String>, body: String): WeddingDayHttpResponse =
        execute("POST", path, headers, body)

    override suspend fun patch(path: String, headers: Map<String, String>, body: String): WeddingDayHttpResponse =
        execute("PATCH", path, headers, body)

    private suspend fun execute(
        method: String,
        path: String,
        headers: Map<String, String>,
        body: String?
    ): WeddingDayHttpResponse = withContext(Dispatchers.IO) {
        val connection = URL(baseUrl.trimEnd('/') + "/" + path.trimStart('/')).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            headers.forEach { (key, value) -> connection.setRequestProperty(key, value) }
            if (body != null) {
                connection.doOutput = true
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val responseBody = stream?.bufferedReader()?.use { it.readText() } ?: ""
            WeddingDayHttpResponse(status, responseBody)
        } finally {
            connection.disconnect()
        }
    }
}

sealed class WeddingDaySyncException(message: String) : Exception(message) {
    class ServerRejected(val status: Int) : WeddingDaySyncException("Wedding Day server rejected request: $status")
    object InvalidResponse : WeddingDaySyncException("Invalid Wedding Day response")
    object ManifestSignatureInvalid : WeddingDaySyncException("Wedding Day manifest root signature is invalid")
    object ManifestVersionUnsupported : WeddingDaySyncException("Wedding Day manifest version is unsupported")
    object ManifestWeddingMismatch : WeddingDaySyncException("Wedding Day manifest belongs to another wedding")
    object ManifestExpired : WeddingDaySyncException("Wedding Day manifest has expired")
    object RootKeyMismatch : WeddingDaySyncException("Wedding Day root key id does not match trusted configuration")
    object PassNotInManifest : WeddingDaySyncException("Pass is not present in the verified manifest")
    object PassMetadataMismatch : WeddingDaySyncException("Pass metadata does not match the verified manifest")
    object PassIneligible : WeddingDaySyncException("Pass is revoked, expired, or not eligible")
    object SigningKeyUnavailable : WeddingDaySyncException("Pass signing key is unavailable")
    object SigningKeyInactive : WeddingDaySyncException("Pass signing key is inactive")
    object PassSignatureInvalid : WeddingDaySyncException("Pass signature is invalid")
}

data class WeddingDaySyncResult(
    val syncedIds: List<String>,
    val failedIds: List<String>,
    val blockedLegacyIds: List<String>
)

private data class ManifestApiEnvelope(
    val success: Boolean,
    val data: SignedManifestApiData
)

private data class SignedManifestApiData(
    val rootKeyId: String,
    val algorithm: String,
    val canonicalPayload: String,
    val signatureHex: String
)

private data class NativeManifestPayload(
    val manifestVersion: Int,
    val tokenVersion: String,
    val weddingId: String,
    val weddingSlug: String,
    val weddingShortId: String,
    val eventKey: String,
    val generatedAt: String,
    val expiresAt: String,
    val keys: List<WeddingDayManifestKey>,
    val credentials: List<NativeManifestCredential>
)

private data class NativeManifestCredential(
    val guestId: String,
    val guestName: String,
    val tableNumber: Int?,
    val passSerial: String,
    val nonce: String,
    val eventBitmask: Int,
    val keyId: String,
    val eligible: Boolean,
    val household: List<NativeManifestHouseholdMember>,
    val partySize: Int,
    val checkedInAttendeeKeys: List<String>,
    val issuedAt: String,
    val expiresAt: String?,
    val revokedAt: String?
)

private data class NativeManifestHouseholdMember(
    val attendeeKey: String,
    val attendeeKind: String,
    val attendeeName: String
)

class WeddingDaySyncService(
    private val transport: WeddingDayHttpTransport,
    private val trustedRootPublicKeyDerBase64: String,
    private val trustedRootKeyId: String? = null,
    private val gson: Gson = Gson()
) {
    suspend fun downloadAndCacheManifest(
        bearerToken: String,
        expectedWeddingId: String,
        offlineStore: OfflineManifestStoreProtocol,
        trustStore: WeddingDayManifestTrustStore
    ): VerifiedWeddingDayManifestTrust {
        val response = transport.get(
            "/api/wedding-day/manifest",
            mapOf(
                "Authorization" to "Bearer $bearerToken",
                "Accept" to "application/json"
            )
        )
        if (response.status !in 200..299) throw WeddingDaySyncException.ServerRejected(response.status)

        val envelope = try {
            gson.fromJson(response.body, ManifestApiEnvelope::class.java)
        } catch (_: Exception) {
            throw WeddingDaySyncException.InvalidResponse
        }
        if (!envelope.success) throw WeddingDaySyncException.InvalidResponse
        if (trustedRootKeyId != null && envelope.data.rootKeyId != trustedRootKeyId) {
            throw WeddingDaySyncException.RootKeyMismatch
        }
        if (!TokenVerifier.verifyP1363(
                envelope.data.canonicalPayload,
                envelope.data.signatureHex,
                trustedRootPublicKeyDerBase64
            )
        ) {
            throw WeddingDaySyncException.ManifestSignatureInvalid
        }

        val payload = try {
            gson.fromJson(envelope.data.canonicalPayload, NativeManifestPayload::class.java)
        } catch (_: Exception) {
            throw WeddingDaySyncException.InvalidResponse
        }
        if (payload.manifestVersion != 2 || payload.tokenVersion != "WW2") {
            throw WeddingDaySyncException.ManifestVersionUnsupported
        }
        if (payload.weddingId != expectedWeddingId) {
            throw WeddingDaySyncException.ManifestWeddingMismatch
        }
        if (isExpired(payload.expiresAt)) {
            throw WeddingDaySyncException.ManifestExpired
        }

        val trust = VerifiedWeddingDayManifestTrust(
            weddingId = payload.weddingId,
            weddingShortId = payload.weddingShortId,
            eventKey = payload.eventKey,
            generatedAt = payload.generatedAt,
            expiresAt = payload.expiresAt,
            rootKeyId = envelope.data.rootKeyId,
            keys = payload.keys
        )
        val items = payload.credentials.map { credential ->
            GuestManifestItem(
                id = credential.guestId,
                serial = credential.passSerial,
                guestName = credential.guestName,
                partySize = credential.household.size,
                checkedInCount = credential.checkedInAttendeeKeys.size,
                tableAssignment = credential.tableNumber?.let { "Table $it" },
                eventBitmask = credential.eventBitmask,
                signingKeyId = credential.keyId,
                nonce = credential.nonce,
                attendeeKeys = credential.household.map { it.attendeeKey },
                checkedInAttendeeKeys = credential.checkedInAttendeeKeys,
                eligible = credential.eligible,
                expiresAt = credential.expiresAt,
                revokedAt = credential.revokedAt
            )
        }

        trustStore.save(trust)
        offlineStore.saveManifest(payload.weddingId, items)
        return trust
    }

    suspend fun verifyOfflinePass(
        token: String,
        weddingId: String,
        requiredEventBit: Int = 0x04,
        offlineStore: OfflineManifestStoreProtocol,
        trustStore: WeddingDayManifestTrustStore
    ): GuestManifestItem {
        val trust = trustStore.manifest(weddingId)
            ?: throw WeddingDaySyncException.SigningKeyUnavailable
        if (isExpired(trust.expiresAt)) throw WeddingDaySyncException.ManifestExpired

        val parsed = when (val result = TokenVerifier.parse(token)) {
            is TokenVerificationResult.Success -> result.token
            is TokenVerificationResult.Failure -> throw WeddingDaySyncException.PassSignatureInvalid
        }
        if (parsed.version != "WW2" || parsed.weddingShortId != trust.weddingShortId) {
            throw WeddingDaySyncException.PassMetadataMismatch
        }

        val item = offlineStore.lookupBySerial(weddingId, parsed.passSerial)
            ?: throw WeddingDaySyncException.PassNotInManifest
        if (!item.eligible || item.revokedAt != null || isExpired(item.expiresAt)) {
            throw WeddingDaySyncException.PassIneligible
        }
        if ((item.nonce != null && item.nonce != parsed.nonce) ||
            item.eventBitmask != parsed.eventBitmask ||
            item.signingKeyId == null
        ) {
            throw WeddingDaySyncException.PassMetadataMismatch
        }

        val key = trustStore.signingKey(weddingId, item.signingKeyId)
            ?: throw WeddingDaySyncException.SigningKeyUnavailable
        if (!key.status.equals("active", ignoreCase = true) || key.revokedAt != null || isExpired(key.expiresAt)) {
            throw WeddingDaySyncException.SigningKeyInactive
        }

        return when (TokenVerifier.verifyAsymmetric(token, key.publicKeyDerBase64, requiredEventBit)) {
            is TokenVerificationResult.Success -> item
            is TokenVerificationResult.Failure -> throw WeddingDaySyncException.PassSignatureInvalid
        }
    }

    suspend fun syncPendingCheckIns(
        bearerToken: String,
        weddingId: String,
        gateId: String? = null,
        offlineStore: OfflineManifestStoreProtocol,
        trustStore: WeddingDayManifestTrustStore
    ): WeddingDaySyncResult {
        val trust = trustStore.manifest(weddingId)
            ?: return WeddingDaySyncResult(emptyList(), emptyList(), emptyList())
        val pending = offlineStore.getPendingCheckIns(weddingId)
        val synced = mutableListOf<String>()
        val failed = mutableListOf<String>()
        val legacy = mutableListOf<String>()

        for (record in pending) {
            if (record.attendeeKeys.isEmpty()) {
                // Never reinterpret a legacy count-only event as "admit whole household".
                legacy += record.id
                continue
            }
            val body = linkedMapOf<String, Any>(
                "guestId" to record.guestId,
                "attendeeKeys" to record.attendeeKeys,
                "source" to "offline-sync",
                "clientEventId" to record.id,
                "eventKey" to trust.eventKey
            )
            if (gateId != null) body["gateId"] = gateId
            if (record.deviceId != null) body["deviceId"] = record.deviceId

            try {
                val response = transport.post(
                    "/api/wedding-day/check-in",
                    mapOf(
                        "Authorization" to "Bearer $bearerToken",
                        "Content-Type" to "application/json",
                        "Accept" to "application/json"
                    ),
                    gson.toJson(body)
                )
                if (response.status in 200..299) {
                    offlineStore.markCheckInSynced(record.id)
                    synced += record.id
                } else {
                    failed += record.id
                }
            } catch (_: Exception) {
                failed += record.id
            }
        }

        return WeddingDaySyncResult(synced, failed, legacy)
    }

    private fun isExpired(value: String?): Boolean {
        if (value.isNullOrBlank()) return false
        return parseIsoDate(value)?.let { it.time <= System.currentTimeMillis() } ?: false
    }

    private fun parseIsoDate(value: String): Date? {
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSSX",
            "yyyy-MM-dd'T'HH:mm:ssX"
        )
        for (pattern in patterns) {
            try {
                val formatter = SimpleDateFormat(pattern, Locale.US)
                formatter.timeZone = TimeZone.getTimeZone("UTC")
                formatter.isLenient = false
                val parsed = formatter.parse(value)
                if (parsed != null) return parsed
            } catch (_: Exception) {
                // Try the next ISO-8601 representation.
            }
        }
        return null
    }
}
