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
fun BudgetDestination(onBack: () -> Unit) {
    PlannerSubScreenScaffold(title = "Budget Allocations", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(top = WewedSpacing.sm),
                    shape = RoundedCornerShape(WewedRadius.lg),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(
                        modifier = Modifier.padding(WewedSpacing.base),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Total Wedding Budget", fontSize = 13.sp, color = Color.Gray)
                        Text("$25,000", fontSize = 32.sp, fontWeight = FontWeight.Bold, color = WewedColors.Gold)
                        Spacer(modifier = Modifier.height(WewedSpacing.sm))
                        LinearProgressIndicator(
                            progress = { 18500f / 25000f },
                            modifier = Modifier.fillMaxWidth().height(8.dp),
                            color = WewedColors.Emerald,
                            trackColor = WewedColors.GoldLight.copy(alpha = 0.3f)
                        )
                        Spacer(modifier = Modifier.height(WewedSpacing.xs))
                        Text("$18,500 Allocated • $6,500 Remaining", fontSize = 12.sp, color = Color.Gray)
                    }
                }
            }

            val items = listOf(
                Triple("Venue & Catering", "$12,000", "Partially Paid ($8,000 paid)"),
                Triple("Photography & Video", "$3,500", "Paid in Full"),
                Triple("Decor & Florals", "$3,000", "Deposit Paid ($1,500 paid)"),
                Triple("Music & Sound", "$1,500", "Pending Balance ($500 paid)")
            )
            items(items) { (cat, alloc, status) ->
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
                            Text(cat, fontWeight = FontWeight.SemiBold)
                            Text(status, fontSize = 12.sp, color = Color.Gray)
                        }
                        Text(alloc, fontWeight = FontWeight.Bold, color = WewedColors.Emerald)
                    }
                }
            }
        }
    }
}

// 3. Contributions Destination
@Composable
fun ContributionsDestination(onBack: () -> Unit) {
    PlannerSubScreenScaffold(title = "Guest Gift Registry", onBack = onBack) { padding ->
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
                        Text("Honeyfund & Registry Total", fontSize = 13.sp, color = Color.Gray)
                        Text("$7,420.00", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = WewedColors.Emerald)
                        Text("28 community contributors", fontSize = 12.sp, color = Color.Gray)
                    }
                }
            }
            val funds = listOf(
                Pair("Zanzibar Honeymoon Retreat", "$3,200 raised of $4,000"),
                Pair("Kitchen & Home Starter Fund", "$2,120 raised of $2,500"),
                Pair("Wedding Photography Fund", "$2,100 raised of $2,100 (Funded)")
            )
            items(funds) { (name, desc) ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Column(modifier = Modifier.padding(WewedSpacing.base)) {
                        Text(name, fontWeight = FontWeight.SemiBold)
                        Text(desc, fontSize = 12.sp, color = Color.Gray)
                    }
                }
            }
        }
    }
}

// 4. Vendors Destination
@Composable
fun VendorsDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    var vendors by remember { mutableStateOf<List<VendorPresence>>(emptyList()) }
    LaunchedEffect(Unit) {
        vendors = appViewModel.repository.getVendors()
    }

    PlannerSubScreenScaffold(title = "Vendor Operations", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Text(
                    "Contracted Event Day Vendors",
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = WewedSpacing.sm)
                )
            }
            items(vendors) { v ->
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
                            Text(v.vendorName, fontWeight = FontWeight.Bold)
                            Text("${v.serviceCategory} • ${v.serviceArea}", fontSize = 12.sp, color = Color.Gray)
                        }
                        Text(
                            v.state.title,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = WewedColors.Gold,
                            modifier = Modifier
                                .background(WewedColors.GoldLight.copy(alpha = 0.3f), RoundedCornerShape(WewedRadius.sm))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }
        }
    }
}

