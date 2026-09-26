import Foundation

/// A Vercel "Protection Bypass for Automation" secret for a protected Preview deployment.
///
/// DEBUG qualification only. Supplied from the launch environment, never compiled in, and never
/// printed: every textual representation is redacted so it cannot reach logs, test output or a
/// crash report through string interpolation.
public struct NativePreviewProtectionBypass: Equatable, Sendable, CustomStringConvertible, CustomDebugStringConvertible {
    public static let headerName = "x-vercel-protection-bypass"
    let secret: String

    public init?(_ raw: String?) {
        guard let value = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        secret = value
    }

    public var description: String { "<redacted>" }
    public var debugDescription: String { "<redacted>" }
}

/// Which Wewed server the real production clients talk to.
///
/// The data environment is `.production` in both lanes: the same `ProductionAuthorityClient`,
/// `NativeDomainApiClient`, `GuestSessionClient` and Wedding Day transports, with the same
/// server-issued authority and no Shadow, fixture or persona path. Only the origin differs.
///
/// A Release binary can only ever be `.production` (https://wewed.pro); `.productionPreview` is
/// reachable solely from a DEBUG build whose launch configuration names an allowlisted origin.
public enum NativeServerLane: Equatable, Sendable {
    case production
    case productionPreview(origin: URL, protectionBypass: NativePreviewProtectionBypass?)

    public var origin: URL {
        switch self {
        case .production: return NativeServerOrigin.production
        case let .productionPreview(origin, _): return origin
        }
    }

    public var isPreview: Bool {
        if case .productionPreview = self { return true }
        return false
    }

    /// Credentials issued by one origin are never presented to another: a Preview lane keeps its
    /// account and Guest sessions in their own Keychain services.
    public func keychainService(_ base: String) -> String {
        isPreview ? "\(base).production-preview" : base
    }

    /// The URLSession configuration every real client in this lane uses. In `.production` it is
    /// the unmodified input. In `.productionPreview` the Vercel protection-bypass header is added
    /// when configured; requests only ever go to this lane's single origin.
    public func sessionConfiguration(_ base: URLSessionConfiguration = .default) -> URLSessionConfiguration {
        guard case let .productionPreview(_, bypass?) = self else { return base }
        var headers = base.httpAdditionalHeaders ?? [:]
        headers[NativePreviewProtectionBypass.headerName] = bypass.secret
        base.httpAdditionalHeaders = headers
        return base
    }

    public func makeURLSession(_ base: URLSessionConfiguration = .default) -> URLSession {
        if case .production = self { return URLSession(configuration: base) }
        return URLSession(configuration: sessionConfiguration(base))
    }
}

public enum NativePreviewOriginRejection: Error, Equatable, Sendable {
    case missing
    case malformed
    case insecureScheme
    case productionHost
    case hostNotAllowlisted(String)
    case unexpectedComponents
}

public enum NativeServerOrigin {
    /// The only origin a Release build can reach.
    public static let production = URL(string: "https://wewed.pro")!
    public static let productionHosts: Set<String> = ["wewed.pro", "www.wewed.pro"]

    /// Compiled Preview allowlist: deployments of the `wewed` Vercel project in the `11-11` team
    /// (`wewed-<deployment-or-branch>-11-11.vercel.app`). Anything else — another project, another
    /// team, a look-alike suffix — is refused.
    static func isApprovedPreviewHost(_ host: String) -> Bool {
        let pattern = #"^wewed-[a-z0-9]([a-z0-9-]*[a-z0-9])?-11-11\.vercel\.app$"#
        return host.range(of: pattern, options: .regularExpression) != nil
    }

    /// Loopback only, for a locally run integration backend.
    static func isLocalTestHost(_ host: String) -> Bool {
        host == "127.0.0.1" || host == "localhost"
    }

    /// Validates a DEBUG qualification Preview origin. Accepts an https allowlisted Preview host,
    /// or http(s) loopback; rejects everything else, including the production host (Production has
    /// its own lane) and any path, query, fragment or embedded credentials.
    public static func validatePreviewOrigin(_ raw: String?) -> Result<URL, NativePreviewOriginRejection> {
        guard let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return .failure(.missing)
        }
        guard let components = URLComponents(string: trimmed),
              let scheme = components.scheme?.lowercased(),
              let host = components.host?.lowercased(), !host.isEmpty
        else { return .failure(.malformed) }
        if components.user != nil || components.password != nil || components.query != nil
            || components.fragment != nil || !(components.path.isEmpty || components.path == "/") {
            return .failure(.unexpectedComponents)
        }
        if productionHosts.contains(host) || host == "api.wewed.pro" { return .failure(.productionHost) }

        if isLocalTestHost(host) {
            guard scheme == "http" || scheme == "https" else { return .failure(.insecureScheme) }
        } else {
            guard scheme == "https" else { return .failure(.insecureScheme) }
            guard components.port == nil, isApprovedPreviewHost(host) else {
                return .failure(.hostNotAllowlisted(host))
            }
        }
        var origin = URLComponents()
        origin.scheme = scheme
        origin.host = host
        origin.port = components.port
        guard let url = origin.url else { return .failure(.malformed) }
        return .success(url)
    }

    private static let lock = NSLock()
    nonisolated(unsafe) private static var activeLane: NativeServerLane = .production

    /// The lane chosen at launch. Set once, before any client is built.
    public static var active: NativeServerLane {
        lock.lock(); defer { lock.unlock() }
        return activeLane
    }

    public static func activate(_ lane: NativeServerLane) {
        lock.lock(); defer { lock.unlock() }
        activeLane = lane
        activeSession = nil
    }

    nonisolated(unsafe) private static var activeSession: URLSession?

    /// The URLSession every real client uses by default. Production is exactly `URLSession.shared`
    /// (unchanged Release behavior); a Preview lane gets one session carrying its bypass header.
    public static var urlSession: URLSession {
        lock.lock(); defer { lock.unlock() }
        guard activeLane.isPreview else { return .shared }
        if let activeSession { return activeSession }
        let created = activeLane.makeURLSession()
        activeSession = created
        return created
    }

    /// Hosts whose wedding/invitation URLs identify a Wewed destination for this process: the
    /// production hosts, plus the one validated Preview host when the Preview lane is active.
    public static func isWeddingHost(_ host: String?) -> Bool {
        guard let host = host?.lowercased() else { return false }
        if productionHosts.contains(host) { return true }
        if case let .productionPreview(origin, _) = active { return origin.host?.lowercased() == host }
        return false
    }
}
