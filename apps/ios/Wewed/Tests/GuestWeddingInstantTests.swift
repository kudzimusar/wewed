import XCTest
@testable import WewedKit

/// QRO06 — the server's ISO instant (fractional seconds) must parse; it silently did not, hiding the
/// Home countdown and making Add to Calendar a no-op.
final class GuestWeddingInstantTests: XCTestCase {
    func testServerIsoWithFractionalSecondsParses() throws {
        let date = try XCTUnwrap(GuestWeddingInstant.parse("2026-12-24T14:00:00.000Z"))
        XCTAssertEqual(date.timeIntervalSince1970, 1_798_120_800)
    }

    func testPlainIsoAndLegacyFormsStillParse() {
        XCTAssertNotNil(GuestWeddingInstant.parse("2026-12-24T14:00:00Z"))
        XCTAssertNotNil(GuestWeddingInstant.parse("2026-12-24T14:00:00"))
        XCTAssertNotNil(GuestWeddingInstant.parse("2026-12-24"))
        XCTAssertNil(GuestWeddingInstant.parse(""))
        XCTAssertNil(GuestWeddingInstant.parse(nil))
        XCTAssertNil(GuestWeddingInstant.parse("soon"))
    }

    func testInvitationCalendarUsesTheSharedParser() {
        XCTAssertNotNil(LiveGuestInvitationView.weddingInstant("2026-12-24T14:00:00.000Z"))
    }

    func testCalendarDayIsTheUtcDateLikeWebIvory() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Africa/Harare")!
        let day = try XCTUnwrap(GuestWeddingInstant.calendarDay("2026-12-24T23:30:00.000Z", calendar: calendar))
        let parts = calendar.dateComponents([.year, .month, .day, .hour], from: day)
        XCTAssertEqual([parts.year, parts.month, parts.day, parts.hour], [2026, 12, 24, 0])
    }
}
