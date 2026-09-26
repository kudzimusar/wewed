package pro.wewed.app.services

import android.content.Context
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import pro.wewed.app.models.CheckInStatus
import pro.wewed.app.models.CheckInVerificationResult
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.Base64
import java.util.UUID

/**
 * Represents a cached guest record stored in the offline manifest for zero-connectivity check-in.
 *
 * Manifest-v2 fields are optional/defaulted so snapshots written by the older count-only store
 * can still be loaded and upgraded in place.
 */
data class GuestManifestItem(
    val id: String,
    val serial: String,
    val guestName: String,
    val partySize: Int,
    var checkedInCount: Int = 0,
    val tableAssignment: String? = null,
    val eventBitmask: Int = 3,
    val isVip: Boolean = false,
    val dietaryRequirements: String? = null,
    val signingKeyId: String? = null,
    val nonce: String? = null,
    val attendeeKeys: List<String> = emptyList(),
    var checkedInAttendeeKeys: List<String> = emptyList(),
    val eligible: Boolean = true,
    val expiresAt: String? = null,
    val revokedAt: String? = null
)

/**
 * A gate check-in record queued locally while offline, awaiting idempotent server sync.
 *
 * [passSerial] is for display and lookup only; it is never an admission claim. LQR01 records carry
 * [credentialRef] — the secure-vault key under which the exact scanned WW2 token is held — and the
 * token itself is never part of this record or of the durable cache it is persisted to.
 */
data class QueuedCheckIn(
    val id: String = UUID.randomUUID().toString(),
    val weddingId: String,
    val passSerial: String,
    val guestId: String,
    val count: Int,
    val timestamp: Long = System.currentTimeMillis(),
    val usherId: String,
    var synced: Boolean = false,
    val attendeeKeys: List<String> = emptyList(),
    val deviceId: String? = null,
    /** Vault key (`ww2.offline.<id>`) of the exact scanned token. Null for pre-LQR01 records. */
    val credentialRef: String? = null,
    /** Set when the server terminally rejected the event; a rejected event is no longer pending. */
    val rejectionCode: String? = null
)

/**
 * How a queued check-in can be reconciled. Only [EXACT_CREDENTIAL] is ever sent to the server; every
 * other class is reported as blocked, never sent, never silently trusted, and left visible for
 * operator resolution.
 */
enum class QueuedCheckInReconciliation {
    /** Attendee keys present and the vault still holds a WW2 token for this record's serial. */
    EXACT_CREDENTIAL,

    /** Pre-v2 count-only event: no attendee keys, so it can never be replayed as a whole household. */
    LEGACY_COUNT_ONLY,

    /** Pre-LQR01 event: attendee keys but no retained credential. It can never become trusted. */
    LEGACY_SERIAL_ONLY,

    /** A credential was retained, but the vault no longer yields a matching WW2 token (wiped/reinstalled). */
    CREDENTIAL_UNAVAILABLE;

    companion object {
        fun classify(record: QueuedCheckIn, storedToken: String?): QueuedCheckInReconciliation {
            if (record.attendeeKeys.isEmpty()) return LEGACY_COUNT_ONLY
            if (record.credentialRef == null) return LEGACY_SERIAL_ONLY
            if (storedToken == null || !storedToken.startsWith("WW2.")) return CREDENTIAL_UNAVAILABLE
            val parsed = (TokenVerifier.parse(storedToken) as? TokenVerificationResult.Success)?.token
                ?: return CREDENTIAL_UNAVAILABLE
            if (parsed.version != "WW2" || parsed.passSerial != record.passSerial) return CREDENTIAL_UNAVAILABLE
            return EXACT_CREDENTIAL
        }
    }
}

/**
 * Interface defining offline manifest storage and sync queue operations.
 */
interface OfflineManifestStoreProtocol {
    suspend fun saveManifest(weddingId: String, items: List<GuestManifestItem>)
    suspend fun getManifest(weddingId: String): List<GuestManifestItem>
    suspend fun lookupBySerial(weddingId: String, serial: String): GuestManifestItem?

