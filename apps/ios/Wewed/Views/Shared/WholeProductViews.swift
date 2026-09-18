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
public struct WeddingContextSwitcherView: View {
    @State private var selectedWeddingId: String = "cmqos70cb0004q6vxe9g9aiu5"

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.base) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Active Wedding & Event Context")
                        .font(.headline)
                    Text("Active wedding project on verified ledger.")
                        .font(.caption).foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                VStack(spacing: 10) {
                    WeddingContextCard(id: "cmqos70cb0004q6vxe9g9aiu5", couple: "Charity & Kudzie", date: "23 December 2026", venue: "Imba Manor, Harare", role: "Primary Couple", isSelected: selectedWeddingId == "cmqos70cb0004q6vxe9g9aiu5") {
                        selectedWeddingId = "cmqos70cb0004q6vxe9g9aiu5"
                    }
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Event Switcher")
    }
}

private struct WeddingContextCard: View {
    let id: String
    let couple: String
    let date: String
    let venue: String
    let role: String
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(couple).font(.subheadline).fontWeight(.bold).foregroundColor(WewedColors.textPrimaryLight)
                    Text("\(date) • \(venue)").font(.caption).foregroundColor(.secondary)
                    Text(role).font(.caption2).fontWeight(.semibold).foregroundColor(WewedColors.gold)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title3)
                        .foregroundColor(WewedColors.emerald)
                }
            }
            .padding()
            .background(Color.white)
            .cornerRadius(WewedRadius.md)
            .overlay(
                RoundedRectangle(cornerRadius: WewedRadius.md)
                    .stroke(isSelected ? WewedColors.emerald : Color.clear, lineWidth: 2)
            )
        }
    }
}

// MARK: - 3. Marketplace Directory & Search (PLAN-05)
public struct MarketplaceDirectoryView: View {
    @State private var searchQuery: String = ""
    @State private var selectedCategory: String = "All"

    private let categories = ["All", "Planners", "Photographers", "Catering", "Florals", "Venues", "DJs"]

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.base) {
                // Search Field
                HStack {
                    Image(systemName: "magnifyingglass").foregroundColor(.secondary)
                    TextField("Search verified vendors & venues...", text: $searchQuery)
                }
                .padding()
                .background(Color.white)
                .cornerRadius(WewedRadius.md)

                // Category Chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(categories, id: \.self) { cat in
                            Button {
                                selectedCategory = cat
                            } label: {
                                Text(cat)
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .background(selectedCategory == cat ? WewedColors.gold : Color.white)
                                    .foregroundColor(selectedCategory == cat ? .black : WewedColors.textPrimaryLight)
                                    .cornerRadius(WewedRadius.pill)
                            }
                        }
                    }
                }

                // Provider Listings (Verified Vendors from Graph)
                VStack(spacing: 12) {
                    MarketplaceCard(name: "Eleven Eleven Testing", category: "Planners", rating: "5.00", price: "$$$", location: "Harare, Zimbabwe")
                    MarketplaceCard(name: "Imba Manor", category: "Venues", rating: "5.00", price: "$$$$", location: "Glen Lorne, Harare")
                    MarketplaceCard(name: "FAUME MEDIA", category: "Photographers", rating: "4.95", price: "$$$", location: "Harare, Zimbabwe")
                    MarketplaceCard(name: "The Glass Petal Atelier", category: "Florals", rating: "4.90", price: "$$", location: "Harare, Zimbabwe")
                    MarketplaceCard(name: "Cake Gourmet", category: "Catering", rating: "4.85", price: "$$", location: "Harare, Zimbabwe")
                    MarketplaceCard(name: "MC Aloe The Avangelist", category: "DJs", rating: "5.00", price: "$$", location: "Harare, Zimbabwe")
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Marketplace Directory")
    }
}

private struct MarketplaceCard: View {
    let name: String
    let category: String
    let rating: String
    let price: String
    let location: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(name).font(.subheadline).fontWeight(.bold)
                Text("\(category) • \(location)").font(.caption).foregroundColor(.secondary)
                HStack(spacing: 6) {
                    HStack(spacing: 2) {
                        Image(systemName: "star.fill").font(.caption2).foregroundColor(WewedColors.gold)
                        Text(rating).font(.caption2).fontWeight(.semibold)
                    }
                    Text("•").font(.caption2).foregroundColor(.secondary)
                    Text(price).font(.caption2).fontWeight(.bold).foregroundColor(WewedColors.emerald)
                }
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundColor(.secondary)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
    }
}

