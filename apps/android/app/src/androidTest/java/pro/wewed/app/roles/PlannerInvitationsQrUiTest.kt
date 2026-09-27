package pro.wewed.app.roles

import android.app.Instrumentation
import android.content.Intent
import android.content.IntentFilter
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import pro.wewed.app.services.PlannerGuestInvitation
import pro.wewed.app.services.PlannerInvitationDesign
import pro.wewed.app.services.PlannerInvitationRsvpStatus
import pro.wewed.app.services.PlannerInvitationsLoad
import pro.wewed.app.services.PlannerInvitationsSnapshot
import pro.wewed.app.services.PlannerPhysicalInvitation
import pro.wewed.app.ui.roles.InvitationSharer
import pro.wewed.app.ui.roles.PlannerInvitationsQrSection
import pro.wewed.app.ui.roles.invitationShareIntent

/**
 * QRO05-PIQR01 — the production Planner Invitations & QR composable rendering a loaded snapshot.
 * Synthetic data with placeholder links (never real invitation credentials); the production
 * transport/mapping is covered by `PlannerInvitationsReaderTest`, the backend by the disposable-DB
 * convergence suite.
 */
class PlannerInvitationsQrUiTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val linkMarker = "fixture.invalid"

    private fun guest(id: String, name: String, status: PlannerInvitationRsvpStatus, table: Int?, link: Boolean) =
        PlannerGuestInvitation(
            id = id, name = name, status = status, tableNumber = table, checkedIn = false,
            qrValue = if (link) "https://$linkMarker/$id" else null,
            shareMessage = if (link) "Dear $name, https://$linkMarker/$id" else null,
        )

    private fun snapshot(configured: Boolean = true) = PlannerInvitationsSnapshot(
        design = PlannerInvitationDesign("Fixture Wedding", "ivory-floral-gold", "Join us", "2026-11-01T00:00:00.000Z", "adults_only"),
        guests = listOf(
            guest("g-a", "Ada Attending", PlannerInvitationRsvpStatus.ATTENDING, 4, true),
            guest("g-b", "Ben Declined", PlannerInvitationRsvpStatus.DECLINED, null, true),
            guest("g-c", "Cy Pending", PlannerInvitationRsvpStatus.PENDING, 3, true),
            guest("g-d", "Di Unlinked", PlannerInvitationRsvpStatus.PENDING, null, false),
        ),
        missingLinks = 1,
        physical = PlannerPhysicalInvitation(
            configured = configured,
            code = if (configured) "ABCD-EFGH-23" else null,
            accessUrl = if (configured) "https://$linkMarker/i/printed" else null,
            scanCount = 7,
            invitedCount = 4,
        ),
    )

    private val shared = mutableListOf<Pair<String, String>>()
    private val recorder = InvitationSharer { subject, text -> shared.add(subject to text) }

    private fun render(load: PlannerInvitationsLoad, sharer: InvitationSharer? = recorder) {
        compose.setContent { PlannerInvitationsQrSection(load = { load }, sharer = sharer) }
        compose.waitUntil(5_000) {
            compose.onAllNodesWithTag("planner-invitations-loading").fetchSemanticsNodes().isEmpty()
        }
    }

    @Test fun rendersTheThreeSectionsFromRealDataNotThePlaceholder() {
        render(PlannerInvitationsLoad.Loaded(snapshot()))
        compose.onNodeWithTag("planner-invitations-qr").assertExists()
        compose.onNodeWithText("Invitation design").assertExists()
        compose.onNodeWithText("Printed Invitation Access").assertExists()
        compose.onNodeWithText("Guest Open Invitations").assertExists()
        compose.onNodeWithText("Ivory Floral Gold").assertExists()
        compose.onNodeWithText("Adults only").assertExists()
        compose.onAllNodesWithText("does not load them yet", substring = true).assertCountEquals(0)
    }

    @Test fun printedInvitationQrUsesTheInvitationIdentityNeverThePass() {
        render(PlannerInvitationsLoad.Loaded(snapshot()))
        compose.onNodeWithTag("planner-physical-invitation-qr").assertExists()
            .assert(hasContentDescription("Printed invitation QR code"))
        compose.onNodeWithTag("planner-physical-invitation-status").assert(hasText("Configured", substring = true))
        compose.onAllNodesWithTag("wedding-pass-qr").assertCountEquals(0)
    }

    @Test fun guestRowsCarryNameStatusAndTableButNoLinkText() {
        render(PlannerInvitationsLoad.Loaded(snapshot()))
        for ((id, status) in listOf("g-a" to "Attending", "g-b" to "Declined", "g-c" to "Awaiting reply")) {
            compose.onNodeWithTag("planner-guest-invitation-$id").performScrollTo().assertIsDisplayed()
            compose.onNodeWithTag("planner-guest-invitation-status-$id").assert(hasText(status))
        }
        compose.onNodeWithTag("planner-guest-invitation-missing-g-d").performScrollTo().assertIsDisplayed()
        compose.onAllNodesWithTag("planner-guest-invitation-show-qr-g-d").assertCountEquals(0)
        compose.onAllNodes(hasText(linkMarker, substring = true), useUnmergedTree = true).assertCountEquals(0)
        compose.onAllNodes(hasContentDescription(linkMarker, substring = true), useUnmergedTree = true).assertCountEquals(0)
    }

    @Test fun showQrOpensThatGuestsInvitationQr() {
        render(PlannerInvitationsLoad.Loaded(snapshot()))
        compose.onAllNodesWithTag("planner-guest-invitation-qr").assertCountEquals(0)
        compose.onNodeWithTag("planner-guest-invitation-show-qr-g-c").performScrollTo().performClick()
        compose.onNodeWithTag("planner-guest-invitation-qr").assertIsDisplayed()
            .assert(hasContentDescription("Invitation QR code for Cy Pending"))
        compose.onNodeWithTag("planner-guest-invitation-qr-name").assert(hasText("Cy Pending"))
        compose.onAllNodesWithTag("wedding-pass-qr").assertCountEquals(0)
        compose.onAllNodes(hasText(linkMarker, substring = true), useUnmergedTree = true).assertCountEquals(0)
        compose.onNodeWithTag("planner-guest-invitation-qr-done").performClick()
        compose.onAllNodesWithTag("planner-guest-invitation-qr").assertCountEquals(0)
    }

    @Test fun shareHandsTheServerMessageToTheSharer() {
        render(PlannerInvitationsLoad.Loaded(snapshot()))
        compose.onNodeWithTag("planner-guest-invitation-share-g-a").performScrollTo().performClick()
        compose.onNodeWithTag("planner-physical-invitation-share").performScrollTo().performClick()
        compose.runOnIdle {
            assertEquals(listOf(
                "Fixture Wedding" to "Dear Ada Attending, https://$linkMarker/g-a",
                "Fixture Wedding" to "https://$linkMarker/i/printed",
            ), shared)
        }
    }

    @Test fun defaultShareLaunchesTheSystemActionSendChooser() {
        val monitor = InstrumentationRegistry.getInstrumentation()
            .addMonitor(IntentFilter(Intent.ACTION_CHOOSER), Instrumentation.ActivityResult(0, null), true)
        try {
            render(PlannerInvitationsLoad.Loaded(snapshot()), sharer = null)
            compose.onNodeWithTag("planner-guest-invitation-share-g-b").performScrollTo().performClick()
            compose.waitUntil(5_000) { monitor.hits > 0 }
            assertEquals(1, monitor.hits)
        } finally {
            InstrumentationRegistry.getInstrumentation().removeMonitor(monitor)
        }
        val chooser = invitationShareIntent("Fixture Wedding", "Dear Ben, link")
        assertEquals(Intent.ACTION_CHOOSER, chooser.action)
        @Suppress("DEPRECATION")
        val send = chooser.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)!!
        assertEquals(Intent.ACTION_SEND, send.action)
        assertEquals("text/plain", send.type)
        assertEquals("Dear Ben, link", send.getStringExtra(Intent.EXTRA_TEXT))
    }

    @Test fun unconfiguredPrintedInvitationShowsNoQr() {
        render(PlannerInvitationsLoad.Loaded(snapshot(configured = false)))
        compose.onNodeWithTag("planner-physical-invitation-unconfigured").assertExists()
        compose.onAllNodesWithTag("planner-physical-invitation-qr").assertCountEquals(0)
    }

    @Test fun unavailableIsHonestAndNeverShowsEmptyInvitations() {
        render(PlannerInvitationsLoad.Unavailable("Your role on this wedding cannot view invitations."))
        compose.onNodeWithTag("planner-invitations-unavailable").assertExists()
        compose.onAllNodesWithText("Guest Open Invitations").assertCountEquals(0)
        assertTrue(shared.isEmpty())
    }
}
