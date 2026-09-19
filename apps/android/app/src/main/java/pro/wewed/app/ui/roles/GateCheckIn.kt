package pro.wewed.app.ui.roles

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.HowToReg
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.wewed.app.models.*
import pro.wewed.app.services.RoleScopedAccess
import pro.wewed.app.ui.shared.*

/** Plain-words outcome of a gate admission. The repository's internal gate message is never shown. */
fun admissionHeadline(result: CheckInVerificationResult): String = when (result.status) {
    CheckInStatus.VALID_PASS -> "Admitted. The whole party is now in."
    CheckInStatus.PARTIAL_CHECKED_IN -> "Admitted. Part of the party is now in."
    CheckInStatus.ALREADY_CHECKED_IN -> "Not admitted. This whole party was already admitted."
    CheckInStatus.CAPACITY_EXCEEDED -> "Not admitted. That is more people than this pass has left."
    CheckInStatus.INVALID_PASS -> "Not admitted. This pass code was not recognised."
}

/**
 * Manual pass-code admission bound to access.admit. Used by the Scan tab and the scanner screen.
 * Reports only what the gate actually recorded.
 */
@Composable
fun GateAdmitPanel(
    access: RoleScopedAccess,
    operatorId: String,
    modifier: Modifier = Modifier,
    onAdmissionRecorded: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var code by rememberSaveable { mutableStateOf("") }
    var people by rememberSaveable { mutableIntStateOf(1) }
    var busy by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<CheckInVerificationResult?>(null) }
    var problem by remember { mutableStateOf<String?>(null) }

    fun admit() {
        val trimmed = code.trim()
        if (trimmed.isEmpty() || busy) return
        busy = true
        problem = null
        scope.launch {
            try {
                result = access.admit(trimmed, people, operatorId)
                onAdmissionRecorded()
            } catch (error: Exception) {
                result = null
                problem = if (error is AccessDeniedException) friendlyError(error)
                    else "The admission couldn't be checked. Please try again."
            } finally {
                busy = false
            }
        }
    }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(
            value = code,
            onValueChange = { code = it },
            label = { Text("Pass code", fontSize = 16.sp) },
            singleLine = true,
            textStyle = LocalTextStyle.current.copy(fontSize = 18.sp),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { admit() }),
            modifier = Modifier.fillMaxWidth().testTag("gate-pass-code")
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("People arriving now", color = Ui.Ink, fontSize = 16.sp, modifier = Modifier.weight(1f))
            IconButton(
                onClick = { if (people > 1) people-- },
                enabled = people > 1,
                modifier = Modifier.testTag("gate-people-fewer")
            ) { Icon(Icons.Default.Remove, contentDescription = "One fewer person") }
            Text(
                people.toString(),
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Ui.Ink,
                modifier = Modifier.testTag("gate-people-count")
            )
            IconButton(
                onClick = { if (people < 20) people++ },
                modifier = Modifier.testTag("gate-people-more")
            ) { Icon(Icons.Default.Add, contentDescription = "One more person") }
        }
        PrimaryButton(
            text = if (busy) "Checking…" else "Admit",
            icon = Icons.Default.HowToReg,
            onClick = { admit() },
            enabled = code.isNotBlank() && !busy,
            modifier = Modifier.fillMaxWidth().testTag("gate-admit")
        )

        problem?.let { ProblemText(it) }
        result?.let { r ->
            InfoCard(modifier = Modifier.testTag("gate-result").semantics { liveRegion = LiveRegionMode.Polite }) {
                Text(admissionHeadline(r), color = Ui.Ink, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                if (r.status != CheckInStatus.INVALID_PASS) {
                    BodyText(r.guestName)
                    SupportingText("Admitted ${r.alreadyCheckedInCount} of ${r.partySize} · ${r.remainingCount} still to arrive")
                    SupportingText(r.tableName?.takeIf { it.isNotBlank() }?.let { "Table: $it" } ?: "No table recorded")
                }
            }
        }
    }
}

/**
 * The scanner screen. Camera decoding is not built into this Android app yet, so it says so and
 * offers pass-code entry, which uses the same admission check.
 */
@Composable
fun GateScannerScreen(
    access: RoleScopedAccess,
    operatorId: String,
    onClose: () -> Unit,
    onAdmissionRecorded: () -> Unit = {}
) {
    SubScreen(title = "Scan pass", onBack = onClose, modifier = Modifier.testTag("gate-scanner-root")) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            InfoCard(modifier = Modifier.testTag("gate-camera-unavailable")) {
                SectionTitle("Camera scanning")
                BodyText("Camera scanning isn't available in the app yet. Type the code from the guest's pass instead.")
            }
            GateAdmitPanel(access, operatorId, onAdmissionRecorded = onAdmissionRecorded)
        }
    }
}

