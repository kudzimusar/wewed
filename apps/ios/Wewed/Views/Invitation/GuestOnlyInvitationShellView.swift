import SwiftUI

/// The whole app, for an invited guest, when nothing else is available.
///
/// A production launch cannot build the general repository yet — that is a deliberate boundary, not
/// an oversight. But an invited guest tapping their own link needs the guest-session authority and
/// nothing else, so their invitation must not die behind a workspace they were never going to use.
///
/// This shell is the narrow exception: guest-only, live, and incapable of reaching a planner,
/// couple, vendor or admin surface because it has no repository to reach one with. It also listens
/// for the link itself, since on iOS a Universal Link arrives after launch rather than at init.
public struct GuestOnlyInvitationShellView: View {
    private let coordinator: LiveGuestInvitationCoordinator

    @State private var state: LiveInvitationState = .idle
    @State private var splashComplete = false
    /// The entry currently on screen, so a replacement can restage the opening for the new guest.
    @State private var currentEntry: InvitationEntry?
    /// Which of the Guest's two surfaces is showing: their invitation, or their wedding.
    ///
    /// An explicit link opens on the invitation, because that is the ceremony. An ordinary
    /// relaunch opens on Home, because replaying the whole card every time someone checks their
    /// table would be tiresome rather than ceremonial. The invitation is always one tap away.
    @State private var showingInvitation = true

    public init(coordinator: LiveGuestInvitationCoordinator = GuestInvitationBootstrap.coordinator()) {
        self.coordinator = coordinator
    }

    private func handle(_ url: URL) {
        guard let entry = InvitationEntryParser.entry(from: url.absoluteString) else { return }
        // A replacement link is a new arrival. Dropping Guest B straight into a card that just
        // said Guest A's name reads as a glitch, so the opening is restaged.
        if entry != currentEntry { splashComplete = false }
        currentEntry = entry
        showingInvitation = true
        Task {
            state = .exchanging
            state = await coordinator.enter(entry)
        }
    }

    private func retry() {
        // A visible retry has to actually retry. Resetting the state alone left an indefinite
        // spinner, which is a worse outcome than the error it replaced.
        guard let entry = currentEntry else {
            state = .idle
            return
        }
        Task {
            state = .exchanging
            state = await coordinator.enter(entry)
        }
    }

    public var body: some View {
        Group {
            // The branded opening belongs to the real guest path too. The exchange runs underneath
            // it, so the splash costs nothing, and after it the first wedding UI is the configured
            // invitation — never Home, a login or a workspace.
            if currentEntry != nil && !splashComplete {
                WewedAnimatedSplash(destination: .invitation) { splashComplete = true }
            } else {
                content
            }
        }
        .onOpenURL(perform: handle)
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            if let url = activity.webpageURL { handle(url) }
        }
        .task {
            // An ordinary launch: the app icon, not a link. A Guest who opened their invitation
            // last month should find their wedding, not be told to go back to WhatsApp.
            guard currentEntry == nil, case .idle = state else { return }
            state = .exchanging
            let restored = await coordinator.restoreRememberedGuest()
            // A restored session opens on Home; only an explicit link earns the ceremony.
            if case .presenting = restored { showingInvitation = false }
            state = restored
        }
    }

    /// Ends the wedding relationship on this device.
    ///
    /// Deliberately separate from account Sign Out: it clears the Guest session and nothing else,
    /// so forgetting a wedding on a planner's phone cannot sign the planner out of Wewed.
    private func forgetWedding() {
        Task {
            await coordinator.forgetGuest()
            currentEntry = nil
            showingInvitation = true
            state = .idle
        }
    }

    @ViewBuilder
    private var content: some View {
        switch state {
        case let .presenting(snapshot):
            let profile = LiveInvitationPresentation.from(snapshot)
            if showingInvitation {
                LiveGuestInvitationView(
                    presentation: profile,
                    coordinator: coordinator,
                    onRefreshed: { state = $0 },
                    // The dead end this replaces: Continue used to do nothing, which is why a
                    // guest could open their invitation and then have nowhere to go.
                    onContinue: { showingInvitation = false }
                )
            } else {
                LiveGuestShellView(
                    profile: profile,
                    onOpenInvitation: { showingInvitation = true },
                    onForgetWedding: forgetWedding
                )
            }

        case let .refused(reason):
            InvitationRefusedView(reason: reason ?? .malformedHandoff) { state = .idle }

        case .unavailable:
            InvitationUnavailableView(onRetry: retry)

        case .exchanging:
            ZStack {
                WeddingIdentityPalette.ivory.ignoresSafeArea()
                AccessibilityMarker("invitation-exchanging", label: "Opening your invitation")
                ProgressView().tint(WeddingIdentityPalette.champagneDeep)
            }

        case .idle:
            // Waiting for a link, or for the remembered-session restore below to answer.
            ZStack {
                WeddingIdentityPalette.ivory.ignoresSafeArea()
                AccessibilityMarker("invitation-awaiting-link", label: "Open your invitation link")
                Text("Open your invitation link to continue.")
                    .font(.system(size: 15))
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .multilineTextAlignment(.center)
                    .padding(32)
            }
        }
    }
}
