import SwiftUI

/// Minimal Phase-5 production surface. It renders only the real, server-revalidated workspace
/// snapshot. Full task/budget/guest/vendor parity belongs to Phase 8.
public struct ProductionReadOnlyWorkspaceContent: View {
    let snapshot: ProductionWorkspaceSnapshot
    let destination: PrimaryDestination?
    let onSignOut: (() -> Void)?

    public init(
        snapshot: ProductionWorkspaceSnapshot,
        destination: PrimaryDestination? = nil,
        onSignOut: (() -> Void)? = nil
    ) {
        self.snapshot = snapshot
        self.destination = destination
        self.onSignOut = onSignOut
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text(destination?.label ?? "Wewed workspace")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(WeddingIdentityPalette.ink)

                Text("\(snapshot.workspaceKind.capitalized) · \(snapshot.scopeKind)")
                    .font(.system(size: 12))
                    .foregroundStyle(WeddingIdentityPalette.muted)

                if let wedding = snapshot.wedding {
                    ReadOnlyRow(label: "Wedding", value: wedding.coupleNames.isEmpty ? wedding.title : wedding.coupleNames)
                    ReadOnlyRow(label: "Date", value: wedding.date)
                    ReadOnlyRow(
                        label: "Venue",
                        value: [wedding.venue, wedding.venueCity, wedding.venueCountry]
                            .filter { !$0.isEmpty }
                            .joined(separator: ", ")
                    )
                    ReadOnlyRow(label: "Lifecycle", value: wedding.lifecycle)
                } else {
                    if let business = snapshot.businessName ?? snapshot.businessAccountId {
                        ReadOnlyRow(label: "Business", value: business)
                    }
                    if snapshot.scopeKind == "system" {
                        ReadOnlyRow(label: "Scope", value: "Wewed platform")
                    }
                }

                if !snapshot.permissions.isEmpty {
                    ReadOnlyRow(label: "Permissions", value: snapshot.permissions.joined(separator: ", "))
                }
                if !snapshot.platformRoles.isEmpty {
                    ReadOnlyRow(label: "Platform role", value: snapshot.platformRoles.joined(separator: ", "))
                }

                Text("Read-only production access. Detailed \(destination?.label ?? "workspace") data is enabled in the feature-parity phase.")
                    .font(.system(size: 12))
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .accessibilityIdentifier("production-readonly-boundary")

                if let onSignOut {
                    Button("Sign out", action: onSignOut)
                        .accessibilityIdentifier("production-readonly-sign-out")
                }
            }
            .padding(20)
        }
        .background(WeddingIdentityPalette.ivory)
        .accessibilityIdentifier("production-readonly-workspace")
    }
}

private struct ReadOnlyRow: View {
    let label: String
    let value: String

    var body: some View {
        if !value.isEmpty {
            VStack(alignment: .leading, spacing: 3) {
                Text(label)
                    .font(.system(size: 11))
                    .foregroundStyle(WeddingIdentityPalette.muted)
                Text(value)
                    .font(.system(size: 14))
                    .foregroundStyle(WeddingIdentityPalette.ink)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(WeddingIdentityPalette.ivorySoft)
        }
    }
}
