import SwiftUI

/// The Shadow/UAT way in, named for what it is and carrying no credential.
public struct ShadowEntryOption {
    public let environmentName: String
    public let onEnter: () -> Void

    public init(environmentName: String, onEnter: @escaping () -> Void) {
        self.environmentName = environmentName
        self.onEnter = onEnter
    }
}

/// The first surface a new installation shows.
///
/// Opening the app used to land straight on a sign-in form carrying a pre-filled address and
/// password, three role chips and the words "Native Mobile Division". That is an internal build's
/// front door. It also assumed the only reason to open Wewed is to sign in, which is untrue: the
/// most common first contact is an invitation.
///
/// Three doors, in the order people actually arrive:
///
///   I Have an Invitation   — the guest path, which needs no account at all
///   Sign In                — an existing Wewed account
///   Create Account         — a couple or a professional starting out
///
/// No role is chosen here. Role is an authorization result, not a self-service selection.
public struct WewedWelcomeView: View {
    private let onOpenInvitation: () -> Void
    private let onSignIn: () -> Void
    private let onCreateAccount: () -> Void
    private let shadowEntry: ShadowEntryOption?

    public init(
        onOpenInvitation: @escaping () -> Void,
        onSignIn: @escaping () -> Void,
        onCreateAccount: @escaping () -> Void,
        shadowEntry: ShadowEntryOption? = nil
    ) {
        self.onOpenInvitation = onOpenInvitation
        self.onSignIn = onSignIn
        self.onCreateAccount = onCreateAccount
        self.shadowEntry = shadowEntry
    }

    public var body: some View {
        ZStack {
            WeddingIdentityPalette.ivory.ignoresSafeArea()
            WeddingFloralBackground(opacity: 0.09)

            VStack(spacing: 12) {
                WewedLogo()

                Text("Wewed")
                    .font(.system(size: 38, weight: .medium, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)

                Text("Weddings Made More Meaningful")
                    .font(.system(size: 15, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .multilineTextAlignment(.center)

                Capsule()
                    .fill(WeddingIdentityPalette.champagne.opacity(0.72))
                    .frame(width: 72, height: 1.5)
                    .padding(.vertical, 10)

                // The invitation door comes first, and is the emphasised one: an invited guest is
                // the most common first-time arrival, and they must never be asked for an account.
                Button(action: onOpenInvitation) {
                    Text("I Have an Invitation")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .foregroundStyle(WeddingIdentityPalette.ivorySoft)
                        .background(WeddingIdentityPalette.forest)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .accessibilityIdentifier("welcome-have-invitation")

                Button(action: onSignIn) {
                    Text("Sign In")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .foregroundStyle(WeddingIdentityPalette.ink)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(WeddingIdentityPalette.champagne, lineWidth: 1)
                        )
                }
                .accessibilityIdentifier("welcome-sign-in")

                Button(action: onCreateAccount) {
                    Text("Create Account")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                }
                .accessibilityIdentifier("welcome-create-account")

                if let shadowEntry {
                    Button(action: shadowEntry.onEnter) {
                        Text("Continue in \(shadowEntry.environmentName)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(WeddingIdentityPalette.muted)
                    }
                    .padding(.top, 6)
                    .accessibilityIdentifier("welcome-shadow-entry")
                }
            }
            .wewedBoundedWidth(horizontalInset: 28)
        }
        .accessibilityIdentifier("welcome-root")
    }
}