@Composable
private fun AdmissionSummaryCard(summary: AdmissionSummary) {
    InfoCard(modifier = Modifier.testTag("gate-summary")) {
        SectionTitle("Admissions so far")
        BodyText("${summary.admittedGuests} of ${summary.expectedGuests} expected guests admitted")
        SupportingText("${Formatting.plural(summary.attendingParties, "attending party", "attending parties")} · " +
            "${(summary.expectedGuests - summary.admittedGuests).coerceAtLeast(0)} still to arrive")
    }
}

/** Gate team "Scan" tab: the big labelled Scan pass action plus code entry. */
@Composable
fun GateScanTab(
    access: RoleScopedAccess,
    operatorId: String,
    onOpenScanner: () -> Unit,
    refreshKey: Int,
    onAdmissionRecorded: () -> Unit
) {
    val summary = rememberLoad(refreshKey) { access.admissionSummary() }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .testTag("usher-scan-root")
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        PrimaryButton(
            text = "Scan pass",
            icon = Icons.Default.QrCodeScanner,
            onClick = onOpenScanner,
            modifier = Modifier.fillMaxWidth().heightIn(min = 72.dp).testTag("usher-scanner-open")
        )
        LoadContent(summary) { AdmissionSummaryCard(it) }
        InfoCard {
            SectionTitle("Enter a pass code")
            GateAdmitPanel(access, operatorId, onAdmissionRecorded = onAdmissionRecorded)
        }
    }
}

/** Gate team "Admissions" tab: counts, name lookup (attending guests only) and this device's history. */
@Composable
fun GateAdmissionsContent(
    access: RoleScopedAccess,
    refreshKey: Int,
    modifier: Modifier = Modifier,
    rootTag: String = "usher-admissions-root",
    header: (@Composable () -> Unit)? = null
) {
    val summary = rememberLoad(refreshKey) { access.admissionSummary() }
    val history = rememberLoad(refreshKey) { access.admissionHistory() }
    var query by rememberSaveable { mutableStateOf("") }
    val results = rememberLoad(query, refreshKey) { access.admissionLookup(query) }

    LazyColumn(
        modifier = modifier.fillMaxSize().testTag(rootTag),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        header?.let { item { it() } }
        item { LoadContent(summary) { AdmissionSummaryCard(it) } }
        item {
            SectionTitle("Find a guest")
        }
        item {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Guest name", fontSize = 16.sp) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true,
                textStyle = LocalTextStyle.current.copy(fontSize = 18.sp),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                modifier = Modifier.fillMaxWidth().testTag("usher-lookup-field")
            )
        }
        item {
            SupportingText("Shows guests who replied yes. Type at least 2 letters of their name.")
        }
        when (results) {
            is Load.Ready -> {
                if (query.trim().length >= 2 && results.value.isEmpty()) {
                    item { EmptyStateText("No attending guest matches \"${query.trim()}\".", "usher-lookup-empty") }
                }
                items(results.value, key = { "lookup-${it.guestId}" }) { row ->
                    InfoCard(modifier = Modifier.testTag("usher-lookup-row-${row.guestId}")) {
                        Text(row.displayName, color = Ui.Ink, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                        BodyText("Party of ${row.partySize} · Admitted ${row.admittedCount} · Remaining ${row.remaining}")
                        SupportingText(row.tableName?.takeIf { it.isNotBlank() }?.let { "Table: $it" } ?: "No table recorded")
                    }
                }
            }
            is Load.Failed -> item { ProblemText(results.message) }
            Load.Loading -> Unit
        }
        item { SectionTitle("Scan history on this device") }
        when (history) {
            is Load.Ready -> {
                if (history.value.isEmpty()) {
                    item { EmptyStateText("No admissions have been recorded on this device yet.", "usher-history-empty") }
                }
                items(history.value.sortedByDescending { it.scannedAtMillis }, key = { "history-${it.id}" }) { record ->
                    InfoCard(modifier = Modifier.testTag("usher-history-row")) {
                        Text(record.guestName, color = Ui.Ink, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        SupportingText(
                            "${Formatting.plural(record.countAdmitted, "person", "people")} admitted at ${Formatting.time(record.scannedAtMillis)}" +
                                if (record.isSynced) " · Sent" else " · Not sent yet"
                        )
                    }
                }
            }
            is Load.Failed -> item { ProblemText(history.message) }
            Load.Loading -> item { LoadingIndicator() }
        }
    }
}
