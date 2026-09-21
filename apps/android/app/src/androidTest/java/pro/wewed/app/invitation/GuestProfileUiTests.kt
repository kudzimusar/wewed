package pro.wewed.app.invitation

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.runBlocking
import org.junit.*
import org.json.JSONObject
import pro.wewed.app.services.AndroidKeystoreSecureStorage
import pro.wewed.app.ui.invitation.GuestOnlyInvitationShell
import java.net.ServerSocket
import kotlin.concurrent.thread

/** Real Compose surfaces + guest HTTP client; synthetic server, never Private Real. */
open class GuestUiTestBase {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private lateinit var server: ServerSocket
    protected lateinit var coordinator: LiveGuestInvitationCoordinator
    protected lateinit var storage: AndroidKeystoreSecureStorage
    @Volatile private var running = true
    protected var attendance: Boolean? = null

    @Before fun prepare() {
        GuestOnlyEntryState.reset()
        storage = AndroidKeystoreSecureStorage(ApplicationProvider.getApplicationContext(), "wewed_guest_instrumentation")
        storage.clear()
        server = ServerSocket(0)
        thread(isDaemon = true) {
            while (running) runCatching {
                server.accept().use { socket ->
                    val input = socket.getInputStream().bufferedReader()
                    val request = input.readLine().orEmpty()
                    var line = input.readLine()
                    var length = 0
                    var cookieHeader = ""
                    while (!line.isNullOrEmpty()) {
                        if (line.startsWith("Cookie:", true)) cookieHeader = line
                        if (line.startsWith("Content-Length:", true)) length = line.substringAfter(':').trim().toInt()
                        line = input.readLine()
                    }
                    val body = CharArray(length); var read = 0
                    while (read < length) { val n = input.read(body, read, length-read); if (n < 0) break; read += n }
                    val secondGuest = cookieHeader.contains("session-b") || String(body).contains("second-entry")
                    var json = JSONObject("""{"success":true,"authorized":true,"wedding":{"slug":"guest-ui","title":"Alex & Sam","date":"2027-06-12","venue":"Test Venue","invitationCardStyle":"ivory-floral-gold"},"guest":{"id":"ui-guest-a","name":"UI Guest A","tableName":"Acacia"},"rsvp":{"plusOne":false,"kidsAttending":false,"kidsCount":0,"checkedIn":false}}""")
                    if (secondGuest) json.put("guest", JSONObject("""{"id":"ui-guest-b","name":"UI Guest B","tableName":"Birch"}"""))
                    json.getJSONObject("rsvp").put("attending", attendance ?: JSONObject.NULL)
                    if (request.contains("/api/wedding-day/pass ")) {
                        val fixture = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().context.assets.open("guest-profile-ww2.json").bufferedReader().use { it.readText() }
                        json = JSONObject().put("success", true).put("data", JSONObject(fixture))
                    } else if (request.contains("/api/wedding-day/guest ")) {
                        json = JSONObject("""{"success":true,"data":{"guest":{"id":"ui-guest-a","tableNumber":1,"tableName":"Acacia","checkedIn":false,"household":[{"attendeeKey":"primary","attendeeName":"UI Guest A"}]},"programme":[{"id":"ceremony","time":"14:00","title":"Synthetic ceremony"}],"announcements":[{"id":"welcome","title":"Welcome","body":"Synthetic guest announcement"}]}}""")
                    }
                    val bytes = json.toString().toByteArray()
                    val cookie = if (request.startsWith("POST ")) "Set-Cookie: wewed_wedding_guest=synthetic-ui-session-${if (secondGuest) "b" else "a"}; Path=/; HttpOnly\r\n" else ""
                    socket.getOutputStream().write(("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n${cookie}Content-Length: ${bytes.size}\r\nConnection: close\r\n\r\n").toByteArray()+bytes)
                }
            }
        }
        coordinator = LiveGuestInvitationCoordinator(GuestSessionClient("http://127.0.0.1:${server.localPort}", storage))
    }

