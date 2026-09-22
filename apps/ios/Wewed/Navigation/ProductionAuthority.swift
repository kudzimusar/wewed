import Foundation

/// Native view of the shared server contract `WewedProductionAuthorityV1` (master plan Phase 2).
/// Specification: docs/native-mobile/WEWED_PRODUCTION_AUTHORITY_CONTRACT_V1.md.
///
/// PURE and NOT ACTIVATED. Nothing in SessionStore, ActorAssignmentSources,
/// NativeRepositoryFactory or RootView uses these types yet; activation is Phase 5.
///
/// Two levels are kept apart on purpose:
///
///     available server workspace grants   (everything the account may open)
///            ↓ the person selects one — later, Phase 5
///     one active ActorAssignment          (what the app is operating as right now)
///
/// A Planner portfolio or a Vendor business is real authority with no wedding in it. It stays a
/// grant until a real wedding is selected. It is never forced into an ActorAssignment, and
/// NavigationContext keeps its required wedding scope.
///
/// Roles are never derived from raw server strings, and the flat AppRole id parser is never used
/// on server data. The mapper reads only the server's explicit `workspaceKind` + `scopeKind`.
/// The Android counterpart is identical.

/// Workspace kinds the contract can prove. Anything else — guest, usher, future kinds — is `.unknown`.
public enum GrantWorkspaceKind: Equatable, Sendable {
    case couple, planner, coordinator, vendor, admin, unknown

    public init(wire: String) {
        switch wire {
        case "couple": self = .couple
        case "planner": self = .planner
        case "coordinator": self = .coordinator
        case "vendor": self = .vendor
        case "admin": self = .admin
        default: self = .unknown
        }
    }
}

public enum GrantScopeKind: Equatable, Sendable {
    case wedding, portfolio, business, system, unknown

    public init(wire: String) {
        switch wire {
        case "wedding": self = .wedding
        case "portfolio": self = .portfolio
        case "business": self = .business
        case "system": self = .system
        default: self = .unknown
        }
    }
}

public struct ProductionWorkspaceGrant: Decodable, Equatable, Sendable {
    public let grantId: String
    /// The kind exactly as the server sent it, kept for diagnostics.
    public let workspaceKindWire: String
    public let scopeKindWire: String
    public let weddingId: String?
    public let weddingTitle: String?
    public let coupleId: String?
    public let businessAccountId: String?
    public let vendorId: String?
    /// Real ServiceEngagement ids only.
    public let serviceEngagementIds: [String]
    public let permissions: [String]
    public let platformRoles: [String]

    public var workspaceKind: GrantWorkspaceKind { GrantWorkspaceKind(wire: workspaceKindWire) }
    public var scopeKind: GrantScopeKind { GrantScopeKind(wire: scopeKindWire) }

    private enum CodingKeys: String, CodingKey {
        case grantId, workspaceKind, scopeKind, weddingId, weddingTitle, coupleId, businessAccountId, vendorId
        case serviceEngagementIds, permissions, platformRoles
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        grantId = try c.decode(String.self, forKey: .grantId)
        workspaceKindWire = try c.decode(String.self, forKey: .workspaceKind)
        scopeKindWire = try c.decode(String.self, forKey: .scopeKind)
        weddingId = try c.decodeIfPresent(String.self, forKey: .weddingId)
        weddingTitle = try c.decodeIfPresent(String.self, forKey: .weddingTitle)
        coupleId = try c.decodeIfPresent(String.self, forKey: .coupleId)
        businessAccountId = try c.decodeIfPresent(String.self, forKey: .businessAccountId)
        vendorId = try c.decodeIfPresent(String.self, forKey: .vendorId)
        serviceEngagementIds = try c.decode([String].self, forKey: .serviceEngagementIds)
        permissions = try c.decode([String].self, forKey: .permissions)
        platformRoles = try c.decode([String].self, forKey: .platformRoles)
    }
}

public struct ProductionContextSelection: Decodable, Equatable, Sendable {
    public let workspaceKind: String
    public let grantIds: [String]
    public let selectionRequired: Bool
}

public struct ProductionAuthority: Decodable, Equatable, Sendable {
    public static let contractName = "WewedProductionAuthorityV1"
    public static let contractVersion = 1

    public struct Identity: Decodable, Equatable, Sendable {
        public let accessUserId: String
        /// The dashboard/account class axis as stored. Evidence only — never a workspace.
        public let dashboardClass: String
    }

    public struct Unsupported: Decodable, Equatable, Sendable {
        public let authority: String
    }

    public struct Platform: Decodable, Equatable, Sendable {
        public let effectiveRole: String?
    }

    public struct BusinessMembershipPresentation: Decodable, Equatable, Sendable {
        public let businessAccountId: String
        public let businessName: String
    }

    public struct VendorEngagementPresentation: Decodable, Equatable, Sendable {
        public let vendorId: String
        public let vendorName: String
    }

    public let contract: String
    public let version: Int
    public let accountStatus: String
    public let identity: Identity?
    public let workspaceGrants: [ProductionWorkspaceGrant]
    public let contextSelection: [ProductionContextSelection]
    public let unsupported: [Unsupported]
    public let platform: Platform?
    /// Presentation-only evidence already carried by the server contract; never authority.
    public let businessMemberships: [BusinessMembershipPresentation]
    public let vendorEngagements: [VendorEngagementPresentation]

