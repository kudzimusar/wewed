import Foundation

// Pure, testable helpers behind the wedding-management screens (couple plan and planner workspace).
// Everything here works on values already loaded through RoleScopedAccess; nothing is invented.

/// Everything a wedding-management shell has loaded, as plain values.
public struct WeddingPlanSnapshot: Equatable, Sendable {
    public var wedding: Wedding?
    public var dashboard: PlannerDashboardSnapshot?
    public var tasks: [PlannerTask]
    public var budgetLines: [PlannerBudgetLine]
    public var currency: String?
    public var guests: [Guest]
    public var vendors: [PlannerVendorEngagement]
    public var contributions: [PlannerContributionRecord]
    public var seating: [PlannerSeatingTable]
    public var programme: [PlannerTimelineEntry]
    public var documents: [PlannerDocumentRecord]
    public var presence: [VendorPresence]

    public init(
        wedding: Wedding? = nil,
        dashboard: PlannerDashboardSnapshot? = nil,
        tasks: [PlannerTask] = [],
        budgetLines: [PlannerBudgetLine] = [],
        currency: String? = nil,
        guests: [Guest] = [],
        vendors: [PlannerVendorEngagement] = [],
        contributions: [PlannerContributionRecord] = [],
        seating: [PlannerSeatingTable] = [],
        programme: [PlannerTimelineEntry] = [],
        documents: [PlannerDocumentRecord] = [],
        presence: [VendorPresence] = []
    ) {
        self.wedding = wedding
        self.dashboard = dashboard
        self.tasks = tasks
        self.budgetLines = budgetLines
        self.currency = currency
        self.guests = guests
        self.vendors = vendors
        self.contributions = contributions
        self.seating = seating
        self.programme = programme
        self.documents = documents
        self.presence = presence
    }
}

// MARK: - Plain words for recorded statuses

public enum PlainStatus {
    public static func rsvp(_ status: RSVPStatus) -> String {
        switch status {
        case .attending: return "Attending"
        case .declined: return "Declined"
        case .pending: return "Not replied"
        }
    }

    public static func task(_ status: TaskStatus) -> String {
        switch status {
        case .todo: return "To do"
        case .inProgress: return "In progress"
        case .blocked: return "Blocked"
        case .done: return "Done"
        }
    }

    public static func contributor(_ record: PlannerContributionRecord) -> String {
        record.contributorResolution == .notRecorded ? "Contributor not recorded" : record.contributorLabel
    }

    /// "Public · 41 words · 18 Jun 2026"; parts the record does not carry are left out.
    public static func contributionFacts(_ record: PlannerContributionRecord) -> String? {
        var parts: [String] = []
        if let privacy = record.privacyLabel?.trimmingCharacters(in: .whitespaces), !privacy.isEmpty { parts.append(privacy) }
        if let words = record.wordCount { parts.append(words == 1 ? "1 word" : "\(words) words") }
        if let submitted = record.submittedAtLabel?.trimmingCharacters(in: .whitespaces), !submitted.isEmpty { parts.append(submitted) }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    public static let messageUnavailable = "Message text isn't available in the app yet."

    public static func plural(_ count: Int, _ singular: String, _ pluralForm: String? = nil) -> String {
        "\(count) " + (count == 1 ? singular : (pluralForm ?? singular + "s"))
    }

    /// Capitalises the first letter of a recorded code such as "photo_video" for display.
    public static func label(_ raw: String) -> String {
        let spaced = raw.replacingOccurrences(of: "_", with: " ").trimmingCharacters(in: .whitespaces)
        guard let first = spaced.first else { return raw }
        return first.uppercased() + spaced.dropFirst()
    }
}

// MARK: - Dates as recorded ("2026-12-23 14:00:00", "2026-10-24T14:00:00Z", "2026-12-17")

public enum WeddingDateText {
    private static func formatter(_ format: String, utc: Bool = false) -> DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = format
        if utc { f.timeZone = TimeZone(identifier: "UTC") }
        return f
    }

    public static func parse(_ raw: String) -> Date? {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if let date = formatter("yyyy-MM-dd HH:mm:ss").date(from: value) { return date }
        if let date = ISO8601DateFormatter().date(from: value) { return date }
        if value.count >= 10 { return formatter("yyyy-MM-dd").date(from: String(value.prefix(10))) }
        return nil
    }

