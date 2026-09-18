package pro.wewed.app.services

import org.json.JSONObject
import pro.wewed.app.models.*

/**
 * Planner-side repository for the Private Real Shadow scenario (Charity & Kudzie / Eleven Eleven Testing).
 */
class PrivateRealShadowPlannerRepository(jsonString: String? = null, customPath: String? = null) : PlannerDashboardRepository {
    private val budgetLines: List<PlannerBudgetLine>
    private val contributions: List<PlannerContributionRecord>
    private val vendorEngagements: List<PlannerVendorEngagement>
    private val seatingTables: List<PlannerSeatingTable>
    private val timelineEntries: List<PlannerTimelineEntry>
    private val weddingTitle: String
    private val plannerTitle: String

    init {
        val raw = jsonString ?: PrivateRealShadowWeddingRepository.loadSnapshotString(
            customPath ?: PrivateRealShadowWeddingRepository.defaultSnapshotPath()
        )
        val root = JSONObject(raw)

        val weddingObj = root.optJSONObject("wedding") ?: JSONObject()
        weddingTitle = weddingObj.optString("title", "Charity & Kudzie")

        val plannerObj = root.optJSONObject("planner") ?: JSONObject()
        plannerTitle = plannerObj.optString("displayName", "Eleven Eleven Testing")

        // 1. Budget Lines (22 items)
        val bArray = root.optJSONArray("budgetItems")
        val bList = mutableListOf<PlannerBudgetLine>()
        if (bArray != null) {
            for (i in 0 until bArray.length()) {
                val item = bArray.getJSONObject(i)
                val cat = item.optString("category", "general")
                val vName = if (item.isNull("vendorName")) null else item.optString("vendorName")
                val est = item.optDouble("estimatedCost", 0.0)
                val act = item.optDouble("actualCost", 0.0)
                val pd = item.optDouble("paidAmount", 0.0)
                val due = if (item.isNull("dueDate")) null else item.optString("dueDate")
                val status = if (pd >= act && act > 0) "Paid" else if (pd > 0) "Deposit paid" else "Unpaid"
                bList.add(
                    PlannerBudgetLine(
                        id = item.optString("id", "bitem_${i + 1}"),
                        category = cat,
                        vendorName = vName,
                        estimated = est,
                        actual = act,
                        paid = pd,
                        dueDateLabel = due,
                        fundingLabel = "Couple funded",
                        statusLabel = status
                    )
                )
            }
        }
        budgetLines = bList

        // 2. Contributions (4 items)
        val cArray = root.optJSONArray("contributions")
        val cList = mutableListOf<PlannerContributionRecord>()
        if (cArray != null) {
            for (i in 0 until cArray.length()) {
                val item = cArray.getJSONObject(i)
                val type = item.optString("type", "blessing").replaceFirstChar { it.uppercase() }
                val status = item.optString("status", "approved").replaceFirstChar { it.uppercase() }
                cList.add(
                    PlannerContributionRecord(
                        id = item.optString("id", "contrib_${i + 1}"),
                        contributorLabel = "Guest Contributor",
                        typeLabel = type,
                        value = 0.0,
                        statusLabel = status,
                        allocationLabel = "Guest Messages",
                        verified = true
                    )
                )
            }
        }
        contributions = cList

        // 3. Vendor Engagements (7 vendors)
        val vArray = root.optJSONArray("vendors")
        val vList = mutableListOf<PlannerVendorEngagement>()
        if (vArray != null) {
            for (i in 0 until vArray.length()) {
                val item = vArray.getJSONObject(i)
                val name = item.optString("name", "Vendor ${i + 1}")
                val cat = item.optString("category", "other")
                val payStatus = item.optString("paymentStatus", "unpaid").replaceFirstChar { it.uppercase() }
                vList.add(
                    PlannerVendorEngagement(
                        id = item.optString("id", "vnd_${i + 1}"),
                        vendorName = name,
                        category = cat,
                        bookingStatus = "Confirmed",
                        contractStatus = "Pending",
                        paymentStatus = payStatus,
                        nextAction = "Operational review"
                    )
                )
            }
        }
        vendorEngagements = vList

        // 4. Seating Tables (8 tables)
        val tArray = root.optJSONArray("seatingTables")
        val gArray = root.optJSONArray("guests")
        val tableCounts = mutableMapOf<String, Int>()
        if (gArray != null) {
            for (i in 0 until gArray.length()) {
                val g = gArray.getJSONObject(i)
                if (!g.isNull("seatingTableId")) {
                    val tId = g.getString("seatingTableId")
                    tableCounts[tId] = (tableCounts[tId] ?: 0) + 1
                }
            }
        }

        val sList = mutableListOf<PlannerSeatingTable>()
        if (tArray != null) {
            for (i in 0 until tArray.length()) {
                val item = tArray.getJSONObject(i)
                val id = item.getString("id")
                val name = item.getString("name")
                val cap = item.optInt("capacity", 8)
                val assigned = tableCounts[id] ?: 0
                val free = (cap - assigned).coerceAtLeast(0)
                val zone = when {
                    name.contains("Family") -> "Family"
                    name.contains("Bridal") -> "Bridal Party"
                    name.contains("VIP") -> "VIP"
                    else -> "Friends"
                }
                sList.add(
                    PlannerSeatingTable(
                        id = id,
                        name = name,
                        zone = zone,
                        capacity = cap,
                        assigned = assigned,
                        attentionLabel = "$free seats free"
                    )
                )
            }
        }
        seatingTables = sList

        // 5. Timeline Entries (13 entries)
        val pArray = root.optJSONArray("programme")
        val pList = mutableListOf<PlannerTimelineEntry>()
        if (pArray != null) {
            for (i in 0 until pArray.length()) {
                val item = pArray.getJSONObject(i)
                pList.add(
                    PlannerTimelineEntry(
                        id = item.optString("id", "prog_${i + 1}"),
                        time = item.optString("time", "12:00"),
                        title = item.optString("title", "Event"),
                        location = if (item.isNull("location")) "Imba Manor" else item.optString("location", "Imba Manor"),
                        statusLabel = "Scheduled",
                        linkedVendor = null
                    )
                )
            }
        }
        timelineEntries = pList
    }

