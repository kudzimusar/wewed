package pro.wewed.app.services

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class WeddingDayManifestKey(
    val keyId: String,
    val algorithm: String,
    val publicKeyDerBase64: String,
    val status: String,
    val activeFrom: String,
    val expiresAt: String? = null,
    val revokedAt: String? = null
)

data class VerifiedWeddingDayManifestTrust(
    val weddingId: String,
    val weddingShortId: String,
    val eventKey: String,
    val generatedAt: String,
    val expiresAt: String,
    val rootKeyId: String,
    val keys: List<WeddingDayManifestKey>
)

/**
 * LQR01 — observability of the cached offline authority a Gate device is admitting against.
 *
 * Offline admission is checked against the last root-verified manifest this device downloaded, so a
 * revocation made after [generatedAt] is invisible until the next refresh. This makes that age
 * visible to the usher. It is deliberately observability only: [isStale] never blocks admission and
 * the manifest's own expiry (enforced by [WeddingDaySyncService.verifyOfflinePass]) is unchanged.
 */
data class WeddingDayAuthorityStatus(
    val generatedAt: Date,
    val expiresAt: Date,
    val ageSeconds: Long,
    val isStale: Boolean,
    val isExpired: Boolean,
    val relyingOnCachedAuthority: Boolean = true
) {
    /** e.g. "Offline authority · generated 09:00 · expires 21:00 · age 3h (stale)". */
    fun summaryLine(timeZone: TimeZone = TimeZone.getDefault()): String {
        val clock = SimpleDateFormat("HH:mm", Locale.US).apply { this.timeZone = timeZone }
        val age = if (ageSeconds >= 3_600L) "${ageSeconds / 3_600L}h" else "${ageSeconds / 60L}m"
        val qualifier = when {
            isExpired -> " (expired)"
            isStale -> " (stale)"
            else -> ""
        }
        return "Offline authority · generated ${clock.format(generatedAt)} · " +
            "expires ${clock.format(expiresAt)} · age $age$qualifier"
    }

    companion object {
        /** Age after which cached authority is flagged stale. Observability only — not a TTL. */
        const val STALE_AFTER_SECONDS: Long = 2L * 60L * 60L

        const val CACHED_AUTHORITY_NOTICE =
            "Admission is being checked against this device's cached list; revocations made after " +
                "it was generated are not visible until refresh."

        fun from(trust: VerifiedWeddingDayManifestTrust, now: Long): WeddingDayAuthorityStatus? {
            val generated = parseWeddingDayIsoDate(trust.generatedAt) ?: return null
            val expires = parseWeddingDayIsoDate(trust.expiresAt) ?: return null
            val age = maxOf(0L, (now - generated.time) / 1_000L)
            return WeddingDayAuthorityStatus(
                generatedAt = generated,
                expiresAt = expires,
                ageSeconds = age,
                isStale = age >= STALE_AFTER_SECONDS,
                isExpired = expires.time <= now
            )
        }
    }
}

/**
 * Persistent cache containing only manifest metadata whose root signature has already been
 * verified. Pass-signing public keys therefore survive process death and support key rotation
 * without ever placing a private signing key on an usher device.
 */
class WeddingDayManifestTrustStore(
    private val storageDir: File? = null,
    private val gson: Gson = Gson()
) {
    private val mutex = Mutex()
    private val manifests = mutableMapOf<String, VerifiedWeddingDayManifestTrust>()
    private val file: File? = storageDir?.let { File(it, "wewed_wedding_day_trust.json") }

    init {
        load()
    }

    suspend fun save(manifest: VerifiedWeddingDayManifestTrust) = mutex.withLock {
        manifests[manifest.weddingId] = manifest
        persist()
    }

    suspend fun manifest(weddingId: String): VerifiedWeddingDayManifestTrust? = mutex.withLock {
        manifests[weddingId]
    }

    suspend fun signingKey(weddingId: String, keyId: String): WeddingDayManifestKey? = mutex.withLock {
        manifests[weddingId]?.keys?.firstOrNull { it.keyId == keyId }
    }

    suspend fun clear(weddingId: String) = mutex.withLock {
        manifests.remove(weddingId)
        persist()
    }

    private fun load() {
        val target = file ?: return
        if (!target.exists()) return
        try {
            val type = object : TypeToken<Map<String, VerifiedWeddingDayManifestTrust>>() {}.type
            val decoded: Map<String, VerifiedWeddingDayManifestTrust>? = gson.fromJson(target.readText(), type)
            manifests.clear()
            if (decoded != null) manifests.putAll(decoded)
        } catch (_: Exception) {
            manifests.clear()
        }
    }

    private fun persist() {
        val target = file ?: return
        storageDir?.mkdirs()
        target.writeText(gson.toJson(manifests))
    }
}
