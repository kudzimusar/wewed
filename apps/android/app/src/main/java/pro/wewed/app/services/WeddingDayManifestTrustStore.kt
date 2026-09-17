package pro.wewed.app.services

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File

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
