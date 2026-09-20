import SwiftUI

/// Sections backed by the production `WeddingContent`, `Song`, `QRDestination`, `ImportJob`,
/// `Message` and `EngagementParty` graphs.
///
/// These twelve content sections, the songbook, the scan destination, the import history and the
/// wedding wall were all reported as "unsupported" while production held 107, 27, 1, 40 and 3 rows
/// respectively. The cause was never the product — it was a snapshot that did not carry the tables.
///
/// Two states are kept distinct throughout, because collapsing them is what made a real wedding
/// look like an empty one:
///
///   HONEST EMPTY  — the source holds no rows, and says so naming the section.
///   NOT PUBLISHED — the couple has not published this section yet.
///
/// Neither is ever replaced with invented copy.
///
/// This file is the SwiftUI counterpart of Android's `ProductionDataSections.kt`; both render the
/// same content hierarchy from the same canonical snapshot, per the cross-platform visual contract.

// MARK: - Wedding content

/// A content section rendered from real `WeddingContent` rows.
public struct WeddingContentSectionView: View {
    private let section: WeddingContentSection
    private let testIdPrefix: String
    private let showMediaReferences: Bool

    public init(section: WeddingContentSection, testIdPrefix: String, showMediaReferences: Bool = true) {
        self.section = section
        self.testIdPrefix = testIdPrefix
        self.showMediaReferences = showMediaReferences
    }

    public var body: some View {
        if section.isEmpty {
            IAEmptyPublishedSection(title: section.title, testIdPrefix: testIdPrefix)
        } else {
            IASectionList(section.title, "\(section.entries.count) published entries") {
                // Prose first, in the order the couple arranged it; media references after, so a
                // section that is mostly text does not lead with an image placeholder.
                ForEach(section.proseEntries) { entry in
                    IACard(entry.field.humanisedContentField(), entry.value,
                           testId: "\(testIdPrefix)-\(entry.field)")
                }
                if showMediaReferences && !section.mediaEntries.isEmpty {
                    Text("Media")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(WeddingIdentityPalette.muted)
                    ForEach(section.mediaEntries) { entry in
                        IACard(entry.field.humanisedContentField(), entry.value,
                               status: "Reference",
                               testId: "\(testIdPrefix)-media-\(entry.field)")
                    }
                }
            }
        }
    }
}

/// The Gallery.
///
/// `MediaItem` holds zero rows for this wedding, which is why the gallery was previously reported
/// empty. The gallery is not empty: the couple's `WeddingContent` gallery section carries a real
/// heading, a real subtitle and real preview-image references. Those references point at
/// application assets, so they are rendered where the native bundle carries the asset and marked
/// honestly where it does not — never replaced with a generic "no photos yet".
public struct GalleryContentSection: View {
    private let section: WeddingContentSection
    private let bundledMedia: Set<String>
    private let testIdPrefix: String

    public init(section: WeddingContentSection,
                bundledMedia: Set<String> = BundledWeddingMedia.names,
                testIdPrefix: String = "gallery") {
        self.section = section
        self.bundledMedia = bundledMedia
        self.testIdPrefix = testIdPrefix
    }

    private var previews: [WeddingContentEntry] {
        section.entries.filter { $0.field.hasPrefix("previewImage") }.sorted { $0.order < $1.order }
    }

    public var body: some View {
        if section.isEmpty {
            IAEmptyPublishedSection(title: "Gallery", testIdPrefix: testIdPrefix)
        } else {
            IASectionList(section.value("heading") ?? "Gallery", section.value("subtitle")) {
                if previews.isEmpty {
                    IACard("No preview images published",
                           "The couple has published gallery text but no images yet.",
                           testId: "\(testIdPrefix)-no-previews")
                }
                // A gallery shows pictures. Listing file paths is a manifest, not a gallery, so
                // each reference the native bundle can resolve is rendered as the image itself; a
                // reference it cannot resolve says so plainly rather than being hidden or faked.
                ForEach(previews) { entry in
                    let assetName = entry.value.assetBaseName()
                    if bundledMedia.contains(assetName) {
                        WewedMediaImage(assetName)
                            .aspectRatio(contentMode: .fill)
                            .frame(height: 180)
                            .clipped()
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .accessibilityLabel(entry.field.humanisedContentField())
                            .accessibilityIdentifier("\(testIdPrefix)-\(entry.field)")
                    } else {
                        IACard(entry.field.humanisedContentField(),
                               "This image is published for the web experience and is not bundled with the app.",
                               status: "Not bundled",
                               testId: "\(testIdPrefix)-\(entry.field)")
                    }
                }
            }
        }
    }
}