// 5. Timeline Destination
@Composable
fun TimelineDestination(appViewModel: AppViewModel, onBack: () -> Unit) {
    var wedding by remember { mutableStateOf<Wedding?>(null) }
    LaunchedEffect(Unit) {
        wedding = appViewModel.repository.getWedding()
    }

    PlannerSubScreenScaffold(title = "Run of Show Timeline", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Text(
                    "Wedding Day Schedule • ${wedding?.venueName ?: "Imba Manor Estate"}",
                    fontSize = 13.sp,
                    color = Color.Gray,
                    modifier = Modifier.padding(top = WewedSpacing.sm)
                )
            }
            items(wedding?.programme ?: emptyList()) { item ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(WewedRadius.md),
                    colors = CardDefaults.cardColors(containerColor = Color.White)
                ) {
                    Row(modifier = Modifier.padding(WewedSpacing.base), verticalAlignment = Alignment.CenterVertically) {
                        Text(item.time, fontWeight = FontWeight.Bold, color = WewedColors.Gold, fontSize = 15.sp)
                        Spacer(modifier = Modifier.width(WewedSpacing.base))
                        Column {
                            Text(item.title, fontWeight = FontWeight.SemiBold)
                            Text("${item.location} • ${item.description}", fontSize = 12.sp, color = Color.Gray)
                        }
                    }
                }
            }
        }
    }
}

// 6. Seating Destination
@Composable
fun SeatingDestination(onBack: () -> Unit) {
    val tables = listOf(
        Triple("Table 1 — Baobab", "10 / 10 Seated", "VIP Bridal Family"),
        Triple("Table 2 — Jacaranda", "8 / 10 Seated", "Groom High School Circle"),
        Triple("Table 3 — Acacia", "10 / 10 Seated", "University Alumni"),
        Triple("Table 4 — Flame Lily", "6 / 8 Seated", "Church Elders")
    )
    PlannerSubScreenScaffold(title = "Seating Arrangements", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Text("14 Tables • 142 Confirmed Seats", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = WewedSpacing.sm))
            }
            items(tables) { (name, cap, desc) ->
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
                            Text(name, fontWeight = FontWeight.SemiBold)
                            Text(desc, fontSize = 12.sp, color = Color.Gray)
                        }
                        Text(cap, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WewedColors.Emerald)
                    }
                }
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
                Text("Sync with Wedding Pass Gate Manifest", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = WewedSpacing.sm))
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
                            Text("Table ${g.tableNumber ?: 0} • Party of ${g.partySize}", fontSize = 12.sp, color = Color.Gray)
                        }
                        Text(
                            if (g.checkedIn) "ADMITTED" else "INVITED",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (g.checkedIn) WewedColors.Success else WewedColors.Gold
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
        Pair("Gate Usher Dispatch", "4 active ushers assigned to Gate A and East Marquee"),
        Pair("Live Ceremony Broadcast", "Stream encoder ready on Channel 1"),
        Pair("Sound & Lighting Check", "Microphone line check verified at 10:30"),
        Pair("Emergency Protocol", "On-site medical liaison and security dispatch armed")
    )
    PlannerSubScreenScaffold(title = "Day-of Operations Dispatch", onBack = onBack) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = WewedSpacing.base),
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.md)
        ) {
            item {
                Text("Real-Time Ground Operations", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = WewedSpacing.sm))
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
        subtitle = "Charity & Kudzie • Intake & Style Preferences",
        sections = listOf(
            Pair("Primary Aesthetic", "Modern Afro-Chic with ivory floral and botanical gold accents"),
            Pair("Religious & Cultural Observances", "Ceremony and reception celebrations at Imba Manor"),
            Pair("Catering Directives", "Beef, chicken, vegetarian and traditional Zimbabwean menu options"),
            Pair("Special VIP Notes", "Elder family seated at Table 1 and Table 2")
        ),
        onBack = onBack
    )
}

// 10. Collaboration Hub Destination
@Composable
fun CollaborationDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Collaboration & Team Access",
        subtitle = "1 Lead Planner • 1 Coordinator • Live Permissions",
        sections = listOf(
            Pair("Lead Planner", "Eleven Eleven Testing • Accepted interest"),
            Pair("Couple Owners", "Charity & Kudzie Musarurwa • Full administrative control"),
            Pair("Day-of Coordinator", "Chiedza Nyoni • Gate control and vendor check-in privileges"),
            Pair("Gate Team", "Imba Manor Gate Ushers • Scanner only")
        ),
        onBack = onBack
    )
}

