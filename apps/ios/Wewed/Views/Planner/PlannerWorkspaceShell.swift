import SwiftUI
import UniformTypeIdentifiers

/// Planner ("Planner Workspace"): Workspace / Daily Ops / Wedding Day / More.
/// Receives only a RoleScopedAccess for the planner grant.
public struct PlannerShellView: View {
    enum Tab: Hashable { case workspace, dailyOps, weddingDay, more }

    @StateObject private var model: WeddingPlanModel
    @StateObject private var gate: GateModel
    @State private var tab: Tab = .workspace
    private let grant: RoleGrant

    public init(access: RoleScopedAccess) {
        grant = access.grant
        _model = StateObject(wrappedValue: WeddingPlanModel(access: access))
        _gate = StateObject(wrappedValue: GateModel(access: access, operatorId: gateOperatorId(access.grant)))
    }

    public var body: some View {
        ShellFrame(grant: grant, identifier: "planner-workspace-root") {
            TabView(selection: $tab) {
                PlannerWorkspaceTab(model: model)
                    .tabItem { Label("Workspace", systemImage: "briefcase") }
                    .tag(Tab.workspace)
                PlannerDailyOpsView(model: model)
                    .tabItem { Label("Daily Ops", systemImage: "sun.max") }
                    .tag(Tab.dailyOps)
                PlannerWeddingDayView(model: model, gate: gate)
                    .tabItem { Label("Wedding Day", systemImage: "heart") }
                    .tag(Tab.weddingDay)
                PlannerMoreView(model: model)
                    .tabItem { Label("More", systemImage: "line.3.horizontal") }
                    .tag(Tab.more)
            }
            .ivoryTabBar()
        }
        .task { await model.loadIfNeeded() }
    }
}

// MARK: - Workspace tab

struct PlannerWorkspaceTab: View {
    @ObservedObject var model: WeddingPlanModel

    enum PendingAction {
        case refresh, switchWorksheet, select, print(Set<String>?), export(Set<String>?), template, importFile
    }

    enum ActiveSheet: Identifiable {
        case actions
        case share(ShareableFile)
        case importFlow(TaskImportPreview, String)

        var id: String {
            switch self {
            case .actions: return "actions"
            case .share(let file): return "share-\(file.id)"
            case .importFlow(_, let name): return "import-\(name)"
            }
        }
    }

