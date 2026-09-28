import SwiftUI

/// The real context selector master plan §9 requires: the account holds more than one grant of the
/// same kind (typically a Planner or Coordinator on several weddings), and none is chosen on their
/// behalf. Labels come from `WorkspaceGrantPresentation`, so an internal identifier (grantId,
/// businessAccountId, vendorId, UUID) is never shown (QRO04-UI01). The Android counterpart is
/// `WorkspaceGrantSelectionScreen`.
public struct GrantSelectionView: View {
    let grants: [ProductionWorkspaceGrant]
    let vendorNamesById: [String: String]
    let businessNamesById: [String: String]
    let onSelect: (String) -> Void
    let onSignOut: () -> Void

    public init(
        grants: [ProductionWorkspaceGrant],
        vendorNamesById: [String: String] = [:],
        businessNamesById: [String: String] = [:],
        onSelect: @escaping (String) -> Void,
        onSignOut: @escaping () -> Void
    ) {
        self.grants = grants
        self.vendorNamesById = vendorNamesById
        self.businessNamesById = businessNamesById
        self.onSelect = onSelect
        self.onSignOut = onSignOut
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("WEWED")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(2.4)
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                Text("Choose your workspace")
                    .font(.system(size: 28, weight: .medium, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Text("Your account can open more than one workspace. Choose where you'd like to begin — you can switch at any time.")
                    .font(.system(size: 14))
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(spacing: 10) {
                    ForEach(grants, id: \.grantId) { grant in
                        let presentation = WorkspaceGrantPresentation(
                            grant: grant, vendorNamesById: vendorNamesById, businessNamesById: businessNamesById
                        )
                        Button { onSelect(grant.grantId) } label: {
                            WorkspaceGrantCard(presentation: presentation, isCurrent: false)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(presentation.title), \(presentation.roleLabel)")
                        .accessibilityIdentifier("grant-option-\(grant.grantId)")
                    }
                }
                .padding(.top, 6)

                Button(action: onSignOut) {
                    Text("Sign out")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(WeddingIdentityPalette.ink)
                        .frame(maxWidth: .infinity, minHeight: 46)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(WeddingIdentityPalette.hairline, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .padding(.top, 8)
                .accessibilityIdentifier("grant-selection-sign-out")
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 28)
            .wewedBoundedWidth()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .accessibilityIdentifier("grant-selection")
    }
}

/// One workspace option in the Wewed visual language: ivory card, champagne edge, role chip,
/// human-readable title and scope line, explicit "Current" marker.
struct WorkspaceGrantCard: View {
    let presentation: WorkspaceGrantPresentation
    let isCurrent: Bool

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(presentation.roleLabel.uppercased())
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(WeddingIdentityPalette.champagne.opacity(0.16))
                    .clipShape(Capsule())
                Text(presentation.title)
                    .font(.system(size: 18, weight: .medium, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.forest)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Text(presentation.scopeLabel)
                    .font(.system(size: 12))
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }
            Spacer(minLength: 8)
            if isCurrent {
                Text("Current")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(WeddingIdentityPalette.forest)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(WeddingIdentityPalette.forestSoft)
                    .clipShape(Capsule())
            } else {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(WeddingIdentityPalette.ivorySoft)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(isCurrent ? WeddingIdentityPalette.forest.opacity(0.55) : WeddingIdentityPalette.champagne.opacity(0.55),
                        lineWidth: isCurrent ? 1.5 : 1)
        )
        .shadow(color: WeddingIdentityPalette.champagneDeep.opacity(0.06), radius: 6, x: 0, y: 2)
        .contentShape(Rectangle())
    }
}
