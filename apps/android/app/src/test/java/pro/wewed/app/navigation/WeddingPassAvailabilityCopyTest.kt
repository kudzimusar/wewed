package pro.wewed.app.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.invitation.WeddingPassAvailabilityCopy
import pro.wewed.app.models.WeddingPassAvailability
import pro.wewed.app.models.WeddingPassAvailabilityState
import java.io.File
import java.util.TimeZone

/** LQR01 — the Pass tab tells a Guest precisely why there is no Wedding Pass right now. */
class WeddingPassAvailabilityCopyTest {
    private val utc = TimeZone.getTimeZone("UTC")

    private fun repositoryFile(path: String): File {
        var dir: File? = File(System.getProperty("user.dir") ?: ".").absoluteFile
        while (dir != null) {
            val candidate = File(dir, path)
            if (candidate.isFile) return candidate
            dir = dir.parentFile
        }
        throw IllegalStateException("Repository file not found: $path")
    }

    private fun availability(state: WeddingPassAvailabilityState, opensAt: String? = null) =
        WeddingPassAvailability(state = state, code = "CODE", opensAt = opensAt)

    @Test
    fun eachStateHasItsOwnCopyAndTag() {
        val expected = mapOf(
            WeddingPassAvailabilityState.NOT_YET_ISSUABLE to "Your Wedding Pass will be available closer to the wedding.",
            WeddingPassAvailabilityState.ISSUANCE_CLOSED to "Wedding Pass issuance has closed for this wedding.",
            WeddingPassAvailabilityState.REVOKED to "This Wedding Pass is no longer valid. Please contact the couple or the wedding team.",
            WeddingPassAvailabilityState.DECLINED to "You declined this invitation, so no Wedding Pass is issued.",
            WeddingPassAvailabilityState.RSVP_REQUIRED to "Confirm your attendance to receive your Wedding Pass."
        )
        for ((state, copy) in expected) {
            assertEquals(copy, WeddingPassAvailabilityCopy.message(availability(state)))
            assertEquals("live-guest-pass-state-${state.wireValue}", WeddingPassAvailabilityCopy.testTag(availability(state)))
        }
        assertEquals(
            listOf("rsvp_required", "declined", "not_yet_issuable", "active", "issuance_closed", "revoked"),
            WeddingPassAvailabilityState.entries.map { it.wireValue }
        )
    }

    @Test
    fun anythingElseKeepsTheGenericUnavailableCopy() {
        val generic = "Your Wedding Pass is unavailable. Please try again later."
        assertEquals(generic, WeddingPassAvailabilityCopy.message(null))
        assertEquals(generic, WeddingPassAvailabilityCopy.message(availability(WeddingPassAvailabilityState.ACTIVE)))
        assertEquals("live-guest-pass-unavailable", WeddingPassAvailabilityCopy.testTag(null))
    }

    @Test
    fun notYetIssuableNamesTheOpeningDateOnlyWhenItParses() {
        assertEquals(
            "Available from 16 December 2026",
            WeddingPassAvailabilityCopy.availableFrom(
                availability(WeddingPassAvailabilityState.NOT_YET_ISSUABLE, "2026-12-16T08:00:00.000Z"),
                utc
            )
        )
        assertEquals(
            "Available from 16 December 2026",
            WeddingPassAvailabilityCopy.availableFrom(
                availability(WeddingPassAvailabilityState.NOT_YET_ISSUABLE, "2026-12-16T08:00:00Z"),
                utc
            )
        )
        assertNull(
            WeddingPassAvailabilityCopy.availableFrom(
                availability(WeddingPassAvailabilityState.NOT_YET_ISSUABLE, "soon"),
                utc
            )
        )
        assertNull(
            WeddingPassAvailabilityCopy.availableFrom(availability(WeddingPassAvailabilityState.NOT_YET_ISSUABLE), utc)
        )
        assertNull(
            WeddingPassAvailabilityCopy.availableFrom(
                availability(WeddingPassAvailabilityState.REVOKED, "2026-12-16T08:00:00.000Z"),
                utc
            )
        )
    }

    /** The issued-pass surface renders the state copy rather than one generic failure line. */
    @Test
    fun thePassTabRendersAvailabilityCopy() {
        val source = repositoryFile(
            "apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestShell.kt"
        ).readText()
        assertTrue(source.contains("GuestSessionError.PassUnavailable"))
        assertTrue(source.contains("WeddingPassAvailabilityCopy.testTag("))
        assertTrue(source.contains("WeddingPassAvailabilityCopy.availableFrom("))
        assertTrue(source.contains("coordinator.weddingPass(profile.guestId)"))
    }
}
