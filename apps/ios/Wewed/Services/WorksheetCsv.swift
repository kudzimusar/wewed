import Foundation

/// Planner worksheets, in the web workspace order. moduleKey matches the web import/export module.
/// Mirrors Android `PlannerWorksheet`.
public enum PlannerWorksheet: String, CaseIterable, Identifiable, Sendable {
    case overview, tasks, budget, guests, vendors, contributions, seating, timeline, documents

    public var id: String { rawValue }
    public var slug: String { rawValue }

    public var title: String {
        switch self {
        case .overview: return "Overview"
        case .tasks: return "Tasks"
        case .budget: return "Budget"
        case .guests: return "Guests"
        case .vendors: return "Vendors"
        case .contributions: return "Contributions"
        case .seating: return "Seating"
        case .timeline: return "Timeline"
        case .documents: return "Documents"
        }
    }

    public var moduleKey: String? {
        switch self {
        case .overview: return nil
        case .tasks: return "checklist"
        default: return rawValue
        }
    }

    public var supportsExport: Bool { moduleKey != nil }
    /// Only task rows can be created by the native repositories today; other imports stay on the web workspace.
    public var supportsImport: Bool { self == .tasks }
    public var exportFileName: String { "wewed-\(moduleKey ?? slug)-export.csv" }
    public var templateFileName: String { "wewed-\(moduleKey ?? slug)-template.csv" }
}

public struct TaskImportRow: Equatable, Sendable {
    public let rowNumber: Int
    public let title: String
    public let category: String
    public let priority: TaskPriority
    public let status: TaskStatus
    public let dueDate: String?
}

public struct ImportRowError: Equatable, Sendable {
    public let rowNumber: Int
    public let message: String
}

public struct TaskImportPreview: Equatable, Sendable {
    public let validRows: [TaskImportRow]
    public let rowErrors: [ImportRowError]
    public let headerErrors: [String]

    public var canImport: Bool { headerErrors.isEmpty && !validRows.isEmpty }
}

/// A completed import on this device, shown under "Recent imports".
public struct ImportRecord: Identifiable, Equatable, Sendable {
    public let id = UUID()
    public let worksheet: PlannerWorksheet
    public let importedAt: Date
    public let created: Int
    public let skipped: Int
    public let errors: [ImportRowError]

    public init(worksheet: PlannerWorksheet, importedAt: Date, created: Int, skipped: Int, errors: [ImportRowError]) {
        self.worksheet = worksheet
        self.importedAt = importedAt
        self.created = created
        self.skipped = skipped
        self.errors = errors
    }
}

/// CSV export, template and task import for planner worksheets. Column labels match the web
/// import engine (src/lib/import-engine) so files move between mobile and web unchanged.
/// Fields the native data does not carry are left blank, never filled in. Mirrors Android `WorksheetCsv`.
public enum WorksheetCsv {
    public static let taskCategories = [
        "timeline_12_18", "timeline_9_12", "timeline_6_9", "timeline_3_6",
        "timeline_2mo", "timeline_1mo", "timeline_2wk", "timeline_1wk",
        "wedding_day", "spiritual", "venue", "catering", "attire", "roora",
        "magumo", "transport", "stationery", "decor", "photo_video", "music", "other"
    ]

    /// The web accepts low, medium and high; "urgent" exists natively but is not importable.
    private static let importablePriorities: [TaskPriority] = [.low, .medium, .high]

    public static func headers(_ worksheet: PlannerWorksheet) -> [String] {
        switch worksheet {
        case .overview: return []
        case .tasks: return ["Task ID", "Task", "Category", "Description", "Assigned Person", "Due Date", "Priority", "Status", "Order"]
        case .budget: return ["Budget Item ID", "Category", "Description", "Estimated Cost", "Actual Cost", "Paid Amount", "Currency", "Vendor ID", "Vendor", "Notes", "Due Date"]
        case .guests:
            return [
                "Guest ID", "First Name", "Last Name", "Display Name", "Email", "Phone", "Family/Group", "Invitation Status",
                "RSVP Status", "Number Attending", "Plus-One Name", "Number of Children", "Dietary", "Accessibility",
                "Transport", "Accommodation", "Table Assignment", "Seat Assignment", "Public Notes", "Private Notes"
            ]
        case .vendors: return ["Vendor ID", "Vendor Name", "Category", "Description", "Contact", "Phone", "Website", "Contract Status", "Payment Status", "Rating", "Notes", "Featured"]
        case .contributions:
            return [
                "Contribution ID", "Contributor ID", "Contributor Name", "Contributor Email", "Relationship", "Contribution Type",
                "Contribution", "Amount", "Currency", "Estimated In-kind Value", "Quantity", "Unit", "Status", "Expected Date", "Notes"
            ]
        case .seating: return ["Guest ID", "Guest Name", "Table ID", "Table Name", "Table Capacity"]
        case .timeline: return ["Timeline Item ID", "Time", "Activity", "Description", "Duration", "Location", "Icon", "Order"]
        case .documents: return ["Document ID", "Title", "Kind", "Status"]
        }
    }

