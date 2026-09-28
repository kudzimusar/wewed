package pro.wewed.app.ui.roles

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.*
import pro.wewed.app.navigation.NavigationContext
import pro.wewed.app.navigation.PrimaryDestination
import pro.wewed.app.services.AdminSystemRepository
import pro.wewed.app.services.AdminSystemSnapshot
import pro.wewed.app.services.WeddingScopeMismatch
import pro.wewed.app.services.forWedding
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WeddingIdentityPalette

/**
 * IA V2 Level-2 workspace content.
 *
 * Every section here reads through the canonical repositories on [AppViewModel], scoped by the
 * active wedding carried in [NavigationContext]. Loads are keyed on `activeWeddingId`, so a wedding
 * switch re-resolves the graph rather than leaving a sibling workspace stale (IA V2 §13.2/§13.5).
 * Sections with no repository contract yet render an explicit unsupported state naming the gap —
 * never invented values (playbook §16).
 */

/**
 * Task due-date semantics (P0-14).
 *
 * "Overdue" means a due date in the past, not "urgent and unfinished". Tasks without a due date
 * are deliberately excluded from both overdue and upcoming views: an undated task has no deadline
 * to be late for, and counting it as either would overstate what the graph records.
 */
object TaskDeadlines {
    private val isoDate = Regex("""^(\d{4})-(\d{2})-(\d{2})""")

    fun dueEpochDay(task: PlannerTask): Long? {
        val match = isoDate.find(task.dueDate.orEmpty()) ?: return null
        val (y, m, d) = match.destructured
        return runCatching { java.time.LocalDate.of(y.toInt(), m.toInt(), d.toInt()).toEpochDay() }
            .getOrNull()
    }

    fun overdue(tasks: List<PlannerTask>, today: Long = java.time.LocalDate.now().toEpochDay()): List<PlannerTask> =
        tasks.filter { it.status != TaskStatus.DONE }
            .filter { task -> dueEpochDay(task)?.let { it < today } == true }

    /** Open, dated tasks falling inside the next [windowDays] days, in date order. */
    fun upcoming(
        tasks: List<PlannerTask>,
        today: Long = java.time.LocalDate.now().toEpochDay(),
        windowDays: Long = 30
    ): List<PlannerTask> =
        tasks.filter { it.status != TaskStatus.DONE }
            .mapNotNull { task -> dueEpochDay(task)?.let { due -> task to due } }
            .filter { (_, due) -> due >= today && due <= today + windowDays }
            .sortedBy { it.second }
            .map { it.first }

    fun undated(tasks: List<PlannerTask>): List<PlannerTask> =
        tasks.filter { it.status != TaskStatus.DONE && dueEpochDay(it) == null }
}

/** Canonical wedding graph slice, loaded once per workspace and shared by its sections. */
class WeddingGraphState {
    var wedding by mutableStateOf<Wedding?>(null)
    var tasks by mutableStateOf<List<PlannerTask>>(emptyList())
    var guests by mutableStateOf<List<Guest>>(emptyList())
    var budget by mutableStateOf<BudgetSummary?>(null)
    var vendors by mutableStateOf<List<VendorPresence>>(emptyList())
    var announcements by mutableStateOf<List<WeddingAnnouncement>>(emptyList())
    var auditRecords by mutableStateOf<List<CheckInAuditRecord>>(emptyList())

    // Production-derived domains. Empty here means "this source holds none", which the manifest
    // can confirm; it is not the same as "the app has no adapter for it".
    var manifest by mutableStateOf<UatSnapshotManifest?>(null)
    var contentSections by mutableStateOf<List<WeddingContentSection>>(emptyList())
    var songs by mutableStateOf<List<SongEntry>>(emptyList())
    var qrDestinations by mutableStateOf<List<QrDestination>>(emptyList())
    var importJobs by mutableStateOf<List<ImportJobRecord>>(emptyList())
    var wallMessages by mutableStateOf<List<WallMessage>>(emptyList())
    var engagementParties by mutableStateOf<List<EngagementPartyRecord>>(emptyList())
    var contentRevisions by mutableStateOf<List<ContentRevisionRecord>>(emptyList())
    var auditEvents by mutableStateOf<List<AuditEventRecord>>(emptyList())
    var rsvpDetails by mutableStateOf<Map<String, GuestRsvpDetail>>(emptyMap())
    var guestContacts by mutableStateOf<Map<String, GuestContactDetail>>(emptyMap())
    var plannerAccess by mutableStateOf<PlannerAccessContext?>(null)
    var adminAccess by mutableStateOf<AdminAccessContext?>(null)

    var loading by mutableStateOf(true)
    var error by mutableStateOf<String?>(null)

    /** Content for one production section key, or an empty section when the couple published none. */
    fun section(key: String): WeddingContentSection =
        contentSections.firstOrNull { it.section == key }
            ?: WeddingContentSection(key, WeddingContentSection.titleFor(key), emptyList())

    /** The wedding this graph was actually loaded for; null until a scoped load succeeds. */
    var scopedWeddingId by mutableStateOf<String?>(null)

    /** Drops every row so a failed scope can never keep rendering the previous wedding. */
    fun clearGraph() {
        wedding = null
        tasks = emptyList()
        guests = emptyList()
        budget = null
        vendors = emptyList()
        announcements = emptyList()
        auditRecords = emptyList()
        manifest = null
        contentSections = emptyList()
        songs = emptyList()
        qrDestinations = emptyList()
        importJobs = emptyList()
        wallMessages = emptyList()
        engagementParties = emptyList()
        contentRevisions = emptyList()
        auditEvents = emptyList()
        rsvpDetails = emptyMap()
        guestContacts = emptyMap()
        plannerAccess = null
        adminAccess = null
        scopedWeddingId = null
    }
}

