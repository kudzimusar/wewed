import SwiftUI

// Planner tabs besides Workspace: Daily Ops, Wedding Day and More (client profile, team hub,
// invitations & QR, intelligence, account, help). All data comes from WeddingPlanModel (RoleScopedAccess).

// MARK: - Daily Ops

struct PlannerDailyOpsView: View {
    @ObservedObject var model: WeddingPlanModel

    var body: some View {
        let ops = PlannerInsights.dailyOps(model.data, today: Date())
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if model.failures.contains(.tasks) {
                        LoadFailureText("tasks")
                    }
                    taskGroup("Overdue tasks", ops.overdue, empty: "No open tasks are overdue.", id: "daily-ops-overdue")
                    taskGroup("Due in the next 7 days", ops.dueSoon, empty: "No open tasks are due in the next 7 days.", id: "daily-ops-due-soon")
                    taskGroup("High-priority tasks still open", ops.highPriorityOpen, empty: "No high-priority tasks are open.", id: "daily-ops-high-priority")

                    SectionHeading("Guests who have not replied")
                    PlainCard {
                        Text(ops.totalGuests == 0
                             ? "No guests recorded for this wedding."
                             : "\(ops.guestsNotReplied) of \(PlainStatus.plural(ops.totalGuests, "guest")) have not replied.")
                            .font(.body)
                            .foregroundStyle(WeddingIdentityPalette.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .accessibilityIdentifier("daily-ops-not-replied")

                    SectionHeading("Vendor presence")
                    if model.data.presence.isEmpty && model.hasLoaded {
                        EmptyStateText("No vendors recorded for this wedding.", identifier: "daily-ops-presence-empty")
                    }
                    ForEach(model.data.presence) { vendor in
                        PresenceRow(vendor: vendor)
                    }
                }
                .padding(16)
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("Daily Ops")
            .refreshable { await model.load() }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-daily-ops-root")
    }

    @ViewBuilder
    private func taskGroup(_ title: String, _ tasks: [PlannerTask], empty: String, id: String) -> some View {
        SectionHeading("\(title) (\(tasks.count))")
        if tasks.isEmpty {
            EmptyStateText(empty, identifier: "\(id)-empty")
        }
        ForEach(tasks) { task in
            TaskRowContent(task: task, showsToggle: false, busy: false, onToggle: {})
                .worksheetRowCard()
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("\(id)-\(task.id)")
        }
    }
}

// MARK: - Wedding Day

struct PlannerWeddingDayView: View {
    @ObservedObject var model: WeddingPlanModel
    @ObservedObject var gate: GateModel
    @State private var showingScanner = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    SectionHeading("Check-in")
                    if let summary = model.admission {
                        AdmissionSummaryCard(summary: summary)
                    } else if model.failures.contains(.admission) {
                        LoadFailureText("check-in figures")
                    }
                    Button {
                        showingScanner = true
                    } label: {
                        Label("Scan pass", systemImage: "qrcode.viewfinder")
                    }
                    .buttonStyle(WeddingActionButtonStyle(.primary))
                    .disabled(!model.access.can(.scanAdmission))
                    .accessibilityIdentifier("planner-scan-pass")

                    SectionHeading("Run sheet")
                    ProgrammeList(entries: model.data.programme, emptyIdentifier: "planner-run-sheet-empty")

                    SectionHeading("Tables")
                    if model.data.seating.isEmpty && model.hasLoaded {
                        EmptyStateText("No tables recorded for this wedding.", identifier: "planner-tables-empty")
                    } else {
                        let capacity = model.data.seating.reduce(0) { $0 + $1.capacity }
                        let assigned = model.data.seating.reduce(0) { $0 + $1.assigned }
                        Text("\(PlainStatus.plural(model.data.seating.count, "table")): \(assigned) of \(capacity) seats assigned, \(max(capacity - assigned, 0)) free")
                            .font(.body)
                            .foregroundStyle(WeddingIdentityPalette.ink)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("planner-tables-summary")
                        ForEach(model.data.seating) { table in
                            SeatingRowContent(table: table)
                                .worksheetRowCard()
                                .accessibilityElement(children: .combine)
                        }
                    }
                }
                .padding(16)
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("Wedding Day")
            .refreshable { await model.load() }
            .sheet(isPresented: $showingScanner, onDismiss: {
                Task { await model.refreshAdmission() }
            }) {
                UsherScannerView(model: gate) { showingScanner = false }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-wedding-day-root")
    }
}

// MARK: - More