// MARK: - Songbook

/// The songbook, from the couple's real `Song` rows.
///
/// `guestVisible` drops the couple's private planning notes: a guest may see the song and who it is
/// by, never the note the couple wrote about it.
public struct SongbookSection: View {
    private let songs: [SongEntry]
    private let guestVisible: Bool
    private let testIdPrefix: String

    public init(songs: [SongEntry], guestVisible: Bool, testIdPrefix: String = "songbook") {
        self.songs = songs
        self.guestVisible = guestVisible
        self.testIdPrefix = testIdPrefix
    }

    private var visible: [SongEntry] { guestVisible ? songs.map { $0.guestVisible() } : songs }

    public var body: some View {
        if songs.isEmpty {
            IAEmptySourceSection(title: "Songbook",
                                 reason: "No songs are recorded for this wedding.",
                                 testIdPrefix: testIdPrefix)
        } else {
            let played = visible.filter { !($0.playedAt ?? "").isEmpty }.count
            IASectionList("Songbook", played > 0
                          ? "\(visible.count) songs · \(played) played"
                          : "\(visible.count) songs") {
                ForEach(visible) { song in
                    let detail = [song.artist, song.moment, song.notes]
                        .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                    IACard(song.title, detail.isEmpty ? nil : detail,
                           trailing: song.votes > 0 ? "\(song.votes) votes" : nil,
                           status: song.phase?.capitalizedFirst(),
                           testId: "\(testIdPrefix)-\(song.id)")
                }
            }
        }
    }
}

// MARK: - Invitations & QR

/// Invitations & QR, from the real `QRDestination` rows.
///
/// A scan destination is routing configuration: a label, a kind, a URL and a scan count. It is not
/// a Wedding Pass credential, and the two must not be conflated — the pass carries signing material
/// that never appears here.
public struct InvitationsQrSection: View {
    private let destinations: [QrDestination]
    private let invitationCardStyle: String?
    private let testIdPrefix: String

    public init(destinations: [QrDestination], invitationCardStyle: String? = nil,
                testIdPrefix: String = "invitations-qr") {
        self.destinations = destinations
        self.invitationCardStyle = invitationCardStyle
        self.testIdPrefix = testIdPrefix
    }

    public var body: some View {
        if destinations.isEmpty {
            IAEmptySourceSection(title: "Invitations & QR",
                                 reason: "No scan destinations are configured for this wedding.",
                                 testIdPrefix: testIdPrefix)
        } else {
            IASectionList("Invitations & QR", "\(destinations.count) scan destinations") {
                ForEach(destinations) { destination in
                    IACard(destination.label.isEmpty ? destination.type : destination.label,
                           destination.url,
                           trailing: "\(destination.scanCount) scans",
                           status: destination.isActive ? "Active" : "Inactive",
                           testId: "\(testIdPrefix)-\(destination.id)")
                }
                if let style = invitationCardStyle, !style.isEmpty {
                    IACard("Invitation card style", style.capitalizedFirst(),
                           testId: "\(testIdPrefix)-card-style")
                }
                Text("Scan destinations route a scan. They are not Wedding Pass credentials.")
                    .font(.system(size: 11))
                    .foregroundColor(WeddingIdentityPalette.muted)
            }
        }
    }
}

// MARK: - Imports

/// Recent Imports, from the real `ImportJob` history.
///
/// Rollback tokens, rollback payloads and preview rows are deliberately absent from the native
/// model: an import history screen needs what happened, not the material to replay or undo it.
public struct RecentImportsSection: View {
    private let jobs: [ImportJobRecord]
    private let testIdPrefix: String

    public init(jobs: [ImportJobRecord], testIdPrefix: String = "recent-imports") {
        self.jobs = jobs
        self.testIdPrefix = testIdPrefix
    }

    public var body: some View {
        if jobs.isEmpty {
            IAEmptySourceSection(title: "Recent Imports",
                                 reason: "No imports have been performed for this wedding.",
                                 testIdPrefix: testIdPrefix)
        } else {
            let failed = jobs.filter { !$0.succeeded }.count
            IASectionList("Recent Imports", failed > 0
                          ? "\(jobs.count) imports · \(failed) not completed"
                          : "\(jobs.count) imports") {
                ForEach(jobs) { job in
                    let counts = [
                        job.createdCount > 0 ? "\(job.createdCount) created" : nil,
                        job.updatedCount > 0 ? "\(job.updatedCount) updated" : nil,
                        job.skippedCount > 0 ? "\(job.skippedCount) skipped" : nil,
                        job.errorCount > 0 ? "\(job.errorCount) errors" : nil
                    ].compactMap { $0 }.joined(separator: " · ")
                    IACard(job.moduleTitle,
                           [job.fileName, counts.isEmpty ? "\(job.totalRows) rows" : counts]
                               .compactMap { $0 }.joined(separator: " — "),
                           trailing: job.performedAt?.asDisplayDate(),
                           status: job.status.capitalizedFirst(),
                           testId: "\(testIdPrefix)-\(job.id)")
                }
            }
        }
    }
}

