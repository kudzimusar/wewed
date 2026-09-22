import SwiftUI
import WewedKit

private struct WorkspaceHostView: View {
    @StateObject private var appState: AppState
    @ObservedObject var session: SessionStore

    init(appState: AppState, session: SessionStore) {
        _appState = StateObject(wrappedValue: appState)
        self.session = session
    }

    var body: some View {
        RootView()
            .environmentObject(session)
            .environmentObject(appState)
    }
}

@main
struct WewedMainApp: App {
    @StateObject private var session: SessionStore
    private let mode: AppLaunchMode

    init() {
        let launch = NativeLaunchConfiguration.resolve()
        // Built once the environment is known, because the environment decides whether a Shadow
        // persona may be applied at all. It starts empty: no identity, role or wedding until
        // something with authority supplies one (master plan §8.2).
        let store: SessionStore
        if launch.environment == .production {
            store = SessionStore(
                storage: KeychainSecureStorage(service: "pro.wewed.app.account-session"),
                environment: .production,
                authorityClient: ProductionAuthorityClient(baseURL: GuestInvitationBootstrap.productionBaseURL)
            )
        } else {
            store = SessionStore(environment: launch.environment)
        }

        // Development/Shadow qualification only (P0-16): ignored in production builds, and refused
        // by the session itself outside development environments.
        if launch.environment.allowsDevelopmentPersonaSwitching,
           let requested = NativeLaunchConfiguration.requestedPersonaId(),
           let persona = DevelopmentPersona.allPersonas.first(where: { $0.id == requested }) {
            store.switchPersona(persona)
        }
        _session = StateObject(wrappedValue: store)

        do {
            // Remembered Guest identity stays a separate front door. An ordinary production icon
            // launch with a Guest session goes to Guest Home; otherwise Phase-5 account bootstrap
            // owns the production workspace.
            if launch.environment == .production && GuestInvitationBootstrap.hasGuestSession() {
                self.mode = .guestOnly
            } else {
                self.mode = try AppLaunchModeResolver.resolve(configuration: launch)
            }
        } catch {
            preconditionFailure("Wewed repository initialization failed for \(launch.environment): \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            #if DEBUG
            if let origin = ProcessInfo.processInfo.environment["WEWED_GUEST_UI_ORIGIN"],
               let url = URL(string: origin), url.host == "127.0.0.1" {
                GuestOnlyInvitationShellView(
                    coordinator: GuestInvitationBootstrap.coordinator(baseURL: url),
                    initialURL: ProcessInfo.processInfo.environment["WEWED_GUEST_UI_LINK"].flatMap(URL.init(string:))
                )
            } else {
                normalContent
            }
            #else
            normalContent
            #endif
        }
    }

    @ViewBuilder private var normalContent: some View {
        switch mode {
        case let .workspace(appState):
            WorkspaceHostView(appState: appState, session: session)
        case .guestOnly:
            // Guest-only: no planner, couple, vendor or admin surface exists in this shell,
            // because it has no repository with which to reach one.
            GuestOnlyInvitationShellView()
        }
    }
}
