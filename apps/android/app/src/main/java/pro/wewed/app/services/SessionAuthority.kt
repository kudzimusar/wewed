package pro.wewed.app.services

import pro.wewed.app.models.*

/**
 * Accounts that can sign in to a Shadow build. Only COUPLE is backed by a source relationship;
 * every other account is either the guest's own invitation or an explicit UAT overlay.
 */
enum class ShadowAccount(val key: String) {
    COUPLE("couple"),
    PLANNER("planner"),
    COUPLE_AND_PLANNER("couple_planner"),
    GUEST("guest"),
    VENDOR("vendor"),
    USHER("usher"),
    COORDINATOR("coordinator"),
    ADMIN("admin");

    companion object {
        fun fromKey(raw: String?): ShadowAccount? {
            val key = raw?.trim()?.lowercase()?.replace('-', '_') ?: return null
            return entries.firstOrNull { it.key == key }
        }
    }
}

sealed class SessionAuthorityError(message: String) : IllegalStateException(message) {
    data object ProductionAuthenticationUnavailable :
        SessionAuthorityError("Production sign-in is not available in this native build.")
    data object InvitationTokenRequired :
        SessionAuthorityError("A guest can only sign in with their own invitation link.")
    data object InvitationNotRecognised :
        SessionAuthorityError("This invitation link was not recognised.")
    data object NoVendorEngagement :
        SessionAuthorityError("There is no vendor engagement to scope a vendor session to.")
}

/**
 * Resolves who is signing in and exactly which roles they hold for which wedding.
 * UI never picks a role on its own; it can only choose among the grants returned here.
 */
object SessionAuthority {
    const val DEFAULT_GUEST_INVITATION_TOKEN = "shadow-pending-guest"

    private const val PLANNER_OVERLAY_NOTE =
        "Test access only. This planner's interest was accepted, but no planner engagement is recorded for this wedding."
    private const val VENDOR_OVERLAY_NOTE =
        "Test access only. No vendor sign-in is recorded for this wedding; this session is limited to one vendor's own engagement."
    private const val USHER_OVERLAY_NOTE =
        "Test access only. Gate team sign-ins are not recorded for this wedding."
    private const val COORDINATOR_OVERLAY_NOTE =
        "Test access only. No coordinator membership is recorded for this wedding."
    private const val ADMIN_OVERLAY_NOTE =
        "Test access only. Support access is read-only and every view is recorded in the audit log."

    suspend fun signIn(
        account: ShadowAccount,
        environment: NativeDataEnvironment,
        wedding: WeddingRepository,
        planner: PlannerDashboardRepository,
        invitationToken: String? = null
    ): AuthorizedSession {
        if (!environment.allowsMutableNativeDevelopment) {
            throw SessionAuthorityError.ProductionAuthenticationUnavailable
        }
        if (account == ShadowAccount.GUEST) {
            return signInWithInvitation(invitationToken ?: DEFAULT_GUEST_INVITATION_TOKEN, environment, wedding)
        }

        val record = wedding.getWedding()
        fun overlay(role: AppRole, note: String, vendorId: String? = null) = RoleGrant(
            role = role,
            weddingId = record.id,
            weddingTitle = record.coupleNames,
            provenance = GrantProvenance.SHADOW_TEST_OVERLAY,
            provenanceNote = note,
            vendorId = vendorId
        )
        val coupleGrant = RoleGrant(
            role = AppRole.COUPLE,
            weddingId = record.id,
            weddingTitle = record.coupleNames,
            provenance = if (environment == NativeDataEnvironment.PRIVATE_REAL_SHADOW) {
                GrantProvenance.SOURCE_RECORD
            } else {
                GrantProvenance.SANITIZED_FIXTURE
            },
            provenanceNote = "This account owns the wedding record."
        )

        return when (account) {
            ShadowAccount.COUPLE ->
                AuthorizedSession("couple:${record.id}", record.coupleNames, listOf(coupleGrant))
            ShadowAccount.PLANNER ->
                AuthorizedSession("planner:${record.id}", plannerDisplayName(planner), listOf(overlay(AppRole.PLANNER, PLANNER_OVERLAY_NOTE)))
            ShadowAccount.COUPLE_AND_PLANNER ->
                AuthorizedSession(
                    "couple-planner:${record.id}",
                    record.coupleNames,
                    listOf(coupleGrant, overlay(AppRole.PLANNER, PLANNER_OVERLAY_NOTE))
                )
            ShadowAccount.VENDOR -> {
                val engagement = planner.getVendorEngagements().firstOrNull { !it.vendorId.isNullOrBlank() }
                    ?: throw SessionAuthorityError.NoVendorEngagement
                AuthorizedSession(
                    "vendor:${engagement.vendorId}",
                    engagement.vendorName,
                    listOf(overlay(AppRole.VENDOR, VENDOR_OVERLAY_NOTE, vendorId = engagement.vendorId))
                )
            }
            ShadowAccount.USHER ->
                AuthorizedSession("usher:${record.id}", "Gate team", listOf(overlay(AppRole.USHER, USHER_OVERLAY_NOTE)))
            ShadowAccount.COORDINATOR ->
                AuthorizedSession("coordinator:${record.id}", "Wedding-day coordinator", listOf(overlay(AppRole.COORDINATOR, COORDINATOR_OVERLAY_NOTE)))
            ShadowAccount.ADMIN ->
                AuthorizedSession("admin:support", "Wewed support", listOf(overlay(AppRole.ADMIN, ADMIN_OVERLAY_NOTE)))
            ShadowAccount.GUEST -> error("handled above")
        }
    }

    /** A guest proves who they are with their own invitation; the grant is pinned to that guest record. */
    suspend fun signInWithInvitation(
        token: String,
        environment: NativeDataEnvironment,
        wedding: WeddingRepository
    ): AuthorizedSession {
        if (!environment.allowsMutableNativeDevelopment) {
            throw SessionAuthorityError.ProductionAuthenticationUnavailable
        }
        val trimmed = token.trim()
        if (trimmed.isEmpty()) throw SessionAuthorityError.InvitationTokenRequired
        val record = wedding.getWedding()
        val invitation = runCatching { wedding.resolveInvitation(record.id, trimmed) }
            .getOrElse { throw SessionAuthorityError.InvitationNotRecognised }
        val guestId = invitation.guestId ?: throw SessionAuthorityError.InvitationNotRecognised
        return AuthorizedSession(
            accountId = "guest:$guestId",
            displayName = invitation.guestName,
            grants = listOf(
                RoleGrant(
                    role = AppRole.GUEST,
                    weddingId = record.id,
                    weddingTitle = record.coupleNames,
                    provenance = GrantProvenance.INVITATION_TOKEN,
                    provenanceNote = "Signed in with this guest's own invitation.",
                    guestId = guestId
                )
            )
        )
    }

    private suspend fun plannerDisplayName(planner: PlannerDashboardRepository): String =
        planner.getDashboard().plannerContext.substringBefore(" •").trim().ifEmpty { "Planner" }
}