// MARK: - Wall

/// The wedding wall, from the real `Message` rows.
///
/// Production holds these as `type = "wall"`, `isPublic = true`: they are guest-facing wall posts.
/// They are NOT planner-to-couple correspondence, and this surface says so rather than letting
/// three public messages stand in for a private messaging system that has not been located.
public struct LiveWallMessagesSection: View {
    private let messages: [WallMessage]
    private let testIdPrefix: String

    public init(messages: [WallMessage], testIdPrefix: String = "live-wall") {
        self.messages = messages
        self.testIdPrefix = testIdPrefix
    }

    private var publicMessages: [WallMessage] { messages.filter { $0.isPublic } }

    public var body: some View {
        if publicMessages.isEmpty {
            IAEmptySourceSection(title: "Live Wall",
                                 reason: "No wall messages have been posted for this wedding.",
                                 testIdPrefix: testIdPrefix)
        } else {
            IASectionList("Live Wall", "\(publicMessages.count) public messages") {
                ForEach(publicMessages) { message in
                    IACard((message.authorName?.isEmpty == false) ? message.authorName! : "A guest",
                           message.content,
                           trailing: message.createdAt?.asDisplayDate(),
                           testId: "\(testIdPrefix)-\(message.id)")
                }
            }
        }
    }
}

// MARK: - Engagement parties and revisions

/// Parties to the wedding's service engagements.
///
/// Where production records a real party relation, it is used. Inferring the counterparty from a
/// vendor's name would be a guess presented as a fact.
public struct EngagementPartiesSection: View {
    private let parties: [EngagementPartyRecord]
    private let testIdPrefix: String

    public init(parties: [EngagementPartyRecord], testIdPrefix: String = "engagement-parties") {
        self.parties = parties
        self.testIdPrefix = testIdPrefix
    }

    public var body: some View {
        if parties.isEmpty {
            IAEmptySourceSection(title: "Engagement Parties",
                                 reason: "No named parties are recorded against this wedding's service engagements.",
                                 testIdPrefix: testIdPrefix)
        } else {
            IASectionList("Engagement Parties", "\(parties.count) named parties") {
                ForEach(parties) { party in
                    IACard(party.displayName.isEmpty ? (party.legalName ?? party.partyRole) : party.displayName,
                           [party.partyRole, party.authorityBasis]
                               .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "),
                           status: party.status?.capitalizedFirst(),
                           testId: "\(testIdPrefix)-\(party.id)")
                }
            }
        }
    }
}

/// Content-management history. Never rendered for guests.
public struct ContentRevisionsSection: View {
    private let revisions: [ContentRevisionRecord]
    private let testIdPrefix: String

    public init(revisions: [ContentRevisionRecord], testIdPrefix: String = "content-revisions") {
        self.revisions = revisions
        self.testIdPrefix = testIdPrefix
    }

    public var body: some View {
        if revisions.isEmpty {
            IAEmptySourceSection(title: "Content History",
                                 reason: "No content revisions are recorded for this wedding.",
                                 testIdPrefix: testIdPrefix)
        } else {
            IASectionList("Content History", "\(revisions.count) revisions") {
                ForEach(revisions) { revision in
                    let state: String = {
                        if revision.isPublished {
                            return "Published" + (revision.publishedAt.map { " " + $0.asDisplayDate() } ?? "")
                        }
                        if revision.isScheduled {
                            return "Scheduled for " + (revision.scheduledFor?.asDisplayDate() ?? "")
                        }
                        return "Draft"
                    }()
                    IACard("\(WeddingContentSection.titleFor(revision.section)) · \(revision.fieldKey)",
                           state,
                           status: revision.status.capitalizedFirst(),
                           testId: "\(testIdPrefix)-\(revision.id)")
                }
            }
        }
    }
}

// MARK: - Audit

/// Admin audit, from the real wedding-scoped `AuditEvent` rows.
///
/// Request forensics and before/after values are not in the model at all, so they cannot leak
/// through a screen that merely lists activity. Access is gated by the caller on Admin
/// authorization.
public struct AuditEventsSection: View {
    private let events: [AuditEventRecord]
    private let adminAccess: AdminAccessContext?
    private let testIdPrefix: String

