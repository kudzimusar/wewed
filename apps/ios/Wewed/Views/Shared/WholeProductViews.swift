import SwiftUI

// MARK: - 1. Account & Privacy View (AUTH-02)
public struct AccountPrivacyView: View {
    @State private var biometricAuthEnabled: Bool = true
    @State private var passDataSharing: Bool = false
    @State private var showingDeleteConfirmation: Bool = false

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.base) {
                // Header Banner
                VStack(alignment: .leading, spacing: 6) {
                    Text("Account & Privacy Control")
                        .font(.title3).fontWeight(.bold)
                        .foregroundColor(WewedColors.textPrimaryLight)
                    Text("Manage your personal data, biometric pass security, and account deletion requests.")
                        .font(.caption).foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                // Privacy Toggles
                VStack(alignment: .leading, spacing: 14) {
                    Text("Privacy & Security Controls").font(.headline)
                    
                    Toggle(isOn: $biometricAuthEnabled) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("FaceID / TouchID for Pass Verification")
                                .font(.subheadline).fontWeight(.medium)
                            Text("Require biometrics before displaying offline QR pass")
                                .font(.caption).foregroundColor(.secondary)
                        }
                    }
                    .tint(WewedColors.emerald)

                    Divider()

                    Toggle(isOn: $passDataSharing) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Share Pass Data with Verified Vendors")
                                .font(.subheadline).fontWeight(.medium)
                            Text("Allows catering and photography to scan pass preferences")
                                .font(.caption).foregroundColor(.secondary)
                        }
                    }
                    .tint(WewedColors.emerald)
                }
                .padding()
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                // Data Portability & Account Erasure
                VStack(alignment: .leading, spacing: 12) {
                    Text("Data Ownership & GDPR").font(.headline)
                    
                    Button {
                        // Export action
                    } label: {
                        HStack {
                            Image(systemName: "square.and.arrow.up")
                                .foregroundColor(WewedColors.gold)
                            Text("Download My Personal Data Archive")
                                .font(.subheadline).fontWeight(.medium)
                                .foregroundColor(WewedColors.textPrimaryLight)
                            Spacer()
                            Image(systemName: "chevron.right").font(.caption).foregroundColor(.secondary)
                        }
                    }

                    Divider()

                    Button {
                        showingDeleteConfirmation = true
                    } label: {
                        HStack {
                            Image(systemName: "trash.fill")
                                .foregroundColor(.red)
                            Text("Request Permanent Account Deletion")
                                .font(.subheadline).fontWeight(.semibold)
                                .foregroundColor(.red)
                            Spacer()
                        }
                    }
                }
                .padding()
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Account & Privacy")
        .alert("Request Account Deletion", isPresented: $showingDeleteConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Confirm Erasure Request", role: .destructive) {}
        } message: {
            Text("This will queue your account and associated credentials for permanent erasure in accordance with privacy laws.")
        }
    }
}

// MARK: - 2. Wedding & Business Context Switcher (WEDD-01)
//
// The weddings an actor may switch between are a server answer about that actor (master plan
// Phases 2, 5 and 6). There is no such source in this build, so this says so. It used to list one
// hardcoded real wedding — the same one for every actor — as if it were the actor's portfolio
// (master plan §8.13).
public struct WeddingContextSwitcherView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("Active Wedding & Event Context")
                    .font(.headline)
                Text("Wedding switching is not connected in this build. The weddings you can open come from your Wewed account, and no account authority is available here.")
                    .font(.caption).foregroundColor(.secondary)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white)
            .cornerRadius(WewedRadius.lg)
            .padding()
            .accessibilityIdentifier("wedding-context-switcher-unavailable")
        }
        .background(WewedColors.ivory)
        .navigationTitle("Event Switcher")
    }
}

// MARK: - 4. Messages & Dynamic Shared Inbox (COMM-01)
public struct MessagesInboxView: View {
    public init() {}

