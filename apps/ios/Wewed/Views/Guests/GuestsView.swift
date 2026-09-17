import SwiftUI

public struct GuestsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var guests: [Guest] = []
    @State private var searchQuery: String = ""
    @State private var isLoading: Bool = true

    public init() {}

    private var filteredGuests: [Guest] {
        if searchQuery.trimmingCharacters(in: .whitespaces).isEmpty {
            return guests
        }
        let q = searchQuery.lowercased()
        return guests.filter {
            $0.name.lowercased().contains(q) ||
            ($0.householdName?.lowercased().contains(q) ?? false) ||
            ($0.tableName?.lowercased().contains(q) ?? false)
        }
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Attendance Summary Banner
                HStack(spacing: WewedSpacing.lg) {
                    AttendanceStat(label: "Invited", value: "\(guests.reduce(0) { $0 + $1.partySize })")
                    AttendanceStat(label: "Attending", value: "\(guests.filter { $0.rsvpStatus == .attending }.reduce(0) { $0 + $1.partySize })")
                    AttendanceStat(label: "Checked In", value: "\(guests.reduce(0) { $0 + $1.checkedInCount })")
                }
                .padding()
                .background(Color.white)
                .cornerRadius(WewedRadius.md)
                .shadow(color: Color.black.opacity(0.03), radius: 4, x: 0, y: 1)
                .padding(.horizontal)
                .padding(.top, WewedSpacing.sm)

                List {
                    ForEach(filteredGuests) { guest in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(guest.name)
                                    .font(.headline)
                                Spacer()
                                StatusChip(status: guest.rsvpStatus)
                            }

                            HStack(spacing: WewedSpacing.sm) {
                                if let household = guest.householdName {
                                    Label(household, systemImage: "person.2")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }

                                Text("Party of \(guest.partySize)")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.wewedSecondaryBackground)
                                    .cornerRadius(4)

                                if let table = guest.tableName {
                                    Label(table, systemImage: "table.furniture")
                                        .font(.caption)
                                        .foregroundColor(WewedColors.emerald)
                                }
                            }

                            if guest.checkedIn {
                                HStack(spacing: 4) {
                                    Image(systemName: "checkmark.seal.fill")
                                        .foregroundColor(WewedColors.success)
                                    Text("Checked In (\(guest.checkedInCount)/\(guest.partySize))")
                                        .font(.caption2)
                                        .fontWeight(.bold)
                                        .foregroundColor(WewedColors.success)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
                .searchable(text: $searchQuery, prompt: "Search guest name, household, or table")
            }
            .background(WewedColors.ivory)
            .navigationTitle("Guest List")
            .task {
                do {
                    guests = try await appState.repository.getGuests()
                    isLoading = false
                } catch {
                    isLoading = false
                }
            }
        }
    }
}

private struct AttendanceStat: View {
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(WewedColors.goldDark)
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct StatusChip: View {
    let status: RSVPStatus

    var body: some View {
        Text(status.title)
            .font(.caption2)
            .fontWeight(.bold)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(backgroundColor.opacity(0.15))
            .foregroundColor(backgroundColor)
            .cornerRadius(WewedRadius.pill)
    }

    private var backgroundColor: Color {
        switch status {
        case .attending: return WewedColors.success
        case .declined: return WewedColors.error
        case .pending: return WewedColors.warning
        }
    }
}
