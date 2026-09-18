import Foundation
import Combine

public final class SessionStore: ObservableObject, @unchecked Sendable {
    @Published public var isAuthenticated: Bool = false
    @Published public var currentUserRole: String? = nil
    @Published public var currentRole: AppRole = .couple
    @Published public var currentUserName: String? = nil
    @Published public var weddingId: String = "cmqos70cb0004q6vxe9g9aiu5"
    @Published public var weddingTitle: String = "Charity & Kudzie Wedding"
    @Published public var activePersona: DevelopmentPersona? = nil
    @Published public var passToken: String? = nil
    @Published public var showingPersonaPicker: Bool = false

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
            self.currentRole = .couple
            self.currentUserName = "Charity & Kudzie"
        }
    }

    public func login(email: String, role: String = "couple") {
        let dummyToken = "token_\(UUID().uuidString)"
        storage.save(key: tokenKey, value: dummyToken)
        self.isAuthenticated = true
        self.currentUserRole = role
        let parsed = AppRole.from(roleId: role)
        self.currentRole = parsed
        self.currentUserName = (parsed == .usher) ? "Gate Usher" : "Charity & Kudzie"
    }

    public func switchPersona(_ persona: DevelopmentPersona) {
        self.activePersona = persona
        self.currentRole = persona.role
        self.currentUserRole = persona.role.roleId
        self.currentUserName = persona.name
        self.weddingId = persona.weddingId
        self.weddingTitle = persona.weddingTitle
        self.isAuthenticated = true
    }

    public func logout() {
        storage.delete(key: tokenKey)
        self.isAuthenticated = false
        self.currentUserRole = nil
        self.currentRole = .couple
        self.currentUserName = nil
        self.activePersona = nil
    }
}
