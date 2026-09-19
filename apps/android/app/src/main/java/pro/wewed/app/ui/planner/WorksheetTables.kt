package pro.wewed.app.ui.planner

import pro.wewed.app.models.*
import pro.wewed.app.services.PlannerWorksheet
import pro.wewed.app.services.WorksheetCsv
import pro.wewed.app.ui.shared.ContributionText
import pro.wewed.app.ui.shared.Formatting
import pro.wewed.app.ui.shared.rsvpText
import pro.wewed.app.ui.shared.taskStatusText

/** Everything the planner workspace shows, loaded through the planner's scoped access. */
data class PlannerWorkspaceData(
    val wedding: Wedding,
    val dashboard: PlannerDashboardSnapshot,
    val tasks: List<PlannerTask>,
    val budgetLines: List<PlannerBudgetLine>,
    val currency: String,
    val guests: List<Guest>,
    val vendors: List<PlannerVendorEngagement>,
    val contributions: List<PlannerContributionRecord>,
    val seating: List<PlannerSeatingTable>,
    val timeline: List<PlannerTimelineEntry>,
    val documents: List<PlannerDocumentRecord>,
    val presence: List<VendorPresence>,
    val admission: AdmissionSummary
)

/** Row order on this device only; it is never synced (the Actions sheet says so). */
enum class ArrangeMode(val label: String, val tagSuffix: String) {
    DEFAULT("Default", "default"),
    NAME("Name A–Z", "name"),
    STATUS("Status", "status"),
    DUE_DATE("Due date", "due-date");

    fun appliesTo(worksheet: PlannerWorksheet): Boolean = when (this) {
        DEFAULT -> worksheet != PlannerWorksheet.OVERVIEW
        NAME -> worksheet != PlannerWorksheet.OVERVIEW
        STATUS -> worksheet in setOf(
            PlannerWorksheet.TASKS, PlannerWorksheet.BUDGET, PlannerWorksheet.GUESTS,
            PlannerWorksheet.VENDORS, PlannerWorksheet.CONTRIBUTIONS, PlannerWorksheet.DOCUMENTS
        )
        DUE_DATE -> worksheet == PlannerWorksheet.TASKS || worksheet == PlannerWorksheet.BUDGET
    }
}

/** A printable table: plain columns a person can read, not the full import/export column set. */
data class WorksheetTable(val title: String, val headers: List<String>, val rows: List<List<String>>)

object WorksheetArrangement {
    private fun isoDay(raw: String?): String? =
        raw?.trim()?.take(10)?.takeIf { Regex("""\d{4}-\d{2}-\d{2}""").matches(it) }

    private fun <T> byDue(key: (T) -> String?): Comparator<T> = compareBy(nullsLast()) { item: T -> isoDay(key(item)) }

    private val taskStatusOrder = listOf(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.DONE)

    fun tasks(list: List<PlannerTask>, mode: ArrangeMode): List<PlannerTask> = when (mode) {
        ArrangeMode.DEFAULT -> list
        ArrangeMode.NAME -> list.sortedBy { it.title.lowercase() }
        ArrangeMode.STATUS -> list.sortedBy { taskStatusOrder.indexOf(it.status) }
        ArrangeMode.DUE_DATE -> list.sortedWith(byDue { it.dueDate })
    }

    fun budget(list: List<PlannerBudgetLine>, mode: ArrangeMode): List<PlannerBudgetLine> = when (mode) {
        ArrangeMode.DEFAULT -> list
        ArrangeMode.NAME -> list.sortedWith(compareBy({ it.category.lowercase() }, { it.vendorName?.lowercase() ?: "" }))
        ArrangeMode.STATUS -> list.sortedBy { it.statusLabel.lowercase() }
        ArrangeMode.DUE_DATE -> list.sortedWith(byDue { it.dueDateLabel })
    }

    fun guests(list: List<Guest>, mode: ArrangeMode): List<Guest> = when (mode) {
        ArrangeMode.NAME -> list.sortedBy { it.name.lowercase() }
        ArrangeMode.STATUS -> list.sortedBy { rsvpText(it.rsvpStatus) }
        else -> list
    }

    fun vendors(list: List<PlannerVendorEngagement>, mode: ArrangeMode): List<PlannerVendorEngagement> = when (mode) {
        ArrangeMode.NAME -> list.sortedBy { it.vendorName.lowercase() }
        ArrangeMode.STATUS -> list.sortedWith(compareBy({ it.bookingStatus.lowercase() }, { it.contractStatus.lowercase() }))
        else -> list
    }

