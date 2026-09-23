package pro.wewed.app.services

import pro.wewed.app.models.NativeDataEnvironment

/**
 * System-level administrative projection (P0-13).
 *
 * Admin is system-scoped in IA V2: Dashboard, Cases, Accounts and Audit describe the platform,
 * not one wedding. Reading them from the wedding graph forced a global console to depend on an
 * active wedding, which is why Admin previously needed a wedding context just to open.
 *
 * Wedding-scoped data is loaded only after an administrator deliberately drills into a wedding.
 */
/** Master plan Phase 8 closure §4 — one row from the real, shared `loadAdminOverview` engine. */
data class AdminAccountSummary(
    val id: String,
    val name: String,
    val type: String,
    val status: String,
    val onboardingStatus: String,
    val riskFlags: List<String>,
)

data class AdminSupportCaseSummary(
    val id: String,
    val title: String,
    val status: String,
    val priority: String,
    val businessAccountName: String?,
)

data class AdminIncidentSummary(
    val id: String,
    val title: String,
    val status: String,
    val severity: String,
)

data class AdminSystemSnapshot(
    val environment: NativeDataEnvironment,
    /** Weddings this administrator may act on; the console itself does not require one. */
    val weddingsInScope: Int,
    /** Native contracts that do not exist yet, surfaced as honest unsupported states. */
    val unsupportedStreams: List<String>,
    /**
     * Master plan Phase 8 — a real count from `/api/native/admin/overview`, when available. Null
     * (not zero) means "not fetched from production" — Shadow/fixture callers never set this, so
     * it stays the honest default rather than looking like a real zero.
     */
    val pendingOnboardingCount: Int? = null,
    /**
     * Master plan Phase 8 closure §4 — real platform-wide counts from the SAME `loadAdminOverview`
     * function the PWA's `/api/admin/overview` uses. Null (not zero) means "not fetched", same
     * honesty rule as [pendingOnboardingCount].
     */
    val businessAccountsTotal: Int? = null,
    val activeAccountsTotal: Int? = null,
    val pendingReviewAccountsTotal: Int? = null,
    val openSupportCasesTotal: Int? = null,
    val openIncidentsTotal: Int? = null,
    /** Real business-account rows for "client operations" — empty (not fabricated) when unbound. */
    val accounts: List<AdminAccountSummary> = emptyList(),
    /** Real rows for "governance/support" — empty (not fabricated) when unbound. */
    val supportCases: List<AdminSupportCaseSummary> = emptyList(),
    val incidents: List<AdminIncidentSummary> = emptyList(),
)

interface AdminSystemRepository {
    suspend fun snapshot(): AdminSystemSnapshot
}

/**
 * The only administrative source available natively today.
 *
 * The protected snapshot contains no support cases, no account administration records, no payment
 * events and no audit stream, so this reports scope honestly and names what is missing rather
 * than borrowing wedding rows to fill a dashboard.
 */
class ShadowAdminSystemRepository(
    private val weddingRepository: WeddingRepository,
    private val environment: NativeDataEnvironment
) : AdminSystemRepository {
    override suspend fun snapshot(): AdminSystemSnapshot = AdminSystemSnapshot(
        environment = environment,
        weddingsInScope = runCatching { weddingRepository.availableWeddingIds().size }.getOrDefault(0),
        unsupportedStreams = listOf(
            "Support cases",
            "Account administration",
            "Access and role-membership records",
            "Payment events",
            "Data-change and access audit streams"
        )
    )
}

/**
 * Master plan Phase 8 closure §B/§12 — the PRODUCTION default before a real `admin:system` grant
 * has been resolved and bound. Never Shadow, never fabricated: every stream is honestly
 * unsupported/unknown until `ProductionAdminSystemRepository` is bound in its place.
 */
class ProductionBoundaryAdminSystemRepository : AdminSystemRepository {
    override suspend fun snapshot(): AdminSystemSnapshot = AdminSystemSnapshot(
        environment = NativeDataEnvironment.PRODUCTION,
        weddingsInScope = 0,
        unsupportedStreams = listOf(
            "Full overview (billing/support/incidents)",
            "Client operations",
            "Command center",
            "Bookings",
            "Service engagements",
            "Contract intelligence",
            "Contributions analytics",
            "Account identity",
            "Productivity",
            "Governance",
            "Vault",
        ),
        pendingOnboardingCount = null,
    )
}

