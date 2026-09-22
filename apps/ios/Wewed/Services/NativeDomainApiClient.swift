import Foundation

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8.
///
/// Talks to the native-safe mature-domain endpoints under `/api/native/wedding`, `/api/native/vendor`
/// and `/api/native/admin` (server: `backend/native-workspace-parity-phase8-20260922`). Every call
/// re-validates the caller's fresh production-authority grant server-side; this client passes only
/// `grantId` (a selection hint, exactly like `ProductionAuthorityClient.fetchWorkspace`) and never a
/// weddingId/businessAccountId directly.
///
/// Android reuses its own injectable `WeddingDayHttpTransport` seam for this client. iOS has no
/// equivalent standalone transport protocol: `ProductionAuthorityClient` and `WeddingDaySyncService`
/// both already get their testability by injecting `URLSession` directly (stubbed with a
/// `URLProtocol` in tests — see `SessionStoreAccountAuthorityTests`). This client follows that exact,
/// already-established pattern rather than inventing a new transport abstraction; `URLSession`
/// natively supports PATCH via `httpMethod`, so there is no analogue to Android's defaulted
/// `WeddingDayHttpTransport.patch()` fallback to add here.
public enum NativeDomainFetch<T> {
    case success(T)
    case sessionInvalid
    case grantRevoked
    case forbidden
    case transport(status: Int)
}

/// JSON envelope shapes, mirroring Android's `JSONObject`/`JSONArray` ergonomics: a missing or null
/// field degrades to `nil` rather than throwing, which is what lets every mapping function below stay
/// honest about partially-populated server rows.
public typealias NativeJSONObject = [String: Any]
public typealias NativeJSONArray = [NativeJSONObject]

extension Dictionary where Key == String, Value == Any {
    func wwString(_ key: String) -> String? {
        self[key] as? String
    }

    func wwRequiredString(_ key: String) -> String {
        (self[key] as? String) ?? ""
    }

    func wwInt(_ key: String) -> Int? {
        if let value = self[key] as? Int { return value }
        if let value = self[key] as? NSNumber { return value.intValue }
        return nil
    }

    func wwDouble(_ key: String) -> Double? {
        if let value = self[key] as? Double { return value }
        if let value = self[key] as? NSNumber { return value.doubleValue }
        return nil
    }

    func wwBool(_ key: String) -> Bool? {
        if let value = self[key] as? Bool { return value }
        return nil
    }

    func wwObject(_ key: String) -> NativeJSONObject? {
        self[key] as? NativeJSONObject
    }

    func wwArray(_ key: String) -> NativeJSONArray? {
        self[key] as? NativeJSONArray
    }
}

public struct NativeDomainApiClient: Sendable {
    private let baseURL: URL
    private let session: URLSession
    private let onSessionInvalid: @Sendable () -> Void
    private let onGrantRevoked: @Sendable (String) -> Void

    public init(
        baseURL: URL,
        session: URLSession = .shared,
        onSessionInvalid: @escaping @Sendable () -> Void = {},
        onGrantRevoked: @escaping @Sendable (String) -> Void = { _ in }
    ) {
        self.baseURL = baseURL
        self.session = session
        self.onSessionInvalid = onSessionInvalid
        self.onGrantRevoked = onGrantRevoked
    }

    private func statusToFetch<T>(_ status: Int, data: Data, grantId: String) -> NativeDomainFetch<T>? {
        let envelope = (try? JSONSerialization.jsonObject(with: data)) as? NativeJSONObject
        let code = envelope?.wwString("code") ?? ""
        let result: NativeDomainFetch<T>?
        if status == 401 {
            result = .sessionInvalid
        } else if status == 403 && (code == "GRANT_REVOKED" || code == "AUTHORITY_UNAVAILABLE") {
            result = .grantRevoked
        } else if status == 403 {
            result = .forbidden
        } else if status == 404 {
            result = .transport(status: status)
        } else if !(200...299).contains(status) {
            result = .transport(status: status)
        } else {
            result = nil
        }

        switch result {
        case .sessionInvalid:
            onSessionInvalid()
        case .grantRevoked:
            onGrantRevoked(grantId)
        default:
            break
        }
        return result
    }

