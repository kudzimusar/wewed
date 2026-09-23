import Foundation

/// System-level administrative projection (P0-13).
///
/// Admin is system-scoped in IA V2: Dashboard, Cases, Accounts and Audit describe the platform,
/// not one wedding. Reading them from the wedding graph forced a global console to depend on an
/// active wedding, which is why Admin previously needed a wedding context just to open.
///
/// Wedding-scoped data is loaded only after an administrator deliberately drills into a wedding.
/// Master plan Phase 8 closure §4 — one row from the real, shared `loadAdminOverview` engine.
public struct AdminAccountSummary: Equatable, Sendable {
    public let id: String
    public let name: String
    public let type: String
    public let status: String
    public let onboardingStatus: String
    public let riskFlags: [String]

    public init(id: String, name: String, type: String, status: String, onboardingStatus: String, riskFlags: [String]) {
        self.id = id
        self.name = name
        self.type = type
        self.status = status
        self.onboardingStatus = onboardingStatus
        self.riskFlags = riskFlags
    }
}

public struct AdminSupportCaseSummary: Equatable, Sendable {
    public let id: String
    public let title: String
    public let status: String
    public let priority: String
    public let businessAccountName: String?

    public init(id: String, title: String, status: String, priority: String, businessAccountName: String?) {
        self.id = id
        self.title = title
        self.status = status
        self.priority = priority
        self.businessAccountName = businessAccountName
    }
}

public struct AdminIncidentSummary: Equatable, Sendable {
    public let id: String
    public let title: String
    public let status: String
    public let severity: String

    public init(id: String, title: String, status: String, severity: String) {
        self.id = id
        self.title = title
        self.status = status
        self.severity = severity
    }
}

public struct AdminSystemSnapshot: Equatable, Sendable {
    public let environment: NativeDataEnvironment
    /// Weddings this administrator may act on; the console itself does not require one.
    public let weddingsInScope: Int
    /// Native contracts that do not exist yet, surfaced as honest unsupported states.
    public let unsupportedStreams: [String]
    /// Master plan Phase 8 — a real count from `/api/native/admin/overview`, when available. Nil
    /// (not zero) means "not fetched from production" — Shadow/fixture callers never set this, so
    /// it stays the honest default rather than looking like a real zero.
    public let pendingOnboardingCount: Int?
    /// Master plan Phase 8 closure §4 — real platform-wide counts from the SAME `loadAdminOverview`
    /// function the PWA's `/api/admin/overview` uses. Nil (not zero) means "not fetched", same
    /// honesty rule as `pendingOnboardingCount`.
    public let businessAccountsTotal: Int?
    public let activeAccountsTotal: Int?
    public let pendingReviewAccountsTotal: Int?
    public let openSupportCasesTotal: Int?
    public let openIncidentsTotal: Int?
    /// Real business-account rows for "client operations" — empty (not fabricated) when unbound.
    public let accounts: [AdminAccountSummary]
    /// Real rows for "governance/support" — empty (not fabricated) when unbound.
    public let supportCases: [AdminSupportCaseSummary]
    public let incidents: [AdminIncidentSummary]

    public init(
        environment: NativeDataEnvironment,
        weddingsInScope: Int,
        unsupportedStreams: [String],
        pendingOnboardingCount: Int? = nil,
        businessAccountsTotal: Int? = nil,
        activeAccountsTotal: Int? = nil,
        pendingReviewAccountsTotal: Int? = nil,
        openSupportCasesTotal: Int? = nil,
        openIncidentsTotal: Int? = nil,
        accounts: [AdminAccountSummary] = [],
        supportCases: [AdminSupportCaseSummary] = [],
        incidents: [AdminIncidentSummary] = []
    ) {
        self.environment = environment
        self.weddingsInScope = weddingsInScope
        self.unsupportedStreams = unsupportedStreams
        self.pendingOnboardingCount = pendingOnboardingCount
        self.businessAccountsTotal = businessAccountsTotal
        self.activeAccountsTotal = activeAccountsTotal
        self.pendingReviewAccountsTotal = pendingReviewAccountsTotal
        self.openSupportCasesTotal = openSupportCasesTotal
        self.openIncidentsTotal = openIncidentsTotal
        self.accounts = accounts
        self.supportCases = supportCases
        self.incidents = incidents
    }
}

public protocol AdminSystemRepositoryProtocol: Sendable {
    func snapshot() async throws -> AdminSystemSnapshot
}

/// The only administrative source available natively today.
///
/// The protected snapshot contains no support cases, no account administration records, no payment
/// events and no audit stream, so this reports scope honestly and names what is missing rather
/// than borrowing wedding rows to fill a dashboard.
public struct ShadowAdminSystemRepository: AdminSystemRepositoryProtocol {
    private let weddingRepository: WeddingRepositoryProtocol
    private let environment: NativeDataEnvironment

    public init(weddingRepository: WeddingRepositoryProtocol, environment: NativeDataEnvironment) {
        self.weddingRepository = weddingRepository
        self.environment = environment
    }