    /// The calendar day a recorded value falls on, at the start of that day.
    public static func day(_ raw: String?, calendar: Calendar = .current) -> Date? {
        guard let raw, let date = parse(raw) else { return nil }
        return calendar.startOfDay(for: date)
    }

    /// "Wednesday 23 December 2026"; the recorded text if it cannot be read as a date.
    public static func long(_ raw: String) -> String {
        guard let date = parse(raw) else { return raw }
        return formatter("EEEE d MMMM yyyy").string(from: date)
    }

    /// "23 Dec 2026".
    public static func short(_ raw: String) -> String {
        guard let date = parse(raw) else { return raw }
        return formatter("d MMM yyyy").string(from: date)
    }

    /// "14:00" when the record carries a time of day; nil for date-only values.
    public static func time(_ raw: String) -> String? {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard value.count > 10, let date = parse(value) else { return nil }
        let text = formatter("HH:mm").string(from: date)
        return text == "00:00" ? nil : text
    }

    /// "Wednesday 23 December 2026 at 14:00".
    public static func longWithTime(_ raw: String) -> String {
        guard let time = time(raw) else { return long(raw) }
        return long(raw) + " at " + time
    }

    /// Same shape as the repositories record: "yyyy-MM-dd HH:mm:ss".
    public static func record(_ date: Date) -> String {
        formatter("yyyy-MM-dd HH:mm:ss").string(from: date)
    }
}

// MARK: - Money

public enum WeddingMoney {
    public static func format(_ amount: Double, currency: String?) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US")
        if let currency, !currency.isEmpty {
            formatter.numberStyle = .currency
            formatter.currencyCode = currency
        } else {
            formatter.numberStyle = .decimal
        }
        formatter.maximumFractionDigits = amount == amount.rounded() ? 0 : 2
        formatter.minimumFractionDigits = amount == amount.rounded() ? 0 : 2
        return formatter.string(from: NSNumber(value: amount)) ?? String(amount)
    }
}

// MARK: - Arrange (this device)

public enum WorksheetArrangement: String, CaseIterable, Identifiable, Sendable {
    case standard
    case name
    case status
    case dueDate

    public var id: String { rawValue }

    public var title: String {
        switch self {
        case .standard: return "Default"
        case .name: return "Name A–Z"
        case .status: return "Status"
        case .dueDate: return "Due date"
        }
    }

    public var slug: String {
        switch self {
        case .standard: return "default"
        case .name: return "name"
        case .status: return "status"
        case .dueDate: return "due-date"
        }
    }

    public static func options(for worksheet: PlannerWorksheet) -> [WorksheetArrangement] {
        switch worksheet {
        case .overview: return []
        case .tasks, .budget: return [.standard, .name, .status, .dueDate]
        case .seating: return [.standard, .name]
        case .guests, .vendors, .contributions, .timeline, .documents: return [.standard, .name, .status]
        }
    }
}

private func stableSorted<T>(_ items: [T], by key: (T) -> (Int, String)) -> [T] {
    items.enumerated().sorted { lhs, rhs in
        let a = key(lhs.element), b = key(rhs.element)
        if a.0 != b.0 { return a.0 < b.0 }
        let order = a.1.localizedCaseInsensitiveCompare(b.1)
        if order != .orderedSame { return order == .orderedAscending }
        return lhs.offset < rhs.offset
    }.map(\.element)
}

extension WeddingPlanSnapshot {
    public func arrangedTasks(_ arrangement: WorksheetArrangement) -> [PlannerTask] {
        switch arrangement {
        case .standard: return tasks
        case .name: return stableSorted(tasks) { (0, $0.title) }
        case .status: return stableSorted(tasks) { (TaskStatus.allCases.firstIndex(of: $0.status) ?? 0, "") }
        case .dueDate:
            return stableSorted(tasks) { task in
                guard let due = task.dueDate, WeddingDateText.parse(due) != nil else { return (1, "") }
                return (0, String(due.prefix(10)))
            }
        }
    }

