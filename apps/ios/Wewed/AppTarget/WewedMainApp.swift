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

/// DEBUG `production_preview` launched without an approved origin. Nothing is built: no account,
/// Guest or domain client exists, so nothing can reach any server — least of all production.
private struct PreviewOriginRejectedView: View {
    let rejection: NativePreviewOriginRejection

    var body: some View {
        VStack(spacing: 12) {
            Text("Production Preview is not configured")
                .font(.headline)
            Text("WEWED_PREVIEW_ORIGIN must name an approved https Preview deployment. Reason: \(String(describing: rejection)).")
                .font(.footnote)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .accessibilityIdentifier("production-preview-origin-rejected")
    }
}

@main
struct WewedMainApp: App {
    @StateObject private var session: SessionStore
    @State private var guestOnlyActive: Bool
    private let mode: AppLaunchMode
    private let previewOriginRejection: NativePreviewOriginRejection?

    init() {
        let launch = NativeLaunchConfiguration.resolve()
        // One server for every real client in this process, chosen before any client exists.
        // Release is always https://wewed.pro.
        NativeServerOrigin.activate(launch.lane)
        #if DEBUG
        if ProcessInfo.processInfo.environment["WEWED_GUEST_UI_CLEAR_SESSION"] == "1" {
            GuestInvitationBootstrap.clearRememberedGuestForUITest()
        }
        #endif
        previewOriginRejection = launch.previewOriginRejection
        if previewOriginRejection != nil {
            // Fail closed before any client exists: an empty session with no authority client, and
            // no workspace (the body renders PreviewOriginRejectedView instead of any mode).
            _session = StateObject(wrappedValue: SessionStore(environment: .production))
            _guestOnlyActive = State(initialValue: false)
            self.mode = .guestOnly
            return
        }
        // Guest and account identity are separate domains. Decide remembered-Guest ownership
        // BEFORE constructing the account session store, otherwise a Guest-only launch can still
        // start restoring an unrelated account token in the background.
        let rememberedGuest = launch.environment == .production && GuestInvitationBootstrap.hasGuestSession()

        // Built once the environment is known, because the environment decides whether a Shadow
        // persona may be applied at all. It starts empty: no identity, role or wedding until
        // something with authority supplies one (master plan §8.2).
        let store: SessionStore
        if launch.environment == .production {
            store = SessionStore(
                storage: KeychainSecureStorage(service: launch.lane.keychainService("pro.wewed.app.account-session")),
                environment: .production,
                authorityClient: ProductionAuthorityClient(baseURL: launch.lane.origin),
                restoreImmediately: !rememberedGuest
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

        _guestOnlyActive = State(initialValue: rememberedGuest)

        do {
            // Always construct the production workspace mode too. A remembered Guest owns the
            // visible front door, but may explicitly leave that wedding and return to account
            // sign-in/workspace without force-quitting the app.
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
        if let previewOriginRejection {
            PreviewOriginRejectedView(rejection: previewOriginRejection)
        } else {
            modeContent
        }
    }

    @ViewBuilder private var modeContent: some View {
        if guestOnlyActive {
            // Guest identity remains a separate front door. Leaving this wedding clears only the
            // Guest session, then resumes the normal account bootstrap in this same process.
            GuestOnlyInvitationShellView(onLeaveGuestMode: {
                guestOnlyActive = false
                session.restoreSession()
            })
        } else {
            switch mode {
            case let .workspace(appState):
                WorkspaceHostView(appState: appState, session: session)
            case .guestOnly:
                GuestOnlyInvitationShellView()
            }
        }
    }
}
