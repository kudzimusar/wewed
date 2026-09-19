import SwiftUI

/// Sign-in never asks a person to pick a role. The account decides the roles;
/// a guest opens the app with their own invitation instead of an account.
public struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appState: AppState
    @State private var showInvitationEntry = false
    @State private var invitationCode = ""
    @State private var busy = false
    @State private var errorMessage: String?

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Spacer(minLength: 60)
                Text("WEWED")
                    .font(.system(.largeTitle, design: .serif).weight(.bold))
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                Text("Welcome. Sign in to continue.")
                    .font(.body)
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .multilineTextAlignment(.center)

                Button {
                    run {
                        try await SessionAuthority.signIn(
                            account: appState.launch.shadowAccount,
                            environment: appState.dataEnvironment,
                            wedding: appState.repository,
                            planner: appState.plannerRepository,
                            invitationToken: appState.launch.invitationToken
                        )
                    }
                } label: {
                    Text("Sign In")
                        .font(.body.weight(.bold))
                        .frame(maxWidth: .infinity, minHeight: 52)
                }
                .buttonStyle(.borderedProminent)
                .tint(WeddingIdentityPalette.champagneDeep)
                .disabled(busy)
                .accessibilityIdentifier("login-sign-in")

                if !showInvitationEntry {
                    Button {
                        invitationCode = appState.launch.invitationToken ?? ""
                        showInvitationEntry = true
                    } label: {
                        Text("I have an invitation")
                            .font(.body)
                            .frame(maxWidth: .infinity, minHeight: 52)
                    }
                    .buttonStyle(.bordered)
                    .tint(WeddingIdentityPalette.ink)
                    .disabled(busy)
                    .accessibilityIdentifier("login-open-invitation")
                } else {
                    TextField("Invitation code", text: $invitationCode)
                        .textFieldStyle(.roundedBorder)
                        .font(.body)
                        .autocorrectionDisabled()
                        #if os(iOS)
                        .textInputAutocapitalization(.never)
                        #endif
                        .accessibilityIdentifier("login-invitation-code")
                    Button {
                        run {
                            try await SessionAuthority.signInWithInvitation(
                                token: invitationCode,
                                environment: appState.dataEnvironment,
                                wedding: appState.repository
                            )
                        }
                    } label: {
                        Text("Open my invitation")
                            .font(.body.weight(.bold))
                            .frame(maxWidth: .infinity, minHeight: 52)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(WeddingIdentityPalette.forest)
                    .disabled(busy || invitationCode.trimmingCharacters(in: .whitespaces).isEmpty)
                    .accessibilityIdentifier("login-invitation-submit")
                }

                if busy {
                    ProgressView()
                }
                if let errorMessage {
                    Text(errorMessage)
                        .font(.callout)
                        .foregroundStyle(Color(red: 0.61, green: 0.11, blue: 0.11))
                        .multilineTextAlignment(.center)
                        .accessibilityIdentifier("login-error")
                }
            }
            .padding(.horizontal, 24)
        }
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .accessibilityIdentifier("login-root")
    }

    private func run(_ work: @escaping () async throws -> AuthorizedSession) {
        busy = true
        errorMessage = nil
        Task { @MainActor in
            defer { busy = false }
            do {
                session.establish(try await work())
            } catch let error as SessionAuthorityError {
                errorMessage = error.errorDescription
            } catch {
                errorMessage = "We couldn't sign you in. Please try again."
            }
        }
    }
}
