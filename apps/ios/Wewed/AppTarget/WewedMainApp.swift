import SwiftUI
import WewedKit

@main
struct WewedMainApp: App {
    @StateObject private var session: SessionStore
    @StateObject private var appState: AppState

    init() {
        _session = StateObject(wrappedValue: SessionStore())

        let launch = NativeLaunchConfiguration.resolve()
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
