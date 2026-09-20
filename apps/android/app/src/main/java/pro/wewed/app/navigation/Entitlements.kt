package pro.wewed.app.navigation

import pro.wewed.app.models.AppRole

/**
 * IA V2 §13.4 — the entitlement gate.
 *
 *   requested route -> authenticated actor -> active role -> active context
 *   -> capability check -> repository request -> UI state
 *
 * Hidden navigation is never the authorization mechanism (IA V2 §13.4); every route resolves
 * through [resolve] before a repository is touched.
 */
object Entitlements {

    private val capabilitiesByRole: Map<AppRole, Set<String>> = mapOf(
        AppRole.COUPLE to setOf(
            "plan.read", "plan.write", "tasks.read", "tasks.write", "budget.read", "budget.write",
            "contributions.read", "vendors.read", "seating.read", "seating.write", "timeline.read",
            "documents.read", "guests.roster.read", "guests.roster.write", "invitations.send",
            "weddingday.read", "pass.self", "messages.read", "messages.write", "account.self"
        ),
        AppRole.PLANNER to setOf(
            "plan.read", "plan.write", "tasks.read", "tasks.write", "budget.read", "budget.write",
            "contributions.read", "contributions.write", "vendors.read", "vendors.write",
            "seating.read", "seating.write", "timeline.read", "timeline.write", "documents.read",
            "documents.write", "guests.roster.read", "guests.roster.write", "invitations.send",
            "weddingday.read", "weddingday.operate", "gate.admissions.read", "incidents.read",
            "incidents.write", "clients.read", "clients.write", "dailyops.read", "messages.read",
            "messages.write", "pass.issue", "account.self"
        ),
        AppRole.GUEST to setOf(
            "invitation.self", "rsvp.self", "pass.self", "weddingday.read", "messages.write", "account.self"
        ),
        AppRole.VENDOR to setOf(
            "vendor.jobs.own", "vendor.schedule.own", "vendor.contract.own", "vendor.payment.own",
            "vendor.files.own", "messages.read", "messages.write", "account.self"
        ),
        AppRole.USHER to setOf(
            "gate.scan", "gate.admissions.read", "gate.admissions.write", "guests.operational.read",
            "incidents.read", "incidents.write", "weddingday.read", "account.self"
        ),
        AppRole.COORDINATOR to setOf(
            "weddingday.read", "weddingday.operate", "timeline.read", "timeline.write", "tasks.read",
            "tasks.write", "vendors.read", "gate.admissions.read", "incidents.read", "incidents.write",
            "team.read", "team.write", "documents.read", "messages.read", "messages.write", "account.self"
        ),
        AppRole.ADMIN to setOf(
            "admin.dashboard", "admin.cases.read", "admin.cases.write", "admin.accounts.read",
            "admin.accounts.write", "admin.audit.read", "admin.system.read", "admin.config.write",
            "account.self"
        )
    )

    /**
     * Capability required to open each Level-1 destination, keyed by "<roleId>/<destinationId>".
     * A destination with no entry requires only that the role owns it in the contract.
     */
    private val destinationCapability: Map<String, String> = mapOf(
        "couple/plan" to "plan.read",
        "couple/guests" to "guests.roster.read",
        "couple/wedding_day" to "weddingday.read",
        "planner/workspace" to "plan.read",
        "planner/clients" to "clients.read",
        "planner/daily_ops" to "dailyops.read",
        "planner/wedding_day" to "weddingday.operate",
        "guest/invitation" to "invitation.self",
        "guest/pass" to "pass.self",
        "guest/wedding_day" to "weddingday.read",
        "vendor/jobs" to "vendor.jobs.own",
        "vendor/schedule" to "vendor.schedule.own",
        "vendor/messages" to "messages.read",
        "usher/scan" to "gate.scan",
        "usher/admissions" to "gate.admissions.read",
        "usher/guests" to "guests.operational.read",
        "usher/incidents" to "incidents.read",
        "coordinator/today" to "weddingday.read",
        "coordinator/run_sheet" to "timeline.read",
        "coordinator/team" to "team.read",
        "coordinator/wedding_day" to "weddingday.operate",
        "admin/dashboard" to "admin.dashboard",
        "admin/cases" to "admin.cases.read",
        "admin/accounts" to "admin.accounts.read",
        "admin/audit" to "admin.audit.read"
    )

    fun capabilities(role: AppRole): Set<String> = capabilitiesByRole[role].orEmpty()

    fun can(role: AppRole, capability: String): Boolean = capabilities(role).contains(capability)

    /** Outcome of resolving a requested route against actor, role, context and entitlement. */
    sealed interface Resolution {
        data class Allowed(val destination: PrimaryDestination, val context: NavigationContext) : Resolution
        /** Unauthorized: explain the boundary, leak no destination data, offer a safe return (IA V2 §14). */
        data class Denied(val reason: String, val safeReturnDestinationId: String) : Resolution
    }

    /**
     * IA V2 §13.4 / §14. Deep links and notifications resolve through this same path, so an
     * unauthorized link cannot bypass the gate by arriving from outside the app.
     */
    fun resolve(context: NavigationContext, destinationId: String): Resolution {
        val navigation = IANavigationContract.forRole(context.activeRole)
        val safeReturn = navigation.primary.first().id

        val destination = navigation.destination(destinationId)
            ?: return Resolution.Denied(
                "This area is not part of the ${navigation.displayName} workspace.",
                safeReturn
            )

        if (!context.isComplete) {
            return Resolution.Denied(
                "No active wedding is selected for this workspace.",
                safeReturn
            )
        }

        val required = destinationCapability["${context.activeRole.roleId}/$destinationId"]
        if (required != null && !can(context.activeRole, required)) {
            return Resolution.Denied(
                "Your ${navigation.displayName} role does not include access to ${destination.label}.",
                safeReturn
            )
        }

        return Resolution.Allowed(destination, context)
    }
}
