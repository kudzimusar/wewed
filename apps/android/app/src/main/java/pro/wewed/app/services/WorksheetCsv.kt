package pro.wewed.app.services

import pro.wewed.app.models.*

/** Planner worksheets, in the web workspace order. moduleKey matches the web import/export module. */
enum class PlannerWorksheet(val slug: String, val title: String, val moduleKey: String?) {
    OVERVIEW("overview", "Overview", null),
    TASKS("tasks", "Tasks", "checklist"),
    BUDGET("budget", "Budget", "budget"),
    GUESTS("guests", "Guests", "guests"),
    VENDORS("vendors", "Vendors", "vendors"),
    CONTRIBUTIONS("contributions", "Contributions", "contributions"),
    SEATING("seating", "Seating", "seating"),
    TIMELINE("timeline", "Timeline", "timeline"),
    DOCUMENTS("documents", "Documents", "documents");

    val supportsExport: Boolean get() = moduleKey != null
    /** Only task rows can be created by the native repositories today; other imports stay on the web workspace. */
    val supportsImport: Boolean get() = this == TASKS

    val exportFileName: String get() = "wewed-${moduleKey ?: slug}-export.csv"
    val templateFileName: String get() = "wewed-${moduleKey ?: slug}-template.csv"
}

data class TaskImportRow(
    val rowNumber: Int,
    val title: String,
    val category: String,
    val priority: TaskPriority,
    val status: TaskStatus,
    val dueDate: String?
)

data class ImportRowError(val rowNumber: Int, val message: String)

data class TaskImportPreview(
    val validRows: List<TaskImportRow>,
    val rowErrors: List<ImportRowError>,
    val headerErrors: List<String>
) {
    val canImport: Boolean get() = headerErrors.isEmpty() && validRows.isNotEmpty()
}

/** A completed import on this device, shown under "Recent imports". */
data class ImportRecord(
    val worksheet: PlannerWorksheet,
    val importedAtMillis: Long,
    val created: Int,
    val skipped: Int,
    val errors: List<ImportRowError>
)

/**
 * CSV export, template and task import for planner worksheets. Column labels match the web
 * import engine (src/lib/import-engine) so files move between mobile and web unchanged.
 * Fields the native data does not carry are left blank, never filled in.
 */
object WorksheetCsv {
    val taskCategories = listOf(
        "timeline_12_18", "timeline_9_12", "timeline_6_9", "timeline_3_6",
        "timeline_2mo", "timeline_1mo", "timeline_2wk", "timeline_1wk",
        "wedding_day", "spiritual", "venue", "catering", "attire", "roora",
        "magumo", "transport", "stationery", "decor", "photo_video", "music", "other"
    )

    /** The web accepts low, medium and high; "urgent" exists natively but is not importable. */
    private val importablePriorities = listOf(TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH)

    fun headers(worksheet: PlannerWorksheet): List<String> = when (worksheet) {
        PlannerWorksheet.OVERVIEW -> emptyList()
        PlannerWorksheet.TASKS -> listOf("Task ID", "Task", "Category", "Description", "Assigned Person", "Due Date", "Priority", "Status", "Order")
        PlannerWorksheet.BUDGET -> listOf("Budget Item ID", "Category", "Description", "Estimated Cost", "Actual Cost", "Paid Amount", "Currency", "Vendor ID", "Vendor", "Notes", "Due Date")
        PlannerWorksheet.GUESTS -> listOf(
            "Guest ID", "First Name", "Last Name", "Display Name", "Email", "Phone", "Family/Group", "Invitation Status",
            "RSVP Status", "Number Attending", "Plus-One Name", "Number of Children", "Dietary", "Accessibility",
            "Transport", "Accommodation", "Table Assignment", "Seat Assignment", "Public Notes", "Private Notes"
        )
        PlannerWorksheet.VENDORS -> listOf("Vendor ID", "Vendor Name", "Category", "Description", "Contact", "Phone", "Website", "Contract Status", "Payment Status", "Rating", "Notes", "Featured")
        PlannerWorksheet.CONTRIBUTIONS -> listOf(
            "Contribution ID", "Contributor ID", "Contributor Name", "Contributor Email", "Relationship", "Contribution Type",
            "Contribution", "Amount", "Currency", "Estimated In-kind Value", "Quantity", "Unit", "Status", "Expected Date", "Notes"
        )
        PlannerWorksheet.SEATING -> listOf("Guest ID", "Guest Name", "Table ID", "Table Name", "Table Capacity")
        PlannerWorksheet.TIMELINE -> listOf("Timeline Item ID", "Time", "Activity", "Description", "Duration", "Location", "Icon", "Order")
        PlannerWorksheet.DOCUMENTS -> listOf("Document ID", "Title", "Kind", "Status")
    }

