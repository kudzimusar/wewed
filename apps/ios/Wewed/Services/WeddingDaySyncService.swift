import Foundation

public enum WeddingDaySyncError: Error, Equatable, Sendable {
    case invalidResponse
    case serverRejected(Int)
    case manifestSignatureInvalid
    case manifestVersionUnsupported
    case manifestWeddingMismatch
    case manifestExpired
    case rootKeyMismatch
    case passNotInManifest
    case passMetadataMismatch
    case passIneligible
    case signingKeyUnavailable
    case signingKeyInactive
    case passSignatureInvalid
}

public struct WeddingDaySyncResult: Equatable, Sendable {
    public let syncedIds: [String]
    public let failedIds: [String]
    public let blockedLegacyIds: [String]

    public init(syncedIds: [String], failedIds: [String], blockedLegacyIds: [String]) {
        self.syncedIds = syncedIds
        self.failedIds = failedIds
        self.blockedLegacyIds = blockedLegacyIds
    }
}

private struct ManifestAPIEnvelope: Decodable {
    let success: Bool
    let data: SignedManifestAPIData
}

private struct SignedManifestAPIData: Decodable {
    let rootKeyId: String
    let algorithm: String
    let canonicalPayload: String
    let signatureHex: String
}

private struct NativeManifestPayload: Decodable {
    let manifestVersion: Int
    let tokenVersion: String
    let weddingId: String
    let weddingSlug: String
    let weddingShortId: String
    let eventKey: String
    let generatedAt: String
    let expiresAt: String
    let keys: [WeddingDayManifestKey]
    let credentials: [NativeManifestCredential]
}

private struct NativeManifestCredential: Decodable {
    let guestId: String
    let guestName: String
    let tableNumber: Int?
    let passSerial: String
    let nonce: String
    let eventBitmask: Int
    let keyId: String
    let eligible: Bool
    let household: [NativeManifestHouseholdMember]
    let partySize: Int
    let checkedInAttendeeKeys: [String]
    let issuedAt: String
    let expiresAt: String?
    let revokedAt: String?
}

private struct NativeManifestHouseholdMember: Decodable {
    let attendeeKey: String
    let attendeeKind: String
    let attendeeName: String
}

struct OfflineSyncBody: Encodable {
    let passSerial: String
    let attendeeKeys: [String]
    let deviceId: String?
    let clientEventId: String
}


