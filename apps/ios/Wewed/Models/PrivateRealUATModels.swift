import Foundation

/// Where a value in a native model came from.
///
/// Earlier phases could not tell a production fact from a fabricated relationship: a planner
/// "engagement" that production did not hold rendered exactly like one it did. Provenance makes
/// that distinction part of the data rather than a comment, so tests can assert it and surfaces can
/// state it honestly. It is not primarily a user-facing label.
public enum DataProvenance: String, Sendable, Codable, CaseIterable {
    /// Copied from an authorized read of production.
    case productionDerived = "PRODUCTION_DERIVED"
    /// Granted for UAT only — real actor, real wedding, but not a production relationship.
    case uatOverlay = "UAT_OVERLAY"
    /// Computed from production-derived values (totals, percentages, groupings).
    case derived = "DERIVED"
    /// Changed inside the local UAT session; never written back to production.
    case shadowMutation = "SHADOW_MUTATION"
    /// Production genuinely holds no row. Distinct from "we could not read it".
    case absent = "ABSENT"
    /// A grant is missing. Distinct from `absent`: the rows may well exist.
    case notAuthorized = "NOT_AUTHORIZED"

    public static func fromWire(_ value: String?) -> DataProvenance {
        guard let value, let match = DataProvenance(rawValue: value) else { return .productionDerived }
        return match
    }
}

/// Identifies the snapshot the runtime actually loaded.
///
/// Provisioning used to fail silently, leaving the device on an older snapshot while the badge
/// still read "Private Real". Surfacing the schema version, content hash and per-domain counts
/// makes the loaded graph testable instead of assumed. Not shown to ordinary production users.
public struct UatSnapshotManifest: Sendable, Equatable {
    public let schemaVersion: String
    public let sourceWeddingId: String
    public let generatedAt: String
    public let contentHashPrefix: String
    public let domainCounts: [String: Int]

    public init(schemaVersion: String, sourceWeddingId: String, generatedAt: String,
                contentHashPrefix: String, domainCounts: [String: Int]) {
        self.schemaVersion = schemaVersion
        self.sourceWeddingId = sourceWeddingId
        self.generatedAt = generatedAt
        self.contentHashPrefix = contentHashPrefix
        self.domainCounts = domainCounts
    }

    public func count(_ domain: String) -> Int { domainCounts[domain] ?? 0 }
}

/// The full RSVP record behind a guest, beyond the attending/declined summary.
public struct GuestRsvpDetail: Sendable, Equatable {
    public let id: String
    public let guestId: String
    public let attending: Bool?
    public let mealChoice: String?
    public let plusOne: Bool
    public let plusOneName: String?
    public let plusOneMeal: String?
    public let kidsAttending: Bool
    public let kidsCount: Int
    public let songRequests: String?
    public let dietaryNotes: String?
    public let message: String?
    public let checkedIn: Bool
    public let checkedInAt: String?
    public let provenance: DataProvenance

    public init(id: String, guestId: String, attending: Bool?, mealChoice: String? = nil,
                plusOne: Bool = false, plusOneName: String? = nil, plusOneMeal: String? = nil,
                kidsAttending: Bool = false, kidsCount: Int = 0, songRequests: String? = nil,
                dietaryNotes: String? = nil, message: String? = nil, checkedIn: Bool = false,
                checkedInAt: String? = nil, provenance: DataProvenance = .productionDerived) {
        self.id = id
        self.guestId = guestId
        self.attending = attending
        self.mealChoice = mealChoice
        self.plusOne = plusOne
        self.plusOneName = plusOneName
        self.plusOneMeal = plusOneMeal
        self.kidsAttending = kidsAttending
        self.kidsCount = kidsCount
        self.songRequests = songRequests
        self.dietaryNotes = dietaryNotes
        self.message = message
        self.checkedIn = checkedIn
        self.checkedInAt = checkedInAt
        self.provenance = provenance
    }

    public var hasDietaryRequirement: Bool { !(dietaryNotes ?? "").isEmpty }
    public var hasSongRequest: Bool { !(songRequests ?? "").isEmpty }
    public var hasMessage: Bool { !(message ?? "").isEmpty }

