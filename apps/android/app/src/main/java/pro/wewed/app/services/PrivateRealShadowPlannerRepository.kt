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
    private val documents: List<PlannerDocumentRecord>
    private val weddingTitle: String
    private val weddingId: String
    private val weddingDate: String
    private val weddingVenue: String
    private val weddingLifecycle: String
    private val plannerTitle: String
    private val doneTasksCount: Int
    private val totalTasksCount: Int
    private val highPriorityTasksCount: Int
    private val totalEstBudget: Double
    private val totalActBudget: Double
    private val totalPdBudget: Double
    private val totalGuestsCount: Int
    private val pendingRsvpCount: Int
    private val attendingGuestsCount: Int
    private val totalSeatingCapacity: Int
    private val assignedInvitedCapacity: Int
    private val remainingTableCapacity: Int
    private val vendorsCount: Int
    private val serviceEngagementsCount: Int

    init {
        val raw = jsonString ?: PrivateRealShadowWeddingRepository.loadSnapshotString(
            customPath ?: PrivateRealShadowWeddingRepository.defaultSnapshotPath()
        )
        val root = JSONObject(raw)

        val weddingObj = root.optJSONObject("wedding")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required wedding metadata missing in private real shadow fixture.")
        weddingId = weddingObj.optString("id")
        weddingTitle = weddingObj.optString("title")
        weddingDate = weddingObj.optString("dateRaw")
        weddingVenue = weddingObj.optString("venue")
        weddingLifecycle = weddingObj.optString("lifecycle")

        if (weddingId.isEmpty() || weddingTitle.isEmpty() || weddingDate.isEmpty() || weddingVenue.isEmpty() || weddingLifecycle.isEmpty()) {
            throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required wedding fields missing in private real shadow fixture.")
        }

        val plannerObj = root.optJSONObject("planner")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required planner metadata missing in private real shadow fixture.")
        plannerTitle = plannerObj.optString("displayName").ifEmpty { plannerObj.optString("businessName") }
        if (plannerTitle.isEmpty()) {
            throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required planner metadata missing in private real shadow fixture.")
        }

        // Tasks stats
        val taskArray = root.optJSONArray("tasks")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required tasks list missing in private real shadow fixture.")
        totalTasksCount = taskArray.length()
        var doneCount = 0
        var highCount = 0
        for (i in 0 until taskArray.length()) {
            val t = taskArray.getJSONObject(i)
            val title = t.optString("title")
            val st = t.optString("status")
            val prio = t.optString("priority")
            if (title.isEmpty() || st.isEmpty() || prio.isEmpty()) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required task fields missing in private real shadow fixture.")
            }
            if (st.equals("done", ignoreCase = true) || st.equals("completed", ignoreCase = true)) {
                doneCount++
            }
            if (prio.equals("high", ignoreCase = true) || prio.equals("urgent", ignoreCase = true)) {
                highCount++
            }
        }
        doneTasksCount = doneCount
        highPriorityTasksCount = highCount

        // 1. Budget Lines (22 items)
        val bArray = root.optJSONArray("budgetItems")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required budgetItems missing in private real shadow fixture.")
        val bList = mutableListOf<PlannerBudgetLine>()
        var totalEst = 0.0
        var totalAct = 0.0
        var totalPd = 0.0
        for (i in 0 until bArray.length()) {
            val item = bArray.getJSONObject(i)
            val id = item.optString("id")
            val cat = item.optString("category")
            if (id.isEmpty() || cat.isEmpty() || !item.has("estimatedCost") || !item.has("actualCost") || !item.has("paidAmount")) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required budget item fields missing in private real shadow fixture.")
            }
            val vName = if (item.isNull("vendorName")) null else item.optString("vendorName").takeIf { it.isNotBlank() }
            val sourceLabel = listOf("name", "title", "itemName", "description")
                .asSequence()
                .map { key -> if (item.isNull(key)) "" else item.optString(key).trim() }
                .firstOrNull { it.isNotBlank() }
            val displayLabel = sourceLabel ?: cat.replaceFirstChar { it.uppercase() }
            val fundingLabel = listOf("fundingLabel", "fundingSource", "paymentSource", "fundingType")
                .asSequence()
                .map { key -> if (item.isNull(key)) "" else item.optString(key).trim() }
                .firstOrNull { it.isNotBlank() }
                ?: "Funding source not recorded"
            val est = item.optDouble("estimatedCost", 0.0)
            val act = item.optDouble("actualCost", 0.0)
            val pd = item.optDouble("paidAmount", 0.0)
            val due = if (item.isNull("dueDate")) null else item.optString("dueDate").takeIf { it.isNotBlank() }
            val status = if (pd >= act && act > 0) "Paid" else if (pd > 0) "Deposit paid" else "Unpaid"
            totalEst += est
            totalAct += act
            totalPd += pd
            bList.add(
                PlannerBudgetLine(
                    id = id,
                    category = displayLabel,
                    vendorName = vName,
                    estimated = est,
                    actual = act,
                    paid = pd,
                    dueDateLabel = due,
                    fundingLabel = fundingLabel,
                    statusLabel = status
                )
            )
        }
        budgetLines = bList
        totalEstBudget = totalEst
        totalActBudget = totalAct
        totalPdBudget = totalPd

        // Guest Map for name resolution
        val gArray = root.optJSONArray("guests")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required guests list missing in private real shadow fixture.")
        totalGuestsCount = gArray.length()
        val guestNameMap = mutableMapOf<String, String>()
        val tableAssignedCapacity = mutableMapOf<String, Int>()
        var totalAssignedCap = 0
        var pendingCount = 0
        var attendingCount = 0

        for (i in 0 until gArray.length()) {
            val g = gArray.getJSONObject(i)
            val gId = g.optString("id")
            val gName = g.optString("name")
            val rsvpRaw = g.optString("rsvpStatus")
            if (gId.isEmpty() || gName.isEmpty() || rsvpRaw.isEmpty() || !g.has("partySize")) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required guest fields missing in private real shadow fixture.")
            }
            val partySize = g.optInt("partySize", 1)
            guestNameMap[gId] = gName
            if (rsvpRaw.equals("attending", ignoreCase = true) || rsvpRaw.equals("confirmed", ignoreCase = true)) {
                attendingCount++
            } else if (!rsvpRaw.equals("declined", ignoreCase = true)) {
                pendingCount++
            }

            if (!g.isNull("seatingTableId")) {
                val tId = g.getString("seatingTableId")
                if (tId.isNotEmpty()) {
                    totalAssignedCap += partySize
                    tableAssignedCapacity[tId] = (tableAssignedCapacity[tId] ?: 0) + partySize
                }
            }
        }
        pendingRsvpCount = pendingCount
        attendingGuestsCount = attendingCount
        assignedInvitedCapacity = totalAssignedCap

        // 2. Contributions (4 items)
        val cArray = root.optJSONArray("contributions")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required contributions missing in private real shadow fixture.")
        val cList = mutableListOf<PlannerContributionRecord>()
        for (i in 0 until cArray.length()) {
            val item = cArray.getJSONObject(i)
            val id = item.optString("id")
            val guestId = item.optString("guestId")
            val type = item.optString("type")
            val status = item.optString("status")
            if (id.isEmpty() || guestId.isEmpty() || type.isEmpty() || status.isEmpty()) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required contribution fields missing in private real shadow fixture.")
            }
            val contributorName = guestNameMap[guestId]
                ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing(
                    "Contribution $id references unknown guest $guestId."
                )
            val formattedType = type.replace("_", " ").replaceFirstChar { it.uppercase() }
            val formattedStatus = status.replace("_", " ").replaceFirstChar { it.uppercase() }
            val privacy = item.optString("privacy", "public").replaceFirstChar { it.uppercase() }
            val wordCount = item.optInt("wordCount", 0)
            val contributionText = listOf("message", "content", "story", "note", "text")
                .asSequence()
                .map { key -> if (item.isNull(key)) "" else item.optString(key).trim() }
                .firstOrNull { it.isNotBlank() }
                ?: if (wordCount > 0) "$formattedType message ($wordCount words • $privacy)" else "$formattedType ($privacy)"
            val verified = status.lowercase() in setOf("verified", "approved", "published", "received", "accepted", "recorded")
            cList.add(
                PlannerContributionRecord(
                    id = id,
                    contributorLabel = contributorName,
                    typeLabel = formattedType,
                    value = 0.0,
                    statusLabel = formattedStatus,
                    allocationLabel = contributionText,
                    verified = verified
                )
            )
        }
        contributions = cList

        // 3. Seating Tables (8 tables)
        val tArray = root.optJSONArray("seatingTables")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required seatingTables missing in private real shadow fixture.")
        var totalCap = 0
        val sList = mutableListOf<PlannerSeatingTable>()
        for (i in 0 until tArray.length()) {
            val item = tArray.getJSONObject(i)
            val id = item.optString("id")
            val name = item.optString("name")
            if (id.isEmpty() || name.isEmpty() || !item.has("capacity")) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required seating table fields missing in private real shadow fixture.")
            }
            val cap = item.getInt("capacity")
            totalCap += cap
            val assigned = tableAssignedCapacity[id] ?: 0
            val free = cap - assigned
            if (free < 0) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Integrity failure: table $name assigned capacity $assigned exceeds table capacity $cap.")
            }
            val zone = when {
                name.contains("Family") -> "Family"
                name.contains("Bridal") -> "Bridal Party"
                name.contains("VIP") -> "VIP"
                name.contains("Colleagues") -> "Colleagues"
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
        seatingTables = sList
        totalSeatingCapacity = totalCap
        val remCap = totalCap - totalAssignedCap
        if (remCap < 0) {
            throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Integrity failure: total assigned capacity $totalAssignedCap exceeds total seating capacity $totalCap.")
        }
        remainingTableCapacity = remCap

        // 4. Vendors & Service Engagements (7 vendors / 8 engagements)
        val vArray = root.optJSONArray("vendors")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required vendors missing in private real shadow fixture.")
        vendorsCount = vArray.length()

        val engagementsArray = root.optJSONArray("serviceEngagements")
        serviceEngagementsCount = engagementsArray?.length() ?: 0

        val vendorsById = mutableMapOf<String, JSONObject>()
        for (i in 0 until vArray.length()) {
            val vendor = vArray.getJSONObject(i)
            val vendorId = vendor.optString("id")
            if (vendorId.isNotBlank()) vendorsById[vendorId] = vendor
        }

        val vList = mutableListOf<PlannerVendorEngagement>()
        val vendorsWithEngagements = mutableSetOf<String>()

        if (engagementsArray != null) {
            for (i in 0 until engagementsArray.length()) {
                val se = engagementsArray.getJSONObject(i)
                val engagementId = se.optString("id")
                val vendorId = se.optString("vendorId")
                if (engagementId.isBlank() || vendorId.isBlank()) {
                    throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing(
                        "Required service engagement id/vendorId missing in private real shadow fixture."
                    )
                }

                val vendor = vendorsById[vendorId]
                    ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing(
                        "Service engagement $engagementId references unknown vendor $vendorId."
                    )
                vendorsWithEngagements.add(vendorId)

                val name = vendor.optString("name")
                val cat = vendor.optString("category")
                if (name.isBlank() || cat.isBlank()) {
                    throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing(
                        "Required vendor fields missing for service engagement $engagementId."
                    )
                }

                val payStatus = vendor.optString("paymentStatus")
                    .takeIf { it.isNotBlank() }
                    ?.replace("_", " ")
                    ?.replaceFirstChar { it.uppercase() }
                    ?: "Not recorded"
                val serviceDesc = se.optString("serviceDescription")
                    .takeIf { it.isNotBlank() }
                    ?: "Service details not recorded"
                val lifecycleStatus = se.optString("lifecycleStatus")
                    .takeIf { it.isNotBlank() }
                    ?.replace("_", " ")
                    ?.replaceFirstChar { it.uppercase() }
                    ?: "Not recorded"
                val externalAgreementStatus = se.optString("externalAgreementStatus")
                    .takeIf { it.isNotBlank() }
                    ?.replace("_", " ")
                    ?.replaceFirstChar { it.uppercase() }
                    ?: "Not recorded"

                vList.add(
                    PlannerVendorEngagement(
                        id = engagementId,
                        vendorName = name,
                        category = cat.replaceFirstChar { it.uppercase() },
                        bookingStatus = lifecycleStatus,
                        contractStatus = externalAgreementStatus,
                        paymentStatus = payStatus,
                        nextAction = serviceDesc
                    )
                )
            }
        }

        vendorEngagements = vList

        // 5. Timeline Entries (13 entries)
        val pArray = root.optJSONArray("programme")
            ?: throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required programme missing in private real shadow fixture.")
        val pList = mutableListOf<PlannerTimelineEntry>()
        for (i in 0 until pArray.length()) {
            val item = pArray.getJSONObject(i)
            val id = item.optString("id")
            val time = item.optString("time")
            val title = item.optString("title")
            if (id.isEmpty() || time.isEmpty() || title.isEmpty()) {
                throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing("Required programme fields missing in private real shadow fixture.")
            }
            val loc = if (item.isNull("location") || item.optString("location").isBlank()) weddingVenue else item.optString("location")
            pList.add(
                PlannerTimelineEntry(
                    id = id,
                    time = time,
                    title = title,
                    location = loc,
                    statusLabel = weddingDate,
                    linkedVendor = null
                )
            )
        }
        timelineEntries = pList

        // 6. Documents / contracts. Current Charity & Kudzie snapshot is expected to be empty,
        // but this keeps the destination connected to the same account graph for future rows.
        val documentList = mutableListOf<PlannerDocumentRecord>()
        val contractsArray = root.optJSONArray("contracts")
        if (contractsArray != null) {
            for (i in 0 until contractsArray.length()) {
                val item = contractsArray.getJSONObject(i)
                val id = item.optString("id")
                if (id.isBlank()) {
                    throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing(
                        "Contract row missing id in private real shadow fixture."
                    )
                }
                val title = listOf("title", "name", "contractType", "serviceDescription")
                    .asSequence()
                    .map { key -> if (item.isNull(key)) "" else item.optString(key).trim() }
                    .firstOrNull { it.isNotBlank() }
                    ?: "Contract"
                val status = listOf("status", "contractStatus", "lifecycleStatus")
                    .asSequence()
                    .map { key -> if (item.isNull(key)) "" else item.optString(key).trim() }
                    .firstOrNull { it.isNotBlank() }
                    ?.replace("_", " ")
                    ?.replaceFirstChar { it.uppercase() }
                documentList.add(PlannerDocumentRecord(id, title, "Contract", status))
            }
        }

        val vaultArray = root.optJSONArray("vaultObjects")
        if (vaultArray != null) {
            for (i in 0 until vaultArray.length()) {
                val item = vaultArray.getJSONObject(i)
                val id = item.optString("id")
                if (id.isBlank()) {
                    throw NativeRepositoryFactoryError.PrivateRealShadowFixtureMissing(
                        "Vault object row missing id in private real shadow fixture."
                    )
                }
                val title = listOf("title", "name", "fileName", "objectName")
                    .asSequence()
                    .map { key -> if (item.isNull(key)) "" else item.optString(key).trim() }
                    .firstOrNull { it.isNotBlank() }
                    ?: "Document"
                val status = listOf("status", "state")
                    .asSequence()
                    .map { key -> if (item.isNull(key)) "" else item.optString(key).trim() }
                    .firstOrNull { it.isNotBlank() }
                    ?.replace("_", " ")
                    ?.replaceFirstChar { it.uppercase() }
                documentList.add(PlannerDocumentRecord(id, title, "Document", status))
            }
        }
        documents = documentList
    }

    override suspend fun getDashboard(): PlannerDashboardSnapshot {
        val contractCount = documents.count { it.kind.equals("Contract", ignoreCase = true) }
        val timelineDateLabel = weddingDate.substringBefore(" ").ifBlank { weddingDate }

        return PlannerDashboardSnapshot(
        weddingId = weddingId,
        coupleNames = weddingTitle,
        weddingDateLabel = weddingDate,
        lifecycle = weddingLifecycle,
        plannerContext = plannerTitle,
        readinessScore = null,
        taskCompletionLabel = "$doneTasksCount / $totalTasksCount",
        attentionItems = listOf(
            PlannerAttentionItem("attn_tasks", "$highPriorityTasksCount high priority tasks", "Active checklist tasks requiring coordination.", PlannerAttentionSeverity.URGENT),
            PlannerAttentionItem("attn_rsvp", "$pendingRsvpCount RSVPs pending", "$attendingGuestsCount confirmed guests across $totalGuestsCount invited records.", PlannerAttentionSeverity.WARNING),
            PlannerAttentionItem("attn_seating", "$assignedInvitedCapacity of $totalSeatingCapacity table seats allocated", "$remainingTableCapacity seats free across ${seatingTables.size} tables.", PlannerAttentionSeverity.INFO),
            PlannerAttentionItem("attn_vendor", "$vendorsCount vendors recorded", "$contractCount active contracts recorded for this wedding.", PlannerAttentionSeverity.INFO),
            PlannerAttentionItem("attn_payment", "Budget & Expenses", "$${totalPdBudget.toInt()} paid of $${totalActBudget.toInt()} actual expenses ($${totalEstBudget.toInt()} estimated).", PlannerAttentionSeverity.INFO)
        ),
        modules = listOf(
            PlannerModuleSummary("tasks", "Tasks", "$doneTasksCount / $totalTasksCount", "$highPriorityTasksCount high priority", "checklist"),
            PlannerModuleSummary("budget", "Budget", "$${String.format("%.1fk", totalEstBudget / 1000.0)}", "$${String.format("%.1fk", totalPdBudget / 1000.0)} paid", "creditcard"),
            PlannerModuleSummary("contributions", "Contributions", "${contributions.size} messages", "Non-monetary", "gift"),
            PlannerModuleSummary("vendors", "Vendors", "$vendorsCount vendors", "$serviceEngagementsCount service engagements • $contractCount contracts", "storefront"),
            PlannerModuleSummary("guests", "Guests", "$totalGuestsCount", "$pendingRsvpCount pending", "person.3"),
            PlannerModuleSummary("seating", "Seating", "$assignedInvitedCapacity / $totalSeatingCapacity", "$remainingTableCapacity seats free", "table.furniture"),
            PlannerModuleSummary("timeline", "Timeline", "${timelineEntries.size} items", timelineDateLabel, "calendar.badge.clock")
        ),
        recentActivity = emptyList(),
        sourceLabel = "Private real-wedding row snapshot"
        )
    }

    override suspend fun getBudgetLines(): List<PlannerBudgetLine> = budgetLines
    override suspend fun getContributions(): List<PlannerContributionRecord> = contributions
    override suspend fun getVendorEngagements(): List<PlannerVendorEngagement> = vendorEngagements
    override suspend fun getSeatingTables(): List<PlannerSeatingTable> = seatingTables
    override suspend fun getTimelineEntries(): List<PlannerTimelineEntry> = timelineEntries
    override suspend fun getDocuments(): List<PlannerDocumentRecord> = documents
}
