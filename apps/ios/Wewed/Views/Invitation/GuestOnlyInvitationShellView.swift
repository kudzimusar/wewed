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

    public init(coordinator: LiveGuestInvitationCoordinator = GuestInvitationBootstrap.coordinator()) {
        self.coordinator = coordinator
    }

    private func handle(_ url: URL) {
        guard let entry = InvitationEntryParser.entry(from: url.absoluteString) else { return }
        Task {
            state = .exchanging
            state = await coordinator.enter(entry)
        }
    }

    public var body: some View {
        content
            .onOpenURL(perform: handle)
            .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                if let url = activity.webpageURL { handle(url) }
            }
    }

    @ViewBuilder
    private var content: some View {
        switch state {
        case let .presenting(snapshot):
            LiveGuestInvitationView(
                presentation: LiveInvitationPresentation.from(snapshot),
                coordinator: coordinator,
                onRefreshed: { state = $0 },
                // There is no workspace to continue into here, so the card stays. Dropping the
                // guest onto an empty shell would be worse than leaving their invitation open.
                onContinue: {}
            )

        case let .refused(reason):
            InvitationRefusedView(reason: reason ?? .malformedHandoff) { state = .idle }

        case .unavailable:
            InvitationUnavailableView { state = .idle }

        case .exchanging:
            ZStack {
                WeddingIdentityPalette.ivory.ignoresSafeArea()
                AccessibilityMarker("invitation-exchanging", label: "Opening your invitation")
                ProgressView().tint(WeddingIdentityPalette.champagneDeep)
            }

        case .idle:
            // Waiting for the link that brought the guest here.
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