    fun contributions(list: List<PlannerContributionRecord>, mode: ArrangeMode): List<PlannerContributionRecord> = when (mode) {
        ArrangeMode.NAME -> list.sortedBy { ContributionText.contributor(it).lowercase() }
        ArrangeMode.STATUS -> list.sortedBy { it.statusLabel.lowercase() }
        else -> list
    }

    fun seating(list: List<PlannerSeatingTable>, mode: ArrangeMode): List<PlannerSeatingTable> = when (mode) {
        ArrangeMode.NAME -> list.sortedBy { it.name.lowercase() }
        else -> list
    }

    fun timeline(list: List<PlannerTimelineEntry>, mode: ArrangeMode): List<PlannerTimelineEntry> = when (mode) {
        ArrangeMode.NAME -> list.sortedBy { it.title.lowercase() }
        else -> list
    }

    fun documents(list: List<PlannerDocumentRecord>, mode: ArrangeMode): List<PlannerDocumentRecord> = when (mode) {
        ArrangeMode.NAME -> list.sortedBy { it.title.lowercase() }
        ArrangeMode.STATUS -> list.sortedBy { it.statusLabel?.lowercase() ?: "" }
        else -> list
    }
}

/**
 * Export (CSV via WorksheetCsv) and print (HTML table) for the current worksheet, in the current order,
 * optionally limited to the selected row ids.
 */
object WorksheetOutput {
    private fun <T> pick(list: List<T>, only: Set<String>?, id: (T) -> String): List<T> =
        if (only == null) list else list.filter { id(it) in only }

    /** Null on Overview, which has no rows to export. */
    fun csv(worksheet: PlannerWorksheet, data: PlannerWorkspaceData, mode: ArrangeMode, only: Set<String>? = null): String? =
        when (worksheet) {
            PlannerWorksheet.OVERVIEW -> null
            PlannerWorksheet.TASKS -> WorksheetCsv.tasks(pick(WorksheetArrangement.tasks(data.tasks, mode), only) { it.id })
            PlannerWorksheet.BUDGET -> WorksheetCsv.budget(pick(WorksheetArrangement.budget(data.budgetLines, mode), only) { it.id }, data.currency)
            PlannerWorksheet.GUESTS -> WorksheetCsv.guests(pick(WorksheetArrangement.guests(data.guests, mode), only) { it.id })
            PlannerWorksheet.VENDORS -> WorksheetCsv.vendors(pick(WorksheetArrangement.vendors(data.vendors, mode), only) { it.id })
            PlannerWorksheet.CONTRIBUTIONS -> WorksheetCsv.contributions(pick(WorksheetArrangement.contributions(data.contributions, mode), only) { it.id })
            PlannerWorksheet.SEATING -> {
                val tables = pick(WorksheetArrangement.seating(data.seating, mode), only) { it.id }
                val names = tables.map { it.name }.toSet()
                WorksheetCsv.seating(data.guests.filter { it.tableName in names }, tables)
            }
            PlannerWorksheet.TIMELINE -> WorksheetCsv.timeline(pick(WorksheetArrangement.timeline(data.timeline, mode), only) { it.id })
            PlannerWorksheet.DOCUMENTS -> WorksheetCsv.documents(pick(WorksheetArrangement.documents(data.documents, mode), only) { it.id })
        }

