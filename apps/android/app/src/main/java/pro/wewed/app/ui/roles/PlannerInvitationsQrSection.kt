package pro.wewed.app.ui.roles

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PersistableBundle
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MarkEmailRead
import androidx.compose.material.icons.filled.QrCode2
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import kotlinx.coroutines.launch
import pro.wewed.app.services.InvitationContactFilter
import pro.wewed.app.services.InvitationDeliveryChannel
import pro.wewed.app.services.InvitationOpenedFilter
import pro.wewed.app.services.InvitationSentFilter
import pro.wewed.app.services.NativeWriteResult
import pro.wewed.app.services.PlannerGuestInvitation
import pro.wewed.app.services.PlannerInvitationDesign
import pro.wewed.app.services.PlannerInvitationFilter
import pro.wewed.app.services.PlannerInvitationOperations
import pro.wewed.app.services.PlannerInvitationRsvpStatus
import pro.wewed.app.services.PlannerInvitationSummary
import pro.wewed.app.services.PlannerInvitationsLoad
import pro.wewed.app.services.PlannerInvitationsSnapshot
import pro.wewed.app.services.PlannerPhysicalInvitation
import pro.wewed.app.services.failureMessage
import pro.wewed.app.services.INVITATION_DELIVERY_MAX_BATCH
import pro.wewed.app.services.partialMessage
import pro.wewed.app.services.runChunkedDelivery
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.ui.qr.WewedQrCode

/**
 * The native share path for a server-provided invitation message/link: a system chooser over
 * `ACTION_SEND text/plain`. The text is handed over as-is — never reconstructed on the device.
 */
fun invitationShareIntent(subject: String, text: String): Intent {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, subject)
        putExtra(Intent.EXTRA_TEXT, text)
    }
    return Intent.createChooser(send, "Share invitation")
}

fun interface InvitationSharer {
    fun share(subject: String, text: String)
}

/** Copies a server-provided invitation message. Copying never records a delivery or an open. */
fun interface InvitationCopier {
    fun copy(label: String, text: String)
}

private fun systemSharer(context: Context) = InvitationSharer { subject, text ->
    context.startActivity(invitationShareIntent(subject, text).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

private fun systemCopier(context: Context) = InvitationCopier { label, text ->
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
    val clip = ClipData.newPlainText(label, text)
    // The message carries the Guest's private link: keep it out of the clipboard preview overlay.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        clip.description.extras = PersistableBundle().apply { putBoolean("android.content.extra.IS_SENSITIVE", true) }
    }
    clipboard?.setPrimaryClip(clip)
}

/**
 * QRO05-PIQR01 / NATIVE-MOBILE-QRO08 — the Planner's Invitations command center
 * (Workspace → Invitations; More → Invitations & QR opens the same screen).
 *
 * Reads the same canonical server projections as the desktop Planner: Invitation design, Printed
 * Invitation Access (one shared QR for the printed card) and Guest Open Invitations (each Guest's
 * own private link, with Sent / Opened / RSVP state). When [operations] is supplied, the Planner can
 * search, filter, multi-select, mark sent (with channel), reset delivery, add / edit / delete a
 * Guest, generate missing links and rotate one link — each through the native twin of the desktop
 * route, followed by a fresh read of the projection. Nothing about delivery is stored on the device.
 *
 * Semantics: "Sent" is only ever an explicit Mark-sent record. Share, Copy and Show QR never mark
 * anything sent or opened; "Opened" is only a genuine invitation redemption recorded by the server.
 * No operation here changes a Guest's RSVP.
 *
 * Private links are never rendered as text or put in a content description; they reach the screen
 * only as a QR image, the system share sheet or the clipboard (flagged sensitive).
 */
@Composable
fun PlannerInvitationsQrSection(
    load: suspend () -> PlannerInvitationsLoad,
    sharer: InvitationSharer? = null,
    operations: PlannerInvitationOperations? = null,
    copier: InvitationCopier? = null,
) {
    val context = LocalContext.current
    val share = sharer ?: remember(context) { systemSharer(context) }
    val copy = copier ?: remember(context) { systemCopier(context) }
    var state by remember { mutableStateOf<PlannerInvitationsLoad?>(null) }
    var attempt by remember { mutableIntStateOf(0) }
    var qrGuest by remember { mutableStateOf<PlannerGuestInvitation?>(null) }

    LaunchedEffect(attempt) {
        state = null
        state = load()
    }

    when (val current = state) {
        null -> IASectionList("Invitations", "Loading invitations…") {
            Box(Modifier.fillMaxWidth().testTag("planner-invitations-loading"), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep)
            }
        }
        is PlannerInvitationsLoad.Unavailable -> IASectionList("Invitations") {
            IACard("Invitations are unavailable", current.reason, testTag = "planner-invitations-unavailable")
            TextButton(onClick = { attempt++ }, modifier = Modifier.testTag("planner-invitations-retry")) {
                Text("Try again", color = WeddingIdentityPalette.Forest, fontWeight = FontWeight.SemiBold)
            }
        }
        is PlannerInvitationsLoad.Loaded -> InvitationCommandCenter(
            snapshot = current.snapshot,
            sharer = share,
            copier = copy,
            operations = operations,
            reload = load,
            onReloaded = { state = it },
            onShowQr = { qrGuest = it },
        )
    }

    qrGuest?.let { guest -> GuestInvitationQrDialog(guest) { qrGuest = null } }
}

