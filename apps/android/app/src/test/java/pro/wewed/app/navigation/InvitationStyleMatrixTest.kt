package pro.wewed.app.navigation

import org.junit.Assert.*
import org.junit.Test
import pro.wewed.app.models.GeneratedInvitationStyles
import pro.wewed.app.models.InvitationAtmosphere
import pro.wewed.app.models.InvitationMotion
import pro.wewed.app.models.InvitationStyle
import pro.wewed.app.models.RSVPStatus
import pro.wewed.app.ui.invitation.ivory.IvoryInvitationData
import pro.wewed.app.ui.invitation.ivory.ivoryRsvpActionLabel
import pro.wewed.app.ui.invitation.ivoryRsvpStateFrom

class InvitationStyleMatrixTest {

    private val allExpectedStyles = listOf(
        "ivory-floral-gold" to "Ivory Floral Gold",
        "midnight" to "Midnight Gold",
        "botanical" to "Garden Romance",
        "royal-emerald" to "Royal Emerald",
        "classic-white" to "Classic White",
        "blush-romance" to "Blush Romance",
        "african-luxe" to "African Luxe",
        "editorial" to "Modern Editorial",
        "black-tie" to "Black Tie",
        "watercolour-garden" to "Watercolour Garden",
        "sunset-terracotta" to "Sunset Terracotta",
        "celestial" to "Celestial"
    )

    @Test
    fun allTwelveStylesHaveNativeRenderersAndDistinctDefinitions() {
        assertEquals("Exactly 12 styles expected in matrix", 12, allExpectedStyles.size)

        val renderedStyles = mutableSetOf<InvitationStyle>()

        for ((wire, displayName) in allExpectedStyles) {
            val style = InvitationStyle.fromWire(wire)
            assertNotEquals("Style $wire must not resolve to UNKNOWN_STYLE", InvitationStyle.UNKNOWN_STYLE, style)
            assertEquals("Style wire mismatch", wire, style.wire)
            assertEquals("Display name mismatch", displayName, style.displayName)
            assertTrue("Style $wire must have native renderer", style.hasNativeRenderer)

            val theme = style.themeDefinition
            assertNotNull("Theme definition must exist for $wire", theme)
            assertEquals(wire, theme!!.id)

            // Palette validation: all 6 colors present and valid hex
            assertNotNull(theme.palette)
            assertTrue("Stage color must be valid hex: ${theme.palette.stageHex}", theme.palette.stageHex.matches(Regex("#[0-9a-fA-F]{6}")))
            assertTrue("Paper color must be valid hex: ${theme.palette.paperHex}", theme.palette.paperHex.matches(Regex("#[0-9a-fA-F]{6}")))
            assertTrue("Ink color must be valid hex: ${theme.palette.inkHex}", theme.palette.inkHex.matches(Regex("#[0-9a-fA-F]{6}")))
            assertTrue("Primary color must be valid hex: ${theme.palette.primaryHex}", theme.palette.primaryHex.matches(Regex("#[0-9a-fA-F]{6}")))
            assertTrue("Accent color must be valid hex: ${theme.palette.accentHex}", theme.palette.accentHex.matches(Regex("#[0-9a-fA-F]{6}")))
            assertTrue("Muted color must be valid hex: ${theme.palette.mutedHex}", theme.palette.mutedHex.matches(Regex("#[0-9a-fA-F]{6}")))

            // Motion preset validation
            assertNotNull("Motion preset must not be null for $wire", style.motion)
            assertTrue("Motion preset must be one of defined presets",
                style.motion in setOf(
                    InvitationMotion.TRI_FOLD,
                    InvitationMotion.GATE_FOLD,
                    InvitationMotion.ENVELOPE_LETTER,
                    InvitationMotion.BOOK_OPEN,
                    InvitationMotion.SINGLE_CARD_LIFT,
                    InvitationMotion.FLORAL_REVEAL,
                    InvitationMotion.SLEEVE_PULL
                )
            )

            // Atmosphere preset validation
            assertNotNull("Atmosphere preset must not be null for $wire", style.atmosphere)
            assertTrue("Atmosphere preset must be one of defined atmospheres",
                style.atmosphere in setOf(
                    InvitationAtmosphere.CHAMPAGNE_GLOW,
                    InvitationAtmosphere.SOFT_BOKEH,
                    InvitationAtmosphere.PETALS,
                    InvitationAtmosphere.CANDLELIGHT,
                    InvitationAtmosphere.STARS,
                    InvitationAtmosphere.WATERCOLOUR_BLOOM,
                    InvitationAtmosphere.MINIMAL
                )
            )

            // No style substitution: non-ivory styles must NOT be aliased to ivory
            if (wire != "ivory-floral-gold") {
                assertNotEquals("Style $wire must not equal IVORY_FLORAL_GOLD", InvitationStyle.IVORY_FLORAL_GOLD, style)
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
            pro.wewed.app.models.ResolvedInvitationRenderer.IVORY_CUSTOM,
            pro.wewed.app.models.rendererFor(InvitationStyle.IVORY_FLORAL_GOLD)
        )

        for ((wire, _) in allExpectedStyles) {
            val style = InvitationStyle.fromWire(wire)
            val expectedRenderer = if (wire == "ivory-floral-gold") {
                pro.wewed.app.models.ResolvedInvitationRenderer.IVORY_CUSTOM
            } else {
                pro.wewed.app.models.ResolvedInvitationRenderer.GENERIC_MOTION
            }
            assertEquals("Style $wire must resolve to $expectedRenderer", expectedRenderer, pro.wewed.app.models.rendererFor(style))
        }

        assertEquals(
            pro.wewed.app.models.ResolvedInvitationRenderer.UNSUPPORTED,
            pro.wewed.app.models.rendererFor(InvitationStyle.UNKNOWN_STYLE)
        )
    }
}