public actor WeddingDaySyncService {
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    public init(session: URLSession = .shared) {
        self.session = session
    }

    @discardableResult
    public func downloadAndCacheManifest(
        baseURL: URL,
        bearerToken: String,
        expectedWeddingId: String,
        trustedRootPublicKeyDerBase64: String,
        trustedRootKeyId: String? = nil,
        grantId: String? = nil,
        offlineStore: OfflineManifestStoreProtocol,
        trustStore: WeddingDayManifestTrustStore
    ) async throws -> VerifiedWeddingDayManifestTrust {
        let manifestBaseURL = baseURL.appendingPathComponent("api/native/gate/wedding-day/manifest")
        var components = URLComponents(url: manifestBaseURL, resolvingAgainstBaseURL: false)
        if let grantId {
            components?.queryItems = [URLQueryItem(name: "grantId", value: grantId)]
        }
        let url = components?.url ?? manifestBaseURL
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let grantId {
            request.setValue(grantId, forHTTPHeaderField: "x-wewed-grant-id")
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw WeddingDaySyncError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw WeddingDaySyncError.serverRejected(http.statusCode)
        }

        let envelope = try decoder.decode(ManifestAPIEnvelope.self, from: data)
        guard envelope.success else { throw WeddingDaySyncError.invalidResponse }
        if let trustedRootKeyId, envelope.data.rootKeyId != trustedRootKeyId {
            throw WeddingDaySyncError.rootKeyMismatch
        }
        guard TokenVerifier.verifyP1363(
            payload: envelope.data.canonicalPayload,
            signatureHex: envelope.data.signatureHex,
            publicKeyDerBase64: trustedRootPublicKeyDerBase64
        ) else {
            throw WeddingDaySyncError.manifestSignatureInvalid
        }

        guard let canonicalData = envelope.data.canonicalPayload.data(using: .utf8) else {
            throw WeddingDaySyncError.invalidResponse
        }
        let payload = try decoder.decode(NativeManifestPayload.self, from: canonicalData)
        guard payload.manifestVersion == 2, payload.tokenVersion == "WW2" else {
            throw WeddingDaySyncError.manifestVersionUnsupported
        }
        guard payload.weddingId == expectedWeddingId else {
            throw WeddingDaySyncError.manifestWeddingMismatch
        }
        guard let manifestExpiresAt = parseIsoDate(payload.expiresAt) else {
            throw WeddingDaySyncError.invalidResponse
        }
        guard manifestExpiresAt > Date() else {
            throw WeddingDaySyncError.manifestExpired
        }

        let trust = VerifiedWeddingDayManifestTrust(
            weddingId: payload.weddingId,
            weddingShortId: payload.weddingShortId,
            eventKey: payload.eventKey,
            generatedAt: payload.generatedAt,
            expiresAt: payload.expiresAt,
            rootKeyId: envelope.data.rootKeyId,
            keys: payload.keys
        )

        let items = payload.credentials.map { credential in
            GuestManifestItem(
                id: credential.guestId,
                serial: credential.passSerial,
                guestName: credential.guestName,
                partySize: credential.household.count,
                checkedInCount: credential.checkedInAttendeeKeys.count,
                tableAssignment: credential.tableNumber.map { "Table \($0)" },
                eventBitmask: credential.eventBitmask,
                signingKeyId: credential.keyId,
                nonce: credential.nonce,
                attendeeKeys: credential.household.map(\.attendeeKey),
                checkedInAttendeeKeys: credential.checkedInAttendeeKeys,
                eligible: credential.eligible,
                expiresAt: credential.expiresAt,
                revokedAt: credential.revokedAt
            )
        }

        try await trustStore.save(trust)
        try await offlineStore.saveManifest(weddingId: payload.weddingId, items: items)
        return trust
    }

    public func verifyOfflinePass(
        token: String,
        weddingId: String,
        requiredEventBit: UInt8 = 0x04,
        offlineStore: OfflineManifestStoreProtocol,
        trustStore: WeddingDayManifestTrustStore
    ) async throws -> GuestManifestItem {
        guard let trust = await trustStore.manifest(weddingId: weddingId) else {
            throw WeddingDaySyncError.signingKeyUnavailable
        }
        guard !isExpired(trust.expiresAt) else {
            throw WeddingDaySyncError.manifestExpired
        }

        let parsed: ParsedQRToken
        switch TokenVerifier.parse(token: token) {
        case .success(let value): parsed = value
        case .failure: throw WeddingDaySyncError.passSignatureInvalid
        }
        guard parsed.version == "WW2", parsed.weddingShortId == trust.weddingShortId else {
            throw WeddingDaySyncError.passMetadataMismatch
        }
        guard let item = await offlineStore.lookupBySerial(weddingId: weddingId, serial: parsed.passSerial) else {
            throw WeddingDaySyncError.passNotInManifest
        }
        let credentialExpiryInvalidOrExpired: Bool
        if let expiresAt = item.expiresAt {
            guard let parsedExpiry = parseIsoDate(expiresAt) else {
                throw WeddingDaySyncError.passIneligible
            }
            credentialExpiryInvalidOrExpired = parsedExpiry <= Date()
        } else {
            credentialExpiryInvalidOrExpired = false
        }
        guard item.eligible != false, item.revokedAt == nil, !credentialExpiryInvalidOrExpired else {
            throw WeddingDaySyncError.passIneligible
        }
        guard item.nonce == nil || item.nonce == parsed.nonce,
              item.eventBitmask == Int(parsed.eventBitmask),
              let keyId = item.signingKeyId else {
            throw WeddingDaySyncError.passMetadataMismatch
        }
        guard let key = await trustStore.signingKey(weddingId: weddingId, keyId: keyId) else {
            throw WeddingDaySyncError.signingKeyUnavailable
        }
        guard key.algorithm == "ECDSA_P256_SHA256",
              key.status.lowercased() == "active",
              key.revokedAt == nil,
              let activeFrom = parseIsoDate(key.activeFrom),
              activeFrom <= Date() else {
            throw WeddingDaySyncError.signingKeyInactive
        }
        if let expiresAt = key.expiresAt {
            guard let parsedExpiry = parseIsoDate(expiresAt), parsedExpiry > Date() else {
                throw WeddingDaySyncError.signingKeyInactive
            }
        }

        switch TokenVerifier.verifyAsymmetric(
            token: token,
            publicKeyDerBase64: key.publicKeyDerBase64,
            requiredEventBit: requiredEventBit
        ) {
        case .success:
            return item
        case .failure:
            throw WeddingDaySyncError.passSignatureInvalid
        }
    }

    public func syncPendingCheckIns(
        baseURL: URL,
        bearerToken: String,
        weddingId: String,
        grantId: String? = nil,
        offlineStore: OfflineManifestStoreProtocol,
        trustStore: WeddingDayManifestTrustStore
    ) async -> WeddingDaySyncResult {
        guard let trust = await trustStore.manifest(weddingId: weddingId) else {
            return WeddingDaySyncResult(syncedIds: [], failedIds: [], blockedLegacyIds: [])
        }
        let pending = await offlineStore.getPendingCheckIns(weddingId: weddingId)
        var synced: [String] = []
        var failed: [String] = []
        var legacy: [String] = []
        let checkInBaseURL = baseURL.appendingPathComponent("api/native/gate/wedding-day/check-in")
        var components = URLComponents(url: checkInBaseURL, resolvingAgainstBaseURL: false)
        if let grantId {
            components?.queryItems = [URLQueryItem(name: "grantId", value: grantId)]
        }
        let url = components?.url ?? checkInBaseURL

        for record in pending {
            guard let attendeeKeys = record.attendeeKeys, !attendeeKeys.isEmpty else {
                // Never reinterpret an old count-only queue entry as "admit whole household".
                legacy.append(record.id)
                continue
            }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            if let grantId {
                request.setValue(grantId, forHTTPHeaderField: "x-wewed-grant-id")
            }
            request.httpBody = try? encoder.encode(
                OfflineSyncBody(
                    passSerial: record.passSerial,
                    attendeeKeys: attendeeKeys,
                    deviceId: record.deviceId,
                    clientEventId: record.id
                )
            )

            do {
                let (_, response) = try await session.data(for: request)
                guard let http = response as? HTTPURLResponse,
                      (200..<300).contains(http.statusCode) else {
                    failed.append(record.id)
                    continue
                }
                try await offlineStore.markCheckInSynced(id: record.id)
                synced.append(record.id)
            } catch {
                failed.append(record.id)
            }
        }

        return WeddingDaySyncResult(
            syncedIds: synced,
            failedIds: failed,
            blockedLegacyIds: legacy
        )
    }

    private func parseIsoDate(_ iso8601: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: iso8601) { return date }

        let fallback = ISO8601DateFormatter()
        fallback.formatOptions = [.withInternetDateTime]
        return fallback.date(from: iso8601)
    }
}
