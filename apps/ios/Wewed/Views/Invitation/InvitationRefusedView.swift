import SwiftUI

/// What a refused invitation looks like.
///
/// Failing closed has to be visible. A link that quietly does nothing is indistinguishable from the
/// app opening normally as whoever was already signed in — and that is precisely how someone ends
/// up looking at another guest's invitation and believing it is theirs.
///
/// It deliberately says nothing about the wedding, the guest or why the credential failed. A
/// refusal that explains itself in detail is a way to probe for valid tokens.
public struct InvitationRefusedView: View {
    private let reason: InvitationRejection
    private let onDismiss: () -> Void

    public init(reason: InvitationRejection, onDismiss: @escaping () -> Void) {
        self.reason = reason
        self.onDismiss = onDismiss
    }

    public var body: some View {
        ZStack {
            WeddingIdentityPalette.ivory.ignoresSafeArea()
            AccessibilityMarker("invitation-refused", label: "This invitation link can't be opened")
            VStack(spacing: 12) {
                Text("This invitation link can't be opened")
                    .font(.system(size: 20, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .multilineTextAlignment(.center)
                // One message for every reason. Which check failed is not the guest's business,
                // and telling them would help someone guessing at links.
                Text("It may have expired, or already been used. Open the most recent invitation "
                     + "the couple sent you, or ask them to send it again.")
                    .font(.system(size: 14))
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("invitation-refused-detail")
                Button("Continue to Wewed", action: onDismiss)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(WewedColors.emerald)
                    .padding(.top, 4)
                    .accessibilityIdentifier("invitation-refused-dismiss")
            }
            .padding(32)
        }
    }
}