    public static func template(_ worksheet: PlannerWorksheet) -> String { encode(headers: headers(worksheet), rows: []) }

    public static func tasks(_ tasks: [PlannerTask]) -> String {
        encode(headers: headers(.tasks), rows: tasks.enumerated().map { index, t in
            [t.id, t.title, t.category, "", "", t.dueDate ?? "", t.priority.rawValue, t.status.rawValue, String(index + 1)]
        })
    }

    public static func budget(_ lines: [PlannerBudgetLine], currency: String) -> String {
        encode(headers: headers(.budget), rows: lines.map { l in
            [l.id, l.category, "", money(l.estimated), money(l.actual), money(l.paid), currency, "", l.vendorName ?? "", "", l.dueDateLabel ?? ""]
        })
    }

    public static func guests(_ guests: [Guest]) -> String {
        encode(headers: headers(.guests), rows: guests.map { g in
            [g.id, "", "", g.name, "", "", g.householdName ?? "", "", g.rsvpStatus.rawValue, String(g.partySize),
             "", "", "", "", "", "", g.tableName ?? "", "", "", ""]
        })
    }

    public static func vendors(_ engagements: [PlannerVendorEngagement]) -> String {
        encode(headers: headers(.vendors), rows: engagements.map { v in
            [v.vendorId ?? "", v.vendorName, v.category, v.nextAction, "", "", "", v.contractStatus, v.paymentStatus, "", "", ""]
        })
    }

    public static func contributions(_ records: [PlannerContributionRecord]) -> String {
        encode(headers: headers(.contributions), rows: records.map { c in
            [c.id, c.contributorGuestId ?? "", c.contributorLabel, "", "", c.typeLabel, c.messageText ?? "", "", "", "", "", "", c.statusLabel, "", ""]
        })
    }

    public static func seating(_ guests: [Guest], tables: [PlannerSeatingTable]) -> String {
        let byName = Dictionary(tables.map { ($0.name, $0) }, uniquingKeysWith: { first, _ in first })
        return encode(headers: headers(.seating), rows: guests.compactMap { g in
            guard let tableName = g.tableName, !tableName.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
            let table = byName[tableName]
            return [g.id, g.name, table?.id ?? "", tableName, table.map { String($0.capacity) } ?? ""]
        })
    }

    public static func timeline(_ entries: [PlannerTimelineEntry]) -> String {
        encode(headers: headers(.timeline), rows: entries.enumerated().map { index, e in
            [e.id, e.time, e.title, "", "", e.location, "", String(index + 1)]
        })
    }

    public static func documents(_ records: [PlannerDocumentRecord]) -> String {
        encode(headers: headers(.documents), rows: records.map { [$0.id, $0.title, $0.kind, $0.statusLabel ?? ""] })
    }

    /// RFC 4180: CRLF line endings; fields with comma, quote or line break are quoted and quotes doubled.
    public static func encode(headers: [String], rows: [[String]]) -> String {
        ([headers] + rows).map { row in row.map(escape).joined(separator: ",") + "\r\n" }.joined()
    }

    private static func escape(_ field: String) -> String {
        if field.contains(where: { $0 == "," || $0 == "\"" || $0 == "\n" || $0 == "\r" || $0 == "\r\n" }) {
            return "\"" + field.replacingOccurrences(of: "\"", with: "\"\"") + "\""
        }
        return field
    }