    fun table(worksheet: PlannerWorksheet, data: PlannerWorkspaceData, mode: ArrangeMode, only: Set<String>? = null): WorksheetTable =
        when (worksheet) {
            PlannerWorksheet.OVERVIEW -> WorksheetTable(
                "Overview",
                listOf("Area", "Figure", "Note"),
                data.dashboard.modules.map { listOf(it.title, it.value, it.attention.orEmpty()) } +
                    data.dashboard.attentionItems.map { listOf("Needs attention", it.title, it.detail) }
            )
            PlannerWorksheet.TASKS -> WorksheetTable(
                "Tasks",
                listOf("Task", "Category", "Priority", "Status", "Due date"),
                pick(WorksheetArrangement.tasks(data.tasks, mode), only) { it.id }.map {
                    listOf(it.title, Formatting.humanize(it.category), it.priority.title, taskStatusText(it.status), it.dueDate?.let(Formatting::shortDate).orEmpty())
                }
            )
            PlannerWorksheet.BUDGET -> WorksheetTable(
                "Budget",
                listOf("Category", "Vendor", "Estimated", "Actual", "Paid", "Status", "Due date"),
                pick(WorksheetArrangement.budget(data.budgetLines, mode), only) { it.id }.map {
                    listOf(
                        Formatting.humanize(it.category), it.vendorName.orEmpty(),
                        Formatting.money(it.estimated, data.currency), Formatting.money(it.actual, data.currency),
                        Formatting.money(it.paid, data.currency), it.statusLabel, it.dueDateLabel?.let(Formatting::shortDate).orEmpty()
                    )
                }
            )
            PlannerWorksheet.GUESTS -> WorksheetTable(
                "Guests",
                listOf("Guest", "RSVP", "Party size", "Table"),
                pick(WorksheetArrangement.guests(data.guests, mode), only) { it.id }.map {
                    listOf(it.name, rsvpText(it.rsvpStatus), it.partySize.toString(), it.tableName.orEmpty())
                }
            )
            PlannerWorksheet.VENDORS -> WorksheetTable(
                "Vendors",
                listOf("Vendor", "Service", "Booking", "Contract", "Payment"),
                pick(WorksheetArrangement.vendors(data.vendors, mode), only) { it.id }.map {
                    listOf(it.vendorName, Formatting.humanize(it.category), it.bookingStatus, it.contractStatus, it.paymentStatus)
                }
            )
            PlannerWorksheet.CONTRIBUTIONS -> WorksheetTable(
                "Contributions",
                listOf("Contributor", "Type", "Status", "Details", "Message"),
                pick(WorksheetArrangement.contributions(data.contributions, mode), only) { it.id }.map {
                    listOf(ContributionText.contributor(it), it.typeLabel, it.statusLabel, ContributionText.meta(it), ContributionText.message(it))
                }
            )
            PlannerWorksheet.SEATING -> WorksheetTable(
                "Seating",
                listOf("Table", "Zone", "Capacity", "Assigned", "Free"),
                pick(WorksheetArrangement.seating(data.seating, mode), only) { it.id }.map {
                    listOf(it.name, it.zone, it.capacity.toString(), it.assigned.toString(), (it.capacity - it.assigned).coerceAtLeast(0).toString())
                }
            )
            PlannerWorksheet.TIMELINE -> WorksheetTable(
                "Timeline",
                listOf("Time", "Activity", "Location"),
                pick(WorksheetArrangement.timeline(data.timeline, mode), only) { it.id }.map { listOf(it.time, it.title, it.location) }
            )
            PlannerWorksheet.DOCUMENTS -> WorksheetTable(
                "Documents",
                listOf("Title", "Kind", "Status"),
                pick(WorksheetArrangement.documents(data.documents, mode), only) { it.id }.map {
                    listOf(it.title, Formatting.humanize(it.kind), it.statusLabel.orEmpty())
                }
            )
        }

    fun escapeHtml(value: String): String = buildString(value.length) {
        for (c in value) when (c) {
            '&' -> append("&amp;")
            '<' -> append("&lt;")
            '>' -> append("&gt;")
            '"' -> append("&quot;")
            '\'' -> append("&#39;")
            else -> append(c)
        }
    }

    /** A self-contained HTML page with one table; no scripts, no remote resources. */
    fun html(table: WorksheetTable, weddingTitle: String, subtitle: String): String {
        val head = table.headers.joinToString("") { "<th>${escapeHtml(it)}</th>" }
        val body = if (table.rows.isEmpty()) {
            "<tr><td colspan=\"${table.headers.size.coerceAtLeast(1)}\">No rows.</td></tr>"
        } else {
            table.rows.joinToString("") { row -> "<tr>" + row.joinToString("") { "<td>${escapeHtml(it)}</td>" } + "</tr>" }
        }
        return """
            <!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(table.title)}</title>
            <style>
            body{font-family:sans-serif;font-size:11pt;color:#13212b;margin:16px}
            h1{font-size:16pt;margin:0 0 4px} p{margin:0 0 12px;color:#667381}
            table{border-collapse:collapse;width:100%} th,td{border:1px solid #cfc6b8;padding:4px 6px;text-align:left;vertical-align:top}
            th{background:#f3ede2}
            </style></head><body>
            <h1>${escapeHtml(weddingTitle)} — ${escapeHtml(table.title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
            <table><thead><tr>$head</tr></thead><tbody>$body</tbody></table>
            </body></html>
        """.trimIndent()
    }
}
