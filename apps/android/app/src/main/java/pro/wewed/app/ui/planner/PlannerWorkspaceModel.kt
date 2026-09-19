package pro.wewed.app.ui.planner

import androidx.compose.runtime.*
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import pro.wewed.app.models.*
import pro.wewed.app.services.ImportRecord
import pro.wewed.app.services.ImportRowError
import pro.wewed.app.services.PlannerWorksheet
import pro.wewed.app.services.RoleScopedAccess
import pro.wewed.app.services.TaskImportPreview

/** A picked file waiting for the planner to confirm the import. */
data class ImportDraft(val fileName: String, val preview: TaskImportPreview)

/** Full-screen destinations inside the planner shell. Each has a back action. */
sealed interface PlannerRoute {
    data class ImportPreview(val draft: ImportDraft) : PlannerRoute
    data class ImportResult(val record: ImportRecord) : PlannerRoute
    data object RecentImports : PlannerRoute
    data object ClientProfile : PlannerRoute
    data object ClientProfileEditor : PlannerRoute
    data object TeamHub : PlannerRoute
    data object Invitations : PlannerRoute
    data class PassPreview(val pass: WeddingPass) : PlannerRoute
    data object Intelligence : PlannerRoute
    data object Account : PlannerRoute
    data object Support : PlannerRoute
    data object Scanner : PlannerRoute
}

/**
 * State for the planner workspace, kept for the whole planner session so switching tabs
 * doesn't lose the worksheet, order, selection or this session's imports.
 * All data flows through the planner's RoleScopedAccess.
 */
