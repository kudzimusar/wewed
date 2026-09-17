package pro.wewed.app.services

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject
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
 */
class OfflineManifestStore(private val storageDir: File? = null) : OfflineManifestStoreProtocol {
    private val mutex = Mutex()
    private val manifests = mutableMapOf<String, MutableMap<String, GuestManifestItem>>()
    private val syncQueues = mutableMapOf<String, MutableList<QueuedCheckIn>>()

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
            val root = JSONObject()

            val manifestsJson = JSONObject()
            for ((wId, map) in manifests) {
                val mapJson = JSONObject()
                for ((serial, item) in map) {
                    val itemJson = JSONObject().apply {
                        put("id", item.id)
                        put("serial", item.serial)
                        put("guestName", item.guestName)
                        put("partySize", item.partySize)
                        put("checkedInCount", item.checkedInCount)
                        put("tableAssignment", item.tableAssignment ?: JSONObject.NULL)
                        put("eventBitmask", item.eventBitmask)
                        put("isVip", item.isVip)
                        put("dietaryRequirements", item.dietaryRequirements ?: JSONObject.NULL)
                    }
                    mapJson.put(serial, itemJson)
                }
                manifestsJson.put(wId, mapJson)
            }
            root.put("manifests", manifestsJson)

            val queuesJson = JSONObject()
            for ((wId, list) in syncQueues) {
                val listArr = JSONArray()
                for (q in list) {
                    val qJson = JSONObject().apply {
                        put("id", q.id)
                        put("weddingId", q.weddingId)
                        put("passSerial", q.passSerial)
                        put("guestId", q.guestId)
                        put("count", q.count)
                        put("timestamp", q.timestamp)
                        put("usherId", q.usherId)
                        put("synced", q.synced)
                    }
                    listArr.put(qJson)
                }
                queuesJson.put(wId, listArr)
            }
            root.put("syncQueues", queuesJson)

            file.writeText(root.toString())
        } catch (_: Exception) {
            // In unit test or memory-only environment, safe fallback
        }
    }
}