    @State private var worksheet: PlannerWorksheet = .overview
    @State private var selecting = false
    @State private var selection: Set<String> = []
    @State private var sheet: ActiveSheet?
    @State private var pending: PendingAction?
    @State private var importing = false
    @State private var bulkChange: WeddingPlanModel.BulkTaskChange?
    @State private var outcome: String?
    @State private var highlightPicker = false
    @AccessibilityFocusState private var pickerFocused: Bool
    @ScaledMetric(relativeTo: .subheadline) private var chipWidth: CGFloat = 104

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        clientSelector
                        if let outcome {
                            outcomeBanner(outcome)
                        }
                        picker
                            .id("worksheet-picker")
                        worksheetHeader
                        WorksheetRowsView(model: model, worksheet: worksheet, selection: selecting ? $selection : nil)
                            .accessibilityElement(children: .contain)
                            .accessibilityIdentifier("planner-worksheet-body")
                    }
                    .padding(16)
                }
                .onChange(of: highlightPicker) { _, on in
                    guard on else { return }
                    withAnimation { proxy.scrollTo("worksheet-picker", anchor: .top) }
                    pickerFocused = true
                    Task {
                        try? await Task.sleep(nanoseconds: 1_500_000_000)
                        highlightPicker = false
                    }
                }
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("Planner Workspace")
            .refreshable { await refresh() }
            .safeAreaInset(edge: .bottom) {
                if selecting { selectionBar }
            }
            .sheet(item: $sheet, onDismiss: runPending) { sheet in
                switch sheet {
                case .actions:
                    PlannerActionsSheet(
                        model: model,
                        worksheet: worksheet,
                        onAction: { action in
                            pending = action
                            self.sheet = nil
                        },
                        onClose: { self.sheet = nil }
                    )
                case .share(let file):
                    ShareFileSheet(file: file)
                case .importFlow(let preview, let fileName):
                    TaskImportFlowView(model: model, preview: preview, fileName: fileName) { record in
                        if let record {
                            outcome = "Import finished: \(PlainStatus.plural(record.created, "task")) added, \(PlainStatus.plural(record.skipped, "row")) skipped."
                        }
                        self.sheet = nil
                    }
                }
            }
            .fileImporter(isPresented: $importing, allowedContentTypes: [.commaSeparatedText, .plainText], allowsMultipleSelection: false) { result in
                handleImport(result)
            }
            .confirmationDialog(bulkTitle, isPresented: bulkBinding, titleVisibility: .visible) {
                if let change = bulkChange {
                    Button(change == .markDone ? "Mark done" : "Mark to do") { runBulk(change) }
                }
                Button("Cancel", role: .cancel) { bulkChange = nil }
            } message: {
                Text(bulkMessage)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-workspace-tab")
    }

    // MARK: Header

    private var clientSelector: some View {
        Menu {
            Section("Weddings you can plan") {
                Button {
                    // Only one authorized wedding; it is already selected.
                } label: {
                    Label(model.grant.weddingTitle, systemImage: "checkmark")
                }
            }
        } label: {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Client wedding")
                        .font(.subheadline)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                    Text(model.grant.weddingTitle)
                        .font(.system(.title3, design: .serif).weight(.semibold))
                        .foregroundStyle(WeddingIdentityPalette.ink)
                        .multilineTextAlignment(.leading)
                    if let wedding = model.data.wedding {
                        Text(WeddingDateText.long(wedding.date))
                            .font(.subheadline)
                            .foregroundStyle(WeddingIdentityPalette.ink)
                        Text([wedding.venueName, wedding.city].filter { !$0.isEmpty }.joined(separator: ", "))
                            .font(.subheadline)
                            .foregroundStyle(WeddingIdentityPalette.muted)
                            .multilineTextAlignment(.leading)
                    }
                    if let refreshed = model.lastRefreshed {
                        Text("Updated \(refreshed.formatted(date: .omitted, time: .shortened))")
                            .font(.footnote)
                            .foregroundStyle(WeddingIdentityPalette.muted)
                    }
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.up.chevron.down")
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .accessibilityHidden(true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(WeddingIdentityPalette.ivorySoft, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(WeddingIdentityPalette.hairline, lineWidth: 1))
        }
        .accessibilityLabel("Client wedding: \(model.grant.weddingTitle)")
        .accessibilityHint("Lists the weddings you are authorized to plan")
        .accessibilityIdentifier("planner-client-selector")
    }

    private var picker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Worksheet")
                .font(.headline)
                .foregroundStyle(WeddingIdentityPalette.ink)
                .accessibilityAddTraits(.isHeader)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: chipWidth), spacing: 8)], spacing: 8) {
                ForEach(PlannerWorksheet.allCases) { ws in
                    Button {
                        choose(ws)
                    } label: {
                        Text(ws.title)
                            .font(.subheadline.weight(.semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .padding(.horizontal, 4)
                            .foregroundStyle(ws == worksheet ? Color.white : WeddingIdentityPalette.ink)
                            .background(ws == worksheet ? WeddingIdentityPalette.forest : WeddingIdentityPalette.ivorySoft, in: Capsule())
                            .overlay(Capsule().stroke(WeddingIdentityPalette.hairline, lineWidth: ws == worksheet ? 0 : 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(ws == worksheet ? .isSelected : [])
                    .accessibilityIdentifier("planner-worksheet-\(ws.slug)")
                }
            }
        }
        .padding(highlightPicker ? 8 : 0)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(WeddingIdentityPalette.champagneDeep, lineWidth: highlightPicker ? 2 : 0)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-worksheet-picker")
        .accessibilityFocused($pickerFocused)
    }

    private var worksheetHeader: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .center, spacing: 12) {
                headerTitle
                Spacer(minLength: 8)
                actionsButton
            }
            VStack(alignment: .leading, spacing: 10) {
                headerTitle
                actionsButton
            }
        }
    }

    private var headerTitle: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(worksheet.title)
                .font(.system(.title2, design: .serif).weight(.semibold))
                .foregroundStyle(WeddingIdentityPalette.ink)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("planner-current-worksheet")
            if model.arrangement(worksheet) != .standard {
                Text("Arranged: \(model.arrangement(worksheet).title)")
                    .font(.footnote)
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }
        }
    }

    private var actionsButton: some View {
        Button {
            sheet = .actions
        } label: {
            Label("Actions", systemImage: "ellipsis.circle")
        }
        .buttonStyle(WeddingActionButtonStyle(.secondary, fullWidth: false))
        .disabled(!model.access.can(.plannerActions))
        .accessibilityIdentifier("planner-actions-button")
    }

    private func outcomeBanner(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text(text)
                .font(.callout)
                .foregroundStyle(WeddingIdentityPalette.ink)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                outcome = nil
            } label: {
                Image(systemName: "xmark")
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss message")
        }
        .padding(.leading, 12)
        .background(WeddingIdentityPalette.forestSoft, in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-action-result")
    }

    // MARK: Select mode

    private var selectionBar: some View {
        let ids = model.data.rowIds(worksheet, model.arrangement(worksheet))
        let only = selection.intersection(ids)
        return VStack(spacing: 10) {
            HStack {
                Text("\(only.count) selected")
                    .font(.headline)
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .accessibilityIdentifier("planner-selection-count")
                Spacer()
                Button(only.count == ids.count && !ids.isEmpty ? "Clear" : "Select all") {
                    selection = only.count == ids.count ? [] : Set(ids)
                }
                .buttonStyle(WeddingActionButtonStyle(.quiet, fullWidth: false))
                .accessibilityIdentifier("planner-select-all")
                Button("Done") {
                    selecting = false
                    selection = []
                }
                .buttonStyle(WeddingActionButtonStyle(.secondary, fullWidth: false))
                .accessibilityIdentifier("planner-select-done")
            }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                if worksheet == .tasks {
                    Button("Mark done") { bulkChange = .markDone }
                        .buttonStyle(WeddingActionButtonStyle(.primary))
                        .disabled(only.isEmpty)
                        .accessibilityIdentifier("planner-bulk-mark-done")
                    Button("Mark to do") { bulkChange = .markToDo }
                        .buttonStyle(WeddingActionButtonStyle(.secondary))
                        .disabled(only.isEmpty)
                        .accessibilityIdentifier("planner-bulk-mark-todo")
                }
                Button("Export selected") { export(only: only) }
                    .buttonStyle(WeddingActionButtonStyle(.secondary))
                    .disabled(only.isEmpty || !worksheet.supportsExport)
                    .accessibilityIdentifier("planner-bulk-export")
                Button("Print selected") { printWorksheet(only: only) }
                    .buttonStyle(WeddingActionButtonStyle(.secondary))
                    .disabled(only.isEmpty || !WorksheetPrinter.isAvailable)
                    .accessibilityIdentifier("planner-bulk-print")
            }
        }
        .padding(12)
        .background(.regularMaterial)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-selection-bar")
    }

    private var bulkBinding: Binding<Bool> {
        Binding(get: { bulkChange != nil }, set: { if !$0 { bulkChange = nil } })
    }

    private var bulkTitle: String {
        guard let change = bulkChange else { return "" }
        let count = model.tasksAffected(by: change, in: selection).count
        return change == .markDone
            ? "Mark \(PlainStatus.plural(count, "task")) as done?"
            : "Mark \(PlainStatus.plural(count, "task")) as to do?"
    }

    private var bulkMessage: String {
        guard let change = bulkChange else { return "" }
        let selected = model.data.tasks.filter { selection.contains($0.id) }.count
        let affected = model.tasksAffected(by: change, in: selection).count
        let unchanged = selected - affected
        if affected == 0 {
            return change == .markDone
                ? "All selected tasks are already done. Nothing will change."
                : "Only done tasks can be reopened here. None of the selected tasks are done, so nothing will change."
        }
        guard unchanged > 0 else { return "\(PlainStatus.plural(affected, "task")) will change." }
        return change == .markDone
            ? "\(PlainStatus.plural(unchanged, "selected task")) already done and will stay as they are."
            : "Only done tasks are reopened. \(PlainStatus.plural(unchanged, "selected task")) not done and will stay as they are."
    }

    private func runBulk(_ change: WeddingPlanModel.BulkTaskChange) {
        let ids = selection
        bulkChange = nil
        Task {
            let result = await model.apply(change, to: ids)
            var text = change == .markDone
                ? "\(PlainStatus.plural(result.changed, "task")) marked done."
                : "\(PlainStatus.plural(result.changed, "task")) marked to do."
            if result.failed > 0 {
                text += " \(PlainStatus.plural(result.failed, "task")) couldn't be updated."
            }
            outcome = text
        }
    }

    // MARK: Actions

    private func choose(_ ws: PlannerWorksheet) {
        worksheet = ws
        selecting = false
        selection = []
    }

    private func refresh() async {
        await model.load()
        outcome = model.failures.isEmpty
            ? "Refreshed at \(Date().formatted(date: .omitted, time: .shortened))."
            : "Some data couldn't be loaded. Try Refresh again."
    }

    private func runPending() {
        guard let action = pending else { return }
        pending = nil
        switch action {
        case .refresh:
            Task { await refresh() }
        case .switchWorksheet:
            highlightPicker = true
        case .select:
            selection = []
            selecting = true
        case .print(let only):
            printWorksheet(only: only)
        case .export(let only):
            export(only: only)
        case .template:
            share(WorksheetCsv.template(worksheet), named: worksheet.templateFileName)
        case .importFile:
            importing = true
        }
    }

    private func export(only: Set<String>?) {
        guard let csv = model.data.csv(worksheet, arrangement: model.arrangement(worksheet), only: only) else { return }
        share(csv, named: worksheet.exportFileName)
    }

    private func share(_ text: String, named name: String) {
        do {
            sheet = .share(try ShareFiles.write(text, named: name))
        } catch {
            outcome = "The file couldn't be prepared. Please try again."
        }
    }

    private func printWorksheet(only: Set<String>?) {
        let table = model.data.table(worksheet, arrangement: model.arrangement(worksheet), only: only)
        let scope = only.map { "\(PlainStatus.plural($0.count, "selected row"))" } ?? "All rows"
        WorksheetPrinter.print(
            html: table.html(
                title: "\(model.grant.weddingTitle) — \(worksheet.title)",
                subtitle: "\(scope) · Printed \(Date().formatted(date: .abbreviated, time: .shortened))"
            ),
            jobName: "Wewed \(worksheet.title)"
        )
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            do {
                let text = try String(contentsOf: url, encoding: .utf8)
                let preview = WorksheetCsv.previewTaskImport(text)
                sheet = .importFlow(preview, url.lastPathComponent)
            } catch {
                outcome = "The file couldn't be read. Choose a CSV file saved as UTF-8."
            }
        case .failure:
            outcome = "The file couldn't be opened."
        }
    }
}

