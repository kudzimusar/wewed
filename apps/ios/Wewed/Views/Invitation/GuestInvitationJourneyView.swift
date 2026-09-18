import SwiftUI

/// Canonical guest entry sequence used by the shadow-real-wedding sprint:
/// Wewed splash -> Ivory Floral Gold invitation -> RSVP -> Wedding Pass.
/// This view is intentionally isolated from the default GuestShell until local build/UI qualification.
public struct GuestInvitationJourneyView: View {
    @EnvironmentObject private var appState: AppState

    public let reference: GuestJourneyReference

    @State private var stage: GuestJourneyStage
    @State private var splashVisible = false

    public init(reference: GuestJourneyReference) {
        self.reference = reference
        _stage = State(initialValue: reference.initialStage)
    }

    public var body: some View {
        Group {
            switch stage {
            case .splash:
                splashStage
            case .invitation:
                IvoryInvitationView(
                    invitation: reference.invitation,
                    allowsClose: false
                ) { _ in
                    withAnimation(.easeInOut(duration: 0.35)) {
                        stage = .confirmedAttending
                    }
                } onRsvpDeclined: {
                    withAnimation(.easeInOut(duration: 0.35)) {
                        stage = .declined
                    }
                }
            case .confirmedAttending:
                PassView()
            case .declined:
                declinedStage
            }
        }
        .task(id: stage) {
            guard stage == .splash else { return }
            withAnimation(.easeOut(duration: 0.45)) {
                splashVisible = true
            }
            try? await Task.sleep(nanoseconds: 1_050_000_000)
            withAnimation(.easeInOut(duration: 0.4)) {
                stage = reference.invitation.isConfirmed ? .confirmedAttending : .invitation
            }
        }
    }

    private var splashStage: some View {
        ZStack {
            Color(red: 0.08, green: 0.07, blue: 0.06)
                .ignoresSafeArea()

            VStack(spacing: 14) {
                Text("WEWED")
                    .font(.system(size: 40, weight: .semibold, design: .serif))
                    .tracking(5)
                    .foregroundColor(WewedColors.gold)

                Text("Plan together. Celebrate beautifully.")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.78))

                Capsule()
                    .fill(WewedColors.gold.opacity(0.7))
                    .frame(width: splashVisible ? 92 : 26, height: 2)
                    .animation(.easeInOut(duration: 0.8), value: splashVisible)
            }
            .scaleEffect(splashVisible ? 1 : 0.92)
            .opacity(splashVisible ? 1 : 0)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Wewed. Plan together. Celebrate beautifully.")
    }

    private var declinedStage: some View {
        VStack(spacing: 14) {
            Image(systemName: "heart")
                .font(.largeTitle)
                .foregroundColor(WewedColors.gold)
            Text("Thank you for responding")
                .font(.title3)
                .fontWeight(.bold)
            Text("Your RSVP response has been recorded. A Wedding Pass is only available to confirmed attending guests.")
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WewedColors.ivory)
    }
}
