package pro.wewed.app

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.models.InvitationStyle
import pro.wewed.app.models.ResolvedInvitationRenderer
import pro.wewed.app.models.rendererFor

/**
 * INV-CANON01 — the approved Wewed digital invitation is `ivory-floral-gold`, rendered only by
 * IvoryFloralGoldNative. A change that routes it into GenericMotion must fail here.
 */
class CanonicalInvitationDispatchTest {
    @Test
    fun theCanonicalStyleResolvesToTheDedicatedIvoryRenderer() {
        assertEquals(InvitationStyle.IVORY_FLORAL_GOLD, InvitationStyle.fromWire("ivory-floral-gold"))
        assertEquals(ResolvedInvitationRenderer.IVORY_CUSTOM, rendererFor(InvitationStyle.IVORY_FLORAL_GOLD))
        assertNotEquals(ResolvedInvitationRenderer.GENERIC_MOTION, rendererFor(InvitationStyle.IVORY_FLORAL_GOLD))
    }

    @Test
    fun theDispatcherSendsIvoryToIvoryFloralGoldNativeAndNeverGenericMotion() {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        var source: String? = null
        while (dir != null && source == null) {
            source = listOf(
                "app/src/main/java/pro/wewed/app/ui/invitation/NativeInvitationExperience.kt",
                "src/main/java/pro/wewed/app/ui/invitation/NativeInvitationExperience.kt",
            ).map { File(dir, it) }.firstOrNull { it.isFile }?.readText()
            dir = dir.parentFile
        }
        val text = requireNotNull(source) { "NativeInvitationExperience.kt not found" }
        val start = text.indexOf("ResolvedInvitationRenderer.IVORY_CUSTOM ->")
        val end = text.indexOf("ResolvedInvitationRenderer.GENERIC_MOTION ->", start)
        assertTrue(start >= 0 && end > start)
        val ivoryBranch = text.substring(start, end)
        assertTrue(ivoryBranch.contains("IvoryFloralGoldNative("))
        assertFalse("the canonical invitation must never render through GenericMotion", ivoryBranch.contains("GenericMotion"))
    }
}
