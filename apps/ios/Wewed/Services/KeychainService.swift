import Foundation

public protocol SecureStorageProtocol: Sendable {
    func save(key: String, value: String)
    func get(key: String) -> String?
    func delete(key: String)
    func clear()
}

public final class InMemorySecureStorage: SecureStorageProtocol, @unchecked Sendable {
    private var storage: [String: String] = [:]
    private let lock = NSLock()

    public init() {}

    public func save(key: String, value: String) {
        lock.lock()
        defer { lock.unlock() }
        storage[key] = value
    }

    public func get(key: String) -> String? {
        lock.lock()
        defer { lock.unlock() }
        return storage[key]
    }

    public func delete(key: String) {
        lock.lock()
        defer { lock.unlock() }
        storage.removeValue(forKey: key)
    }

    public func clear() {
        lock.lock()
        defer { lock.unlock() }
        storage.removeAll()
    }
}
