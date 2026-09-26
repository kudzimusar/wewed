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
 * [getContributions] reads the SAME `loadContributionWorkspace` engine the PWA's
 * `/api/planner/contributions` uses (via `/api/native/wedding/contributions`) — never a
 * client-recomputed funding truth. [getDocuments] (Phase 8 closure §3) likewise reads the SAME
 * `listWeddingVaultObjects` catalog the PWA's `/api/vault` uses. The managed-contract lifecycle
 * (Deal Room, contract versions/review/acceptance) has no native repository or UI surface at all
 * yet — see docs/native-mobile/WEWED_NATIVE_PHASE8_FIELD_CLASSIFICATION.md for why that is
 * deliberately out of this pass's scope rather than approximated here. Each Shadow*Destination
 * composable calls its own single method independently with no shared try/catch, so a thrown
 * failure for one unwired domain only affects that one section, never Tasks/Budget/Seating/
 * Timeline/Vendors.
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
            else -> throw ProductionReadOnlyDomainUnavailable()
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

    override suspend fun getContributions(): List<PlannerContributionRecord> {
        // Master plan Phase 8 closure §11 — matches the established Budget/Seating/Timeline/Vendor
        // pattern: this repository is only ever consulted once a real wedding-scoped grant has
        // rendered a role shell (a Planner-portfolio grant never reaches this call at all — it
        // stays on the earlier no-role production branch), so a transport/permission failure here
        // is a genuine live-domain failure, never an honest "zero contributions" to fabricate.
        val root = when (val fetch = client.contributions(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> throw ProductionReadOnlyDomainUnavailable()
        }
        return root.optJSONArray("data")?.toObjectList().orEmpty().map { item ->
            val allocatedAmount = item.optDouble("allocatedAmount", 0.0)
            val verificationState = item.optString("verificationState")
            PlannerContributionRecord(
                id = item.getString("id"),
                contributorLabel = item.optJSONObject("contributor")?.optString("displayName") ?: "Unknown contributor",
                typeLabel = item.optString("type").replace('_', ' ').lowercase()
                    .replaceFirstChar { it.uppercase() },
                value = item.optDouble("amount", 0.0),
                statusLabel = listOf(item.optString("commitmentState"), item.optString("fulfillmentState"))
                    .filter { it.isNotBlank() }.joinToString(" · "),
                allocationLabel = if (allocatedAmount > 0) "Allocated ${allocatedAmount}" else "Unallocated",
                verified = verificationState in setOf("CONFIRMED_BY_USER", "EVIDENCE_ATTACHED", "RECONCILED"),
            )
        }
    }

    override suspend fun getVendorEngagements(): List<PlannerVendorEngagement> {
        val array = when (val fetch = client.vendors(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> throw ProductionReadOnlyDomainUnavailable()
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
            else -> throw ProductionReadOnlyDomainUnavailable()
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
            else -> throw ProductionReadOnlyDomainUnavailable()
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

    /**
     * Master plan Phase 8 closure §3 — reads the SAME `listWeddingVaultObjects` catalog the PWA's
     * `/api/vault` GET uses (via `/api/native/wedding/vault`), never a second document truth. Same
     * live-failure-throws contract as [getContributions]: this is only ever consulted once a real
     * wedding-scoped grant has rendered a role shell, so a transport/permission failure here is
     * genuine, never an honest "no documents" to fabricate.
     */
    override suspend fun getDocuments(): List<PlannerDocumentRecord> {
        val array = when (val fetch = client.vault(sessionToken, grantId)) {
            is NativeDomainFetch.Success -> fetch.value
            else -> throw ProductionReadOnlyDomainUnavailable()
        }
        return array.toObjectList().map { item ->
            val available = item.optBoolean("available", true)
            PlannerDocumentRecord(
                id = item.getString("id"),
                title = item.optString("displayName", item.optString("originalFilename")),
                kind = item.optString("category", "wedding_document"),
                statusLabel = if (available) null else "Not yet available",
            )
        }
    }
}

private fun formatCurrency(amount: Double): String {
    val rounded = Math.round(amount).toString()
    return "$$rounded"
}
