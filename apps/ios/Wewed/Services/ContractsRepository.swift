import Foundation

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure round 3 §3.
///
/// A distinct DTO for the managed-contract lifecycle (`ServiceEngagement` + `Contract` +
/// `ContractVersion`), deliberately NOT `PlannerVendorEngagement` — that model already represents a
/// different, legitimate domain (the planning-side `Vendor.contractStatus`/`paymentStatus` fields a
/// Planner tracks manually), and reusing it here would conflate two real, separately-persisted
/// domains into one. Only fields the shared server result actually returns are modelled; nothing
/// here is computed or inferred client-side.
public struct ContractSummary: Identifiable, Equatable, Sendable {
    public let id: String
    public let contractNumber: String
    public let status: String
    public let currentVersionNumber: Int

    public init(id: String, contractNumber: String, status: String, currentVersionNumber: Int) {
        self.id = id
        self.contractNumber = contractNumber
        self.status = status
        self.currentVersionNumber = currentVersionNumber
    }
}

public struct ServiceEngagementSummary: Identifiable, Equatable, Sendable {
    public let id: String
    public let vendorName: String
    public let serviceCategory: String
    public let lifecycleStatus: String
    public let agreedAmount: String?
    public let currency: String
    public let contracts: [ContractSummary]

    public init(
        id: String,
        vendorName: String,
        serviceCategory: String,
        lifecycleStatus: String,
        agreedAmount: String?,
        currency: String,
        contracts: [ContractSummary]
    ) {
        self.id = id
        self.vendorName = vendorName
        self.serviceCategory = serviceCategory
        self.lifecycleStatus = lifecycleStatus
        self.agreedAmount = agreedAmount
        self.currency = currency
        self.contracts = contracts
    }
}

public protocol ContractsRepositoryProtocol: Sendable {
    func getServiceEngagements() async throws -> [ServiceEngagementSummary]
}

/// No Shadow/Fixture contract data is fabricated for this brand-new-this-phase capability — there is
/// no historical Shadow qualification fixture for the managed-contract lifecycle to read from, and
/// inventing one would be exactly the kind of fabrication master plan §8/§16 exists to prevent. Used
/// for every non-production environment; the "Contracts" destination shows this honestly as
/// UNSUPPORTED for those environments rather than calling this repository at all.
public struct EmptyContractsRepository: ContractsRepositoryProtocol {
    public init() {}
    public func getServiceEngagements() async throws -> [ServiceEngagementSummary] { [] }
}

/// Master plan Phase 8 closure round 3 §5 — the PRODUCTION default before a real binding exists.
/// Never fabricated: the one method throws, matching every other `ProductionBoundary*Repository` in
/// this codebase, so a caller can never mistake "not yet bound" for "fetched and empty".
public struct ProductionBoundaryContractsRepository: ContractsRepositoryProtocol {
    public init() {}
    public func getServiceEngagements() async throws -> [ServiceEngagementSummary] {
        throw ProductionReadOnlyDomainError.unavailable
    }
}

/// Master plan Phase 8 closure round 3 §3 — reads the SAME `listManagedServiceEngagements` engine
/// the PWA's `/api/planner/engagements/current` uses (via `/api/native/wedding/engagements`), never a
/// second contract truth. Throws (never fabricates empty) on a live failure, matching every other
/// production repository's "this is only ever consulted once a real wedding-scoped grant has
/// rendered a role shell" contract.
public struct ProductionContractsRepository: ContractsRepositoryProtocol {
    private let client: NativeDomainApiClient
    private let sessionToken: String
    private let grantId: String

    public init(client: NativeDomainApiClient, sessionToken: String, grantId: String) {
        self.client = client
        self.sessionToken = sessionToken
        self.grantId = grantId
    }

    public func getServiceEngagements() async throws -> [ServiceEngagementSummary] {
        guard case let .success(array) = await client.engagements(sessionToken: sessionToken, grantId: grantId) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        return array.map { item in
            let vendor = item.wwObject("vendor")
            let contracts = (item.wwArray("contracts") ?? []).map { contract in
                ContractSummary(
                    id: contract.wwRequiredString("id"),
                    contractNumber: contract.wwString("contractNumber") ?? "",
                    status: contract.wwString("status") ?? "",
                    currentVersionNumber: contract.wwInt("currentVersionNumber") ?? 0
                )
            }
            return ServiceEngagementSummary(
                id: item.wwRequiredString("id"),
                vendorName: vendor?.wwString("name")?.wwNilIfBlank ?? "Unknown vendor",
                serviceCategory: item.wwString("serviceCategory") ?? "",
                lifecycleStatus: item.wwString("lifecycleStatus") ?? "",
                agreedAmount: item.wwString("agreedAmount")?.wwNilIfBlank,
                currency: item.wwString("currency") ?? "USD",
                contracts: contracts
            )
        }
    }
}
