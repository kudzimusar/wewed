package pro.wewed.app.navigation

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.InvitationStyle
import java.io.File

/**
 * The native invitation catalogue must equal the web one.
 *
 * `src/lib/digital-invitation-card.ts` is the registry the website renders from. The invitation is
 * a wedding-configured product object: a wedding saved as one design must render as THAT design.
 *
 * This test exists because it did not. An earlier native build aliased `botanical`, `ivory`,
 * `ivory-floral`, `floral-gold` and an empty value all onto Ivory Floral Gold. `botanical` is
 * Garden Romance — a different palette, a different motif and a different reveal — and it is the
 * design the real UAT wedding is saved with, so every guest of that wedding would have been shown
 * another couple's stationery while the build reported invitation parity.
 *
 * `mobile/contracts/invitation-styles.json` is generated from the web registry. iOS asserts the
 * same contract, so the three cannot diverge silently.
 */
class InvitationStyleContractTest {

    private val contract: JSONObject by lazy { JSONObject(contractFile().readText()) }

    private fun contractFile(): File {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            val candidate = File(dir, "mobile/contracts/invitation-styles.json")
            if (candidate.isFile) return candidate
            dir = dir.parentFile
        }
        throw IllegalStateException("Shared invitation style contract not found")
    }

    private val webStyles: List<JSONObject>
        get() = contract.getJSONArray("styles").let { array ->
            (0 until array.length()).map { array.getJSONObject(it) }
        }

    /** Every style the website offers is a style native can at least NAME. */
    @Test
    fun everyWebStyleHasANativeIdentity() {
        val native = InvitationStyle.entries.map { it.wire }.toSet()
        webStyles.forEach { style ->
            assertTrue(
                "Web style '${style.getString("id")}' has no native identity",
                native.contains(style.getString("id"))
            )
        }
    }

    /** And native invents none of its own beyond the explicit unknown sentinel. */
    @Test
    fun nativeInventsNoStyleTheWebDoesNotHave() {
        val web = webStyles.map { it.getString("id") }.toSet()
        InvitationStyle.entries
            .filter { it != InvitationStyle.UNKNOWN_STYLE }
            .forEach {
                assertTrue("Native style '${it.wire}' is not in the web registry", web.contains(it.wire))
            }
    }

    /** Order matters only for display, but names must match exactly: they are shown to guests. */
    @Test
    fun displayNamesMatchTheWebRegistry() {
        webStyles.forEach { style ->
            val native = InvitationStyle.fromWire(style.getString("id"))
            assertEquals(style.getString("name"), native.displayName)
        }
    }

    /**
     * A renderer claim is a claim of exact reproduction. Exactly one design carries it today, and
     * the contract — not the app — is where that is recorded.
     */
    @Test
    fun rendererClaimsMatchTheContract() {
        webStyles.forEach { style ->
            val native = InvitationStyle.fromWire(style.getString("id"))
            assertEquals(
                "Renderer claim for '${style.getString("id")}'",
                style.getBoolean("nativeRenderer"),
                native.hasNativeRenderer
            )
        }
        assertEquals(
            listOf(InvitationStyle.IVORY_FLORAL_GOLD),
            InvitationStyle.entries.filter { it.hasNativeRenderer }
        )
    }

    /** The regression itself: Garden Romance is not Ivory Floral Gold. */
    @Test
    fun botanicalIsNotAliasedToIvoryFloralGold() {
        val botanical = InvitationStyle.fromWire("botanical")
        assertEquals(InvitationStyle.BOTANICAL, botanical)
        assertNotEquals(InvitationStyle.IVORY_FLORAL_GOLD, botanical)
        assertFalse(botanical.hasNativeRenderer)
    }

    /** An absent value resolves the way the server resolves it, not to whatever native can draw. */
    @Test
    fun missingStyleResolvesToTheServerFallback() {
        val fallback = contract.getString("fallbackStyleId")
        assertEquals(InvitationStyle.fromWire(fallback), InvitationStyle.DEFAULT)
        assertEquals(InvitationStyle.DEFAULT, InvitationStyle.fromWire(null))
        assertEquals(InvitationStyle.DEFAULT, InvitationStyle.fromWire("   "))
        assertNotEquals(
            "The fallback must not be whichever style native happens to render",
            InvitationStyle.IVORY_FLORAL_GOLD,
            InvitationStyle.DEFAULT
        )
    }

    /** A style id this build has never heard of is named as unknown, never silently substituted. */
    @Test
    fun unrecognisedStyleIsNotSubstituted() {
        val unknown = InvitationStyle.fromWire("hand-lettered-vellum")
        assertEquals(InvitationStyle.UNKNOWN_STYLE, unknown)
        assertFalse(unknown.hasNativeRenderer)
    }

    /** Casing and underscores travel through older links; the design must not change because of it. */
    @Test
    fun wireValuesAreNormalisedWithoutChangingTheDesign() {
        assertEquals(InvitationStyle.IVORY_FLORAL_GOLD, InvitationStyle.fromWire("Ivory-Floral-Gold"))
        assertEquals(InvitationStyle.IVORY_FLORAL_GOLD, InvitationStyle.fromWire("ivory_floral_gold"))
        assertEquals(InvitationStyle.ROYAL_EMERALD, InvitationStyle.fromWire(" royal_emerald "))
    }
}
