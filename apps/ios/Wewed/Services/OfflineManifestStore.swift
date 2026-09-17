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

    public init(
        id: String,
        serial: String,
        guestName: String,
        partySize: Int,
        checkedInCount: Int = 0,
        tableAssignment: String? = nil,
        eventBitmask: Int = 3,
        isVip: Bool = false,
        dietaryRequirements: String? = nil
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
    }
}

/// A gate check-in record queued locally while offline, awaiting sync to the remote server.
public struct QueuedCheckIn: Codable, Identifiable, Equatable, Sendable {
    public let id: String
    public let weddingId: String
    public let passSerial: String
    public let guestId: String
    public let count: Int
    public let timestamp: Date
    public let usherId: String
    public var synced: Bool

    public init(
        id: String = UUID().uuidString,
        weddingId: String,
        passSerial: String,
        guestId: String,
        count: Int,
        timestamp: Date = Date(),
        usherId: String,
        synced: Bool = false
    ) {
        self.id = id
        self.weddingId = weddingId
        self.passSerial = passSerial
        self.guestId = guestId
        self.count = count
        self.timestamp = timestamp
        self.usherId = usherId
        self.synced = synced
    }
}

/// Protocol defining offline manifest storage and sync queue operations.
public protocol OfflineManifestStoreProtocol: Sendable {
    func saveManifest(weddingId: String, items: [GuestManifestItem]) async throws
    func getManifest(weddingId: String) async -> [GuestManifestItem]
    func lookupBySerial(weddingId: String, serial: String) async -> GuestManifestItem?
    func recordOfflineCheckIn(weddingId: String, serial: String, count: Int, usherId: String) async throws -> CheckInVerificationResult
    func getPendingCheckIns(weddingId: String) async -> [QueuedCheckIn]
    func markCheckInSynced(id: String) async throws
    func clearManifest(weddingId: String) async
}

/// Thread-safe in-memory and persistent offline manifest store for Zimbabwe-first field operations.
public actor OfflineManifestStore: OfflineManifestStoreProtocol {
    public static let shared = OfflineManifestStore()

    private var manifests: [String: [String: GuestManifestItem]] = [:] // weddingId -> [serial: item]
    private var syncQueues: [String: [QueuedCheckIn]] = [:]           // weddingId -> [queuedCheckIns]
    private let fileURL: URL?

    public init(storageDirectory: URL? = nil) {
        let url: URL?
        if let dir = storageDirectory {
            url = dir.appendingPathComponent("wewed_offline_manifest.json")
        } else {
            let paths = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)
            url = paths.first?.appendingPathComponent("wewed_offline_manifest.json")
        }
        self.fileURL = url

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

    public func recordOfflineCheckIn(weddingId: String, serial: String, count: Int, usherId: String) async throws -> CheckInVerificationResult {
        guard var weddingMap = manifests[weddingId], var item = weddingMap[serial] else {
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

        let newTotal = item.checkedInCount + count
        if newTotal > item.partySize {
            return CheckInVerificationResult(
                status: .capacityExceeded,
                guestName: item.guestName,
                householdName: nil,
                partySize: item.partySize,
                checkedInCount: item.checkedInCount,
                tableNumber: nil,
                tableName: item.tableAssignment,
                message: "Party size limit exceeded: \(newTotal)/\(item.partySize) checked in"
            )
        }

        item.checkedInCount = newTotal
        weddingMap[serial] = item
        manifests[weddingId] = weddingMap

        let queued = QueuedCheckIn(
            weddingId: weddingId,
            passSerial: serial,
            guestId: item.id,
            count: count,
            usherId: usherId
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
        return (syncQueues[weddingId] ?? []).filter { !$0.synced }
    }

    public func markCheckInSynced(id: String) async throws {
        for (weddingId, queue) in syncQueues {
            var updatedQueue = queue
            for i in 0..<updatedQueue.count {
                if updatedQueue[i].id == id {
                    updatedQueue[i].synced = true
                }
            }
            syncQueues[weddingId] = updatedQueue
        }
        try persistState()
    }

    public func clearManifest(weddingId: String) async {
        manifests.removeValue(forKey: weddingId)
        syncQueues.removeValue(forKey: weddingId)
        try? persistState()
    }

    private func persistState() throws {
        // State persistence can write to local JSON / encrypted store
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