    public func arrangedBudget(_ arrangement: WorksheetArrangement) -> [PlannerBudgetLine] {
        switch arrangement {
        case .standard: return budgetLines
        case .name: return stableSorted(budgetLines) { (0, $0.category + " " + ($0.vendorName ?? "")) }
        case .status: return stableSorted(budgetLines) { (0, $0.statusLabel) }
        case .dueDate:
            return stableSorted(budgetLines) { line in
                guard let due = line.dueDateLabel, WeddingDateText.parse(due) != nil else { return (1, "") }
                return (0, String(due.prefix(10)))
            }
        }
    }

    public func arrangedGuests(_ arrangement: WorksheetArrangement) -> [Guest] {
        let order: [RSVPStatus] = [.attending, .pending, .declined]
        switch arrangement {
        case .standard, .dueDate: return guests
        case .name: return stableSorted(guests) { (0, $0.name) }
        case .status: return stableSorted(guests) { (order.firstIndex(of: $0.rsvpStatus) ?? 0, "") }
        }
    }

    public func arrangedVendors(_ arrangement: WorksheetArrangement) -> [PlannerVendorEngagement] {
        switch arrangement {
        case .standard, .dueDate: return vendors
        case .name: return stableSorted(vendors) { (0, $0.vendorName) }
        case .status: return stableSorted(vendors) { (0, $0.bookingStatus + " " + $0.contractStatus + " " + $0.paymentStatus) }
        }
    }

    public func arrangedContributions(_ arrangement: WorksheetArrangement) -> [PlannerContributionRecord] {
        switch arrangement {
        case .standard, .dueDate: return contributions
        case .name: return stableSorted(contributions) { (0, PlainStatus.contributor($0)) }
        case .status: return stableSorted(contributions) { (0, $0.statusLabel) }
        }
    }

    public func arrangedSeating(_ arrangement: WorksheetArrangement) -> [PlannerSeatingTable] {
        switch arrangement {
        case .name: return stableSorted(seating) { (0, $0.name) }
        default: return seating
        }
    }

    public func arrangedProgramme(_ arrangement: WorksheetArrangement) -> [PlannerTimelineEntry] {
        switch arrangement {
        case .standard, .dueDate: return programme
        case .name: return stableSorted(programme) { (0, $0.title) }
        case .status: return stableSorted(programme) { (0, $0.statusLabel) }
        }
    }

    /// The programme in time-of-day order, for run sheets.
    public var programmeByTime: [PlannerTimelineEntry] {
        stableSorted(programme) { (0, $0.time) }
    }

    public func arrangedDocuments(_ arrangement: WorksheetArrangement) -> [PlannerDocumentRecord] {
        switch arrangement {
        case .standard, .dueDate: return documents
        case .name: return stableSorted(documents) { (0, $0.title) }
        case .status: return stableSorted(documents) { (0, $0.statusLabel ?? "") }
        }
    }

    /// Row ids in display order; these are what "Select" works with.
    public func rowIds(_ worksheet: PlannerWorksheet, _ arrangement: WorksheetArrangement) -> [String] {
        switch worksheet {
        case .overview: return []
        case .tasks: return arrangedTasks(arrangement).map(\.id)
        case .budget: return arrangedBudget(arrangement).map(\.id)
        case .guests: return arrangedGuests(arrangement).map(\.id)
        case .vendors: return arrangedVendors(arrangement).map(\.id)
        case .contributions: return arrangedContributions(arrangement).map(\.id)
        case .seating: return arrangedSeating(arrangement).map(\.id)
        case .timeline: return arrangedProgramme(arrangement).map(\.id)
        case .documents: return arrangedDocuments(arrangement).map(\.id)
        }
    }

    private func keep<T: Identifiable>(_ items: [T], _ only: Set<String>?) -> [T] where T.ID == String {
        guard let only else { return items }
        return items.filter { only.contains($0.id) }
    }

