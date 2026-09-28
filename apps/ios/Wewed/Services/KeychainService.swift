import Foundation
#if canImport(Security)
import Security
#endif

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

/// Keychain-backed secure storage.
///
/// `GuestSessionClient` states that the server-issued guest session is held in the Keychain. Until
/// this existed that sentence was false: the only implementation was in-memory, so the session did
/// not survive a launch and a guest would have been asked to open their invitation again every
/// time. A comment describing a security property the code does not have is worse than no comment.
///
/// Only the server-issued session and the wedding it belongs to are stored. The raw RSVP credential
/// is never written here — it is a key for the door, not a name badge.
public final class KeychainSecureStorage: SecureStorageProtocol, @unchecked Sendable {

    private let service: String

    public init(service: String = "pro.wewed.app.guest-session") {
        self.service = service
    }

    private func query(_ key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }

    public func save(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        // Delete-then-add rather than update: it is one code path for both cases, and it cannot
        // leave a stale item behind if the attributes ever change.
        SecItemDelete(query(key) as CFDictionary)
        var attributes = query(key)
        attributes[kSecValueData as String] = data
        // The session is only needed while someone is using the device, and it must never sync to
        // another device — a guest session is bound to the device that redeemed the invitation.
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(attributes as CFDictionary, nil)
    }

    public func get(key: String) -> String? {
        var attributes = query(key)
        attributes[kSecReturnData as String] = true
        attributes[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        guard SecItemCopyMatching(attributes as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public func delete(key: String) {
        SecItemDelete(query(key) as CFDictionary)
    }

    /// Removes every item this app stored under its own service, and nothing else.
    public func clear() {
        SecItemDelete([
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
        ] as CFDictionary)
    }
}
