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

    /// The production origin. The guest journey has exactly one home.
    public static let productionBaseURL = URL(string: "https://wewed.pro")!

    private static let lock = NSLock()
    nonisolated(unsafe) private static var shared: LiveGuestInvitationCoordinator?

    /// The live coordinator, created once.
    ///
    /// - Parameter baseURL: overridable only so tests can point at a stub. It defaults to
    ///   production because a guest's invitation is not a configurable destination.
    public static func coordinator(
        baseURL: URL = productionBaseURL,
        storage: SecureStorageProtocol? = nil
    ) -> LiveGuestInvitationCoordinator {
        lock.lock()
        defer { lock.unlock() }
        if let shared { return shared }
        let created = LiveGuestInvitationCoordinator(
            client: GuestSessionClient(
                baseUrl: baseURL,
                // Keychain, not memory: a guest session that does not survive a launch would ask
                // the guest to open their invitation again every time.
                storage: storage ?? KeychainSecureStorage()
            )
        )
        shared = created
        return created
    }

    /// Whether this device already holds a remembered Guest session.
    public static func hasGuestSession() -> Bool {
        KeychainSecureStorage().get(key: "wewed.guest.session") != nil
    }

    /// Test seam. Never called by the app.
    static func reset() {
        lock.lock()
        defer { lock.unlock() }
        shared = nil
    }
}
