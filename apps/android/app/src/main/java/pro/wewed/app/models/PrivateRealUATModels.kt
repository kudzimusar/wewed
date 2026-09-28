package pro.wewed.app.models

/**
 * Where a value in a native model came from.
 *
 * Earlier phases could not tell a production fact from a fabricated relationship: a planner
 * "engagement" that production did not hold rendered exactly like one it did. Provenance makes that
 * distinction part of the data rather than a comment, so tests can assert it and surfaces can state
 * it honestly. It is not primarily a user-facing label.
 */
enum class DataProvenance(val wire: String) {
    /** Copied from an authorized read of production. */
    PRODUCTION_DERIVED("PRODUCTION_DERIVED"),

    /** Granted for UAT only — real actor, real wedding, but not a production relationship. */
    UAT_OVERLAY("UAT_OVERLAY"),

    /** Computed from production-derived values (totals, percentages, groupings). */
    DERIVED("DERIVED"),

    /** Changed inside the local UAT session; never written back to production. */
    SHADOW_MUTATION("SHADOW_MUTATION"),

    /** Production genuinely holds no row. Distinct from "we could not read it". */
    ABSENT("ABSENT"),

    /** A grant is missing. Distinct from ABSENT: the rows may well exist. */
    NOT_AUTHORIZED("NOT_AUTHORIZED");

    companion object {
        fun fromWire(value: String?): DataProvenance =
            entries.find { it.wire == value } ?: PRODUCTION_DERIVED
    }
}

/**
 * Identifies the snapshot the runtime actually loaded.
 *
 * Provisioning used to fail silently, leaving the device on an older snapshot while the badge still
 * read "Private Real". Surfacing the schema version, content hash and per-domain counts makes the
 * loaded graph testable instead of assumed. Not shown to ordinary production users.
 */
data class UatSnapshotManifest(
    val schemaVersion: String,
    val sourceWeddingId: String,
    val generatedAt: String,
    val contentHashPrefix: String,
    val domainCounts: Map<String, Int>
) {
    fun count(domain: String): Int = domainCounts[domain] ?: 0
}

/** The full RSVP record behind a guest, beyond the attending/declined summary. */
data class GuestRsvpDetail(
    val id: String,
    val guestId: String,
    val attending: Boolean?,
    val mealChoice: String? = null,
    val plusOne: Boolean = false,
    val plusOneName: String? = null,
    val plusOneMeal: String? = null,
    val kidsAttending: Boolean = false,
    val kidsCount: Int = 0,
    val songRequests: String? = null,
    val dietaryNotes: String? = null,
    val message: String? = null,
    val checkedIn: Boolean = false,
    val checkedInAt: String? = null,
    val provenance: DataProvenance = DataProvenance.PRODUCTION_DERIVED
) {
    val hasDietaryRequirement: Boolean get() = !dietaryNotes.isNullOrBlank()
    val hasSongRequest: Boolean get() = !songRequests.isNullOrBlank()
    val hasMessage: Boolean get() = !message.isNullOrBlank()

    /**
     * What the Gate may see. Admission needs identity and party size, never a guest's dietary
     * requirements, contact details or private message.
     */
    fun operationalOnly(): GuestRsvpDetail = GuestRsvpDetail(
        id = id,
        guestId = guestId,
        attending = attending,
        plusOne = plusOne,
        kidsAttending = kidsAttending,
        kidsCount = kidsCount,
        checkedIn = checkedIn,
        checkedInAt = checkedInAt,
        provenance = provenance
    )
}

/** Authorized contact and role detail for a guest. Couple and authorized Planner only. */
data class GuestContactDetail(
    val guestId: String,
    val email: String? = null,
    val phone: String? = null,
    val role: String? = null,
    val roleDetail: String? = null,
    val provenance: DataProvenance = DataProvenance.PRODUCTION_DERIVED
)

/**
 * One production `WeddingContent` row: a section/field/value triple.
 *
 * The wedding's story, venue notes, FAQ, travel information and gallery all live in this one table,
 * which is why treating it as "unsupported" blanked twelve real surfaces at once.
 */
data class WeddingContentEntry(
    val id: String,
    val section: String,
    val field: String,
    val value: String,
    val order: Int = 0,
    val metadata: String? = null,
    val provenance: DataProvenance = DataProvenance.PRODUCTION_DERIVED
) {
    /** True when the value is a media reference rather than prose. */
    val isMediaReference: Boolean
        get() = value.startsWith("http://") || value.startsWith("https://") ||
            value.startsWith("/uploads/") || value.startsWith("data:image/")
}

/** All content for one section, ordered as the couple arranged it. */
data class WeddingContentSection(
    val section: String,
    val title: String,
    val entries: List<WeddingContentEntry>
) {
    val isEmpty: Boolean get() = entries.isEmpty()
    fun value(field: String): String? = entries.firstOrNull { it.field == field }?.value
    val mediaEntries: List<WeddingContentEntry> get() = entries.filter { it.isMediaReference }
    val proseEntries: List<WeddingContentEntry> get() = entries.filterNot { it.isMediaReference }

    companion object {
        /** Display titles for the production section keys. */
        val TITLES = mapOf(
            "hero" to "Hero",
            "story" to "Our Story",
            "gallery" to "Gallery",
            "venue" to "Venue",
            "faq" to "FAQ",
            "travel" to "Travel",
            "theday" to "The Day",
            "guests" to "Guests",
            "vendors" to "Vendors",
            "songbook" to "Songbook",
            "memory" to "Memory",
            "after" to "After"
        )

        fun titleFor(section: String): String =
            TITLES[section] ?: section.replaceFirstChar { it.uppercase() }
    }
}

