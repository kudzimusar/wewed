package pro.wewed.app.services

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import pro.wewed.app.models.CheckInStatus
import pro.wewed.app.models.CheckInVerificationResult
import java.io.File
import java.util.UUID

/**
 * Represents a cached guest record stored in the offline manifest for zero-connectivity check-in.
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
    val dietaryRequirements: String? = null
)

/**
 * A gate check-in record queued locally while offline, awaiting sync to the remote server.
 */
data class QueuedCheckIn(
    val id: String = UUID.randomUUID().toString(),
    val weddingId: String,
    val passSerial: String,
    val guestId: String,
    val count: Int,
    val timestamp: Long = System.currentTimeMillis(),
    val usherId: String,
    var synced: Boolean = false
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
    suspend fun clearManifest(weddingId: String)
}

/**
 * Thread-safe persistent offline manifest store for Zimbabwe-first field operations.
 * Operates purely with standard file I/O for 100% reliability across devices and JVM test runners.
 */
class OfflineManifestStore(private val storageDir: File? = null) : OfflineManifestStoreProtocol {
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
            val itemRegex = Regex("""\{"id":"(.*?)","serial":"(.*?)","guestName":"(.*?)","partySize":(\d+),"checkedInCount":(\d+),"tableAssignment":(null|".*?"),"eventBitmask":(\d+),"isVip":(true|false)\}""")
            val manifestSection = text.substringAfter("\"manifests\":").substringBefore("\"syncQueues\":")
            val weddingRegex = Regex(""""(.*?)":\s*\[""")
            val weddings = weddingRegex.findAll(manifestSection).toList()
            for (wMatch in weddings) {
                val wId = wMatch.groupValues[1]
                val sub = manifestSection.substringAfter(wMatch.value).substringBefore("]")
                val map = mutableMapOf<String, GuestManifestItem>()
                for (m in itemRegex.findAll(sub)) {
                    val g = m.groupValues
                    val table = if (g[6] == "null") null else g[6].removeSurrounding("\"")
                    val item = GuestManifestItem(
                        id = g[1],
                        serial = g[2],
                        guestName = g[3],
                        partySize = g[4].toInt(),
                        checkedInCount = g[5].toInt(),
                        tableAssignment = table,
                        eventBitmask = g[7].toInt(),
                        isVip = g[8].toBoolean()
                    )
                    map[item.serial] = item
                }
                manifests[wId] = map
            }

