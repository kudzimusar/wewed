package pro.wewed.app.invitation

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * NATIVE-MOBILE-QRO08 — the Guest-facing RSVP deadline, formatted exactly like the web invitation
 * (`Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })`).
 *
 * The server stores the Planner's chosen date as the last instant of that day in UTC
 * (`YYYY-MM-DDT23:59:59.999Z`), so the calendar date is read in UTC — never the device zone, which
 * would move it a day for Guests east of UTC. A value that is already human text (older fixtures)
 * is returned unchanged rather than guessed at.
 */
object InvitationDeadlineFormat {
    private val formatter: DateTimeFormatter = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.UK)

    fun label(value: String?): String? {
        val raw = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val date = runCatching { Instant.parse(raw).atZone(ZoneOffset.UTC).toLocalDate() }.getOrNull()
            ?: runCatching { LocalDate.parse(raw.take(10)) }.getOrNull()
            ?: return raw
        return formatter.format(date)
    }
}
