import SwiftUI

// Worksheet bodies shared by the couple plan and the planner workspace.
// Every value shown comes from WeddingPlanModel, which reads only through RoleScopedAccess.

extension View {
    func worksheetRowCard(selected: Bool = false) -> some View {
        self
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(
                selected ? WeddingIdentityPalette.forestSoft : WeddingIdentityPalette.ivorySoft,
                in: RoundedRectangle(cornerRadius: 14)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(selected ? WeddingIdentityPalette.forest : WeddingIdentityPalette.hairline, lineWidth: selected ? 1.5 : 1)
            )
    }
}

/// A worksheet row; in select mode the whole row toggles selection and says whether it is selected.
struct SelectableRow<Content: View>: View {
    let id: String
    let selection: Binding<Set<String>>?
    let identifier: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        if let selection {
            let isOn = selection.wrappedValue.contains(id)
            Button {
                if isOn { selection.wrappedValue.remove(id) } else { selection.wrappedValue.insert(id) }
            } label: {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                        .font(.title2)
                        .foregroundStyle(isOn ? WeddingIdentityPalette.forest : WeddingIdentityPalette.muted)
                        .accessibilityHidden(true)
                    content()
                }
                .worksheetRowCard(selected: isOn)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(isOn ? .isSelected : [])
            .accessibilityValue(isOn ? "Selected" : "Not selected")
            .accessibilityIdentifier(identifier)
        } else {
            content()
                .worksheetRowCard()
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier(identifier)
        }
    }
}

/// The rows of one worksheet.
struct WorksheetRowsView: View {
    @ObservedObject var model: WeddingPlanModel
    let worksheet: PlannerWorksheet
    var selection: Binding<Set<String>>? = nil
    var allowsTaskChanges = true

    @State private var guestQuery = ""
    @State private var busyTasks: Set<String> = []
    @State private var taskError: String?

    private var arrangement: WorksheetArrangement { model.arrangement(worksheet) }
    private var data: WeddingPlanSnapshot { model.data }

    var body: some View {
        LazyVStack(alignment: .leading, spacing: 10) {
            if model.failed(worksheet) {
                LoadFailureText(worksheet.title.lowercased())
            }
            switch worksheet {
            case .overview: overview
            case .tasks: tasks
            case .budget: budget
            case .guests: guests
            case .vendors: vendors
            case .contributions: contributions
            case .seating: seating
            case .timeline: timeline
            case .documents: documents
            }
        }
    }

    private func rowId(_ id: String) -> String { "\(worksheet.slug)-row-\(id)" }

    // MARK: Overview

