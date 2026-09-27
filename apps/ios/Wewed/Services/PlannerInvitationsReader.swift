import Foundation

/// QRO05-PIQR01 — Planner → More → Invitations & QR, read-only.
///
/// Mirrors the canonical `loadPlannerInvitationProjection` / `loadPhysicalInvitationProjection`
/// server projections (the same functions the desktop Planner reads), fetched through the native
/// Bearer + `grantId` routes. Nothing here issues, rotates or backfills a link, and nothing creates a
/// printed-invitation destination.
///
/// Each Guest's `invitationUrl` / `shareMessage` carries that Guest's private RSVP credential. These
/// values are held only by the Invitations & QR screen while it is on screen — never stored in
/// `WeddingGraphState`, never logged, and never rendered as text. `debugDescription` redacts them so an
/// accidental `print`/`dump` cannot leak one.

public enum PlannerInvitationRsvpStatus: String, Equatable, Sendable {
    case attending
    case declined
    case pending

    public var label: String {
        switch self {
        case .attending: return "Attending"
        case .declined: return "Declined"
        case .pending: return "Awaiting reply"
        }
    }
}

public struct PlannerInvitationDesign: Equatable, Sendable {
    public let weddingTitle: String
    public let styleId: String
    public let message: String?
    public let rsvpDeadline: String?
    public let childrenPolicy: String

    /// The human name of the saved card style — the same names the web Invitation Studio shows.
    public var styleLabel: String { PlannerInvitationDesign.styleName(for: styleId) }

    public var childrenPolicyLabel: String {
        childrenPolicy == "adults_only" ? "Adults only" : "Children welcome"
    }

    /// Mirror of `INVITATION_CARD_STYLES` in `src/lib/digital-invitation-card.ts`. The server has
    /// already normalized the id; an id this build does not know is title-cased rather than guessed.
    static let styleNames: [String: String] = [
        "ivory-floral-gold": "Ivory Floral Gold",
        "midnight": "Midnight Gold",
        "botanical": "Garden Romance",
        "royal-emerald": "Royal Emerald",
        "classic-white": "Classic White",
        "blush-romance": "Blush Romance",
        "african-luxe": "African Luxe",
        "editorial": "Modern Editorial",
        "black-tie": "Black Tie",
        "watercolour-garden": "Watercolour Garden",
        "sunset-terracotta": "Sunset Terracotta",
        "celestial": "Celestial",
    ]

    public static func styleName(for id: String) -> String {
        if let known = styleNames[id] { return known }
        return id.split(separator: "-").map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined(separator: " ")
    }
}

public struct PlannerGuestInvitation: Identifiable, Equatable, Sendable, CustomStringConvertible, CustomDebugStringConvertible {
    public let id: String
    public let name: String
    public let status: PlannerInvitationRsvpStatus
    public let tableNumber: Int?
    public let checkedIn: Bool
    /// Credential-bearing. Encode into a QR or hand to the share sheet; never render as text.
    public let qrValue: String?
    /// Credential-bearing (contains the link). Share-sheet only.
    public let shareMessage: String?

    /// False when the Guest has no RSVP link yet. This read never issues one.
    public var hasInvitationLink: Bool { qrValue != nil }

    public var tableLabel: String { tableNumber.map { "Table \($0)" } ?? "No table" }

    public var description: String { "PlannerGuestInvitation(id: \(id), status: \(status.rawValue), link: \(hasInvitationLink ? "<redacted>" : "none"))" }
    public var debugDescription: String { description }
}

public struct PlannerPhysicalInvitation: Equatable, Sendable, CustomStringConvertible, CustomDebugStringConvertible {
    public let configured: Bool
    /// The shared fallback code printed on every card (e.g. `ABCD-EFGH-23`), as desktop shows it.
    public let code: String?
    /// The shared printed-invitation entry link. QR / share only.
    public let accessUrl: String?
    public let scanCount: Int
    public let invitedCount: Int

    public var description: String { "PlannerPhysicalInvitation(configured: \(configured), scans: \(scanCount), invited: \(invitedCount))" }
    public var debugDescription: String { description }
}

public struct PlannerInvitationsSnapshot: Equatable, Sendable {
    public let design: PlannerInvitationDesign
    public let guests: [PlannerGuestInvitation]
    public let missingLinks: Int
    public let physical: PlannerPhysicalInvitation
}

public enum PlannerInvitationsLoad: Equatable, Sendable {
    case loaded(PlannerInvitationsSnapshot)
    /// Session ended, grant revoked, permission refused, or an unreadable / failed transport.
    case unavailable(String)
}

public enum PlannerInvitationsMapping {
    public static func design(from json: NativeJSONObject) -> PlannerInvitationDesign? {
        guard json.wwBool("success") == true, let wedding = json.wwObject("wedding") else { return nil }
        guard let style = wedding.wwString("invitationCardStyle"), !style.isEmpty else { return nil }
        let message = wedding.wwString("invitationCardMessage")?.trimmingCharacters(in: .whitespacesAndNewlines)
        return PlannerInvitationDesign(
            weddingTitle: wedding.wwRequiredString("title"),
            styleId: style,
            message: (message?.isEmpty ?? true) ? nil : message,
            rsvpDeadline: wedding.wwString("rsvpDeadline"),
            childrenPolicy: wedding.wwString("childrenPolicy") ?? "welcome"
        )
    }

    public static func guests(from json: NativeJSONObject) -> [PlannerGuestInvitation]? {
        guard let rows = json.wwArray("data") else { return nil }
        return rows.compactMap { row in
            guard let id = row.wwString("id"), !id.isEmpty else { return nil }
            let link = row.wwString("qrValue") ?? row.wwString("invitationUrl")
            return PlannerGuestInvitation(
                id: id,
                name: row.wwRequiredString("name"),
                status: PlannerInvitationRsvpStatus(rawValue: row.wwString("status") ?? "") ?? .pending,
                tableNumber: row.wwInt("tableNumber"),
                checkedIn: row.wwBool("checkedIn") ?? false,
                qrValue: (link?.isEmpty ?? true) ? nil : link,
                shareMessage: link == nil ? nil : row.wwString("shareMessage")
            )
        }
    }

    public static func physical(from json: NativeJSONObject) -> PlannerPhysicalInvitation? {
        guard json.wwBool("success") == true, let configured = json.wwBool("configured") else { return nil }
        let accessUrl = json.wwString("accessUrl")
        return PlannerPhysicalInvitation(
            configured: configured && accessUrl != nil,
            code: json.wwString("code"),
            accessUrl: configured ? accessUrl : nil,
            scanCount: json.wwInt("scanCount") ?? 0,
            invitedCount: json.wwInt("invitedCount") ?? 0
        )
    }

    public static func snapshot(invitations: NativeJSONObject, physical: NativeJSONObject) -> PlannerInvitationsSnapshot? {
        guard let design = design(from: invitations),
              let guests = guests(from: invitations),
              let physical = self.physical(from: physical)
        else { return nil }
        return PlannerInvitationsSnapshot(
            design: design,
            guests: guests,
            missingLinks: invitations.wwInt("missingTokens") ?? guests.filter { !$0.hasInvitationLink }.count,
            physical: physical
        )
    }

    static func reason<T>(_ fetch: NativeDomainFetch<T>) -> String? {
        switch fetch {
        case .success: return nil
        case .sessionInvalid: return "Your session has ended. Sign in again to view invitations."
        case .grantRevoked: return "Your access to this wedding has changed."
        case .forbidden: return "Your role on this wedding cannot view invitations."
        case .transport: return "Invitations could not be loaded. Check your connection and try again."
        }
    }
}
