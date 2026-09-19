package pro.wewed.app.ui.shared

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * Display helpers. They only reformat recorded values; if a value can't be parsed it is shown as recorded.
 * java.text is used (not java.time) so these work on every supported Android version.
 */
object Formatting {
    private val parsePatterns = listOf("yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm", "yyyy-MM-dd")

    fun parseDate(raw: String?): Date? {
        val value = raw?.trim().orEmpty()
        if (value.isEmpty()) return null
        for (pattern in parsePatterns) {
            val parser = SimpleDateFormat(pattern, Locale.US).apply { isLenient = false }
            val text = if (pattern == "yyyy-MM-dd") value.take(10) else value.take(pattern.replace("'", "").length)
            val parsed = runCatching { parser.parse(text) }.getOrNull()
            if (parsed != null) return parsed
        }
        return null
    }

    private fun hasTime(raw: String): Boolean = raw.trim().length > 10

    /** "Wednesday, 23 December 2026". */
    fun longDate(raw: String?): String {
        val date = parseDate(raw) ?: return raw.orEmpty()
        return SimpleDateFormat("EEEE, d MMMM yyyy", Locale.UK).format(date)
    }

    /** "23 Dec 2026". */
    fun shortDate(raw: String?): String {
        val date = parseDate(raw) ?: return raw.orEmpty()
        return SimpleDateFormat("d MMM yyyy", Locale.UK).format(date)
    }

    /** "Wednesday, 23 December 2026 at 14:00" when a time is recorded. */
    fun dateAndTime(raw: String?): String {
        val value = raw.orEmpty()
        val date = parseDate(value) ?: return value
        val day = SimpleDateFormat("EEEE, d MMMM yyyy", Locale.UK).format(date)
        if (!hasTime(value)) return day
        val time = SimpleDateFormat("HH:mm", Locale.UK).format(date)
        return if (time == "00:00") day else "$day at $time"
    }

    fun time(millis: Long): String = SimpleDateFormat("HH:mm", Locale.UK).format(Date(millis))

    fun dateTime(millis: Long): String = SimpleDateFormat("d MMM yyyy, HH:mm", Locale.UK).format(Date(millis))

    /** ISO day (yyyy-MM-dd) for comparisons. */
    fun isoDay(date: Date): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(date)

    fun todayIso(): String = isoDay(Date())

    fun isoDayPlus(days: Int, from: Date = Date()): String {
        val calendar = Calendar.getInstance().apply { time = from; add(Calendar.DAY_OF_YEAR, days) }
        return isoDay(calendar.time)
    }

    fun money(amount: Double, currency: String): String {
        val number = if (amount == Math.floor(amount)) String.format(Locale.US, "%,.0f", amount) else String.format(Locale.US, "%,.2f", amount)
        return if (currency.equals("USD", ignoreCase = true)) "$$number" else "$number ${currency.uppercase()}"
    }

    /** "photo_video" -> "Photo video". Recorded words are kept; only separators and case change. */
    fun humanize(raw: String?): String {
        val value = raw?.trim().orEmpty().replace('_', ' ').replace(Regex("\\s+"), " ")
        if (value.isEmpty()) return ""
        return value.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.UK) else it.toString() }
    }

    fun lifecycle(raw: String?): String = when (raw?.trim()?.lowercase()) {
        "before", "planning" -> "Planning (before the wedding)"
        "during", "live", "today" -> "Wedding day"
        "after", "completed" -> "After the wedding"
        null, "" -> "Not recorded"
        else -> humanize(raw)
    }

    fun plural(count: Int, singular: String, plural: String = singular + "s"): String =
        "$count ${if (count == 1) singular else plural}"
}
