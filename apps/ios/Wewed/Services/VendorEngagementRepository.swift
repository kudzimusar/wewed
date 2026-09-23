import Foundation

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure round 3 §6.
///
/// The Vendor's OWN wedding-engagement identity — a completely separate authority axis from the
/// Vendor business-portfolio shell (`VendorBusinessRepositoryProtocol`) and from the Planner/Couple/
/// Coordinator Contracts list (`ContractsRepositoryProtocol`/`ServiceEngagementSummary`), even though
/// all three ultimately read from the same `ServiceEngagement`/`Contract` tables. A distinct DTO on
/// purpose: this Vendor is one PARTY to one engagement, never a list of every engagement on the
/// wedding, so it is shaped around "my engagement" rather than "the wedding's contracts".
public struct VendorEngagementDetail: Equatable, Sendable {
    public let id: String
    public let weddingId: String
    public let serviceCategory: String
    public let lifecycleStatus: String
    public let agreedAmount: String?
    public let currency: String
    public let contracts: [ContractSummary]

    public init(
        id: String,
        weddingId: String,
        serviceCategory: String,
        lifecycleStatus: String,
        agreedAmount: String?,
        currency: String,
        contracts: [ContractSummary]
    ) {
        self.id = id
        self.weddingId = weddingId
        self.serviceCategory = serviceCategory
        self.lifecycleStatus = lifecycleStatus
        self.agreedAmount = agreedAmount
        self.currency = currency
        self.contracts = contracts
    }
}

public protocol VendorEngagementRepositoryProtocol: Sendable {
    func getMyEngagement() async throws -> VendorEngagementDetail
}

/// No Shadow/Fixture data exists for this brand-new-this-phase capability — see
/// `EmptyContractsRepository`'s identical reasoning. Unlike Contracts' empty-list choice, a Vendor
/// engagement view has no sensible "empty" state, only "not applicable to this environment", so this
/// throws rather than returning a placeholder value.
public struct EmptyVendorEngagementRepository: VendorEngagementRepositoryProtocol {
    public init() {}
    public func getMyEngagement() async throws -> VendorEngagementDetail {
        throw ProductionReadOnlyDomainError.unavailable
    }
}

/// Master plan Phase 8 closure round 3 §5 — the PRODUCTION default before a real binding exists.
public struct ProductionBoundaryVendorEngagementRepository: VendorEngagementRepositoryProtocol {
    public init() {}
    public func getMyEngagement() async throws -> VendorEngagementDetail {
        throw ProductionReadOnlyDomainError.unavailable
    }
}

/// Reads the SAME `getServiceEngagementDealRoom` engine `ProductionContractsRepository` uses, via
/// `/api/native/vendor/engagement` — a completely separate, Vendor-only, wedding-scoped route that a
/// Planner/Couple/Coordinator grant can never satisfy (`GRANT_SCOPE_INVALID`), and that a Vendor
/// business-portfolio grant (no wedding) can never satisfy either.
public struct ProductionVendorEngagementRepository: VendorEngagementRepositoryProtocol {
    private let client: NativeDomainApiClient
    private let sessionToken: String
    private let grantId: String

    public init(client: NativeDomainApiClient, sessionToken: String, grantId: String) {
        self.client = client
        self.sessionToken = sessionToken
        self.grantId = grantId
    }

    public func getMyEngagement() async throws -> VendorEngagementDetail {
        guard case let .success(root) = await client.vendorEngagement(sessionToken: sessionToken, grantId: grantId) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        guard let item = root.wwObject("data") else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        let contracts = (item.wwArray("contracts") ?? []).map { contract in
            ContractSummary(
                id: contract.wwRequiredString("id"),
                contractNumber: contract.wwString("contractNumber") ?? "",
                status: contract.wwString("status") ?? "",
                currentVersionNumber: contract.wwInt("currentVersionNumber") ?? 0
            )
        }
        return VendorEngagementDetail(
            id: item.wwRequiredString("id"),
            weddingId: item.wwString("weddingId") ?? "",
            serviceCategory: item.wwString("serviceCategory") ?? "",
            lifecycleStatus: item.wwString("lifecycleStatus") ?? "",
            agreedAmount: item.wwString("agreedAmount")?.wwNilIfBlank,
            currency: item.wwString("currency") ?? "USD",
            contracts: contracts
        )
    }
}