class PlannerWorkspaceModel(
    val access: RoleScopedAccess,
    private val scope: CoroutineScope
) {
    var data by mutableStateOf<PlannerWorkspaceData?>(null)
        private set
    var loading by mutableStateOf(false)
        private set
    var loadProblem by mutableStateOf<String?>(null)
        private set
    var loadedAtMillis by mutableStateOf<Long?>(null)
        private set

    var worksheet by mutableStateOf(PlannerWorksheet.OVERVIEW)
        private set
    val arrangement = mutableStateMapOf<PlannerWorksheet, ArrangeMode>()
    var selectionMode by mutableStateOf(false)
        private set
    var selectedIds by mutableStateOf<Set<String>>(emptySet())
        private set
    var guestQuery by mutableStateOf("")

    /** Plain-words outcome of the last action, shown near the top of the workspace. */
    var message by mutableStateOf<String?>(null)
    /** Outcome shown on the Client Profile screen only (e.g. after saving details). */
    var profileMessage by mutableStateOf<String?>(null)
    /** Problem shown on the Intelligence screen only. */
    var intelligenceProblem by mutableStateOf<String?>(null)
    var busyTaskIds by mutableStateOf<Set<String>>(emptySet())
        private set

    /** Imports completed on this device during this app session ("Imports on this device"). */
    val imports = mutableStateListOf<ImportRecord>()

    /** Recommendation ids whose task was created in this session, with the created task's title. */
    val createdRecommendations = mutableStateMapOf<String, String>()

    val routes = mutableStateListOf<PlannerRoute>()

    fun push(route: PlannerRoute) { routes.add(route) }
    fun pop() { if (routes.isNotEmpty()) routes.removeAt(routes.lastIndex) }

    fun arrangeMode(ws: PlannerWorksheet = worksheet): ArrangeMode = arrangement[ws] ?: ArrangeMode.DEFAULT

    fun refresh() {
        scope.launch { load() }
    }

    suspend fun load() {
        loading = true
        try {
            data = PlannerWorkspaceData(
                wedding = access.weddingSummary(),
                dashboard = access.dashboard(),
                tasks = access.tasks(),
                budgetLines = access.budgetLines(),
                currency = access.budget().currency,
                guests = access.guestRoster(),
                vendors = access.vendorEngagements(),
                contributions = access.contributions(),
                seating = access.seating(),
                timeline = access.programme(),
                documents = access.documents(),
                presence = access.vendorPresence(),
                admission = access.admissionSummary()
            )
            loadedAtMillis = System.currentTimeMillis()
            loadProblem = null
        } catch (cancel: CancellationException) {
            throw cancel
        } catch (_: Exception) {
            loadProblem = "Some wedding information couldn't be loaded. Use Refresh data to try again."
        } finally {
            loading = false
        }
    }

    fun switchWorksheet(ws: PlannerWorksheet) {
        worksheet = ws
        selectionMode = false
        selectedIds = emptySet()
        message = null
    }

    fun startSelecting() {
        selectionMode = true
        selectedIds = emptySet()
    }

    fun stopSelecting() {
        selectionMode = false
        selectedIds = emptySet()
    }

    fun setSelected(id: String, selected: Boolean) {
        selectedIds = if (selected) selectedIds + id else selectedIds - id
    }

    fun selectAll(ids: List<String>) {
        selectedIds = ids.toSet()
    }

    fun clearSelection() {
        selectedIds = emptySet()
    }

    private fun replaceTask(updated: PlannerTask) {
        val current = data ?: return
        data = current.copy(tasks = current.tasks.map { if (it.id == updated.id) updated else it })
    }

    fun toggleTask(taskId: String) {
        if (taskId in busyTaskIds) return
        busyTaskIds = busyTaskIds + taskId
        scope.launch {
            try {
                val updated = access.toggleTask(taskId)
                replaceTask(updated)
                message = "\"${updated.title}\" is now ${if (updated.status == TaskStatus.DONE) "done" else "to do"}."
            } catch (cancel: CancellationException) {
                throw cancel
            } catch (_: Exception) {
                message = "The task couldn't be updated. Please try again."
            } finally {
                busyTaskIds = busyTaskIds - taskId
            }
        }
    }

    /** Tasks among [ids] whose status would actually change. "Mark to do" only changes tasks that are done. */
    fun tasksToChange(ids: Set<String>, markDone: Boolean): List<PlannerTask> =
        data?.tasks.orEmpty().filter { it.id in ids }.filter { task ->
            if (markDone) task.status != TaskStatus.DONE else task.status == TaskStatus.DONE
        }

    fun bulkMark(ids: Set<String>, markDone: Boolean) {
        val targets = tasksToChange(ids, markDone)
        if (targets.isEmpty()) return
        scope.launch {
            var changed = 0
            var failed = 0
            for (task in targets) {
                try {
                    val updated = access.toggleTask(task.id)
                    replaceTask(updated)
                    val reached = if (markDone) updated.status == TaskStatus.DONE else updated.status != TaskStatus.DONE
                    if (reached) changed++ else failed++
                } catch (cancel: CancellationException) {
                    throw cancel
                } catch (_: Exception) {
                    failed++
                }
            }
            val label = if (markDone) "done" else "to do"
            message = buildString {
                append("${changed} ${if (changed == 1) "task" else "tasks"} marked $label.")
                if (failed > 0) append(" $failed couldn't be changed.")
            }
            stopSelecting()
        }
    }

    /** Creates one task per valid row, records the outcome for this session and returns it. */
    suspend fun runImport(draft: ImportDraft): ImportRecord {
        var created = 0
        val errors = draft.preview.rowErrors.toMutableList()
        for (row in draft.preview.validRows) {
            try {
                access.createTask(row.title, row.priority, row.category)
                created++
            } catch (cancel: CancellationException) {
                throw cancel
            } catch (_: Exception) {
                errors += ImportRowError(row.rowNumber, "This row couldn't be saved.")
            }
        }
        val record = ImportRecord(
            worksheet = PlannerWorksheet.TASKS,
            importedAtMillis = System.currentTimeMillis(),
            created = created,
            skipped = errors.size,
            errors = errors.sortedBy { it.rowNumber }
        )
        imports.add(0, record)
        load()
        return record
    }

    fun createRecommendedTask(recommendation: Recommendation) {
        if (recommendation.id in createdRecommendations) return
        scope.launch {
            try {
                val task = access.createTask(recommendation.taskTitle, recommendation.priority, PlannerInsights.RECOMMENDATION_TASK_CATEGORY)
                createdRecommendations[recommendation.id] = task.title
                load()
            } catch (cancel: CancellationException) {
                throw cancel
            } catch (_: Exception) {
                intelligenceProblem = "The task couldn't be created. Please try again."
            }
        }
    }
}
