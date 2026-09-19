import Foundation

/// What a signed-in person may do. Shells and data access are gated on these,
/// never on the mere presence of a screen in the binary. Mirrors Android `Capability`.
public enum Capability: String, CaseIterable, Sendable {
    case viewWeddingSummary
    case viewProgramme
    case viewPlanningDashboard
    case viewTasks
    case manageTasks
    case viewBudget
    case viewGuestRoster
    case viewContributions
    case viewContributorIdentity
    case viewAllVendorEngagements
    case viewOwnVendorEngagement
    case viewVendorPresence
    case updateOwnVendorPresence
    case viewSeating
    case viewDocuments
    case editWeddingDetails
    case previewGuestPasses
    case viewOwnInvitation
    case respondOwnRsvp
    case viewOwnPass
    case scanAdmission
    case lookupAdmission
    case viewAdmissionSummary
    case postAnnouncement
    case plannerWorkspace
    case plannerActions
    case adminSupport
}

/// Where an authorization came from. Only sourceRecord and invitationToken reflect real relationships.
public enum GrantProvenance: String, Sendable {
    /// Backed by a real record in the wedding graph (e.g. Couple.userId owns Wedding.coupleId).
    case sourceRecord
    /// The guest proved possession of their own invitation link.
    case invitationToken
    /// Git-safe sanitized dataset; no real relationship exists.
    case sanitizedFixture
    /// Explicit UAT-only authorization. Never a production relationship.
    case shadowTestOverlay
}

public struct RoleGrant: Equatable, Sendable {
    public let role: AppRole
    public let weddingId: String
    public let weddingTitle: String
    public let provenance: GrantProvenance
    /// Plain-language explanation of why this grant exists; shown where the grant is a test overlay.
    public let provenanceNote: String
    /// Guest scope: the single guest record this grant may see.
    public let guestId: String?
    /// Vendor scope: the single vendor whose engagement this grant may see.
    public let vendorId: String?

    public init(
        role: AppRole,
        weddingId: String,
        weddingTitle: String,
        provenance: GrantProvenance,
        provenanceNote: String,
        guestId: String? = nil,
        vendorId: String? = nil
    ) {
        self.role = role
        self.weddingId = weddingId
        self.weddingTitle = weddingTitle
        self.provenance = provenance
        self.provenanceNote = provenanceNote
        self.guestId = guestId
        self.vendorId = vendorId
    }

    public var isTestOverlay: Bool { provenance == .shadowTestOverlay }
}

public struct AuthorizedSession: Equatable, Sendable {
    public let accountId: String
    public let displayName: String
    public let grants: [RoleGrant]

    public init(accountId: String, displayName: String, grants: [RoleGrant]) {
        precondition(!grants.isEmpty, "An authorized session needs at least one role grant.")
        self.accountId = accountId
        self.displayName = displayName
        self.grants = grants
    }

    public var requiresRoleChoice: Bool { grants.count > 1 }

    public func grant(for role: AppRole) -> RoleGrant? {
        grants.first { $0.role == role }
    }
}

public struct AccessDeniedError: Error, Equatable, LocalizedError {
    public let role: AppRole
    public let capability: Capability

    public var errorDescription: String? {
        "\(role.roleId) is not authorized for \(capability.rawValue)"
    }
}

/// The minimum a gate needs to admit a party. No RSVP history, no side, no contact details.
public struct AdmissionLookupRow: Identifiable, Equatable, Sendable {
    public var id: String { guestId }
    public let guestId: String
    public let displayName: String
    public let partySize: Int
    public let admittedCount: Int
    public let tableName: String?

    public var remaining: Int { max(partySize - admittedCount, 0) }
}

public struct AdmissionSummary: Equatable, Sendable {
    public let attendingParties: Int
    public let expectedGuests: Int
    public let admittedGuests: Int
}

public struct AdminAuditEntry: Equatable, Sendable {
    public let section: String
    public let weddingId: String
    public let recordedAt: Date
}

public struct WeddingDetailsUpdate: Equatable, Sendable {
    public let coupleNames: String
    public let date: String
    public let venueName: String
    public let city: String
    public let country: String

    public init(coupleNames: String, date: String, venueName: String, city: String, country: String) {
        self.coupleNames = coupleNames
        self.date = date
        self.venueName = venueName
        self.city = city
        self.country = country
    }
}
