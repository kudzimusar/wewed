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
    val readinessScore: Int? = null,
    val taskCompletionLabel: String = "7 / 42",
    val attentionItems: List<PlannerAttentionItem>,
    val modules: List<PlannerModuleSummary>,
    val recentActivity: List<PlannerActivityItem>,
    val sourceLabel: String
)


data class PlannerBudgetLine(
    val id: String,
    val category: String,
    val vendorName: String?,
    val estimated: Double,
    val actual: Double,
    val paid: Double,
    val dueDateLabel: String?,
    val fundingLabel: String,
    val statusLabel: String
)

data class PlannerContributionRecord(
    val id: String,
    val contributorLabel: String,
    val typeLabel: String,
    val value: Double,
    val statusLabel: String,
    val allocationLabel: String,
    val verified: Boolean
)

/**
 * One **service engagement** — a contracted or recorded piece of work on a wedding.
 *
 * A vendor may hold several engagements, so [id] (the engagement) and [vendorId] (the company)
 * are deliberately separate. Conflating them is unsafe the moment one vendor appears twice.
 */
data class PlannerVendorEngagement(
    val id: String,
    /** The vendor this engagement belongs to; null when the source does not record the link. */
    val vendorId: String? = null,
    val vendorName: String,
    val category: String,
    val bookingStatus: String,
    val contractStatus: String,
    val paymentStatus: String,
    val nextAction: String
) {
    /**
     * True when this is a historical/record-only capture rather than a live managed contract.
     * In the Private Real Shadow graph 7 of 8 engagements are historical; erasing that
     * distinction would present archived work as current.
     */
    val isRecordOnly: Boolean
        get() = bookingStatus.contains("historical", ignoreCase = true) ||
            bookingStatus.contains("record only", ignoreCase = true)
}

data class PlannerSeatingTable(
    val id: String,
    val name: String,
    val zone: String,
    val capacity: Int,
    val assigned: Int,
    val attentionLabel: String?
)

data class PlannerTimelineEntry(
    val id: String,
    val time: String,
    val title: String,
    val location: String,
    val statusLabel: String,
    val linkedVendor: String?
)


data class PlannerDocumentRecord(
    val id: String,
    val title: String,
    val kind: String,
    val statusLabel: String?
)
