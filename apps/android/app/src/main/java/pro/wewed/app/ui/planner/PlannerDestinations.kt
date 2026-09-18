package pro.wewed.app.ui.planner

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.Circle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.wewed.app.models.*
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing

enum class PlannerDestinationRoute {
    TASKS,
    BUDGET,
    CONTRIBUTIONS,
    VENDORS,
    TIMELINE,
    SEATING,
    GUESTS_BRIDGE,
    OPERATIONS,
    CLIENT_PROFILE,
    COLLABORATION,
    INVITATIONS,
    EVENT_COMMAND,
    RELEASE_CENTRE,
    WEDDING_BRIEF,
    NOTEBOOK,
    MEDIA_ARCHIVE,
    AI_WORKSPACE,
    PORTFOLIO,
    BOOKINGS,
    CONTRACT_GOVERNANCE,
    CONTRACT_INTELLIGENCE,
    MARKETPLACE_PROFILE
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlannerSubScreenScaffold(
    title: String,
    onBack: () -> Unit,
    content: @Composable (PaddingValues) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, fontWeight = FontWeight.SemiBold, fontSize = 18.sp) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        containerColor = WewedColors.Ivory,
        content = content
    )
}

// 1. Tasks Destination
@Composable
fun TasksDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    var tasks by remember { mutableStateOf<List<PlannerTask>>(emptyList()) }
    var selectedFilter by remember { mutableStateOf("All") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        tasks = appViewModel.repository.getTasks()
    }

    val filteredTasks = when (selectedFilter) {
        "To Do" -> tasks.filter { it.status == TaskStatus.TODO }
        "In Progress" -> tasks.filter { it.status == TaskStatus.IN_PROGRESS }
        "Blocked" -> tasks.filter { it.status == TaskStatus.BLOCKED }
        "Done" -> tasks.filter { it.status == TaskStatus.DONE }
        else -> tasks
    }

    PlannerSubScreenScaffold(title = "Tasks Checklist", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = WewedSpacing.sm),
                    horizontalArrangement = Arrangement.spacedBy(WewedSpacing.sm)
                ) {
                    listOf("All", "To Do", "In Progress", "Blocked", "Done").forEach { f ->
                        FilterChip(
                            selected = selectedFilter == f,
                            onClick = { selectedFilter = f },
                            label = { Text(f) }
                        )
                    }
                }
            }

            items(filteredTasks, key = { it.id }) { task ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.padding(WewedSpacing.base),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = {
                            scope.launch {
                                val updated = appViewModel.repository.toggleTask(task.id)
                                tasks = tasks.map { if (it.id == task.id) updated else it }
                            }
                        }) {
                            Icon(
                                imageVector = if (task.status == TaskStatus.DONE) Icons.Default.CheckCircle else Icons.Outlined.Circle,
                                contentDescription = null,
                                tint = if (task.status == TaskStatus.DONE) WewedColors.Success else WewedColors.Gold
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                task.title,
                                fontWeight = FontWeight.SemiBold,
                                textDecoration = if (task.status == TaskStatus.DONE) TextDecoration.LineThrough else null,
                                color = if (task.status == TaskStatus.DONE) Color.Gray else Color.Unspecified
                            )
                            Text(
                                "${task.category} • Priority: ${task.priority.title}",
                                fontSize = 12.sp,
                                color = Color.Gray
                            )
                        }
                    }
                }
            }
        }
    }
}

// 2. Budget Destination
@Composable
fun BudgetDestination(appViewModel: AppViewModel? = null, onBack: () -> Unit) {
    if (appViewModel != null) {
        ShadowBudgetDestination(appViewModel = appViewModel, onBack = onBack)
    } else {
        PlannerSubScreenScaffold(title = "Budget Allocation", onBack = onBack) { padding ->
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("Budget ledger managed via Planner Workspace.", color = Color.Gray)
            }
        }
    }
}

// 3. Contributions Destination
@Composable
fun ContributionsDestination(appViewModel: AppViewModel? = null, onBack: () -> Unit) {
    if (appViewModel != null) {
        ShadowContributionsDestination(appViewModel = appViewModel, onBack = onBack)
    } else {
        PlannerSubScreenScaffold(title = "Contributions", onBack = onBack) { padding ->
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("4 guest messages & well wishes recorded.", color = Color.Gray)
            }
        }
    }
}

