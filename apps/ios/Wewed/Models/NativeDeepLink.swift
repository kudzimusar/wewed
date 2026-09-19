import Foundation

public struct InvitationDeepLink: Hashable, Sendable {
    public let weddingSlug: String
    public let rsvpToken: String

    public init(weddingSlug: String, rsvpToken: String) {
        self.weddingSlug = weddingSlug
        self.rsvpToken = rsvpToken
    }
}

public enum NativeDeepLink: Equatable, Sendable {
    case invitation(InvitationDeepLink)
    case pass
    case wedding(String)
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

        if scheme == "https" || scheme == "http" {
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
            return .pass

        case "w":
            guard route.count >= 2 else { return nil }
            let weddingSlug = route[1].trimmingCharacters(in: .whitespacesAndNewlines)
            return weddingSlug.isEmpty ? nil : .wedding(weddingSlug)

        default:
            return nil
        }
    }
}
