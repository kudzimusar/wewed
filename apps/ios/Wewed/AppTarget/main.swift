import SwiftUI
import WewedKit

@main
struct WewedMainApp: App {
    @StateObject private var session = SessionStore()
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(appState)
        }
    }
}
