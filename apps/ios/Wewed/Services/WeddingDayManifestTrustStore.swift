import Foundation

public struct WeddingDayManifestKey: Codable, Equatable, Sendable {
    public let keyId: String
    public let algorithm: String
    public let publicKeyDerBase64: String
    public let status: String
    public let activeFrom: String
    public let expiresAt: String?
    public let revokedAt: String?

    public init(
        keyId: String,
        algorithm: String,
        publicKeyDerBase64: String,
        status: String,
        activeFrom: String,
        expiresAt: String? = nil,
        revokedAt: String? = nil
    ) {
        self.keyId = keyId
        self.algorithm = algorithm
        self.publicKeyDerBase64 = publicKeyDerBase64
        self.status = status
        self.activeFrom = activeFrom
        self.expiresAt = expiresAt
        self.revokedAt = revokedAt
    }
}

public struct VerifiedWeddingDayManifestTrust: Codable, Equatable, Sendable {
    public let weddingId: String
    public let weddingShortId: String
    public let eventKey: String
    public let generatedAt: String
    public let expiresAt: String
    public let rootKeyId: String
    public let keys: [WeddingDayManifestKey]

    public init(
        weddingId: String,
        weddingShortId: String,
        eventKey: String,
        generatedAt: String,
        expiresAt: String,
        rootKeyId: String,
        keys: [WeddingDayManifestKey]
    ) {
        self.weddingId = weddingId
        self.weddingShortId = weddingShortId
        self.eventKey = eventKey
        self.generatedAt = generatedAt
        self.expiresAt = expiresAt
        self.rootKeyId = rootKeyId
        self.keys = keys
    }
}

/// How old the verified, cached manifest authority a gate is admitting against is.
///
/// Observability only. It never blocks admission and does not change the manifest's own expiry:
/// it exists so an operator can see that admission is being decided from this device's cached
/// list, and that revocations made after `generatedAt` are not visible until a refresh.
public struct WeddingDayAuthorityStatus: Equatable, Sendable {
    /// Age after which the cached authority is reported as stale.
    public static let staleAfter: TimeInterval = 2 * 60 * 60

    public static let cachedListNotice =
        "Admission is being checked against this device's cached list; revocations made after it was generated are not visible until refresh."

    public let generatedAt: Date
    public let expiresAt: Date
    /// Seconds since `generatedAt` (never negative).
    public let age: TimeInterval
    public let isStale: Bool
    public let isExpired: Bool
    /// Always true: offline admission is decided from the cached, root-signed manifest.
    public let relyingOnCachedAuthority = true

    /// Nil when the stored trust timestamps cannot be parsed — nothing is invented.
    public init?(
        trust: VerifiedWeddingDayManifestTrust,
        now: Date,
        staleAfter: TimeInterval = WeddingDayAuthorityStatus.staleAfter
    ) {
        guard let generatedAt = Self.parseIsoDate(trust.generatedAt),
              let expiresAt = Self.parseIsoDate(trust.expiresAt) else { return nil }
        self.generatedAt = generatedAt
        self.expiresAt = expiresAt
        self.age = max(0, now.timeIntervalSince(generatedAt))
        self.isStale = age >= staleAfter
        self.isExpired = now >= expiresAt
    }

    /// e.g. "Offline authority · generated 09:00 · expires 21:00 · age 3h (stale)".
    public func summaryLine(timeZone: TimeZone = .current) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "HH:mm"
        let minutes = Int(age / 60)
        let ageText = minutes < 60 ? "\(minutes)m" : "\(minutes / 60)h"
        let qualifier = isExpired ? " (expired)" : (isStale ? " (stale)" : "")
        return "Offline authority · generated \(formatter.string(from: generatedAt))"
            + " · expires \(formatter.string(from: expiresAt))"
            + " · age \(ageText)\(qualifier)"
    }

    private static func parseIsoDate(_ iso8601: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: iso8601) { return date }
        let fallback = ISO8601DateFormatter()
        fallback.formatOptions = [.withInternetDateTime]
        return fallback.date(from: iso8601)
    }
}

public actor WeddingDayManifestTrustStore {
    private var manifests: [String: VerifiedWeddingDayManifestTrust] = [:]
    private let fileURL: URL?

    public init(storageDirectory: URL? = nil) {
        if let storageDirectory {
            self.fileURL = storageDirectory.appendingPathComponent("wewed_wedding_day_trust.json")
        } else {
            self.fileURL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
                .first?
                .appendingPathComponent("wewed_wedding_day_trust.json")
        }

        if let fileURL,
           FileManager.default.fileExists(atPath: fileURL.path),
           let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode([String: VerifiedWeddingDayManifestTrust].self, from: data) {
            manifests = decoded
        }
    }

    public func save(_ manifest: VerifiedWeddingDayManifestTrust) throws {
        manifests[manifest.weddingId] = manifest
        try persist()
    }

    public func manifest(weddingId: String) -> VerifiedWeddingDayManifestTrust? {
        manifests[weddingId]
    }

    public func signingKey(weddingId: String, keyId: String) -> WeddingDayManifestKey? {
        manifests[weddingId]?.keys.first(where: { $0.keyId == keyId })
    }

    public func clear(weddingId: String) throws {
        manifests.removeValue(forKey: weddingId)
        try persist()
    }

    private func persist() throws {
        guard let fileURL else { return }
        let directory = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let data = try JSONEncoder().encode(manifests)
        try data.write(to: fileURL, options: .atomic)
    }
}
