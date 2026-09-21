import SwiftUI
import WewedKit

@main
struct WewedMainApp: App {
    @StateObject private var session: SessionStore
    @StateObject private var appState: AppState

    init() {
        let store = SessionStore()
        let launch = NativeLaunchConfiguration.resolve()

        // Development/Shadow qualification only (P0-16): ignored in production builds.
        if launch.environment.allowsDevelopmentPersonaSwitching,
           let requested = NativeLaunchConfiguration.requestedPersonaId(),
           let persona = DevelopmentPersona.allPersonas.first(where: { $0.id == requested }) {
            store.switchPersona(persona)
        }
        _session = StateObject(wrappedValue: store)

        // A production launch cannot build the general repository yet. That used to crash the app
        // outright; an invited guest deserves their card rather than a termination, so the failure
        // degrades to the guest-only shell instead.
        let resolvedAppState = try? AppState.make(
            environment: launch.environment,
            baseURL: launch.baseURL
        )
        _appState = StateObject(wrappedValue: resolvedAppState ?? AppState.unavailable())
        self.workspaceAvailable = resolvedAppState != nil
    }

    /// Whether the general repository could be built. False means guest-only.
    private let workspaceAvailable: Bool

    var body: some Scene {
        WindowGroup {
            if workspaceAvailable {
                RootView()
                    .environmentObject(session)
                    .environmentObject(appState)
            } else {
                // Guest-only: no planner, couple, vendor or admin surface exists in this shell,
                // because it has no repository with which to reach one.
                GuestOnlyInvitationShellView()
            }
        }
    }
}