    /// CSV for Export / Export selected, in the web import-engine format. Nil for Overview.
    public func csv(_ worksheet: PlannerWorksheet, arrangement: WorksheetArrangement, only: Set<String>? = nil) -> String? {
        switch worksheet {
        case .overview: return nil
        case .tasks: return WorksheetCsv.tasks(keep(arrangedTasks(arrangement), only))
        case .budget: return WorksheetCsv.budget(keep(arrangedBudget(arrangement), only), currency: currency ?? "")
        case .guests: return WorksheetCsv.guests(keep(arrangedGuests(arrangement), only))
        case .vendors: return WorksheetCsv.vendors(keep(arrangedVendors(arrangement), only))
        case .contributions: return WorksheetCsv.contributions(keep(arrangedContributions(arrangement), only))
        case .seating:
            let tables = keep(arrangedSeating(arrangement), only)
            let names = Set(tables.map(\.name))
            let seated = only == nil ? guests : guests.filter { names.contains($0.tableName ?? "") }
            return WorksheetCsv.seating(seated, tables: tables)
        case .timeline: return WorksheetCsv.timeline(keep(arrangedProgramme(arrangement), only))
        case .documents: return WorksheetCsv.documents(keep(arrangedDocuments(arrangement), only))
        }
    }

    /// The columns shown on screen, for Print / Print selected.
    public func table(_ worksheet: PlannerWorksheet, arrangement: WorksheetArrangement, only: Set<String>? = nil) -> WorksheetTable {
        let money: (Double) -> String = { WeddingMoney.format($0, currency: currency) }
        switch worksheet {
        case .overview:
            var rows: [[String]] = []
            if let dashboard {
                rows.append(["Tasks complete", dashboard.taskCompletionLabel, ""])
                rows += dashboard.modules.map { [$0.title, $0.value, $0.attention ?? ""] }
            }
            return WorksheetTable(headers: ["Area", "Figure", "Note"], rows: rows)
        case .tasks:
            return WorksheetTable(
                headers: ["Task", "Category", "Priority", "Status", "Due date"],
                rows: keep(arrangedTasks(arrangement), only).map {
                    [$0.title, PlainStatus.label($0.category), $0.priority.title, PlainStatus.task($0.status), $0.dueDate.map(WeddingDateText.short) ?? ""]
                }
            )
        case .budget:
            return WorksheetTable(
                headers: ["Category", "Vendor", "Estimated", "Actual", "Paid", "Status"],
                rows: keep(arrangedBudget(arrangement), only).map {
                    [PlainStatus.label($0.category), $0.vendorName ?? "", money($0.estimated), money($0.actual), money($0.paid), $0.statusLabel]
                }
            )
        case .guests:
            return WorksheetTable(
                headers: ["Guest", "RSVP", "Party size", "Table"],
                rows: keep(arrangedGuests(arrangement), only).map {
                    [$0.name, PlainStatus.rsvp($0.rsvpStatus), String($0.partySize), $0.tableName ?? ""]
                }
            )
        case .vendors:
            return WorksheetTable(
                headers: ["Vendor", "Service", "Booking", "Contract", "Payment"],
                rows: keep(arrangedVendors(arrangement), only).map {
                    [$0.vendorName, PlainStatus.label($0.category), $0.bookingStatus, $0.contractStatus, $0.paymentStatus]
                }
            )
        case .contributions:
            return WorksheetTable(
                headers: ["Contributor", "Type", "Status", "Details"],
                rows: keep(arrangedContributions(arrangement), only).map {
                    [PlainStatus.contributor($0), $0.typeLabel, $0.statusLabel, PlainStatus.contributionFacts($0) ?? ""]
                }
            )
        case .seating:
            return WorksheetTable(
                headers: ["Table", "Group", "Capacity", "Assigned"],
                rows: keep(arrangedSeating(arrangement), only).map {
                    [$0.name, $0.zone, String($0.capacity), String($0.assigned)]
                }
            )
        case .timeline:
            return WorksheetTable(
                headers: ["Time", "Activity", "Location", "Status"],
                rows: keep(arrangedProgramme(arrangement), only).map { [$0.time, $0.title, $0.location, $0.statusLabel] }
            )
        case .documents:
            return WorksheetTable(
                headers: ["Document", "Kind", "Status"],
                rows: keep(arrangedDocuments(arrangement), only).map { [$0.title, $0.kind, $0.statusLabel ?? ""] }
            )
        }
    }
}