/**
 * Loads the wedding graph for the active wedding. Keyed on the wedding id so that navigating
 * between workspaces never silently rebinds to a different wedding.
 */
@Composable
fun rememberWeddingGraph(
    appViewModel: AppViewModel,
    context: NavigationContext
): WeddingGraphState {
    val state = remember(context.activeWeddingId) { WeddingGraphState() }
    LaunchedEffect(context.activeWeddingId) {
        state.loading = true
        state.error = null
        state.scopedWeddingId = null
        try {
            // P0-1: the graph is read through a repository bound to THIS wedding. If the source
            // cannot serve it, forWedding throws rather than returning another wedding's rows.
            val scoped = appViewModel.repository.forWedding(context.activeWeddingId)
            state.wedding = scoped.getWedding()
            state.tasks = scoped.getTasks()
            state.guests = scoped.getGuests()
            state.budget = scoped.getBudget()
            state.vendors = scoped.getVendors()
            state.announcements = scoped.getAnnouncements()
            state.auditRecords = scoped.getAuditRecords()

            // Production-derived graph. A source that holds none of this returns empty lists
            // through the protocol defaults, so this is safe for every environment.
            state.manifest = scoped.snapshotManifest()
            state.contentSections = scoped.getWeddingContentSections()
            state.songs = scoped.getSongs()
            state.qrDestinations = scoped.getQrDestinations()
            state.importJobs = scoped.getImportJobs()
            state.wallMessages = scoped.getWallMessages()
            state.engagementParties = scoped.getEngagementParties()
            state.contentRevisions = scoped.getContentRevisions()
            state.auditEvents = scoped.getAuditEvents()
            state.plannerAccess = scoped.plannerAccessContext()
            state.adminAccess = scoped.adminAccessContext()
            state.rsvpDetails = state.guests.mapNotNull { guest ->
                scoped.getRsvpDetail(guest.id)?.let { guest.id to it }
            }.toMap()
            state.guestContacts = state.guests.mapNotNull { guest ->
                scoped.getGuestContact(guest.id)?.let { guest.id to it }
            }.toMap()

            state.scopedWeddingId = scoped.weddingId
        } catch (mismatch: WeddingScopeMismatch) {
            state.clearGraph()
            state.error = "This workspace is not available for the selected wedding."
        } catch (failure: Exception) {
            state.clearGraph()
            state.error = failure.message ?: "Unable to load this wedding."
        }
        state.loading = false
    }
    return state
}

/** Level-2 host: documented section chips above repository-backed section content. */
@Composable
fun WorkspaceSurface(
    destination: PrimaryDestination,
    testTagPrefix: String,
    context: NavigationContext,
    sectionMemory: WorkspaceSectionMemory,
    sectionContent: @Composable (String) -> Unit
) {
    val default = destination.sections.firstOrNull() ?: destination.label
    val selectedSection = sectionMemory.selected(context, destination.id, default)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("$testTagPrefix-${destination.id}")
    ) {
        WorkspaceSectionChips(
            sections = destination.sections,
            selected = selectedSection,
            testTagPrefix = "$testTagPrefix-${destination.id}"
        ) { sectionMemory.select(context, destination.id, it) }

        Box(modifier = Modifier.weight(1f)) {
            sectionContent(selectedSection)
        }
    }
}

// ---------------------------------------------------------------------------
// Shared presentation primitives (approved Wewed visual language)
// ---------------------------------------------------------------------------

@Composable
fun IASectionList(
    title: String,
    subtitle: String? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            title,
            color = WeddingIdentityPalette.Ink,
            fontFamily = FontFamily.Serif,
            fontWeight = FontWeight.SemiBold,
            fontSize = 19.sp
        )
        subtitle?.let {
            Text(it, color = WeddingIdentityPalette.Muted, fontSize = 12.sp)
        }
        content()
    }
}