    @ViewBuilder
    private var overview: some View {
        if let dashboard = data.dashboard {
            PlainCard {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Tasks complete")
                        .font(.subheadline)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                    Text(dashboard.taskCompletionLabel)
                        .font(.system(.title2, design: .serif).weight(.semibold))
                        .foregroundStyle(WeddingIdentityPalette.ink)
                    if let score = dashboard.readinessScore {
                        Text("Readiness \(score)%")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(WeddingIdentityPalette.forest)
                    }
                }
                .accessibilityElement(children: .combine)
            }
            .accessibilityIdentifier("overview-task-completion")

            ForEach(dashboard.modules) { module in
                PlainCard {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(module.title)
                            .font(.headline)
                            .foregroundStyle(WeddingIdentityPalette.ink)
                        Text(module.value)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(WeddingIdentityPalette.forest)
                        if let attention = module.attention, !attention.isEmpty {
                            Text(attention)
                                .font(.subheadline)
                                .foregroundStyle(WeddingIdentityPalette.muted)
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
                .accessibilityIdentifier("overview-module-\(module.id)")
            }

            if !dashboard.attentionItems.isEmpty {
                SectionHeading("Needs attention")
                    .padding(.top, 6)
                ForEach(dashboard.attentionItems) { item in
                    PlainCard {
                        VStack(alignment: .leading, spacing: 4) {
                            StatusText(severityText(item.severity), systemImage: severityIcon(item.severity), tone: severityTone(item.severity))
                            Text(item.title)
                                .font(.headline)
                                .foregroundStyle(WeddingIdentityPalette.ink)
                            Text(item.detail)
                                .font(.subheadline)
                                .foregroundStyle(WeddingIdentityPalette.muted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        } else if model.hasLoaded && !model.failed(.overview) {
            EmptyStateText("No planning overview is recorded for this wedding.", identifier: "overview-empty")
        }
    }

    private func severityText(_ severity: PlannerAttentionSeverity) -> String {
        switch severity {
        case .urgent: return "Urgent"
        case .warning: return "Needs attention"
        case .info: return "For information"
        }
    }

    private func severityIcon(_ severity: PlannerAttentionSeverity) -> String {
        switch severity {
        case .urgent: return "exclamationmark.octagon.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .info: return "info.circle.fill"
        }
    }

    private func severityTone(_ severity: PlannerAttentionSeverity) -> StatusText.Tone {
        switch severity {
        case .urgent: return .negative
        case .warning: return .attention
        case .info: return .neutral
        }
    }

    // MARK: Tasks

    @ViewBuilder
    private var tasks: some View {
        let rows = data.arrangedTasks(arrangement)
        let open = data.tasks.filter { $0.status != .done }.count
        Text("\(PlainStatus.plural(open, "task")) open of \(data.tasks.count)")
            .font(.subheadline)
            .foregroundStyle(WeddingIdentityPalette.muted)
            .accessibilityIdentifier("tasks-summary")
        if let taskError {
            Text(taskError)
                .font(.callout)
                .foregroundStyle(Color(red: 0.61, green: 0.11, blue: 0.11))
                .accessibilityIdentifier("task-error")
        }
        if rows.isEmpty && model.hasLoaded {
            EmptyStateText("No tasks recorded for this wedding.", identifier: "tasks-empty")
        }
        ForEach(rows) { task in
            SelectableRow(id: task.id, selection: selection, identifier: rowId(task.id)) {
                TaskRowContent(
                    task: task,
                    showsToggle: selection == nil && allowsTaskChanges && model.access.can(.manageTasks),
                    busy: busyTasks.contains(task.id)
                ) {
                    toggle(task)
                }
            }
        }
    }

    private func toggle(_ task: PlannerTask) {
        busyTasks.insert(task.id)
        taskError = nil
        Task {
            taskError = await model.toggle(taskId: task.id)
            busyTasks.remove(task.id)
        }
    }

    // MARK: Budget

    @ViewBuilder
    private var budget: some View {
        let lines = data.arrangedBudget(arrangement)
        if !lines.isEmpty {
            let money: (Double) -> String = { WeddingMoney.format($0, currency: data.currency) }
            PlainCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text("All budget lines")
                        .font(.headline)
                        .foregroundStyle(WeddingIdentityPalette.ink)
                    MoneyFigures(
                        estimated: money(data.budgetLines.reduce(0) { $0 + $1.estimated }),
                        actual: money(data.budgetLines.reduce(0) { $0 + $1.actual }),
                        paid: money(data.budgetLines.reduce(0) { $0 + $1.paid })
                    )
                }
            }
            .accessibilityIdentifier("budget-totals")
        } else if model.hasLoaded {
            EmptyStateText("No budget lines recorded for this wedding.", identifier: "budget-empty")
        }
        ForEach(lines) { line in
            SelectableRow(id: line.id, selection: selection, identifier: rowId(line.id)) {
                BudgetRowContent(line: line, currency: data.currency)
            }
        }
    }

    // MARK: Guests

    @ViewBuilder
    private var guests: some View {
        let all = data.arrangedGuests(arrangement)
        let query = guestQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        let rows = query.isEmpty ? all : all.filter {
            $0.name.localizedCaseInsensitiveContains(query) || ($0.tableName?.localizedCaseInsensitiveContains(query) ?? false)
        }
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(WeddingIdentityPalette.muted)
                .accessibilityHidden(true)
            TextField("Search guests by name or table", text: $guestQuery)
                .font(.body)
                .autocorrectionDisabled()
                .accessibilityLabel("Search guests")
                .accessibilityIdentifier("worksheet-guests-search")
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 48)
        .background(WeddingIdentityPalette.ivorySoft, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(WeddingIdentityPalette.hairline, lineWidth: 1))

        let attending = data.guests.filter { $0.rsvpStatus == .attending }.count
        let declined = data.guests.filter { $0.rsvpStatus == .declined }.count
        let pending = data.guests.filter { $0.rsvpStatus == .pending }.count
        Text("\(PlainStatus.plural(data.guests.count, "guest")): \(attending) attending, \(declined) declined, \(pending) not replied")
            .font(.subheadline)
            .foregroundStyle(WeddingIdentityPalette.muted)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityIdentifier("guests-summary")

        if rows.isEmpty && model.hasLoaded {
            EmptyStateText(query.isEmpty ? "No guests recorded for this wedding." : "No guests match “\(query)”.", identifier: "guests-empty")
        }
        ForEach(rows) { guest in
            SelectableRow(id: guest.id, selection: selection, identifier: rowId(guest.id)) {
                GuestRowContent(guest: guest)
            }
        }
    }

    // MARK: Vendors

    @ViewBuilder
    private var vendors: some View {
        let rows = data.arrangedVendors(arrangement)
        if rows.isEmpty && model.hasLoaded {
            EmptyStateText("No vendors recorded for this wedding.", identifier: "vendors-empty")
        }
        ForEach(rows) { vendor in
            SelectableRow(id: vendor.id, selection: selection, identifier: rowId(vendor.id)) {
                VendorEngagementRowContent(vendor: vendor)
            }
        }
    }

    // MARK: Contributions

    @ViewBuilder
    private var contributions: some View {
        let rows = data.arrangedContributions(arrangement)
        if rows.isEmpty && model.hasLoaded {
            EmptyStateText("No contributions recorded for this wedding.", identifier: "contributions-empty")
        }
        ForEach(rows) { record in
            SelectableRow(id: record.id, selection: selection, identifier: rowId(record.id)) {
                ContributionRowContent(record: record)
            }
        }
    }

    // MARK: Seating

    @ViewBuilder
    private var seating: some View {
        let rows = data.arrangedSeating(arrangement)
        if !rows.isEmpty {
            let capacity = data.seating.reduce(0) { $0 + $1.capacity }
            let assigned = data.seating.reduce(0) { $0 + $1.assigned }
            Text("\(PlainStatus.plural(data.seating.count, "table")): \(assigned) of \(capacity) seats assigned, \(max(capacity - assigned, 0)) free")
                .font(.subheadline)
                .foregroundStyle(WeddingIdentityPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("seating-summary")
        } else if model.hasLoaded {
            EmptyStateText("No tables recorded for this wedding.", identifier: "seating-empty")
        }
        ForEach(rows) { table in
            SelectableRow(id: table.id, selection: selection, identifier: rowId(table.id)) {
                SeatingRowContent(table: table)
            }
        }
    }

    // MARK: Timeline

    @ViewBuilder
    private var timeline: some View {
        let rows = data.arrangedProgramme(arrangement)
        if rows.isEmpty && model.hasLoaded {
            EmptyStateText("No programme recorded for this wedding.", identifier: "timeline-empty")
        }
        ForEach(rows) { entry in
            SelectableRow(id: entry.id, selection: selection, identifier: rowId(entry.id)) {
                ProgrammeRowContent(entry: entry)
            }
        }
    }

    // MARK: Documents

    @ViewBuilder
    private var documents: some View {
        let rows = data.arrangedDocuments(arrangement)
        if rows.isEmpty && model.hasLoaded {
            EmptyStateText("No contracts or documents recorded for this wedding.", identifier: "documents-empty")
        }
        ForEach(rows) { document in
            SelectableRow(id: document.id, selection: selection, identifier: rowId(document.id)) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(document.title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(WeddingIdentityPalette.ink)
                    Text(PlainStatus.label(document.kind))
                        .font(.subheadline)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                    if let status = document.statusLabel {
                        StatusText(status)
                    }
                }
            }
        }
    }
}

// MARK: - Row contents

struct TaskRowContent: View {
    let task: PlannerTask
    let showsToggle: Bool
    let busy: Bool
    let onToggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(task.title)
                .font(.body.weight(.semibold))
                .foregroundStyle(WeddingIdentityPalette.ink)
                .strikethrough(task.status == .done, color: WeddingIdentityPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
            Text(meta)
                .font(.subheadline)
                .foregroundStyle(WeddingIdentityPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) {
                    status
                    Spacer(minLength: 8)
                    toggleButton
                }
                VStack(alignment: .leading, spacing: 8) {
                    status
                    toggleButton
                }
            }
        }
    }

    private var meta: String {
        var parts = [PlainStatus.label(task.category), "\(task.priority.title) priority"]
        if let due = task.dueDate { parts.append("Due \(WeddingDateText.short(due))") }
        return parts.joined(separator: " · ")
    }

    private var status: some View {
        StatusText(
            PlainStatus.task(task.status),
            systemImage: task.status == .done ? "checkmark.circle.fill" : (task.status == .blocked ? "exclamationmark.circle" : "circle"),
            tone: task.status == .done ? .positive : (task.status == .blocked ? .negative : .attention)
        )
    }

    @ViewBuilder
    private var toggleButton: some View {
        if showsToggle {
            Button(action: onToggle) {
                if busy {
                    ProgressView()
                } else {
                    Text(task.status == .done ? "Mark to do" : "Mark done")
                }
            }
            .buttonStyle(WeddingActionButtonStyle(task.status == .done ? .secondary : .quiet, fullWidth: false))
            .disabled(busy)
            .accessibilityLabel(task.status == .done ? "Mark \(task.title) to do" : "Mark \(task.title) done")
            .accessibilityIdentifier("task-toggle-\(task.id)")
        }
    }
}

struct MoneyFigures: View {
    let estimated: String
    let actual: String
    let paid: String

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: 12) { columns }
            VStack(alignment: .leading, spacing: 6) { columns }
        }
    }

    @ViewBuilder
    private var columns: some View {
        figure("Estimated", estimated)
        figure("Actual", actual)
        figure("Paid", paid)
    }

    private func figure(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.footnote)
                .foregroundStyle(WeddingIdentityPalette.muted)
            Text(value)
                .font(.body.weight(.semibold))
                .foregroundStyle(WeddingIdentityPalette.ink)
        }
        .frame(minWidth: 80, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

struct BudgetRowContent: View {
    let line: PlannerBudgetLine
    let currency: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(PlainStatus.label(line.category))
                    .font(.body.weight(.semibold))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                if let vendor = line.vendorName, !vendor.isEmpty {
                    Text(vendor)
                        .font(.subheadline)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                }
            }
            MoneyFigures(
                estimated: WeddingMoney.format(line.estimated, currency: currency),
                actual: WeddingMoney.format(line.actual, currency: currency),
                paid: WeddingMoney.format(line.paid, currency: currency)
            )
            StatusText(line.statusLabel, tone: line.paid > 0 && line.paid >= line.actual ? .positive : .attention)
            if let due = line.dueDateLabel {
                Text("Due \(WeddingDateText.short(due))")
                    .font(.subheadline)
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }
        }
    }
}

