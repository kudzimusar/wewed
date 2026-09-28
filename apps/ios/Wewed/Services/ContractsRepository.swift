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

/// Master plan Phase 8 closure round 4 §3 — the mature Deal Room, distinct from
/// `ServiceEngagementSummary` (a list-row projection) the same way a detail screen is distinct from
/// its list. Field set mirrors exactly what the PWA's own `DealRoomRecord`
/// (`src/components/wedding/planner/modules/planner-vendor-deal-room.tsx`) consumes from the SAME
/// `getServiceEngagementDealRoom` engine — nothing here is invented or computed client-side.
public struct DealRoomVendor: Identifiable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let category: String
    public let email: String?
    public let phone: String?

    public init(id: String, name: String, category: String, email: String?, phone: String?) {
        self.id = id
        self.name = name
        self.category = category
        self.email = email
        self.phone = phone
    }
}

public struct DealRoomParty: Identifiable, Equatable, Sendable {
    public let id: String
    public let partyRole: String
    public let displayName: String
    public let email: String?
    public let phone: String?
    public let requiredForReview: Bool

    public init(id: String, partyRole: String, displayName: String, email: String?, phone: String?, requiredForReview: Bool) {
        self.id = id
        self.partyRole = partyRole
        self.displayName = displayName
        self.email = email
        self.phone = phone
        self.requiredForReview = requiredForReview
    }
}

public struct DealRoomContractVersion: Identifiable, Equatable, Sendable {
    public let id: String
    public let versionNumber: Int
    public let status: String
    public let issuedAt: String?
    public let createdAt: String

    public init(id: String, versionNumber: Int, status: String, issuedAt: String?, createdAt: String) {
        self.id = id
        self.versionNumber = versionNumber
        self.status = status
        self.issuedAt = issuedAt
        self.createdAt = createdAt
    }
}

public struct DealRoomContractDetail: Identifiable, Equatable, Sendable {
    public let id: String
    public let contractNumber: String
    public let status: String
    public let title: String
    public let currentVersionNumber: Int
    public let issuedAt: String?
    public let versions: [DealRoomContractVersion]

    public init(
        id: String,
        contractNumber: String,
        status: String,
        title: String,
        currentVersionNumber: Int,
        issuedAt: String?,
        versions: [DealRoomContractVersion]
    ) {
        self.id = id
        self.contractNumber = contractNumber
        self.status = status
        self.title = title
        self.currentVersionNumber = currentVersionNumber
        self.issuedAt = issuedAt
        self.versions = versions
    }
}

public struct DealRoomBudgetItem: Identifiable, Equatable, Sendable {
    public let id: String
    public let description: String
    public let estimatedCost: String
    public let actualCost: String?
    public let paidAmount: String
    public let currency: String

    public init(id: String, description: String, estimatedCost: String, actualCost: String?, paidAmount: String, currency: String) {
        self.id = id
        self.description = description
        self.estimatedCost = estimatedCost
        self.actualCost = actualCost
        self.paidAmount = paidAmount
        self.currency = currency
    }
}

public struct DealRoomPayment: Identifiable, Equatable, Sendable {
    public let id: String
    public let amount: String
    public let currency: String
    public let paidAt: String?
    public let reference: String?

    public init(id: String, amount: String, currency: String, paidAt: String?, reference: String?) {
        self.id = id
        self.amount = amount
        self.currency = currency
        self.paidAt = paidAt
        self.reference = reference
    }
}

public struct DealRoomDocument: Identifiable, Equatable, Sendable {
    public let id: String
    public let displayName: String
    public let originalFilename: String
    public let mimeType: String
    public let byteSize: Int
    public let storageState: String
    public let scanState: String
    public let createdAt: String

    public init(
        id: String,
        displayName: String,
        originalFilename: String,
        mimeType: String,
        byteSize: Int,
        storageState: String,
        scanState: String,
        createdAt: String
    ) {
        self.id = id
        self.displayName = displayName
        self.originalFilename = originalFilename
        self.mimeType = mimeType
        self.byteSize = byteSize
        self.storageState = storageState
        self.scanState = scanState
        self.createdAt = createdAt
    }
}

public struct DealRoomDetail: Identifiable, Equatable, Sendable {
    public let id: String
    public let serviceCategory: String
    public let serviceDescription: String?
    public let agreedAmount: String?
    public let currency: String
    public let serviceDate: String?
    public let serviceLocation: String?
    public let lifecycleStatus: String
    public let vendor: DealRoomVendor
    public let parties: [DealRoomParty]
    public let budgetItems: [DealRoomBudgetItem]
    public let payments: [DealRoomPayment]
    public let contracts: [DealRoomContractDetail]
    public let documents: [DealRoomDocument]

    public init(
        id: String,
        serviceCategory: String,
        serviceDescription: String?,
        agreedAmount: String?,
        currency: String,
        serviceDate: String?,
        serviceLocation: String?,
        lifecycleStatus: String,
        vendor: DealRoomVendor,
        parties: [DealRoomParty],
        budgetItems: [DealRoomBudgetItem],
        payments: [DealRoomPayment],
        contracts: [DealRoomContractDetail],
        documents: [DealRoomDocument]
    ) {
        self.id = id
        self.serviceCategory = serviceCategory
        self.serviceDescription = serviceDescription
        self.agreedAmount = agreedAmount
        self.currency = currency
        self.serviceDate = serviceDate
        self.serviceLocation = serviceLocation
        self.lifecycleStatus = lifecycleStatus
        self.vendor = vendor
        self.parties = parties
        self.budgetItems = budgetItems
        self.payments = payments
        self.contracts = contracts
        self.documents = documents
    }
}

public protocol ContractsRepositoryProtocol: Sendable {
    func getServiceEngagements() async throws -> [ServiceEngagementSummary]

