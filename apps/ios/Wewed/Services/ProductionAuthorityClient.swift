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
}
