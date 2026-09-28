package pro.wewed.app.ui.invitation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** QRO06 — Add to Calendar uses the wedding's UTC calendar date, like web Ivory's all-day event. */
class WeddingCalendarDayTest {
    @Test fun serverIsoWithFractionalSecondsYieldsItsUtcDate() {
        // 2026-12-24 00:00:00 UTC
        assertEquals(1_798_070_400_000L, weddingCalendarDayUtcMillis("2026-12-24T23:30:00.000Z"))
        assertEquals(1_798_070_400_000L, weddingCalendarDayUtcMillis("2026-12-24T14:00:00Z"))
        assertEquals(1_798_070_400_000L, weddingCalendarDayUtcMillis("2026-12-24"))
    }

    @Test fun unparseableDatesAddNothing() {
        assertNull(weddingCalendarDayUtcMillis(""))
        assertNull(weddingCalendarDayUtcMillis("soon"))
    }
}