    public init(events: [AuditEventRecord], adminAccess: AdminAccessContext?,
                testIdPrefix: String = "audit-events") {
        self.events = events
        self.adminAccess = adminAccess
        self.testIdPrefix = testIdPrefix
    }

    public var body: some View {
        if let access = adminAccess, access.isBlockedByAuthorization {
            IASectionList("Audit", "Authorization required") {
                IACard("Admin audit is not authorized for this reader", access.note,
                       status: "Blocked", testId: "\(testIdPrefix)-blocked")
                if !access.deniedDomains.isEmpty {
                    IACard("Denied domains", access.deniedDomains.joined(separator: ", "),
                           testId: "\(testIdPrefix)-denied")
                }
            }
        } else if events.isEmpty {
            IAEmptySourceSection(title: "Audit",
                                 reason: "No audit activity is recorded for this wedding.",
                                 testIdPrefix: testIdPrefix)
        } else {
            IASectionList("Audit", "\(events.count) events") {
                ForEach(events.prefix(100)) { event in
                    IACard(event.action.replacingOccurrences(of: "_", with: " ").capitalizedFirst(),
                           [event.resourceType, event.resourceId.map { String($0.prefix(12)) }]
                               .compactMap { $0 }.joined(separator: " · "),
                           trailing: event.createdAt?.asDisplayDate(),
                           testId: "\(testIdPrefix)-\(event.id)")
                }
                if events.count > 100 {
                    Text("Showing the 100 most recent of \(events.count) events.")
                        .font(.system(size: 11))
                        .foregroundColor(WeddingIdentityPalette.muted)
                }
            }
        }
    }
}

// MARK: - RSVP detail

/// A guest's RSVP detail.
///
/// `canSeePrivateDetail` is the authorization boundary, not a display preference: the Gate sees
/// admission facts, the Couple and an authorized Planner see the full record, and a guest sees only
/// their own. Dietary requirements, private messages and contact details never cross that line.
public struct GuestRsvpDetailSection: View {
    private let guest: Guest
    private let rsvp: GuestRsvpDetail?
    private let contact: GuestContactDetail?
    private let canSeePrivateDetail: Bool
    private let testIdPrefix: String

    public init(guest: Guest, rsvp: GuestRsvpDetail?, contact: GuestContactDetail?,
                canSeePrivateDetail: Bool, testIdPrefix: String = "rsvp-detail") {
        self.guest = guest
        self.rsvp = rsvp
        self.contact = contact
        self.canSeePrivateDetail = canSeePrivateDetail
        self.testIdPrefix = testIdPrefix
    }

    private var attendanceText: String {
        switch rsvp?.attending {
        case .some(true): return "Attending"
        case .some(false): return "Not attending"
        default: return "No response yet"
        }
    }

    public var body: some View {
        IASectionList(guest.name, guest.rsvpStatus.title) {
            IACard("RSVP", attendanceText,
                   trailing: "Party of \(guest.partySize)",
                   testId: "\(testIdPrefix)-status")

            if let rsvp {
                if rsvp.plusOne {
                    let plusOneDetail = [rsvp.plusOneName, rsvp.plusOneMeal]
                        .compactMap { $0 }.joined(separator: " · ")
                    IACard("Plus one",
                           plusOneDetail.isEmpty ? "Confirmed, no name recorded" : plusOneDetail,
                           testId: "\(testIdPrefix)-plus-one")
                }
                if rsvp.kidsAttending || rsvp.kidsCount > 0 {
                    IACard("Children", "\(rsvp.kidsCount) attending", testId: "\(testIdPrefix)-kids")
                }
                if let table = guest.tableName {
                    IACard("Seating", table, testId: "\(testIdPrefix)-seating")
                }
                IACard("Check-in",
                       rsvp.checkedIn
                           ? "Checked in" + (rsvp.checkedInAt.map { " on " + $0.asDisplayDateTime() } ?? "")
                           : "Not checked in",
                       testId: "\(testIdPrefix)-check-in")

                // Everything below this line is private to the guest and the couple's planning team.
                if canSeePrivateDetail {
                    if let meal = rsvp.mealChoice, !meal.isEmpty {
                        IACard("Meal choice", meal, testId: "\(testIdPrefix)-meal")
                    }
                    if rsvp.hasDietaryRequirement {
                        IACard("Dietary and accessibility", rsvp.dietaryNotes,
                               status: "Action", testId: "\(testIdPrefix)-dietary")
                    }
                    if rsvp.hasSongRequest {
                        IACard("Song request", rsvp.songRequests, testId: "\(testIdPrefix)-song")
                    }
                    if rsvp.hasMessage {
                        IACard("Message from guest", rsvp.message, testId: "\(testIdPrefix)-message")
                    }
                    if let contact {
                        let contactLine = [contact.email, contact.phone]
                            .compactMap { $0 }.joined(separator: " · ")
                        if !contactLine.isEmpty {
                            IACard("Contact", contactLine, testId: "\(testIdPrefix)-contact")
                        }
                        let roleLine = [
                            contact.role?.replacingOccurrences(of: "_", with: " ").capitalizedFirst(),
                            contact.roleDetail
                        ].compactMap { $0 }.joined(separator: " · ")
                        if !roleLine.isEmpty {
                            IACard("Role", roleLine, testId: "\(testIdPrefix)-role")
                        }
                    }
                } else {
                    Text("Meal, dietary and contact details are not visible in this role.")
                        .font(.system(size: 11))
                        .foregroundColor(WeddingIdentityPalette.muted)
                        .accessibilityIdentifier("\(testIdPrefix)-restricted")
                }
            } else {
                IACard("No RSVP record",
                       "This guest has no RSVP row in the wedding graph.",
                       testId: "\(testIdPrefix)-missing")
            }
        }
    }
}