    fun template(worksheet: PlannerWorksheet): String = encode(headers(worksheet), emptyList())

    fun tasks(tasks: List<PlannerTask>): String = encode(
        headers(PlannerWorksheet.TASKS),
        tasks.mapIndexed { index, t ->
            listOf(t.id, t.title, t.category, "", "", t.dueDate.orEmpty(), t.priority.value, t.status.value, (index + 1).toString())
        }
    )

    fun budget(lines: List<PlannerBudgetLine>, currency: String): String = encode(
        headers(PlannerWorksheet.BUDGET),
        lines.map { l ->
            listOf(l.id, l.category, "", money(l.estimated), money(l.actual), money(l.paid), currency, "", l.vendorName.orEmpty(), "", l.dueDateLabel.orEmpty())
        }
    )

    fun guests(guests: List<Guest>): String = encode(
        headers(PlannerWorksheet.GUESTS),
        guests.map { g ->
            listOf(
                g.id, "", "", g.name, "", "", g.householdName.orEmpty(), "", g.rsvpStatus.value, g.partySize.toString(),
                "", "", "", "", "", "", g.tableName.orEmpty(), "", "", ""
            )
        }
    )

    fun vendors(engagements: List<PlannerVendorEngagement>): String = encode(
        headers(PlannerWorksheet.VENDORS),
        engagements.map { v ->
            listOf(v.vendorId.orEmpty(), v.vendorName, v.category, v.nextAction, "", "", "", v.contractStatus, v.paymentStatus, "", "", "")
        }
    )

    fun contributions(records: List<PlannerContributionRecord>): String = encode(
        headers(PlannerWorksheet.CONTRIBUTIONS),
        records.map { c ->
            listOf(c.id, c.contributorGuestId.orEmpty(), c.contributorLabel, "", "", c.typeLabel, c.messageText.orEmpty(), "", "", "", "", "", c.statusLabel, "", "")
        }
    )

    fun seating(guests: List<Guest>, tables: List<PlannerSeatingTable>): String {
        val byName = tables.associateBy { it.name }
        return encode(
            headers(PlannerWorksheet.SEATING),
            guests.filter { !it.tableName.isNullOrBlank() }.map { g ->
                val table = byName[g.tableName]
                listOf(g.id, g.name, table?.id.orEmpty(), g.tableName.orEmpty(), table?.capacity?.toString().orEmpty())
            }
        )
    }

    fun timeline(entries: List<PlannerTimelineEntry>): String = encode(
        headers(PlannerWorksheet.TIMELINE),
        entries.mapIndexed { index, e -> listOf(e.id, e.time, e.title, "", "", e.location, "", (index + 1).toString()) }
    )

    fun documents(records: List<PlannerDocumentRecord>): String = encode(
        headers(PlannerWorksheet.DOCUMENTS),
        records.map { d -> listOf(d.id, d.title, d.kind, d.statusLabel.orEmpty()) }
    )

    /** RFC 4180: CRLF line endings; fields with comma, quote or line break are quoted and quotes doubled. */
    fun encode(headers: List<String>, rows: List<List<String>>): String {
        val sb = StringBuilder()
        (listOf(headers) + rows).forEach { row ->
            sb.append(row.joinToString(",") { field -> escape(field) }).append("\r\n")
        }
        return sb.toString()
    }