/**
 * Master plan Phase 8, extended by closure §4 — the real Admin production adapter.
 * `pendingOnboardingCount` plus platform-wide `summary` counts and the real business `accounts`
 * list are now live, all from the SAME shared `loadAdminOverview` the PWA's `/api/admin/overview`
 * calls (`/api/native/admin/overview`). Everything else the PWA's much larger admin surface offers
 * (command center, bookings, service engagements, contract intelligence, contributions analytics,
 * account identity, productivity, governance, cross-wedding vault browsing) remains UNSUPPORTED in
 * this phase (see docs/native-mobile/WEWED_NATIVE_PHASE8_FIELD_CLASSIFICATION.md) and is named here
 * honestly rather than approximated.
 */
class ProductionAdminSystemRepository(
    private val client: NativeDomainApiClient,
    private val sessionToken: String,
    private val grantId: String,
) : AdminSystemRepository {
    /**
     * Master plan Phase 8 closure round 3 §7 — throws on ANY non-success fetch (transport,
     * permission denial, session-invalid, grant revocation) instead of silently degrading to the
     * same nulled-out shape [ProductionBoundaryAdminSystemRepository] uses for "intentionally not
     * yet bound". Those are two different facts — a bound repository whose live call just failed is
     * not the same as one that was never bound — and collapsing them made a failed fetch
     * indistinguishable from a genuinely empty admin console. `AdminDashboardContent`/
     * `AdminAccountsSection`/`AdminCasesSection` catch this via the same `rememberProductionLoad`
     * used for Documents/Contributions.
     */
    override suspend fun snapshot(): AdminSystemSnapshot {
        val overview = when (val fetch = client.adminOverview(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> throw ProductionReadOnlyDomainUnavailable()
        }
        val summary = overview.optJSONObject("summary")
        val accounts = overview.optJSONArray("accounts")?.toObjectList().orEmpty().map { item ->
            AdminAccountSummary(
                id = item.getString("id"),
                name = item.optString("name"),
                type = item.optString("type"),
                status = item.optString("status"),
                onboardingStatus = item.optString("onboardingStatus"),
                riskFlags = item.optJSONArray("riskFlags")?.let { flags -> (0 until flags.length()).map { flags.getString(it) } }.orEmpty(),
            )
        }
        val supportCases = overview.optJSONArray("supportCases")?.toObjectList().orEmpty().map { item ->
            AdminSupportCaseSummary(
                id = item.getString("id"),
                title = item.optString("title"),
                status = item.optString("status"),
                priority = item.optString("priority"),
                businessAccountName = item.optString("businessAccountName").takeIf { it.isNotBlank() },
            )
        }
        val incidents = overview.optJSONArray("incidents")?.toObjectList().orEmpty().map { item ->
            AdminIncidentSummary(
                id = item.getString("id"),
                title = item.optString("title"),
                status = item.optString("status"),
                severity = item.optString("severity"),
            )
        }
        return AdminSystemSnapshot(
            environment = NativeDataEnvironment.PRODUCTION,
            weddingsInScope = 0,
            unsupportedStreams = listOf(
                "Command center",
                "Bookings",
                "Service engagements",
                "Contract intelligence",
                "Contributions analytics",
                "Account identity",
                "Productivity",
                "Vault (cross-wedding admin browsing)",
            ),
            pendingOnboardingCount = overview.optJSONObject("counts")?.optInt("pendingOnboarding"),
            businessAccountsTotal = summary?.let { if (it.has("businessAccounts")) it.optInt("businessAccounts") else null },
            activeAccountsTotal = summary?.let { if (it.has("activeAccounts")) it.optInt("activeAccounts") else null },
            pendingReviewAccountsTotal = summary?.let { if (it.has("pendingReviewAccounts")) it.optInt("pendingReviewAccounts") else null },
            openSupportCasesTotal = summary?.let { if (it.has("openSupportCases")) it.optInt("openSupportCases") else null },
            openIncidentsTotal = summary?.let { if (it.has("openIncidents")) it.optInt("openIncidents") else null },
            accounts = accounts,
            supportCases = supportCases,
            incidents = incidents,
        )
    }
}
