package pro.wewed.app

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.invitation.InvitationEntry
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.state.AppViewModel

/**
 * QRO02B1 — the workspace root's invitation exchange must not cancel itself.
 *
 * Runtime-proven on the emulator: with the account workspace showing, a warm Guest link reached
 * `RootScreen`'s `LaunchedEffect(pendingInvitationEntry)`, the effect consumed (cleared) its own key,
 * Compose restarted it and cancelled the coroutine after a successful exchange, and the Guest saw
 * "We couldn't reach Wewed". The effect is now keyed on `invitationEntryRevision`, which changes
 * only when a new entry arrives.
 */
class InvitationEntryLifecycleTest {
    private val link = "https://wewed.pro/invite/charity-and-kudzie?rsvp=TOKEN-A"
    private val other = "https://wewed.pro/invite/charity-and-kudzie?rsvp=TOKEN-B"

    private fun viewModel() = AppViewModel.fromEnvironment(NativeDataEnvironment.PRODUCTION, "https://example.test")

    @Test
    fun consumingThePendingEntryDoesNotChangeTheEffectKey() {
        val vm = viewModel()
        vm.handleIncomingUrl(link)
        val key = vm.invitationEntryRevision.value
        assertEquals(InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN-A"), vm.consumePendingInvitationEntry())
        assertEquals("consuming must not restart (cancel) the exchange effect", key, vm.invitationEntryRevision.value)
    }

    @Test
    fun theEntryIsExchangedExactlyOnce() {
        val vm = viewModel()
        vm.handleIncomingUrl(link)
        assertNotNull(vm.consumePendingInvitationEntry())
        assertNull("a re-run of the same effect must find nothing to replay", vm.consumePendingInvitationEntry())
    }

    @Test
    fun aLaterInvitationIsProcessed() {
        val vm = viewModel()
        vm.handleIncomingUrl(link)
        val first = vm.invitationEntryRevision.value
        vm.consumePendingInvitationEntry()
        vm.handleIncomingUrl(other)
        assertTrue(vm.invitationEntryRevision.value > first)
        assertEquals(InvitationEntry.PrivateInvitation("charity-and-kudzie", "TOKEN-B"), vm.consumePendingInvitationEntry())
        val second = vm.invitationEntryRevision.value
        vm.handleIncomingUrl(other)
        assertTrue("the same link opened again is a new arrival", vm.invitationEntryRevision.value > second)
    }

    @Test
    fun rejectedAndForeignLinksNeverStartAnExchange() {
        val vm = viewModel()
        val before = vm.invitationEntryRevision.value
        vm.handleIncomingUrl("https://wewed.pro/invite/charity-and-kudzie")
        vm.handleIncomingUrl("https://evil.example/invite/x?rsvp=T")
        assertEquals(before, vm.invitationEntryRevision.value)
        assertNull(vm.pendingInvitationEntry.value)
    }

    @Test
    fun theRootKeysTheExchangeOnTheRevisionAndInvitationStillOutranksTheWorkspace() {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        var source: String? = null
        while (dir != null && source == null) {
            val candidate = File(dir, "app/src/main/java/pro/wewed/app/ui/RootScreen.kt")
                .takeIf { it.isFile } ?: File(dir, "src/main/java/pro/wewed/app/ui/RootScreen.kt").takeIf { it.isFile }
            source = candidate?.readText()
            dir = dir.parentFile
        }
        val root = requireNotNull(source) { "RootScreen.kt not found" }
        assertTrue(root.contains("LaunchedEffect(invitationEntryRevision)"))
        assertFalse("keying the effect on the entry it clears cancels the exchange", root.contains("LaunchedEffect(pendingInvitationEntry)"))
        assertTrue(root.contains("pendingInvitationEntry != null ||"))
    }
}