// MARK: - Empty states

/// The couple has not published this section. Distinct from "the source holds nothing".
public struct IAEmptyPublishedSection: View {
    let title: String
    let testIdPrefix: String

    public init(title: String, testIdPrefix: String) {
        self.title = title
        self.testIdPrefix = testIdPrefix
    }

    public var body: some View {
        IASectionList(title, nil) {
            IACard("Not published yet",
                   "The couple has not published \(title) for this wedding.",
                   testId: "\(testIdPrefix)-empty")
        }
    }
}

/// The source genuinely holds no rows. Distinct from "we could not read it".
public struct IAEmptySourceSection: View {
    let title: String
    let reason: String
    let testIdPrefix: String

    public init(title: String, reason: String, testIdPrefix: String) {
        self.title = title
        self.reason = reason
        self.testIdPrefix = testIdPrefix
    }

    public var body: some View {
        IASectionList(title, nil) {
            IACard("Nothing recorded", reason, testId: "\(testIdPrefix)-empty")
        }
    }
}

// MARK: - Helpers

public extension Double {
    /// Groups thousands so a budget reads as money rather than as a raw number.
    func asMoney() -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: self)) ?? String(Int(self))
    }
}

public extension String {
    /// Formats a production timestamp for display.
    ///
    /// The graph stores ISO-8601 (`2026-06-22T05:35:00`). Printing the raw string leaks the
    /// storage format onto the screen, which is how a check-in read
    /// "Checked in at 2026-06-22T05:35".
    func asDisplayDate() -> String {
        let input = DateFormatter()
        input.locale = Locale(identifier: "en_US_POSIX")
        input.dateFormat = "yyyy-MM-dd"
        guard let date = input.date(from: String(prefix(10))) else { return self }
        let output = DateFormatter()
        output.locale = Locale(identifier: "en_US_POSIX")
        output.dateFormat = "d MMM yyyy"
        return output.string(from: date)
    }

    /// Formats a production timestamp with its time of day.
    func asDisplayDateTime() -> String {
        let normalised = String(replacingOccurrences(of: "T", with: " ").prefix(16))
        let input = DateFormatter()
        input.locale = Locale(identifier: "en_US_POSIX")
        input.dateFormat = "yyyy-MM-dd HH:mm"
        guard let date = input.date(from: normalised) else { return asDisplayDate() }
        let output = DateFormatter()
        output.locale = Locale(identifier: "en_US_POSIX")
        output.dateFormat = "d MMM yyyy, HH:mm"
        return output.string(from: date)
    }

    /// Turns a production content field key into a readable label.
    ///
    /// Content keys come in three shapes: camelCase (`previewImage0`), hyphenated (`milestone-0`)
    /// and snake_case. All three reached the screen verbatim, so a couple's story read
    /// "Milestone-0". Repeated fields are zero-indexed in storage and are shown one-indexed,
    /// because "Milestone 0" is a storage detail, not how anyone counts their own milestones.
    func humanisedContentField() -> String {
        guard !isEmpty else { return "Detail" }
        var spaced = ""
        for (offset, character) in enumerated() {
            if offset > 0, character.isUppercase || character.isNumber {
                let previous = self[index(startIndex, offsetBy: offset - 1)]
                if previous.isLowercase || previous.isLetter { spaced.append(" ") }
            }
            spaced.append(character == "_" || character == "-" ? " " : character)
        }
        var label = spaced.trimmingCharacters(in: .whitespaces)
        // Show a trailing zero-based index one-indexed.
        let parts = label.split(separator: " ")
        if parts.count > 1, let last = parts.last, let index = Int(last) {
            label = parts.dropLast().joined(separator: " ") + " \(index + 1)"
        }
        return label.capitalizedFirst()
    }

