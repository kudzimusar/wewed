package pro.wewed.app.navigation

import pro.wewed.app.models.AppRole

/**
 * Wewed Native Information Architecture V2 — Level-1 / Level-2 navigation contract.
 *
 * Authority: docs/native-mobile/WEWED_NATIVE_INFORMATION_ARCHITECTURE_V2.md
 * Cross-platform source of truth: mobile/contracts/ia-v2-navigation.json
 *
 * This file is the ONLY place Android declares role navigation topology. Role shells render
 * from it, so a label/order change is impossible to make in one screen and miss in another.
 * IANavigationContractTest asserts this declaration equals the shared JSON contract, which the
 * iOS target asserts against too — that is what makes Android/iOS parity a machine-checked fact.
 */

/** A Level-1 bottom-navigation destination. Destinations are workspaces, never actions. */
data class PrimaryDestination(
    val id: String,
    val label: String,
    /** Documented Level-2 workspace taxonomy. Empty = single-view workspace. */
    val sections: List<String> = emptyList()
)

/** Optional context dimensions a role operates within, beyond the always-present wedding. */
enum class ContextScope(val key: String) {
    WEDDING("wedding"),
    CLIENT("client"),
    /** The vendor company (P0-9). */
    VENDOR("vendor"),
    ENGAGEMENT("engagement"),
    GATE("gate"),
    /** Which guest record the actor *is* (P0-4). */
    GUEST("guest"),
    /** Global administrative scope, not tied to one wedding (P0-15). */
    SYSTEM("system")
}

data class RoleNavigation(
    val role: AppRole,
    val displayName: String,
    /** Context dimensions this role uses, and how strongly it depends on each (P0-3). */
    val scopes: List<ScopeDeclaration>,
    val primary: List<PrimaryDestination>
) {
    val contextScopes: List<ContextScope> get() = scopes.map { it.scope }

    fun requirement(scope: ContextScope): ScopeRequirement? =
        scopes.firstOrNull { it.scope == scope }?.requirement

    val requiredScopes: List<ContextScope>
        get() = scopes.filter { it.requirement == ScopeRequirement.REQUIRED }.map { it.scope }

    /** True when this role operates at system level rather than inside one wedding. */
    val isSystemScoped: Boolean
        get() = scopes.any { it.scope == ContextScope.SYSTEM }

    /** Level-1 labels in order — the bottom-navigation contract. */
    val labels: List<String> get() = primary.map { it.label }

    fun destination(id: String): PrimaryDestination? = primary.firstOrNull { it.id == id }

    fun sections(destinationId: String): List<String> = destination(destinationId)?.sections.orEmpty()
}

object IANavigationContract {

    const val CONTRACT_ID = "WW-NATIVE-IA-V2-NAV-2026-09-20-03"

    private val couple = RoleNavigation(
        role = AppRole.COUPLE,
        displayName = "Couple",
        scopes = listOf(ScopeDeclaration(ContextScope.WEDDING, ScopeRequirement.REQUIRED)),
        primary = listOf(
            PrimaryDestination("home", "Home"),
            PrimaryDestination(
                "plan", "Plan",
                listOf("Overview", "Tasks", "Budget", "Contributions", "Vendors", "Seating", "Timeline", "Documents")
            ),
            PrimaryDestination(
                "guests", "Guests",
                listOf("Guest List", "RSVP", "Invitations", "Groups / Households", "Seating", "Messages", "Passes / QR")
            ),
            PrimaryDestination(
                "wedding_day", "Wedding Day",
                listOf("My Pass", "Programme", "Venue & Maps", "Key Contacts", "Vendor Status", "Announcements", "Wedding-day Checklist")
            ),
            PrimaryDestination(
                "more", "More",
                listOf("Wedding Profile", "Our Story", "Gallery", "Honeymoon", "Documents", "Settings", "Help & Support", "Account")
            )
        )
    )

    private val planner = RoleNavigation(
        role = AppRole.PLANNER,
        displayName = "Professional Planner",
        scopes = listOf(
            ScopeDeclaration(ContextScope.WEDDING, ScopeRequirement.REQUIRED),
            ScopeDeclaration(ContextScope.CLIENT, ScopeRequirement.OPTIONAL)
        ),
        primary = listOf(
            PrimaryDestination(
                "workspace", "Workspace",
                listOf("Overview", "Tasks", "Budget", "Guests", "Vendors", "Contributions", "Seating", "Timeline", "Documents")
            ),
            PrimaryDestination(
                "clients", "Clients",
                listOf("Active Weddings", "Upcoming Weddings", "Enquiries", "Archived Weddings", "Client Profiles", "Team Assignment")
            ),
            PrimaryDestination(
                "daily_ops", "Daily Ops",
                listOf("Today", "Overdue", "Approvals", "Messages", "Upcoming Deadlines", "Vendor Follow-ups", "Guest Issues", "Payments Requiring Attention", "Team Activity")
            ),
            PrimaryDestination(
                "wedding_day", "Wedding Day",
                listOf("Run Sheet", "Programme", "Gate / Admissions", "Vendor Arrivals", "Coordinator Tasks", "Guest Issues", "Incidents", "Live Notes", "Emergency Contacts", "Offline Status")
            ),
            PrimaryDestination(
                "more", "More",
                listOf("Team Hub", "Client Profile", "Invitations & QR", "Intelligence", "Files / Documents", "Planner Actions", "Account", "Settings", "Help & Support")
            )
        )
    )

