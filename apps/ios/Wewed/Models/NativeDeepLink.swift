import Foundation

public struct InvitationDeepLink: Hashable, Sendable {
    public let weddingSlug: String
    public let rsvpToken: String

    public init(weddingSlug: String, rsvpToken: String) {
        self.weddingSlug = weddingSlug
        self.rsvpToken = rsvpToken
    }
}

/// Canonical IA V2 §14 workspace link target, e.g. `wewed://wedding/{id}/plan/tasks`.
/// Carries the requested entity/context only; authorization is resolved separately by
/// `DeepLinkRouter` so a link can never be its own permission.
public struct WorkspaceDeepLink: Equatable, Sendable {
    public let weddingId: String?
    public let destinationId: String
    public let section: String?
    public let entityId: String?

    public init(weddingId: String?, destinationId: String, section: String? = nil, entityId: String? = nil) {
        self.weddingId = weddingId
        self.destinationId = destinationId
        self.section = section
        self.entityId = entityId
    }
}

public enum NativeDeepLink: Equatable, Sendable {
    case invitation(InvitationDeepLink)
    /// A Wedding Pass link with the credential that identifies *which* pass — P0-9: it must be
    /// carried through resolution, never discarded and replaced with a default guest.
    case pass(token: String?)
    case wedding(String)
    case workspace(WorkspaceDeepLink)
}

public enum NativeDeepLinkParser {
    public static func parse(_ rawURL: String) -> NativeDeepLink? {
        guard let components = URLComponents(string: rawURL),
              let scheme = components.scheme?.lowercased() else {
            return nil
        }

        var route = components.path
            .split(separator: "/", omittingEmptySubsequences: true)
            .map(String.init)

        if scheme == "https" {
            guard let host = components.host?.lowercased(),
                  host == "wewed.pro" || host == "www.wewed.pro" else {
                return nil
            }
        } else if scheme == "wewed" {
            if let host = components.host, !host.isEmpty {
                route.insert(host, at: 0)
            }
        } else {
            return nil
        }

        guard let first = route.first?.lowercased() else { return nil }

        switch first {
        case "invite":
            guard route.count >= 2 else { return nil }
            let weddingSlug = route[1].trimmingCharacters(in: .whitespacesAndNewlines)
            let rsvpToken = components.queryItems?
                .first(where: { $0.name.lowercased() == "rsvp" })?
                .value?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !weddingSlug.isEmpty, !rsvpToken.isEmpty else { return nil }
            return .invitation(
                InvitationDeepLink(
                    weddingSlug: weddingSlug,
                    rsvpToken: rsvpToken
                )
            )

        case "pass":
            let token = route.count >= 2
                ? route[1].trimmingCharacters(in: .whitespacesAndNewlines)
                : ""
            return .pass(token: token.isEmpty ? nil : token)

        // IA V2 §14 canonical workspace routes. Parsing only — never authorization.
        case "wedding":
            guard route.count >= 3 else { return nil }
            let weddingId = route[1].trimmingCharacters(in: .whitespacesAndNewlines)
            let requested = route[2].trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !weddingId.isEmpty, !requested.isEmpty else { return nil }
            if requested == "invitation" {
                guard route.count >= 4 else { return nil }
                let token = route[3].trimmingCharacters(in: .whitespacesAndNewlines)
                guard !token.isEmpty else { return nil }
                return .invitation(InvitationDeepLink(weddingSlug: weddingId, rsvpToken: token))
            }
            return .workspace(
                WorkspaceDeepLink(
                    weddingId: weddingId,
                    destinationId: requested == "day" ? "wedding_day" : requested,
                    section: route.count >= 4 ? route[3] : nil
                )
            )

        case "planner":
            guard route.count >= 2 else { return nil }
            let requested = route[1].lowercased()
            guard !requested.isEmpty else { return nil }
            return .workspace(
                WorkspaceDeepLink(
                    weddingId: route.count >= 3 ? route[2] : nil,
                    destinationId: requested
                )
            )

        case "vendor":
            guard route.count >= 2 else { return nil }
            let requested = route[1].lowercased()
            guard !requested.isEmpty else { return nil }
            return .workspace(
                WorkspaceDeepLink(
                    weddingId: nil,
                    destinationId: requested,
                    entityId: route.count >= 3 ? route[2] : nil
                )
            )

        case "gate":
            guard route.count >= 2 else { return nil }
            let gateId = route[1].trimmingCharacters(in: .whitespacesAndNewlines)
            guard !gateId.isEmpty else { return nil }
            let requested = route.count >= 3 ? route[2].lowercased() : "scan"
            return .workspace(
                WorkspaceDeepLink(weddingId: nil, destinationId: requested, entityId: gateId)
            )

        case "admin":
            guard route.count >= 2 else { return nil }
            let requested = route[1].lowercased()
            guard !requested.isEmpty else { return nil }
            return .workspace(
                WorkspaceDeepLink(
                    weddingId: nil,
                    destinationId: requested,
                    entityId: route.count >= 3 ? route[2] : nil
                )
            )

        case "w":
            guard route.count >= 2 else { return nil }
            let weddingSlug = route[1].trimmingCharacters(in: .whitespacesAndNewlines)
            return weddingSlug.isEmpty ? nil : .wedding(weddingSlug)

        default:
            return nil
        }
    }
}