/** A songbook entry as the couple recorded it. */
data class SongEntry(
    val id: String,
    val title: String,
    val artist: String? = null,
    val phase: String? = null,
    val moment: String? = null,
    val order: Int = 0,
    val votes: Int = 0,
    val notes: String? = null,
    val playedAt: String? = null,
    val spotifyUrl: String? = null,
    val appleUrl: String? = null,
    val provenance: DataProvenance = DataProvenance.PRODUCTION_DERIVED
) {
    val hasStreamingLink: Boolean get() = !spotifyUrl.isNullOrBlank() || !appleUrl.isNullOrBlank()

    /**
     * Guests see the song, not the couple's planning notes about it.
     */
    fun guestVisible(): SongEntry = copy(notes = null)
}

/** A real scan destination. This is routing configuration, never pass signing material. */
data class QrDestination(
    val id: String,
    val label: String,
    val type: String,
    val url: String,
    val isActive: Boolean = true,
    val scanCount: Int = 0,
    val provenance: DataProvenance = DataProvenance.PRODUCTION_DERIVED
)

/** A completed data import. Rollback payloads and preview rows are deliberately not carried. */
data class ImportJobRecord(
    val id: String,
    val moduleKey: String,
    val fileName: String? = null,
    val status: String,
    val totalRows: Int = 0,
    val createdCount: Int = 0,
    val updatedCount: Int = 0,
    val skippedCount: Int = 0,
    val errorCount: Int = 0,
    val performedAt: String? = null,
    val provenance: DataProvenance = DataProvenance.PRODUCTION_DERIVED
) {
    val succeeded: Boolean get() = status.equals("completed", true) || status.equals("success", true)
    val moduleTitle: String
        get() = moduleKey.replace('_', ' ').replaceFirstChar { it.uppercase() }
}

/**
 * A public wedding-wall message.
 *
 * Production holds these as `type = "wall"`, `isPublic = true`. They are guest-facing wall posts and
 * are NOT planner-to-couple private correspondence; conflating the two would misrepresent both.
 */
data class WallMessage(
    val id: String,
    val authorName: String?,
    val content: String,
    val type: String,
    val isPublic: Boolean,
    val revealedAt: String? = null,
    val createdAt: String? = null,
    val provenance: DataProvenance = DataProvenance.PRODUCTION_DERIVED
)

/** Content-management history for a wedding-content field. Not exposed to guests. */
data class ContentRevisionRecord(
    val id: String,
    val section: String,
    val fieldKey: String,
    val status: String,
    val publishedAt: String? = null,
    val scheduledFor: String? = null,
    val authorId: String? = null,
    val hasPreviousValue: Boolean = false,
    val provenance: DataProvenance = DataProvenance.PRODUCTION_DERIVED
) {
    val isPublished: Boolean get() = status.equals("published", true) || publishedAt != null
    val isScheduled: Boolean get() = scheduledFor != null && !isPublished
}

/** A named party to a service engagement — the real contractual relation, not a vendor-name guess. */
data class EngagementPartyRecord(
    val id: String,
    val serviceEngagementId: String,
    val partyKind: String,
    val partyRole: String,
    val displayName: String,
    val legalName: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val authorityBasis: String? = null,
    val status: String? = null,
    val requiredForReview: Boolean = false,
    val provenance: DataProvenance = DataProvenance.PRODUCTION_DERIVED
)

/**
 * A wedding-scoped audit entry.
 *
 * Only the fields the Admin surface needs are carried. Request forensics (IP address, user agent)
 * and before/after values are deliberately not part of the native model, so they cannot leak
 * through a screen that merely lists activity.
 */
data class AuditEventRecord(
    val id: String,
    val action: String,
    val actorId: String? = null,
    val resourceType: String? = null,
    val resourceId: String? = null,
    val createdAt: String? = null,
    val provenance: DataProvenance = DataProvenance.PRODUCTION_DERIVED
)

/**
 * How the active planner reaches this wedding.
 *
 * Production holds no PlannerEngagement and no WeddingMembership for Eleven Eleven Testing on
 * Charity & Kudzie. The UAT overlay authorizes the planner to exercise the wedding, and this model
 * keeps that fact visible instead of implying a contract that does not exist.
 */
data class PlannerAccessContext(
    val businessName: String?,
    val profileStatus: String?,
    val teamSize: Int?,
    val completedWeddings: Int?,
    val enquiryStatus: String?,
    val productionEngagementCount: Int,
    val productionMembershipCount: Int,
    val accessBasis: DataProvenance
) {
    val isProductionEngagement: Boolean get() = accessBasis == DataProvenance.PRODUCTION_DERIVED

    /** One honest sentence for the workspace header. */
    val accessDescription: String
        get() = if (isProductionEngagement) {
            "Production engagement"
        } else {
            "UAT test access — no production engagement on record"
        }
}

/** Why an Admin surface has nothing to show. */
data class AdminAccessContext(
    val status: String,
    val deniedDomains: List<String>,
    val emptyDomains: List<String>,
    val note: String
) {
    val isBlockedByAuthorization: Boolean get() = status == "BLOCKED_BY_AUTHORIZATION"
}
