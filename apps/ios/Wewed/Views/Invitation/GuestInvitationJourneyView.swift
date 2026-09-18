import SwiftUI

/// Canonical guest entry sequence used by the shadow-real-wedding sprint:
/// Wewed splash -> Ivory Floral Gold invitation -> RSVP -> Wedding Pass.
/// This view is intentionally isolated from the default GuestShell until local build/UI qualification.
public struct GuestInvitationJourneyView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    public let reference: GuestJourneyReference

    @State private var stage: GuestJourneyStage
    @State private var splashVisible = false
    @State private var confirmedPass: WeddingPass?

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
                ) { pass in
                    confirmedPass = pass
                    withAnimation(.easeInOut(duration: 0.35)) {
                        stage = .confirmedAttending
                    }
                } onRsvpDeclined: {
                    withAnimation(.easeInOut(duration: 0.35)) {
                        stage = .declined
                    }
                }
            case .confirmedAttending:
                ZStack(alignment: .topTrailing) {
                    WeddingReferencePassView(pass: confirmedPass)
                    Button("Done") { dismiss() }
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(.thinMaterial)
                        .clipShape(Capsule())
                        .padding()
                        .accessibilityIdentifier("guest-journey-done")
                }
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
            WeddingFloralBackground(opacity: 0.11)

            VStack(spacing: 14) {
                WeddingBrandMark()
                    .scaleEffect(splashVisible ? 1 : 0.72)
                    .rotationEffect(.degrees(splashVisible ? 0 : -10))

                Text("Wewed")
                    .font(.system(size: 42, weight: .medium, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)

                Text("PLAN  •  CONNECT  •  CELEBRATE")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(2.4)
                    .foregroundStyle(WeddingIdentityPalette.muted)

                Capsule()
                    .fill(WeddingIdentityPalette.champagne.opacity(0.72))
                    .frame(width: splashVisible ? 94 : 26, height: 1.5)

                Text("Weddings Made More Meaningful")
                    .font(.system(size: 18, design: .serif))
                    .italic()
                    .foregroundStyle(WeddingIdentityPalette.ink)
            }
            .padding(28)
            .scaleEffect(splashVisible ? 1 : 0.94)
            .offset(y: splashVisible ? 0 : 18)
            .opacity(splashVisible ? 1 : 0)
            .animation(.easeOut(duration: 0.65), value: splashVisible)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Wewed. Plan, connect, celebrate. Weddings made more meaningful.")
        .accessibilityIdentifier("guest-journey-splash")
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
            Button("Return to Wedding") { dismiss() }
                .fontWeight(.semibold)
                .foregroundColor(WewedColors.emerald)
                .padding(.top, 8)
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WewedColors.ivory)
        .accessibilityIdentifier("guest-journey-declined")
    }
}