/** A pending destructive or channel-choosing confirmation. */
private sealed interface PendingAction {
    data class MarkSent(val guestIds: List<String>) : PendingAction
    data class ResetDelivery(val guestIds: List<String>) : PendingAction
    data class Delete(val guest: PlannerGuestInvitation) : PendingAction
    data class Rotate(val guest: PlannerGuestInvitation) : PendingAction
    object GenerateMissing : PendingAction
    /** null guest = add a new Guest. */
    data class EditContact(val guest: PlannerGuestInvitation?) : PendingAction
}

@Composable
private fun InvitationCommandCenter(
    snapshot: PlannerInvitationsSnapshot,
    sharer: InvitationSharer,
    copier: InvitationCopier,
    operations: PlannerInvitationOperations?,
    reload: suspend () -> PlannerInvitationsLoad,
    onReloaded: (PlannerInvitationsLoad) -> Unit,
    onShowQr: (PlannerGuestInvitation) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var filter by remember { mutableStateOf(PlannerInvitationFilter()) }
    var selected by remember { mutableStateOf(emptySet<String>()) }
    var pending by remember { mutableStateOf<PendingAction?>(null) }
    var busy by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var contactFieldError by remember { mutableStateOf<String?>(null) }

    // Selection never outlives the rows it points at (e.g. after a delete).
    val liveIds = remember(snapshot) { snapshot.guests.map { it.id }.toSet() }
    val visible = remember(snapshot, filter) { filter.apply(snapshot.guests) }
    LaunchedEffect(liveIds) { selected = selected intersect liveIds }

    /** Runs one write, then re-reads the canonical projection. Keeps the list on screen meanwhile. */
    fun run(successNotice: (NativeWriteResult.Ok) -> String, keepDialogOnReject: Boolean = false, write: suspend () -> NativeWriteResult) {
        if (busy) return
        busy = true
        error = null
        notice = null
        contactFieldError = null
        scope.launch {
            val result = write()
            if (result is NativeWriteResult.Ok) {
                pending = null
                notice = successNotice(result)
                val refreshed = reload()
                if (refreshed is PlannerInvitationsLoad.Loaded) onReloaded(refreshed)
                else error = "Saved. The list could not be refreshed — tap Refresh."
            } else {
                val message = result.failureMessage()
                if (keepDialogOnReject && result is NativeWriteResult.Rejected) {
                    contactFieldError = message
                } else {
                    pending = null
                    error = message
                }
            }
            busy = false
        }
    }

    /**
     * QRO08 P2 — bulk Mark sent / Reset over any selection size, in server-sized chunks. A failure in
     * a later chunk is reported as partial (never as success); the unchanged Guests stay selected.
     */
    fun runBulk(guestIds: List<String>, doneLabel: String, write: suspend (List<String>) -> NativeWriteResult) {
        if (busy) return
        busy = true
        error = null
        notice = null
        scope.launch {
            val ids = guestIds.distinct()
            var done = 0
            val outcome = runChunkedDelivery(ids) { chunk ->
                if (ids.size > INVITATION_DELIVERY_MAX_BATCH) notice = "Saving… ${done + chunk.size} of ${ids.size}"
                write(chunk).also { if (it is NativeWriteResult.Ok) done += chunk.size }
            }
            pending = null
            if (outcome.complete) {
                notice = "$doneLabel for ${countLabel(outcome.requested)}."
                selected = selected - ids.toSet()
            } else {
                notice = null
                error = outcome.partialMessage(doneLabel)
                selected = ids.drop(outcome.succeeded).toSet()
            }
            if (outcome.succeeded > 0 || outcome.complete) {
                val refreshed = reload()
                if (refreshed is PlannerInvitationsLoad.Loaded) onReloaded(refreshed)
                else if (outcome.complete) error = "Saved. The list could not be refreshed — tap Refresh."
            }
            busy = false
        }
    }

    fun refresh() {
        if (busy) return
        busy = true
        error = null
        scope.launch {
            val refreshed = reload()
            if (refreshed is PlannerInvitationsLoad.Loaded) onReloaded(refreshed)
            else error = (refreshed as? PlannerInvitationsLoad.Unavailable)?.reason
            busy = false
        }
    }

    Box(Modifier.testTag("planner-invitations-qr")) {
        IASectionList(
            "Invitations",
            if (operations != null) "Send, track and manage each Guest's personal invitation."
            else "Each Guest's personal invitation, read from Wewed."
        ) {
            DesignSection(snapshot.design)
            PhysicalSection(snapshot.physical, snapshot.design.weddingTitle, sharer)

            SectionHeading("Guest Open Invitations")
            SummaryStrip(PlannerInvitationSummary.of(snapshot.guests))
            Text(
                "${snapshot.guests.size} guests, each with their own private invitation." +
                    if (snapshot.missingLinks > 0) " ${snapshot.missingLinks} without a link yet." else "",
                color = WeddingIdentityPalette.Muted,
                fontSize = 12.sp,
                modifier = Modifier.testTag("planner-guest-invitations-summary")
            )

            if (operations != null) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedButton(
                        onClick = { contactFieldError = null; pending = PendingAction.EditContact(null) },
                        enabled = !busy,
                        modifier = Modifier.testTag("planner-invitations-add-guest")
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("Add guest")
                    }
                    if (snapshot.missingLinks > 0) {
                        OutlinedButton(
                            onClick = { pending = PendingAction.GenerateMissing },
                            enabled = !busy,
                            modifier = Modifier.testTag("planner-invitations-generate-missing")
                        ) { Text("Generate ${snapshot.missingLinks} missing link${if (snapshot.missingLinks == 1) "" else "s"}") }
                    }
                    IconButton(onClick = ::refresh, enabled = !busy, modifier = Modifier.testTag("planner-invitations-refresh")) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh invitations", tint = WeddingIdentityPalette.ChampagneDeep)
                    }
                }
            }

            StatusMessages(busy, notice, error)

            if (snapshot.guests.isEmpty()) {
                IACard(
                    "No guests yet",
                    if (operations != null) "Add a guest to send them their own invitation." else "Guests added to this wedding appear here with their own invitation.",
                    testTag = "planner-guest-invitations-empty"
                )
            } else {
                FilterControls(filter) { filter = it }
                if (operations != null) {
                    SelectionBar(
                        visible = visible,
                        selected = selected,
                        busy = busy,
                        onSelectAllFiltered = { selected = selected + visible.map { it.id } },
                        onClear = { selected = emptySet() },
                        onMarkSent = { pending = PendingAction.MarkSent(selected.toList()) },
                        onReset = { pending = PendingAction.ResetDelivery(selected.toList()) },
                    )
                }
                Text(
                    if (filter.isActive) "Showing ${visible.size} of ${snapshot.guests.size}" else "Showing all ${snapshot.guests.size}",
                    color = WeddingIdentityPalette.Muted,
                    fontSize = 11.sp,
                    modifier = Modifier.testTag("planner-invitations-visible-count")
                )
                if (visible.isEmpty()) {
                    IACard("No guests match", "Change the search or filters to see more guests.", testTag = "planner-invitations-no-match")
                }
                visible.forEach { guest ->
                    GuestInvitationRow(
                        guest = guest,
                        weddingTitle = snapshot.design.weddingTitle,
                        sharer = sharer,
                        copier = copier,
                        manageable = operations != null,
                        busy = busy,
                        isSelected = guest.id in selected,
                        onToggleSelected = { on -> selected = if (on) selected + guest.id else selected - guest.id },
                        onShowQr = { onShowQr(guest) },
                        onMarkSent = { pending = PendingAction.MarkSent(listOf(guest.id)) },
                        onReset = { pending = PendingAction.ResetDelivery(listOf(guest.id)) },
                        onEdit = { contactFieldError = null; pending = PendingAction.EditContact(guest) },
                        onDelete = { pending = PendingAction.Delete(guest) },
                        onRotate = { pending = PendingAction.Rotate(guest) },
                    )
                }
            }
        }
    }

    if (operations != null) {
        when (val action = pending) {
            null -> Unit
            is PendingAction.MarkSent -> ChannelDialog(
                count = action.guestIds.size,
                busy = busy,
                onDismiss = { if (!busy) pending = null },
                onChoose = { channel ->
                    runBulk(action.guestIds, "Marked sent via ${channel.label}") { chunk -> operations.markSent(chunk, channel) }
                },
            )
            is PendingAction.ResetDelivery -> ConfirmDialog(
                tag = "planner-invitations-reset-confirm",
                title = "Reset delivery?",
                body = "Clears the sent record for ${countLabel(action.guestIds.size)}. Their links, RSVPs and opens are not changed.",
                confirm = "Reset",
                destructive = false,
                busy = busy,
                onDismiss = { if (!busy) pending = null },
                onConfirm = { runBulk(action.guestIds, "Reset delivery") { chunk -> operations.resetDelivery(chunk) } },
            )
            is PendingAction.Delete -> ConfirmDialog(
                tag = "planner-invitations-delete-confirm",
                title = "Delete ${action.guest.name}?",
                body = "This permanently removes the guest, their RSVP and their personal invitation link. Their link will stop working. This cannot be undone.",
                confirm = "Delete guest",
                destructive = true,
                busy = busy,
                onDismiss = { if (!busy) pending = null },
                onConfirm = { run({ "Deleted ${action.guest.name}." }) { operations.deleteGuest(action.guest.id) } },
            )
            is PendingAction.Rotate -> ConfirmDialog(
                tag = "planner-invitations-rotate-confirm",
                title = "Replace ${action.guest.name}'s link?",
                body = "A new personal link is issued and the current one stops working immediately — including any copy you already sent. Send the new invitation afterwards.",
                confirm = "Replace link",
                destructive = true,
                busy = busy,
                onDismiss = { if (!busy) pending = null },
                onConfirm = { run({ "Issued a new link for ${action.guest.name}." }) { operations.rotateLink(action.guest.id) } },
            )
            PendingAction.GenerateMissing -> ConfirmDialog(
                tag = "planner-invitations-generate-confirm",
                title = "Generate missing links?",
                body = "Issues a personal invitation link for ${countLabel(snapshot.missingLinks)} without one. Existing links are not changed.",
                confirm = "Generate",
                destructive = false,
                busy = busy,
                onDismiss = { if (!busy) pending = null },
                onConfirm = {
                    run({ ok ->
                        val generated = ok.body.optInt("generated", 0)
                        "Generated $generated link${if (generated == 1) "" else "s"}."
                    }) { operations.generateMissingLinks() }
                },
            )
            is PendingAction.EditContact -> GuestContactDialog(
                guest = action.guest,
                busy = busy,
                fieldError = contactFieldError,
                onDismiss = { if (!busy) { pending = null; contactFieldError = null } },
                onSave = { name, email, phone ->
                    val existing = action.guest
                    if (existing == null) {
                        run({ "Added $name." }, keepDialogOnReject = true) { operations.addGuest(name, email, phone) }
                    } else {
                        run({ "Saved $name." }, keepDialogOnReject = true) { operations.editGuest(existing.id, name, email, phone) }
                    }
                },
            )
        }
    }
}

