package pro.wewed.app.ui.roles

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MailOutline
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import pro.wewed.app.services.RoleScopedAccess
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.ui.invitation.InvitationMode
import pro.wewed.app.ui.invitation.IvoryInvitationScreen
import pro.wewed.app.ui.pass.WeddingPassCard
import pro.wewed.app.ui.shared.*

private val guestTabs = listOf(
    ShellTab("invitation", "Invitation", Icons.Default.MailOutline),
    ShellTab("pass", "My Pass", Icons.Default.QrCode),
    ShellTab("info", "Wedding Info", Icons.Default.Info),
    ShellTab("account", "Account", Icons.Default.AccountCircle)
)

/**
 * A guest sees only their own invitation, reply and pass, plus public wedding information.
 * Every read goes through the guest-scoped access, pinned to this guest's record.
 */
@Composable
fun GuestShell(access: RoleScopedAccess, sessionViewModel: SessionViewModel) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    // Bumped after a reply so the invitation and pass reload from the record.
    var version by remember { mutableIntStateOf(0) }
    val wedding = rememberLoad(version) { access.weddingSummary() }

    RoleShellScaffold(
        grant = access.grant,
        rootTag = "guest-shell-root",
        tabs = guestTabs,
        selectedIndex = tab,
        onSelect = { tab = it }
    ) {
        when (tab) {
            0 -> {
                val invitation = rememberLoad(version) { access.ownInvitation() }
                LoadContent(invitation) { context ->
                    IvoryInvitationScreen(
                        invitation = context,
                        mode = InvitationMode.Guest(
                            respond = { attending ->
                                val pass = access.respondToOwnInvitation(attending)
                                version++
                                pass
                            },
                            onViewPass = { tab = 1 }
                        ),
                        fallbackVenue = (wedding as? Load.Ready)?.value?.venueLocation
                    )
                }
            }
            1 -> GuestPassTab(access, version, fallback = (wedding as? Load.Ready)?.value?.venueLocation)
            2 -> GuestWeddingInfoTab(access)
            else -> AccountContent(sessionViewModel, access.grant)
        }
    }
}

@Composable
private fun GuestPassTab(access: RoleScopedAccess, version: Int, fallback: pro.wewed.app.models.VenueLocation?) {
    val pass = rememberLoad(version) { access.ownPass() }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .testTag("guest-pass-root")
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        LoadContent(pass) { value ->
            if (value == null) {
                InfoCard(modifier = Modifier.testTag("guest-pass-unavailable")) {
                    SectionTitle("No pass yet")
                    BodyText("Your pass appears here after you accept your invitation.")
                }
            } else {
                WeddingPassCard(pass = value, fallbackVenue = fallback, guestNameTag = "guest-pass-guest-name")
            }
        }
    }
}

@Composable
private fun GuestWeddingInfoTab(access: RoleScopedAccess) {
    val wedding = rememberLoad(Unit) { access.weddingSummary() }
    val programme = rememberLoad(Unit) { access.programme() }
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("guest-wedding-info-root"),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            LoadContent(wedding) { w ->
                InfoCard {
                    LabeledValue("Couple", w.coupleNames)
                    LabeledValue("Date", Formatting.dateAndTime(w.date))
                    LabeledValue("Venue", listOf(w.venueName, w.city, w.country).filter { it.isNotBlank() }.joinToString(", "))
                    OpenInMapsButton(venue = w.venueLocation, tag = "wedding-info-open-maps")
                }
            }
        }
        item { SectionTitle("Programme") }
        when (programme) {
            is Load.Ready -> {
                if (programme.value.isEmpty()) {
                    item { EmptyStateText("No programme has been shared for this wedding yet.", "guest-programme-empty") }
                }
                items(programme.value.sortedBy { it.time }, key = { it.id }) { ProgrammeRow(it) }
            }
            is Load.Failed -> item { ProblemText(programme.message) }
            Load.Loading -> item { LoadingIndicator() }
        }
    }
}
