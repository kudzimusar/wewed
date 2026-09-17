import Foundation
import Combine

public final class SessionStore: ObservableObject, @unchecked Sendable {
    @Published public var isAuthenticated: Bool = false
    @Published public var currentUserRole: String? = nil
    @Published public var currentUserName: String? = nil
    @Published public var weddingId: String = "wed_tariro_shadreck_2026"
    /// Guest pass token resolved after RSVP confirmation. Nil in fixture/anonymous mode.
    @Published public var passToken: String? = nil

    private let storage: SecureStorageProtocol
    private let tokenKey = "wewed_session_token"

    public init(storage: SecureStorageProtocol = InMemorySecureStorage()) {
        self.storage = storage
        restoreSession()
    }

    public func restoreSession() {
        if let token = storage.get(key: tokenKey), !token.isEmpty {
            self.isAuthenticated = true
            self.currentUserRole = "couple"
            self.currentUserName = "Tariro & Shadreck"
        }
    }

    public func login(email: String, role: String = "couple") {
        let dummyToken = "token_\(UUID().uuidString)"
        storage.save(key: tokenKey, value: dummyToken)
        self.isAuthenticated = true
        self.currentUserRole = role
        self.currentUserName = (role == "usher") ? "Usher Team" : "Tariro & Shadreck"
    }

    public func logout() {
        storage.delete(key: tokenKey)
        self.isAuthenticated = false
        self.currentUserRole = nil
        self.currentUserName = nil
    }
}