    /// Master plan Phase 8 closure round 4 §3 — the mature Deal Room for one engagement in this list.
    func getDealRoom(engagementId: String) async throws -> DealRoomDetail
}

/// No Shadow/Fixture contract data is fabricated for this brand-new-this-phase capability — there is
/// no historical Shadow qualification fixture for the managed-contract lifecycle to read from, and
/// inventing one would be exactly the kind of fabrication master plan §8/§16 exists to prevent. Used
/// for every non-production environment; the "Contracts" destination shows this honestly as
/// UNSUPPORTED for those environments rather than calling this repository at all.
public struct EmptyContractsRepository: ContractsRepositoryProtocol {
    public init() {}
    public func getServiceEngagements() async throws -> [ServiceEngagementSummary] { [] }
    public func getDealRoom(engagementId: String) async throws -> DealRoomDetail {
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

    /// Master plan Phase 8 closure round 4 §3 — reads the SAME `getServiceEngagementDealRoom` engine
    /// the PWA's `/api/planner/engagements/[id]/deal-room` uses (via
    /// `/api/native/wedding/engagements/{id}/deal-room`), never duplicating its business logic here.
    /// Throws on ANY non-success fetch (foreign engagement 404, permission denial, session-invalid,
    /// grant revocation) exactly like `getServiceEngagements` — a caller must never render a
    /// fabricated empty Deal Room for a request that actually failed or was denied.
    public func getDealRoom(engagementId: String) async throws -> DealRoomDetail {
        guard case let .success(root) = await client.dealRoom(sessionToken: sessionToken, grantId: grantId, engagementId: engagementId) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        guard let item = root.wwObject("data"), let vendorJson = item.wwObject("vendor") else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        let vendor = DealRoomVendor(
            id: vendorJson.wwRequiredString("id"),
            name: vendorJson.wwString("name") ?? "",
            category: vendorJson.wwString("category") ?? "",
            email: vendorJson.wwString("email")?.wwNilIfBlank,
            phone: vendorJson.wwString("phone")?.wwNilIfBlank
        )
        let parties = (item.wwArray("parties") ?? []).map { party in
            DealRoomParty(
                id: party.wwRequiredString("id"),
                partyRole: party.wwString("partyRole") ?? "",
                displayName: party.wwString("displayName") ?? "",
                email: party.wwString("email")?.wwNilIfBlank,
                phone: party.wwString("phone")?.wwNilIfBlank,
                requiredForReview: party.wwBool("requiredForReview") ?? false
            )
        }
        let budgetItems = (item.wwArray("budgetItems") ?? []).map { budget in
            DealRoomBudgetItem(
                id: budget.wwRequiredString("id"),
                description: budget.wwString("description") ?? "",
                estimatedCost: budget.wwString("estimatedCost") ?? "",
                actualCost: budget.wwString("actualCost")?.wwNilIfBlank,
                paidAmount: budget.wwString("paidAmount") ?? "",
                currency: budget.wwString("currency") ?? "USD"
            )
        }
        let payments = (item.wwArray("payments") ?? []).map { payment in
            DealRoomPayment(
                id: payment.wwRequiredString("id"),
                amount: payment.wwString("amount") ?? "",
                currency: payment.wwString("currency") ?? "USD",
                paidAt: payment.wwString("paidAt")?.wwNilIfBlank,
                reference: payment.wwString("reference")?.wwNilIfBlank
            )
        }
        let contracts = (item.wwArray("contracts") ?? []).map { contract -> DealRoomContractDetail in
            let versions = (contract.wwArray("versions") ?? []).map { version in
                DealRoomContractVersion(
                    id: version.wwRequiredString("id"),
                    versionNumber: version.wwInt("versionNumber") ?? 0,
                    status: version.wwString("status") ?? "",
                    issuedAt: version.wwString("issuedAt")?.wwNilIfBlank,
                    createdAt: version.wwString("createdAt") ?? ""
                )
            }
            return DealRoomContractDetail(
                id: contract.wwRequiredString("id"),
                contractNumber: contract.wwString("contractNumber") ?? "",
                status: contract.wwString("status") ?? "",
                title: contract.wwString("title") ?? "",
                currentVersionNumber: contract.wwInt("currentVersionNumber") ?? 0,
                issuedAt: contract.wwString("issuedAt")?.wwNilIfBlank,
                versions: versions
            )
        }
        let documents = (item.wwArray("documents") ?? []).map { document in
            DealRoomDocument(
                id: document.wwRequiredString("id"),
                displayName: document.wwString("displayName") ?? "",
                originalFilename: document.wwString("originalFilename") ?? "",
                mimeType: document.wwString("mimeType") ?? "",
                byteSize: document.wwInt("byteSize") ?? 0,
                storageState: document.wwString("storageState") ?? "",
                scanState: document.wwString("scanState") ?? "",
                createdAt: document.wwString("createdAt") ?? ""
            )
        }
        return DealRoomDetail(
            id: item.wwRequiredString("id"),
            serviceCategory: item.wwString("serviceCategory") ?? "",
            serviceDescription: item.wwString("serviceDescription")?.wwNilIfBlank,
            agreedAmount: item.wwString("agreedAmount")?.wwNilIfBlank,
            currency: item.wwString("currency") ?? "USD",
            serviceDate: item.wwString("serviceDate")?.wwNilIfBlank,
            serviceLocation: item.wwString("serviceLocation")?.wwNilIfBlank,
            lifecycleStatus: item.wwString("lifecycleStatus") ?? "",
            vendor: vendor,
            parties: parties,
            budgetItems: budgetItems,
            payments: payments,
            contracts: contracts,
            documents: documents
        )
    }
}
