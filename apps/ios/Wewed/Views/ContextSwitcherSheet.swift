import SwiftUI

/// Explicit production context switcher (master plan Phase 6 §1, §2, §11) — reachable AFTER a
/// workspace is already open, unlike `GrantSelectionView` which only forces a pre-workspace
/// choice. Lists every grant the account currently holds, of every workspace kind: a Planner's
/// wedding A/B/C, a second axis such as Admin/system, a Coordinator's assigned wedding, and so on.
/// Selecting one calls the same `SessionStore.selectGrant` that already replaces same-kind
/// selections singularly and clears stale workspace state (§9, §14) — this sheet only makes that
/// existing, tested mechanism reachable from an open workspace, and adds no new authority logic.
/// Labels come from `WorkspaceGrantPresentation`: never an internal identifier (QRO04-UI01). The
/// Android counterpart is `WorkspaceContextSwitcherDialog`.
public struct ContextSwitcherSheet: View {
    let authority: ProductionAuthority
    let activeGrantId: String?
    let activeGateGrantId: String?
    let onSelect: (String) -> Void
    let onSelectGate: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    public init(
        authority: ProductionAuthority,
        activeGrantId: String?,
        activeGateGrantId: String? = nil,
        onSelect: @escaping (String) -> Void,
        onSelectGate: @escaping (String) -> Void = { _ in }
    ) {
        self.authority = authority
        self.activeGrantId = activeGrantId
        self.activeGateGrantId = activeGateGrantId
        self.onSelect = onSelect
        self.onSelectGate = onSelectGate
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Choose the workspace to open. Your current workspace is marked.")
                        .font(.system(size: 13))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                        .padding(.bottom, 4)
                    ForEach(authority.workspaceGrants, id: \.grantId) { grant in
                        let presentation = WorkspaceGrantPresentation(
                            grant: grant,
                            vendorNamesById: authority.vendorNamesById,
                            businessNamesById: authority.businessNamesById
                        )
                        let isCurrent = grant.grantId == activeGrantId
                        Button {
                            onSelect(grant.grantId)
                            dismiss()
                        } label: {
                            WorkspaceGrantCard(presentation: presentation, isCurrent: isCurrent)
                        }
                        .buttonStyle(.plain)
                        .disabled(isCurrent)
                        .accessibilityLabel("\(presentation.title), \(presentation.roleLabel)\(isCurrent ? ", current" : "")")
                        .accessibilityIdentifier("context-switch-option-\(grant.grantId)")
                    }
                    ForEach(authority.operationalGrants, id: \.grantId) { grant in
                        let isCurrent = grant.grantId == activeGateGrantId
                        Button {
                            onSelectGate(grant.grantId)
                            dismiss()
                        } label: {
                            WorkspaceGrantCard(
                                presentation: WorkspaceGrantPresentation.gate(gateName: grant.gateName, weddingTitle: grant.weddingTitle),
                                isCurrent: isCurrent
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(isCurrent)
                        .accessibilityIdentifier("context-switch-option-\(grant.grantId)")
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
                .wewedBoundedWidth()
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("Switch workspace")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                        .accessibilityIdentifier("context-switch-close")
                }
            }
        }
        .tint(WeddingIdentityPalette.champagneDeep)
        .accessibilityIdentifier("context-switcher")
    }
}
