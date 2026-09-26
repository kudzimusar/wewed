import Foundation

/// Represents a cached guest record stored in the offline manifest for zero-connectivity check-in.
public struct GuestManifestItem: Codable, Identifiable, Equatable, Sendable {
    public let id: String
    public let serial: String
    public let guestName: String
    public let partySize: Int
    public var checkedInCount: Int
    public let tableAssignment: String?
    public let eventBitmask: Int
    public let isVip: Bool
    public let dietaryRequirements: String?
    /// Manifest v2 fields. Optional so previously persisted manifests remain readable.
    public let signingKeyId: String?
    public let nonce: String?
    public let attendeeKeys: [String]?
    public var checkedInAttendeeKeys: [String]?
    public let eligible: Bool?
    public let expiresAt: String?
    public var revokedAt: String?

    public init(
        id: String,
        serial: String,
        guestName: String,
        partySize: Int,
        checkedInCount: Int = 0,
        tableAssignment: String? = nil,
        eventBitmask: Int = 3,
        isVip: Bool = false,
        dietaryRequirements: String? = nil,
        signingKeyId: String? = nil,
        nonce: String? = nil,
        attendeeKeys: [String]? = nil,
        checkedInAttendeeKeys: [String]? = nil,
        eligible: Bool? = nil,
        expiresAt: String? = nil,
        revokedAt: String? = nil
    ) {
        self.id = id
        self.serial = serial
        self.guestName = guestName
        self.partySize = partySize
        self.checkedInCount = checkedInCount
        self.tableAssignment = tableAssignment
        self.eventBitmask = eventBitmask
        self.isVip = isVip
        self.dietaryRequirements = dietaryRequirements
        self.signingKeyId = signingKeyId
        self.nonce = nonce
        self.attendeeKeys = attendeeKeys
        self.checkedInAttendeeKeys = checkedInAttendeeKeys
        self.eligible = eligible
        self.expiresAt = expiresAt
        self.revokedAt = revokedAt
    }
}

/// A gate check-in record queued locally while offline, awaiting sync to the remote server.
///
/// The record is queue metadata only. The exact scanned WW2 credential is never a field here: it
/// lives in the OS-protected credential vault under `credentialRef`, so the ordinary cache file
/// never holds a bearer credential.
public struct QueuedCheckIn: Codable, Identifiable, Equatable, Sendable {
    public let id: String
    public let weddingId: String
    /// Display/lookup only. Never sent as admission authority — the server admits by exact token.
    public let passSerial: String
    public let guestId: String
    public let count: Int
    public let timestamp: Date
    public let usherId: String
    public var synced: Bool
    /// Exact server attendee keys admitted by this local event. Optional for backwards-compatible decoding.
    public let attendeeKeys: [String]?
    public let deviceId: String?
    /// Credential-vault key (`ww2.offline.<id>`) holding the exact scanned WW2 token. Absent on
    /// pre-LQR01 records, which therefore can never be reconciled as a trusted QR event.
    public let credentialRef: String?
    /// Set when the server terminally rejected this event. A rejected event is no longer pending.
    public var rejectionCode: String?

    public init(
        id: String = UUID().uuidString,
        weddingId: String,
        passSerial: String,
        guestId: String,
        count: Int,
        timestamp: Date = Date(),
        usherId: String,
        synced: Bool = false,
        attendeeKeys: [String]? = nil,
        deviceId: String? = nil,
        credentialRef: String? = nil,
        rejectionCode: String? = nil
    ) {
        self.id = id
        self.weddingId = weddingId
        self.passSerial = passSerial
        self.guestId = guestId
        self.count = count
        self.timestamp = timestamp
        self.usherId = usherId
        self.synced = synced
        self.attendeeKeys = attendeeKeys
        self.deviceId = deviceId
        self.credentialRef = credentialRef
        self.rejectionCode = rejectionCode
    }
}

/// How a queued offline event may be reconciled with the server.
///
/// Only `exactCredential` is ever sent. Every other class is blocked, never sent and never silently
/// trusted: it stays queued and visible for operator resolution.
public enum QueuedCheckInReconciliation: String, Equatable, Sendable {
    /// Attendee keys present and the vault returns the exact WW2 token for this record's serial.
    case exactCredential
    /// Pre-v2 queue: no attendee keys, so never reinterpreted as "admit the whole household".
    case legacyCountOnly
    /// Pre-LQR01 queue: attendee keys but no retained credential. It cannot be migrated to a
    /// trusted QR event because the exact credential was never kept.
    case legacySerialOnly
    /// A credential was retained but the vault no longer has it (reinstall, wipe) or it does not
    /// match this record. Fails closed.
    case credentialUnavailable

