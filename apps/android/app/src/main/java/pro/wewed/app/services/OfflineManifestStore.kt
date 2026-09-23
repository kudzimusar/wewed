package pro.wewed.app.services

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
    val deviceId: String? = null
)

/**
 * Interface defining offline manifest storage and sync queue operations.
 */
interface OfflineManifestStoreProtocol {
    suspend fun saveManifest(weddingId: String, items: List<GuestManifestItem>)
    suspend fun getManifest(weddingId: String): List<GuestManifestItem>
    suspend fun lookupBySerial(weddingId: String, serial: String): GuestManifestItem?
    suspend fun recordOfflineCheckIn(weddingId: String, serial: String, count: Int, usherId: String): CheckInVerificationResult
    suspend fun getPendingCheckIns(weddingId: String): List<QueuedCheckIn>
    suspend fun markCheckInSynced(id: String)
    suspend fun markPassRevoked(weddingId: String, serial: String)
    suspend fun clearManifest(weddingId: String)
}

/**
 * Thread-safe persistent offline manifest store for Zimbabwe-first field operations.
 *
 * V2 persistence is deliberately line-oriented and dependency-free so JVM tests and Android
 * devices use the exact same durable format. Existing JSON snapshots produced by the original
 * implementation are still read once and are rewritten as V2 on the next mutation.
 */
class OfflineManifestStore(
    private val storageDir: File? = null,
    private val deviceId: String = "android-wedding-day"
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
                        deviceId = decodeNullable(parts[10])
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
        serial: String,
        count: Int,
        usherId: String
    ): CheckInVerificationResult = mutex.withLock {
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
        weddingMap[serial] = updated

        val queued = QueuedCheckIn(
            weddingId = weddingId,
            passSerial = serial,
            guestId = item.id,
            count = admittedKeys.size,
            // usherId remains in the persisted V2 shape only so old snapshots continue to
            // decode. New queue entries never persist operator authority.
            usherId = "",
            attendeeKeys = admittedKeys,
            deviceId = deviceId
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
        syncQueues[weddingId]?.filter { !it.synced } ?: emptyList()
    }

    override suspend fun markCheckInSynced(id: String) = mutex.withLock {
        for ((_, queue) in syncQueues) {
            val index = queue.indexOfFirst { it.id == id }
            if (index >= 0) {
                queue[index] = queue[index].copy(synced = true)
            }
        }
        persistState()
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
        syncQueues.remove(weddingId)
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
                    "v2"
                ).joinToString("|")
            }
        }
        file.writeText(lines.joinToString("\n") + "\n")
    }

    companion object {
        private const val V2_HEADER = "WEWED_OFFLINE_V2\n"
        private const val LIST_SEPARATOR = "\u001f"

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
