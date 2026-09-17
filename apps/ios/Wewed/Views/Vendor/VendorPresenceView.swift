import SwiftUI

/// Dedicated native operational surface for Wedding Day vendors.
/// Allows fast status reporting (En Route, Arrived, Service Active) and direct planner contact.
public struct VendorPresenceView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    @State private var vendors: [VendorPresence] = []
    @State private var selectedVendorId: String = "v1"
    @State private var showingContactAlert: Bool = false

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    if let vendor = vendors.first(where: { $0.id == selectedVendorId }) {
                        vendorHeaderCard(vendor: vendor)
                        statusActionSection(vendor: vendor)
                    }

                    allVendorsOverview

                    Spacer().frame(height: 30)
                }
                .padding()
            }
            .background(WewedColors.ivory)
            .navigationTitle("Vendor Operations")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                loadVendors()
            }
            .alert("Contact Planner", isPresented: $showingContactAlert) {
                Button("Call Lead Coordinator (+263 77 123 4567)") {}
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Connecting you with the lead wedding day coordinator at Imba Manor.")
            }
        }
    }

    private func vendorHeaderCard(vendor: VendorPresence) -> some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(vendor.vendorName.uppercased())
                        .font(.caption)
                        .fontWeight(.bold)
                        .tracking(1.5)
                        .foregroundColor(WewedColors.goldDark)

                    Text(vendor.serviceCategory)
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(WewedColors.textPrimaryLight)
                }
                Spacer()

                stateBadge(state: vendor.state)
            }

            Divider()

            HStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Service Area")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Text(vendor.serviceArea)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text("Expected On-Site")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Text(vendor.expectedTime)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)
    }

    private func statusActionSection(vendor: VendorPresence) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Update Your Status")
                .font(.headline)
                .foregroundColor(WewedColors.textPrimaryLight)

            VStack(spacing: 10) {
                Button {
                    updateStatus(id: vendor.id, state: .enRoute)
                } label: {
                    HStack {
                        Image(systemName: "car.fill")
                        Text("EN ROUTE TO VENUE")
                            .fontWeight(.bold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(vendor.state == .enRoute ? WewedColors.gold : Color.white)
                    .foregroundColor(vendor.state == .enRoute ? .black : WewedColors.textPrimaryLight)
                    .cornerRadius(WewedRadius.md)
                    .overlay(RoundedRectangle(cornerRadius: WewedRadius.md).stroke(WewedColors.gold, lineWidth: 1.5))
                }

                Button {
                    updateStatus(id: vendor.id, state: .arrived)
                } label: {
                    HStack {
                        Image(systemName: "mappin.and.ellipse")
                        Text("ARRIVED ON SITE")
                            .fontWeight(.bold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(vendor.state == .arrived ? WewedColors.gold : Color.white)
                    .foregroundColor(vendor.state == .arrived ? .black : WewedColors.textPrimaryLight)
                    .cornerRadius(WewedRadius.md)
                    .overlay(RoundedRectangle(cornerRadius: WewedRadius.md).stroke(WewedColors.gold, lineWidth: 1.5))
                }

                Button {
                    updateStatus(id: vendor.id, state: .serviceActive)
                } label: {
                    HStack {
                        Image(systemName: "play.circle.fill")
                        Text("START SERVICE")
                            .fontWeight(.bold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(vendor.state == .serviceActive ? WewedColors.gold : Color.white)
                    .foregroundColor(vendor.state == .serviceActive ? .black : WewedColors.textPrimaryLight)
                    .cornerRadius(WewedRadius.md)
                    .overlay(RoundedRectangle(cornerRadius: WewedRadius.md).stroke(WewedColors.gold, lineWidth: 1.5))
                }

                Button {
                    showingContactAlert = true
                } label: {
                    HStack {
                        Image(systemName: "phone.fill")
                        Text("CONTACT PLANNER")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.secondary.opacity(0.1))
                    .foregroundColor(WewedColors.textPrimaryLight)
                    .cornerRadius(WewedRadius.md)
                }
            }
        }
    }

    private var allVendorsOverview: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Day-Of Vendor Roster")
                .font(.headline)
                .foregroundColor(WewedColors.textPrimaryLight)

            ForEach(vendors) { v in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(v.vendorName)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        Text("\(v.serviceCategory) • \(v.serviceArea)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    stateBadge(state: v.state)
                }
                .padding()
                .background(Color.white)
                .cornerRadius(WewedRadius.md)
            }
        }
    }

    private func stateBadge(state: VendorPresenceState) -> some View {
        Text(state.title)
            .font(.caption2)
            .fontWeight(.bold)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(badgeBackground(state: state))
            .foregroundColor(badgeForeground(state: state))
            .cornerRadius(WewedRadius.pill)
    }

    private func badgeBackground(state: VendorPresenceState) -> Color {
        switch state {
        case .scheduled: return Color.gray.opacity(0.15)
        case .enRoute: return WewedColors.gold.opacity(0.2)
        case .arrived: return WewedColors.emerald.opacity(0.15)
        case .serviceActive: return WewedColors.success.opacity(0.2)
        case .completed: return Color.gray.opacity(0.2)
        }
    }

    private func badgeForeground(state: VendorPresenceState) -> Color {
        switch state {
        case .scheduled: return .secondary
        case .enRoute: return WewedColors.goldDark
        case .arrived: return WewedColors.emerald
        case .serviceActive: return WewedColors.success
        case .completed: return .secondary
        }
    }

    private func loadVendors() {
        Task {
            if let list = try? await appState.repository.getVendors() {
                vendors = list
            }
        }
    }

    private func updateStatus(id: String, state: VendorPresenceState) {
        Task {
            if let updated = try? await appState.repository.updateVendorState(id: id, state: state) {
                if let idx = vendors.firstIndex(where: { $0.id == id }) {
                    vendors[idx] = updated
                }
            }
        }
    }
}