// MARK: - Actions sheet

struct PlannerActionsSheet: View {
    @ObservedObject var model: WeddingPlanModel
    let worksheet: PlannerWorksheet
    let onAction: (PlannerWorkspaceTab.PendingAction) -> Void
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Worksheet: \(worksheet.title)")
                        .font(.headline)
                        .foregroundStyle(WeddingIdentityPalette.ink)
                }

                Section("This worksheet") {
                    actionRow("Refresh data", icon: "arrow.clockwise", id: "planner-action-refresh") { onAction(.refresh) }
                    actionRow("Switch worksheet", icon: "square.grid.2x2", id: "planner-action-switch") { onAction(.switchWorksheet) }
                    NavigationLink {
                        ArrangeView(model: model, worksheet: worksheet, onDone: onClose)
                    } label: {
                        rowLabel("Arrange (this device)", icon: "arrow.up.arrow.down",
                                 note: WorksheetArrangement.options(for: worksheet).isEmpty ? "The overview has no rows to arrange." : nil)
                    }
                    .disabled(WorksheetArrangement.options(for: worksheet).isEmpty)
                    .accessibilityIdentifier("planner-action-arrange")
                    actionRow("Select", icon: "checkmark.circle", id: "planner-action-select",
                              disabled: worksheet == .overview,
                              note: worksheet == .overview ? "Choose a worksheet with rows to select." : nil) { onAction(.select) }
                }

                Section("Files") {
                    actionRow("Print", icon: "printer", id: "planner-action-print",
                              disabled: !WorksheetPrinter.isAvailable,
                              note: WorksheetPrinter.isAvailable ? nil : "Printing isn't available on this device.") { onAction(.print(nil)) }
                    actionRow("Template", icon: "doc.badge.plus", id: "planner-action-template",
                              disabled: !worksheet.supportsExport,
                              note: worksheet.supportsExport ? "Share an empty \(worksheet.templateFileName)" : "The overview has no template.") { onAction(.template) }
                    actionRow("Export", icon: "square.and.arrow.up", id: "planner-action-export",
                              disabled: !worksheet.supportsExport,
                              note: worksheet.supportsExport ? "Share \(worksheet.exportFileName)" : "The overview has no rows to export.") { onAction(.export(nil)) }
                    actionRow("Import", icon: "square.and.arrow.down", id: "planner-action-import",
                              disabled: !worksheet.supportsImport || !model.access.can(.manageTasks),
                              note: worksheet.supportsImport ? "Add tasks from a CSV file" : "Import for this worksheet is available in the web workspace.") { onAction(.importFile) }
                    NavigationLink {
                        RecentImportsView(model: model)
                    } label: {
                        rowLabel("Recent imports", icon: "clock.arrow.circlepath", note: "Imports on this device")
                    }
                    .accessibilityIdentifier("planner-action-recent-imports")
                }

                Section("Wedding") {
                    NavigationLink {
                        ClientProfileEditor(model: model)
                    } label: {
                        rowLabel("Edit wedding details", icon: "pencil", note: nil)
                    }
                    .disabled(!model.access.can(.editWeddingDetails))
                    .accessibilityIdentifier("planner-action-edit-wedding")
                }
            }
            .navigationTitle("Actions")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", action: onClose)
                        .accessibilityIdentifier("planner-actions-close")
                }
            }
        }
        .presentationDetents([.large])
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-actions-sheet")
    }

    private func rowLabel(_ title: String, icon: String, note: String?) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                .frame(width: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                if let note {
                    Text(note)
                        .font(.subheadline)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(minHeight: 44, alignment: .leading)
    }

    private func actionRow(_ title: String, icon: String, id: String, disabled: Bool = false, note: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            rowLabel(title, icon: icon, note: note)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? 0.55 : 1)
        .accessibilityIdentifier(id)
    }
}