private fun countLabel(count: Int) = if (count == 1) "1 guest" else "$count guests"

@Composable
private fun StatusMessages(busy: Boolean, notice: String?, error: String?) {
    if (busy) {
        LinearProgressIndicator(
            modifier = Modifier.fillMaxWidth().testTag("planner-invitations-busy"),
            color = WeddingIdentityPalette.ChampagneDeep
        )
    }
    notice?.let {
        Text(it, color = WeddingIdentityPalette.Forest, fontSize = 12.sp, fontWeight = FontWeight.Medium,
            modifier = Modifier.testTag("planner-invitations-notice"))
    }
    error?.let {
        Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, fontWeight = FontWeight.Medium,
            modifier = Modifier.testTag("planner-invitations-error"))
    }
}

@Composable
private fun SectionHeading(title: String) {
    Text(
        title,
        color = WeddingIdentityPalette.Ink,
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 15.sp,
        modifier = Modifier.padding(top = 8.dp).semantics { heading() }
    )
}

@Composable
private fun DesignSection(design: PlannerInvitationDesign) {
    SectionHeading("Invitation design")
    IACard("Card style", design.styleLabel, testTag = "planner-invitation-style")
    IACard(
        "Invitation message",
        design.message ?: "No message — guests see the invitation without a personal note.",
        testTag = "planner-invitation-message"
    )
    IACard(
        "RSVP deadline",
        design.rsvpDeadline?.let(::formatInvitationDate) ?: "No deadline set",
        testTag = "planner-invitation-rsvp-deadline"
    )
    IACard("Children", design.childrenPolicyLabel, testTag = "planner-invitation-children-policy")
}