    /**
     * Admits against the cached manifest using the exact scanned WW2 [token], which the caller has
     * already verified. The token is retained only in the secure credential vault, so the queued
     * event can later be reconciled by presenting that same credential to the server.
     */
    suspend fun recordOfflineCheckIn(weddingId: String, token: String, count: Int): CheckInVerificationResult

    /** Queued events still awaiting reconciliation: not synced and not terminally rejected. */
    suspend fun getPendingCheckIns(weddingId: String): List<QueuedCheckIn>

    /** Marks the event synced and drops its retained credential. */
    suspend fun markCheckInSynced(id: String)

    /** Records a terminal server rejection and drops the retained credential; the event is never resent. */
    suspend fun markCheckInRejected(id: String, code: String) {
        throw UnsupportedOperationException("Offline store does not support terminal rejection")
    }

    /** The exact token retained for [record], or null when none is (or can be) retained. Fails closed. */
    suspend fun credential(record: QueuedCheckIn): String? = null

    suspend fun markPassRevoked(weddingId: String, serial: String) {
        throw UnsupportedOperationException("Offline store does not support local pass revocation")
    }
    suspend fun clearManifest(weddingId: String)
}

/**
 * Thread-safe persistent offline manifest store for Zimbabwe-first field operations.
 *
 * V2 persistence is deliberately line-oriented and dependency-free so JVM tests and Android
 * devices use the exact same durable format. Existing JSON snapshots produced by the original
 * implementation are still read once and are rewritten as V2 on the next mutation.
 *
 * LQR01 — queue metadata lives in the ordinary durable cache under [storageDir]; the bearer WW2
 * token of each queued admission lives only in [credentialVault], keyed by the record's
 * `credentialRef`. If the vault loses a token (keystore invalidated, app reinstalled), the event
 * becomes [QueuedCheckInReconciliation.CREDENTIAL_UNAVAILABLE] and fails closed. The default vault
 * is in-memory so JVM tests stay hermetic; production must use [deviceProtected].
 */
