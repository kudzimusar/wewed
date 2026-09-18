package pro.wewed.app.models

enum class PlannerAttentionSeverity {
    INFO, WARNING, URGENT
}

data class PlannerAttentionItem(
    val id: String,
    val title: String,
    val detail: String,
    val severity: PlannerAttentionSeverity
)

data class PlannerModuleSummary(
    val id: String,
    val title: String,
    val value: String,
    val attention: String? = null,
    val iconKey: String
)

data class PlannerActivityItem(
    val id: String,
    val title: String,
    val detail: String,
    val relativeTime: String
)

data class PlannerDashboardSnapshot(
    val weddingId: String,
    val coupleNames: String,
    val weddingDateLabel: String,
    val lifecycle: String,
    val plannerContext: String,
    val readinessScore: Int,
    val attentionItems: List<PlannerAttentionItem>,
    val modules: List<PlannerModuleSummary>,
    val recentActivity: List<PlannerActivityItem>,
    val sourceLabel: String
)