    public var accessUserId: String? { identity?.accessUserId }
    public var unsupportedAuthorities: [String] { unsupported.map(\.authority) }
    public var businessNamesById: [String: String] {
        Dictionary(uniqueKeysWithValues: businessMemberships.map { ($0.businessAccountId, $0.businessName) })
    }
    public var vendorNamesById: [String: String] {
        Dictionary(uniqueKeysWithValues: vendorEngagements.map { ($0.vendorId, $0.vendorName) })
    }

    private enum CodingKeys: String, CodingKey {
        case contract, version, accountStatus, identity, workspaceGrants, contextSelection, unsupported, platform
        case businessMemberships, vendorEngagements
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        contract = try c.decode(String.self, forKey: .contract)
        version = try c.decode(Int.self, forKey: .version)
        accountStatus = try c.decode(String.self, forKey: .accountStatus)
        identity = try c.decodeIfPresent(Identity.self, forKey: .identity)
        workspaceGrants = try c.decode([ProductionWorkspaceGrant].self, forKey: .workspaceGrants)
        contextSelection = try c.decode([ProductionContextSelection].self, forKey: .contextSelection)
        unsupported = try c.decode([Unsupported].self, forKey: .unsupported)
        platform = try c.decodeIfPresent(Platform.self, forKey: .platform)
        businessMemberships = try c.decodeIfPresent(
            [BusinessMembershipPresentation].self,
            forKey: .businessMemberships
        ) ?? []
        vendorEngagements = try c.decodeIfPresent(
            [VendorEngagementPresentation].self,
            forKey: .vendorEngagements
        ) ?? []
    }

    /// Decodes the contract. Returns nil for malformed JSON; it never guesses missing fields.
    public static func decode(_ data: Data) -> ProductionAuthority? {
        try? JSONDecoder().decode(ProductionAuthority.self, from: data)
    }
}

/// Proves which ONE selected grant may become an `ActorAssignment`. Conservative: anything not
/// explicitly mapped is denied.
public enum ProductionGrantMapper {

    public enum Outcome: Equatable {
        case assigned(ActorAssignment)
        /// Real authority with no wedding in it (Planner portfolio, Vendor business). A wedding
        /// must be selected from the account's real wedding-scoped grants first; none is invented.
        case requiresWeddingSelection(ProductionWorkspaceGrant)
        case denied(String)
    }

    /// The account is usable only for the exact contract, version and an authorized identity.
    public static func isUsable(_ authority: ProductionAuthority) -> Bool {
        authority.contract == ProductionAuthority.contractName
            && authority.version == ProductionAuthority.contractVersion
            && authority.accountStatus == "authorized"
            && !(authority.accessUserId ?? "").isEmpty
    }

    /// Maps the grant the person selected.
    ///
    /// - Parameter selectedEngagementId: for a Vendor wedding grant, the engagement the person
    ///   chose. It must be one of the grant's real engagements. With none chosen, an engagement is
    ///   filled in only when exactly one exists.
    public static func map(
        _ authority: ProductionAuthority,
        grantId: String,
        selectedEngagementId: String? = nil
    ) -> Outcome {
        guard isUsable(authority), let actorId = authority.accessUserId else {
            return .denied("The account authority is not usable.")
        }
        guard let grant = authority.workspaceGrants.first(where: { $0.grantId == grantId }) else {
            return .denied("No such grant for this account.")
        }

        switch (grant.workspaceKind, grant.scopeKind) {
        case (.couple, .wedding): return weddingAssignment(grant, role: .couple, actorId: actorId)
        case (.planner, .wedding): return weddingAssignment(grant, role: .planner, actorId: actorId)
        case (.coordinator, .wedding): return weddingAssignment(grant, role: .coordinator, actorId: actorId)
        case (.vendor, .wedding): return vendorAssignment(grant, actorId: actorId, selectedEngagementId: selectedEngagementId)
        case (.admin, .system): return .assigned(ActorAssignment(actorId: actorId, role: .admin, weddingId: nil))
        case (.planner, .portfolio), (.vendor, .business):
            guard let business = grant.businessAccountId, !business.isEmpty else {
                return .denied("A business grant must name its business.")
            }
            return .requiresWeddingSelection(grant)
        default:
            return .denied("Grant kind '\(grant.workspaceKindWire)/\(grant.scopeKindWire)' is not a supported native workspace.")
        }
    }

    private static func weddingAssignment(_ grant: ProductionWorkspaceGrant, role: AppRole, actorId: String) -> Outcome {
        guard let weddingId = grant.weddingId, !weddingId.isEmpty else {
            return .denied("A wedding-scoped grant must name its wedding.")
        }
        return .assigned(ActorAssignment(actorId: actorId, role: role, weddingId: weddingId))
    }

    private static func vendorAssignment(
        _ grant: ProductionWorkspaceGrant,
        actorId: String,
        selectedEngagementId: String?
    ) -> Outcome {
        guard let weddingId = grant.weddingId, !weddingId.isEmpty else {
            return .denied("A Vendor wedding grant must name its wedding.")
        }
        guard let vendorId = grant.vendorId, !vendorId.isEmpty else {
            return .denied("A Vendor wedding grant must name its vendor.")
        }
        let engagementId: String?
        if let selected = selectedEngagementId {
            guard grant.serviceEngagementIds.contains(selected) else {
                return .denied("That engagement is not part of this grant.")
            }
            engagementId = selected
        } else {
            engagementId = grant.serviceEngagementIds.count == 1 ? grant.serviceEngagementIds[0] : nil
        }
        return .assigned(ActorAssignment(
            actorId: actorId, role: .vendor, weddingId: weddingId, vendorId: vendorId, engagementId: engagementId
        ))
    }
}
