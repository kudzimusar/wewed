package pro.wewed.app.services

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import pro.wewed.app.models.*
import java.util.UUID

/**
 * Production-derived reference implementation for the
 * Charity & Kudzie / Eleven Eleven Testing shadow scenario.
 *
 * Gate credentials are development-only placeholders and do not replace
 * canonical WW2 ECDSA verification.
 */
class ShadowReferenceWeddingRepository : WeddingRepository {
    private val mutex = Mutex()

    override suspend fun availableWeddingIds(): List<String> = listOf(wedding.id)

    /** Rejects a request for any wedding this source does not hold (P0-1). */
    private fun requireScope(weddingId: String) {
        if (weddingId != wedding.id) {
            throw WeddingScopeMismatch(weddingId, listOf(wedding.id))
        }
    }
    private val primaryPassSerial = "SHDWGSTA01"
    private val attendingToken = "shadow-attending-guest"
    private val pendingToken = "shadow-pending-guest"
    private val declinedToken = "shadow-declined-guest"
    private val partyFourToken = "shadow-party4-guest"

    private val wedding = Wedding(
        id = "shadow_ref_charity_kudzie",
        coupleNames = "Charity & Kudzie",
        date = "2026-12-23 14:00:00",
        venueName = "Imba Manor",
        venueAddress = "Imba Manor, Harare",
        city = "Harare",
        country = "Zimbabwe",
        lifecycle = "before",
        programme = listOf(
            ProgrammeItem("shadow_prog_01", "Ceremony Begins", "14:00", "Imba Manor", "The wedding ceremony under the African sky"),
            ProgrammeItem("shadow_prog_02", "Guest Arrival", "13:00", "Imba Manor", "Welcome drinks and canapés at Imba Manor gardens"),
            ProgrammeItem("shadow_prog_03", "Confetti & Congratulations", "14:45", "Imba Manor", "Rice toss and family photos on the Manor steps"),
            ProgrammeItem("shadow_prog_04", "Cocktail Hour", "15:30", "Imba Manor", "Signature cocktails, lawn games and live jazz"),
            ProgrammeItem("shadow_prog_05", "Reception Entrance", "16:30", "Imba Manor", "Mr & Mrs Musarurwa make their grand entrance"),
            ProgrammeItem("shadow_prog_06", "First Dance", "17:00", "Imba Manor", "Charity & Kudzie take the floor for the first time as one"),
            ProgrammeItem("shadow_prog_07", "Dinner is Served", "17:30", "Imba Manor", "A feast celebrating Zimbabwean flavours and global cuisine"),
            ProgrammeItem("shadow_prog_08", "Speeches & Toasts", "18:30", "Imba Manor", "Words from the best man, maid of honour, and family"),
            ProgrammeItem("shadow_prog_09", "Cake Cutting", "19:30", "Imba Manor", "The couple cuts the cake — a sweet new beginning"),
            ProgrammeItem("shadow_prog_10", "UAT-TIMELINE-001 Vendor access and setup", "11:45", "Imba Manor service entrance", "Confirm Imba Manor access, loading point, and setup handover"),
            ProgrammeItem("shadow_prog_11", "Dance Floor Opens", "20:00", "Imba Manor", "DJ spins the night away — from Sungura to pop anthems"),
            ProgrammeItem("shadow_prog_12", "Last Dance", "22:00", "Imba Manor", "One final dance under the stars before the night ends"),
            ProgrammeItem("shadow_prog_13", "Sparkler Send-Off", "22:30", "Imba Manor", "Guests light the way as Charity & Kudzie depart"),
        )
    )