    /// RFC 4180 parser. Tolerates LF-only files and a UTF-8 byte-order mark; drops fully blank lines.
    public static func parse(_ text: String) -> [[String]] {
        var scalars = Array(text.unicodeScalars)
        if scalars.first == "\u{FEFF}" { scalars.removeFirst() }
        var rows: [[String]] = []
        var row: [String] = []
        var field = String.UnicodeScalarView()
        var inQuotes = false
        var i = 0
        func endField() { row.append(String(field)); field = String.UnicodeScalarView() }
        func endRow() {
            endField()
            if !(row.count == 1 && row[0].isEmpty) { rows.append(row) }
            row = []
        }
        while i < scalars.count {
            let c = scalars[i]
            if inQuotes {
                if c == "\"" {
                    if i + 1 < scalars.count && scalars[i + 1] == "\"" { field.append("\""); i += 1 } else { inQuotes = false }
                } else {
                    field.append(c)
                }
            } else {
                switch c {
                case "\"": inQuotes = true
                case ",": endField()
                case "\r":
                    if i + 1 < scalars.count && scalars[i + 1] == "\n" { i += 1 }
                    endRow()
                case "\n": endRow()
                default: field.append(c)
                }
            }
            i += 1
        }
        if !field.isEmpty || !row.isEmpty { endRow() }
        return rows
    }

    /// Validates a task import exactly like the web rules: Task and Category required, enums and dates checked.
    public static func previewTaskImport(_ text: String) -> TaskImportPreview {
        let rows = parse(text)
        guard let headerRow = rows.first else {
            return TaskImportPreview(validRows: [], rowErrors: [], headerErrors: ["The file is empty."])
        }
        var index: [String: Int] = [:]
        for (i, name) in headerRow.enumerated() where index[name.trimmingCharacters(in: .whitespaces).lowercased()] == nil {
            index[name.trimmingCharacters(in: .whitespaces).lowercased()] = i
        }
        let missing = ["Task", "Category"].filter { index[$0.lowercased()] == nil }
        if !missing.isEmpty {
            return TaskImportPreview(validRows: [], rowErrors: [], headerErrors: missing.map { "Missing required column: \($0)" })
        }
        func cell(_ row: [String], _ name: String) -> String {
            guard let i = index[name.lowercased()], i < row.count else { return "" }
            return row[i].trimmingCharacters(in: .whitespacesAndNewlines)
        }

        var valid: [TaskImportRow] = []
        var errors: [ImportRowError] = []
        for (offset, row) in rows.dropFirst().enumerated() {
            let rowNumber = offset + 2
            var problems: [String] = []
            let title = cell(row, "Task")
            let category = cell(row, "Category").lowercased()
            let priorityRaw = cell(row, "Priority").lowercased()
            let statusRaw = cell(row, "Status").lowercased()
            let due = cell(row, "Due Date")
            if title.isEmpty { problems.append("Task is required.") }
            if title.count > 4096 { problems.append("Task is longer than 4096 characters.") }
            if category.isEmpty {
                problems.append("Category is required.")
            } else if !taskCategories.contains(category) {
                problems.append("Category \"\(category)\" is not a recognised task category.")
            }
            let priority: TaskPriority? = priorityRaw.isEmpty ? .medium : importablePriorities.first { $0.rawValue == priorityRaw }
            if priority == nil { problems.append("Priority must be low, medium or high.") }
            let status: TaskStatus? = statusRaw.isEmpty ? .todo : TaskStatus(rawValue: statusRaw)
            if status == nil { problems.append("Status must be todo, in_progress, done or blocked.") }
            if !due.isEmpty && !isIsoDate(due) { problems.append("Due Date must be a date like 2026-10-01.") }
            if problems.isEmpty, let priority, let status {
                valid.append(TaskImportRow(rowNumber: rowNumber, title: title, category: category, priority: priority, status: status, dueDate: due.isEmpty ? nil : due))
            } else {
                errors.append(ImportRowError(rowNumber: rowNumber, message: problems.joined(separator: " ")))
            }
        }
        return TaskImportPreview(validRows: valid, rowErrors: errors, headerErrors: [])
    }

    private static func isIsoDate(_ value: String) -> Bool {
        guard value.range(of: #"^\d{4}-\d{2}-\d{2}"#, options: .regularExpression) != nil else { return false }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.isLenient = false
        return formatter.date(from: String(value.prefix(10))) != nil
    }

    private static func money(_ value: Double) -> String {
        value == value.rounded() ? String(Int64(value)) : String(format: "%.2f", locale: Locale(identifier: "en_US_POSIX"), value)
    }
}