    private func buildURL(path: String, grantId: String, extraQueryItems: [URLQueryItem] = []) -> URL? {
        guard var components = URLComponents(
            url: baseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        ) else {
            return nil
        }
        components.queryItems = [URLQueryItem(name: "grantId", value: grantId)] + extraQueryItems
        return components.url
    }

    private func get(
        path: String,
        sessionToken: String,
        grantId: String,
        extraQueryItems: [URLQueryItem] = []
    ) async -> (status: Int, data: Data) {
        guard let url = buildURL(path: path, grantId: grantId, extraQueryItems: extraQueryItems) else {
            return (-1, Data())
        }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse
        else {
            return (-1, Data())
        }
        return (http.statusCode, data)
    }

    private func send(
        method: String,
        path: String,
        sessionToken: String,
        grantId: String,
        body: Data
    ) async -> (status: Int, data: Data) {
        guard let url = buildURL(path: path, grantId: grantId) else {
            return (-1, Data())
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(sessionToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        guard let (data, response) = try? await session.data(for: request),
              let http = response as? HTTPURLResponse
        else {
            return (-1, Data())
        }
        return (http.statusCode, data)
    }

    private func runGetObject(
        _ path: String,
        sessionToken: String,
        grantId: String,
        extraQueryItems: [URLQueryItem] = []
    ) async -> NativeDomainFetch<NativeJSONObject> {
        let (status, data) = await get(path: path, sessionToken: sessionToken, grantId: grantId, extraQueryItems: extraQueryItems)
        if let fetch: NativeDomainFetch<NativeJSONObject> = statusToFetch(status, data: data, grantId: grantId) { return fetch }
        guard let json = (try? JSONSerialization.jsonObject(with: data)) as? NativeJSONObject else {
            return .transport(status: status)
        }
        return .success(json)
    }

    private func runGetArray(
        _ path: String,
        sessionToken: String,
        grantId: String,
        arrayField: String,
        extraQueryItems: [URLQueryItem] = []
    ) async -> NativeDomainFetch<NativeJSONArray> {
        let (status, data) = await get(path: path, sessionToken: sessionToken, grantId: grantId, extraQueryItems: extraQueryItems)
        if let fetch: NativeDomainFetch<NativeJSONArray> = statusToFetch(status, data: data, grantId: grantId) { return fetch }
        guard let json = (try? JSONSerialization.jsonObject(with: data)) as? NativeJSONObject,
              let array = json.wwArray(arrayField)
        else {
            return .transport(status: status)
        }
        return .success(array)
    }

    private func runPostObject(
        _ path: String,
        sessionToken: String,
        grantId: String,
        body: NativeJSONObject,
        resultField: String
    ) async -> NativeDomainFetch<NativeJSONObject> {
        guard let bodyData = try? JSONSerialization.data(withJSONObject: body) else {
            return .transport(status: -1)
        }
        let (status, data) = await send(method: "POST", path: path, sessionToken: sessionToken, grantId: grantId, body: bodyData)
        if let fetch: NativeDomainFetch<NativeJSONObject> = statusToFetch(status, data: data, grantId: grantId) { return fetch }
        guard let json = (try? JSONSerialization.jsonObject(with: data)) as? NativeJSONObject,
              let result = json.wwObject(resultField)
        else {
            return .transport(status: status)
        }
        return .success(result)
    }

    public func overview(sessionToken: String, grantId: String) async -> NativeDomainFetch<NativeJSONObject> {
        await runGetObject("api/native/wedding/overview", sessionToken: sessionToken, grantId: grantId)
    }

    public func tasks(sessionToken: String, grantId: String) async -> NativeDomainFetch<NativeJSONArray> {
        await runGetArray("api/native/wedding/tasks", sessionToken: sessionToken, grantId: grantId, arrayField: "data")
    }

    public func createTask(sessionToken: String, grantId: String, body: NativeJSONObject) async -> NativeDomainFetch<NativeJSONObject> {
        await runPostObject("api/native/wedding/tasks", sessionToken: sessionToken, grantId: grantId, body: body, resultField: "data")
    }

    public func updateTask(
        sessionToken: String,
        grantId: String,
        taskId: String,
        body: NativeJSONObject
    ) async -> NativeDomainFetch<NativeJSONObject> {
        guard let bodyData = try? JSONSerialization.data(withJSONObject: body) else {
            return .transport(status: -1)
        }
        let (status, data) = await send(
            method: "PATCH",
            path: "api/native/wedding/tasks/\(taskId)",
            sessionToken: sessionToken,
            grantId: grantId,
            body: bodyData
        )
        if let fetch: NativeDomainFetch<NativeJSONObject> = statusToFetch(status, data: data, grantId: grantId) { return fetch }
        guard let json = (try? JSONSerialization.jsonObject(with: data)) as? NativeJSONObject,
              let result = json.wwObject("data")
        else {
            return .transport(status: status)
        }
        return .success(result)
    }

    public func budget(sessionToken: String, grantId: String) async -> NativeDomainFetch<NativeJSONObject> {
        await runGetObject("api/native/wedding/budget", sessionToken: sessionToken, grantId: grantId)
    }

    public func guests(sessionToken: String, grantId: String, query: String = "") async -> NativeDomainFetch<NativeJSONArray> {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let extra: [URLQueryItem] = trimmed.isEmpty ? [] : [URLQueryItem(name: "q", value: trimmed)]
        return await runGetArray("api/native/wedding/guests", sessionToken: sessionToken, grantId: grantId, arrayField: "data", extraQueryItems: extra)
    }

    public func seating(sessionToken: String, grantId: String) async -> NativeDomainFetch<NativeJSONArray> {
        await runGetArray("api/native/wedding/seating", sessionToken: sessionToken, grantId: grantId, arrayField: "data")
    }

    public func timeline(sessionToken: String, grantId: String) async -> NativeDomainFetch<NativeJSONArray> {
        await runGetArray("api/native/wedding/timeline", sessionToken: sessionToken, grantId: grantId, arrayField: "data")
    }

    public func vendors(sessionToken: String, grantId: String) async -> NativeDomainFetch<NativeJSONArray> {
        await runGetArray("api/native/wedding/vendors", sessionToken: sessionToken, grantId: grantId, arrayField: "data")
    }

    public func vendorBusiness(sessionToken: String, grantId: String) async -> NativeDomainFetch<NativeJSONObject> {
        await runGetObject("api/native/vendor/business", sessionToken: sessionToken, grantId: grantId)
    }

    public func vendorCatalog(sessionToken: String, grantId: String) async -> NativeDomainFetch<NativeJSONObject> {
        await runGetObject("api/native/vendor/catalog", sessionToken: sessionToken, grantId: grantId)
    }

    public func vendorBookings(sessionToken: String, grantId: String) async -> NativeDomainFetch<NativeJSONArray> {
        await runGetArray("api/native/vendor/bookings", sessionToken: sessionToken, grantId: grantId, arrayField: "data")
    }

    public func adminOverview(sessionToken: String, grantId: String) async -> NativeDomainFetch<NativeJSONObject> {
        await runGetObject("api/native/admin/overview", sessionToken: sessionToken, grantId: grantId)
    }

    /// Master plan Phase 8 closure §11 — the same `loadContributionWorkspace` engine the PWA's
    /// `/api/planner/contributions` uses, never a second client-recomputed funding truth.
    public func contributions(sessionToken: String, grantId: String) async -> NativeDomainFetch<NativeJSONObject> {
        await runGetObject("api/native/wedding/contributions", sessionToken: sessionToken, grantId: grantId)
    }

    /// Master plan Phase 8 closure §3 — the same `listWeddingVaultObjects` catalog the PWA's
    /// `/api/vault` GET uses, never a second client-recomputed document truth.
    public func vault(sessionToken: String, grantId: String) async -> NativeDomainFetch<NativeJSONArray> {
        await runGetArray("api/native/wedding/vault", sessionToken: sessionToken, grantId: grantId, arrayField: "data")
    }
}
