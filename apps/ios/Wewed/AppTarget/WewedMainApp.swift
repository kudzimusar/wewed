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
        let store = SessionStore()
        let launch = NativeLaunchConfiguration.resolve()

        // Development/Shadow qualification only (P0-16): ignored in production builds.
        if launch.environment.allowsDevelopmentPersonaSwitching,
           let requested = NativeLaunchConfiguration.requestedPersonaId(),
           let persona = DevelopmentPersona.allPersonas.first(where: { $0.id == requested }) {
            store.switchPersona(persona)
        }
        _session = StateObject(wrappedValue: store)

        do {
            self.mode = try AppLaunchModeResolver.resolve(configuration: launch)
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
