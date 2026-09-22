import SwiftUI

/// The real context selector master plan §9 requires: the account holds more than one grant of the
/// same kind (typically a Planner or Coordinator on several weddings), and none is chosen on their
/// behalf. Deliberately minimal — a plain, functional list rather than a designed surface; visual
/// polish for this screen belongs to Phase 8, same as the rest of native feature parity. The
/// Android counterpart is `GrantSelectionScreen`.
public struct GrantSelectionView: View {
    let grants: [ProductionWorkspaceGrant]
    let onSelect: (String) -> Void
    let onSignOut: () -> Void

    public init(grants: [ProductionWorkspaceGrant], onSelect: @escaping (String) -> Void, onSignOut: @escaping () -> Void) {
        self.grants = grants
        self.onSelect = onSelect
        self.onSignOut = onSignOut
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Choose a wedding")
                .font(.system(size: 22, weight: .medium))
            Text("Your account has access to more than one wedding in this role. Choose which one to open.")
                .font(.system(size: 13))
                .foregroundStyle(WeddingIdentityPalette.muted)

            ForEach(grants, id: \.grantId) { grant in
                Button {
                    onSelect(grant.grantId)
                } label: {
                    Text(grant.weddingTitle ?? grant.weddingId ?? grant.grantId)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(14)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(WeddingIdentityPalette.hairline, lineWidth: 1)
                        )
                }
                .accessibilityIdentifier("grant-option-\(grant.grantId)")
            }

            Button("Sign out", action: onSignOut)
                .accessibilityIdentifier("grant-selection-sign-out")
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(WeddingIdentityPalette.ivory)
        .accessibilityIdentifier("grant-selection")
    }
}