    /// What the Gate may see. Admission needs identity and party size, never a guest's dietary
    /// requirements, contact details or private message.
    public func operationalOnly() -> GuestRsvpDetail {
        GuestRsvpDetail(id: id, guestId: guestId, attending: attending, plusOne: plusOne,
                        kidsAttending: kidsAttending, kidsCount: kidsCount,
                        checkedIn: checkedIn, checkedInAt: checkedInAt, provenance: provenance)
    }
}

/// Authorized contact and role detail for a guest. Couple and authorized Planner only.
public struct GuestContactDetail: Sendable, Equatable {
    public let guestId: String
    public let email: String?
    public let phone: String?
    public let role: String?
    public let roleDetail: String?
    public let provenance: DataProvenance

    public init(guestId: String, email: String? = nil, phone: String? = nil, role: String? = nil,
                roleDetail: String? = nil, provenance: DataProvenance = .productionDerived) {
        self.guestId = guestId
        self.email = email
        self.phone = phone
        self.role = role
        self.roleDetail = roleDetail
        self.provenance = provenance
    }
}

/// One production `WeddingContent` row: a section/field/value triple.
///
/// The wedding's story, venue notes, FAQ, travel information and gallery all live in this one
/// table, which is why treating it as "unsupported" blanked twelve real surfaces at once.
public struct WeddingContentEntry: Sendable, Equatable, Identifiable {
    public let id: String
    public let section: String
    public let field: String
    public let value: String
    public let order: Int
    public let metadata: String?
    public let provenance: DataProvenance

    public init(id: String, section: String, field: String, value: String, order: Int = 0,
                metadata: String? = nil, provenance: DataProvenance = .productionDerived) {
        self.id = id
        self.section = section
        self.field = field
        self.value = value
        self.order = order
        self.metadata = metadata
        self.provenance = provenance
    }

    /// True when the value is a media reference rather than prose.
    public var isMediaReference: Bool {
        value.hasPrefix("http://") || value.hasPrefix("https://")
            || value.hasPrefix("/uploads/") || value.hasPrefix("data:image/")
    }
}

/// All content for one section, ordered as the couple arranged it.
public struct WeddingContentSection: Sendable, Equatable, Identifiable {
    public let section: String
    public let title: String
    public let entries: [WeddingContentEntry]

    public var id: String { section }
    public var isEmpty: Bool { entries.isEmpty }

    public init(section: String, title: String, entries: [WeddingContentEntry]) {
        self.section = section
        self.title = title
        self.entries = entries
    }

    public func value(_ field: String) -> String? {
        entries.first { $0.field == field }?.value
    }

    public var mediaEntries: [WeddingContentEntry] { entries.filter { $0.isMediaReference } }
    public var proseEntries: [WeddingContentEntry] { entries.filter { !$0.isMediaReference } }

    /// Display titles for the production section keys.
    public static let titles: [String: String] = [
        "hero": "Hero", "story": "Our Story", "gallery": "Gallery", "venue": "Venue",
        "faq": "FAQ", "travel": "Travel", "theday": "The Day", "guests": "Guests",
        "vendors": "Vendors", "songbook": "Songbook", "memory": "Memory", "after": "After"
    ]

    public static func titleFor(_ section: String) -> String {
        titles[section] ?? section.prefix(1).uppercased() + section.dropFirst()
    }
}

/// A songbook entry as the couple recorded it.
public struct SongEntry: Sendable, Equatable, Identifiable {
    public let id: String
    public let title: String
    public let artist: String?
    public let phase: String?
    public let moment: String?
    public let order: Int
    public let votes: Int
    public let notes: String?
    public let playedAt: String?
    public let spotifyUrl: String?
    public let appleUrl: String?
    public let provenance: DataProvenance

    public init(id: String, title: String, artist: String? = nil, phase: String? = nil,
                moment: String? = nil, order: Int = 0, votes: Int = 0, notes: String? = nil,
                playedAt: String? = nil, spotifyUrl: String? = nil, appleUrl: String? = nil,
                provenance: DataProvenance = .productionDerived) {
        self.id = id
        self.title = title
        self.artist = artist
        self.phase = phase
        self.moment = moment
        self.order = order
        self.votes = votes
        self.notes = notes
        self.playedAt = playedAt
        self.spotifyUrl = spotifyUrl
        self.appleUrl = appleUrl
        self.provenance = provenance
    }