    public func snapshot() async -> AdminSystemSnapshot {
        let count = (try? await weddingRepository.availableWeddingIds().count) ?? 0
        return AdminSystemSnapshot(
            environment: environment,
            weddingsInScope: count,
            unsupportedStreams: [
                "Support cases",
                "Account administration",
                "Access and role-membership records",
                "Payment events",
                "Data-change and access audit streams"
            ]
        )
    }
}

/// Master plan Phase 8 closure §B/§12 — the PRODUCTION default before a real `admin:system` grant
/// has been resolved and bound. Never Shadow, never fabricated: every stream is honestly
/// unsupported/unknown until `ProductionAdminSystemRepository` is bound in its place.
public struct ProductionBoundaryAdminSystemRepository: AdminSystemRepositoryProtocol {
    public init() {}

    public func snapshot() async -> AdminSystemSnapshot {
        AdminSystemSnapshot(
            environment: .production,
            weddingsInScope: 0,
            unsupportedStreams: [
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
            ],
            pendingOnboardingCount: nil
        )
    }
}

/// Master plan Phase 8, extended by closure §4 — the real Admin production adapter.
/// `pendingOnboardingCount` plus platform-wide `summary` counts and the real business `accounts`
/// list are now live, all from the SAME shared `loadAdminOverview` the PWA's `/api/admin/overview`
/// calls (`/api/native/admin/overview`). Everything else the PWA's much larger admin surface offers
/// (command center, bookings, service engagements, contract intelligence, contributions analytics,
/// account identity, productivity, cross-wedding vault browsing) remains UNSUPPORTED in this phase
/// (see docs/native-mobile/WEWED_NATIVE_PHASE8_FIELD_CLASSIFICATION.md) and is named here honestly
/// rather than approximated.
public struct ProductionAdminSystemRepository: AdminSystemRepositoryProtocol {
    private let client: NativeDomainApiClient
    private let sessionToken: String
    private let grantId: String

    public init(client: NativeDomainApiClient, sessionToken: String, grantId: String) {
        self.client = client
        self.sessionToken = sessionToken
        self.grantId = grantId
    }

    public func snapshot() async throws -> AdminSystemSnapshot {
        // Master plan Phase 8 closure round 3 §2/§7 — a live Admin overview failure now throws,
        // exactly like every other production repository in this codebase, instead of silently
        // degrading to a nulled-out/empty snapshot that a caller could mistake for an honest
        // "nothing to report" result. `ProductionBoundaryAdminSystemRepository` is the one
        // intentional non-throwing exception (see its own doc comment): "not yet bound" and "a
        // bound repository's live call just failed" are two different facts.
        guard case let .success(overview) = await client.adminOverview(sessionToken: sessionToken, grantId: grantId) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        let summary = overview.wwObject("summary")
        let accounts = (overview.wwArray("accounts") ?? []).map { item in
            AdminAccountSummary(
                id: item.wwRequiredString("id"),
                name: item.wwString("name") ?? "",
                type: item.wwString("type") ?? "",
                status: item.wwString("status") ?? "",
                onboardingStatus: item.wwString("onboardingStatus") ?? "",
                riskFlags: (item["riskFlags"] as? [String]) ?? []
            )
        }
        let supportCases = (overview.wwArray("supportCases") ?? []).map { item in
            AdminSupportCaseSummary(
                id: item.wwRequiredString("id"),
                title: item.wwString("title") ?? "",
                status: item.wwString("status") ?? "",
                priority: item.wwString("priority") ?? "",
                businessAccountName: item.wwString("businessAccountName")?.wwNilIfBlank
            )
        }
        let incidents = (overview.wwArray("incidents") ?? []).map { item in
            AdminIncidentSummary(
                id: item.wwRequiredString("id"),
                title: item.wwString("title") ?? "",
                status: item.wwString("status") ?? "",
                severity: item.wwString("severity") ?? ""
            )
        }
        return AdminSystemSnapshot(
            environment: .production,
            weddingsInScope: 0,
            unsupportedStreams: [
                "Command center",
                "Bookings",
                "Service engagements",
                "Contract intelligence",
                "Contributions analytics",
                "Account identity",
                "Productivity",
                "Vault (cross-wedding admin browsing)",
            ],
            pendingOnboardingCount: overview.wwObject("counts")?.wwInt("pendingOnboarding"),
            businessAccountsTotal: wwHonestInt(summary, "businessAccounts"),
            activeAccountsTotal: wwHonestInt(summary, "activeAccounts"),
            pendingReviewAccountsTotal: wwHonestInt(summary, "pendingReviewAccounts"),
            openSupportCasesTotal: wwHonestInt(summary, "openSupportCases"),
            openIncidentsTotal: wwHonestInt(summary, "openIncidents"),
            accounts: accounts,
            supportCases: supportCases,
            incidents: incidents
        )
    }
}

/// `summary`'s counts use the same "absent stays nil, never a fabricated zero" rule as
/// `pendingOnboardingCount`: a genuinely missing key answers `nil`, while a present-but-wrong-typed
/// value degrades to `0` exactly like `wwInt`/`optInt` elsewhere in this file.
private func wwHonestInt(_ dict: NativeJSONObject?, _ key: String) -> Int? {
    guard let dict, dict[key] != nil else { return nil }
    return dict.wwInt(key) ?? 0
}
