import Foundation
import Combine

/// Loads and changes wedding-management data strictly through one RoleScopedAccess.
/// Used by the couple plan and the planner workspace; never touches repositories directly.
@MainActor
public final class WeddingPlanModel: ObservableObject {
    public enum DataSection: String, CaseIterable, Sendable {
        case wedding, dashboard, tasks, budget, guests, vendors, contributions, seating, programme, documents, presence, admission
    }

    public let access: RoleScopedAccess
    @Published public private(set) var data = WeddingPlanSnapshot()
    @Published public private(set) var admission: AdmissionSummary?
    @Published public private(set) var hasLoaded = false
    @Published public private(set) var isLoading = false
    @Published public private(set) var failures: Set<DataSection> = []
    @Published public private(set) var lastRefreshed: Date?
    /// Imports completed in this app session, newest first ("Imports on this device").
    @Published public private(set) var imports: [ImportRecord] = []
    /// Row order per worksheet; kept on this device only, never synced.
    @Published public var arrangements: [PlannerWorksheet: WorksheetArrangement] = [:]

    public init(access: RoleScopedAccess) {
        self.access = access
    }

    public var grant: RoleGrant { access.grant }

    public func arrangement(_ worksheet: PlannerWorksheet) -> WorksheetArrangement {
        arrangements[worksheet] ?? .standard
    }

    public func failed(_ worksheet: PlannerWorksheet) -> Bool {
        switch worksheet {
        case .overview: return failures.contains(.dashboard)
        case .tasks: return failures.contains(.tasks)
        case .budget: return failures.contains(.budget)
        case .guests: return failures.contains(.guests)
        case .vendors: return failures.contains(.vendors)
        case .contributions: return failures.contains(.contributions)
        case .seating: return failures.contains(.seating)
        case .timeline: return failures.contains(.programme)
        case .documents: return failures.contains(.documents)
        }
    }

    public func loadIfNeeded() async {
        if !hasLoaded && !isLoading { await load() }
    }

    /// Reloads every section the grant allows. A section that fails is reported, never filled in.
    public func load() async {
        isLoading = true
        var next = WeddingPlanSnapshot()
        var failed = Set<DataSection>()
        let access = self.access

        func fetch<T>(_ section: DataSection, _ capability: Capability, _ work: () async throws -> T) async -> T? {
            guard access.can(capability) else { return nil }
            do { return try await work() } catch {
                failed.insert(section)
                return nil
            }
        }

        next.wedding = await fetch(.wedding, .viewWeddingSummary) { try await access.weddingSummary() }
        next.dashboard = await fetch(.dashboard, .viewPlanningDashboard) { try await access.dashboard() }
        next.tasks = await fetch(.tasks, .viewTasks) { try await access.tasks() } ?? []
        next.budgetLines = await fetch(.budget, .viewBudget) { try await access.budgetLines() } ?? []
        next.currency = await fetch(.budget, .viewBudget) { try await access.budget().currency }
        next.guests = await fetch(.guests, .viewGuestRoster) { try await access.guestRoster() } ?? []
        next.vendors = await fetch(.vendors, .viewAllVendorEngagements) { try await access.vendorEngagements() } ?? []
        next.contributions = await fetch(.contributions, .viewContributions) { try await access.contributions() } ?? []
        next.seating = await fetch(.seating, .viewSeating) { try await access.seating() } ?? []
        next.programme = await fetch(.programme, .viewProgramme) { try await access.programme() } ?? []
        next.documents = await fetch(.documents, .viewDocuments) { try await access.documents() } ?? []
        next.presence = await fetch(.presence, .viewVendorPresence) { try await access.vendorPresence() } ?? []
        let summary = await fetch(.admission, .viewAdmissionSummary) { try await access.admissionSummary() }

        data = next
        admission = summary
        failures = failed
        hasLoaded = true
        isLoading = false
        lastRefreshed = Date()
    }

    public func refreshAdmission() async {
        guard access.can(.viewAdmissionSummary) else { return }
        if let summary = try? await access.admissionSummary() {
            admission = summary
            failures.remove(.admission)
        }
    }

    private func replace(_ task: PlannerTask) {
        if let index = data.tasks.firstIndex(where: { $0.id == task.id }) {
            data.tasks[index] = task
        }
    }

    /// Returns nil on success, or a plain error message. The list only changes after the write succeeds.
    public func toggle(taskId: String) async -> String? {
        do {
            replace(try await access.toggleTask(taskId: taskId))
            return nil
        } catch {
            return "This task couldn't be updated. Please try again."
        }
    }

    public enum BulkTaskChange { case markDone, markToDo }

    /// Tasks among the selection that the change applies to. "Mark to do" only reopens done tasks.
    public func tasksAffected(by change: BulkTaskChange, in ids: Set<String>) -> [PlannerTask] {
        data.tasks.filter { ids.contains($0.id) }.filter { task in
            switch change {
            case .markDone: return task.status != .done
            case .markToDo: return task.status == .done
            }
        }
    }

    /// Applies a bulk change and reports how many tasks actually changed.
    public func apply(_ change: BulkTaskChange, to ids: Set<String>) async -> (changed: Int, failed: Int) {
        var changed = 0
        var failedCount = 0
        for task in tasksAffected(by: change, in: ids) {
            do {
                replace(try await access.toggleTask(taskId: task.id))
                changed += 1
            } catch {
                failedCount += 1
            }
        }
        return (changed, failedCount)
    }

    @discardableResult
    public func createTask(title: String, priority: TaskPriority, category: String) async throws -> PlannerTask {
        let task = try await access.createTask(title: title, priority: priority, category: category)
        data.tasks.append(task)
        return task
    }

    @discardableResult
    public func updateWedding(_ update: WeddingDetailsUpdate) async throws -> Wedding {
        let wedding = try await access.updateWeddingDetails(update)
        data.wedding = wedding
        return wedding
    }

    /// Creates one task per valid row and records the outcome for "Imports on this device".
    public func importTasks(_ preview: TaskImportPreview) async -> ImportRecord {
        var created = 0
        var errors = preview.rowErrors
        for row in preview.validRows {
            do {
                try await createTask(title: row.title, priority: row.priority, category: row.category)
                created += 1
            } catch {
                errors.append(ImportRowError(rowNumber: row.rowNumber, message: "This row couldn't be saved."))
            }
        }
        let record = ImportRecord(
            worksheet: .tasks,
            importedAt: Date(),
            created: created,
            skipped: preview.validRows.count - created + preview.rowErrors.count,
            errors: errors.sorted { $0.rowNumber < $1.rowNumber }
        )
        imports.insert(record, at: 0)
        return record
    }
}