    public static func classify(_ record: QueuedCheckIn, vaultToken: String?) -> QueuedCheckInReconciliation {
        guard let keys = record.attendeeKeys, !keys.isEmpty else { return .legacyCountOnly }
        guard record.credentialRef != nil else { return .legacySerialOnly }
        guard let vaultToken, vaultToken.hasPrefix("WW2."),
              case .success(let parsed) = TokenVerifier.parse(token: vaultToken),
              parsed.version == "WW2",
              parsed.passSerial == record.passSerial else {
            return .credentialUnavailable
        }
        return .exactCredential
    }
}

/// Protocol defining offline manifest storage and sync queue operations.
public protocol OfflineManifestStoreProtocol: Sendable {
    func saveManifest(weddingId: String, items: [GuestManifestItem]) async throws
    func getManifest(weddingId: String) async -> [GuestManifestItem]
    func lookupBySerial(weddingId: String, serial: String) async -> GuestManifestItem?
    /// Records an admission for the exact scanned WW2 `token`. The caller must already have
    /// verified the token; the store retains it in the credential vault for exact-token sync.
    func recordOfflineCheckIn(weddingId: String, token: String, count: Int) async throws -> CheckInVerificationResult
    /// Queued events that are neither synced nor terminally rejected.
    func getPendingCheckIns(weddingId: String) async -> [QueuedCheckIn]
    /// Marks an event synced and deletes its retained credential.
    func markCheckInSynced(id: String) async throws
    /// Records a terminal server rejection and deletes the event's retained credential.
    func markCheckInRejected(id: String, code: String) async throws
    /// The raw vault value for `record.credentialRef`, if any. Classification decides whether it
    /// is the exact credential for this record.
    func credential(for record: QueuedCheckIn) async -> String?
    func markPassRevoked(weddingId: String, serial: String) async throws
    func clearManifest(weddingId: String) async
}

public enum OfflineManifestStoreMutationError: Error, Sendable {
    case revocationUnsupported
    case rejectionUnsupported
    /// The credential vault did not retain the scanned token, so the admission was not recorded.
    case credentialVaultUnavailable
}

public extension OfflineManifestStoreProtocol {
    func markPassRevoked(weddingId: String, serial: String) async throws {
        throw OfflineManifestStoreMutationError.revocationUnsupported
    }

    func markCheckInRejected(id: String, code: String) async throws {
        throw OfflineManifestStoreMutationError.rejectionUnsupported
    }

    /// Fails closed: a store without a credential vault can never reconcile an event.
    func credential(for record: QueuedCheckIn) async -> String? { nil }
}