@Composable
fun IACard(
    title: String,
    subtitle: String? = null,
    trailing: String? = null,
    status: String? = null,
    testTag: String? = null,
    /**
     * Makes the whole row open a detail surface.
     *
     * A list of 175 guests with a separate "Open detail" line under each card reads as noise. When
     * a card leads somewhere, the card itself is the affordance and carries a chevron, matching the
     * Guest List.
     */
    onClick: (() -> Unit)? = null
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier),
        shape = RoundedCornerShape(12.dp),
        color = WeddingIdentityPalette.IvorySoft,
        border = androidx.compose.foundation.BorderStroke(1.dp, WeddingIdentityPalette.Hairline)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(title, color = WeddingIdentityPalette.Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                subtitle?.let {
                    Text(it, color = WeddingIdentityPalette.Muted, fontSize = 11.sp)
                }
                // Status is carried as text, never colour alone (IA V2 §19).
                status?.let {
                    Text(it, color = WeddingIdentityPalette.Forest, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            trailing?.let {
                Text(it, color = WeddingIdentityPalette.ChampagneDeep, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
            if (onClick != null) {
                Spacer(Modifier.width(8.dp))
                Icon(
                    Icons.Default.ChevronRight,
                    contentDescription = "Open detail",
                    tint = WeddingIdentityPalette.ChampagneDeep,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

/**
 * Honest unsupported state. Names the section and why it has no data in this environment,
 * so an empty workspace is never mistaken for a wired one (playbook §8, §16).
 */
@Composable
fun IAUnsupportedSection(
    section: String,
    reason: String,
    environment: NativeDataEnvironment
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .testTag("unsupported-section"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            Icons.Default.Info,
            contentDescription = null,
            tint = WeddingIdentityPalette.Muted,
            modifier = Modifier.size(28.dp)
        )
        Spacer(Modifier.height(10.dp))
        Text(
            section,
            color = WeddingIdentityPalette.Ink,
            fontFamily = FontFamily.Serif,
            fontWeight = FontWeight.SemiBold,
            fontSize = 17.sp
        )
        Spacer(Modifier.height(6.dp))
        Text(
            reason,
            color = WeddingIdentityPalette.Muted,
            fontSize = 12.sp,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
        Spacer(Modifier.height(10.dp))
        Text(
            "Environment: ${environment.title}",
            color = WeddingIdentityPalette.Muted,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
fun IALoading() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep)
    }
}

/**
 * Master plan Phase 8 closure round 3 §2/§7 — a live domain that failed to load, distinct from
 * [IAUnsupportedSection] (no adapter exists at all) and from a genuinely fetched empty result
 * (which renders that section's own real empty state, never this one). Collapsing these three into
 * one message is exactly the false-empty/false-unsupported class of defect this exists to prevent.
 */
@Composable
fun IASectionUnavailable(section: String, environment: NativeDataEnvironment) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .testTag("section-unavailable"),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            Icons.Default.Warning,
            contentDescription = null,
            tint = WeddingIdentityPalette.Muted,
            modifier = Modifier.size(28.dp)
        )
        Spacer(Modifier.height(10.dp))
        Text(
            section,
            color = WeddingIdentityPalette.Ink,
            fontFamily = FontFamily.Serif,
            fontWeight = FontWeight.SemiBold,
            fontSize = 17.sp
        )
        Spacer(Modifier.height(6.dp))
        Text(
            "This could not be refreshed right now. No cached or fabricated data is shown.",
            color = WeddingIdentityPalette.Muted,
            fontSize = 12.sp,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
        Spacer(Modifier.height(10.dp))
        Text(
            "Environment: ${environment.title}",
            color = WeddingIdentityPalette.Muted,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

/**
 * Master plan Phase 8 closure round 3 §2/§7 — one repository call, three honest outcomes. [Loading]
 * while the call is in flight, [Loaded] with the real value on success (an empty list/zero count IS
 * a valid [Loaded] value — that is the authoritative EMPTY case, not a failure), and [Unavailable]
 * only when the call itself threw. A section using this must never fall back to an empty collection
 * on the [Unavailable] branch — that is precisely the false-empty defect this type exists to close.
 */
sealed interface ProductionLoadState<out T> {
    data object Loading : ProductionLoadState<Nothing>
    data class Loaded<T>(val value: T) : ProductionLoadState<T>
    data object Unavailable : ProductionLoadState<Nothing>
}

/**
 * Runs [load] once per [key], catching only [ProductionReadOnlyDomainUnavailable] — the one
 * exception type the production repositories in this codebase throw for a live transport/
 * authority/permission/revocation failure (see `ProductionPlannerDashboardRepository`,
 * `ProductionAdminSystemRepository`). Anything else (e.g. `CancellationException`) propagates
 * normally rather than being swallowed into a false [ProductionLoadState.Unavailable].
 */
@Composable
fun <T> rememberProductionLoad(key: Any?, load: suspend () -> T): ProductionLoadState<T> {
    var state by remember(key) { mutableStateOf<ProductionLoadState<T>>(ProductionLoadState.Loading) }
    LaunchedEffect(key) {
        state = try {
            ProductionLoadState.Loaded(load())
        } catch (e: pro.wewed.app.services.ProductionReadOnlyDomainUnavailable) {
            ProductionLoadState.Unavailable
        }
    }
    return state
}

// ---------------------------------------------------------------------------
// Guests workspace (Couple) — IA V2 §4
// ---------------------------------------------------------------------------

@Composable
fun CoupleGuestsSection(section: String, graph: WeddingGraphState, environment: NativeDataEnvironment) {
    if (graph.loading) return IALoading()
    val guests = graph.guests

    when (section) {
        "Guest List" -> IASectionList("Guest List", "${guests.size} households • ${guests.sumOf { it.partySize }} guests") {
            guests.forEach { guest ->
                IACard(
                    title = guest.name,
                    subtitle = "${guest.householdName ?: "—"} • party of ${guest.partySize}",
                    trailing = guest.rsvpStatus.title,
                    testTag = "guest-row-${guest.id}"
                )
            }
        }
        "RSVP" -> {
            val attending = guests.filter { it.rsvpStatus == RSVPStatus.ATTENDING }
            val pending = guests.filter { it.rsvpStatus == RSVPStatus.PENDING }
            val declined = guests.filter { it.rsvpStatus == RSVPStatus.DECLINED }
            var openGuestId by remember { mutableStateOf<String?>(null) }
            val openGuest = guests.firstOrNull { it.id == openGuestId }

            if (openGuest != null) {
                BackHandler { openGuestId = null }
                // The Couple is authorized to see the full record for their own guests.
                GuestRsvpDetailSection(
                    guest = openGuest,
                    rsvp = graph.rsvpDetails[openGuest.id],
                    contact = graph.guestContacts[openGuest.id],
                    canSeePrivateDetail = true
                )
                return
            }

            val dietary = graph.rsvpDetails.values.count { it.hasDietaryRequirement }
            val subtitle = buildString {
                append("${attending.size} attending • ${pending.size} pending • ${declined.size} declined")
                if (dietary > 0) append(" • $dietary dietary")
            }
            IASectionList("RSVP", subtitle) {
                guests.forEach { guest ->
                    val detail = graph.rsvpDetails[guest.id]
                    val markers = listOfNotNull(
                        detail?.mealChoice?.takeIf { it.isNotBlank() },
                        if (detail?.plusOne == true) "+1" else null,
                        detail?.kidsCount?.takeIf { it > 0 }?.let { "$it kids" },
                        if (detail?.hasDietaryRequirement == true) "Dietary" else null,
                        if (detail?.hasMessage == true) "Message" else null
                    ).joinToString(" · ")
                    IACard(
                        title = guest.name,
                        subtitle = listOf("Party of ${guest.partySize}", markers)
                            .filter { it.isNotBlank() }
                            .joinToString(" — "),
                        trailing = guest.rsvpStatus.title,
                        testTag = "rsvp-row-${guest.id}",
                        onClick = { openGuestId = guest.id }
                    )
                }
            }
        }
        // A Wedding Pass serial is derived from RSVP = attending. Labelling that "Issued" claimed
        // an invitation had been DELIVERED, which it does not evidence — and which iOS correctly
        // refused to claim, so this was also an Android/iOS parity defect.
        //
        // Neither does the web record delivery: /api/planner/guests/invitations returns an
        // addressable invitation link, a QR value and a share message, alongside RSVP status.
        // That link is server-issued and its token is deliberately absent from the native
        // snapshot, so native shows the RSVP truth it holds and names the missing adapter.
        "Invitations" -> IASectionList("Invitations", "${guests.size} guests") {
            IACapabilityNotConnected(
                capability = "Invitation links & sharing",
                webSource = "GET/POST/PUT /api/planner/guests/invitations (+ physical invitations)",
                detail = "Invitation links, QR values and share messages are issued by the server. " +
                    "Wewed web sends and re-sends invitations; mobile has no contract for it yet.",
                testTagPrefix = "invitations"
            )
            Spacer(Modifier.height(6.dp))
            Text(
                "RSVP status",
                color = WeddingIdentityPalette.Muted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.sp
            )
            guests.forEach { guest ->
                IACard(
                    title = guest.name,
                    subtitle = guest.householdName ?: "—",
                    // The RSVP answer is a fact the graph holds. Delivery is not.
                    trailing = guest.rsvpStatus.title,
                    testTag = "invitation-rsvp-${guest.id}"
                )
            }
        }
        "Groups / Households" -> {
            val households = guests.groupBy { it.householdName ?: guest_unassigned }
            IASectionList("Groups / Households", "${households.size} groups") {
                households.forEach { (household, members) ->
                    IACard(
                        title = household,
                        subtitle = members.joinToString { it.name },
                        trailing = "${members.sumOf { it.partySize }}"
                    )
                }
            }
        }
        "Seating" -> {
            val seated = guests.filter { it.tableName != null }
            IASectionList("Seating", "${seated.size} of ${guests.size} households seated") {
                guests.forEach { guest ->
                    IACard(
                        title = guest.name,
                        subtitle = guest.tableName ?: "Not yet assigned",
                        trailing = guest.tableNumber?.toString()
                    )
                }
            }
        }
        "Passes / QR" -> IASectionList("Passes / QR", "Wedding Pass issuance by household") {
            guests.forEach { guest ->
                IACard(
                    title = guest.name,
                    subtitle = guest.passSerial ?: "No pass serial recorded",
                    trailing = if (guest.checkedIn) "Admitted" else null,
                    status = if (guest.checkedIn) "${guest.checkedInCount}/${guest.partySize} admitted" else null
                )
            }
        }
        "Messages" -> IAUnsupportedSection(
            "Messages",
            "Guest messaging has no native message contract in this environment yet. No conversation data is fabricated.",
            environment
        )
        else -> IAUnsupportedSection(section, "This section is not wired to a repository yet.", environment)
    }
}

private const val guest_unassigned = "Unassigned"

// ---------------------------------------------------------------------------
// Wedding Day workspace — shared by Couple / Guest / Planner / Coordinator
// ---------------------------------------------------------------------------

@Composable
fun WeddingDaySection(
    section: String,
    graph: WeddingGraphState,
    environment: NativeDataEnvironment,
    /** The guest whose table may be shown. Null means no guest identity is bound (P0-4). */
    boundGuestId: String? = null,
    passContent: (@Composable () -> Unit)? = null
) {
    if (graph.loading) return IALoading()
    val wedding = graph.wedding

    if (environment == NativeDataEnvironment.PRODUCTION &&
        section in setOf("Vendor Status", "Vendor Arrivals", "Announcements", "Offline Status", "Offline", "Sync Status")
    ) {
        IAUnsupportedSection(
            section,
            "This Wedding-Day operational stream is not connected to native production in Phase 8. No empty operational state is inferred.",
            environment
        )
        return
    }

    when (section) {
        "My Pass", "Wedding Pass" -> passContent?.invoke() ?: IAUnsupportedSection(
            section, "No Wedding Pass is issued for this actor in the active wedding.", environment
        )
        "Programme", "Programme Status" -> IASectionList("Programme", wedding?.venueName) {
            wedding?.programme.orEmpty().forEach { item ->
                IACard(
                    title = item.title,
                    subtitle = "${item.location} • ${item.description}",
                    trailing = item.time,
                    testTag = "programme-${item.id}"
                )
            }
        }
        // Venue is the largest published content section for this wedding (25 rows). Rendering only
        // the name and address discarded everything the couple actually wrote about it.
        "Venue & Maps", "Venue", "Maps", "Venue Map" -> IASectionList("Venue", wedding?.venueName) {
            wedding?.let {
                IACard(title = it.venueName, subtitle = it.venueAddress, trailing = null)
                IACard(title = "City", subtitle = "${it.city}, ${it.country}")
            }
            val venueContent = graph.section("venue")
            venueContent.proseEntries.forEach { entry ->
                IACard(
                    title = entry.field.humanisedContentField(),
                    subtitle = entry.value,
                    testTag = "venue-${entry.field}"
                )
            }
        }
        "Travel" -> WeddingContentSectionView(graph.section("travel"), "travel")
        "FAQ" -> WeddingContentSectionView(graph.section("faq"), "faq")
        "The Day", "Wedding Info" -> WeddingContentSectionView(graph.section("theday"), "theday")
        "After" -> WeddingContentSectionView(graph.section("after"), "after")
        "Songbook", "Music" -> SongbookSection(graph.songs, guestVisible = boundGuestId != null)
        "Vendor Status", "Vendor Arrivals" -> IASectionList("Vendor Status", "${graph.vendors.size} vendors on site plan") {
            graph.vendors.forEach { vendor ->
                IACard(
                    title = vendor.vendorName,
                    subtitle = "${vendor.serviceCategory} • ${vendor.serviceArea}",
                    trailing = vendor.expectedTime,
                    status = vendor.state.title,
                    testTag = "vendor-${vendor.id}"
                )
            }
        }
        "Announcements" -> IASectionList("Announcements", "${graph.announcements.size} posted") {
            graph.announcements.forEach { announcement ->
                IACard(
                    title = announcement.title,
                    subtitle = announcement.message,
                    status = announcement.urgency.name
                )
            }
        }
        "Table" -> IASectionList("Table", "Your seating assignment") {
            // P0-4: only the bound guest's own table may be shown here. Falling back to the first
            // seated guest would show another household's name and table.
            val self = boundGuestId?.let { id -> graph.guests.firstOrNull { it.id == id } }
            when {
                self == null -> IACard(
                    title = "No invitation bound",
                    subtitle = "No guest identity is bound to this session."
                )
                self.tableName != null -> IACard(
                    title = self.tableName!!,
                    subtitle = self.name,
                    testTag = "wedding-day-table-${self.id}"
                )
                else -> IACard(title = "Not yet assigned", subtitle = "Seating has not been published.")
            }
        }
        "Key Contacts", "Contacts", "Emergency Contacts" -> IAUnsupportedSection(
            section,
            "No wedding contact directory contract exists natively yet. Contacts are not invented.",
            environment
        )
        // P0-14: the graph has no wedding-day flag on tasks, so this cannot claim to be "tasks
        // due on the day". It is named for what it actually is: every open planning task.
        "Wedding-day Checklist" -> IASectionList(
            "Open planning tasks",
            "All incomplete tasks. The wedding graph does not mark tasks as wedding-day specific."
        ) {
            val open = graph.tasks.filter { it.status != TaskStatus.DONE }
            if (open.isEmpty()) {
                IACard(title = "Nothing outstanding", subtitle = "All planning tasks are complete.")
            }
            open.forEach { task ->
                IACard(
                    title = task.title,
                    subtitle = task.category,
                    trailing = task.dueDate ?: "No due date",
                    status = task.priority.title
                )
            }
        }
        "Offline Status", "Offline", "Sync Status" -> IASectionList("Offline & sync", "Local gate manifest state") {
            val unsynced = graph.auditRecords.count { !it.isSynced }
            IACard(title = "Recorded admissions", subtitle = "Local audit records", trailing = "${graph.auditRecords.size}")
            IACard(title = "Awaiting sync", subtitle = "Unsynced local scans", trailing = "$unsynced")
        }
        else -> IAUnsupportedSection(section, "This wedding-day section is not wired to a repository yet.", environment)
    }
}

// ---------------------------------------------------------------------------
// Gate Team workspace — IA V2 §8
// ---------------------------------------------------------------------------

@Composable
fun GateAdmissionsSection(section: String, graph: WeddingGraphState, environment: NativeDataEnvironment) {
    if (graph.loading) return IALoading()
    val guests = graph.guests

    when (section) {
        "Checked In" -> {
            val admitted = guests.filter { it.checkedInCount > 0 }
            IASectionList("Checked In", "${admitted.sumOf { it.checkedInCount }} guests admitted") {
                admitted.forEach { AdmissionRow(it) }
                if (admitted.isEmpty()) IACard("No admissions recorded", "No guest has been scanned yet.")
            }
        }
        "Not Arrived" -> {
            val notArrived = guests.filter { it.checkedInCount == 0 }
            IASectionList("Not Arrived", "${notArrived.size} households outstanding") {
                notArrived.forEach { AdmissionRow(it) }
                if (notArrived.isEmpty()) IACard("All arrived", "Every expected household has been admitted.")
            }
        }
        "Partial Parties" -> {
            val partial = guests.filter { it.checkedInCount in 1 until it.partySize }
            IASectionList("Partial Parties", "${partial.size} parties partially admitted") {
                partial.forEach { AdmissionRow(it) }
                if (partial.isEmpty()) IACard("No partial parties", "No household is partially admitted.")
            }
        }
        "Duplicate Scans" -> {
            // P0-14: multiple audit rows for one serial are normal — a household of four can be
            // admitted in several partial scans. A genuine duplicate is an admission beyond the
            // recorded party size, which is what is reported here.
            val admittedBySerial = graph.auditRecords
                .groupBy { it.passSerial }
                .mapValues { (_, records) -> records.sumOf { it.countAdmitted } }
            val overAdmitted = graph.guests.filter { guest ->
                val serial = guest.passSerial ?: return@filter false
                (admittedBySerial[serial] ?: 0) > guest.partySize
            }
            IASectionList("Duplicate Scans", "Admissions beyond the recorded party size") {
                overAdmitted.forEach { guest ->
                    IACard(
                        title = guest.name,
                        subtitle = "Party of ${guest.partySize}",
                        trailing = "${admittedBySerial[guest.passSerial] ?: 0} admitted"
                    )
                }
                if (overAdmitted.isEmpty()) {
                    IACard(
                        "No over-admissions",
                        "No pass has admitted more guests than its recorded party size. Rejected duplicate attempts are not stored in the audit log, so they cannot be listed here."
                    )
                }
            }
        }
        "Exceptions" -> {
            val over = guests.filter { it.checkedInCount > it.partySize }
            IASectionList("Exceptions", "Capacity and manifest exceptions") {
                over.forEach { AdmissionRow(it) }
                if (over.isEmpty()) IACard("No exceptions", "No admission exceeded its recorded party size.")
            }
        }
        "Manual Admission" -> IAUnsupportedSection(
            "Manual Admission",
            "Manual admission is an action performed from Scan, not a browsable list. Open Scan to admit without a readable code.",
            environment
        )
        else -> IAUnsupportedSection(section, "This admissions section is not wired yet.", environment)
    }
}

@Composable
private fun AdmissionRow(guest: Guest) {
    IACard(
        title = guest.name,
        subtitle = guest.tableName ?: "No table assigned",
        trailing = "${guest.checkedInCount}/${guest.partySize}",
        status = guest.rsvpStatus.title,
        testTag = "admission-${guest.id}"
    )
}

/** Gate guest lookup is operational only: name, party, table, RSVP, admission. No financial data. */
@Composable
fun GateGuestLookup(graph: WeddingGraphState) {
    if (graph.loading) return IALoading()
    var query by remember { mutableStateOf("") }
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 10.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth().testTag("gate-guest-search"),
            placeholder = { Text("Search name, household or table") },
            singleLine = true
        )
        Spacer(Modifier.height(10.dp))
        val filtered = graph.guests.filter {
            query.isBlank() ||
                it.name.contains(query, ignoreCase = true) ||
                it.householdName?.contains(query, ignoreCase = true) == true ||
                it.tableName?.contains(query, ignoreCase = true) == true
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(filtered.size) { index ->
                val guest = filtered[index]
                IACard(
                    title = guest.name,
                    subtitle = "Party ${guest.partySize} • ${guest.tableName ?: "No table"}",
                    trailing = "${guest.checkedInCount}/${guest.partySize}",
                    status = guest.rsvpStatus.title
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Admin workspace — IA V2 §10
// ---------------------------------------------------------------------------

/**
 * Admin audit.
 *
 * Admin is system-scoped: it opens without an active wedding, so the wedding graph is empty here
 * and `graph.adminAccess` is null. Reading the audit stream from that empty graph reported
 * "Nothing recorded" — which is the one thing that is certainly untrue. Production holds a real
 * wedding-scoped audit trail; what is missing is the authorization to read it as an administrator.
 * The access context is therefore resolved from the system-scoped source, independently of any
 * wedding binding, so a missing grant reads as a missing grant.
 */
@Composable
fun AdminAuditSection(
    section: String,
    graph: WeddingGraphState,
    environment: NativeDataEnvironment,
    adminAccess: AdminAccessContext? = null
) {
    if (graph.loading) return IALoading()
    when (section) {
        "Check-ins" -> IASectionList("Check-ins", "${graph.auditRecords.size} admission records") {
            graph.auditRecords.forEach { record ->
                IACard(
                    title = record.guestName,
                    subtitle = "${record.gateName} • usher ${record.usherId}",
                    trailing = "+${record.countAdmitted}",
                    status = if (record.isSynced) "Synced" else "Pending sync"
                )
            }
            if (graph.auditRecords.isEmpty()) {
                IACard("No check-in records", "No admissions have been recorded for this wedding.")
            }
        }
        // Production holds a real wedding-scoped AuditEvent trail. The native model carries only
        // the fields this surface needs; IP address, user agent and before/after values are not
        // part of it, so they cannot leak through a list of activity.
        //
        // Access remains gated: while the Admin read-only grant is missing, the section says so
        // instead of showing rows the reader is not authorized to interpret as an admin record.
        "Data Changes" -> AuditEventsSection(
            events = graph.auditEvents.filter { it.action.contains("update", true) || it.action.contains("create", true) || it.action.contains("delete", true) },
            adminAccess = adminAccess ?: graph.adminAccess,
            testTagPrefix = "audit-data-changes"
        )
        "Access Events" -> AuditEventsSection(
            events = graph.auditEvents.filter { it.action.contains("access", true) || it.action.contains("login", true) || it.action.contains("view", true) },
            adminAccess = adminAccess ?: graph.adminAccess,
            testTagPrefix = "audit-access-events"
        )
        "Admin Actions" -> AuditEventsSection(
            events = graph.auditEvents,
            adminAccess = adminAccess ?: graph.adminAccess,
            testTagPrefix = "audit-admin-actions"
        )
        "Payments", "Contracts" -> IAUnsupportedSection(
            section,
            "Production records no payment or contract audit rows for this wedding, and no audit entries are fabricated.",
            environment
        )
        else -> IAUnsupportedSection(section, "This audit section is not wired yet.", environment)
    }
}

/**
 * Admin dashboard (P0-13).
 *
 * Reads the **system** projection, not the wedding graph: a global administrative session must be
 * able to open Dashboard/Cases/Accounts/Audit without an active wedding. Wedding-scoped data is
 * loaded only when an administrator drills into a specific wedding.
 */
@Composable
fun AdminDashboardContent(
    adminRepository: AdminSystemRepository,
    context: NavigationContext
) {
    // Master plan Phase 8 closure round 3 §7 — a live fetch failure must render distinctly from
    // both "genuinely nothing here" (an empty snapshot Shadow/Fixture/Boundary never produce
    // because they never throw) and from the always-unsupported domains listed below.
    val state = rememberProductionLoad(context.actorId) { adminRepository.snapshot() }
    val snap = when (state) {
        is ProductionLoadState.Loading -> return IALoading()
        is ProductionLoadState.Unavailable -> return IASectionUnavailable("Dashboard", context.environment)
        is ProductionLoadState.Loaded -> state.value
    }

    IASectionList("Dashboard", "Platform overview — not scoped to a single wedding") {
        IACard(
            title = "Data environment",
            subtitle = "Native client is bound to this environment",
            trailing = snap.environment.title,
            testTag = "admin-environment"
        )
        IACard(
            title = "Weddings in administrative scope",
            subtitle = "Available to this administrator",
            trailing = "${snap.weddingsInScope}",
            testTag = "admin-weddings-in-scope"
        )
        IACard(
            title = if (context.activeWeddingId.isBlank()) "No wedding selected" else context.activeWeddingTitle,
            subtitle = if (context.activeWeddingId.isBlank()) {
                "Select a wedding to inspect its graph. The console does not require one."
            } else {
                "Currently drilled into this wedding"
            },
            testTag = "admin-active-wedding"
        )
        // Master plan Phase 8 closure §4 — real platform counts from loadAdminOverview, when this
        // admin's grant has resolved them. Null (not shown as zero) means "not fetched yet".
        snap.businessAccountsTotal?.let {
            IACard(title = "Business accounts", subtitle = "Platform-wide, excluding the Wewed internal account", trailing = "$it", testTag = "admin-business-accounts")
        }
        snap.activeAccountsTotal?.let {
            IACard(title = "Active accounts", subtitle = "Currently active", trailing = "$it", testTag = "admin-active-accounts")
        }
        snap.pendingReviewAccountsTotal?.let {
            IACard(title = "Pending review", subtitle = "Accounts awaiting approval", trailing = "$it", testTag = "admin-pending-review-accounts")
        }
        snap.openSupportCasesTotal?.let {
            IACard(title = "Open support cases", subtitle = "Not resolved or closed", trailing = "$it", testTag = "admin-open-support-cases")
        }
        snap.openIncidentsTotal?.let {
            IACard(title = "Open platform incidents", subtitle = "Not resolved", trailing = "$it", testTag = "admin-open-incidents")
        }
        snap.unsupportedStreams.forEach { stream ->
            IACard(
                title = stream,
                subtitle = "No native contract exists in this environment",
                trailing = "Unsupported"
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Vendor workspace — IA V2 §7
// ---------------------------------------------------------------------------

/**
 * Vendor sees only its own engagement. The native repository exposes vendor presence for the
 * wedding, so the engagement is resolved by [NavigationContext.activeEngagementId] and nothing
 * else is shown.
 */
@Composable
fun VendorJobsSection(
    section: String,
    appViewModel: AppViewModel,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    // Master plan Phase 8 closure round 3 §6 — "Contract" reads the Vendor's own managed-contract
    // lifecycle (ServiceEngagement/Contract), a COMPLETELY separate authority/data source from the
    // Wedding-Day presence graph (`graph.vendors`) every other section here reads. It is handled
    // BEFORE the `authorizedEngagement(graph)` gate below on purpose: that gate is about Wedding-Day
    // presence identity, which the contract lookup does not need and must not be blocked by.
    if (section == "Contract") {
        return VendorContractSection(appViewModel, context)
    }

    if (graph.loading) return IALoading()
    // P0-6: only the engagement this vendor is authorized for. There is no "first vendor"
    // fallback — that would show another company's engagement.
    val engagement = context.authorizedEngagement(graph)
        ?: return IAUnsupportedSection(
            section,
            "No service engagement is assigned to this vendor for the active wedding.",
            context.environment
        )

    when (section) {
        "Service Details" -> IASectionList(engagement.vendorName, engagement.serviceCategory) {
            IACard(title = "Service area", subtitle = engagement.serviceArea)
            IACard(title = "Expected on site", subtitle = "Scheduled arrival", trailing = engagement.expectedTime)
            IACard(title = "Presence", subtitle = "Current recorded state", status = engagement.state.title)
        }
        "Venue" -> IASectionList("Venue", graph.wedding?.venueName) {
            graph.wedding?.let {
                IACard(title = it.venueName, subtitle = it.venueAddress)
                IACard(title = "Service area", subtitle = engagement.serviceArea)
            }
        }
        "Tasks" -> IAUnsupportedSection(
            "Tasks",
            "Vendor-scoped tasks are not exposed by the native contract. Wedding planning tasks belong to the couple and planner and are deliberately not shown here.",
            context.environment
        )
        "Deliverables", "Payment", "Files", "Notes", "Client / Planner Contacts" -> IAUnsupportedSection(
            section,
            "No native contract exists for vendor $section yet. Recorded state is shown only where the repository provides it.",
            context.environment
        )
        else -> IAUnsupportedSection(section, "This vendor section is not wired yet.", context.environment)
    }
}

/**
 * Master plan Phase 8 closure round 3 §6 — real managed-contract data for the Vendor's own
 * engagement, via `AppViewModel.vendorEngagementRepository` (`/api/native/vendor/engagement` →
 * `getServiceEngagementDealRoom`, the same engine Contracts uses for Planner/Couple/Coordinator).
 * No Shadow/Fixture data exists for this brand-new-this-phase capability (see
 * [pro.wewed.app.services.EmptyVendorEngagementRepository]), so non-production says so honestly.
 */
@Composable
private fun VendorContractSection(appViewModel: AppViewModel, context: NavigationContext) {
    if (appViewModel.dataEnvironment != NativeDataEnvironment.PRODUCTION) {
        return IAUnsupportedSection(
            "Contract",
            "No Shadow or fixture contract data exists for this environment.",
            context.environment,
        )
    }
    val state = rememberProductionLoad(Unit) { appViewModel.vendorEngagementRepository.getMyEngagement() }
    val engagement = when (state) {
        is ProductionLoadState.Loading -> return IALoading()
        is ProductionLoadState.Unavailable -> return IASectionUnavailable("Contract", context.environment)
        is ProductionLoadState.Loaded -> state.value
    }
    IASectionList(engagement.serviceCategory, engagement.lifecycleStatus) {
        engagement.agreedAmount?.let {
            IACard(title = "Agreed amount", subtitle = "Commercial total on file", trailing = "$it ${engagement.currency}")
        }
        if (engagement.contracts.isEmpty()) {
            IACard(title = "No contract drafted yet", subtitle = "This engagement has no managed contract on file")
        } else {
            engagement.contracts.forEach { contract ->
                IACard(
                    title = contract.contractNumber,
                    subtitle = "Version ${contract.currentVersionNumber}",
                    trailing = contract.status,
                    testTag = "vendor-contract-${contract.id}"
                )
            }
        }
    }
}

@Composable
fun VendorScheduleSection(
    section: String,
    graph: WeddingGraphState,
    context: NavigationContext
) {
    if (graph.loading) return IALoading()
    val engagement = context.authorizedEngagement(graph)

    when (section) {
        "Calendar" -> IASectionList("Calendar", graph.wedding?.date) {
            graph.wedding?.programme.orEmpty().forEach { item ->
                IACard(title = item.title, subtitle = item.location, trailing = item.time)
            }
        }
        "Arrival Time" -> IASectionList("Arrival Time", engagement?.vendorName) {
            engagement?.let {
                IACard(title = "Expected arrival", subtitle = it.serviceArea, trailing = it.expectedTime)
                IACard(title = "Recorded presence", subtitle = "Updated by the wedding-day team", status = it.state.title)
            } ?: IACard("No engagement", "No assigned engagement for this wedding.")
        }
        "Setup", "Service Window", "Breakdown", "Dependencies" -> IAUnsupportedSection(
            section,
            "The native vendor contract records arrival and presence only. $section has no recorded value and is not inferred.",
            context.environment
        )
        else -> IAUnsupportedSection(section, "This schedule section is not wired yet.", context.environment)
    }
}

/**
 * The service engagement this vendor is authorized for (P0-6).
 *
 * Returns null when no engagement is bound, so the caller renders an honest empty state instead
 * of another vendor's engagement.
 */
fun NavigationContext.authorizedVendor(graph: WeddingGraphState): VendorPresence? {
    val vendorId = activeVendorId ?: return null
    return graph.vendors.firstOrNull { it.id == vendorId }
}

/**
 * Backwards-compatible alias used by the vendor workspaces, which present the vendor's own
 * presence record. The *service engagement* is a separate entity resolved from the planner
 * projection by [NavigationContext.activeEngagementId].
 */
fun NavigationContext.authorizedEngagement(graph: WeddingGraphState): VendorPresence? =
    authorizedVendor(graph)

/**
 * The guest record this context is bound to (P0-4).
 *
 * Returns null when no guest identity was resolved from a credential — callers must render an
 * honest unbound state rather than falling back to an arbitrary row.
 */
fun NavigationContext.boundGuest(graph: WeddingGraphState): Guest? {
    val guestId = activeGuestId ?: return null
    return graph.guests.firstOrNull { it.id == guestId }
}

/**
 * A Planner Action that performs a real operation (P0-11).
 *
 * Rendered as an actual control so that "tappable" and "does something" agree.
 */
@Composable
fun IAActionRow(
    title: String,
    subtitle: String,
    enabled: Boolean = true,
    testTag: String? = null,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        shape = RoundedCornerShape(12.dp),
        color = WeddingIdentityPalette.IvorySoft,
        border = androidx.compose.foundation.BorderStroke(1.dp, WeddingIdentityPalette.Hairline),
        enabled = enabled,
        onClick = onClick
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(title, color = WeddingIdentityPalette.Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                Text(subtitle, color = WeddingIdentityPalette.Muted, fontSize = 11.sp)
            }
            Text(
                if (enabled) "Run" else "…",
                color = WeddingIdentityPalette.ChampagneDeep,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

/**
 * A Planner Action that is deliberately not connected (P0-11).
 *
 * It is not tappable and says why, rather than presenting an inert card that implies capability.
 */
@Composable
fun IAUnsupportedActionRow(title: String, reason: String, testTag: String? = null) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        shape = RoundedCornerShape(12.dp),
        color = WeddingIdentityPalette.Ivory,
        border = androidx.compose.foundation.BorderStroke(1.dp, WeddingIdentityPalette.Hairline)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(title, color = WeddingIdentityPalette.Muted, fontSize = 14.sp)
                Text(reason, color = WeddingIdentityPalette.Muted, fontSize = 11.sp)
            }
            Text(
                "Not connected",
                color = WeddingIdentityPalette.Muted,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}
