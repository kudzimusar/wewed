import SwiftUI

/// Shown only when an account legitimately holds more than one role. Lists only those roles.
public struct RoleChooserView: View {
    let authorizedSession: AuthorizedSession
    let onChoose: (RoleGrant) -> Void
    let onSignOut: () -> Void

    public init(authorizedSession: AuthorizedSession, onChoose: @escaping (RoleGrant) -> Void, onSignOut: @escaping () -> Void) {
        self.authorizedSession = authorizedSession
        self.onChoose = onChoose
        self.onSignOut = onSignOut
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Welcome back")
                    .font(.system(.largeTitle, design: .serif).weight(.semibold))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Text("How are you using Wewed today?")
                    .font(.title3)
                    .foregroundStyle(WeddingIdentityPalette.ink)

                ForEach(authorizedSession.grants, id: \.role) { grant in
                    Button { onChoose(grant) } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(grant.role.choiceLabel)
                                    .font(.title3.weight(.semibold))
                                    .foregroundStyle(WeddingIdentityPalette.ink)
                                Text(grant.weddingTitle)
                                    .font(.callout)
                                    .foregroundStyle(WeddingIdentityPalette.muted)
                                if grant.isTestOverlay {
                                    Text("Test access")
                                        .font(.footnote.weight(.semibold))
                                        .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                                }
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundStyle(WeddingIdentityPalette.muted)
                                .accessibilityHidden(true)
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 14)
                        .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
                        .background(WeddingIdentityPalette.ivorySoft, in: RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(WeddingIdentityPalette.hairline))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(grant.role.choiceLabel + ", " + grant.weddingTitle + (grant.isTestOverlay ? ", test access" : ""))
                    .accessibilityIdentifier("role-choice-\(grant.role.roleId)")
                }

                Button("Sign out", action: onSignOut)
                    .font(.body)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .frame(minHeight: 48)
                    .accessibilityIdentifier("role-chooser-sign-out")
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 40)
        }
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .accessibilityIdentifier("role-chooser-root")
    }
}