    protected fun launch(arrival: Boolean = false) {
        if (arrival) GuestOnlyEntryState.publish("https://wewed.pro/invite/guest-ui?rsvp=synthetic-entry")
        else runBlocking { coordinator.enter(InvitationEntryParser.fromUrl("https://wewed.pro/invite/guest-ui?rsvp=synthetic-entry")!!) }
        compose.setContent { GuestOnlyInvitationShell(coordinator, hasIncomingInvitation = arrival) }
    }
    protected fun waitFor(tag: String) {
        compose.waitUntil(15_000) { compose.onAllNodesWithTag(tag).fetchSemanticsNodes().isNotEmpty() }
    }
    protected fun tap(tag: String) { waitFor(tag); compose.onNodeWithTag(tag).performClick() }
    protected fun openCard() { tap("invitation-open-button"); tap("invitation-details-button") }
    @After fun cleanup() { running = false; server.close(); storage.clear(); GuestOnlyEntryState.reset() }
}

class GuestHomeDigitalInvitationTest : GuestUiTestBase() {
    @Test fun linkThenHomeThenSameInteractiveStationery() {
        launch(arrival = true)
        openCard()
        tap("invitation-continue")
        tap("guest-home-digital-invitation")
        compose.onNodeWithTag("nav-guest-invitation").assertIsSelected()
        waitFor("invitation-open-button")
        tap("invitation-back-to-wedding")
        compose.onNodeWithTag("nav-guest-home").assertIsSelected()
        compose.onNodeWithTag("live-guest-name").assertTextEquals("UI Guest A")
    }
}

class GuestInvitationNavigationTest : GuestUiTestBase() {
    @Test fun secondInvitationReplacesFirstOnSameDevice() {
        launch(); waitFor("live-guest-name")
        compose.onNodeWithTag("live-guest-name").assertTextEquals("UI Guest A")
        compose.runOnIdle { GuestOnlyEntryState.publish("https://wewed.pro/invite/guest-ui?rsvp=second-entry") }
        // A newly received link must take the canonical invitation destination.
        waitFor("live-guest-name")
        compose.waitUntil(15_000) { compose.onAllNodesWithText("UI Guest B").fetchSemanticsNodes().isNotEmpty() }
        tap("guest-home-digital-invitation"); waitFor("invitation-open-button")
        tap("invitation-back-to-wedding")
        compose.onNodeWithTag("live-guest-name").assertTextEquals("UI Guest B")
        compose.onAllNodesWithText("UI Guest A").assertCountEquals(0)
    }

    @Test fun profileAndPassReturnToPreviousDestination() {
        launch()
        tap("nav-guest-more")
        tap("guest-profile-digital-invitation")
        waitFor("invitation-open-button")
        tap("invitation-back-to-wedding")
        compose.onNodeWithTag("nav-guest-more").assertIsSelected()
        tap("nav-guest-pass")
        tap("nav-guest-invitation")
        tap("invitation-back-to-wedding")
        compose.onNodeWithTag("nav-guest-pass").assertIsSelected()
    }
}

class GuestPassEligibilityTest : GuestUiTestBase() {
    @Test fun attendingCardOpensVerifiedServerPassAndWeddingDay() {
        attendance = true
        launch(arrival = true); openCard(); tap("invitation-cta-pass")
        compose.onNodeWithTag("nav-guest-pass").assertIsSelected()
        waitFor("wedding-pass-qr")
        tap("nav-guest-wedding_day")
        waitFor("guest-programme-ceremony")
        compose.onNodeWithTag("guest-programme-ceremony").assertExists()
        compose.onNodeWithTag("guest-announcement-welcome").assertExists()
        compose.onNodeWithTag("guest-day-table").assertExists()
    }

    @Test fun pendingHasNoAdmissionCredential() {
        launch(); tap("nav-guest-pass")
        compose.onNodeWithTag("live-guest-pass-pending").assertExists()
        compose.onNodeWithTag("wedding-pass-qr").assertDoesNotExist()
    }
    @Test fun declinedHasNoAdmissionCredential() {
        attendance = false
        launch(); tap("nav-guest-pass")
        compose.onNodeWithTag("live-guest-pass-declined").assertExists()
        compose.onNodeWithTag("wedding-pass-qr").assertDoesNotExist()
    }
}
