package pro.wewed.app.models

/**
 * What a signed-in person may do. Shells and data access are gated on these,
 * never on the mere presence of a screen in the binary.
 */
enum class Capability {
    VIEW_WEDDING_SUMMARY,
    VIEW_PROGRAMME,
    VIEW_PLANNING_DASHBOARD,
    VIEW_TASKS,
    MANAGE_TASKS,
    VIEW_BUDGET,
    VIEW_GUEST_ROSTER,
    VIEW_CONTRIBUTIONS,
    VIEW_CONTRIBUTOR_IDENTITY,
    VIEW_ALL_VENDOR_ENGAGEMENTS,
    VIEW_OWN_VENDOR_ENGAGEMENT,
    VIEW_VENDOR_PRESENCE,
    UPDATE_OWN_VENDOR_PRESENCE,
    VIEW_SEATING,
    VIEW_DOCUMENTS,
    EDIT_WEDDING_DETAILS,
    PREVIEW_GUEST_PASSES,
    VIEW_OWN_INVITATION,
    RESPOND_OWN_RSVP,
    VIEW_OWN_PASS,
    SCAN_ADMISSION,
    LOOKUP_ADMISSION,
    VIEW_ADMISSION_SUMMARY,
    POST_ANNOUNCEMENT,
    PLANNER_WORKSPACE,
    PLANNER_ACTIONS,
    ADMIN_SUPPORT
}

/** Where an authorization came from. Only SOURCE_RECORD and INVITATION_TOKEN reflect real relationships. */
enum class GrantProvenance {
    /** Backed by a real record in the wedding graph (e.g. Couple.userId owns Wedding.coupleId). */
    SOURCE_RECORD,
    /** The guest proved possession of their own invitation link. */
    INVITATION_TOKEN,
    /** Git-safe sanitized dataset; no real relationship exists. */
    SANITIZED_FIXTURE,
    /** Explicit UAT-only authorization. Never a production relationship. */
    SHADOW_TEST_OVERLAY
}

data class RoleGrant(
    val role: AppRole,
    val weddingId: String,
    val weddingTitle: String,
    val provenance: GrantProvenance,
    /** Plain-language explanation of why this grant exists; shown where the grant is a test overlay. */
    val provenanceNote: String,
    /** Guest scope: the single guest record this grant may see. */
    val guestId: String? = null,
    /** Vendor scope: the single vendor whose engagement this grant may see. */
    val vendorId: String? = null
) {
    val isTestOverlay: Boolean get() = provenance == GrantProvenance.SHADOW_TEST_OVERLAY
}

data class AuthorizedSession(
    val accountId: String,
    val displayName: String,
    val grants: List<RoleGrant>
) {
    init {
        require(grants.isNotEmpty()) { "An authorized session needs at least one role grant." }
    }

    val requiresRoleChoice: Boolean get() = grants.size > 1

    fun grantFor(role: AppRole): RoleGrant? = grants.firstOrNull { it.role == role }
}

class AccessDeniedException(val role: AppRole, val capability: Capability) :
    SecurityException("${role.roleId} is not authorized for ${capability.name}")

/** The minimum a gate needs to admit a party. No RSVP history, no side, no contact details. */
data class AdmissionLookupRow(
    val guestId: String,
    val displayName: String,
    val partySize: Int,
    val admittedCount: Int,
    val tableName: String?
) {
    val remaining: Int get() = (partySize - admittedCount).coerceAtLeast(0)
}

data class AdmissionSummary(
    val attendingParties: Int,
    val expectedGuests: Int,
    val admittedGuests: Int
)

data class AdminAuditEntry(
    val section: String,
    val weddingId: String,
    val recordedAtMillis: Long
)

data class WeddingDetailsUpdate(
    val coupleNames: String,
    val date: String,
    val venueName: String,
    val city: String,
    val country: String
)