struct PlannerMoreView: View {
    @ObservedObject var model: WeddingPlanModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 10) {
                    link("Client Profile", subtitle: "Couple, date, venue and details", icon: "person.2", id: "planner-more-client-profile") {
                        PlannerClientProfileView(model: model)
                    }
                    link("Team Hub", subtitle: "People working on this wedding", icon: "person.3", id: "planner-more-team-hub") {
                        PlannerTeamHubView(model: model)
                    }
                    link("Invitations & QR", subtitle: "Replies, passes and guest list", icon: "qrcode", id: "planner-more-invitations") {
                        PlannerInvitationsView(model: model)
                    }
                    link("Intelligence", subtitle: "Suggestions from this wedding's data", icon: "lightbulb", id: "planner-more-intelligence") {
                        PlannerIntelligenceView(model: model)
                    }
                    link("Account", subtitle: "Signed-in person, role and sign out", icon: "person.crop.circle", id: "planner-more-account") {
                        AccountView(grant: model.grant)
                    }
                    link("Help & Support", subtitle: "Contact Wewed support", icon: "questionmark.circle", id: "planner-more-support") {
                        HelpSupportView()
                    }
                }
                .padding(16)
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("More")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-more-root")
    }

    private func link<Destination: View>(
        _ title: String,
        subtitle: String,
        icon: String,
        id: String,
        @ViewBuilder destination: @escaping () -> Destination
    ) -> some View {
        NavigationLink {
            destination()
        } label: {
            MenuRowLabel(title, subtitle: subtitle, systemImage: icon)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }
}

private func lifecycleText(_ raw: String) -> String {
    switch raw.lowercased() {
    case "before": return "Before the wedding"
    case "during", "day_of", "wedding_day": return "Wedding day"
    case "after": return "After the wedding"
    default: return PlainStatus.label(raw)
    }
}

struct PlannerClientProfileView: View {
    @ObservedObject var model: WeddingPlanModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let wedding = model.data.wedding {
                    PlainCard {
                        VStack(alignment: .leading, spacing: 12) {
                            InfoLine("Couple", wedding.coupleNames, identifier: "client-profile-couple-value")
                            InfoLine("Date", WeddingDateText.longWithTime(wedding.date))
                            InfoLine("Venue", wedding.venueName)
                            InfoLine("City", wedding.city.isEmpty ? "Not recorded" : wedding.city)
                            InfoLine("Country", wedding.country.isEmpty ? "Not recorded" : wedding.country)
                            InfoLine("Stage", lifecycleText(wedding.lifecycle))
                            OpenInMapsButton(venue: wedding.venueLocation, identifier: "client-profile-open-maps")
                        }
                    }
                } else if model.failures.contains(.wedding) {
                    LoadFailureText("the wedding")
                } else {
                    ProgressView()
                }

                PlainCard {
                    InfoLine("Planner relationship", model.grant.provenanceNote)
                }
                .accessibilityIdentifier("client-profile-relationship")

                if model.access.can(.editWeddingDetails) {
                    NavigationLink {
                        ClientProfileEditor(model: model)
                    } label: {
                        Label("Edit wedding details", systemImage: "pencil")
                            .frame(maxWidth: .infinity, minHeight: 48)
                    }
                    .buttonStyle(WeddingActionButtonStyle(.secondary))
                    .accessibilityIdentifier("client-profile-edit")
                }
            }
            .padding(16)
        }
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .navigationTitle("Client Profile")
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-client-profile-root")
    }
}

struct PlannerTeamHubView: View {
    @ObservedObject var model: WeddingPlanModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                EmptyStateText("No team members have been added to this wedding.", identifier: "team-hub-empty")
                PlainCard {
                    InfoLine("Planner relationship", model.grant.provenanceNote)
                }
                .accessibilityIdentifier("team-hub-relationship")
            }
            .padding(16)
        }
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .navigationTitle("Team Hub")
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-team-hub-root")
    }
}

struct PlannerInvitationsView: View {
    @ObservedObject var model: WeddingPlanModel
    @State private var preview: WeddingPass?
    @State private var loadingGuest: String?
    @State private var errorText: String?
    @State private var shareFile: ShareableFile?

