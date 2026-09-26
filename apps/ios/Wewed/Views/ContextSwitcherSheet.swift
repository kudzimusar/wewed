import SwiftUI

/// Explicit production context switcher (master plan Phase 6 §1, §2, §11) — reachable AFTER a
/// workspace is already open, unlike `GrantSelectionView` which only forces a pre-workspace
/// choice. Lists every grant the account currently holds, of every workspace kind: a Planner's
/// wedding A/B/C, a second axis such as Admin/system, a Coordinator's assigned wedding, and so on.
/// Selecting one calls the same `SessionStore.selectGrant` that already replaces same-kind
/// selections singularly and clears stale workspace state (§9, §14) — this sheet only makes that
/// existing, tested mechanism reachable from an open workspace, and adds no new authority logic.
/// Deliberately minimal; full visual redesign remains Phase 8. The Android counterpart is
/// `ContextSwitcherDialog`.
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

    private func label(for grant: ProductionWorkspaceGrant) -> String {
        let kind = grant.workspaceKindWire.prefix(1).uppercased() + grant.workspaceKindWire.dropFirst()
        if grant.scopeKind == .system { return "\(kind) · Wewed platform" }
        if let title = grant.weddingTitle { return "\(kind) · \(title)" }
        if let vendorId = grant.vendorId, let vendorName = authority.vendorNamesById[vendorId] {
            return "\(kind) · \(vendorName)"
        }
        if let businessId = grant.businessAccountId, let businessName = authority.businessNamesById[businessId] {
            return "\(kind) · \(businessName)"
        }
        if let business = grant.businessAccountId { return "\(kind) · \(business)" }
        return "\(kind) · \(grant.grantId)"
    }

    public var body: some View {
        NavigationStack {
            List {
                ForEach(authority.workspaceGrants, id: \.grantId) { grant in
                    Button {
                        onSelect(grant.grantId)
                        dismiss()
                    } label: {
                        HStack {
                            Text(label(for: grant))
                                .foregroundColor(.primary)
                            Spacer()
                            if grant.grantId == activeGrantId {
                                Text("Current").font(.caption2).foregroundColor(.secondary)
                            }
                        }
                    }
                    .disabled(grant.grantId == activeGrantId)
                    .accessibilityIdentifier("context-switch-option-\(grant.grantId)")
                }
                ForEach(authority.operationalGrants, id: \.grantId) { grant in
                    Button {
                        onSelectGate(grant.grantId)
                        dismiss()
                    } label: {
                        HStack {
                            Text("Usher · \(grant.gateName) · \(grant.weddingTitle)")
                                .foregroundColor(.primary)
                            Spacer()
                            if grant.grantId == activeGateGrantId {
                                Text("Current").font(.caption2).foregroundColor(.secondary)
                            }
                        }
                    }
                    .disabled(grant.grantId == activeGateGrantId)
                    .accessibilityIdentifier("context-switch-option-\(grant.grantId)")
                }
            }
            .navigationTitle("Switch context")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .accessibilityIdentifier("context-switch-close")
                }
            }
        }
        .accessibilityIdentifier("context-switcher")
    }
}
