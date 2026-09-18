package pro.wewed.app.models

enum class TaskStatus(val value: String, val title: String) {
    TODO("todo", "To Do"),
    IN_PROGRESS("in_progress", "In Progress"),
    BLOCKED("blocked", "Blocked"),
    DONE("done", "Done");

    companion object {
        fun fromValue(value: String): TaskStatus =
            entries.find { it.value == value } ?: TODO
    }
}

enum class TaskPriority(val value: String, val title: String) {
    LOW("low", "Low"),
    MEDIUM("medium", "Medium"),
    HIGH("high", "High"),
    URGENT("urgent", "Urgent");

    companion object {
        fun fromValue(value: String): TaskPriority =
            entries.find { it.value == value } ?: MEDIUM
    }
}

data class PlannerTask(
    val id: String,
    val title: String,
    val status: TaskStatus,
    val priority: TaskPriority,
    val category: String,
    val dueDate: String? = null
)
