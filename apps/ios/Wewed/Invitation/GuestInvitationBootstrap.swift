import Foundation

/// The guest invitation's own dependency boundary.
///
/// Deliberately built *outside* `NativeRepositoryFactory`. An invited guest opening their card
/// needs one thing — the guest-session authority — and nothing about tasks, budgets, vendors or
/// admin. Routing this through the general repository factory would mean a guest could not open an
/// invitation until the entire production workspace was enabled, which is far more production
/// surface than the invitation slice is authorized to turn on.
///
/// So the two are independent:
///
/// ```
/// production + incoming/remembered Guest → this bootstrap, Guest authority wins
/// production + ordinary account launch    → Phase-5 read-only account workspace bootstrap
/// ```
///
/// One instance per process. The session must survive view rebuilds, and a second client would
/// mean a second copy of the credential.
public enum GuestInvitationBootstrap {

    /// The production origin. A Release guest journey has exactly one home.
    public static let productionBaseURL = NativeServerOrigin.production

    /// Keychain service of the Guest session for the active server lane. A DEBUG Preview lane keeps
    /// its Guest credential apart from the production one.
    static var guestSessionService: String {
        NativeServerOrigin.active.keychainService("pro.wewed.app.guest-session")
    }

    private static let lock = NSLock()
    nonisolated(unsafe) private static var shared: LiveGuestInvitationCoordinator?

    /// The live coordinator, created once.
    ///
    /// - Parameter baseURL: overridable only so tests can point at a stub. It defaults to the
    ///   launch lane's origin — always https://wewed.pro in Release — because a guest's invitation
    ///   is not a configurable destination.
    public static func coordinator(
        baseURL: URL? = nil,
        storage: SecureStorageProtocol? = nil
    ) -> LiveGuestInvitationCoordinator {
        lock.lock()
        defer { lock.unlock() }
        if let shared { return shared }
        let created = LiveGuestInvitationCoordinator(
            client: GuestSessionClient(
                baseUrl: baseURL ?? NativeServerOrigin.active.origin,
                // Keychain, not memory: a guest session that does not survive a launch would ask
                // the guest to open their invitation again every time.
                storage: storage ?? KeychainSecureStorage(service: guestSessionService)
            )
        )
        shared = created
        return created
    }

    /// Whether this device already holds a remembered Guest session.
    public static func hasGuestSession() -> Bool {
        KeychainSecureStorage(service: guestSessionService).get(key: "wewed.guest.session") != nil
    }

    /// Test seam. Never called by the app.
    static func reset() {
        lock.lock()
        defer { lock.unlock() }
        shared = nil
    }
}