            val queueSection = text.substringAfter("\"syncQueues\":")
            val queueRegex = Regex("""\{"id":"(.*?)","weddingId":"(.*?)","passSerial":"(.*?)","guestId":"(.*?)","count":(\d+),"timestamp":(\d+),"usherId":"(.*?)","synced":(true|false)\}""")
            val qWeddings = weddingRegex.findAll(queueSection).toList()
            for (wMatch in qWeddings) {
                val wId = wMatch.groupValues[1]
                val sub = queueSection.substringAfter(wMatch.value).substringBefore("]")
                val list = mutableListOf<QueuedCheckIn>()
                for (m in queueRegex.findAll(sub)) {
                    val g = m.groupValues
                    list.add(QueuedCheckIn(
                        id = g[1],
                        weddingId = g[2],
                        passSerial = g[3],
                        guestId = g[4],
                        count = g[5].toInt(),
                        timestamp = g[6].toLong(),
                        usherId = g[7],
                        synced = g[8].toBoolean()
                    ))
                }
                syncQueues[wId] = list
            }
        } catch (_: Exception) {}
    }

    override suspend fun saveManifest(weddingId: String, items: List<GuestManifestItem>) = mutex.withLock {
        val map = mutableMapOf<String, GuestManifestItem>()
        for (item in items) {
            map[item.serial] = item
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

        if (weddingMap == null || item == null) {
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

        val newTotal = item.checkedInCount + count
        if (newTotal > item.partySize) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.CAPACITY_EXCEEDED,
                guestName = item.guestName,
                householdName = null,
                partySize = item.partySize,
                alreadyCheckedInCount = item.checkedInCount,
                remainingCount = item.partySize - item.checkedInCount,
                tableNumber = null,
                tableName = item.tableAssignment,
                gateMessage = "Party size limit exceeded: $newTotal/${item.partySize} checked in"
            )
        }

        item.checkedInCount = newTotal

        val queued = QueuedCheckIn(
            weddingId = weddingId,
            passSerial = serial,
            guestId = item.id,
            count = count,
            usherId = usherId
        )

        val queue = syncQueues.getOrPut(weddingId) { mutableListOf() }
        queue.add(queued)

        persistState()

        return@withLock CheckInVerificationResult(
            status = CheckInStatus.VALID_PASS,
            guestName = item.guestName,
            householdName = null,
            partySize = item.partySize,
            alreadyCheckedInCount = item.checkedInCount,
            remainingCount = item.partySize - item.checkedInCount,
            tableNumber = null,
            tableName = item.tableAssignment,
            gateMessage = "Offline check-in verified for ${item.guestName}"
        )
    }

    override suspend fun getPendingCheckIns(weddingId: String): List<QueuedCheckIn> = mutex.withLock {
        syncQueues[weddingId]?.filter { !it.synced } ?: emptyList()
    }

    override suspend fun markCheckInSynced(id: String) = mutex.withLock {
        for ((_, queue) in syncQueues) {
            for (item in queue) {
                if (item.id == id) {
                    item.synced = true
                }
            }
        }
        persistState()
    }

    override suspend fun clearManifest(weddingId: String) = mutex.withLock {
        manifests.remove(weddingId)
        syncQueues.remove(weddingId)
        persistState()
    }

    private fun persistState() {
        if (storageDir == null) return
        try {
            val file = File(storageDir, "wewed_offline_manifest.json")
            val sb = java.lang.StringBuilder()
            sb.append("{\n  \"manifests\": {\n")
            val wEntries = manifests.entries.toList()
            for (i in wEntries.indices) {
                val (wId, map) = wEntries[i]
                sb.append("    \"").append(wId).append("\": [\n")
                val items = map.values.toList()
                for (j in items.indices) {
                    val item = items[j]
                    sb.append("      {")
                    sb.append("\"id\":\"").append(escape(item.id)).append("\",")
                    sb.append("\"serial\":\"").append(escape(item.serial)).append("\",")
                    sb.append("\"guestName\":\"").append(escape(item.guestName)).append("\",")
                    sb.append("\"partySize\":").append(item.partySize).append(",")
                    sb.append("\"checkedInCount\":").append(item.checkedInCount).append(",")
                    sb.append("\"tableAssignment\":").append(if (item.tableAssignment != null) "\"${escape(item.tableAssignment)}\"" else "null").append(",")
                    sb.append("\"eventBitmask\":").append(item.eventBitmask).append(",")
                    sb.append("\"isVip\":").append(item.isVip)
                    sb.append("}").append(if (j < items.size - 1) ",\n" else "\n")
                }
                sb.append("    ]").append(if (i < wEntries.size - 1) ",\n" else "\n")
            }
            sb.append("  },\n  \"syncQueues\": {\n")
            val qEntries = syncQueues.entries.toList()
            for (i in qEntries.indices) {
                val (wId, list) = qEntries[i]
                sb.append("    \"").append(wId).append("\": [\n")
                for (j in list.indices) {
                    val q = list[j]
                    sb.append("      {")
                    sb.append("\"id\":\"").append(escape(q.id)).append("\",")
                    sb.append("\"weddingId\":\"").append(escape(q.weddingId)).append("\",")
                    sb.append("\"passSerial\":\"").append(escape(q.passSerial)).append("\",")
                    sb.append("\"guestId\":\"").append(escape(q.guestId)).append("\",")
                    sb.append("\"count\":").append(q.count).append(",")
                    sb.append("\"timestamp\":").append(q.timestamp).append(",")
                    sb.append("\"usherId\":\"").append(escape(q.usherId)).append("\",")
                    sb.append("\"synced\":").append(q.synced)
                    sb.append("}").append(if (j < list.size - 1) ",\n" else "\n")
                }
                sb.append("    ]").append(if (i < qEntries.size - 1) ",\n" else "\n")
            }
            sb.append("  }\n}")
            file.writeText(sb.toString())
        } catch (_: Exception) {}
    }

    private fun escape(s: String): String = s.replace("\"", "\\\"").replace("\n", "\\n")
}