struct GuestRowContent: View {
    let guest: Guest

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(guest.name)
                .font(.body.weight(.semibold))
                .foregroundStyle(WeddingIdentityPalette.ink)
            StatusText(
                "RSVP: " + PlainStatus.rsvp(guest.rsvpStatus),
                systemImage: guest.rsvpStatus == .attending ? "checkmark.circle.fill" : (guest.rsvpStatus == .declined ? "xmark.circle" : "clock"),
                tone: guest.rsvpStatus == .attending ? .positive : (guest.rsvpStatus == .declined ? .negative : .attention)
            )
            Text("Party of \(guest.partySize) · " + (guest.tableName.map { "Table: \($0)" } ?? "No table"))
                .font(.subheadline)
                .foregroundStyle(WeddingIdentityPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

struct VendorEngagementRowContent: View {
    let vendor: PlannerVendorEngagement

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(vendor.vendorName)
                .font(.body.weight(.semibold))
                .foregroundStyle(WeddingIdentityPalette.ink)
            Text(PlainStatus.label(vendor.category))
                .font(.subheadline)
                .foregroundStyle(WeddingIdentityPalette.muted)
            Text("Booking: \(vendor.bookingStatus)")
            Text("Contract: \(vendor.contractStatus)")
            Text("Payment: \(vendor.paymentStatus)")
            if !vendor.nextAction.isEmpty {
                Text("Next: \(vendor.nextAction)")
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
            }
        }
        .font(.subheadline)
        .foregroundStyle(WeddingIdentityPalette.ink)
    }
}