struct ArrangeView: View {
    @ObservedObject var model: WeddingPlanModel
    let worksheet: PlannerWorksheet
    let onDone: () -> Void

    var body: some View {
        List {
            Section {
                ForEach(WorksheetArrangement.options(for: worksheet)) { option in
                    Button {
                        model.arrangements[worksheet] = option
                        onDone()
                    } label: {
                        HStack {
                            Text(option.title)
                                .font(.body)
                                .foregroundStyle(WeddingIdentityPalette.ink)
                            Spacer()
                            if model.arrangement(worksheet) == option {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(WeddingIdentityPalette.forest)
                                    .accessibilityHidden(true)
                            }
                        }
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(model.arrangement(worksheet) == option ? .isSelected : [])
                    .accessibilityIdentifier("planner-arrange-\(option.slug)")
                }
            } footer: {
                Text("This order is kept on this device only. It isn't shared with the web workspace.")
            }
        }
        .navigationTitle("Arrange (this device)")
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-arrange-root")
    }
}

struct RecentImportsView: View {
    @ObservedObject var model: WeddingPlanModel

    var body: some View {
        List {
            if model.imports.isEmpty {
                Text("No imports on this device yet.")
                    .font(.body)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .accessibilityIdentifier("planner-recent-imports-empty")
            }
            ForEach(model.imports) { record in
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(record.worksheet.title) · \(record.importedAt.formatted(date: .abbreviated, time: .shortened))")
                        .font(.body.weight(.semibold))
                    Text("Created \(record.created) · Skipped \(record.skipped) · Errors \(record.errors.count)")
                        .font(.subheadline)
                    ForEach(Array(record.errors.enumerated()), id: \.offset) { _, error in
                        Text("Row \(error.rowNumber): \(error.message)")
                            .font(.subheadline)
                            .foregroundStyle(WeddingIdentityPalette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(.vertical, 4)
                .accessibilityElement(children: .combine)
            }
        }
        .navigationTitle("Imports on this device")
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-recent-imports-root")
    }
}

// MARK: - Task import

struct TaskImportFlowView: View {
    @ObservedObject var model: WeddingPlanModel
    let preview: TaskImportPreview
    let fileName: String
    let onFinish: (ImportRecord?) -> Void

    @State private var running = false
    @State private var record: ImportRecord?

    var body: some View {
        NavigationStack {
            List {
                if let record {
                    Section("Import finished") {
                        Text("\(PlainStatus.plural(record.created, "task")) added")
                            .font(.headline)
                            .accessibilityIdentifier("planner-import-created")
                        Text("\(PlainStatus.plural(record.skipped, "row")) skipped")
                            .font(.body)
                    }
                    errorsSection(record.errors)
                } else {
                    Section("File") {
                        Text(fileName)
                            .font(.body.weight(.semibold))
                        if preview.headerErrors.isEmpty {
                            Text("\(PlainStatus.plural(preview.validRows.count, "row")) ready to import")
                                .font(.headline)
                                .accessibilityIdentifier("planner-import-valid-count")
                            if !preview.rowErrors.isEmpty {
                                Text("\(PlainStatus.plural(preview.rowErrors.count, "row")) will be skipped")
                                    .font(.body)
                            }
                        }
                    }
                    if !preview.headerErrors.isEmpty {
                        Section("This file can't be imported") {
                            ForEach(preview.headerErrors, id: \.self) { error in
                                Text(error).font(.body)
                            }
                        }
                    }
                    errorsSection(preview.rowErrors)
                    if !preview.validRows.isEmpty {
                        Section("Tasks to add") {
                            ForEach(preview.validRows, id: \.rowNumber) { row in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(row.title).font(.body.weight(.semibold))
                                    Text("Row \(row.rowNumber) · \(PlainStatus.label(row.category)) · \(row.priority.title) priority")
                                        .font(.subheadline)
                                        .foregroundStyle(WeddingIdentityPalette.muted)
                                }
                                .accessibilityElement(children: .combine)
                            }
                        }
                    }
                    Section {
                        Text("New tasks are added as To do. Status and due dates in the file aren't saved by the app yet.")
                            .font(.subheadline)
                            .foregroundStyle(WeddingIdentityPalette.muted)
                    }
                }
            }
            .navigationTitle("Import tasks")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 8) {
                    if let record {
                        Button("Done") { onFinish(record) }
                            .buttonStyle(WeddingActionButtonStyle(.primary))
                            .accessibilityIdentifier("planner-import-done")
                    } else {
                        Button {
                            run()
                        } label: {
                            if running { ProgressView() } else { Text("Import \(PlainStatus.plural(preview.validRows.count, "task"))") }
                        }
                        .buttonStyle(WeddingActionButtonStyle(.primary))
                        .disabled(!preview.canImport || running)
                        .accessibilityIdentifier("planner-import-confirm")
                        Button("Cancel") { onFinish(nil) }
                            .buttonStyle(WeddingActionButtonStyle(.secondary))
                            .disabled(running)
                            .accessibilityIdentifier("planner-import-cancel")
                    }
                }
                .padding(12)
                .background(.regularMaterial)
            }
        }
        .interactiveDismissDisabled(running)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(record == nil ? "planner-import-preview" : "planner-import-result")
    }