// 11. Invitations Tools Destination
@Composable
fun InvitationsDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Invitations & QR Gateway",
        subtitle = "150 Dispatched • 128 RSVP Confirmed",
        sections = listOf(
            Pair("Digital Invitation Portal", "Hosted on wewed.app/w/tariro-shadreck-2026"),
            Pair("QR Pass Sync", "128 cryptographic gate credentials generated"),
            Pair("Printed Elder Cards", "22 embossed offline cardstock passes prepared"),
            Pair("RSVP Deadline", "Closed on 10 October 2026 • 94% response rate achieved")
        ),
        onBack = onBack
    )
}

// 12. Event Command Destination
@Composable
fun EventCommandDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Event Command Center",
        subtitle = "Real-Time Event Radio & Incident Channel",
        sections = listOf(
            Pair("Channel 1: Security & Gate", "All 4 gates operational • Zero admittance violations"),
            Pair("Channel 2: Food & Beverage", "Dinner service timeline synchronized with bridal party entrance"),
            Pair("Channel 3: AV & Live Stream", "Main ballroom feed 1080p60 active"),
            Pair("Command Status", "Green • Running on 100% scheduled timing")
        ),
        onBack = onBack
    )
}

// 13. Release Centre Destination
@Composable
fun ReleaseCentreDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Release Centre & Deliverables",
        subtitle = "Post-Wedding Production & Archival Pipeline",
        sections = listOf(
            Pair("Edited Master Video", "Expected delivery in 14 days • 4K HDR master"),
            Pair("Full Photo Album Gallery", "450 select proofs in review with couple"),
            Pair("Vendor Settlement Ledger", "All 8 final invoices audited and ready for payment"),
            Pair("Thank You Dispatch", "Automated WhatsApp card batches ready for release")
        ),
        onBack = onBack
    )
}

// 14. Wedding Brief Destination
@Composable
fun WeddingBriefDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Wedding Brief & Aesthetic Directive",
        subtitle = "Creative Vision, Palette & Spatial Design",
        sections = listOf(
            Pair("Color Story", "Rich Ivory #FDFBF7, Satin Gold #C5A880, Royal Burgundy #6B1D2F"),
            Pair("Florals & Flora", "White hydrangeas, eucalyptus greenery, golden pampas plumes"),
            Pair("Lighting Atmosphere", "Warm ambient fairy canopies and soft candlelight chandeliers"),
            Pair("Dress Code Directive", "Black Tie Formal with African elegance touches")
        ),
        onBack = onBack
    )
}

// 15. Notebook Destination
@Composable
fun NotebookDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Notebook & Audio Memos",
        subtitle = "Field Notes, Voice Transcripts & Sudden Ideas",
        sections = listOf(
            Pair("Memo: Cake Delivery Delay Route", "Driver advised to take Enterprise Road to bypass construction"),
            Pair("Memo: Priest Arrival Time", "Priest confirmed 13:45 arrival in vestry room"),
            Pair("Memo: Flower Girl Spare Basket", "Extra white rose petals placed in bridal room closet"),
            Pair("Voice Memo Transcripts", "3 recordings processed with local on-device transcription")
        ),
        onBack = onBack
    )
}

// 16. Media Archive Destination
@Composable
fun MediaArchiveDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "High-Res Media Archive",
        subtitle = "Raw Assets, Floorplans & Brand Guidelines",
        sections = listOf(
            Pair("Venue CAD Floorplan v4", "PDF • 8.4 MB • Approved by Imba Manor Estate"),
            Pair("Menu Calligraphy Proofs", "ZIP • 42 MB • High-res print vector files"),
            Pair("Contract Signatures Vault", "Encrypted storage • 8 executed contracts"),
            Pair("Couple Engagement Shoot", "50 selected press and program assets")
        ),
        onBack = onBack
    )
}

