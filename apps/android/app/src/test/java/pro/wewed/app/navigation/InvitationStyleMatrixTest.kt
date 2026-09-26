package pro.wewed.app.navigation

import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.GeneratedInvitationStyles
import pro.wewed.app.models.InvitationAtmosphere
import pro.wewed.app.models.InvitationMotion
import pro.wewed.app.models.InvitationRendererKind
import pro.wewed.app.models.InvitationStyle
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.models.ResolvedInvitationRenderer
import pro.wewed.app.models.rendererFor
import pro.wewed.app.ui.invitation.ivory.IvoryInvitationData
import pro.wewed.app.ui.invitation.ivory.ivoryRsvpActionLabel
import pro.wewed.app.ui.invitation.ivoryRsvpStateFrom

class InvitationStyleMatrixTest {

    /**
     * Registry ground truth. Each style's motion/atmosphere/renderer-kind is the EXACT value the
     * generator emitted (mobile/contracts/generate_invitation_style_contract.py --check enforces
     * palette exactness against the same source; this table enforces the rest of the row). A test
     * that only checked "is this a valid enum value" would pass even if two styles' motions were
     * swapped — that is precisely the gap this table closes.
     */
    private data class ExpectedStyle(
        val wire: String,
        val displayName: String,
        val motion: InvitationMotion,
        val atmosphere: InvitationAtmosphere,
        val rendererKind: InvitationRendererKind
    )

    private val allExpectedStyles = listOf(
        ExpectedStyle("ivory-floral-gold", "Ivory Floral Gold", InvitationMotion.TRI_FOLD, InvitationAtmosphere.CHAMPAGNE_GLOW, InvitationRendererKind.IVORY_CUSTOM),
        ExpectedStyle("midnight", "Midnight Gold", InvitationMotion.GATE_FOLD, InvitationAtmosphere.STARS, InvitationRendererKind.GENERIC_MOTION),
        ExpectedStyle("botanical", "Garden Romance", InvitationMotion.FLORAL_REVEAL, InvitationAtmosphere.PETALS, InvitationRendererKind.GENERIC_MOTION),
        ExpectedStyle("royal-emerald", "Royal Emerald", InvitationMotion.ENVELOPE_LETTER, InvitationAtmosphere.SOFT_BOKEH, InvitationRendererKind.GENERIC_MOTION),
        ExpectedStyle("classic-white", "Classic White", InvitationMotion.BOOK_OPEN, InvitationAtmosphere.MINIMAL, InvitationRendererKind.GENERIC_MOTION),
        ExpectedStyle("blush-romance", "Blush Romance", InvitationMotion.ENVELOPE_LETTER, InvitationAtmosphere.SOFT_BOKEH, InvitationRendererKind.GENERIC_MOTION),
        ExpectedStyle("african-luxe", "African Luxe", InvitationMotion.GATE_FOLD, InvitationAtmosphere.CANDLELIGHT, InvitationRendererKind.GENERIC_MOTION),
        ExpectedStyle("editorial", "Modern Editorial", InvitationMotion.SINGLE_CARD_LIFT, InvitationAtmosphere.MINIMAL, InvitationRendererKind.GENERIC_MOTION),
        ExpectedStyle("black-tie", "Black Tie", InvitationMotion.GATE_FOLD, InvitationAtmosphere.CANDLELIGHT, InvitationRendererKind.GENERIC_MOTION),
        ExpectedStyle("watercolour-garden", "Watercolour Garden", InvitationMotion.FLORAL_REVEAL, InvitationAtmosphere.WATERCOLOUR_BLOOM, InvitationRendererKind.GENERIC_MOTION),
        ExpectedStyle("sunset-terracotta", "Sunset Terracotta", InvitationMotion.SLEEVE_PULL, InvitationAtmosphere.SOFT_BOKEH, InvitationRendererKind.GENERIC_MOTION),
        ExpectedStyle("celestial", "Celestial", InvitationMotion.BOOK_OPEN, InvitationAtmosphere.STARS, InvitationRendererKind.GENERIC_MOTION)
    )