@Composable
private fun PhysicalSection(physical: PlannerPhysicalInvitation, weddingTitle: String, sharer: InvitationSharer) {
    SectionHeading("Printed Invitation Access")
    val accessUrl = physical.accessUrl
    if (physical.configured && accessUrl != null) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            color = WeddingIdentityPalette.IvorySoft,
        ) {
            Column(
                modifier = Modifier.padding(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                WewedQrCode(
                    payload = accessUrl,
                    contentDescription = "Printed invitation QR code",
                    testTag = "planner-physical-invitation-qr",
                    size = 180.dp,
                )
                physical.code?.let {
                    Text(
                        "Shared fallback code $it",
                        color = WeddingIdentityPalette.Ink,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        modifier = Modifier.testTag("planner-physical-invitation-code")
                    )
                }
                Text(
                    "Configured · ${physical.invitedCount} guests listed · ${physical.scanCount} opens",
                    color = WeddingIdentityPalette.Muted,
                    fontSize = 12.sp,
                    modifier = Modifier.testTag("planner-physical-invitation-status")
                )
                TextButton(
                    onClick = { sharer.share(weddingTitle, accessUrl) },
                    modifier = Modifier.testTag("planner-physical-invitation-share")
                ) {
                    Icon(Icons.Default.Share, contentDescription = null, tint = WeddingIdentityPalette.ChampagneDeep)
                    Spacer(Modifier.width(6.dp))
                    Text("Share printed invitation link", color = WeddingIdentityPalette.ChampagneDeep, fontWeight = FontWeight.SemiBold)
                }
                Text(
                    "One shared QR for every printed card. It opens the invitation; it is not a Wedding Pass.",
                    color = WeddingIdentityPalette.Muted,
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center
                )
            }
        }
    } else {
        IACard(
            "Not configured",
            "No printed-invitation QR has been set up for this wedding yet.",
            trailing = "${physical.invitedCount} guests",
            testTag = "planner-physical-invitation-unconfigured"
        )
    }
}

