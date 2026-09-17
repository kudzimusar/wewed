package pro.wewed.app.services

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import pro.wewed.app.models.AnnouncementUrgency
import pro.wewed.app.models.VendorPresence
import pro.wewed.app.models.VendorPresenceState
import pro.wewed.app.models.WeddingAnnouncement
import java.util.UUID

/**
 * Server-backed Wedding Day API client for Android.
 * Connects to real Next.js API routes in isolatedWeddingDay or production modes.
 * All operations degrade gracefully on network failure — callers should fall back to [FixtureWeddingRepository].
 */
class ServerBackedWeddingDayOperations(
    private val transport: WeddingDayHttpTransport,
    private val bearerToken: String,
    private val weddingId: String
) {
    private val gson = Gson()
    private val authHeader get() = mapOf(
        "Authorization" to "Bearer $bearerToken",
        "Accept" to "application/json"
    )

    // ── Announcements ────────────────────────────────────────────────────────

    suspend fun getAnnouncements(): List<WeddingAnnouncement> {
        return try {
            val resp = transport.get("api/wedding-day/announcements", authHeader)
            if (resp.status !in 200..299) return emptyList()
            val type = object : TypeToken<AnnouncementEnvelope>() {}.type
            val envelope: AnnouncementEnvelope = gson.fromJson(resp.body, type)
            if (!envelope.success) return emptyList()
            envelope.data.map { item ->
                WeddingAnnouncement(
                    id = item.id ?: UUID.randomUUID().toString(),
                    title = item.title ?: "Announcement",
                    message = item.body,
                    urgency = if (item.urgency == "high") AnnouncementUrgency.ALERT else AnnouncementUrgency.INFO
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    suspend fun postAnnouncement(
        title: String,
        message: String,
        urgency: AnnouncementUrgency
    ): WeddingAnnouncement? {
        return try {
            val headers = authHeader + mapOf("Content-Type" to "application/json")
            val body = gson.toJson(mapOf("title" to title, "body" to message, "audience" to "all"))
            val resp = transport.post("api/wedding-day/announcements", headers, body)
            if (resp.status !in 200..299) return null
            val type = object : TypeToken<CreateAnnouncementEnvelope>() {}.type
            val envelope: CreateAnnouncementEnvelope = gson.fromJson(resp.body, type)
            if (!envelope.success) return null
            WeddingAnnouncement(
                id = envelope.data.id,
                title = envelope.data.title ?: title,
                message = envelope.data.body,
                urgency = urgency
            )
        } catch (_: Exception) {
            null
        }
    }

    // ── Vendor Presence ──────────────────────────────────────────────────────

    suspend fun updateVendorState(
        serviceEngagementId: String,
        state: VendorPresenceState
    ): VendorPresence? {
        return try {
            val stateString = when (state) {
                VendorPresenceState.SCHEDULED -> "CONFIRMED"
                VendorPresenceState.EN_ROUTE -> "EN_ROUTE"
                VendorPresenceState.ARRIVED -> "ARRIVED_ON_SITE"
                VendorPresenceState.SERVICE_ACTIVE -> "SERVICE_ACTIVE"
                VendorPresenceState.COMPLETED -> "COMPLETED"
            }
            val headers = authHeader + mapOf("Content-Type" to "application/json")
            val body = gson.toJson(mapOf("serviceEngagementId" to serviceEngagementId, "state" to stateString))
            val resp = transport.post("api/wedding-day/vendors/presence", headers, body)
            if (resp.status !in 200..299) return null
            val type = object : TypeToken<PresenceEnvelope>() {}.type
            val envelope: PresenceEnvelope = gson.fromJson(resp.body, type)
            if (!envelope.success) return null
            VendorPresence(
                id = serviceEngagementId,
                vendorName = "Vendor Service",
                serviceCategory = "Service Provider",
                serviceArea = "Main Venue",
                state = state,
                expectedTime = "On Site"
            )
        } catch (_: Exception) {
            null
        }
    }

    // ── Internal DTOs ────────────────────────────────────────────────────────

    private data class AnnouncementEnvelope(val success: Boolean, val data: List<AnnouncementPayload>)
    private data class AnnouncementPayload(val id: String?, val title: String?, val body: String, val urgency: String?)
    private data class CreateAnnouncementEnvelope(val success: Boolean, val data: CreatedItem)
    private data class CreatedItem(val id: String, val title: String?, val body: String)
    private data class PresenceEnvelope(val success: Boolean)
}