    private fun escape(field: String): String =
        if (field.any { it == ',' || it == '"' || it == '\n' || it == '\r' }) "\"" + field.replace("\"", "\"\"") + "\"" else field

    /** RFC 4180 parser. Tolerates LF-only files and a UTF-8 byte-order mark; drops fully blank lines. */
    fun parse(text: String): List<List<String>> {
        val input = text.removePrefix("﻿")
        val rows = mutableListOf<List<String>>()
        var row = mutableListOf<String>()
        val field = StringBuilder()
        var inQuotes = false
        var i = 0
        fun endField() { row.add(field.toString()); field.setLength(0) }
        fun endRow() {
            endField()
            if (!(row.size == 1 && row[0].isEmpty())) rows.add(row)
            row = mutableListOf()
        }
        while (i < input.length) {
            val c = input[i]
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < input.length && input[i + 1] == '"') { field.append('"'); i++ } else inQuotes = false
                } else field.append(c)
            } else when (c) {
                '"' -> inQuotes = true
                ',' -> endField()
                '\r' -> { if (i + 1 < input.length && input[i + 1] == '\n') i++; endRow() }
                '\n' -> endRow()
                else -> field.append(c)
            }
            i++
        }
        if (field.isNotEmpty() || row.isNotEmpty()) endRow()
        return rows
    }

    /** Validates a task import exactly like the web rules: Task and Category required, enums and dates checked. */
    fun previewTaskImport(text: String): TaskImportPreview {
        val rows = parse(text)
        if (rows.isEmpty()) return TaskImportPreview(emptyList(), emptyList(), listOf("The file is empty."))
        val header = rows.first().map { it.trim() }
        val index = header.withIndex().associate { (i, name) -> name.lowercase() to i }
        val missing = listOf("Task", "Category").filter { it.lowercase() !in index }
        if (missing.isNotEmpty()) {
            return TaskImportPreview(emptyList(), emptyList(), missing.map { "Missing required column: $it" })
        }
        fun cell(row: List<String>, name: String): String =
            index[name.lowercase()]?.let { row.getOrNull(it) }?.trim().orEmpty()

        val valid = mutableListOf<TaskImportRow>()
        val errors = mutableListOf<ImportRowError>()
        rows.drop(1).forEachIndexed { offset, row ->
            val rowNumber = offset + 2
            val problems = mutableListOf<String>()
            val title = cell(row, "Task")
            val category = cell(row, "Category").lowercase()
            val priorityRaw = cell(row, "Priority").lowercase()
            val statusRaw = cell(row, "Status").lowercase()
            val due = cell(row, "Due Date")
            if (title.isEmpty()) problems += "Task is required."
            if (title.length > 4096) problems += "Task is longer than 4096 characters."
            if (category.isEmpty()) problems += "Category is required."
            else if (category !in taskCategories) problems += "Category \"$category\" is not a recognised task category."
            val priority = if (priorityRaw.isEmpty()) TaskPriority.MEDIUM
                else importablePriorities.firstOrNull { it.value == priorityRaw }.also { if (it == null) problems += "Priority must be low, medium or high." }
            val status = if (statusRaw.isEmpty()) TaskStatus.TODO
                else TaskStatus.entries.firstOrNull { it.value == statusRaw }.also { if (it == null) problems += "Status must be todo, in_progress, done or blocked." }
            if (due.isNotEmpty() && !isIsoDate(due)) problems += "Due Date must be a date like 2026-10-01."
            if (problems.isEmpty()) {
                valid += TaskImportRow(rowNumber, title, category, priority!!, status!!, due.ifEmpty { null })
            } else {
                errors += ImportRowError(rowNumber, problems.joinToString(" "))
            }
        }
        return TaskImportPreview(valid, errors, emptyList())
    }

    private fun isIsoDate(value: String): Boolean =
        runCatching { java.time.LocalDate.parse(value.take(10)) }.isSuccess && Regex("""\d{4}-\d{2}-\d{2}.*""").matches(value)

    private fun money(value: Double): String =
        if (value == Math.floor(value)) value.toLong().toString() else String.format(java.util.Locale.ROOT, "%.2f", value)
}