/// A printable table. HTML output escapes every recorded value.
public struct WorksheetTable: Equatable, Sendable {
    public let headers: [String]
    public let rows: [[String]]

    public init(headers: [String], rows: [[String]]) {
        self.headers = headers
        self.rows = rows
    }

    public static func escape(_ text: String) -> String {
        text
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&#39;")
    }

    public func html(title: String, subtitle: String) -> String {
        let head = headers.map { "<th>\(Self.escape($0))</th>" }.joined()
        let body = rows.isEmpty
            ? "<tr><td colspan=\"\(max(headers.count, 1))\">No rows recorded.</td></tr>"
            : rows.map { "<tr>" + $0.map { "<td>\(Self.escape($0))</td>" }.joined() + "</tr>" }.joined(separator: "\n")
        return """
        <html><head><meta charset="utf-8"><style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 11pt; color: #13212B; }
        h1 { font-size: 16pt; margin: 0 0 4pt 0; } p { margin: 0 0 10pt 0; color: #555; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #999; padding: 4pt 6pt; text-align: left; vertical-align: top; }
        th { background: #f1ece2; }
        </style></head><body>
        <h1>\(Self.escape(title))</h1><p>\(Self.escape(subtitle))</p>
        <table><thead><tr>\(head)</tr></thead><tbody>
        \(body)
        </tbody></table></body></html>
        """
    }
}

// MARK: - Daily Ops and Intelligence

public struct DailyOpsSummary: Equatable, Sendable {
    public let overdue: [PlannerTask]
    public let dueSoon: [PlannerTask]
    public let highPriorityOpen: [PlannerTask]
    public let guestsNotReplied: Int
    public let totalGuests: Int
}

public struct PlannerRecommendation: Identifiable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let detail: String
    public let evidenceCount: Int
    public let evidenceLabel: String
    public let suggestedTaskTitle: String
    public let suggestedPriority: TaskPriority
    public let suggestedCategory: String
}

public enum PlannerInsights {
    public static func isOpen(_ task: PlannerTask) -> Bool { task.status != .done }

    public static func dailyOps(_ data: WeddingPlanSnapshot, today: Date, calendar: Calendar = .current) -> DailyOpsSummary {
        let start = calendar.startOfDay(for: today)
        let weekAhead = calendar.date(byAdding: .day, value: 7, to: start) ?? start
        let open = data.tasks.filter(isOpen)
        let overdue = open.filter { task in
            guard let due = WeddingDateText.day(task.dueDate, calendar: calendar) else { return false }
            return due < start
        }
        let dueSoon = open.filter { task in
            guard let due = WeddingDateText.day(task.dueDate, calendar: calendar) else { return false }
            return due >= start && due <= weekAhead
        }
        let high = open.filter { $0.priority == .high || $0.priority == .urgent }
        return DailyOpsSummary(
            overdue: overdue,
            dueSoon: dueSoon,
            highPriorityOpen: high,
            guestsNotReplied: data.guests.filter { $0.rsvpStatus == .pending }.count,
            totalGuests: data.guests.count
        )
    }