// 4. Vendors Destination
@Composable
fun VendorsDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    ShadowVendorsDestination(appViewModel = appViewModel, onBack = onBack)
}

// 5. Timeline Destination
@Composable
fun TimelineDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    ShadowTimelineDestination(appViewModel = appViewModel, onBack = onBack)
}

// 6. Seating Destination
@Composable
fun SeatingDestination(appViewModel: AppViewModel? = null, onBack: () -> Unit) {
    if (appViewModel != null) {
        ShadowSeatingDestination(appViewModel = appViewModel, onBack = onBack)
    } else {
        PlannerSubScreenScaffold(title = "Seating Arrangements", onBack = onBack) { padding ->
            Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("8 seating tables • 22 assigned of 64 capacity", color = Color.Gray)
            }
        }
    }
}

// 7. Guests Bridge Destination
@Composable
fun GuestsBridgeDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    var guests by remember { mutableStateOf<List<Guest>>(emptyList()) }
    LaunchedEffect(Unit) {
        guests = appViewModel.repository.getGuests()
    }
    PlannerSubScreenScaffold(title = "Guests Roster Bridge", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Text("Sync with Wedding Pass Gate Manifest (${guests.size} guests)", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = WewedSpacing.sm))
            }
            items(guests) { g ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(
                        modifier = Modifier.padding(WewedSpacing.base),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(g.name, fontWeight = FontWeight.SemiBold)
                            Text("${g.tableName ?: "Unseated"} • Party of ${g.partySize}", fontSize = 12.sp, color = Color.Gray)
                        }
                        Text(
                            if (g.checkedIn) "ADMITTED" else g.rsvpStatus.title.uppercase(),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (g.checkedIn) WewedColors.Success else (if (g.rsvpStatus == RSVPStatus.ATTENDING) WewedColors.Emerald else WewedColors.Gold)
                        )
                    }
                }
            }
        }
    }
}

// 8. Operations Destination
@Composable
fun OperationsDestination(onBack: () -> Unit) {
    val items = listOf(
        Pair("Active Tasks Checklist", "8 high priority tasks requiring coordination"),
        Pair("RSVP & Seating Status", "172 RSVPs pending • 22 table seats allocated"),
        Pair("Vendor Bookings", "7 vendors recorded • 0 active contracts"),
        Pair("Budget Position", "Direct expenses monitored • USD currency")
    )
    PlannerSubScreenScaffold(title = "Day-of Operations Dispatch", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Text("Operational Status", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = WewedSpacing.sm))
            }
            items(items) { (name, detail) ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(WewedSpacing.base)) {
                        Text(name, fontWeight = FontWeight.SemiBold)
                        Text(detail, fontSize = 12.sp, color = Color.Gray)
                    }
                }
            }
        }
    }
}

// Generic Info Destination Helper for remaining tools
@Composable
fun GenericToolDestination(title: String, subtitle: String, sections: List<Pair<String, String>>, onBack: () -> Unit) {
    PlannerSubScreenScaffold(title = title, onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(top = WewedSpacing.sm),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(WewedSpacing.base)) {
                        Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text(subtitle, fontSize = 12.sp, color = Color.Gray)
                    }
                }
            }
            items(sections) { (heading, body) ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(WewedSpacing.base)) {
                        Text(heading, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(body, fontSize = 12.sp, color = Color.Gray)
                    }
                }
            }
        }
    }
}

// 9. Client Profile Destination
@Composable
fun ClientProfileDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Client Profile & Requirements",
        subtitle = "Charity & Kudzie • Imba Manor, Harare",
        sections = listOf(
            Pair("Wedding", "Charity & Kudzie"),
            Pair("Date & Venue", "23 December 2026 • Imba Manor, Harare, Zimbabwe"),
            Pair("Guest Manifest", "174 guest records • 8 seating tables"),
            Pair("Lead Planner", "Eleven Eleven Testing (Accepted interest)")
        ),
        onBack = onBack
    )
}

// 10. Collaboration Hub Destination
@Composable
fun CollaborationDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Collaboration & Team Access",
        subtitle = "Lead Planner • Couple Owners",
        sections = listOf(
            Pair("Lead Planner", "Eleven Eleven Testing • Accepted interest"),
            Pair("Couple Owners", "Charity & Kudzie • Full administrative control"),
            Pair("Memberships & Engagements", "0 external memberships recorded")
        ),
        onBack = onBack
    )
}

