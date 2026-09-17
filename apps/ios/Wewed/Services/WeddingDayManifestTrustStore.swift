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