    private val tasks = mutableListOf(
        PlannerTask("shadow_task_01", "Book Imba Manor", TaskStatus.DONE, TaskPriority.HIGH, "venue", null),
        PlannerTask("shadow_task_02", "Confirm ceremony garden", TaskStatus.DONE, TaskPriority.HIGH, "venue", null),
        PlannerTask("shadow_task_03", "Pay venue deposit", TaskStatus.DONE, TaskPriority.HIGH, "venue", null),
        PlannerTask("shadow_task_04", "Book DJ", TaskStatus.DONE, TaskPriority.HIGH, "music", null),
        PlannerTask("shadow_task_05", "Confirm first dance song", TaskStatus.DONE, TaskPriority.LOW, "music", null),
        PlannerTask("shadow_task_06", "Confirm reception hall", TaskStatus.DONE, TaskPriority.MEDIUM, "venue", null),
        PlannerTask("shadow_task_07", "Order wedding cake", TaskStatus.DONE, TaskPriority.MEDIUM, "catering", null),
        PlannerTask("shadow_task_08", "Book caterer", TaskStatus.IN_PROGRESS, TaskPriority.HIGH, "catering", null),
        PlannerTask("shadow_task_09", "Print place cards", TaskStatus.IN_PROGRESS, TaskPriority.LOW, "stationery", null),
        PlannerTask("shadow_task_10", "UAT-TASK-001 Confirm florist arrival", TaskStatus.IN_PROGRESS, TaskPriority.LOW, "wedding_day", "2026-12-22 00:00:00"),
        PlannerTask("shadow_task_11", "Choose menu", TaskStatus.TODO, TaskPriority.HIGH, "catering", null),
        PlannerTask("shadow_task_12", "Confirm meal counts (beef/chicken/veg/traditional)", TaskStatus.TODO, TaskPriority.HIGH, "catering", null),
        PlannerTask("shadow_task_13", "Groom suit fitting", TaskStatus.TODO, TaskPriority.HIGH, "attire", null),
        PlannerTask("shadow_task_14", "Bride dress fitting", TaskStatus.TODO, TaskPriority.HIGH, "attire", "2026-12-22 00:00:00"),
        PlannerTask("shadow_task_15", "Book photographer", TaskStatus.TODO, TaskPriority.HIGH, "photo_video", null),
        PlannerTask("shadow_task_16", "Book videographer", TaskStatus.TODO, TaskPriority.HIGH, "photo_video", null),
        PlannerTask("shadow_task_17", "Marriage license", TaskStatus.TODO, TaskPriority.HIGH, "timeline_2wk", "2026-12-17 00:00:00"),
        PlannerTask("shadow_task_18", "UAT-NOTIF-PLANNER-001 Florist arrival check", TaskStatus.TODO, TaskPriority.HIGH, "wedding_day", "2026-08-22 00:00:00"),
        PlannerTask("shadow_task_19", "Flower girl dress", TaskStatus.TODO, TaskPriority.LOW, "attire", null),
        PlannerTask("shadow_task_20", "Ring bearer outfit", TaskStatus.TODO, TaskPriority.LOW, "attire", null),
        PlannerTask("shadow_task_21", "Confirm airport pickups for VIPs", TaskStatus.TODO, TaskPriority.LOW, "transport", null),
        PlannerTask("shadow_task_22", "Order thank you cards", TaskStatus.TODO, TaskPriority.LOW, "stationery", null),
        PlannerTask("shadow_task_23", "Lighting", TaskStatus.TODO, TaskPriority.LOW, "decor", null),
        PlannerTask("shadow_task_24", "Pre-wedding shoot", TaskStatus.TODO, TaskPriority.LOW, "photo_video", null),
        PlannerTask("shadow_task_25", "Bridal shower", TaskStatus.TODO, TaskPriority.LOW, "other", null),
        PlannerTask("shadow_task_26", "Stag night", TaskStatus.TODO, TaskPriority.LOW, "other", null),
        PlannerTask("shadow_task_27", "Change name documents", TaskStatus.TODO, TaskPriority.LOW, "other", null),
        PlannerTask("shadow_task_28", "Follow up contribution from Mazvita Duwa", TaskStatus.TODO, TaskPriority.MEDIUM, "other", null),
        PlannerTask("shadow_task_29", "Bridesmaids dresses", TaskStatus.TODO, TaskPriority.MEDIUM, "attire", null),
        PlannerTask("shadow_task_30", "Groomsmen suits", TaskStatus.TODO, TaskPriority.MEDIUM, "attire", null),
        PlannerTask("shadow_task_31", "Confirm traditional foods", TaskStatus.TODO, TaskPriority.MEDIUM, "magumo", null),
        PlannerTask("shadow_task_32", "Book shuttle for guests", TaskStatus.TODO, TaskPriority.MEDIUM, "transport", null),
        PlannerTask("shadow_task_33", "Arrange bridal car", TaskStatus.TODO, TaskPriority.MEDIUM, "transport", null),
        PlannerTask("shadow_task_34", "Order invitations", TaskStatus.TODO, TaskPriority.MEDIUM, "stationery", null),
        PlannerTask("shadow_task_35", "Design programme", TaskStatus.TODO, TaskPriority.MEDIUM, "stationery", null),
        PlannerTask("shadow_task_36", "Book florist", TaskStatus.TODO, TaskPriority.MEDIUM, "decor", null),
        PlannerTask("shadow_task_37", "Confirm ceremony arch", TaskStatus.TODO, TaskPriority.MEDIUM, "decor", null),
        PlannerTask("shadow_task_38", "Reception centerpieces", TaskStatus.TODO, TaskPriority.MEDIUM, "decor", null),
        PlannerTask("shadow_task_39", "Confirm shot list", TaskStatus.TODO, TaskPriority.MEDIUM, "photo_video", null),
        PlannerTask("shadow_task_40", "Confirm ceremony music", TaskStatus.TODO, TaskPriority.MEDIUM, "music", null),
        PlannerTask("shadow_task_41", "Sound system for ceremony", TaskStatus.TODO, TaskPriority.MEDIUM, "music", null),
        PlannerTask("shadow_task_42", "Honeymoon booking", TaskStatus.TODO, TaskPriority.MEDIUM, "other", null),
    )

