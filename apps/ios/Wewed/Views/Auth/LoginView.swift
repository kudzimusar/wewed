import SwiftUI

/// Wewed sign in.
///
/// What this replaces, and why each part had to go:
///
///   * A pre-filled address and a real password compiled into the binary. Anyone with the app had
///     the credential. Shipping a password is not a convenience, it is a disclosure.
///   * "Native Mobile Division" — an internal label on the product's front door.
///   * A Couple / Usher / Planner picker. A person choosing their own role is not authentication;
///     it is self-service authorization. Role is what the server answers AFTER it knows who you are.
///
/// What remains is the whole of sign in: who you are, and proof. Everything else follows from the
/// authorization the server returns.
public struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appState: AppState

    @State private var email = ""
    @State private var password = ""
    @State private var submitting = false
    @State private var errorMessage: String?

    private let onBack: (() -> Void)?
    private let onForgotPassword: (() -> Void)?
    private let onCreateAccount: (() -> Void)?

    public init(
        onBack: (() -> Void)? = nil,
        onForgotPassword: (() -> Void)? = nil,
        onCreateAccount: (() -> Void)? = nil
    ) {
        self.onBack = onBack
        self.onForgotPassword = onForgotPassword
        self.onCreateAccount = onCreateAccount
    }

    private var canSubmit: Bool {
        !email.isEmpty && !password.isEmpty && !submitting
    }

    public var body: some View {
        ZStack {
            WeddingIdentityPalette.ivory.ignoresSafeArea()
            WeddingFloralBackground(opacity: 0.08)

            VStack(spacing: 14) {
                WewedLogo()

                Text("Welcome back")
                    .font(.system(size: 30, weight: .medium, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)

                Text("Sign in to your Wewed account")
                    .font(.system(size: 14))
                    .foregroundStyle(WeddingIdentityPalette.muted)

                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .autocorrectionDisabled()
                    #if os(iOS)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    #endif
                    .padding(14)
                    .background(WeddingIdentityPalette.ivorySoft)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(WeddingIdentityPalette.hairline, lineWidth: 1)
                    )
                    .accessibilityIdentifier("sign-in-email")
                    .onChange(of: email) { _, _ in errorMessage = nil }

                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .padding(14)
                    .background(WeddingIdentityPalette.ivorySoft)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(WeddingIdentityPalette.hairline, lineWidth: 1)
                    )
                    .accessibilityIdentifier("sign-in-password")
                    .onChange(of: password) { _, _ in errorMessage = nil }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.system(size: 12))
                        .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                        .multilineTextAlignment(.center)
                        .accessibilityIdentifier("sign-in-error")
                }

                Button {
                    submitting = true
                    errorMessage = nil
                    do {
                        // Role is deliberately NOT passed. The session resolves authorization from
                        // the identity; a caller cannot assert what it is allowed to be.
                        try session.signIn(email: email.trimmingCharacters(in: .whitespaces),
                                           password: password)
                    } catch {
                        errorMessage = error.localizedDescription
                    }
                    submitting = false
                } label: {
                    Text(submitting ? "Signing in…" : "Sign In")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .foregroundStyle(WeddingIdentityPalette.ivorySoft)
                        .background(canSubmit ? WeddingIdentityPalette.forest
                                              : WeddingIdentityPalette.forest.opacity(0.4))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .disabled(!canSubmit)
                .accessibilityIdentifier("sign-in-submit")

                if let onForgotPassword {
                    Button("Forgot password?", action: onForgotPassword)
                        .font(.system(size: 13))
                        .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                        .accessibilityIdentifier("sign-in-forgot-password")
                }

                if let onCreateAccount {
                    Button("Create an account", action: onCreateAccount)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                        .accessibilityIdentifier("sign-in-create-account")
                }

                if let onBack {
                    Button("Back", action: onBack)
                        .font(.system(size: 13))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                        .accessibilityIdentifier("sign-in-back")
                }

                // Shadow and UAT lanes need a way in without a production credential. The
                // affordance is named for what it is, appears only where persona switching is
                // already permitted, and carries no credential of any kind.
                if appState.dataEnvironment.allowsDevelopmentPersonaSwitching {
                    Button("Continue in \(appState.dataEnvironment.displayName)") {
                        session.enterShadowSession()
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .padding(.top, 4)
                    .accessibilityIdentifier("sign-in-shadow-entry")
                }
            }
            .wewedBoundedWidth(horizontalInset: 28)
        }
        .accessibilityIdentifier("sign-in-root")
    }
}
