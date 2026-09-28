package pro.wewed.app.ui.roles

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.QrCode2
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import pro.wewed.app.services.PlannerGuestInvitation
import pro.wewed.app.services.PlannerInvitationDesign
import pro.wewed.app.services.PlannerInvitationsLoad
import pro.wewed.app.services.PlannerInvitationsSnapshot
import pro.wewed.app.services.PlannerPhysicalInvitation
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

private fun systemSharer(context: Context) = InvitationSharer { subject, text ->
    context.startActivity(invitationShareIntent(subject, text).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

/**
 * QRO05-PIQR01 — production Planner → More → Invitations & QR.
 *
 * Three distinct sections read from the same canonical server projections as the desktop Planner:
 * Invitation design, Printed Invitation Access (one shared QR for the printed card) and Guest Open
 * Invitations (each Guest's own private link). Read-only: no issue, rotate, style or QR-create
 * control exists here.
 *
 * The loaded snapshot lives only in this composable's state — fetched when the Planner opens this
 * screen and dropped when they leave it. Private links are never rendered as text or put in a
 * content description; they reach the screen only as a QR image or the system share sheet.
 */
@Composable
fun PlannerInvitationsQrSection(
    load: suspend () -> PlannerInvitationsLoad,
    sharer: InvitationSharer? = null,
) {
    val context = LocalContext.current
    val share = sharer ?: remember(context) { systemSharer(context) }
    var state by remember { mutableStateOf<PlannerInvitationsLoad?>(null) }
    var attempt by remember { mutableIntStateOf(0) }
    var qrGuest by remember { mutableStateOf<PlannerGuestInvitation?>(null) }

    LaunchedEffect(attempt) {
        state = null
        state = load()
    }

    when (val current = state) {
        null -> IASectionList("Invitations & QR", "Loading invitations…") {
            Box(Modifier.fillMaxWidth().testTag("planner-invitations-loading"), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep)
            }
        }
        is PlannerInvitationsLoad.Unavailable -> IASectionList("Invitations & QR") {
            IACard("Invitations are unavailable", current.reason, testTag = "planner-invitations-unavailable")
            TextButton(onClick = { attempt++ }, modifier = Modifier.testTag("planner-invitations-retry")) {
                Text("Try again", color = WeddingIdentityPalette.Forest, fontWeight = FontWeight.SemiBold)
            }
        }
        is PlannerInvitationsLoad.Loaded -> LoadedInvitations(current.snapshot, share) { qrGuest = it }
    }

    qrGuest?.let { guest -> GuestInvitationQrDialog(guest) { qrGuest = null } }
}

@Composable
private fun LoadedInvitations(
    snapshot: PlannerInvitationsSnapshot,
    sharer: InvitationSharer,
    onShowQr: (PlannerGuestInvitation) -> Unit,
) {
    Box(Modifier.testTag("planner-invitations-qr")) {
        IASectionList("Invitations & QR", "Read from Wewed. Edit the design and printed code on the web.") {
            DesignSection(snapshot.design)
            PhysicalSection(snapshot.physical, snapshot.design.weddingTitle, sharer)
            GuestSection(snapshot, sharer, onShowQr)
        }
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
    design.message?.let { IACard("Invitation message", it, testTag = "planner-invitation-message") }
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
            "No printed-invitation QR exists yet. Create it in Wewed on the web before printing.",
            trailing = "${physical.invitedCount} guests",
            testTag = "planner-physical-invitation-unconfigured"
        )
    }
}

@Composable
private fun GuestSection(
    snapshot: PlannerInvitationsSnapshot,
    sharer: InvitationSharer,
    onShowQr: (PlannerGuestInvitation) -> Unit,
) {
    SectionHeading("Guest Open Invitations")
    val base = "${snapshot.guests.size} guests, each with their own private invitation."
    Text(
        if (snapshot.missingLinks > 0) "$base ${snapshot.missingLinks} without a link yet — issue links from Wewed on the web." else base,
        color = WeddingIdentityPalette.Muted,
        fontSize = 12.sp,
        modifier = Modifier.testTag("planner-guest-invitations-summary")
    )
    if (snapshot.guests.isEmpty()) {
        IACard("No guests yet", "Add guests in Wewed to send them their own invitation.", testTag = "planner-guest-invitations-empty")
    }
    snapshot.guests.forEach { guest ->
        GuestInvitationRow(guest, snapshot.design.weddingTitle, sharer) { onShowQr(guest) }
    }
}

@Composable
private fun GuestInvitationRow(
    guest: PlannerGuestInvitation,
    weddingTitle: String,
    sharer: InvitationSharer,
    onShowQr: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth().testTag("planner-guest-invitation-${guest.id}"),
        shape = RoundedCornerShape(12.dp),
        color = WeddingIdentityPalette.IvorySoft,
        border = androidx.compose.foundation.BorderStroke(1.dp, WeddingIdentityPalette.Hairline)
    ) {
        Column(Modifier.padding(horizontal = 13.dp, vertical = 11.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(guest.name, color = WeddingIdentityPalette.Ink, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                    Text(guest.tableLabel, color = WeddingIdentityPalette.Muted, fontSize = 11.sp)
                }
                Text(
                    guest.status.label,
                    color = WeddingIdentityPalette.Forest,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.testTag("planner-guest-invitation-status-${guest.id}")
                )
            }
            val message = guest.shareMessage
            if (guest.hasInvitationLink) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TextButton(
                        onClick = onShowQr,
                        modifier = Modifier
                            .testTag("planner-guest-invitation-show-qr-${guest.id}")
                            .semantics { contentDescription = "Show invitation QR for ${guest.name}" }
                    ) {
                        Icon(Icons.Default.QrCode2, contentDescription = null, tint = WeddingIdentityPalette.ChampagneDeep)
                        Spacer(Modifier.width(4.dp))
                        Text("Show QR", color = WeddingIdentityPalette.ChampagneDeep, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                    if (message != null) {
                        TextButton(
                            onClick = { sharer.share(weddingTitle, message) },
                            modifier = Modifier
                                .testTag("planner-guest-invitation-share-${guest.id}")
                                .semantics { contentDescription = "Share invitation with ${guest.name}" }
                        ) {
                            Icon(Icons.Default.Share, contentDescription = null, tint = WeddingIdentityPalette.ChampagneDeep)
                            Spacer(Modifier.width(4.dp))
                            Text("Share Invitation", color = WeddingIdentityPalette.ChampagneDeep, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
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
        }
    }
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