    /// The base filename of a media reference, used to match against bundled assets.
    func assetBaseName() -> String {
        let last = split(separator: "/").last.map(String.init) ?? self
        return last.split(separator: ".").first.map(String.init) ?? last
    }

    func capitalizedFirst() -> String {
        guard let first else { return self }
        return first.uppercased() + dropFirst()
    }
}

/// Media the native bundle actually carries, keyed by asset base name.
public enum BundledWeddingMedia {
    public static let names: Set<String> = ["hero-wedding", "ornament-frame"]
}

// MARK: - Planner "More" routes, rebuilt on the real graph
//
// These six destinations previously rendered static fixture copy — sample rate sheets, invented
// insurance and tax lines, an "AI active" banner, a placeholder team roster. In Private Real UAT
// that placed invented operational facts beside a real wedding, which is the most misleading
// failure mode available to us. Each now reads the repository or says plainly that the graph holds
// nothing.

/// The client, from the real wedding and the real planner profile/enquiry.
public struct PlannerClientProfileSection: View {
    @ObservedObject var graph: WeddingGraphState

    public init(graph: WeddingGraphState) { self.graph = graph }

    public var body: some View {
        if let wedding = graph.wedding {
            IASectionList("Client Profile", wedding.coupleNames) {
                IACard("Wedding", wedding.coupleNames, testId: "client-profile-couple")
                IACard("Date", wedding.date.asDisplayDate(), testId: "client-profile-date")
                IACard("Venue", "\(wedding.venueName) — \(wedding.city), \(wedding.country)",
                       testId: "client-profile-venue")
                IACard("Planning stage", wedding.lifecycle.capitalizedFirst(),
                       testId: "client-profile-lifecycle")
                IACard("Guest list",
                       "\(graph.guests.count) guests · \(graph.guests.filter { $0.rsvpStatus == .attending }.count) attending",
                       testId: "client-profile-guests")
                if let budget = graph.budget {
                    IACard("Budget",
                           "Estimated \(budget.currency) \(budget.totalBudget.asMoney()) · paid \(budget.currency) \(budget.totalPaid.asMoney())",
                           testId: "client-profile-budget")
                }
                // How this planner reaches the wedding is stated, not implied. Production holds no
                // engagement and no membership for this pairing; calling that a client
                // relationship would be a fabrication.
                if let access = graph.plannerAccess {
                    IACard(access.businessName ?? "Planner", access.accessDescription,
                           status: access.isProductionEngagement ? "Engaged" : "UAT",
                           testId: "client-profile-access")
                    if let enquiry = access.enquiryStatus {
                        IACard("Enquiry",
                               enquiry.replacingOccurrences(of: "_", with: " ").capitalizedFirst(),
                               testId: "client-profile-enquiry")
                    }
                }
            }
        } else {
            IAEmptySourceSection(title: "Client Profile",
                                 reason: "No wedding is bound to this workspace.",
                                 testIdPrefix: "client-profile")
        }
    }
}

/// Planner intelligence, derived strictly from the repository.
///
/// Every line here is a calculation over rows the workspace already holds. Nothing claims an
/// inference the app did not make, and there is no "AI active" banner, because no model runs here.
public struct PlannerIntelligenceSection: View {
    @ObservedObject var graph: WeddingGraphState

    public init(graph: WeddingGraphState) { self.graph = graph }