@Composable
private fun SummaryStrip(summary: PlannerInvitationSummary) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).testTag("planner-invitations-counts"),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        SummaryTile("Guests", summary.total, "planner-invitations-count-total")
        SummaryTile("Sent", summary.sent, "planner-invitations-count-sent")
        SummaryTile("Not sent", summary.notSent, "planner-invitations-count-not-sent")
        SummaryTile("Opened", summary.opened, "planner-invitations-count-opened")
        SummaryTile("Attending", summary.attending, "planner-invitations-count-attending")
        SummaryTile("Declined", summary.declined, "planner-invitations-count-declined")
        SummaryTile("Awaiting", summary.pending, "planner-invitations-count-pending")
        SummaryTile("No contact", summary.missingContact, "planner-invitations-count-missing-contact")
    }
}

@Composable
private fun SummaryTile(label: String, value: Int, tag: String) {
    Surface(
        shape = RoundedCornerShape(10.dp),
        color = WeddingIdentityPalette.IvorySoft,
        border = androidx.compose.foundation.BorderStroke(1.dp, WeddingIdentityPalette.Hairline),
        modifier = Modifier.testTag(tag).semantics { contentDescription = "$label: $value" }
    ) {
        Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("$value", color = WeddingIdentityPalette.Ink, fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
            Text(label, color = WeddingIdentityPalette.Muted, fontSize = 10.sp)
        }
    }
}

@Composable
private fun FilterControls(filter: PlannerInvitationFilter, onChange: (PlannerInvitationFilter) -> Unit) {
    OutlinedTextField(
        value = filter.query,
        onValueChange = { onChange(filter.copy(query = it)) },
        modifier = Modifier.fillMaxWidth().testTag("planner-invitations-search"),
        singleLine = true,
        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
        placeholder = { Text("Search name, email, phone, table or sender", fontSize = 13.sp) },
    )
    ChipRow("RSVP") {
        FilterChoice("All", filter.rsvp == null, "planner-invitations-filter-rsvp-all") { onChange(filter.copy(rsvp = null)) }
        PlannerInvitationRsvpStatus.entries.forEach { status ->
            FilterChoice(status.label, filter.rsvp == status, "planner-invitations-filter-rsvp-${status.wire}") { onChange(filter.copy(rsvp = status)) }
        }
    }
    ChipRow("Delivery") {
        InvitationSentFilter.entries.forEach { option ->
            FilterChoice(option.label, filter.sent == option, "planner-invitations-filter-sent-${option.name.lowercase()}") { onChange(filter.copy(sent = option)) }
        }
    }
    ChipRow("Opened") {
        InvitationOpenedFilter.entries.forEach { option ->
            FilterChoice(option.label, filter.opened == option, "planner-invitations-filter-opened-${option.name.lowercase()}") { onChange(filter.copy(opened = option)) }
        }
    }
    ChipRow("Contact") {
        InvitationContactFilter.entries.forEach { option ->
            FilterChoice(option.label, filter.contact == option, "planner-invitations-filter-contact-${option.name.lowercase()}") { onChange(filter.copy(contact = option)) }
        }
    }
}