    private val guests = mutableListOf(
        Guest("shadow_guest_001", "Guest G001", null, 1, "family", RSVPStatus.PENDING, null, "Table 5 — Friends", false, 0, null),
        Guest("shadow_guest_002", "Guest G002", null, 1, "family", RSVPStatus.PENDING, null, "Table 1 — Family", false, 0, null),
        Guest("shadow_guest_003", "Guest G003", null, 1, "groom", RSVPStatus.PENDING, null, "Table 3 — Bridal Party", false, 0, null),
        Guest("shadow_guest_004", "Guest G004", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_005", "Guest G005", null, 1, "groom", RSVPStatus.PENDING, null, "Table 2 — Family", false, 0, null),
        Guest("shadow_guest_006", "Guest G006", null, 1, "family", RSVPStatus.PENDING, null, "Table 1 — Family", false, 0, null),
        Guest("shadow_guest_007", "Guest G007", null, 4, "Couple", RSVPStatus.ATTENDING, null, null, true, 1, "SHDWGSTP04"),
        Guest("shadow_guest_008", "Guest G008", null, 1, "groom", RSVPStatus.PENDING, null, "Table 3 — Bridal Party", false, 0, null),
        Guest("shadow_guest_009", "Guest G009", null, 1, "bride", RSVPStatus.PENDING, null, "Table 6 — Friends", false, 0, null),
        Guest("shadow_guest_010", "Guest G010", null, 1, "groom", RSVPStatus.PENDING, null, "Table 1 — Family", false, 0, null),
        Guest("shadow_guest_011", "Guest G011", null, 1, "groom", RSVPStatus.ATTENDING, null, "Table 1 — Family", false, 0, "SHDWGSTA01"),
        Guest("shadow_guest_012", "Guest G012", null, 1, "neutral", RSVPStatus.PENDING, null, "Table 7 — Colleagues", false, 0, null),
        Guest("shadow_guest_013", "Guest G013", null, 1, "groom", RSVPStatus.PENDING, null, "Table 3 — Bridal Party", false, 0, null),
        Guest("shadow_guest_014", "Guest G014", null, 1, "groom", RSVPStatus.PENDING, null, "Table 5 — Friends", false, 0, null),
        Guest("shadow_guest_015", "Guest G015", null, 1, "groom", RSVPStatus.PENDING, null, "Table 3 — Bridal Party", false, 0, null),
        Guest("shadow_guest_016", "Guest G016", null, 1, "groom", RSVPStatus.PENDING, null, "Table 7 — Colleagues", false, 0, null),
        Guest("shadow_guest_017", "Guest G017", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_018", "Guest G018", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_019", "Guest G019", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_020", "Guest G020", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_021", "Guest G021", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_022", "Guest G022", null, 1, "neutral", RSVPStatus.PENDING, null, "Table 2 — Family", false, 0, null),
        Guest("shadow_guest_023", "Guest G023", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_024", "Guest G024", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_025", "Guest G025", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_026", "Guest G026", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_027", "Guest G027", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_028", "Guest G028", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_029", "Guest G029", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_030", "Guest G030", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_031", "Guest G031", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_032", "Guest G032", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_033", "Guest G033", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_034", "Guest G034", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_035", "Guest G035", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_036", "Guest G036", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_037", "Guest G037", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_038", "Guest G038", null, 1, "neutral", RSVPStatus.PENDING, null, "Table 3 — Bridal Party", false, 0, null),
        Guest("shadow_guest_039", "Guest G039", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_040", "Guest G040", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_041", "Guest G041", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_042", "Guest G042", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_043", "Guest G043", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_044", "Guest G044", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_045", "Guest G045", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_046", "Guest G046", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_047", "Guest G047", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_048", "Guest G048", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_049", "Guest G049", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_050", "Guest G050", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_051", "Guest G051", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_052", "Guest G052", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_053", "Guest G053", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_054", "Guest G054", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_055", "Guest G055", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_056", "Guest G056", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_057", "Guest G057", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_058", "Guest G058", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_059", "Guest G059", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_060", "Guest G060", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_061", "Guest G061", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_062", "Guest G062", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_063", "Guest G063", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_064", "Guest G064", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_065", "Guest G065", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_066", "Guest G066", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_067", "Guest G067", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_068", "Guest G068", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_069", "Guest G069", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_070", "Guest G070", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_071", "Guest G071", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_072", "Guest G072", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_073", "Guest G073", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_074", "Guest G074", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_075", "Guest G075", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_076", "Guest G076", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_077", "Guest G077", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_078", "Guest G078", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_079", "Guest G079", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_080", "Guest G080", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_081", "Guest G081", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_082", "Guest G082", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_083", "Guest G083", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_084", "Guest G084", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_085", "Guest G085", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_086", "Guest G086", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_087", "Guest G087", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_088", "Guest G088", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_089", "Guest G089", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_090", "Guest G090", null, 1, "neutral", RSVPStatus.PENDING, null, "Table 8 — VIPs", false, 0, null),
        Guest("shadow_guest_091", "Guest G091", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_092", "Guest G092", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_093", "Guest G093", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_094", "Guest G094", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_095", "Guest G095", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_096", "Guest G096", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_097", "Guest G097", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_098", "Guest G098", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_099", "Guest G099", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_100", "Guest G100", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_101", "Guest G101", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_102", "Guest G102", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_103", "Guest G103", null, 1, "groom", RSVPStatus.PENDING, null, "Table 1 — Family", false, 0, null),
        Guest("shadow_guest_104", "Guest G104", null, 1, "groom", RSVPStatus.PENDING, null, "Table 1 — Family", false, 0, null),
        Guest("shadow_guest_105", "Guest G105", null, 1, "groom", RSVPStatus.PENDING, null, "Table 1 — Family", false, 0, null),
        Guest("shadow_guest_106", "Guest G106", null, 1, "groom", RSVPStatus.PENDING, null, "Table 2 — Family", false, 0, null),
        Guest("shadow_guest_107", "Guest G107", null, 1, "groom", RSVPStatus.PENDING, null, "Table 2 — Family", false, 0, null),
        Guest("shadow_guest_108", "Guest G108", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_109", "Guest G109", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_110", "Guest G110", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_111", "Guest G111", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_112", "Guest G112", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_113", "Guest G113", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_114", "Guest G114", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_115", "Guest G115", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_116", "Guest G116", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_117", "Guest G117", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_118", "Guest G118", null, 1, "family", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_119", "Guest G119", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_120", "Guest G120", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_121", "Guest G121", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_122", "Guest G122", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_123", "Guest G123", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_124", "Guest G124", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_125", "Guest G125", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_126", "Guest G126", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_127", "Guest G127", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_128", "Guest G128", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_129", "Guest G129", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_130", "Guest G130", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_131", "Guest G131", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_132", "Guest G132", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_133", "Guest G133", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_134", "Guest G134", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_135", "Guest G135", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_136", "Guest G136", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_137", "Guest G137", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_138", "Guest G138", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_139", "Guest G139", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_140", "Guest G140", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_141", "Guest G141", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_142", "Guest G142", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_143", "Guest G143", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_144", "Guest G144", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_145", "Guest G145", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_146", "Guest G146", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_147", "Guest G147", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_148", "Guest G148", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_149", "Guest G149", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_150", "Guest G150", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_151", "Guest G151", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_152", "Guest G152", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_153", "Guest G153", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_154", "Guest G154", null, 1, "neutral", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_155", "Guest G155", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_156", "Guest G156", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_157", "Guest G157", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_158", "Guest G158", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_159", "Guest G159", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_160", "Guest G160", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_161", "Guest G161", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_162", "Guest G162", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_163", "Guest G163", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_164", "Guest G164", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_165", "Guest G165", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_166", "Guest G166", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_167", "Guest G167", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_168", "Guest G168", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_169", "Guest G169", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_170", "Guest G170", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_171", "Guest G171", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_172", "Guest G172", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_173", "Guest G173", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
        Guest("shadow_guest_174", "Guest G174", null, 1, "groom", RSVPStatus.PENDING, null, null, false, 0, null),
    )

    private val budget = BudgetSummary(
        currency = "USD",
        totalBudget = 30380.0,
        totalAllocated = 8690.0,
        totalPaid = 3875.0,
        categories = listOf(
            BudgetCategory("Attire", 6000.0, 1210.0),
            BudgetCategory("Catering", 6600.0, 1850.0),
            BudgetCategory("Decor", 4100.0, 300.0),
            BudgetCategory("Miscellaneous", 2320.0, 1020.0),
            BudgetCategory("Music", 1500.0, 230.0),
            BudgetCategory("Photo & Video", 3200.0, 500.0),
            BudgetCategory("Stationery", 700.0, 120.0),
            BudgetCategory("Transport", 900.0, 500.0),
            BudgetCategory("Venue", 5060.0, 2960.0)
        )
    )

    private val vendors = mutableListOf(
        VendorPresence("shadow_vnd_01", "Cake Gourmet", "caterer", "Imba Manor", VendorPresenceState.NOT_RECORDED, "Not recorded"),
        VendorPresence("shadow_vnd_02", "MC Aloe The Avangelist", "dj", "Imba Manor", VendorPresenceState.NOT_RECORDED, "Not recorded"),
        VendorPresence("shadow_vnd_03", "The Glass Petal Atelier", "florist", "Imba Manor", VendorPresenceState.NOT_RECORDED, "Not recorded"),
        VendorPresence("shadow_vnd_04", "Makeup Artist", "other", "Imba Manor", VendorPresenceState.NOT_RECORDED, "Not recorded"),
        VendorPresence("shadow_vnd_05", "TBD", "other", "Imba Manor", VendorPresenceState.NOT_RECORDED, "Not recorded"),
        VendorPresence("shadow_vnd_06", "FAUME MEDIA", "photographer", "Imba Manor", VendorPresenceState.NOT_RECORDED, "Not recorded"),
        VendorPresence("shadow_vnd_07", "Imba Manor", "venue", "Imba Manor", VendorPresenceState.NOT_RECORDED, "Not recorded"),
    )

    private val announcements = mutableListOf(
        WeddingAnnouncement("shadow_ann_1", "Authentic Shadow Environment", "Production-derived Charity & Kudzie wedding graph with 42 tasks, 22 budget items, and 174 guests.", AnnouncementUrgency.INFO),
        WeddingAnnouncement("shadow_ann_2", "Invitation Flow Ready", "The Ivory Floral Gold invitation supports individual and party-of-4 admission.", AnnouncementUrgency.INFO)
    )

    private val auditRecords = mutableListOf<CheckInAuditRecord>()

    override suspend fun getWedding(weddingId: String): Wedding = mutex.withLock {
        requireScope(weddingId)
        wedding }
    override suspend fun getTasks(weddingId: String): List<PlannerTask> = mutex.withLock {
        requireScope(weddingId)
        tasks.toList() }
    override suspend fun getGuests(weddingId: String): List<Guest> = mutex.withLock {
        requireScope(weddingId)
        guests.toList() }
    override suspend fun getBudget(weddingId: String): BudgetSummary = mutex.withLock {
        requireScope(weddingId)
        budget }
    override suspend fun getAuditRecords(weddingId: String): List<CheckInAuditRecord> = mutex.withLock {
        requireScope(weddingId)
        auditRecords.toList() }
    override suspend fun getVendors(weddingId: String): List<VendorPresence> = mutex.withLock {
        requireScope(weddingId)
        vendors.toList() }
    override suspend fun getAnnouncements(weddingId: String): List<WeddingAnnouncement> = mutex.withLock {
        requireScope(weddingId)
        announcements.toList() }

    override suspend fun createTask(weddingId: String, title: String, priority: TaskPriority, category: String): PlannerTask = mutex.withLock {
        requireScope(weddingId)
        val task = PlannerTask(
            id = "shadow_task_${UUID.randomUUID().toString().take(8)}",
            title = title,
            status = TaskStatus.TODO,
            priority = priority,
            category = category
        )
        tasks.add(task)
        task
    }

    override suspend fun toggleTask(weddingId: String, taskId: String): PlannerTask = mutex.withLock {
        requireScope(weddingId)
        val index = tasks.indexOfFirst { it.id == taskId }
        if (index == -1) error("Task not found")
        val current = tasks[index]
        val updated = current.copy(
            status = if (current.status == TaskStatus.DONE) TaskStatus.TODO else TaskStatus.DONE
        )
        tasks[index] = updated
        updated
    }

    override suspend fun getWeddingPass(token: String): WeddingPass = mutex.withLock {
        val guest = guestForToken(token)
        if (guest.rsvpStatus != RSVPStatus.ATTENDING) {
            error("Wedding Pass is available only to attending guests in Shadow.")
        }
        makePass(guest)
    }

    override suspend fun searchGuests(weddingId: String, query: String): List<Guest> = mutex.withLock {
        requireScope(weddingId)
        val normalized = query.trim().lowercase()
        if (normalized.isEmpty()) return@withLock guests.toList()
        guests.filter {
            it.name.lowercase().contains(normalized) ||
                (it.householdName?.lowercase()?.contains(normalized) == true) ||
                (it.tableName?.lowercase()?.contains(normalized) == true)
        }
    }

    override suspend fun checkInGuest(weddingId: String, qrPayload: String, count: Int, usherId: String): CheckInVerificationResult = mutex.withLock {
        requireScope(weddingId)
        val index = guests.indexOfFirst { guest ->
            val serial = guest.passSerial ?: return@indexOfFirst false
            qrPayload.contains(serial)
        }
        if (index == -1) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.INVALID_PASS,
                guestName = "Unknown Guest",
                partySize = 0,
                alreadyCheckedInCount = 0,
                remainingCount = 0,
                gateMessage = "Shadow reference pass does not match an attending guest."
            )
        }

        val guest = guests[index]
        val remaining = (guest.partySize - guest.checkedInCount).coerceAtLeast(0)

        if (remaining == 0) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.ALREADY_CHECKED_IN,
                guestName = guest.name,
                householdName = guest.householdName,
                partySize = guest.partySize,
                alreadyCheckedInCount = guest.checkedInCount,
                remainingCount = 0,
                tableNumber = guest.tableNumber,
                tableName = guest.tableName,
                gateMessage = "Duplicate Gate Entry: full shadow party already admitted."
            )
        }

        if (count > remaining) {
            return@withLock CheckInVerificationResult(
                status = CheckInStatus.CAPACITY_EXCEEDED,
                guestName = guest.name,
                householdName = guest.householdName,
                partySize = guest.partySize,
                alreadyCheckedInCount = guest.checkedInCount,
                remainingCount = remaining,
                tableNumber = guest.tableNumber,
                tableName = guest.tableName,
                gateMessage = "Capacity Alert: only $remaining guest(s) remain in this shadow party."
            )
        }

        val updatedCount = guest.checkedInCount + count
        val updatedGuest = guest.copy(
            checkedInCount = updatedCount,
            checkedIn = updatedCount > 0
        )
        guests[index] = updatedGuest

        auditRecords.add(
            CheckInAuditRecord(
                passSerial = updatedGuest.passSerial ?: "SHADOW",
                guestName = updatedGuest.name,
                countAdmitted = count,
                gateName = "Shadow Gate",
                usherId = usherId,
                isSynced = false
            )
        )

        val newRemaining = (updatedGuest.partySize - updatedGuest.checkedInCount).coerceAtLeast(0)
        return@withLock CheckInVerificationResult(
            status = if (newRemaining == 0) CheckInStatus.VALID_PASS else CheckInStatus.PARTIAL_CHECKED_IN,
            guestName = updatedGuest.name,
            householdName = updatedGuest.householdName,
            partySize = updatedGuest.partySize,
            alreadyCheckedInCount = updatedGuest.checkedInCount,
            remainingCount = newRemaining,
            tableNumber = updatedGuest.tableNumber,
            tableName = updatedGuest.tableName,
            gateMessage = if (newRemaining == 0) "Admitted: full shadow party cleared for entry." else "Admitted: partial shadow party arrival."
        )
    }

    override suspend fun updateVendorState(weddingId: String, id: String, state: VendorPresenceState): VendorPresence = mutex.withLock {
        requireScope(weddingId)
        val index = vendors.indexOfFirst { it.id == id }
        if (index == -1) error("Vendor not found")
        val updated = vendors[index].copy(state = state)
        vendors[index] = updated
        updated
    }

    override suspend fun postAnnouncement(weddingId: String, title: String, message: String, urgency: AnnouncementUrgency): WeddingAnnouncement = mutex.withLock {
        requireScope(weddingId)
        val announcement = WeddingAnnouncement(title = title, message = message, urgency = urgency)
        announcements.add(0, announcement)
        announcement
    }

    override suspend fun resolveInvitation(weddingSlug: String, token: String): InvitationContext = mutex.withLock {
        val guest = guestForToken(token)
        InvitationContext(
            weddingSlug = weddingSlug,
            guestToken = token,
            coupleNames = wedding.coupleNames,
            guestName = guest.name,
            householdName = guest.householdName,
            partySize = guest.partySize,
            weddingDate = "2026-12-23 14:00:00",
            venueName = wedding.venueName,
            venueCity = "${wedding.city}, ${wedding.country}",
            cardStyle = "ivory-floral-gold",
            isConfirmed = guest.rsvpStatus == RSVPStatus.ATTENDING
        )
    }

    override suspend fun confirmRsvp(weddingSlug: String, token: String, attending: Boolean): WeddingPass = mutex.withLock {
        val index = guestIndexForToken(token) ?: error("Shadow invitation token does not map to a reference guest.")
        val current = guests[index]
        val updated = current.copy(
            rsvpStatus = if (attending) RSVPStatus.ATTENDING else RSVPStatus.DECLINED,
            passSerial = if (attending && current.passSerial == null) "SHDW${current.id.uppercase().takeLast(8)}" else current.passSerial
        )
        guests[index] = updated
        if (attending) makePass(updated) else makeNonAdmissionPass(updated)
    }

    private fun guestIndexForToken(token: String): Int? {
        val guestId = when (token) {
            attendingToken, "native-reference-guest" -> "shadow_guest_011"
            partyFourToken -> "shadow_guest_007"
            pendingToken -> "shadow_guest_001"
            declinedToken -> "shadow_guest_002"
            else -> return null
        }
        return guests.indexOfFirst { it.id == guestId }.takeIf { it != -1 }
    }

    private fun guestForToken(token: String): Guest {
        val index = guestIndexForToken(token) ?: error("Unknown Shadow guest token.")
        return guests[index]
    }

    private fun makePass(guest: Guest): WeddingPass {
        val serial = guest.passSerial ?: primaryPassSerial
        return WeddingPass(
            token = "shadow-pass-${guest.id}",
            weddingId = wedding.id,
            coupleNames = wedding.coupleNames,
            weddingDate = "2026-12-23 14:00:00",
            venueName = wedding.venueName,
            venueAddress = wedding.venueAddress,
            guestName = guest.name,
            householdName = guest.householdName,
            partySize = guest.partySize,
            tableNumber = guest.tableNumber,
            tableName = guest.tableName,
            seatNumber = if (guest.tableName == null) null else "Shadow assignment",
            currentStage = PassStage.ATTENDING,
            qrPayload = "SHADOW_ONLY.WW2_PLACEHOLDER.$serial.NOT_A_PRODUCTION_CREDENTIAL"
        )
    }

    private fun makeNonAdmissionPass(guest: Guest): WeddingPass {
        return WeddingPass(
            token = "shadow-non-admission-${guest.id}",
            weddingId = wedding.id,
            coupleNames = wedding.coupleNames,
            weddingDate = "2026-12-23 14:00:00",
            venueName = wedding.venueName,
            venueAddress = wedding.venueAddress,
            guestName = guest.name,
            householdName = guest.householdName,
            partySize = guest.partySize,
            currentStage = PassStage.INVITATION,
            qrPayload = "SHADOW_DECLINED_NO_ADMISSION"
        )
    }
}