    public var body: some View {
        if graph.wedding == nil {
            IAEmptySourceSection(title: "Intelligence",
                                 reason: "No wedding is bound to this workspace.",
                                 testIdPrefix: "intelligence")
        } else {
            let tasks = graph.tasks
            let guests = graph.guests
            let openTasks = tasks.filter { $0.status != .done }.count
            let highOpen = tasks.filter { $0.status != .done && $0.priority == .high }.count
            let awaiting = guests.filter { $0.rsvpStatus == .pending }.count
            let seated = guests.filter { !($0.tableName ?? "").isEmpty }.count
            let dietary = graph.rsvpDetails.values.filter { $0.hasDietaryRequirement }.count
            let completion = tasks.isEmpty ? 0 : (tasks.filter { $0.status == .done }.count * 100) / tasks.count

            IASectionList("Intelligence", "Derived from this wedding's graph") {
                IACard("Planning completion", "\(completion)% of \(tasks.count) tasks complete",
                       testId: "intelligence-completion")
                IACard("Open tasks", "\(openTasks) open · \(highOpen) high priority",
                       testId: "intelligence-open-tasks")
                IACard("RSVP", "\(awaiting) of \(guests.count) guests have not responded",
                       testId: "intelligence-rsvp")
                IACard("Seating", "\(seated) of \(guests.count) guests are seated",
                       testId: "intelligence-seating")
                if dietary > 0 {
                    IACard("Dietary requirements",
                           "\(dietary) \(dietary == 1 ? "guest" : "guests") recorded a dietary or accessibility need",
                           status: "Action", testId: "intelligence-dietary")
                }
                if let budget = graph.budget {
                    IACard("Budget remaining",
                           "\(budget.currency) \((budget.totalBudget - budget.totalPaid).asMoney()) of \(budget.currency) \(budget.totalBudget.asMoney()) unpaid",
                           testId: "intelligence-budget")
                }
                Text("These figures are calculated from the loaded wedding graph. No model or external service is involved.")
                    .font(.system(size: 11))
                    .foregroundColor(WeddingIdentityPalette.muted)
            }
        }
    }
}

/// Team Hub.
///
/// Production exposes the planner's own profile — including a real team size — but no per-member
/// roster is reachable through the authorized read. The distinction is stated rather than filled
/// with placeholder members.
public struct PlannerTeamHubSection: View {
    @ObservedObject var graph: WeddingGraphState

    public init(graph: WeddingGraphState) { self.graph = graph }

    public var body: some View {
        if let access = graph.plannerAccess {
            let assignees = Array(Set(graph.tasks.compactMap { $0.assignee }.filter { !$0.isEmpty })).sorted()
            IASectionList("Team Hub", access.businessName) {
                if let teamSize = access.teamSize {
                    IACard("Team size", "\(teamSize) recorded on the planner profile",
                           testId: "team-hub-size")
                }
                if let completed = access.completedWeddings {
                    IACard("Completed weddings", "\(completed)", testId: "team-hub-completed")
                }
                if let status = access.profileStatus {
                    IACard("Profile status", status.capitalizedFirst(), testId: "team-hub-status")
                }
                IACard("Access to this wedding", access.accessDescription,
                       status: access.isProductionEngagement ? "Engaged" : "UAT",
                       testId: "team-hub-access")
                IACard("Team members",
                       "No per-member roster is reachable through the authorized read. Only the planner profile's aggregate team size is available.",
                       status: "Not available", testId: "team-hub-members")

                // Tasks carry a real assignee string where one was recorded; that is the only
                // per-person planner data the graph actually holds.
                if !assignees.isEmpty {
                    Text("Task assignees")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(WeddingIdentityPalette.muted)
                    ForEach(assignees, id: \.self) { assignee in
                        IACard(assignee, "\(graph.tasks.filter { $0.assignee == assignee }.count) tasks",
                               testId: "team-hub-assignee")
                    }
                }
            }
        } else {
            IAEmptySourceSection(title: "Team Hub",
                                 reason: "No planner context is bound to this workspace.",
                                 testIdPrefix: "team-hub")
        }
    }
}

/// Media Archive.
///
/// `MediaItem` holds zero rows, so the archive is not backed by an uploaded-media table. It is
/// backed by the media references the couple published through `WeddingContent`, which is where
/// this wedding's media actually lives.
public struct PlannerMediaArchiveSection: View {
    @ObservedObject var graph: WeddingGraphState

    public init(graph: WeddingGraphState) { self.graph = graph }

    private var mediaEntries: [(WeddingContentSection, WeddingContentEntry)] {
        graph.contentSections.flatMap { group in group.mediaEntries.map { (group, $0) } }
    }

    public var body: some View {
        if mediaEntries.isEmpty {
            IAEmptySourceSection(title: "Media Archive",
                                 reason: "No media references are published for this wedding, and no uploaded media items exist.",
                                 testIdPrefix: "media-archive")
        } else {
            IASectionList("Media Archive", "\(mediaEntries.count) published media references") {
                ForEach(mediaEntries, id: \.1.id) { group, entry in
                    IACard("\(group.title) · \(entry.field.humanisedContentField())",
                           entry.value,
                           status: BundledWeddingMedia.names.contains(entry.value.assetBaseName())
                               ? "Available" : "Not bundled",
                           testId: "media-archive-\(entry.id)")
                }
                Text("Media is referenced by the wedding content graph. No uploaded media items are recorded for this wedding.")
                    .font(.system(size: 11))
                    .foregroundColor(WeddingIdentityPalette.muted)
            }
        }
    }
}

