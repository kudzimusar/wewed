package pro.wewed.app.services

import pro.wewed.app.models.AppRole
import pro.wewed.app.models.Capability
import pro.wewed.app.models.Capability.*

/**
 * Least-privilege role policy. Mirrored exactly by the iOS CapabilityPolicy;
 * the cross-platform tests assert the same matrix on both.
 */
object CapabilityPolicy {
    private val publicWeddingInfo = setOf(VIEW_WEDDING_SUMMARY, VIEW_PROGRAMME)

    private val weddingManagement = publicWeddingInfo + setOf(
        VIEW_PLANNING_DASHBOARD,
        VIEW_TASKS,
        MANAGE_TASKS,
        VIEW_BUDGET,
        VIEW_GUEST_ROSTER,
        VIEW_CONTRIBUTIONS,
        VIEW_CONTRIBUTOR_IDENTITY,
        VIEW_ALL_VENDOR_ENGAGEMENTS,
        VIEW_VENDOR_PRESENCE,
        VIEW_SEATING,
        VIEW_DOCUMENTS,
        EDIT_WEDDING_DETAILS,
        PREVIEW_GUEST_PASSES,
        VIEW_ADMISSION_SUMMARY,
        SCAN_ADMISSION,
        LOOKUP_ADMISSION
    )

    private val gateOperations = setOf(SCAN_ADMISSION, LOOKUP_ADMISSION, VIEW_ADMISSION_SUMMARY)

    fun capabilities(role: AppRole): Set<Capability> = when (role) {
        AppRole.COUPLE -> weddingManagement
        AppRole.PLANNER -> weddingManagement + setOf(PLANNER_WORKSPACE, PLANNER_ACTIONS, POST_ANNOUNCEMENT)
        AppRole.COORDINATOR -> publicWeddingInfo + gateOperations + setOf(VIEW_TASKS, VIEW_VENDOR_PRESENCE, POST_ANNOUNCEMENT)
        AppRole.VENDOR -> publicWeddingInfo + setOf(VIEW_OWN_VENDOR_ENGAGEMENT, UPDATE_OWN_VENDOR_PRESENCE)
        AppRole.USHER -> publicWeddingInfo + gateOperations
        AppRole.GUEST -> publicWeddingInfo + setOf(VIEW_OWN_INVITATION, RESPOND_OWN_RSVP, VIEW_OWN_PASS)
        AppRole.ADMIN -> setOf(VIEW_WEDDING_SUMMARY, ADMIN_SUPPORT)
    }

    fun allows(role: AppRole, capability: Capability): Boolean = capability in capabilities(role)
}