    var body: some View {
        let guests = model.data.guests
        let attending = guests.filter { $0.rsvpStatus == .attending }
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if model.failures.contains(.guests) {
                    LoadFailureText("the guest list")
                }
                PlainCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Replies")
                            .font(.headline)
                        Text("Replied yes: \(attending.count)")
                        Text("Replied no: \(guests.filter { $0.rsvpStatus == .declined }.count)")
                        Text("Not replied: \(guests.filter { $0.rsvpStatus == .pending }.count)")
                    }
                    .font(.body)
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .accessibilityElement(children: .combine)
                }
                .accessibilityIdentifier("invitations-rsvp-counts")

                Button {
                    do {
                        shareFile = try ShareFiles.write(WorksheetCsv.guests(guests), named: PlannerWorksheet.guests.exportFileName)
                    } catch {
                        errorText = "The guest list file couldn't be prepared."
                    }
                } label: {
                    Label("Export guest list", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(WeddingActionButtonStyle(.secondary))
                .disabled(guests.isEmpty)
                .accessibilityIdentifier("invitations-export-guests")

                if let errorText {
                    StatusText(errorText, systemImage: "exclamationmark.triangle.fill", tone: .negative)
                }

                SectionHeading("Attending guests")
                if attending.isEmpty && model.hasLoaded {
                    EmptyStateText("No guest has accepted yet.", identifier: "invitations-attending-empty")
                }
                ForEach(attending) { guest in
                    VStack(alignment: .leading, spacing: 8) {
                        GuestRowContent(guest: guest)
                        Button {
                            open(guest)
                        } label: {
                            if loadingGuest == guest.id { ProgressView() } else { Text("Preview pass") }
                        }
                        .buttonStyle(WeddingActionButtonStyle(.quiet))
                        .disabled(loadingGuest != nil || !model.access.can(.previewGuestPasses))
                        .accessibilityLabel("Preview pass for \(guest.name)")
                        .accessibilityIdentifier("invitations-preview-pass-\(guest.id)")
                    }
                    .worksheetRowCard()
                }
            }
            .padding(16)
        }
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .navigationTitle("Invitations & QR")
        .sheet(item: $preview) { pass in
            NavigationStack {
                ScrollView {
                    WeddingPassCard(pass: pass, fallbackVenue: model.data.wedding?.venueLocation)
                        .padding(16)
                }
                .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
                .navigationTitle("Pass preview")
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { preview = nil }
                            .accessibilityIdentifier("invitations-preview-done")
                    }
                }
            }
        }
        .sheet(item: $shareFile) { file in
            ShareFileSheet(file: file)
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-invitations-root")
    }

    private func open(_ guest: Guest) {
        loadingGuest = guest.id
        errorText = nil
        Task {
            do {
                preview = try await model.access.previewGuestPass(token: guest.id)
            } catch {
                errorText = "This guest's pass couldn't be opened."
            }
            loadingGuest = nil
        }
    }
}

struct PlannerIntelligenceView: View {
    @ObservedObject var model: WeddingPlanModel
    @State private var created: [String: String] = [:]
    @State private var busy: String?
    @State private var failed: Set<String> = []

    var body: some View {
        let recommendations = PlannerInsights.recommendations(model.data, today: Date())
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text("Suggestions worked out from this wedding's tasks, guests, seating, budget and vendors.")
                    .font(.subheadline)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                if recommendations.isEmpty && model.hasLoaded {
                    EmptyStateText("No suggestions right now.", identifier: "intelligence-empty")
                }
                ForEach(recommendations) { rec in
                    PlainCard {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(rec.title)
                                .font(.headline)
                                .foregroundStyle(WeddingIdentityPalette.ink)
                                .fixedSize(horizontal: false, vertical: true)
                            Text(rec.detail)
                                .font(.body)
                                .foregroundStyle(WeddingIdentityPalette.muted)
                                .fixedSize(horizontal: false, vertical: true)
                            Text("Based on \(rec.evidenceLabel)")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                                .accessibilityIdentifier("intelligence-evidence-\(rec.id)")
                            if let title = created[rec.id] {
                                StatusText("Task added: \(title)", systemImage: "checkmark.circle.fill", tone: .positive)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .accessibilityIdentifier("intelligence-created-\(rec.id)")
                            } else {
                                if failed.contains(rec.id) {
                                    StatusText("The task couldn't be created. Please try again.", systemImage: "exclamationmark.triangle.fill", tone: .negative)
                                }
                                Button {
                                    create(rec)
                                } label: {
                                    if busy == rec.id { ProgressView() } else { Text("Create task") }
                                }
                                .buttonStyle(WeddingActionButtonStyle(.primary))
                                .disabled(busy != nil || !model.access.can(.manageTasks))
                                .accessibilityHint(rec.suggestedTaskTitle)
                                .accessibilityIdentifier("intelligence-create-\(rec.id)")
                            }
                        }
                    }
                    .accessibilityIdentifier("intelligence-\(rec.id)")
                }
            }
            .padding(16)
        }
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .navigationTitle("Intelligence")
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-intelligence-root")
    }

    private func create(_ rec: PlannerRecommendation) {
        busy = rec.id
        failed.remove(rec.id)
        Task {
            do {
                let task = try await model.createTask(title: rec.suggestedTaskTitle, priority: rec.suggestedPriority, category: rec.suggestedCategory)
                created[rec.id] = task.title
            } catch {
                failed.insert(rec.id)
            }
            busy = nil
        }
    }
}