    public var hasStreamingLink: Bool {
        !(spotifyUrl ?? "").isEmpty || !(appleUrl ?? "").isEmpty
    }

    /// Guests see the song, not the couple's planning notes about it.
    public func guestVisible() -> SongEntry {
        SongEntry(id: id, title: title, artist: artist, phase: phase, moment: moment,
                  order: order, votes: votes, notes: nil, playedAt: playedAt,
                  spotifyUrl: spotifyUrl, appleUrl: appleUrl, provenance: provenance)
    }
}

/// A real scan destination. This is routing configuration, never pass signing material.
public struct QrDestination: Sendable, Equatable, Identifiable {
    public let id: String
    public let label: String
    public let type: String
    public let url: String
    public let isActive: Bool
    public let scanCount: Int
    public let provenance: DataProvenance

    public init(id: String, label: String, type: String, url: String, isActive: Bool = true,
                scanCount: Int = 0, provenance: DataProvenance = .productionDerived) {
        self.id = id
        self.label = label
        self.type = type
        self.url = url
        self.isActive = isActive
        self.scanCount = scanCount
        self.provenance = provenance
    }
}

/// A completed data import. Rollback payloads and preview rows are deliberately not carried.
public struct ImportJobRecord: Sendable, Equatable, Identifiable {
    public let id: String
    public let moduleKey: String
    public let fileName: String?
    public let status: String
    public let totalRows: Int
    public let createdCount: Int
    public let updatedCount: Int
    public let skippedCount: Int
    public let errorCount: Int
    public let performedAt: String?
    public let provenance: DataProvenance

    public init(id: String, moduleKey: String, fileName: String? = nil, status: String,
                totalRows: Int = 0, createdCount: Int = 0, updatedCount: Int = 0,
                skippedCount: Int = 0, errorCount: Int = 0, performedAt: String? = nil,
                provenance: DataProvenance = .productionDerived) {
        self.id = id
        self.moduleKey = moduleKey
        self.fileName = fileName
        self.status = status
        self.totalRows = totalRows
        self.createdCount = createdCount
        self.updatedCount = updatedCount
        self.skippedCount = skippedCount
        self.errorCount = errorCount
        self.performedAt = performedAt
        self.provenance = provenance
    }

    public var succeeded: Bool {
        status.lowercased() == "completed" || status.lowercased() == "success"
    }

    public var moduleTitle: String {
        let spaced = moduleKey.replacingOccurrences(of: "_", with: " ")
        return spaced.prefix(1).uppercased() + spaced.dropFirst()
    }
}

/// A public wedding-wall message.
///
/// Production holds these as `type = "wall"`, `isPublic = true`. They are guest-facing wall posts
/// and are NOT planner-to-couple private correspondence; conflating the two would misrepresent both.
public struct WallMessage: Sendable, Equatable, Identifiable {
    public let id: String
    public let authorName: String?
    public let content: String
    public let type: String
    public let isPublic: Bool
    public let revealedAt: String?
    public let createdAt: String?
    public let provenance: DataProvenance

    public init(id: String, authorName: String?, content: String, type: String, isPublic: Bool,
                revealedAt: String? = nil, createdAt: String? = nil,
                provenance: DataProvenance = .productionDerived) {
        self.id = id
        self.authorName = authorName
        self.content = content
        self.type = type
        self.isPublic = isPublic
        self.revealedAt = revealedAt
        self.createdAt = createdAt
        self.provenance = provenance
    }
}

/// Content-management history for a wedding-content field. Not exposed to guests.
public struct ContentRevisionRecord: Sendable, Equatable, Identifiable {
    public let id: String
    public let section: String
    public let fieldKey: String
    public let status: String
    public let publishedAt: String?
    public let scheduledFor: String?
    public let authorId: String?
    public let hasPreviousValue: Bool
    public let provenance: DataProvenance

    public init(id: String, section: String, fieldKey: String, status: String,
                publishedAt: String? = nil, scheduledFor: String? = nil, authorId: String? = nil,
                hasPreviousValue: Bool = false, provenance: DataProvenance = .productionDerived) {
        self.id = id
        self.section = section
        self.fieldKey = fieldKey
        self.status = status
        self.publishedAt = publishedAt
        self.scheduledFor = scheduledFor
        self.authorId = authorId
        self.hasPreviousValue = hasPreviousValue
        self.provenance = provenance
    }