/// Thread-safe in-memory and persistent offline manifest store for Zimbabwe-first field operations.
///
/// Storage is split by sensitivity:
/// - queue metadata (serial, attendee keys, `credentialRef`, sync/rejection state) lives in the
///   ordinary durable cache file;
/// - the exact scanned WW2 token — a bearer credential — lives only in `credentialVault`, keyed by
///   `ww2.offline.<queued id>`. In production that is the Keychain (`deviceProtected`).
///
/// If the vault loses a token (reinstall, wipe), its event classifies as `credentialUnavailable`
/// and fails closed: it is never sent and never silently trusted.
public actor OfflineManifestStore: OfflineManifestStoreProtocol {
    /// Production store, wired to the OS-protected credential vault.
    public static let shared = OfflineManifestStore.deviceProtected()

    /// Distinct Keychain service for retained offline Wedding Day credentials.
    public static let credentialVaultService = "pro.wewed.app.wedding-day.offline-credentials"

    /// Production factory: queued WW2 tokens are held in the Keychain
    /// (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, never synced off this device).
    public static func deviceProtected(
        storageDirectory: URL? = nil,
        deviceId: String = "ios-wedding-day"
    ) -> OfflineManifestStore {
        OfflineManifestStore(
            storageDirectory: storageDirectory,
            deviceId: deviceId,
            credentialVault: KeychainSecureStorage(service: credentialVaultService)
        )
    }

    static func credentialRef(forQueuedId id: String) -> String { "ww2.offline.\(id)" }

    private var manifests: [String: [String: GuestManifestItem]] = [:] // weddingId -> [serial: item]
    private var syncQueues: [String: [QueuedCheckIn]] = [:]           // weddingId -> [queuedCheckIns]
    private let fileURL: URL?
    private let deviceId: String
    private let credentialVault: SecureStorageProtocol

    /// The plain constructor defaults to an in-memory vault so unit tests stay hermetic and never
    /// touch the Keychain. Production code uses `shared` / `deviceProtected(...)`.
    public init(
        storageDirectory: URL? = nil,
        deviceId: String = "ios-wedding-day",
        credentialVault: SecureStorageProtocol = InMemorySecureStorage()
    ) {
        self.credentialVault = credentialVault
        let url: URL?
        if let dir = storageDirectory {
            url = dir.appendingPathComponent("wewed_offline_manifest.json")
        } else {
            let paths = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)
            url = paths.first?.appendingPathComponent("wewed_offline_manifest.json")
        }
        self.fileURL = url
        self.deviceId = deviceId

        if let url = url, FileManager.default.fileExists(atPath: url.path),
           let data = try? Data(contentsOf: url) {
            struct ManifestSnapshot: Codable {
                let manifests: [String: [String: GuestManifestItem]]
                let syncQueues: [String: [QueuedCheckIn]]
            }
            if let snapshot = try? JSONDecoder().decode(ManifestSnapshot.self, from: data) {
                self.manifests = snapshot.manifests
                self.syncQueues = snapshot.syncQueues
            } else {
                self.manifests = [:]
                self.syncQueues = [:]
            }
        } else {
            self.manifests = [:]
            self.syncQueues = [:]
        }
    }

    public func saveManifest(weddingId: String, items: [GuestManifestItem]) async throws {
        var map: [String: GuestManifestItem] = [:]
        for item in items {
            map[item.serial] = item
        }
        manifests[weddingId] = map
        try persistState()
    }

    public func getManifest(weddingId: String) async -> [GuestManifestItem] {
        guard let map = manifests[weddingId] else { return [] }
        return Array(map.values).sorted(by: { $0.guestName < $1.guestName })
    }

    public func lookupBySerial(weddingId: String, serial: String) async -> GuestManifestItem? {
        return manifests[weddingId]?[serial]
    }

    private func effectiveAttendeeKeys(for item: GuestManifestItem) -> [String] {
        if let keys = item.attendeeKeys, !keys.isEmpty {
            return keys
        }
        guard item.partySize > 1 else { return ["primary"] }
        return ["primary"] + (2...item.partySize).map { "member-\($0)" }
    }

    private func existingCheckedInKeys(for item: GuestManifestItem, allKeys: [String]) -> [String] {
        if let keys = item.checkedInAttendeeKeys {
            return keys.filter { allKeys.contains($0) }
        }
        return Array(allKeys.prefix(max(0, min(item.checkedInCount, allKeys.count))))
    }

    /// Admits `count` attendees for the exact scanned WW2 `token`.
    ///
    /// The serial is parsed from the token itself, so the queued event and the retained credential
    /// can never disagree. The token is written to the credential vault — and read back — BEFORE
    /// the queue record is persisted: an admission this device cannot later reconcile with its
    /// exact credential is not recorded at all.
    public func recordOfflineCheckIn(weddingId: String, token: String, count: Int) async throws -> CheckInVerificationResult {
        guard case .success(let parsed) = TokenVerifier.parse(token: token), parsed.version == "WW2" else {
            return CheckInVerificationResult(
                status: .invalidPass,
                guestName: "Unknown Guest",
                householdName: nil,
                partySize: 0,
                checkedInCount: 0,
                tableNumber: nil,
                tableName: nil,
                message: "Scanned code is not a Wedding Pass credential"
            )
        }
        let serial = parsed.passSerial
        guard count > 0,
              var weddingMap = manifests[weddingId],
              var item = weddingMap[serial] else {
            return CheckInVerificationResult(
                status: .invalidPass,
                guestName: "Unknown Guest",
                householdName: nil,
                partySize: 0,
                checkedInCount: 0,
                tableNumber: nil,
                tableName: nil,
                message: "Pass serial \(serial) not found in offline manifest"
            )
        }

        if item.eligible == false || item.revokedAt != nil {
            return CheckInVerificationResult(
                status: .invalidPass,
                guestName: item.guestName,
                householdName: nil,
                partySize: item.partySize,
                checkedInCount: item.checkedInCount,
                tableNumber: nil,
                tableName: item.tableAssignment,
                message: "Pass is not eligible for admission"
            )
        }

        let allKeys = effectiveAttendeeKeys(for: item)
        var checkedInKeys = existingCheckedInKeys(for: item, allKeys: allKeys)
        let checkedInSet = Set(checkedInKeys)
        let remainingKeys = allKeys.filter { !checkedInSet.contains($0) }
        guard count <= remainingKeys.count else {
            return CheckInVerificationResult(
                status: .capacityExceeded,
                guestName: item.guestName,
                householdName: nil,
                partySize: item.partySize,
                checkedInCount: checkedInKeys.count,
                tableNumber: nil,
                tableName: item.tableAssignment,
                message: "Party size limit exceeded: \(checkedInKeys.count + count)/\(item.partySize) checked in"
            )
        }

        let queuedId = UUID().uuidString
        let credentialRef = Self.credentialRef(forQueuedId: queuedId)
        credentialVault.save(key: credentialRef, value: token)
        guard credentialVault.get(key: credentialRef) == token else {
            credentialVault.delete(key: credentialRef)
            throw OfflineManifestStoreMutationError.credentialVaultUnavailable
        }

        let admittedKeys = Array(remainingKeys.prefix(count))
        checkedInKeys.append(contentsOf: admittedKeys)
        item.checkedInCount = checkedInKeys.count
        item.checkedInAttendeeKeys = checkedInKeys
        weddingMap[serial] = item
        manifests[weddingId] = weddingMap

        let queued = QueuedCheckIn(
            id: queuedId,
            weddingId: weddingId,
            passSerial: serial,
            guestId: item.id,
            count: admittedKeys.count,
            // usherId remains Codable for legacy snapshots only. New queue events never
            // persist operator authority; online sync resolves the current Gate operator.
            usherId: "",
            attendeeKeys: admittedKeys,
            deviceId: deviceId,
            credentialRef: credentialRef
        )

        var queue = syncQueues[weddingId] ?? []
        queue.append(queued)
        syncQueues[weddingId] = queue

        try persistState()

        return CheckInVerificationResult(
            status: .validPass,
            guestName: item.guestName,
            householdName: nil,
            partySize: item.partySize,
            checkedInCount: item.checkedInCount,
            tableNumber: nil,
            tableName: item.tableAssignment,
            message: "Offline check-in verified for \(item.guestName)"
        )
    }

    public func getPendingCheckIns(weddingId: String) async -> [QueuedCheckIn] {
        return (syncQueues[weddingId] ?? []).filter { !$0.synced && $0.rejectionCode == nil }
    }

    public func markCheckInSynced(id: String) async throws {
        try updateQueued(id: id) { $0.synced = true }
    }

    public func markCheckInRejected(id: String, code: String) async throws {
        try updateQueued(id: id) { $0.rejectionCode = code }
    }

    public func credential(for record: QueuedCheckIn) async -> String? {
        guard let ref = record.credentialRef else { return nil }
        return credentialVault.get(key: ref)
    }

    /// Applies `change` to the queued event, persists, and only then drops its retained credential:
    /// a synced or rejected event must never be sent again, so it no longer needs one.
    private func updateQueued(id: String, _ change: (inout QueuedCheckIn) -> Void) throws {
        var refs: [String] = []
        for (weddingId, queue) in syncQueues {
            var updatedQueue = queue
            for i in 0..<updatedQueue.count where updatedQueue[i].id == id {
                change(&updatedQueue[i])
                if let ref = updatedQueue[i].credentialRef { refs.append(ref) }
            }
            syncQueues[weddingId] = updatedQueue
        }
        try persistState()
        refs.forEach { credentialVault.delete(key: $0) }
    }

    public func markPassRevoked(weddingId: String, serial: String) async throws {
        guard var weddingMap = manifests[weddingId],
              var item = weddingMap[serial] else {
            return
        }
        if item.revokedAt == nil {
            item.revokedAt = "local-revoked"
            weddingMap[serial] = item
            manifests[weddingId] = weddingMap
            try persistState()
        }
    }

    public func clearManifest(weddingId: String) async {
        let refs = (syncQueues[weddingId] ?? []).compactMap(\.credentialRef)
        manifests.removeValue(forKey: weddingId)
        syncQueues.removeValue(forKey: weddingId)
        try? persistState()
        refs.forEach { credentialVault.delete(key: $0) }
    }

    private func persistState() throws {
        guard let url = fileURL else { return }
        struct ManifestSnapshot: Codable {
            let manifests: [String: [String: GuestManifestItem]]
            let syncQueues: [String: [QueuedCheckIn]]
        }
        let snapshot = ManifestSnapshot(manifests: manifests, syncQueues: syncQueues)
        let data = try JSONEncoder().encode(snapshot)
        try data.write(to: url, options: .atomic)
    }
}
