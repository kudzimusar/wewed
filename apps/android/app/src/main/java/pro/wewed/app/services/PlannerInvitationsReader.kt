package pro.wewed.app.services

import org.json.JSONObject

/**
 * QRO05-PIQR01 / NATIVE-MOBILE-QRO08 — Planner → Workspace → Invitations (the command center).
 *
 * Mirrors the canonical `loadPlannerInvitationProjection` / `loadPhysicalInvitationProjection`
 * server projections (the same functions the desktop Planner reads), fetched through the native
 * Bearer + `grantId` routes. This reader never writes; the command center's explicit operations go
 * through [NativeDomainApiClient]'s write twins and then re-read this projection. Delivery ("Sent")
 * and "Opened" state are read from the server only — never derived or stored on the device.
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

enum class PlannerInvitationDeliveryStatus(val wire: String) {
    SENT("sent"),
    NOT_SENT("not_sent");

    companion object {
        fun fromWire(value: String?): PlannerInvitationDeliveryStatus = if (value == "sent") SENT else NOT_SENT
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
    val email: String? = null,
    val phone: String? = null,
    /** An explicit Planner "Mark sent" record (audit), never inferred from share/copy. */
    val deliveryStatus: PlannerInvitationDeliveryStatus = PlannerInvitationDeliveryStatus.NOT_SENT,
    val deliveryChannel: InvitationDeliveryChannel? = null,
    val deliveredAt: String? = null,
    /** Who recorded the delivery (the Planner/Couple member's name or email). */
    val deliveredBy: String? = null,
    /** When the Guest genuinely redeemed their invitation credential. Planner previews never set it. */
    val openedAt: String? = null,
) {
    /** False when the Guest has no RSVP link yet. This read never issues one. */
    val hasInvitationLink: Boolean get() = qrValue != null

    val tableLabel: String get() = tableNumber?.let { "Table $it" } ?: "No table"

    val isSent: Boolean get() = deliveryStatus == PlannerInvitationDeliveryStatus.SENT
    val isOpened: Boolean get() = openedAt != null
    val hasContact: Boolean get() = !email.isNullOrBlank() || !phone.isNullOrBlank()

    override fun toString(): String =
        "PlannerGuestInvitation(id=$id, status=${status.wire}, delivery=${deliveryStatus.wire}, opened=$isOpened, link=${if (hasInvitationLink) "<redacted>" else "none"})"

    override fun equals(other: Any?): Boolean = other is PlannerGuestInvitation &&
        other.id == id && other.name == name && other.status == status && other.tableNumber == tableNumber &&
        other.checkedIn == checkedIn && other.qrValue == qrValue && other.shareMessage == shareMessage &&
        other.email == email && other.phone == phone && other.deliveryStatus == deliveryStatus &&
        other.deliveryChannel == deliveryChannel && other.deliveredAt == deliveredAt &&
        other.deliveredBy == deliveredBy && other.openedAt == openedAt

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
                email = row.stringOrNull("email"),
                phone = row.stringOrNull("phone"),
                deliveryStatus = PlannerInvitationDeliveryStatus.fromWire(row.stringOrNull("deliveryStatus")),
                deliveryChannel = InvitationDeliveryChannel.fromWire(row.stringOrNull("deliveryChannel")),
                deliveredAt = row.stringOrNull("deliveredAt"),
                deliveredBy = row.stringOrNull("deliveredBy"),
                openedAt = row.stringOrNull("openedAt"),
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

/**
 * NATIVE-MOBILE-QRO08 — command-center search and filters over the canonical projection. Pure and
 * device-local (a view over the server rows); it never changes delivery, open or RSVP state.
 */
enum class InvitationSentFilter(val label: String) { ALL("All"), SENT("Sent"), NOT_SENT("Not sent") }
enum class InvitationOpenedFilter(val label: String) { ALL("All"), OPENED("Opened"), NOT_OPENED("Not opened") }
enum class InvitationContactFilter(val label: String) { ALL("All"), HAS_CONTACT("Has contact"), MISSING_CONTACT("Missing contact") }

data class PlannerInvitationFilter(
    val query: String = "",
    /** null = every RSVP status. */
    val rsvp: PlannerInvitationRsvpStatus? = null,
    val sent: InvitationSentFilter = InvitationSentFilter.ALL,
    val opened: InvitationOpenedFilter = InvitationOpenedFilter.ALL,
    val contact: InvitationContactFilter = InvitationContactFilter.ALL,
) {
    val isActive: Boolean
        get() = query.isNotBlank() || rsvp != null || sent != InvitationSentFilter.ALL ||
            opened != InvitationOpenedFilter.ALL || contact != InvitationContactFilter.ALL

    fun matches(guest: PlannerGuestInvitation): Boolean {
        if (rsvp != null && guest.status != rsvp) return false
        when (sent) {
            InvitationSentFilter.ALL -> Unit
            InvitationSentFilter.SENT -> if (!guest.isSent) return false
            InvitationSentFilter.NOT_SENT -> if (guest.isSent) return false
        }
        when (opened) {
            InvitationOpenedFilter.ALL -> Unit
            InvitationOpenedFilter.OPENED -> if (!guest.isOpened) return false
            InvitationOpenedFilter.NOT_OPENED -> if (guest.isOpened) return false
        }
        when (contact) {
            InvitationContactFilter.ALL -> Unit
            InvitationContactFilter.HAS_CONTACT -> if (!guest.hasContact) return false
            InvitationContactFilter.MISSING_CONTACT -> if (guest.hasContact) return false
        }
        val needle = query.trim().lowercase()
        if (needle.isEmpty()) return true
        val phoneDigits = needle.filter { it.isDigit() }
        return listOfNotNull(guest.name, guest.email, guest.phone, guest.tableNumber?.toString(), guest.tableLabel, guest.deliveredBy)
            .any { it.lowercase().contains(needle) } ||
            (phoneDigits.length >= 3 && guest.phone?.filter { it.isDigit() }?.contains(phoneDigits) == true)
    }

    fun apply(guests: List<PlannerGuestInvitation>): List<PlannerGuestInvitation> = guests.filter(::matches)
}

data class PlannerInvitationSummary(
    val total: Int,
    val sent: Int,
    val notSent: Int,
    val opened: Int,
    val attending: Int,
    val declined: Int,
    val pending: Int,
    val missingContact: Int,
    val missingLinks: Int,
) {
    companion object {
        fun of(guests: List<PlannerGuestInvitation>): PlannerInvitationSummary = PlannerInvitationSummary(
            total = guests.size,
            sent = guests.count { it.isSent },
            notSent = guests.count { !it.isSent },
            opened = guests.count { it.isOpened },
            attending = guests.count { it.status == PlannerInvitationRsvpStatus.ATTENDING },
            declined = guests.count { it.status == PlannerInvitationRsvpStatus.DECLINED },
            pending = guests.count { it.status == PlannerInvitationRsvpStatus.PENDING },
            missingContact = guests.count { !it.hasContact },
            missingLinks = guests.count { !it.hasInvitationLink },
        )
    }
}

/**
 * NATIVE-MOBILE-QRO08 — the explicit Planner operations behind the command center. Implemented by
 * the production repository over [NativeDomainApiClient]'s write twins; the screen re-reads the
 * canonical projection after every successful write, so no delivery state lives on the device.
 */
interface PlannerInvitationOperations {
    suspend fun markSent(guestIds: List<String>, channel: InvitationDeliveryChannel): NativeWriteResult
    suspend fun resetDelivery(guestIds: List<String>): NativeWriteResult
    suspend fun generateMissingLinks(): NativeWriteResult
    suspend fun rotateLink(guestId: String): NativeWriteResult
    suspend fun addGuest(name: String, email: String?, phone: String?): NativeWriteResult
    suspend fun editGuest(guestId: String, name: String, email: String?, phone: String?): NativeWriteResult
    suspend fun deleteGuest(guestId: String): NativeWriteResult
}

/** Planner-facing sentence for a write that did not succeed. */
fun NativeWriteResult.failureMessage(): String? = when (this) {
    is NativeWriteResult.Ok -> null
    is NativeWriteResult.Rejected -> message
    NativeWriteResult.SessionInvalid -> "Your session has ended. Sign in again to continue."
    NativeWriteResult.GrantRevoked -> "Your access to this wedding has changed."
    NativeWriteResult.Forbidden -> "Your role on this wedding cannot change guests or invitations."
    is NativeWriteResult.Transport -> "That change could not be saved. Check your connection and try again."
}

/**
 * QRO08 P2 — the server accepts at most this many Guests per delivery write
 * (`INVITATION_DELIVERY_MAX_BATCH` in `src/lib/planner-invitation-operations.ts`).
 */
const val INVITATION_DELIVERY_MAX_BATCH = 500

/**
 * Outcome of a bulk Mark-sent / Reset over any number of Guests. Each server call is atomic (the
 * whole chunk is recorded or none of it), so [succeeded] is exact: every Guest counted is recorded,
 * every Guest after it is untouched.
 */
data class BulkDeliveryOutcome(
    val requested: Int,
    val succeeded: Int,
    /** The first chunk that failed; later chunks are never sent. Null when everything succeeded. */
    val failure: NativeWriteResult?,
) {
    val complete: Boolean get() = failure == null && succeeded == requested
    val remaining: Int get() = requested - succeeded
}

/**
 * Runs [write] over [guestIds] in deterministic, order-preserving chunks of at most
 * [INVITATION_DELIVERY_MAX_BATCH], stopping at the first failure so a partial result is reported as
 * partial — never as success, and never by silently skipping Guests.
 */
suspend fun runChunkedDelivery(
    guestIds: List<String>,
    chunkSize: Int = INVITATION_DELIVERY_MAX_BATCH,
    write: suspend (List<String>) -> NativeWriteResult,
): BulkDeliveryOutcome {
    require(chunkSize in 1..INVITATION_DELIVERY_MAX_BATCH)
    val ids = guestIds.distinct()
    var succeeded = 0
    for (chunk in ids.chunked(chunkSize)) {
        val result = write(chunk)
        if (result !is NativeWriteResult.Ok) return BulkDeliveryOutcome(ids.size, succeeded, result)
        succeeded += chunk.size
    }
    return BulkDeliveryOutcome(ids.size, succeeded, null)
}

/** Planner-facing sentence for a bulk delivery outcome (null when it fully succeeded). */
fun BulkDeliveryOutcome.partialMessage(action: String): String? {
    val failure = failure ?: return null
    val reason = failure.failureMessage() ?: "The change could not be saved."
    return if (succeeded == 0) {
        "No guests were changed. $reason"
    } else {
        "$action for $succeeded of $requested guests. The remaining $remaining were not changed. $reason Select them and try again."
    }
}