    public var isPublished: Bool { status.lowercased() == "published" || publishedAt != nil }
    public var isScheduled: Bool { scheduledFor != nil && !isPublished }
}

/// A named party to a service engagement — the real contractual relation, not a vendor-name guess.
public struct EngagementPartyRecord: Sendable, Equatable, Identifiable {
    public let id: String
    public let serviceEngagementId: String
    public let partyKind: String
    public let partyRole: String
    public let displayName: String
    public let legalName: String?
    public let email: String?
    public let phone: String?
    public let authorityBasis: String?
    public let status: String?
    public let requiredForReview: Bool
    public let provenance: DataProvenance

    public init(id: String, serviceEngagementId: String, partyKind: String, partyRole: String,
                displayName: String, legalName: String? = nil, email: String? = nil,
                phone: String? = nil, authorityBasis: String? = nil, status: String? = nil,
                requiredForReview: Bool = false, provenance: DataProvenance = .productionDerived) {
        self.id = id
        self.serviceEngagementId = serviceEngagementId
        self.partyKind = partyKind
        self.partyRole = partyRole
        self.displayName = displayName
        self.legalName = legalName
        self.email = email
        self.phone = phone
        self.authorityBasis = authorityBasis
        self.status = status
        self.requiredForReview = requiredForReview
        self.provenance = provenance
    }
}

/// A wedding-scoped audit entry.
///
/// Only the fields the Admin surface needs are carried. Request forensics (IP address, user agent)
/// and before/after values are deliberately not part of the native model, so they cannot leak
/// through a screen that merely lists activity.
public struct AuditEventRecord: Sendable, Equatable, Identifiable {
    public let id: String
    public let action: String
    public let actorId: String?
    public let resourceType: String?
    public let resourceId: String?
    public let createdAt: String?
    public let provenance: DataProvenance

    public init(id: String, action: String, actorId: String? = nil, resourceType: String? = nil,
                resourceId: String? = nil, createdAt: String? = nil,
                provenance: DataProvenance = .productionDerived) {
        self.id = id
        self.action = action
        self.actorId = actorId
        self.resourceType = resourceType
        self.resourceId = resourceId
        self.createdAt = createdAt
        self.provenance = provenance
    }
}

/// How the active planner reaches this wedding.
///
/// Production holds no PlannerEngagement and no WeddingMembership for Eleven Eleven Testing on
/// Charity & Kudzie. The UAT overlay authorizes the planner to exercise the wedding, and this model
/// keeps that fact visible instead of implying a contract that does not exist.
public struct PlannerAccessContext: Sendable, Equatable {
    public let businessName: String?
    public let profileStatus: String?
    public let teamSize: Int?
    public let completedWeddings: Int?
    public let enquiryStatus: String?
    public let productionEngagementCount: Int
    public let productionMembershipCount: Int
    public let accessBasis: DataProvenance

    public init(businessName: String?, profileStatus: String?, teamSize: Int?,
                completedWeddings: Int?, enquiryStatus: String?, productionEngagementCount: Int,
                productionMembershipCount: Int, accessBasis: DataProvenance) {
        self.businessName = businessName
        self.profileStatus = profileStatus
        self.teamSize = teamSize
        self.completedWeddings = completedWeddings
        self.enquiryStatus = enquiryStatus
        self.productionEngagementCount = productionEngagementCount
        self.productionMembershipCount = productionMembershipCount
        self.accessBasis = accessBasis
    }

    public var isProductionEngagement: Bool { accessBasis == .productionDerived }

    /// One honest sentence for the workspace header.
    public var accessDescription: String {
        isProductionEngagement
            ? "Production engagement"
            : "UAT test access — no production engagement on record"
    }
}

/// Why an Admin surface has nothing to show.
public struct AdminAccessContext: Sendable, Equatable {
    public let status: String
    public let deniedDomains: [String]
    public let emptyDomains: [String]
    public let note: String

    public init(status: String, deniedDomains: [String], emptyDomains: [String], note: String) {
        self.status = status
        self.deniedDomains = deniedDomains
        self.emptyDomains = emptyDomains
        self.note = note
    }

    public var isBlockedByAuthorization: Bool { status == "BLOCKED_BY_AUTHORIZATION" }
}