/// Contributor, type, status, facts and message. Never an amount.
struct ContributionRowContent: View {
    let record: PlannerContributionRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(PlainStatus.contributor(record))
                .font(.body.weight(.semibold))
                .foregroundStyle(WeddingIdentityPalette.ink)
                .accessibilityIdentifier("contribution-contributor-\(record.id)")
            Text(record.typeLabel)
                .font(.subheadline)
                .foregroundStyle(WeddingIdentityPalette.muted)
            StatusText(record.statusLabel, tone: record.verified ? .positive : .attention)
            if let facts = PlainStatus.contributionFacts(record) {
                Text(facts)
                    .font(.subheadline)
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }
            Text(record.messageText?.isEmpty == false ? record.messageText! : PlainStatus.messageUnavailable)
                .font(.body)
                .italic(record.messageText?.isEmpty != false)
                .foregroundStyle(record.messageText?.isEmpty == false ? WeddingIdentityPalette.ink : WeddingIdentityPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

struct SeatingRowContent: View {
    let table: PlannerSeatingTable

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(table.name)
                .font(.body.weight(.semibold))
                .foregroundStyle(WeddingIdentityPalette.ink)
            if !table.zone.isEmpty {
                Text(table.zone)
                    .font(.subheadline)
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }
            Text("Capacity \(table.capacity) · Assigned \(table.assigned) · Free \(max(table.capacity - table.assigned, 0))")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(table.assigned > table.capacity ? Color(red: 0.61, green: 0.11, blue: 0.11) : WeddingIdentityPalette.forest)
                .fixedSize(horizontal: false, vertical: true)
            if table.assigned > table.capacity {
                Text("Over capacity")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color(red: 0.61, green: 0.11, blue: 0.11))
            }
        }
    }
}

struct ProgrammeRowContent: View {
    let entry: PlannerTimelineEntry

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text(entry.time)
                .font(.body.weight(.bold).monospacedDigit())
                .foregroundStyle(WeddingIdentityPalette.champagneDeep)
            VStack(alignment: .leading, spacing: 3) {
                Text(entry.title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if !entry.location.isEmpty {
                    Text(entry.location)
                        .font(.subheadline)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                }
                if !entry.statusLabel.isEmpty {
                    Text(entry.statusLabel)
                        .font(.subheadline)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                }
                if let vendor = entry.linkedVendor {
                    Text("Vendor: \(vendor)")
                        .font(.subheadline)
                        .foregroundStyle(WeddingIdentityPalette.forest)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// A worksheet on its own screen with a back button (NavigationStack).
struct WorksheetScreen: View {
    @ObservedObject var model: WeddingPlanModel
    let worksheet: PlannerWorksheet
    let identifier: String

    var body: some View {
        ScrollView {
            WorksheetRowsView(model: model, worksheet: worksheet)
                .padding(16)
        }
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .navigationTitle(worksheet.title)
        .refreshable { await model.load() }
        .task { await model.loadIfNeeded() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(identifier)
    }
}
