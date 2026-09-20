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

        let resolvedAppState: AppState
        do {
            resolvedAppState = try AppState.make(
                environment: launch.environment,
                baseURL: launch.baseURL
            )
        } catch {
            preconditionFailure("Unsafe or unsupported Wewed native launch environment: \(error)")
        }

        _appState = StateObject(wrappedValue: resolvedAppState)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(appState)
        }
    }
}
