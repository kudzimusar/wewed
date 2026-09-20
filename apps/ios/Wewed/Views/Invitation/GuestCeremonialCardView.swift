import SwiftUI

/// The Guest's ceremonial card, for a guest who has already answered.
///
/// A guest who had replied was being sent straight past their card to the Pass. That treats the
/// invitation as a form they finished with, when it is the Couple's recognition of them and the
/// way they enter the wedding. The card stays; only what it asks changes.
///
/// A pending guest still meets `IvoryInvitationView`, which carries the RSVP. This is the same
/// ivory ground and the same ornament for everyone else — confirmed, declined, on the day, and
/// afterwards — so there is no visual seam between the states of one card.
///
/// The reveal is staged in the same restrained manner as the Wewed opening: the ornament settles,
/// the champagne edge is drawn, the monogram resolves, then the names, then the personalisation,
/// then the actions. Nothing bounces or spins. The Android counterpart uses the same stages.
public struct GuestCeremonialCardView: View {
    private let invitation: InvitationContext
    private let presentation: GuestCardPresentation
    private let countdownLabel: String?
    private let onAction: (GuestCardAction) -> Void
    private let onContinue: () -> Void

    @State private var ornament: Double = 0
    @State private var edge: Double = 0
    @State private var monogram: Double = 0
    @State private var names: Double = 0
    @State private var personal: Double = 0
    @State private var actions: Double = 0

    private static let silk = Animation.timingCurve(0.22, 0.61, 0.36, 1)

    public init(
        invitation: InvitationContext,
        presentation: GuestCardPresentation,
        countdownLabel: String?,
        onAction: @escaping (GuestCardAction) -> Void,
        onContinue: @escaping () -> Void
    ) {
        self.invitation = invitation
        self.presentation = presentation
        self.countdownLabel = countdownLabel
        self.onAction = onAction
        self.onContinue = onContinue
    }

    public var body: some View {
        ZStack {
            WeddingIdentityPalette.ivory.ignoresSafeArea()
            WeddingFloralBackground(opacity: 0.12 * ornament)

            VStack(spacing: 12) {
                WeddingMonogramBadge(names: invitation.coupleNames)
                    .opacity(monogram)

                Text(invitation.coupleNames)
                    .font(.system(size: 27, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .multilineTextAlignment(.center)
                    .opacity(names)

                Capsule()
                    .fill(WeddingIdentityPalette.champagne.opacity(0.7))
                    .frame(width: 64, height: 1)
                    .opacity(names)

                VStack(spacing: 4) {
                    Text(presentation.headline)
                        .font(.system(size: 19, weight: .medium, design: .serif))
                        .foregroundStyle(WeddingIdentityPalette.ink)
                        .multilineTextAlignment(.center)
                        .accessibilityIdentifier("guest-card-headline")

                    // The guest is named, because this card is addressed to them.
                    Text(invitation.guestName)
                        .font(.system(size: 14))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                        .accessibilityIdentifier("guest-card-guest-name")

                    if let status = presentation.statusLabel {
                        Text(status)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(WeddingIdentityPalette.forest)
                            .accessibilityIdentifier("guest-card-status")
                    }
                    if let countdownLabel {
                        Text(countdownLabel)
                            .font(.system(size: 12))
                            .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                            .accessibilityIdentifier("guest-card-countdown")
                    }
                    Text("\(invitation.venueName) · \(invitation.venueCity)")
                        .font(.system(size: 12))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                        .multilineTextAlignment(.center)
                }
                .opacity(personal)

                VStack(spacing: 8) {
                    Button { onAction(presentation.primaryAction) } label: {
                        Text(presentation.primaryAction.label)
                            .font(.system(size: 14, weight: .semibold))
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .foregroundStyle(WeddingIdentityPalette.ivorySoft)
                            .background(WeddingIdentityPalette.forest)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .accessibilityIdentifier("guest-card-primary-action")

                    ForEach(presentation.secondaryActions, id: \.self) { action in
                        Button { onAction(action) } label: {
                            Text(action.label)
                                .font(.system(size: 13))
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .foregroundStyle(WeddingIdentityPalette.ink)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(WeddingIdentityPalette.champagne, lineWidth: 1)
                                )
                        }
                        .accessibilityIdentifier("guest-card-action-\(action.rawValue.lowercased().replacingOccurrences(of: " ", with: "-"))")
                    }

                    Button("Continue", action: onContinue)
                        .font(.system(size: 13))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                        .accessibilityIdentifier("guest-card-continue")
                }
                .opacity(actions)
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 26)
            .background(WeddingIdentityPalette.ivorySoft)
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .stroke(WeddingIdentityPalette.champagne.opacity(0.55), lineWidth: 1)
            )
            .opacity(edge)
            .wewedBoundedWidth(horizontalInset: 22)
        }
        .accessibilityIdentifier("guest-ceremonial-card")
        .task { await reveal() }
    }

    private func reveal() async {
        withAnimation(.easeOut(duration: 0.82)) { ornament = 1 }
        withAnimation(Self.silk.speed(1 / 0.56)) { edge = 1 }
        try? await Task.sleep(nanoseconds: 560_000_000)
        withAnimation(Self.silk.speed(1 / 0.52)) { monogram = 1 }
        try? await Task.sleep(nanoseconds: 520_000_000)
        withAnimation(Self.silk.speed(1 / 0.56)) { names = 1 }
        try? await Task.sleep(nanoseconds: 560_000_000)
        withAnimation(Self.silk.speed(1 / 0.46)) { personal = 1 }
        try? await Task.sleep(nanoseconds: 460_000_000)
        withAnimation(Self.silk.speed(1 / 0.42)) { actions = 1 }
    }
}