    public static func recommendations(_ data: WeddingPlanSnapshot, today: Date, calendar: Calendar = .current) -> [PlannerRecommendation] {
        let ops = dailyOps(data, today: today, calendar: calendar)
        var result: [PlannerRecommendation] = []

        if !ops.overdue.isEmpty {
            let n = ops.overdue.count
            result.append(PlannerRecommendation(
                id: "overdue-tasks",
                title: "\(PlainStatus.plural(n, "task")) overdue",
                detail: "Open tasks whose due date has passed.",
                evidenceCount: n,
                evidenceLabel: PlainStatus.plural(n, "task"),
                suggestedTaskTitle: "Review \(PlainStatus.plural(n, "overdue task"))",
                suggestedPriority: .high,
                suggestedCategory: "other"
            ))
        }

        if !ops.highPriorityOpen.isEmpty {
            let n = ops.highPriorityOpen.count
            result.append(PlannerRecommendation(
                id: "high-priority-open",
                title: "\(PlainStatus.plural(n, "high-priority task")) still open",
                detail: "High and urgent tasks that are not done yet.",
                evidenceCount: n,
                evidenceLabel: PlainStatus.plural(n, "task"),
                suggestedTaskTitle: "Plan next steps for \(PlainStatus.plural(n, "high-priority task"))",
                suggestedPriority: .high,
                suggestedCategory: "other"
            ))
        }

        if ops.guestsNotReplied > 0 && ops.totalGuests > 0 {
            let n = ops.guestsNotReplied
            let percent = Int((Double(n) / Double(ops.totalGuests) * 100).rounded())
            result.append(PlannerRecommendation(
                id: "guests-not-replied",
                title: "\(percent)% of guests have not replied",
                detail: "\(n) of \(PlainStatus.plural(ops.totalGuests, "guest")) have not replied to their invitation.",
                evidenceCount: n,
                evidenceLabel: PlainStatus.plural(n, "guest"),
                suggestedTaskTitle: "Follow up with \(PlainStatus.plural(n, "guest")) who have not replied",
                suggestedPriority: percent >= 50 ? .high : .medium,
                suggestedCategory: "other"
            ))
        }

        let attending = data.guests.filter { $0.rsvpStatus == .attending }
        let attendingGuests = attending.reduce(0) { $0 + $1.partySize }
        let capacity = data.seating.reduce(0) { $0 + $1.capacity }
        let assigned = data.seating.reduce(0) { $0 + $1.assigned }
        let freeSeats = max(capacity - assigned, 0)
        let unseated = attending.filter { ($0.tableName ?? "").trimmingCharacters(in: .whitespaces).isEmpty }
        if attendingGuests > 0 && attendingGuests > capacity {
            result.append(PlannerRecommendation(
                id: "seating-capacity",
                title: "More attending guests than table seats",
                detail: "\(PlainStatus.plural(attendingGuests, "attending guest")) and \(PlainStatus.plural(capacity, "table seat")) recorded.",
                evidenceCount: attendingGuests,
                evidenceLabel: PlainStatus.plural(attendingGuests, "guest"),
                suggestedTaskTitle: "Add table seats for \(PlainStatus.plural(attendingGuests - capacity, "attending guest"))",
                suggestedPriority: .high,
                suggestedCategory: "venue"
            ))
        } else if !unseated.isEmpty {
            let n = unseated.count
            result.append(PlannerRecommendation(
                id: "seating-capacity",
                title: "\(PlainStatus.plural(n, "attending party", "attending parties")) without a table",
                detail: "\(PlainStatus.plural(freeSeats, "free seat")) across \(PlainStatus.plural(data.seating.count, "table")) for \(PlainStatus.plural(attendingGuests, "attending guest")).",
                evidenceCount: n,
                evidenceLabel: PlainStatus.plural(n, "party", "parties"),
                suggestedTaskTitle: "Seat \(PlainStatus.plural(n, "attending party", "attending parties"))",
                suggestedPriority: .medium,
                suggestedCategory: "venue"
            ))
        }

        let unpaid = data.budgetLines.filter { $0.paid <= 0 && ($0.actual > 0 || $0.estimated > 0) }
        if !unpaid.isEmpty {
            let n = unpaid.count
            result.append(PlannerRecommendation(
                id: "unpaid-budget",
                title: "\(PlainStatus.plural(n, "budget line")) with no payment recorded",
                detail: "Budget lines with a cost but nothing paid yet.",
                evidenceCount: n,
                evidenceLabel: PlainStatus.plural(n, "budget line"),
                suggestedTaskTitle: "Review payments for \(PlainStatus.plural(n, "budget line"))",
                suggestedPriority: .medium,
                suggestedCategory: "other"
            ))
        }

        if data.documents.isEmpty && !data.vendors.isEmpty {
            let n = data.vendors.count
            result.append(PlannerRecommendation(
                id: "no-contracts",
                title: "No contracts recorded",
                detail: "\(PlainStatus.plural(n, "vendor")) recorded for this wedding, but no contracts or documents.",
                evidenceCount: n,
                evidenceLabel: PlainStatus.plural(n, "vendor"),
                suggestedTaskTitle: "Collect contracts from \(PlainStatus.plural(n, "vendor"))",
                suggestedPriority: .medium,
                suggestedCategory: "other"
            ))
        }

        return result
    }
}
