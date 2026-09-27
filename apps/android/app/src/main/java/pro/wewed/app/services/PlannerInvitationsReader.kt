package pro.wewed.app.services

import org.json.JSONObject

/**
 * QRO05-PIQR01 — Planner → More → Invitations & QR, read-only.
 *
 * Mirrors the canonical `loadPlannerInvitationProjection` / `loadPhysicalInvitationProjection`
 * server projections (the same functions the desktop Planner reads), fetched through the native
 * Bearer + `grantId` routes. Nothing here issues, rotates or backfills a link, and nothing creates a
 * printed-invitation destination.
 *
 * Each Guest's `qrValue` / `shareMessage` carries that Guest's private RSVP credential. These values
 * are held only by the Invitations & QR screen while it is on screen — never stored in the wedding
 * graph, never logged, and never rendered as text. `toString()` redacts them so an accidental log
 * line cannot leak one.
 */
enum class PlannerInvitationRsvpStatus(val wire: String, val label: String) {
    ATTENDING("attending", "Attending"),
    DECLINED("declined", "Declined"),
    PENDING("pending", "Awaiting reply");

    companion object {
        fun fromWire(value: String?): PlannerInvitationRsvpStatus =
            entries.firstOrNull { it.wire == value } ?: PENDING
    }
}

data class PlannerInvitationDesign(
    val weddingTitle: String,
    val styleId: String,
    val message: String?,
    val rsvpDeadline: String?,
    val childrenPolicy: String,
) {
    /** The human name of the saved card style — the same names the web Invitation Studio shows. */
    val styleLabel: String get() = styleName(styleId)

    val childrenPolicyLabel: String
        get() = if (childrenPolicy == "adults_only") "Adults only" else "Children welcome"

    companion object {
        /**
         * Mirror of `INVITATION_CARD_STYLES` in `src/lib/digital-invitation-card.ts`. The server has
         * already normalized the id; an id this build does not know is title-cased, never guessed.
         */
        val STYLE_NAMES: Map<String, String> = mapOf(
            "ivory-floral-gold" to "Ivory Floral Gold",
            "midnight" to "Midnight Gold",
            "botanical" to "Garden Romance",
            "royal-emerald" to "Royal Emerald",
            "classic-white" to "Classic White",
            "blush-romance" to "Blush Romance",
            "african-luxe" to "African Luxe",
            "editorial" to "Modern Editorial",
            "black-tie" to "Black Tie",
            "watercolour-garden" to "Watercolour Garden",
            "sunset-terracotta" to "Sunset Terracotta",
            "celestial" to "Celestial",
        )

        fun styleName(id: String): String = STYLE_NAMES[id]
            ?: id.split('-').joinToString(" ") { part -> part.replaceFirstChar { it.uppercase() } }
    }
}

class PlannerGuestInvitation(
    val id: String,
    val name: String,
    val status: PlannerInvitationRsvpStatus,
    val tableNumber: Int?,
    val checkedIn: Boolean,
    /** Credential-bearing. Encode into a QR or hand to the share sheet; never render as text. */
    val qrValue: String?,
    /** Credential-bearing (contains the link). Share sheet only. */
    val shareMessage: String?,
) {
    /** False when the Guest has no RSVP link yet. This read never issues one. */
    val hasInvitationLink: Boolean get() = qrValue != null

    val tableLabel: String get() = tableNumber?.let { "Table $it" } ?: "No table"

    override fun toString(): String =
        "PlannerGuestInvitation(id=$id, status=${status.wire}, link=${if (hasInvitationLink) "<redacted>" else "none"})"

    override fun equals(other: Any?): Boolean = other is PlannerGuestInvitation &&
        other.id == id && other.name == name && other.status == status && other.tableNumber == tableNumber &&
        other.checkedIn == checkedIn && other.qrValue == qrValue && other.shareMessage == shareMessage

    override fun hashCode(): Int = id.hashCode()
}

class PlannerPhysicalInvitation(
    val configured: Boolean,
    /** The shared fallback code printed on every card (e.g. `ABCD-EFGH-23`), as desktop shows it. */
    val code: String?,
    /** The shared printed-invitation entry link. QR / share only. */
    val accessUrl: String?,
    val scanCount: Int,
    val invitedCount: Int,
) {
    override fun toString(): String =
        "PlannerPhysicalInvitation(configured=$configured, scans=$scanCount, invited=$invitedCount)"
}

