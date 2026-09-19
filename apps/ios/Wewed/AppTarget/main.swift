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
                baseURL: launch.baseURL,
                launch: launch
            )
        } catch {
            preconditionFailure("Unsafe or unsupported Wewed native launch environment: \(error)")
        }

        // Provenance for local qualification: which dataset, and for private data which exact bytes.
        NSLog("WewedProvenance environment=%@ sha256=%@", resolvedAppState.dataEnvironment.rawValue, resolvedAppState.dataFingerprint ?? "none")
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
