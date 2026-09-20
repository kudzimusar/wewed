import SwiftUI

public struct WeddingReferenceGuestsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var guests: [Guest] = []
    @State private var wedding: Wedding?
    @State private var query = ""
    @State private var filter: GuestReferenceFilter = .all
    @State private var showingFilters = false
    @State private var showingAddGuest = false
    @State private var selectedGuest: Guest?
    @State private var newGuestName = ""
    @State private var newGuestPartySize = 1
    @State private var isLoading = true

    public init() {}

    public var body: some View {
        NavigationStack {
            ZStack {
                WeddingFloralBackground(opacity: 0.018)

                VStack(spacing: 12) {
                    header
                    search
                    filters

                    if isLoading {
                        Spacer()
                        ProgressView("Loading guests…")
                        Spacer()
                    } else {
                        List {
                            ForEach(filteredGuests) { guest in
                                Button {
                                    selectedGuest = guest
                                } label: {
                                    guestRow(guest)
                                }
                                .buttonStyle(.plain)
                                    .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 8, trailing: 0))
                                    .listRowBackground(Color.clear)
                                    .listRowSeparator(.hidden)
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }

                    Button {
                        showingAddGuest = true
                    } label: {
                        WeddingPrimaryButtonLabel("Add Guest", icon: "plus")
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("guests-add")
                }
                .padding(.horizontal, 14)
                .padding(.top, 12)
                .padding(.bottom, 8)
            }
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .task { await load() }
            .confirmationDialog("Filter Guests", isPresented: $showingFilters, titleVisibility: .visible) {
                ForEach(GuestReferenceFilter.allCases, id: \.rawValue) { value in
                    Button(value.title) { filter = value }
                }
            }
            .sheet(isPresented: $showingAddGuest) {
                addGuestSheet
            }
            .sheet(item: $selectedGuest) { guest in
                guestDetailsSheet(guest)
            }
        }
        .accessibilityIdentifier("guests-root")
    }

    private var header: some View {
        HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                Text("Guests")
                    .font(.system(size: 28, weight: .semibold, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Text("The people who make it special.")
                    .font(.system(size: 12))
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }
                Spacer()
            if let coupleNames = wedding?.coupleNames {
                WeddingMonogramBadge(names: coupleNames, size: 58)
            }
        }
    }

    private var search: some View {
        HStack(spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(WeddingIdentityPalette.muted)
                TextField("Search guests by name…", text: $query)
                    .font(.system(size: 13))
                    .accessibilityIdentifier("guests-search")
            }
            .padding(.horizontal, 12)
            .frame(height: 42)
            .background(WeddingIdentityPalette.ivorySoft)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(WeddingIdentityPalette.hairline, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))

            Button { showingFilters = true } label: {
                Image(systemName: "line.3.horizontal.decrease")
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .frame(width: 42, height: 42)
                    .background(WeddingIdentityPalette.ivorySoft)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(WeddingIdentityPalette.hairline, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .accessibilityLabel("Guest filters")
        }
    }

    private var filters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                filterChip(.all, count: guests.count)
                filterChip(.attending, count: guests.filter { $0.rsvpStatus == .attending }.count)
                filterChip(.pending, count: guests.filter { $0.rsvpStatus == .pending }.count)
                filterChip(.declined, count: guests.filter { $0.rsvpStatus == .declined }.count)
            }
        }
    }

    private func filterChip(_ value: GuestReferenceFilter, count: Int) -> some View {
        Button {
            filter = value
        } label: {
            Text("\(value.title) (\(count))")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(filter == value ? .white : WeddingIdentityPalette.muted)
                .padding(.horizontal, 11)
                .padding(.vertical, 7)
                .background(filter == value ? WeddingIdentityPalette.forest : WeddingIdentityPalette.ivorySoft)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(WeddingIdentityPalette.hairline, lineWidth: filter == value ? 0 : 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("guests-filter-\(value.rawValue)")
    }

    private func guestRow(_ guest: Guest) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(WeddingIdentityPalette.champagne.opacity(0.18))
                    .frame(width: 42, height: 42)
                Text(initials(guest.name))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(guest.name)
                    .font(.system(size: 14, weight: .semibold, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)

                HStack(spacing: 6) {
                    Circle()
                        .fill(statusColor(guest.rsvpStatus))
                        .frame(width: 7, height: 7)
                    Text(guest.rsvpStatus.title)
                        .font(.system(size: 11))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                    Text("•")
                        .font(.caption2)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                    Text("Party of \(guest.partySize)")
                        .font(.system(size: 11))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(WeddingIdentityPalette.muted)
        }
        .padding(13)
        .background(WeddingIdentityPalette.ivorySoft)
        .overlay(
            RoundedRectangle(cornerRadius: 15)
                .stroke(WeddingIdentityPalette.hairline, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 15))
    }

    private var filteredGuests: [Guest] {
        guests.filter { guest in
            let matchesFilter: Bool
            switch filter {
            case .all: matchesFilter = true
            case .attending: matchesFilter = guest.rsvpStatus == .attending
            case .pending: matchesFilter = guest.rsvpStatus == .pending
            case .declined: matchesFilter = guest.rsvpStatus == .declined
            }

            let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
            let matchesQuery = trimmed.isEmpty ||
                guest.name.localizedCaseInsensitiveContains(trimmed) ||
                (guest.tableName?.localizedCaseInsensitiveContains(trimmed) ?? false)

            return matchesFilter && matchesQuery
        }
    }

    private var addGuestSheet: some View {
        NavigationStack {
            Form {
                Section("Guest") {
                    TextField("Guest name", text: $newGuestName)
                    Stepper("Party of \(newGuestPartySize)", value: $newGuestPartySize, in: 1...10)
                }

                Section {
                    Text("This addition stays in the local Shadow session and does not write to production.")
                        .font(.footnote)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                }
            }
            .navigationTitle("Add Guest")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        resetGuestDraft()
                        showingAddGuest = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        let trimmed = newGuestName.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !trimmed.isEmpty else { return }
                        guests.append(
                            Guest(
                                id: "shadow-local-\(UUID().uuidString)",
                                name: trimmed,
                                partySize: newGuestPartySize,
                                rsvpStatus: .pending
                            )
                        )
                        resetGuestDraft()
                        showingAddGuest = false
                    }
                    .disabled(newGuestName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityIdentifier("guests-add-save")
                }
            }
        }
    }

    private func guestDetailsSheet(_ guest: Guest) -> some View {
        NavigationStack {
            List {
                Section("Guest") {
                    LabeledContent("Name", value: guest.name)
                    LabeledContent("RSVP", value: guest.rsvpStatus.title)
                    LabeledContent("Party", value: "Party of \(guest.partySize)")
                    if let table = guest.tableName {
                        LabeledContent("Seating", value: table)
                    }
                }
            }
            .navigationTitle("Guest Details")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { selectedGuest = nil }
                }
            }
        }
    }

    private func resetGuestDraft() {
        newGuestName = ""
        newGuestPartySize = 1
    }

    private func load() async {
        do {
            async let loadedGuests = appState.scopedRepository().getGuests()
            async let loadedWedding = appState.scopedRepository().getWedding()
            guests = try await loadedGuests
            wedding = try await loadedWedding
        } catch {
            guests = []
            wedding = nil
        }
        isLoading = false
    }

    private func statusColor(_ status: RSVPStatus) -> Color {
        switch status {
        case .attending: return WeddingIdentityPalette.forest
        case .pending: return .orange
        case .declined: return .red
        }
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        return parts.prefix(2).compactMap { $0.first }.map(String.init).joined().uppercased()
    }
}

private enum GuestReferenceFilter: String, CaseIterable {
    case all
    case attending
    case pending
    case declined

    var title: String {
        switch self {
        case .all: return "All"
        case .attending: return "Attending"
        case .pending: return "Pending"
        case .declined: return "Declined"
        }
    }
}
