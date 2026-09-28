import Foundation

/// QRO06 — the one parser for a wedding instant as the Guest session serves it.
///
/// The server sends JavaScript ISO strings with fractional seconds (`2026-12-24T14:00:00.000Z`).
/// `ISO8601DateFormatter`'s default options reject the fraction, which silently hid the Home
/// countdown and turned Add to Calendar into a no-op. Legacy naive forms are still accepted.
public enum GuestWeddingInstant {
    public static func parse(_ raw: String?) -> Date? {
        guard let value = raw?.trimmingCharacters(in: .whitespaces), !value.isEmpty else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        if let date = ISO8601DateFormatter().date(from: value) { return date }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        for pattern in ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm", "yyyy-MM-dd"] {
            formatter.dateFormat = pattern
            if let date = formatter.date(from: value) { return date }
        }
        return nil
    }

    /// The wedding's calendar DAY, as web Ivory derives it (the instant's UTC date), expressed as
    /// that day's local midnight — what an all-day calendar event expects.
    public static func calendarDay(_ raw: String?, calendar: Calendar = .current) -> Date? {
        guard let instant = parse(raw) else { return nil }
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let day = utc.dateComponents([.year, .month, .day], from: instant)
        return calendar.date(from: DateComponents(year: day.year, month: day.month, day: day.day))
    }
}