// 17. AI Workspace Destination
@Composable
fun AIWorkspaceDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Wewed AI Architect Workspace",
        subtitle = "Automated Timeline Simulation & Seating Solver",
        sections = listOf(
            Pair("Timeline Optimization Engine", "Simulated guest transit: estimated buffer +8 mins"),
            Pair("Conflict Resolution", "Zero dietary conflicts detected across 14 tables"),
            Pair("Weather Risk Advisory", "Forecast: 26°C Sunny, 0% precipitation risk"),
            Pair("Budget Anomaly Detector", "All line items within ±3% target margin")
        ),
        onBack = onBack
    )
}

// 18. Portfolio Destination
@Composable
fun PortfolioDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Portfolio & Multi-Wedding Dashboard",
        subtitle = "Active Client Engagements & Production Pipeline",
        sections = listOf(
            Pair("Charity & Kudzie (Current)", "23 Dec 2026 • Imba Manor, Harare • 7 / 42 Tasks"),
            Pair("Rumbidzai & Farai", "12 Dec 2026 • Wild Geese Lodge • Intake & Budgeting"),
            Pair("Chipo & Tinashe", "18 Jan 2027 • Raintree Harare • Initial Concept"),
            Pair("Annual Target", "6 / 8 signature weddings booked for 2026/2027")
        ),
        onBack = onBack
    )
}

// 19. Bookings Destination
@Composable
fun BookingsDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Consultations & Inbound Bookings",
        subtitle = "Lead Pipeline, Inquiry Forms & Discovery Calls",
        sections = listOf(
            Pair("Inquiry: Nyasha & Brian", "Wedding date Sept 2027 • Luxury 300-guest inquiry"),
            Pair("Consultation Scheduled", "Tomorrow at 14:00 • Video Discovery Call via Wewed"),
            Pair("Contract Proposal Sent", "Tafadzwa & Vimbai • Waiting for digital signature"),
            Pair("Conversion Rate", "68% consultation to retainer conversion rate")
        ),
        onBack = onBack
    )
}

// 20. Contract Governance Destination
@Composable
fun ContractGovernanceDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Contract Governance & Vault",
        subtitle = "Digital Signatures, Retainers & Clause Vault",
        sections = listOf(
            Pair("Master Planning Agreement", "Pending formal contract execution (0 active contracts)"),
            Pair("Vendor Engagement Contracts", "7 vendors booked • Formal contract execution pending"),
            Pair("Retainer Escrow Vault", "0 executed contracts stored in governance vault"),
            Pair("Master Policy Version", "Wewed Standard Wedding Contract v3.2")
        ),
        onBack = onBack
    )
}

// 21. Contract Intelligence Destination
@Composable
fun ContractIntelligenceDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Contract Intelligence & Risk Audit",
        subtitle = "Automated Vendor Clause Analysis & SLA Auditing",
        sections = listOf(
            Pair("Imba Manor Ground Policy", "Weather & grounds annex prepared for contract execution"),
            Pair("Payment Milestone Guards", "Protected: 7 vendor payment schedules monitored"),
            Pair("Cancellation & Escrow Terms", "Awaiting formal vendor agreements"),
            Pair("Risk Rating", "LOW • 0 contract breaches recorded")
        ),
        onBack = onBack
    )
}

// 22. Marketplace Profile Destination
@Composable
fun MarketplaceProfileDestination(onBack: () -> Unit) {
    GenericToolDestination(
        title = "Marketplace Listing & Public Profile",
        subtitle = "Wewed Pro Directory & Verified Badge",
        sections = listOf(
            Pair("Profile Status", "VERIFIED LUXURY PLANNER • 5.0 Star Rating (42 reviews)"),
            Pair("Featured Gallery", "12 editorial wedding albums published on directory"),
            Pair("Starting Package", "Full Wedding Architecture & Production from $3,500"),
            Pair("Geographic Coverage", "Harare, Victoria Falls, Bulawayo & Destination Southern Africa")
        ),
        onBack = onBack
    )
}
