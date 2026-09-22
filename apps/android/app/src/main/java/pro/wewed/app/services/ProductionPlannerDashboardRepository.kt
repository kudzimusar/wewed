package pro.wewed.app.services

import org.json.JSONObject
import pro.wewed.app.models.*

/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8.
 *
 * Real production adapter for the Planner-dashboard-shaped domains. Backs BOTH a wedding-scoped
 * grant (Planner/Couple/Coordinator — `weddingId` set) and a zero-wedding Planner-portfolio grant
 * (`weddingId` null): every method here degrades to an honest empty/placeholder answer for the
 * portfolio case rather than fabricating a wedding, matching master plan §9 ("A Planner portfolio
 * with zero weddings must still work... must not fabricate a wedding").
 *
 * [getContributions] and [getDocuments] are UNSUPPORTED in this phase (see
 * docs/native-mobile/WEWED_NATIVE_PHASE8_FIELD_CLASSIFICATION.md) — porting the real funding-
 * attribution/vault engines is tracked as separate remaining work, not approximated here. Each
 * Shadow*Destination composable calls its own single method independently with no shared
 * try/catch, so returning an honest empty list here only affects that one section, never Tasks/
 * Budget/Seating/Timeline/Vendors.
 */
class ProductionPlannerDashboardRepository(
    private val client: NativeDomainApiClient,
    private val sessionToken: String,
    private val grantId: String,
) : PlannerDashboardRepository {

    override suspend fun getDashboard(): PlannerDashboardSnapshot {
        val overview = when (val fetch = client.overview(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> throw ProductionReadOnlyDomainUnavailable()
        }
        val wedding = overview.optJSONObject("wedding")
        val counts = overview.optJSONObject("counts")
        val modules = if (counts != null) {
            listOf(
                PlannerModuleSummary("tasks", "Tasks", "${counts.optInt("tasksDone")} / ${counts.optInt("tasksTotal")}", null, "tasks"),
                PlannerModuleSummary("budget", "Budget", formatCurrency(counts.optDouble("budgetPaidTotal", 0.0)) + " / " + formatCurrency(counts.optDouble("budgetEstimatedTotal", 0.0)), null, "budget"),
                PlannerModuleSummary("guests", "Guests", "${counts.optInt("guestsAttending")} / ${counts.optInt("guestsTotal")}", null, "guests"),
                PlannerModuleSummary("vendors", "Vendors", "${counts.optInt("vendorsTotal")} booked", null, "vendors"),
                PlannerModuleSummary("timeline", "Timeline", "${counts.optInt("timelineEntries")} events", null, "timeline"),
            )
        } else emptyList()

        return PlannerDashboardSnapshot(
            weddingId = wedding?.optString("id") ?: overview.optString("businessAccountId"),
            coupleNames = wedding?.optString("coupleNames") ?: overview.optString("businessName"),
            weddingDateLabel = wedding?.optString("date") ?: "No wedding selected",
            lifecycle = wedding?.optString("lifecycle") ?: "portfolio",
            plannerContext = overview.optString("businessName", ""),
            readinessScore = null,
            taskCompletionLabel = counts?.let { "${it.optInt("tasksDone")} / ${it.optInt("tasksTotal")}" } ?: "",
            attentionItems = emptyList(),
            modules = modules,
            recentActivity = emptyList(),
            sourceLabel = "Live Wewed production data",
        )
    }

    override suspend fun getBudgetLines(): List<PlannerBudgetLine> {
        val root = when (val fetch = client.budget(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> return emptyList()
        }
        return root.optJSONArray("data")?.toObjectList().orEmpty().map { item ->
            PlannerBudgetLine(
                id = item.getString("id"),
                category = item.optString("category"),
                vendorName = item.optString("vendorName").takeIf { !item.isNull("vendorName") && it.isNotBlank() },
                estimated = item.optDouble("estimatedCost", 0.0),
                actual = item.optDouble("actualCost", item.optDouble("estimatedCost", 0.0)),
                paid = item.optDouble("paidAmount", 0.0),
                dueDateLabel = item.optString("dueDate").takeIf { !item.isNull("dueDate") && it.isNotBlank() },
                fundingLabel = "",
                statusLabel = if (item.optDouble("paidAmount", 0.0) >= item.optDouble("actualCost", item.optDouble("estimatedCost", 0.0))) "Paid" else "Balance due",
            )
        }
    }

    override suspend fun getContributions(): List<PlannerContributionRecord> = emptyList()

    override suspend fun getVendorEngagements(): List<PlannerVendorEngagement> {
        val array = when (val fetch = client.vendors(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> return emptyList()
        }
        return array.toObjectList().map { item ->
            PlannerVendorEngagement(
                id = item.getString("id"),
                vendorId = item.getString("id"),
                vendorName = item.optString("name"),
                category = item.optString("category"),
                bookingStatus = "",
                contractStatus = item.optString("contractStatus"),
                paymentStatus = item.optString("paymentStatus"),
                nextAction = "",
            )
        }
    }

    override suspend fun getSeatingTables(): List<PlannerSeatingTable> {
        val array = when (val fetch = client.seating(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> return emptyList()
        }
        return array.toObjectList().map { item ->
            val capacity = item.optInt("capacity", 0)
            val assigned = item.optInt("assigned", 0)
            PlannerSeatingTable(
                id = item.getString("id"),
                name = item.optString("name"),
                zone = "",
                capacity = capacity,
                assigned = assigned,
                attentionLabel = if (assigned < capacity) "${capacity - assigned} seats free" else null,
            )
        }
    }

    override suspend fun getTimelineEntries(): List<PlannerTimelineEntry> {
        val array = when (val fetch = client.timeline(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> return emptyList()
        }
        return array.toObjectList().map { item ->
            PlannerTimelineEntry(
                id = item.getString("id"),
                time = item.optString("time"),
                title = item.optString("title"),
                location = item.optString("location").takeIf { !item.isNull("location") } ?: "",
                statusLabel = "",
                linkedVendor = null,
            )
        }
    }

    override suspend fun getDocuments(): List<PlannerDocumentRecord> = emptyList()
}

private fun formatCurrency(amount: Double): String {
    val rounded = Math.round(amount).toString()
    return "$$rounded"
}