data class PlannerInvitationsSnapshot(
    val design: PlannerInvitationDesign,
    val guests: List<PlannerGuestInvitation>,
    val missingLinks: Int,
    val physical: PlannerPhysicalInvitation,
)

sealed interface PlannerInvitationsLoad {
    data class Loaded(val snapshot: PlannerInvitationsSnapshot) : PlannerInvitationsLoad
    /** Session ended, grant revoked, permission refused, or an unreadable / failed transport. */
    data class Unavailable(val reason: String) : PlannerInvitationsLoad
}

object PlannerInvitationsMapping {
    private fun JSONObject.stringOrNull(key: String): String? =
        if (!has(key) || isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }

    private fun JSONObject.intOrNull(key: String): Int? =
        if (!has(key) || isNull(key)) null else (opt(key) as? Number)?.toInt()

    private fun JSONObject.boolOrNull(key: String): Boolean? = opt(key) as? Boolean

    fun design(json: JSONObject): PlannerInvitationDesign? {
        if (json.boolOrNull("success") != true) return null
        val wedding = json.optJSONObject("wedding") ?: return null
        val style = wedding.stringOrNull("invitationCardStyle") ?: return null
        return PlannerInvitationDesign(
            weddingTitle = wedding.stringOrNull("title").orEmpty(),
            styleId = style,
            message = wedding.stringOrNull("invitationCardMessage")?.trim()?.takeIf { it.isNotEmpty() },
            rsvpDeadline = wedding.stringOrNull("rsvpDeadline"),
            childrenPolicy = wedding.stringOrNull("childrenPolicy") ?: "welcome",
        )
    }

    fun guests(json: JSONObject): List<PlannerGuestInvitation>? {
        val rows = json.optJSONArray("data") ?: return null
        return (0 until rows.length()).mapNotNull { index ->
            val row = rows.optJSONObject(index) ?: return@mapNotNull null
            val id = row.stringOrNull("id") ?: return@mapNotNull null
            val link = row.stringOrNull("qrValue") ?: row.stringOrNull("invitationUrl")
            PlannerGuestInvitation(
                id = id,
                name = row.stringOrNull("name").orEmpty(),
                status = PlannerInvitationRsvpStatus.fromWire(row.stringOrNull("status")),
                tableNumber = row.intOrNull("tableNumber"),
                checkedIn = row.boolOrNull("checkedIn") ?: false,
                qrValue = link,
                shareMessage = if (link == null) null else row.stringOrNull("shareMessage"),
            )
        }
    }

    fun physical(json: JSONObject): PlannerPhysicalInvitation? {
        if (json.boolOrNull("success") != true) return null
        val configured = json.boolOrNull("configured") ?: return null
        val accessUrl = json.stringOrNull("accessUrl")
        return PlannerPhysicalInvitation(
            configured = configured && accessUrl != null,
            code = json.stringOrNull("code"),
            accessUrl = if (configured) accessUrl else null,
            scanCount = json.intOrNull("scanCount") ?: 0,
            invitedCount = json.intOrNull("invitedCount") ?: 0,
        )
    }

    fun snapshot(invitations: JSONObject, physical: JSONObject): PlannerInvitationsSnapshot? {
        val design = design(invitations) ?: return null
        val guests = guests(invitations) ?: return null
        val printed = physical(physical) ?: return null
        return PlannerInvitationsSnapshot(
            design = design,
            guests = guests,
            missingLinks = invitations.intOrNull("missingTokens") ?: guests.count { !it.hasInvitationLink },
            physical = printed,
        )
    }

    fun unavailableReason(fetch: NativeDomainFetch<*>): String? = when (fetch) {
        is NativeDomainFetch.Success -> null
        NativeDomainFetch.SessionInvalid -> "Your session has ended. Sign in again to view invitations."
        NativeDomainFetch.GrantRevoked -> "Your access to this wedding has changed."
        NativeDomainFetch.Forbidden -> "Your role on this wedding cannot view invitations."
        is NativeDomainFetch.Transport -> "Invitations could not be loaded. Check your connection and try again."
    }
}