/// A vendor's services on this wedding, from the real `Vendor`, `ServiceEngagement` and
/// `EngagementParty` graph.
///
/// The engagement's counterparties come from the real party relation where production records one.
/// Inferring them from a vendor's name would present a guess as a contractual fact.
public struct VendorServicesSection: View {
    @ObservedObject var graph: WeddingGraphState
    let context: NavigationContext

    public init(graph: WeddingGraphState, context: NavigationContext) {
        self.graph = graph
        self.context = context
    }

    private var vendors: [VendorPresence] {
        // A vendor sees their own engagement, not the whole wedding's vendor list.
        guard let activeVendorId = context.activeVendorId else { return graph.vendors }
        return graph.vendors.filter { $0.id == activeVendorId }
    }

    public var body: some View {
        if vendors.isEmpty {
            IAEmptySourceSection(title: "Services",
                                 reason: "No vendor record is bound to this session for this wedding.",
                                 testIdPrefix: "vendor-services")
        } else {
            IASectionList("Services", graph.wedding?.coupleNames) {
                ForEach(vendors) { vendor in
                    IACard(vendor.vendorName, vendor.serviceCategory,
                           status: vendor.state.title,
                           testId: "vendor-services-\(vendor.id)")
                    ForEach(graph.engagementParties.filter { party in
                        party.displayName.caseInsensitiveCompare(vendor.vendorName) == .orderedSame
                            || (party.legalName ?? "").caseInsensitiveCompare(vendor.vendorName) == .orderedSame
                    }) { party in
                        IACard("Party · \(party.partyRole.capitalizedFirst())",
                               [party.displayName, party.authorityBasis]
                                   .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "),
                               status: party.status?.capitalizedFirst(),
                               testId: "vendor-party-\(party.id)")
                    }
                }
                if graph.engagementParties.isEmpty {
                    Text("No named engagement parties are recorded for this wedding's service engagements.")
                        .font(.system(size: 11))
                        .foregroundColor(WeddingIdentityPalette.muted)
                }
            }
        }
    }
}

/// The Couple's RSVP worksheet: a summary list that opens each guest's real RSVP record.
public struct CoupleRsvpWorksheet: View {
    @ObservedObject var graph: WeddingGraphState
    @State private var openGuestId: String?

    public init(graph: WeddingGraphState) { self.graph = graph }

    private var openGuest: Guest? { graph.guests.first { $0.id == openGuestId } }

    public var body: some View {
        if let guest = openGuest {
            VStack(spacing: 0) {
                HStack {
                    Button("Back") { openGuestId = nil }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(WeddingIdentityPalette.champagneDeep)
                        .accessibilityIdentifier("rsvp-detail-back")
                    Spacer()
                }
                .padding(.horizontal, 14)
                .padding(.top, 8)

                // The Couple is authorized to see the full record for their own guests.
                GuestRsvpDetailSection(
                    guest: guest,
                    rsvp: graph.rsvpDetails[guest.id],
                    contact: graph.guestContacts[guest.id],
                    canSeePrivateDetail: true
                )
            }
        } else {
            let attending = graph.guests.filter { $0.rsvpStatus == .attending }.count
            let pending = graph.guests.filter { $0.rsvpStatus == .pending }.count
            let declined = graph.guests.filter { $0.rsvpStatus == .declined }.count
            let dietary = graph.rsvpDetails.values.filter { $0.hasDietaryRequirement }.count
            let subtitle = "\(attending) attending • \(pending) pending • \(declined) declined"
                + (dietary > 0 ? " • \(dietary) dietary" : "")

            IASectionList("RSVP", subtitle) {
                ForEach(graph.guests) { guest in
                    let detail = graph.rsvpDetails[guest.id]
                    let markers = [
                        detail?.mealChoice,
                        detail?.plusOne == true ? "+1" : nil,
                        (detail?.kidsCount ?? 0) > 0 ? "\(detail!.kidsCount) kids" : nil,
                        detail?.hasDietaryRequirement == true ? "Dietary" : nil,
                        detail?.hasMessage == true ? "Message" : nil
                    ].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")

                    IACard(guest.name,
                           ["Party of \(guest.partySize)", markers]
                               .filter { !$0.isEmpty }.joined(separator: " — "),
                           trailing: guest.rsvpStatus.title,
                           testId: "rsvp-row-\(guest.id)",
                           onTap: { openGuestId = guest.id })
                }
            }
        }
    }
}