// 11. Invitations Tools Destination
@Composable
fun InvitationsDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Invitations & QR Gateway",
        subtitle = "174 Guest Records • Imba Manor",
        sections = listOf(
            Pair("Guest Manifest", "174 guests invited across family & friends"),
            Pair("Pass Gate Credentials", "ECDSA P-256 cryptographic pass verification active"),
            Pair("Seating Allocations", "8 tables allocated at Imba Manor")
        ),
        onBack = onBack
    )
}

// 12. Event Command Destination
@Composable
fun EventCommandDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Event Command Center",
        subtitle = "Charity & Kudzie • 23 Dec 2026",
        sections = listOf(
            Pair("Event", "Charity & Kudzie Wedding"),
            Pair("Venue", "Imba Manor, Harare, Zimbabwe"),
            Pair("Lifecycle", "before (Planning in progress)")
        ),
        onBack = onBack
    )
}

// 13. Release Centre Destination
@Composable
fun ReleaseCentreDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Release Centre & Deliverables",
        subtitle = "Post-Wedding Production Pipeline",
        sections = listOf(
            Pair("Release Status", "No releases queued.")
        ),
        onBack = onBack
    )
}

// 14. Wedding Brief Destination
@Composable
fun WeddingBriefDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Wedding Brief",
        subtitle = "Charity & Kudzie • Imba Manor",
        sections = listOf(
            Pair("Event Title", "Charity & Kudzie"),
            Pair("Date", "2026-12-23 14:00:00"),
            Pair("Location", "Imba Manor, Harare, Zimbabwe")
        ),
        onBack = onBack
    )
}

// 15. Notebook Destination
@Composable
fun NotebookDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Notebook",
        subtitle = "Field Notes & Memos",
        sections = listOf(
            Pair("Planner Notes", "No planner notes recorded.")
        ),
        onBack = onBack
    )
}

// 16. Media Archive Destination
@Composable
fun MediaArchiveDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Media Archive",
        subtitle = "Raw Assets & Documents",
        sections = listOf(
            Pair("Archive Status", "No media assets indexed for this wedding.")
        ),
        onBack = onBack
    )
}

// 17. AI Workspace Destination
@Composable
fun AIWorkspaceDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Wewed AI Workspace",
        subtitle = "Planner Intelligence",
        sections = listOf(
            Pair("AI Recommendations", "AI recommendations active for task scheduling and manifest verification.")
        ),
        onBack = onBack
    )
}

// 18. Portfolio Destination
@Composable
fun PortfolioDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Planner Portfolio",
        subtitle = "Active Client Engagements",
        sections = listOf(
            Pair("Charity & Kudzie (Active)", "23 Dec 2026 • Imba Manor, Harare • 7 / 42 Tasks Completed")
        ),
        onBack = onBack
    )
}

// 19. Bookings Destination
@Composable
fun BookingsDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Consultations & Bookings",
        subtitle = "Inbound Inquiries",
        sections = listOf(
            Pair("Consultation Pipeline", "No external consultations queued.")
        ),
        onBack = onBack
    )
}

// 20. Contract Governance Destination
@Composable
fun ContractGovernanceDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Contract Governance",
        subtitle = "Legal & SLA Ledger",
        sections = listOf(
            Pair("Active Contracts", "No contracts recorded for this wedding.")
        ),
        onBack = onBack
    )
}

// 21. Contract Intelligence Destination
@Composable
fun ContractIntelligenceDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Contract Intelligence",
        subtitle = "Risk Analysis",
        sections = listOf(
            Pair("Contract Analysis", "No contracts recorded for this wedding.")
        ),
        onBack = onBack
    )
}

// 22. Marketplace Profile Destination
@Composable
fun MarketplaceProfileDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Marketplace Profile",
        subtitle = "Eleven Eleven Testing",
        sections = listOf(
            Pair("Planner", "Eleven Eleven Testing"),
            Pair("Profile Slug", "tony-the-planner"),
            Pair("Status", "Accepted interest for Charity & Kudzie")
        ),
        onBack = onBack
    )
}
