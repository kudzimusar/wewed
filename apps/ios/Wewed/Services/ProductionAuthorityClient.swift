import Foundation

/// Native account identity + production authority client — master plan Phase 5.
///
/// Talks to exactly the two Phase-5 server endpoints:
///  - `POST /api/native/account/signin` — verifies email/password against Supabase, returns an
///    opaque identity session. It proves identity only; it grants no role or wedding.
///  - `GET /api/native/account/authority` — `Authorization: Bearer <session>`, returns
///    `WewedProductionAuthorityV1` as-is. Every call re-resolves the account's real grants; nothing
///    from a prior call is trusted.
///
/// Injectable `URLSession`, mirroring `WeddingDaySyncService`'s pattern, so it can be exercised
/// against a fake session in tests without a network.

public struct ProductionWeddingSummary: Decodable, Equatable, Sendable {
    public let id: String
    public let slug: String
    public let title: String
    public let date: String
    public let venue: String
    public let venueCity: String
    public let venueCountry: String
    public let lifecycle: String
    public let coupleNames: String
}

public struct ProductionEngagementSummary: Decodable, Equatable, Sendable {
    public let id: String
    public let serviceCategory: String
    public let serviceDescription: String?
    public let lifecycleStatus: String
}

public struct ProductionWorkspaceSnapshot: Decodable, Equatable, Sendable {
    public let grantId: String
    public let workspaceKind: String
    public let scopeKind: String
    public let weddingId: String?
    public let weddingTitle: String?
    public let businessAccountId: String?
    public let businessName: String?
    public let vendorId: String?
    public let serviceEngagementIds: [String]
    /// Resolved automatically for a single-engagement grant, or once explicitly selected.
    public let engagement: ProductionEngagementSummary?
    /// True only when the grant has more than one engagement and none has been validly selected.
    public let engagementSelectionRequired: Bool
    public let engagementOptions: [ProductionEngagementSummary]
    public let permissions: [String]
    public let platformRoles: [String]
    public let wedding: ProductionWeddingSummary?

    private enum CodingKeys: String, CodingKey {
        case grantId, workspaceKind, scopeKind, weddingId, weddingTitle, businessAccountId, businessName
        case vendorId, serviceEngagementIds, engagement, engagementSelectionRequired, engagementOptions
        case permissions, platformRoles, wedding
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        grantId = try c.decode(String.self, forKey: .grantId)
        workspaceKind = try c.decode(String.self, forKey: .workspaceKind)
        scopeKind = try c.decode(String.self, forKey: .scopeKind)
        weddingId = try c.decodeIfPresent(String.self, forKey: .weddingId)
        weddingTitle = try c.decodeIfPresent(String.self, forKey: .weddingTitle)
        businessAccountId = try c.decodeIfPresent(String.self, forKey: .businessAccountId)
        businessName = try c.decodeIfPresent(String.self, forKey: .businessName)
        vendorId = try c.decodeIfPresent(String.self, forKey: .vendorId)
        serviceEngagementIds = try c.decode([String].self, forKey: .serviceEngagementIds)
        // Absent in a fixture/older server response means "no engagement context at all" — the same
        // safe default a Vendor-less grant already has, never treated as "selection required".
        engagement = try c.decodeIfPresent(ProductionEngagementSummary.self, forKey: .engagement)
        engagementSelectionRequired = try c.decodeIfPresent(Bool.self, forKey: .engagementSelectionRequired) ?? false
        engagementOptions = try c.decodeIfPresent([ProductionEngagementSummary].self, forKey: .engagementOptions) ?? []
        permissions = try c.decode([String].self, forKey: .permissions)
        platformRoles = try c.decode([String].self, forKey: .platformRoles)
        wedding = try c.decodeIfPresent(ProductionWeddingSummary.self, forKey: .wedding)
    }
}

public enum ProductionWorkspaceFetch: Equatable {
    case success(ProductionWorkspaceSnapshot)
    case sessionInvalid
    case grantRevoked
    /// The selected engagement is no longer part of this (still-valid) grant.
    case engagementInvalid
    case transport(status: Int)
}

public enum NativeAccountSignInOutcome: Equatable {
    case success(sessionToken: String)
    case invalidCredentials
    case transport(status: Int)
}

public enum ProductionAuthorityFetch: Equatable {
    case success(ProductionAuthority)
    /// The stored identity session itself is no longer valid; the caller must clear it.
    case sessionInvalid
    case transport(status: Int)
}

public struct ProductionAuthorityClient: Sendable {
    private let baseURL: URL
    private let session: URLSession

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    public func signIn(email: String, password: String) async -> NativeAccountSignInOutcome {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/native/account/signin"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["email": email, "password": password])

        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse
        else {
            return .transport(status: -1)
        }

        if http.statusCode == 400 || http.statusCode == 401 { return .invalidCredentials }
        guard (200...299).contains(http.statusCode) else { return .transport(status: http.statusCode) }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let token = json["sessionToken"] as? String,
              !token.isEmpty
        else {
            return .transport(status: http.statusCode)
        }

        return .success(sessionToken: token)
    }

    public func fetchAuthority(sessionToken: String) async -> ProductionAuthorityFetch {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/native/account/authority"))
        request.httpMethod = "GET"
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")

        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse
        else {
            return .transport(status: -1)
        }

        if http.statusCode == 401 { return .sessionInvalid }
        guard (200...299).contains(http.statusCode) else { return .transport(status: http.statusCode) }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let authorityDict = json["authority"] as? [String: Any],
              let authorityData = try? JSONSerialization.data(withJSONObject: authorityDict),
              let authority = ProductionAuthority.decode(authorityData)
        else {
            return .transport(status: http.statusCode)
        }

        return .success(authority)
    }
    public func fetchWorkspace(sessionToken: String, grantId: String, engagementId: String? = nil) async -> ProductionWorkspaceFetch {
        guard var components = URLComponents(
            url: baseURL.appendingPathComponent("api/native/account/workspace"),
            resolvingAgainstBaseURL: false
        ) else {
            return .transport(status: -1)
        }
        var queryItems = [URLQueryItem(name: "grantId", value: grantId)]
        if let engagementId { queryItems.append(URLQueryItem(name: "engagementId", value: engagementId)) }
        components.queryItems = queryItems
        guard let url = components.url else { return .transport(status: -1) }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")

        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse
        else {
            return .transport(status: -1)
        }

        if http.statusCode == 401 { return .sessionInvalid }
        if http.statusCode == 403 || http.statusCode == 404 { return .grantRevoked }
        if http.statusCode == 422 { return .engagementInvalid }
        guard (200...299).contains(http.statusCode) else { return .transport(status: http.statusCode) }

        struct Envelope: Decodable { let workspace: ProductionWorkspaceSnapshot }
        guard let envelope = try? JSONDecoder().decode(Envelope.self, from: data) else {
            return .transport(status: http.statusCode)
        }
        return .success(envelope.workspace)
    }
}