    private val guest = RoleNavigation(
        role = AppRole.GUEST,
        displayName = "Attending Guest",
        scopes = listOf(
            ScopeDeclaration(ContextScope.WEDDING, ScopeRequirement.REQUIRED),
            ScopeDeclaration(ContextScope.GUEST, ScopeRequirement.REQUIRED)
        ),
        primary = listOf(
            PrimaryDestination("home", "Home"),
            PrimaryDestination(
                "invitation", "Invitation",
                listOf("Invitation", "RSVP", "Party Members", "Dietary / Accessibility", "Message to Couple", "Contribution / Memory")
            ),
            PrimaryDestination(
                "pass", "Pass",
                listOf("Wedding Pass", "QR", "Party Size", "Table", "Admission State", "Open in Maps")
            ),
            PrimaryDestination(
                "wedding_day", "Wedding Day",
                listOf("Programme", "Venue", "Maps", "Table", "Announcements", "Contacts", "Gallery / Live Wall")
            ),
            PrimaryDestination(
                "more", "More",
                listOf("Our Story", "Gallery", "Contribution / Gift Info", "Help", "Account", "Privacy")
            )
        )
    )

    private val vendor = RoleNavigation(
        role = AppRole.VENDOR,
        displayName = "Vendor & Staff",
        scopes = listOf(
            ScopeDeclaration(ContextScope.WEDDING, ScopeRequirement.REQUIRED),
            // The vendor company must be known; a specific engagement is selectable, because a
            // vendor may hold several and some are historical records rather than live work.
            ScopeDeclaration(ContextScope.VENDOR, ScopeRequirement.REQUIRED),
            ScopeDeclaration(ContextScope.ENGAGEMENT, ScopeRequirement.OPTIONAL)
        ),
        primary = listOf(
            PrimaryDestination("home", "Home"),
            PrimaryDestination(
                "jobs", "Jobs",
                listOf("Service Details", "Deliverables", "Tasks", "Client / Planner Contacts", "Venue", "Contract", "Payment", "Files", "Notes")
            ),
            PrimaryDestination(
                "schedule", "Schedule",
                listOf("Calendar", "Arrival Time", "Setup", "Service Window", "Breakdown", "Dependencies")
            ),
            PrimaryDestination("messages", "Messages"),
            PrimaryDestination(
                "more", "More",
                listOf("Company Profile", "Services", "Contracts", "Payments", "Files", "Settings", "Support", "Account")
            )
        )
    )

    private val usher = RoleNavigation(
        role = AppRole.USHER,
        displayName = "Gate Team",
        scopes = listOf(
            ScopeDeclaration(ContextScope.WEDDING, ScopeRequirement.REQUIRED),
            ScopeDeclaration(ContextScope.GATE, ScopeRequirement.REQUIRED)
        ),
        primary = listOf(
            PrimaryDestination("scan", "Scan"),
            PrimaryDestination(
                "admissions", "Admissions",
                listOf("Checked In", "Not Arrived", "Partial Parties", "Duplicate Scans", "Exceptions", "Manual Admission")
            ),
            PrimaryDestination("guests", "Guests"),
            PrimaryDestination(
                "incidents", "Incidents",
                listOf("Admission Exception", "Lost Pass", "Guest Dispute", "Accessibility Assistance", "Security Note", "Coordinator Escalation")
            ),
            PrimaryDestination(
                "more", "More",
                listOf("Gate Assignment", "Offline Status", "Sync Status", "Venue Map", "Help", "Account")
            )
        )
    )

    private val coordinator = RoleNavigation(
        role = AppRole.COORDINATOR,
        displayName = "Day-of Coordinator",
        scopes = listOf(ScopeDeclaration(ContextScope.WEDDING, ScopeRequirement.REQUIRED)),
        primary = listOf(
            PrimaryDestination("today", "Today"),
            PrimaryDestination("run_sheet", "Run Sheet"),
            PrimaryDestination(
                "team", "Team",
                listOf("Tasks", "Vendors", "Ushers", "Staff", "Assignments", "Contacts")
            ),
            PrimaryDestination(
                "wedding_day", "Wedding Day",
                listOf("Gate", "Admissions", "Vendor Arrivals", "Venue Zones", "Incidents", "Announcements", "Programme Status")
            ),
            PrimaryDestination(
                "more", "More",
                listOf("Documents", "Notes", "Maps", "Offline", "Support", "Account")
            )
        )
    )

    private val admin = RoleNavigation(
        role = AppRole.ADMIN,
        displayName = "Support / Admin",
        scopes = listOf(
            ScopeDeclaration(ContextScope.SYSTEM, ScopeRequirement.REQUIRED),
            ScopeDeclaration(ContextScope.WEDDING, ScopeRequirement.OPTIONAL),
            ScopeDeclaration(ContextScope.CLIENT, ScopeRequirement.OPTIONAL)
        ),
        primary = listOf(
            PrimaryDestination("dashboard", "Dashboard"),
            PrimaryDestination("cases", "Cases"),
            PrimaryDestination(
                "accounts", "Accounts",
                listOf("Couples", "Planners", "Vendors", "Guests", "Access", "Role Memberships")
            ),
            PrimaryDestination(
                "audit", "Audit",
                listOf("Data Changes", "Access Events", "Payments", "Contracts", "Check-ins", "Admin Actions")
            ),
            PrimaryDestination(
                "more", "More",
                listOf("System Health", "Integrations", "Templates", "Configuration", "Announcements", "Help", "Admin Profile")
            )
        )
    )

    /** Role key as used by the shared JSON contract and AppRole.roleId. */
    val all: Map<AppRole, RoleNavigation> = mapOf(
        AppRole.COUPLE to couple,
        AppRole.PLANNER to planner,
        AppRole.GUEST to guest,
        AppRole.VENDOR to vendor,
        AppRole.USHER to usher,
        AppRole.COORDINATOR to coordinator,
        AppRole.ADMIN to admin
    )

    fun forRole(role: AppRole): RoleNavigation =
        all[role] ?: error("IA V2 contract missing navigation for role ${role.roleId}")
}