// MARK: - 4. Messages & Dynamic Shared Inbox (COMM-01)
public struct MessagesInboxView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                MessageThreadRow(sender: "Eleven Eleven Testing (Lead Planner)", preview: "Planning coordination for Charity & Kudzie active.", time: "10:42 AM", unreadCount: 1)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Messages & Inbox")
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

// MARK: - 6. Master Calendar & Availability (CALN-01)
public struct MasterCalendarView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.base) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Master Schedule & Milestones")
                        .font(.headline)
                    Text("Verified task deadlines, vendor deliveries, and wedding date.")
                        .font(.caption).foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                VStack(spacing: 10) {
                    CalendarEventRow(date: "DEC 22", title: "Florist Delivery & Setup", location: "Imba Manor", category: "Vendor Delivery")
                    CalendarEventRow(date: "DEC 23", title: "WEDDING DAY — CHARITY & KUDZIE", location: "Imba Manor, Harare", category: "WEDDING")
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Master Calendar")
    }
}

private struct CalendarEventRow: View {
    let date: String
    let title: String
    let location: String
    let category: String

    var body: some View {
        HStack(spacing: 14) {
            VStack(spacing: 2) {
                Text(date)
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(WewedColors.goldDark)
            }
            .frame(width: 60)
            .padding(.vertical, 8)
            .background(WewedColors.gold.opacity(0.15))
            .cornerRadius(WewedRadius.sm)

            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline).fontWeight(.semibold)
                Text("\(location) • \(category)").font(.caption).foregroundColor(.secondary)
            }
            Spacer()
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
    }
}

// MARK: - 7. Settings & Profile Management (SETT-01)
public struct SettingsView: View {
    @EnvironmentObject private var session: SessionStore

    public init() {}

    public var body: some View {
        let name = session.activePersona?.name ?? session.currentUserName ?? "Active User"
        let subtitle = session.activePersona?.subtitle ?? "Wewed Mobile Member"
        let roleTitle = session.activePersona?.role.title ?? session.currentRole.title

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

// MARK: - 8. Vendor Catalog & Document Management (VBIZ-01)
public struct VendorCatalogView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.base) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Vendor Catalog & Insurance Vault")
                        .font(.headline)
                    Text("Manage active packages, liability insurance, and tax documents.")
                        .font(.caption).foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                VStack(spacing: 10) {
                    VendorDocRow(title: "Public Liability Insurance Policy", expiry: "Valid thru Dec 2026", status: "Verified")
                    VendorDocRow(title: "Zimbabwe Tax Clearance Certificate", expiry: "ITF262 Active", status: "Verified")
                    VendorDocRow(title: "Master Services & Rate Sheet v2", expiry: "2026/2027 Season", status: "Published")
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Vendor Catalog")
    }
}

private struct VendorDocRow: View {
    let title: String
    let expiry: String
    let status: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline).fontWeight(.semibold)
                Text(expiry).font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            Text(status)
                .font(.caption2).fontWeight(.bold)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(WewedColors.emerald.opacity(0.15))
                .foregroundColor(WewedColors.emerald)
                .cornerRadius(WewedRadius.pill)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
    }
}

// MARK: - 9. Admin Operations & Governance (ADMN-01)
public struct AdminGovernanceView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.base) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("System Governance & Audit Console")
                        .font(.headline)
                    Text("Mobile administrative override, key rotation, and tenant isolation inspection.")
                        .font(.caption).foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                VStack(spacing: 10) {
                    AdminStatRow(label: "ECDSA Pass Key Anchor", value: "ww2-2026-prod (Active)", color: WewedColors.emerald)
                    AdminStatRow(label: "Offline Sync Queues", value: "0 stuck messages across 8 weddings", color: WewedColors.gold)
                    AdminStatRow(label: "System Security Level", value: "Strict ECDSA P-256 Enforced", color: WewedColors.emerald)
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Admin Governance")
    }
}

private struct AdminStatRow: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.caption).foregroundColor(.secondary)
                Text(value).font(.subheadline).fontWeight(.bold).foregroundColor(color)
            }
            Spacer()
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
    }
}
