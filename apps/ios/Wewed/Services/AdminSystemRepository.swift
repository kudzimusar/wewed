import Foundation

/// System-level administrative projection (P0-13).
///
/// Admin is system-scoped in IA V2: Dashboard, Cases, Accounts and Audit describe the platform,
/// not one wedding. Reading them from the wedding graph forced a global console to depend on an
/// active wedding, which is why Admin previously needed a wedding context just to open.
///
/// Wedding-scoped data is loaded only after an administrator deliberately drills into a wedding.
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

    public init(
        environment: NativeDataEnvironment,
        weddingsInScope: Int,
        unsupportedStreams: [String],
        pendingOnboardingCount: Int? = nil
    ) {
        self.environment = environment
        self.weddingsInScope = weddingsInScope
        self.unsupportedStreams = unsupportedStreams
        self.pendingOnboardingCount = pendingOnboardingCount
    }
}

public protocol AdminSystemRepositoryProtocol: Sendable {
    func snapshot() async -> AdminSystemSnapshot
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

/// Master plan Phase 8 — the first real Admin production adapter. Only `pendingOnboardingCount` is
/// live (`/api/native/admin/overview`); every other stream from the PWA's much larger
/// `/api/admin/overview`/`client-operations`/`command-center`/etc. remains UNSUPPORTED in this
/// phase and is named here honestly rather than approximated.
public struct ProductionAdminSystemRepository: AdminSystemRepositoryProtocol {
    private let client: NativeDomainApiClient
    private let sessionToken: String
    private let grantId: String

    public init(client: NativeDomainApiClient, sessionToken: String, grantId: String) {
        self.client = client
        self.sessionToken = sessionToken
        self.grantId = grantId
    }

    public func snapshot() async -> AdminSystemSnapshot {
        var pendingOnboarding: Int?
        if case let .success(json) = await client.adminOverview(sessionToken: sessionToken, grantId: grantId) {
            pendingOnboarding = json.wwObject("counts")?.wwInt("pendingOnboarding")
        }
        return AdminSystemSnapshot(
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
            pendingOnboardingCount: pendingOnboarding
        )
    }
}