    override suspend fun getDashboard(): PlannerDashboardSnapshot = PlannerDashboardSnapshot(
        weddingId = "cmqos70cb0004q6vxe9g9aiu5",
        coupleNames = weddingTitle,
        weddingDateLabel = "2026-12-23 14:00:00",
        lifecycle = "before",
        plannerContext = plannerTitle,
        readinessScore = null,
        taskCompletionLabel = "7 / 42",
        attentionItems = listOf(
            PlannerAttentionItem("attn_tasks", "8 high priority tasks", "Venue, invitations and logistics need attention.", PlannerAttentionSeverity.URGENT),
            PlannerAttentionItem("attn_rsvp", "172 RSVPs pending", "Guest follow-up is affecting seating readiness.", PlannerAttentionSeverity.WARNING),
            PlannerAttentionItem("attn_seating", "152 guests unseated", "Complete table allocations for invited party capacity.", PlannerAttentionSeverity.WARNING),
            PlannerAttentionItem("attn_vendor", "7 vendors booked", "Operational contracts and logistics reviews in progress.", PlannerAttentionSeverity.INFO),
            PlannerAttentionItem("attn_payment", "Payments in progress", "$3,875 paid out of $8,690 actual expenses.", PlannerAttentionSeverity.INFO)
        ),
        modules = listOf(
            PlannerModuleSummary("tasks", "Tasks", "7 / 42", "8 urgent", "checklist"),
            PlannerModuleSummary("budget", "Budget", "$30.4k", "$3.9k paid", "creditcard"),
            PlannerModuleSummary("contributions", "Contributions", "4 memories", "4 approved", "gift"),
            PlannerModuleSummary("vendors", "Vendors", "7 booked", "0 contracts", "storefront"),
            PlannerModuleSummary("guests", "Guests", "174", "172 awaiting RSVP", "person.3"),
            PlannerModuleSummary("seating", "Seating", "22 / 64", "42 seats free", "table.furniture"),
            PlannerModuleSummary("timeline", "Timeline", "13 events", "Programme locked", "calendar.badge.clock")
        ),
        recentActivity = emptyList(),
        sourceLabel = "Private real-wedding row snapshot"
    )

    override suspend fun getBudgetLines(): List<PlannerBudgetLine> = budgetLines
    override suspend fun getContributions(): List<PlannerContributionRecord> = contributions
    override suspend fun getVendorEngagements(): List<PlannerVendorEngagement> = vendorEngagements
    override suspend fun getSeatingTables(): List<PlannerSeatingTable> = seatingTables
    override suspend fun getTimelineEntries(): List<PlannerTimelineEntry> = timelineEntries
}