    @Test
    fun allTwelveStylesHaveNativeRenderersAndDistinctDefinitions() {
        assertEquals("Exactly 12 styles expected in matrix", 12, allExpectedStyles.size)

        val renderedStyles = mutableSetOf<InvitationStyle>()

        for (expected in allExpectedStyles) {
            val style = InvitationStyle.fromWire(expected.wire)
            assertNotEquals("Style ${expected.wire} must not resolve to UNKNOWN_STYLE", InvitationStyle.UNKNOWN_STYLE, style)
            assertEquals("Style wire mismatch", expected.wire, style.wire)
            assertEquals("Display name mismatch", expected.displayName, style.displayName)
            assertTrue("Style ${expected.wire} must have native renderer", style.hasNativeRenderer)

            val theme = style.themeDefinition
            assertNotNull("Theme definition must exist for ${expected.wire}", theme)
            assertEquals(expected.wire, theme!!.id)

            // Palette validation: all 6 colors present and valid hex. Exact palette equality
            // against the PWA source is enforced separately by the generator's --check mode.
            assertNotNull(theme.palette)
            assertTrue("Stage color must be valid hex: ${theme.palette.stageHex}", theme.palette.stageHex.matches(Regex("#[0-9a-fA-F]{6}")))
            assertTrue("Paper color must be valid hex: ${theme.palette.paperHex}", theme.palette.paperHex.matches(Regex("#[0-9a-fA-F]{6}")))
            assertTrue("Ink color must be valid hex: ${theme.palette.inkHex}", theme.palette.inkHex.matches(Regex("#[0-9a-fA-F]{6}")))
            assertTrue("Primary color must be valid hex: ${theme.palette.primaryHex}", theme.palette.primaryHex.matches(Regex("#[0-9a-fA-F]{6}")))
            assertTrue("Accent color must be valid hex: ${theme.palette.accentHex}", theme.palette.accentHex.matches(Regex("#[0-9a-fA-F]{6}")))
            assertTrue("Muted color must be valid hex: ${theme.palette.mutedHex}", theme.palette.mutedHex.matches(Regex("#[0-9a-fA-F]{6}")))

            // Exact motion, not "a valid motion": a swap between two styles must fail this test.
            assertEquals("Motion mismatch for ${expected.wire}", expected.motion, style.motion)
            assertEquals("Motion mismatch for ${expected.wire}", expected.motion, theme.motion)

            // Exact atmosphere, not "a valid atmosphere".
            assertEquals("Atmosphere mismatch for ${expected.wire}", expected.atmosphere, style.atmosphere)
            assertEquals("Atmosphere mismatch for ${expected.wire}", expected.atmosphere, theme.atmosphere)

            // Exact renderer classification straight from the generated contract.
            assertEquals("rendererKind mismatch for ${expected.wire}", expected.rendererKind, style.rendererKind)
            assertEquals("rendererKind mismatch for ${expected.wire}", expected.rendererKind, theme.rendererKind)

            // No style substitution: non-ivory styles must NOT be aliased to ivory
            if (expected.wire != "ivory-floral-gold") {
                assertNotEquals("Style ${expected.wire} must not equal IVORY_FLORAL_GOLD", InvitationStyle.IVORY_FLORAL_GOLD, style)
            }

            renderedStyles.add(style)
        }

        assertEquals("All 12 styles must be unique", 12, renderedStyles.size)
    }

    @Test
    fun fallbackResolvesToBotanicalGardenRomance() {
        val fallback = InvitationStyle.DEFAULT
        assertEquals(InvitationStyle.BOTANICAL, fallback)
        assertEquals("botanical", fallback.wire)
        assertEquals("Garden Romance", fallback.displayName)
        assertNotEquals(InvitationStyle.IVORY_FLORAL_GOLD, fallback)

        assertEquals(InvitationStyle.BOTANICAL, InvitationStyle.fromWire(null))
        assertEquals(InvitationStyle.BOTANICAL, InvitationStyle.fromWire(""))
        assertEquals(InvitationStyle.BOTANICAL, InvitationStyle.fromWire("   "))
    }

    @Test
    fun unknownStyleFailsClosedWithoutNativeRenderer() {
        val unknown = InvitationStyle.fromWire("some-nonexistent-style-wire-id")
        assertEquals(InvitationStyle.UNKNOWN_STYLE, unknown)
        assertFalse("UNKNOWN_STYLE must fail closed without native renderer", unknown.hasNativeRenderer)
    }

    @Test
    fun rsvpActionModelIsPreservedAcrossStatusesForAllStyles() {
        for (style in InvitationStyle.entries) {
            if (!style.hasNativeRenderer) continue

            // Pending
            val pendingLabel = ivoryRsvpActionLabel(ivoryRsvpStateFrom(RSVPStatus.PENDING))
            assertEquals("RSVP", pendingLabel)

            // Attending
            val attendingLabel = ivoryRsvpActionLabel(ivoryRsvpStateFrom(RSVPStatus.ATTENDING))
            assertEquals("Update RSVP", attendingLabel)

            // Declined
            val declinedLabel = ivoryRsvpActionLabel(ivoryRsvpStateFrom(RSVPStatus.DECLINED))
            assertEquals("Update RSVP", declinedLabel)
        }
    }

    @Test
    fun rendererForDispatchesCorrectlyAcrossAllStyles() {
        assertEquals(
            ResolvedInvitationRenderer.IVORY_CUSTOM,
            rendererFor(InvitationStyle.IVORY_FLORAL_GOLD)
        )

        for (expected in allExpectedStyles) {
            val style = InvitationStyle.fromWire(expected.wire)
            // Derived from the same registry row as the exact-value assertions above, not a
            // separately hand-written "if wire == ivory..." — a swap in the table would be
            // caught by the motion/atmosphere assertions before it could hide here.
            val expectedRenderer = when (expected.rendererKind) {
                InvitationRendererKind.IVORY_CUSTOM -> ResolvedInvitationRenderer.IVORY_CUSTOM
                InvitationRendererKind.GENERIC_MOTION -> ResolvedInvitationRenderer.GENERIC_MOTION
            }
            assertEquals("Style ${expected.wire} must resolve to $expectedRenderer", expectedRenderer, rendererFor(style))
        }

        assertEquals(
            ResolvedInvitationRenderer.UNSUPPORTED,
            rendererFor(InvitationStyle.UNKNOWN_STYLE)
        )
    }
}
