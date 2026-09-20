import Foundation

/// A launch that looked like an invitation and is not honoured.
///
/// Rejection is a real outcome, not an absence. It must fail closed: it never falls back to
/// whichever guest happened to be active.
public enum InvitationRejection: String, Equatable, Sendable {
    /// A resume URL carrying a raw `rsvp` credential — the server refuses to build these.
    case resumeCarriedRawCredential
    /// The handoff is not the shape the server issues, so it cannot be genuine.
    case malformedHandoff
    /// An `/invite/<slug>` link with no credential identifies no one.
    case missingCredential
}

/// How a private invitation reaches the app.
///
/// There are three legitimate launch shapes and one illegitimate one, and the difference matters
/// because two of them carry a secret:
///
/// ```
/// /invite/<slug>?rsvp=<private token>   the link a guest is actually sent
/// /invite/resume?h=<opaque handoff>     after a deferred install, or the Android bridge intent
/// wewed://invite/resume + wewed_handoff the package-targeted bridge extra
/// ```
///
/// The protocol is the one already running in production; the shapes are pinned in
/// `mobile/contracts/invitation-protocol.json`, generated from `origin/main`. Native speaks that
/// protocol or refuses — it never invents a second one.
public enum InvitationEntry: Equatable, Sendable {
    /// The guest's own private link. The token is a credential for *entry and exchange only*: it
    /// is never stored as client identity, never logged, and never travels onward in a URL.
    case privateInvitation(weddingSlug: String, rsvpToken: String)
    /// A one-time opaque handoff. It identifies a pending invitation on the server and nothing
    /// here, which is precisely why it is the value allowed to survive an install.
    case handoff(secret: String)
    case rejected(InvitationRejection)

    /// Redacted: an invitation credential must not reach a log line through string interpolation.
    public var redactedDescription: String {
        switch self {
        case let .privateInvitation(slug, _): return "privateInvitation(weddingSlug: \(slug), rsvpToken: ***)"
        case .handoff: return "handoff(secret: ***)"
        case let .rejected(reason): return "rejected(\(reason.rawValue))"
        }
    }
}

/// Parses launch inputs into an ``InvitationEntry``.
///
/// Deliberately pure and platform-free: the Universal Link, the custom scheme and any future
/// launch source funnel through here, so there is one place where the protocol's refusals are
/// implemented and one place to test them.
public enum InvitationEntryParser {

    /// 43 base64url characters — 32 random bytes, per `INVITATION_HANDOFF_PATTERN`.
    private static let handoffLength = 43
    private static let handoffAllowed = CharacterSet(
        charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"
    )

    public static let playReferrerKey = "handoff"

    public static func isValidHandoff(_ secret: String?) -> Bool {
        guard let secret, secret.count == handoffLength else { return false }
        return secret.unicodeScalars.allSatisfy { handoffAllowed.contains($0) }
    }

    /// Parses a launch URL. Returns nil when the URL is not invitation entry at all, which is
    /// different from `.rejected` — an ordinary `wewed://pass` link is simply not our business,
    /// whereas a malformed invitation must fail closed.
    public static func entry(from rawUrl: String?) -> InvitationEntry? {
        guard let rawUrl, !rawUrl.trimmingCharacters(in: .whitespaces).isEmpty,
              let components = URLComponents(string: rawUrl.trimmingCharacters(in: .whitespaces)),
              let scheme = components.scheme?.lowercased()
        else { return nil }

        var segments = components.path.split(separator: "/").map(String.init)

        switch scheme {
        case "https":
            let host = components.host?.lowercased()
            guard host == "wewed.pro" || host == "www.wewed.pro" else { return nil }
        case "wewed":
            if let host = components.host, !host.isEmpty { segments.insert(host, at: 0) }
        default:
            return nil
        }

        guard segments.first?.lowercased() == "invite" else { return nil }
        let items = components.queryItems ?? []
        func parameter(_ name: String) -> String? {
            items.first { $0.name == name }?.value
        }

        // Resume: opaque only. `buildAndroidInvitationIntentUrl` refuses to emit a resume URL
        // containing `rsvp`, so one arriving here did not come from Wewed.
        if segments.count > 1, segments[1].lowercased() == "resume" {
            if parameter("rsvp") != nil { return .rejected(.resumeCarriedRawCredential) }
            let handoff = parameter("h")?.trimmingCharacters(in: .whitespaces)
            return isValidHandoff(handoff) ? .handoff(secret: handoff!) : .rejected(.malformedHandoff)
        }

        guard segments.count > 1 else { return nil }
        let slug = segments[1].trimmingCharacters(in: .whitespaces)
        guard !slug.isEmpty else { return nil }
        let token = parameter("rsvp")?.trimmingCharacters(in: .whitespaces) ?? ""
        guard !token.isEmpty else { return .rejected(.missingCredential) }
        // The `card` parameter is deliberately ignored. The wedding's saved design is
        // authoritative; a long-lived or forwarded link must not select the stationery.
        return .privateInvitation(weddingSlug: slug, rsvpToken: token)
    }

    /// Whether a launch is explicit invitation intent.
    ///
    /// A fresh link outranks any stale deferred-install record: the record says how the app was
    /// obtained, possibly long ago, while a tapped link is what the guest wants now.
    public static func isExplicitInvitationLaunch(_ rawUrl: String?) -> Bool {
        entry(from: rawUrl) != nil
    }
}