class OfflineManifestStore(
    private val storageDir: File? = null,
    private val deviceId: String = "android-wedding-day",
    private val credentialVault: SecureStorage = InMemorySecureStorage()
) : OfflineManifestStoreProtocol {
    private val mutex = Mutex()
    private val manifests = mutableMapOf<String, MutableMap<String, GuestManifestItem>>()
    private val syncQueues = mutableMapOf<String, MutableList<QueuedCheckIn>>()

    init {
        loadState()
    }

    private fun loadState() {
        if (storageDir == null) return
        val file = File(storageDir, "wewed_offline_manifest.json")
        if (!file.exists()) return
        try {
            val text = file.readText()
            if (text.startsWith(V2_HEADER)) {
                loadV2(text)
            } else {
                loadLegacyJson(text)
            }
        } catch (_: Exception) {
            manifests.clear()
            syncQueues.clear()
        }
    }

    private fun loadV2(text: String) {
        for (line in text.lineSequence().drop(1)) {
            if (line.isBlank()) continue
            val parts = line.split('|')
            when (parts.firstOrNull()) {
                "M" -> if (parts.size >= 18) {
                    val weddingId = decode(parts[1])
                    val item = GuestManifestItem(
                        id = decode(parts[2]),
                        serial = decode(parts[3]),
                        guestName = decode(parts[4]),
                        partySize = parts[5].toInt(),
                        checkedInCount = parts[6].toInt(),
                        tableAssignment = decodeNullable(parts[7]),
                        eventBitmask = parts[8].toInt(),
                        isVip = parts[9].toBoolean(),
                        dietaryRequirements = decodeNullable(parts[10]),
                        signingKeyId = decodeNullable(parts[11]),
                        nonce = decodeNullable(parts[12]),
                        attendeeKeys = decodeList(parts[13]),
                        checkedInAttendeeKeys = decodeList(parts[14]),
                        eligible = parts[15].toBoolean(),
                        expiresAt = decodeNullable(parts[16]),
                        revokedAt = decodeNullable(parts[17])
                    )
                    manifests.getOrPut(weddingId) { mutableMapOf() }[item.serial] = item
                }
                "Q" -> if (parts.size >= 12) {
                    val weddingId = decode(parts[1])
                    // V3 appends credentialRef and rejectionCode after the V2 columns; a 12-column
                    // V2 line is a pre-LQR01 record and keeps both null.
                    val isV3 = parts.size >= 15 && parts[14] == "v3"
                    val queued = QueuedCheckIn(
                        id = decode(parts[2]),
                        weddingId = weddingId,
                        passSerial = decode(parts[3]),
                        guestId = decode(parts[4]),
                        count = parts[5].toInt(),
                        timestamp = parts[6].toLong(),
                        usherId = decode(parts[7]),
                        synced = parts[8].toBoolean(),
                        attendeeKeys = decodeList(parts[9]),
                        deviceId = decodeNullable(parts[10]),
                        credentialRef = if (isV3) decodeNullable(parts[12]) else null,
                        rejectionCode = if (isV3) decodeNullable(parts[13]) else null
                    )
                    syncQueues.getOrPut(weddingId) { mutableListOf() }.add(queued)
                }
            }
        }
    }

    /** Reads the exact legacy format used before manifest-v2 fields existed. */
    private fun loadLegacyJson(text: String) {
        val itemRegex = Regex("""\{"id":"(.*?)","serial":"(.*?)","guestName":"(.*?)","partySize":(\d+),"checkedInCount":(\d+),"tableAssignment":(null|".*?"),"eventBitmask":(\d+),"isVip":(true|false)\}""")
        val manifestSection = text.substringAfter("\"manifests\":").substringBefore("\"syncQueues\":")
        val weddingRegex = Regex(""""(.*?)":\s*\[""")
        val weddings = weddingRegex.findAll(manifestSection).toList()
        for (wMatch in weddings) {
            val weddingId = wMatch.groupValues[1]
            val sub = manifestSection.substringAfter(wMatch.value).substringBefore("]")
            val map = mutableMapOf<String, GuestManifestItem>()
            for (match in itemRegex.findAll(sub)) {
                val g = match.groupValues
                val table = if (g[6] == "null") null else g[6].removeSurrounding("\"")
                val allKeys = defaultAttendeeKeys(g[4].toInt())
                val checkedCount = g[5].toInt()
                val item = GuestManifestItem(
                    id = g[1],
                    serial = g[2],
                    guestName = g[3],
                    partySize = g[4].toInt(),
                    checkedInCount = checkedCount,
                    tableAssignment = table,
                    eventBitmask = g[7].toInt(),
                    isVip = g[8].toBoolean(),
                    attendeeKeys = allKeys,
                    checkedInAttendeeKeys = allKeys.take(checkedCount)
                )
                map[item.serial] = item
            }
            manifests[weddingId] = map
        }

        val queueSection = text.substringAfter("\"syncQueues\":")
        val queueRegex = Regex("""\{"id":"(.*?)","weddingId":"(.*?)","passSerial":"(.*?)","guestId":"(.*?)","count":(\d+),"timestamp":(\d+),"usherId":"(.*?)","synced":(true|false)\}""")
        val qWeddings = weddingRegex.findAll(queueSection).toList()
        for (wMatch in qWeddings) {
            val weddingId = wMatch.groupValues[1]
            val sub = queueSection.substringAfter(wMatch.value).substringBefore("]")
            val list = mutableListOf<QueuedCheckIn>()
            for (match in queueRegex.findAll(sub)) {
                val g = match.groupValues
                list.add(
                    QueuedCheckIn(
                        id = g[1],
                        weddingId = g[2],
                        passSerial = g[3],
                        guestId = g[4],
                        count = g[5].toInt(),
                        timestamp = g[6].toLong(),
                        usherId = g[7],
                        synced = g[8].toBoolean()
                    )
                )
            }
            syncQueues[weddingId] = list
        }
    }

    override suspend fun saveManifest(weddingId: String, items: List<GuestManifestItem>) = mutex.withLock {
        val map = mutableMapOf<String, GuestManifestItem>()
        for (item in items) {
            map[item.serial] = item.normalized()
        }
        manifests[weddingId] = map
        persistState()
    }

    override suspend fun getManifest(weddingId: String): List<GuestManifestItem> = mutex.withLock {
        manifests[weddingId]?.values?.sortedBy { it.guestName } ?: emptyList()
    }

    override suspend fun lookupBySerial(weddingId: String, serial: String): GuestManifestItem? = mutex.withLock {
        manifests[weddingId]?.get(serial)
    }

    override suspend fun recordOfflineCheckIn(
        weddingId: String,
        token: String,
        count: Int
    ): CheckInVerificationResult = mutex.withLock {
        val parsed = (TokenVerifier.parse(token) as? TokenVerificationResult.Success)?.token
        if (parsed == null || parsed.version != "WW2") {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.INVALID_PASS,
                guestName = "Unknown Guest",
                householdName = null,
                partySize = 0,
                alreadyCheckedInCount = 0,
                remainingCount = 0,
                tableNumber = null,
                tableName = null,
                gateMessage = "Scanned code is not a Wedding Pass"
            )
        }
        val serial = parsed.passSerial
        val weddingMap = manifests[weddingId]
        val item = weddingMap?.get(serial)

        if (count <= 0 || weddingMap == null || item == null) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.INVALID_PASS,
                guestName = "Unknown Guest",
                householdName = null,
                partySize = 0,
                alreadyCheckedInCount = 0,
                remainingCount = 0,
                tableNumber = null,
                tableName = null,
                gateMessage = "Pass serial $serial not found in offline manifest"
            )
        }

        if (!item.eligible || item.revokedAt != null) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.INVALID_PASS,
                guestName = item.guestName,
                householdName = null,
                partySize = item.partySize,
                alreadyCheckedInCount = item.checkedInCount,
                remainingCount = maxOf(0, item.partySize - item.checkedInCount),
                tableNumber = null,
                tableName = item.tableAssignment,
                gateMessage = "Pass is not eligible for admission"
            )
        }

        val allKeys = if (item.attendeeKeys.isNotEmpty()) item.attendeeKeys else defaultAttendeeKeys(item.partySize)
        val checkedKeys = item.checkedInAttendeeKeys.filter { it in allKeys }.toMutableList()
        if (checkedKeys.isEmpty() && item.checkedInCount > 0) {
            checkedKeys.addAll(allKeys.take(item.checkedInCount.coerceAtMost(allKeys.size)))
        }
        val checkedSet = checkedKeys.toSet()
        val remainingKeys = allKeys.filterNot { it in checkedSet }

        if (count > remainingKeys.size) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.CAPACITY_EXCEEDED,
                guestName = item.guestName,
                householdName = null,
                partySize = item.partySize,
                alreadyCheckedInCount = checkedKeys.size,
                remainingCount = remainingKeys.size,
                tableNumber = null,
                tableName = item.tableAssignment,
                gateMessage = "Party size limit exceeded: ${checkedKeys.size + count}/${item.partySize} checked in"
            )
        }

        val admittedKeys = remainingKeys.take(count)
        val newCheckedKeys = checkedKeys + admittedKeys
        val updated = item.copy(
            checkedInCount = newCheckedKeys.size,
            checkedInAttendeeKeys = newCheckedKeys
        )

        val queueId = UUID.randomUUID().toString()
        val credentialRef = credentialKey(queueId)
        // The exact credential is secured BEFORE anything is admitted or queued. A vault that cannot
        // hold it admits nobody: an event that could never be reconciled must not be created.
        try {
            credentialVault.save(credentialRef, token)
        } catch (_: Exception) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.INVALID_PASS,
                guestName = item.guestName,
                householdName = null,
                partySize = item.partySize,
                alreadyCheckedInCount = checkedKeys.size,
                remainingCount = remainingKeys.size,
                tableNumber = null,
                tableName = item.tableAssignment,
                gateMessage = "This device could not secure the scanned pass; admission was not recorded"
            )
        }
        weddingMap[serial] = updated

        val queued = QueuedCheckIn(
            id = queueId,
            weddingId = weddingId,
            passSerial = serial,
            guestId = item.id,
            count = admittedKeys.size,
            // usherId remains in the persisted V2 shape only so old snapshots continue to
            // decode. New queue entries never persist operator authority.
            usherId = "",
            attendeeKeys = admittedKeys,
            deviceId = deviceId,
            credentialRef = credentialRef
        )
        syncQueues.getOrPut(weddingId) { mutableListOf() }.add(queued)
        persistState()

        val remaining = allKeys.size - newCheckedKeys.size
        return@withLock CheckInVerificationResult(
            status = if (remaining == 0) CheckInStatus.VALID_PASS else CheckInStatus.PARTIAL_CHECKED_IN,
            guestName = item.guestName,
            householdName = null,
            partySize = allKeys.size,
            alreadyCheckedInCount = newCheckedKeys.size,
            remainingCount = remaining,
            tableNumber = null,
            tableName = item.tableAssignment,
            gateMessage = if (remaining == 0) {
                "Offline check-in verified for ${item.guestName}; household complete"
            } else {
                "Offline check-in verified for ${item.guestName}; $remaining remaining"
            }
        )
    }

    override suspend fun getPendingCheckIns(weddingId: String): List<QueuedCheckIn> = mutex.withLock {
        syncQueues[weddingId]?.filter { !it.synced && it.rejectionCode == null } ?: emptyList()
    }

    override suspend fun markCheckInSynced(id: String) = mutex.withLock {
        for ((_, queue) in syncQueues) {
            val index = queue.indexOfFirst { it.id == id }
            if (index >= 0) {
                queue[index].credentialRef?.let(credentialVault::delete)
                queue[index] = queue[index].copy(synced = true)
            }
        }
        persistState()
    }

    override suspend fun markCheckInRejected(id: String, code: String) = mutex.withLock {
        for ((_, queue) in syncQueues) {
            val index = queue.indexOfFirst { it.id == id }
            if (index >= 0) {
                queue[index].credentialRef?.let(credentialVault::delete)
                queue[index] = queue[index].copy(rejectionCode = code)
            }
        }
        persistState()
    }

    override suspend fun credential(record: QueuedCheckIn): String? {
        // Only this record's own vault key is ever read, whatever the cache file claims.
        val ref = record.credentialRef?.takeIf { it == credentialKey(record.id) } ?: return null
        return credentialVault.get(ref)
    }

    override suspend fun markPassRevoked(weddingId: String, serial: String) = mutex.withLock {
        val weddingMap = manifests[weddingId] ?: return@withLock
        val item = weddingMap[serial] ?: return@withLock
        if (item.revokedAt == null) {
            weddingMap[serial] = item.copy(revokedAt = "local-revoked")
            persistState()
        }
    }

    override suspend fun clearManifest(weddingId: String) = mutex.withLock {
        manifests.remove(weddingId)
        syncQueues.remove(weddingId)?.forEach { queued ->
            queued.credentialRef?.let(credentialVault::delete)
        }
        persistState()
    }

    private fun GuestManifestItem.normalized(): GuestManifestItem {
        val keys = if (attendeeKeys.isNotEmpty()) attendeeKeys else defaultAttendeeKeys(partySize)
        val checked = if (checkedInAttendeeKeys.isNotEmpty()) {
            checkedInAttendeeKeys.filter { it in keys }
        } else {
            keys.take(checkedInCount.coerceAtMost(keys.size))
        }
        return copy(
            partySize = keys.size,
            checkedInCount = checked.size,
            attendeeKeys = keys,
            checkedInAttendeeKeys = checked
        )
    }

    private fun persistState() {
        if (storageDir == null) return
        val file = File(storageDir, "wewed_offline_manifest.json")
        storageDir.mkdirs()
        val lines = mutableListOf(V2_HEADER.trimEnd())

        for ((weddingId, map) in manifests.toSortedMap()) {
            for (item in map.values.sortedBy { it.serial }) {
                lines += listOf(
                    "M",
                    encode(weddingId),
                    encode(item.id),
                    encode(item.serial),
                    encode(item.guestName),
                    item.partySize.toString(),
                    item.checkedInCount.toString(),
                    encodeNullable(item.tableAssignment),
                    item.eventBitmask.toString(),
                    item.isVip.toString(),
                    encodeNullable(item.dietaryRequirements),
                    encodeNullable(item.signingKeyId),
                    encodeNullable(item.nonce),
                    encodeList(item.attendeeKeys),
                    encodeList(item.checkedInAttendeeKeys),
                    item.eligible.toString(),
                    encodeNullable(item.expiresAt),
                    encodeNullable(item.revokedAt)
                ).joinToString("|")
            }
        }

        for ((weddingId, queue) in syncQueues.toSortedMap()) {
            for (item in queue.sortedBy { it.timestamp }) {
                lines += listOf(
                    "Q",
                    encode(weddingId),
                    encode(item.id),
                    encode(item.passSerial),
                    encode(item.guestId),
                    item.count.toString(),
                    item.timestamp.toString(),
                    encode(item.usherId),
                    item.synced.toString(),
                    encodeList(item.attendeeKeys),
                    encodeNullable(item.deviceId),
                    "v2",
                    encodeNullable(item.credentialRef),
                    encodeNullable(item.rejectionCode),
                    "v3"
                ).joinToString("|")
            }
        }
        file.writeText(lines.joinToString("\n") + "\n")
    }

    companion object {
        private const val V2_HEADER = "WEWED_OFFLINE_V2\n"
        private const val LIST_SEPARATOR = "\u001f"

        /** SharedPreferences file of the Keystore-backed vault holding queued WW2 credentials. */
        const val OFFLINE_CREDENTIALS_PREFERENCES = "wewed_wedding_day_offline_credentials"

        /**
         * The production store: queue metadata in [storageDir], each queued WW2 token in an Android
         * Keystore-protected vault ([AndroidKeystoreSecureStorage], AES-GCM with a non-exportable key).
         */
        fun deviceProtected(
            context: Context,
            storageDir: File,
            deviceId: String = "android-wedding-day"
        ): OfflineManifestStore = OfflineManifestStore(
            storageDir = storageDir,
            deviceId = deviceId,
            credentialVault = AndroidKeystoreSecureStorage(
                context.applicationContext,
                OFFLINE_CREDENTIALS_PREFERENCES,
                durableWrites = true
            )
        )

        private fun credentialKey(queueId: String): String = "ww2.offline.$queueId"

        private fun defaultAttendeeKeys(partySize: Int): List<String> {
            if (partySize <= 0) return emptyList()
            if (partySize == 1) return listOf("primary")
            return listOf("primary") + (2..partySize).map { "member-$it" }
        }

        private fun encode(value: String): String = Base64.getUrlEncoder().withoutPadding()
            .encodeToString(value.toByteArray(StandardCharsets.UTF_8))

        private fun decode(value: String): String = String(
            Base64.getUrlDecoder().decode(value),
            StandardCharsets.UTF_8
        )

        private fun encodeNullable(value: String?): String = value?.let(::encode) ?: "-"
        private fun decodeNullable(value: String): String? = if (value == "-") null else decode(value)
        private fun encodeList(values: List<String>): String = if (values.isEmpty()) "-" else encode(values.joinToString(LIST_SEPARATOR))
        private fun decodeList(value: String): List<String> = if (value == "-") emptyList() else decode(value).split(LIST_SEPARATOR).filter { it.isNotEmpty() }
    }
}