    // P0-14 fixture leak: this view previously hard-coded a planner conversation with a
    // timestamp, which read as a real thread. No message or thread entity exists in the wedding
    // graph in any Shadow environment, so the honest answer is that the capability is unsupported.
    public var body: some View {
        VStack(spacing: 6) {
            Text("Messages")
                .font(.system(size: 18, weight: .semibold, design: .serif))
                .foregroundColor(WeddingIdentityPalette.ink)
            Text("Native messaging has no contract in this environment. No conversations are recorded in the wedding graph, so none are shown.")
                .font(.system(size: 12))
                .foregroundColor(WeddingIdentityPalette.muted)
                .multilineTextAlignment(.center)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WeddingIdentityPalette.ivory)
        .accessibilityIdentifier("messages-unsupported")
    }
}

private struct MessageThreadRow: View {
    let sender: String
    let preview: String
    let time: String
    let unreadCount: Int

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(WewedColors.gold.opacity(0.2)).frame(width: 44, height: 44)
                Text(String(sender.prefix(1)))
                    .font(.headline).fontWeight(.bold).foregroundColor(WewedColors.goldDark)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(sender).font(.subheadline).fontWeight(.semibold)
                Text(preview).font(.caption).foregroundColor(.secondary).lineLimit(1)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(time).font(.caption2).foregroundColor(.secondary)
                if unreadCount > 0 {
                    Text("\(unreadCount)")
                        .font(.caption2).fontWeight(.bold)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(WewedColors.emerald).foregroundColor(.white)
                        .clipShape(Capsule())
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
    }
}

// MARK: - 5. Notifications Center (COMM-02)
public struct NotificationsCenterView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Text("No notifications recorded.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding()
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Notifications")
    }
}

// MARK: - 7. Settings & Profile Management (SETT-01)
public struct SettingsView: View {
    @EnvironmentObject private var session: SessionStore

    public init() {}

    public var body: some View {
        // Only what the session actually holds. No invented account name or membership line: an
        // unresolved identity is shown as unresolved (master plan Rule 5).
        let name = session.activePersona?.name ?? session.currentUserName ?? "Identity not resolved"
        let subtitle = session.activePersona?.subtitle ?? ""
        let roleTitle = session.activePersona?.role.title ?? session.currentRole?.title ?? "No workspace role"

        return ScrollView {
            VStack(spacing: WewedSpacing.base) {
                // User Profile Header
                HStack(spacing: 14) {
                    ZStack {
                        Circle().fill(WewedColors.gold.opacity(0.2)).frame(width: 54, height: 54)
                        Text(String(name.prefix(1)))
                            .font(.title2).fontWeight(.bold).foregroundColor(WewedColors.goldDark)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(name)
                            .font(.headline).fontWeight(.bold)
                        Text(subtitle)
                            .font(.caption).foregroundColor(.secondary)
                        Text(roleTitle)
                            .font(.caption2).fontWeight(.bold).foregroundColor(WewedColors.gold)
                    }
                    Spacer()
                }
                .padding()
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                // Settings Navigation List
                VStack(spacing: 0) {
                    NavigationLink {
                        AccountPrivacyView()
                    } label: {
                        SettingsRow(icon: "shield.fill", title: "Account & Privacy Controls")
                    }
                    Divider()

                    NavigationLink {
                        NotificationsCenterView()
                    } label: {
                        SettingsRow(icon: "bell.fill", title: "Notifications Preferences")
                    }
                    Divider()

                    NavigationLink {
                        WeddingContextSwitcherView()
                    } label: {
                        SettingsRow(icon: "arrow.triangle.2.circlepath", title: "Event & Workspace Context")
                    }
                }
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Settings")
    }
}

private struct SettingsRow: View {
    let icon: String
    let title: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(WewedColors.gold)
                .frame(width: 24)
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(WewedColors.textPrimaryLight)
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundColor(.secondary)
        }
        .padding()
    }
}