@Composable
private fun ChipRow(label: String, chips: @Composable RowScope.() -> Unit) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = WeddingIdentityPalette.Muted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(56.dp))
        chips()
    }
}

@Composable
private fun FilterChoice(label: String, selected: Boolean, tag: String, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label, fontSize = 12.sp) },
        modifier = Modifier.testTag(tag),
    )
}

@Composable
private fun SelectionBar(
    visible: List<PlannerGuestInvitation>,
    selected: Set<String>,
    busy: Boolean,
    onSelectAllFiltered: () -> Unit,
    onClear: () -> Unit,
    onMarkSent: () -> Unit,
    onReset: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = WeddingIdentityPalette.Ivory,
        border = androidx.compose.foundation.BorderStroke(1.dp, WeddingIdentityPalette.Hairline),
        modifier = Modifier.fillMaxWidth().testTag("planner-invitations-selection-bar")
    ) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                if (selected.isEmpty()) "No guests selected" else "${countLabel(selected.size)} selected",
                color = WeddingIdentityPalette.Ink,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.testTag("planner-invitations-selected-count")
            )
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(
                    onClick = onSelectAllFiltered,
                    enabled = !busy && visible.isNotEmpty(),
                    modifier = Modifier.testTag("planner-invitations-select-all-filtered")
                ) { Text("Select all ${visible.size} shown") }
                TextButton(onClick = onClear, enabled = !busy && selected.isNotEmpty(), modifier = Modifier.testTag("planner-invitations-clear-selection")) {
                    Text("Clear")
                }
                TextButton(onClick = onMarkSent, enabled = !busy && selected.isNotEmpty(), modifier = Modifier.testTag("planner-invitations-bulk-mark-sent")) {
                    Text("Mark sent", fontWeight = FontWeight.SemiBold)
                }
                TextButton(onClick = onReset, enabled = !busy && selected.isNotEmpty(), modifier = Modifier.testTag("planner-invitations-bulk-reset")) {
                    Text("Reset delivery")
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun GuestInvitationRow(
    guest: PlannerGuestInvitation,
    weddingTitle: String,
    sharer: InvitationSharer,
    copier: InvitationCopier,
    manageable: Boolean,
    busy: Boolean,
    isSelected: Boolean,
    onToggleSelected: (Boolean) -> Unit,
    onShowQr: () -> Unit,
    onMarkSent: () -> Unit,
    onReset: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onRotate: () -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    Surface(
        modifier = Modifier.fillMaxWidth().testTag("planner-guest-invitation-${guest.id}"),
        shape = RoundedCornerShape(12.dp),
        color = WeddingIdentityPalette.IvorySoft,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) WeddingIdentityPalette.ChampagneDeep else WeddingIdentityPalette.Hairline)
    ) {
        Column(Modifier.padding(horizontal = 13.dp, vertical = 11.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (manageable) {
                    Checkbox(
                        checked = isSelected,
                        onCheckedChange = onToggleSelected,
                        enabled = !busy,
                        modifier = Modifier
                            .testTag("planner-guest-invitation-select-${guest.id}")
                            .semantics { contentDescription = "Select ${guest.name}" }
                    )
                }
                Column(Modifier.weight(1f)) {
                    Text(guest.name, color = WeddingIdentityPalette.Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                    Text(guest.tableLabel, color = WeddingIdentityPalette.Muted, fontSize = 11.sp)
                    val contact = listOfNotNull(guest.email, guest.phone).joinToString(" · ")
                    Text(
                        contact.ifEmpty { "No email or phone" },
                        color = WeddingIdentityPalette.Muted,
                        fontSize = 11.sp,
                        modifier = Modifier.testTag("planner-guest-invitation-contact-${guest.id}")
                    )
                }
                Text(
                    guest.status.label,
                    color = WeddingIdentityPalette.Forest,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.testTag("planner-guest-invitation-status-${guest.id}")
                )
            }
            // Wraps instead of squeezing: a long "Sent via … by …" badge must never crush the Opened
            // badge to zero width (which stretched the row and hid its actions).
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                StateBadge(
                    text = if (guest.isSent) sentLabel(guest) else "Not sent",
                    on = guest.isSent,
                    tag = "planner-guest-invitation-delivery-${guest.id}",
                )
                StateBadge(
                    text = guest.openedAt?.let { "Opened ${formatInvitationDateTime(it)}" } ?: "Not opened",
                    on = guest.isOpened,
                    tag = "planner-guest-invitation-opened-${guest.id}",
                )
            }
            val message = guest.shareMessage
            if (guest.hasInvitationLink) {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    RowAction("Show QR", Icons.Default.QrCode2, "planner-guest-invitation-show-qr-${guest.id}", "Show invitation QR for ${guest.name}", onShowQr)
                    if (message != null) {
                        RowAction("Share", Icons.Default.Share, "planner-guest-invitation-share-${guest.id}", "Share invitation with ${guest.name}", onClick = {
                            sharer.share(weddingTitle, message)
                        })
                        RowAction("Copy", Icons.Default.ContentCopy, "planner-guest-invitation-copy-${guest.id}", "Copy invitation for ${guest.name}", onClick = {
                            copier.copy("Wewed invitation", message)
                        })
                    }
                    if (manageable) {
                        if (guest.isSent) {
                            RowAction("Reset", Icons.Default.MarkEmailRead, "planner-guest-invitation-reset-${guest.id}", "Reset delivery for ${guest.name}", onReset, enabled = !busy)
                        } else {
                            RowAction("Mark sent", Icons.Default.MarkEmailRead, "planner-guest-invitation-mark-sent-${guest.id}", "Mark invitation sent to ${guest.name}", onMarkSent, enabled = !busy)
                        }
                    }
                }
            } else {
                Text(
                    "No invitation link yet",
                    color = WeddingIdentityPalette.Muted,
                    fontSize = 11.sp,
                    modifier = Modifier.testTag("planner-guest-invitation-missing-${guest.id}")
                )
            }
            if (manageable) {
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    RowAction("Edit", Icons.Default.Edit, "planner-guest-invitation-edit-${guest.id}", "Edit ${guest.name}", onEdit, enabled = !busy)
                    Box {
                        TextButton(
                            onClick = { menuOpen = true },
                            enabled = !busy,
                            modifier = Modifier.testTag("planner-guest-invitation-more-${guest.id}")
                                .semantics { contentDescription = "More actions for ${guest.name}" }
                        ) { Text("More", color = WeddingIdentityPalette.Muted, fontSize = 12.sp) }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            if (guest.hasInvitationLink) {
                                DropdownMenuItem(
                                    text = { Text("Replace invitation link…") },
                                    onClick = { menuOpen = false; onRotate() },
                                    modifier = Modifier.testTag("planner-guest-invitation-rotate-${guest.id}")
                                )
                            }
                            DropdownMenuItem(
                                text = { Text("Delete guest…", color = MaterialTheme.colorScheme.error) },
                                leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
                                onClick = { menuOpen = false; onDelete() },
                                modifier = Modifier.testTag("planner-guest-invitation-delete-${guest.id}")
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun sentLabel(guest: PlannerGuestInvitation): String = buildString {
    append("Sent")
    guest.deliveryChannel?.let { append(" via ${it.label}") }
    guest.deliveredAt?.let { append(" · ${formatInvitationDateTime(it)}") }
    guest.deliveredBy?.let { append(" · by $it") }
}

@Composable
private fun StateBadge(text: String, on: Boolean, tag: String) {
    Surface(
        shape = RoundedCornerShape(50),
        color = if (on) WeddingIdentityPalette.Forest.copy(alpha = 0.10f) else Color.Transparent,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (on) WeddingIdentityPalette.Forest.copy(alpha = 0.35f) else WeddingIdentityPalette.Hairline),
        modifier = Modifier.testTag(tag)
    ) {
        Text(
            text,
            color = if (on) WeddingIdentityPalette.Forest else WeddingIdentityPalette.Muted,
            fontSize = 10.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@Composable
private fun RowAction(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    tag: String,
    description: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
) {
    TextButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.testTag(tag).semantics { contentDescription = description }
    ) {
        Icon(icon, contentDescription = null, tint = WeddingIdentityPalette.ChampagneDeep, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(4.dp))
        Text(label, color = WeddingIdentityPalette.ChampagneDeep, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ChannelDialog(
    count: Int,
    busy: Boolean,
    onDismiss: () -> Unit,
    onChoose: (InvitationDeliveryChannel) -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag("planner-invitations-channel-dialog"),
        title = { Text("Mark ${countLabel(count)} sent") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("How was the invitation sent? This records delivery only — it does not send a message, open the invitation or change any RSVP.", fontSize = 13.sp)
                InvitationDeliveryChannel.entries.forEach { channel ->
                    OutlinedButton(
                        onClick = { onChoose(channel) },
                        enabled = !busy,
                        modifier = Modifier.fillMaxWidth().testTag("planner-invitations-channel-${channel.wire}")
                    ) { Text(channel.label) }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss, enabled = !busy) { Text("Cancel") } },
    )
}

@Composable
private fun ConfirmDialog(
    tag: String,
    title: String,
    body: String,
    confirm: String,
    destructive: Boolean,
    busy: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag(tag),
        title = { Text(title) },
        text = { Text(body, fontSize = 13.sp) },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = !busy, modifier = Modifier.testTag("$tag-confirm")) {
                Text(confirm, color = if (destructive) MaterialTheme.colorScheme.error else WeddingIdentityPalette.Forest, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !busy, modifier = Modifier.testTag("$tag-cancel")) { Text("Cancel") }
        },
    )
}

@Composable
private fun GuestContactDialog(
    guest: PlannerGuestInvitation?,
    busy: Boolean,
    fieldError: String?,
    onDismiss: () -> Unit,
    onSave: (name: String, email: String?, phone: String?) -> Unit,
) {
    var name by remember(guest?.id) { mutableStateOf(guest?.name.orEmpty()) }
    var email by remember(guest?.id) { mutableStateOf(guest?.email.orEmpty()) }
    var phone by remember(guest?.id) { mutableStateOf(guest?.phone.orEmpty()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag("planner-invitations-guest-dialog"),
        title = { Text(if (guest == null) "Add guest" else "Edit ${guest.name}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = name, onValueChange = { name = it }, singleLine = true, label = { Text("Name") },
                    modifier = Modifier.fillMaxWidth().testTag("planner-invitations-guest-name")
                )
                OutlinedTextField(
                    value = email, onValueChange = { email = it }, singleLine = true, label = { Text("Email (optional)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth().testTag("planner-invitations-guest-email")
                )
                OutlinedTextField(
                    value = phone, onValueChange = { phone = it }, singleLine = true, label = { Text("Phone (optional)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    modifier = Modifier.fillMaxWidth().testTag("planner-invitations-guest-phone")
                )
                if (guest == null) {
                    Text("A personal invitation link is issued for the new guest. Nothing is sent until you share it.", fontSize = 11.sp, color = WeddingIdentityPalette.Muted)
                }
                fieldError?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.testTag("planner-invitations-guest-error"))
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(name.trim(), email.trim().ifEmpty { null }, phone.trim().ifEmpty { null }) },
                enabled = !busy && name.isNotBlank(),
                modifier = Modifier.testTag("planner-invitations-guest-save")
            ) { Text("Save", fontWeight = FontWeight.SemiBold) }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !busy) { Text("Cancel") } },
    )
}

@Composable
private fun GuestInvitationQrDialog(guest: PlannerGuestInvitation, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(16.dp), color = WeddingIdentityPalette.Ivory) {
            Column(
                modifier = Modifier.padding(24.dp).testTag("planner-guest-invitation-qr-dialog"),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    guest.name,
                    color = WeddingIdentityPalette.Ink,
                    fontFamily = FontFamily.Serif,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 20.sp,
                    modifier = Modifier.testTag("planner-guest-invitation-qr-name")
                )
                guest.qrValue?.let {
                    WewedQrCode(
                        payload = it,
                        contentDescription = "Invitation QR code for ${guest.name}",
                        testTag = "planner-guest-invitation-qr",
                        size = 240.dp,
                    )
                }
                Text(
                    "${guest.name}'s own invitation. It opens their RSVP; it is not a Wedding Pass.",
                    color = WeddingIdentityPalette.Muted,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )
                TextButton(onClick = onDismiss, modifier = Modifier.testTag("planner-guest-invitation-qr-done")) {
                    Text("Done", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

internal fun formatInvitationDate(iso: String): String = runCatching {
    DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG).format(Instant.parse(iso).atZone(ZoneOffset.UTC).toLocalDate())
}.getOrDefault(iso)

/** Delivery / open timestamps in the device's zone (they are real instants, not calendar dates). */
internal fun formatInvitationDateTime(iso: String, zone: ZoneId = ZoneId.systemDefault()): String = runCatching {
    DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT).format(Instant.parse(iso).atZone(zone))
}.getOrDefault(iso)
