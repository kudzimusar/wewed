package pro.wewed.app.ui.planner

import pro.wewed.app.models.*
import pro.wewed.app.ui.shared.Formatting
import kotlin.math.roundToInt

/** Daily Ops figures, all derived from recorded tasks and guests. */
data class DailyOpsSummary(
    val overdue: List<PlannerTask>,
    val dueSoon: List<PlannerTask>,
    val highPriorityOpen: List<PlannerTask>,
    val notReplied: Int,
    val totalGuests: Int
)

/** A suggestion computed from the wedding's own records, with the evidence that produced it. */
data class Recommendation(
    val id: String,
    val title: String,
    val evidence: String,
    val evidenceCount: Int,
    val taskTitle: String,
    val priority: TaskPriority
)

object PlannerInsights {
    /** Category used for tasks created from recommendations; one of the web task categories. */
    const val RECOMMENDATION_TASK_CATEGORY = "other"

    private fun dueDay(task: PlannerTask): String? =
        task.dueDate?.trim()?.take(10)?.takeIf { Regex("""\d{4}-\d{2}-\d{2}""").matches(it) }

    private fun isOpen(task: PlannerTask) = task.status != TaskStatus.DONE

    /** [today] and [soonUntil] are ISO days (yyyy-MM-dd). */
    fun dailyOps(tasks: List<PlannerTask>, guests: List<Guest>, today: String, soonUntil: String): DailyOpsSummary {
        val open = tasks.filter(::isOpen)
        return DailyOpsSummary(
            overdue = open.filter { t -> dueDay(t)?.let { it < today } == true }.sortedBy { dueDay(it) },
            dueSoon = open.filter { t -> dueDay(t)?.let { it >= today && it <= soonUntil } == true }.sortedBy { dueDay(it) },
            highPriorityOpen = open.filter { it.priority == TaskPriority.HIGH || it.priority == TaskPriority.URGENT },
            notReplied = guests.count { it.rsvpStatus == RSVPStatus.PENDING },
            totalGuests = guests.size
        )
    }

    fun recommendations(data: PlannerWorkspaceData, today: String): List<Recommendation> {
        val out = mutableListOf<Recommendation>()
        val ops = dailyOps(data.tasks, data.guests, today, today)

        if (ops.overdue.isNotEmpty()) {
            val n = ops.overdue.size
            out += Recommendation(
                id = "overdue-tasks",
                title = "${Formatting.plural(n, "task is", "tasks are")} overdue",
                evidence = "Open tasks with a due date before today.",
                evidenceCount = n,
                taskTitle = "Review ${Formatting.plural(n, "overdue task")}",
                priority = TaskPriority.HIGH
            )
        }

        if (ops.highPriorityOpen.isNotEmpty()) {
            val n = ops.highPriorityOpen.size
            out += Recommendation(
                id = "high-priority-open",
                title = "${Formatting.plural(n, "high-priority task is", "high-priority tasks are")} still open",
                evidence = "Tasks marked high or urgent that are not done.",
                evidenceCount = n,
                taskTitle = "Plan the next step for ${Formatting.plural(n, "open high-priority task")}",
                priority = TaskPriority.HIGH
            )
        }

        if (ops.totalGuests > 0 && ops.notReplied > 0) {
            val percent = (ops.notReplied * 100.0 / ops.totalGuests).roundToInt()
            out += Recommendation(
                id = "guests-not-replied",
                title = "$percent% of guests have not replied",
                evidence = "${ops.notReplied} of ${ops.totalGuests} guest records have no reply.",
                evidenceCount = ops.notReplied,
                taskTitle = if (ops.notReplied == 1) "Follow up with 1 guest who has not replied" else "Follow up with ${ops.notReplied} guests who have not replied",
                priority = if (percent >= 50) TaskPriority.HIGH else TaskPriority.MEDIUM
            )
        }

        val capacity = data.seating.sumOf { it.capacity }
        val assigned = data.seating.sumOf { it.assigned }
        val freeSeats = (capacity - assigned).coerceAtLeast(0)
        val attending = data.guests.filter { it.rsvpStatus == RSVPStatus.ATTENDING }
        val attendingPeople = attending.sumOf { it.partySize }
        val attendingWithoutTable = attending.filter { it.tableName.isNullOrBlank() }.sumOf { it.partySize }
        if (attendingWithoutTable > 0) {
            out += Recommendation(
                id = "attending-without-table",
                title = "${Formatting.plural(attendingWithoutTable, "attending guest has", "attending guests have")} no table",
                evidence = "$freeSeats free seats across ${Formatting.plural(data.seating.size, "table")}; $attendingPeople guests attending.",
                evidenceCount = attendingWithoutTable,
                taskTitle = "Assign tables for ${Formatting.plural(attendingWithoutTable, "attending guest")}",
                priority = TaskPriority.MEDIUM
            )
        } else if (capacity > 0 && attendingPeople > capacity) {
            out += Recommendation(
                id = "seats-short",
                title = "More guests are attending than there are seats",
                evidence = "$attendingPeople guests attending; $capacity seats across ${Formatting.plural(data.seating.size, "table")}.",
                evidenceCount = attendingPeople - capacity,
                taskTitle = "Add seats for ${attendingPeople - capacity} more guests",
                priority = TaskPriority.HIGH
            )
        }

        val unpaid = data.budgetLines.filter { it.actual - it.paid > 0.005 }
        if (unpaid.isNotEmpty()) {
            val outstanding = unpaid.sumOf { it.actual - it.paid }
            out += Recommendation(
                id = "unpaid-budget-lines",
                title = "${Formatting.plural(unpaid.size, "budget line has", "budget lines have")} an unpaid balance",
                evidence = "${Formatting.money(outstanding, data.currency)} of recorded costs is not yet paid.",
                evidenceCount = unpaid.size,
                taskTitle = "Review ${Formatting.plural(unpaid.size, "unpaid budget line")}",
                priority = TaskPriority.MEDIUM
            )
        }

        if (data.documents.isEmpty() && data.vendors.isNotEmpty()) {
            out += Recommendation(
                id = "no-contracts",
                title = "No contracts recorded for this wedding",
                evidence = "${Formatting.plural(data.vendors.size, "vendor")} recorded; no contracts or documents.",
                evidenceCount = data.vendors.size,
                taskTitle = "Collect contracts from ${Formatting.plural(data.vendors.size, "vendor")}",
                priority = TaskPriority.MEDIUM
            )
        }

        return out
    }
}