    @ViewBuilder
    private func errorsSection(_ errors: [ImportRowError]) -> some View {
        if !errors.isEmpty {
            Section("Rows with problems") {
                ForEach(Array(errors.enumerated()), id: \.offset) { _, error in
                    Text("Row \(error.rowNumber): \(error.message)")
                        .font(.body)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private func run() {
        running = true
        Task {
            record = await model.importTasks(preview)
            running = false
        }
    }
}

// MARK: - Client profile editor

struct ClientProfileEditor: View {
    @ObservedObject var model: WeddingPlanModel

    @State private var coupleNames = ""
    @State private var dateText = ""
    @State private var date = Date()
    @State private var usesDatePicker = false
    @State private var dateEdited = false
    @State private var venue = ""
    @State private var city = ""
    @State private var country = ""
    @State private var prepared = false
    @State private var confirming = false
    @State private var saving = false
    @State private var message: String?
    @State private var messageIsError = false

    var body: some View {
        Form {
            Section("Couple") {
                TextField("Couple names", text: $coupleNames)
                    .accessibilityIdentifier("client-profile-couple")
            }
            Section("Date") {
                if usesDatePicker {
                    DatePicker("Wedding date", selection: Binding(get: { date }, set: { date = $0; dateEdited = true }))
                        .accessibilityIdentifier("client-profile-date")
                } else {
                    TextField("Wedding date", text: $dateText)
                        .accessibilityIdentifier("client-profile-date")
                }
            }
            Section("Venue") {
                TextField("Venue", text: $venue)
                    .accessibilityIdentifier("client-profile-venue")
                TextField("City", text: $city)
                    .accessibilityIdentifier("client-profile-city")
                TextField("Country", text: $country)
                    .accessibilityIdentifier("client-profile-country")
            }
            if let message {
                Section {
                    StatusText(message, systemImage: messageIsError ? "exclamationmark.triangle.fill" : "checkmark.circle.fill", tone: messageIsError ? .negative : .positive)
                        .accessibilityIdentifier("client-profile-message")
                }
            }
            Section {
                Button {
                    confirming = true
                } label: {
                    if saving { ProgressView() } else { Text("Save") }
                }
                .buttonStyle(WeddingActionButtonStyle(.primary))
                .listRowBackground(Color.clear)
                .disabled(saving || model.data.wedding == nil)
                .accessibilityIdentifier("client-profile-save")
            }
        }
        .navigationTitle("Edit wedding details")
        .alert("Save wedding details?", isPresented: $confirming) {
            Button("Save") { save() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This changes the wedding record for everyone who works on this wedding.")
        }
        .onAppear(perform: prepare)
        .onChange(of: model.data.wedding) { _, _ in prepare() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("client-profile-editor")
    }

    private static let recordedPattern = #"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$"#

    private func prepare() {
        guard !prepared, let wedding = model.data.wedding else { return }
        prepared = true
        coupleNames = wedding.coupleNames
        dateText = wedding.date
        venue = wedding.venueName
        city = wedding.city
        country = wedding.country
        if wedding.date.range(of: Self.recordedPattern, options: .regularExpression) != nil,
           let parsed = WeddingDateText.parse(wedding.date) {
            date = parsed
            usesDatePicker = true
        }
    }

    private func save() {
        let recordedDate = usesDatePicker && dateEdited ? WeddingDateText.record(date) : dateText
        saving = true
        message = nil
        Task {
            do {
                try await model.updateWedding(WeddingDetailsUpdate(
                    coupleNames: coupleNames,
                    date: recordedDate,
                    venueName: venue,
                    city: city,
                    country: country
                ))
                message = "Wedding details saved."
                messageIsError = false
            } catch let error as WeddingDetailsError {
                message = error.errorDescription ?? "The wedding details couldn't be saved."
                messageIsError = true
            } catch {
                message = "The wedding details couldn't be saved. Please try again."
                messageIsError = true
            }
            saving = false
        }
    }
}
