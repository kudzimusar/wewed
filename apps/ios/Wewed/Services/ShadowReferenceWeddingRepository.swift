import Foundation

/// Sanitized, internally coherent production-derived reference implementation for the
/// Charity & Kudzie / Eleven Eleven Testing shadow scenario.
///
/// IMPORTANT:
/// - Derived from production Charity & Kudzie graph with PII and secrets stripped/pseudonymized.
/// - Gate credentials are development-only placeholders; canonical production
///   pass verification remains WW2 ECDSA and is not replaced by this repository.
public actor ShadowReferenceWeddingRepository: WeddingRepositoryProtocol {
    private var wedding: Wedding
    private var tasks: [PlannerTask]
    private var guests: [Guest]
    private var budget: BudgetSummary
    private var auditRecords: [CheckInAuditRecord] = []
    private var vendors: [VendorPresence]
    private var announcements: [WeddingAnnouncement]

    private let primaryPassSerial = "SHDWGSTA01"
    private let attendingToken = "shadow-attending-guest"
    private let pendingToken = "shadow-pending-guest"
    private let declinedToken = "shadow-declined-guest"
    private let partyFourToken = "shadow-party4-guest"

    public init() {
        wedding = Wedding(
            id: "shadow_ref_charity_kudzie",
            coupleNames: "Charity & Kudzie",
            date: "2026-12-23 14:00:00",
            venueName: "Imba Manor",
            venueAddress: "Imba Manor, Harare",
            city: "Harare",
            country: "Zimbabwe",
            lifecycle: "before",
            programme: [
                ProgrammeItem(id: "shadow_prog_01", title: "Ceremony Begins", time: "14:00", location: "Imba Manor", description: "The wedding ceremony under the African sky"),
                ProgrammeItem(id: "shadow_prog_02", title: "Guest Arrival", time: "13:00", location: "Imba Manor", description: "Welcome drinks and canapés at Imba Manor gardens"),
                ProgrammeItem(id: "shadow_prog_03", title: "Confetti & Congratulations", time: "14:45", location: "Imba Manor", description: "Rice toss and family photos on the Manor steps"),
                ProgrammeItem(id: "shadow_prog_04", title: "Cocktail Hour", time: "15:30", location: "Imba Manor", description: "Signature cocktails, lawn games and live jazz"),
                ProgrammeItem(id: "shadow_prog_05", title: "Reception Entrance", time: "16:30", location: "Imba Manor", description: "Mr & Mrs Musarurwa make their grand entrance"),
                ProgrammeItem(id: "shadow_prog_06", title: "First Dance", time: "17:00", location: "Imba Manor", description: "Charity & Kudzie take the floor for the first time as one"),
                ProgrammeItem(id: "shadow_prog_07", title: "Dinner is Served", time: "17:30", location: "Imba Manor", description: "A feast celebrating Zimbabwean flavours and global cuisine"),
                ProgrammeItem(id: "shadow_prog_08", title: "Speeches & Toasts", time: "18:30", location: "Imba Manor", description: "Words from the best man, maid of honour, and family"),
                ProgrammeItem(id: "shadow_prog_09", title: "Cake Cutting", time: "19:30", location: "Imba Manor", description: "The couple cuts the cake — a sweet new beginning"),
                ProgrammeItem(id: "shadow_prog_10", title: "UAT-TIMELINE-001 Vendor access and setup", time: "11:45", location: "Imba Manor service entrance", description: "Confirm Imba Manor access, loading point, and setup handover"),
                ProgrammeItem(id: "shadow_prog_11", title: "Dance Floor Opens", time: "20:00", location: "Imba Manor", description: "DJ spins the night away — from Sungura to pop anthems"),
                ProgrammeItem(id: "shadow_prog_12", title: "Last Dance", time: "22:00", location: "Imba Manor", description: "One final dance under the stars before the night ends"),
                ProgrammeItem(id: "shadow_prog_13", title: "Sparkler Send-Off", time: "22:30", location: "Imba Manor", description: "Guests light the way as Charity & Kudzie depart"),
            ]
        )

        tasks = [
            PlannerTask(id: "shadow_task_01", title: "Book Imba Manor", status: .done, priority: .high, category: "venue", dueDate: nil),
            PlannerTask(id: "shadow_task_02", title: "Confirm ceremony garden", status: .done, priority: .high, category: "venue", dueDate: nil),
            PlannerTask(id: "shadow_task_03", title: "Pay venue deposit", status: .done, priority: .high, category: "venue", dueDate: nil),
            PlannerTask(id: "shadow_task_04", title: "Book DJ", status: .done, priority: .high, category: "music", dueDate: nil),
            PlannerTask(id: "shadow_task_05", title: "Confirm first dance song", status: .done, priority: .low, category: "music", dueDate: nil),
            PlannerTask(id: "shadow_task_06", title: "Confirm reception hall", status: .done, priority: .medium, category: "venue", dueDate: nil),
            PlannerTask(id: "shadow_task_07", title: "Order wedding cake", status: .done, priority: .medium, category: "catering", dueDate: nil),
            PlannerTask(id: "shadow_task_08", title: "Book caterer", status: .inProgress, priority: .high, category: "catering", dueDate: nil),
            PlannerTask(id: "shadow_task_09", title: "Print place cards", status: .inProgress, priority: .low, category: "stationery", dueDate: nil),
            PlannerTask(id: "shadow_task_10", title: "UAT-TASK-001 Confirm florist arrival", status: .inProgress, priority: .low, category: "wedding_day", dueDate: "2026-12-22 00:00:00"),
            PlannerTask(id: "shadow_task_11", title: "Choose menu", status: .todo, priority: .high, category: "catering", dueDate: nil),
            PlannerTask(id: "shadow_task_12", title: "Confirm meal counts (beef/chicken/veg/traditional)", status: .todo, priority: .high, category: "catering", dueDate: nil),
            PlannerTask(id: "shadow_task_13", title: "Groom suit fitting", status: .todo, priority: .high, category: "attire", dueDate: nil),
            PlannerTask(id: "shadow_task_14", title: "Bride dress fitting", status: .todo, priority: .high, category: "attire", dueDate: "2026-12-22 00:00:00"),
            PlannerTask(id: "shadow_task_15", title: "Book photographer", status: .todo, priority: .high, category: "photo_video", dueDate: nil),
            PlannerTask(id: "shadow_task_16", title: "Book videographer", status: .todo, priority: .high, category: "photo_video", dueDate: nil),
            PlannerTask(id: "shadow_task_17", title: "Marriage license", status: .todo, priority: .high, category: "timeline_2wk", dueDate: "2026-12-17 00:00:00"),
            PlannerTask(id: "shadow_task_18", title: "UAT-NOTIF-PLANNER-001 Florist arrival check", status: .todo, priority: .high, category: "wedding_day", dueDate: "2026-08-22 00:00:00"),
            PlannerTask(id: "shadow_task_19", title: "Flower girl dress", status: .todo, priority: .low, category: "attire", dueDate: nil),
            PlannerTask(id: "shadow_task_20", title: "Ring bearer outfit", status: .todo, priority: .low, category: "attire", dueDate: nil),
            PlannerTask(id: "shadow_task_21", title: "Confirm airport pickups for VIPs", status: .todo, priority: .low, category: "transport", dueDate: nil),
            PlannerTask(id: "shadow_task_22", title: "Order thank you cards", status: .todo, priority: .low, category: "stationery", dueDate: nil),
            PlannerTask(id: "shadow_task_23", title: "Lighting", status: .todo, priority: .low, category: "decor", dueDate: nil),
            PlannerTask(id: "shadow_task_24", title: "Pre-wedding shoot", status: .todo, priority: .low, category: "photo_video", dueDate: nil),
            PlannerTask(id: "shadow_task_25", title: "Bridal shower", status: .todo, priority: .low, category: "other", dueDate: nil),
            PlannerTask(id: "shadow_task_26", title: "Stag night", status: .todo, priority: .low, category: "other", dueDate: nil),
            PlannerTask(id: "shadow_task_27", title: "Change name documents", status: .todo, priority: .low, category: "other", dueDate: nil),
            PlannerTask(id: "shadow_task_28", title: "Follow up contribution from Mazvita Duwa", status: .todo, priority: .medium, category: "other", dueDate: nil),
            PlannerTask(id: "shadow_task_29", title: "Bridesmaids dresses", status: .todo, priority: .medium, category: "attire", dueDate: nil),
            PlannerTask(id: "shadow_task_30", title: "Groomsmen suits", status: .todo, priority: .medium, category: "attire", dueDate: nil),
            PlannerTask(id: "shadow_task_31", title: "Confirm traditional foods", status: .todo, priority: .medium, category: "magumo", dueDate: nil),
            PlannerTask(id: "shadow_task_32", title: "Book shuttle for guests", status: .todo, priority: .medium, category: "transport", dueDate: nil),
            PlannerTask(id: "shadow_task_33", title: "Arrange bridal car", status: .todo, priority: .medium, category: "transport", dueDate: nil),
            PlannerTask(id: "shadow_task_34", title: "Order invitations", status: .todo, priority: .medium, category: "stationery", dueDate: nil),
            PlannerTask(id: "shadow_task_35", title: "Design programme", status: .todo, priority: .medium, category: "stationery", dueDate: nil),
            PlannerTask(id: "shadow_task_36", title: "Book florist", status: .todo, priority: .medium, category: "decor", dueDate: nil),
            PlannerTask(id: "shadow_task_37", title: "Confirm ceremony arch", status: .todo, priority: .medium, category: "decor", dueDate: nil),
            PlannerTask(id: "shadow_task_38", title: "Reception centerpieces", status: .todo, priority: .medium, category: "decor", dueDate: nil),
            PlannerTask(id: "shadow_task_39", title: "Confirm shot list", status: .todo, priority: .medium, category: "photo_video", dueDate: nil),
            PlannerTask(id: "shadow_task_40", title: "Confirm ceremony music", status: .todo, priority: .medium, category: "music", dueDate: nil),
            PlannerTask(id: "shadow_task_41", title: "Sound system for ceremony", status: .todo, priority: .medium, category: "music", dueDate: nil),
            PlannerTask(id: "shadow_task_42", title: "Honeymoon booking", status: .todo, priority: .medium, category: "other", dueDate: nil),
        ]

        guests = [
            Guest(id: "shadow_guest_001", name: "Guest G001", householdName: nil, partySize: 1, side: "family", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 5 — Friends", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_002", name: "Guest G002", householdName: nil, partySize: 1, side: "family", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 1 — Family", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_003", name: "Guest G003", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 3 — Bridal Party", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_004", name: "Guest G004", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_005", name: "Guest G005", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 2 — Family", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_006", name: "Guest G006", householdName: nil, partySize: 1, side: "family", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 1 — Family", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_007", name: "Guest G007", householdName: nil, partySize: 4, side: "Couple", rsvpStatus: .attending, tableNumber: nil, tableName: nil, checkedIn: true, checkedInCount: 1, passSerial: "SHDWGSTP04"),
            Guest(id: "shadow_guest_008", name: "Guest G008", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 3 — Bridal Party", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_009", name: "Guest G009", householdName: nil, partySize: 1, side: "bride", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 6 — Friends", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_010", name: "Guest G010", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 1 — Family", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_011", name: "Guest G011", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .attending, tableNumber: nil, tableName: "Table 1 — Family", checkedIn: false, checkedInCount: 0, passSerial: "SHDWGSTA01"),
            Guest(id: "shadow_guest_012", name: "Guest G012", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 7 — Colleagues", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_013", name: "Guest G013", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 3 — Bridal Party", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_014", name: "Guest G014", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 5 — Friends", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_015", name: "Guest G015", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 3 — Bridal Party", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_016", name: "Guest G016", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 7 — Colleagues", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_017", name: "Guest G017", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_018", name: "Guest G018", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_019", name: "Guest G019", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_020", name: "Guest G020", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_021", name: "Guest G021", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_022", name: "Guest G022", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 2 — Family", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_023", name: "Guest G023", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_024", name: "Guest G024", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_025", name: "Guest G025", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_026", name: "Guest G026", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_027", name: "Guest G027", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_028", name: "Guest G028", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_029", name: "Guest G029", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_030", name: "Guest G030", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_031", name: "Guest G031", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_032", name: "Guest G032", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_033", name: "Guest G033", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_034", name: "Guest G034", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_035", name: "Guest G035", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_036", name: "Guest G036", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_037", name: "Guest G037", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_038", name: "Guest G038", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 3 — Bridal Party", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_039", name: "Guest G039", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_040", name: "Guest G040", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_041", name: "Guest G041", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_042", name: "Guest G042", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_043", name: "Guest G043", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_044", name: "Guest G044", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_045", name: "Guest G045", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_046", name: "Guest G046", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_047", name: "Guest G047", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_048", name: "Guest G048", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_049", name: "Guest G049", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_050", name: "Guest G050", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_051", name: "Guest G051", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_052", name: "Guest G052", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_053", name: "Guest G053", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_054", name: "Guest G054", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_055", name: "Guest G055", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_056", name: "Guest G056", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_057", name: "Guest G057", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_058", name: "Guest G058", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_059", name: "Guest G059", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_060", name: "Guest G060", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_061", name: "Guest G061", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_062", name: "Guest G062", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_063", name: "Guest G063", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_064", name: "Guest G064", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_065", name: "Guest G065", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_066", name: "Guest G066", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_067", name: "Guest G067", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_068", name: "Guest G068", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_069", name: "Guest G069", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_070", name: "Guest G070", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_071", name: "Guest G071", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_072", name: "Guest G072", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_073", name: "Guest G073", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_074", name: "Guest G074", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_075", name: "Guest G075", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_076", name: "Guest G076", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_077", name: "Guest G077", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_078", name: "Guest G078", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_079", name: "Guest G079", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_080", name: "Guest G080", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_081", name: "Guest G081", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_082", name: "Guest G082", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_083", name: "Guest G083", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_084", name: "Guest G084", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_085", name: "Guest G085", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_086", name: "Guest G086", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_087", name: "Guest G087", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_088", name: "Guest G088", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_089", name: "Guest G089", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_090", name: "Guest G090", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 8 — VIPs", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_091", name: "Guest G091", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_092", name: "Guest G092", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_093", name: "Guest G093", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_094", name: "Guest G094", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_095", name: "Guest G095", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_096", name: "Guest G096", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_097", name: "Guest G097", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_098", name: "Guest G098", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_099", name: "Guest G099", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_100", name: "Guest G100", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_101", name: "Guest G101", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_102", name: "Guest G102", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_103", name: "Guest G103", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 1 — Family", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_104", name: "Guest G104", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 1 — Family", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_105", name: "Guest G105", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 1 — Family", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_106", name: "Guest G106", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 2 — Family", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_107", name: "Guest G107", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: "Table 2 — Family", checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_108", name: "Guest G108", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_109", name: "Guest G109", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_110", name: "Guest G110", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_111", name: "Guest G111", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_112", name: "Guest G112", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_113", name: "Guest G113", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_114", name: "Guest G114", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_115", name: "Guest G115", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_116", name: "Guest G116", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_117", name: "Guest G117", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_118", name: "Guest G118", householdName: nil, partySize: 1, side: "family", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_119", name: "Guest G119", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_120", name: "Guest G120", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_121", name: "Guest G121", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_122", name: "Guest G122", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_123", name: "Guest G123", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_124", name: "Guest G124", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_125", name: "Guest G125", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_126", name: "Guest G126", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_127", name: "Guest G127", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_128", name: "Guest G128", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_129", name: "Guest G129", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_130", name: "Guest G130", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_131", name: "Guest G131", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_132", name: "Guest G132", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_133", name: "Guest G133", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_134", name: "Guest G134", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_135", name: "Guest G135", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_136", name: "Guest G136", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_137", name: "Guest G137", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_138", name: "Guest G138", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_139", name: "Guest G139", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_140", name: "Guest G140", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_141", name: "Guest G141", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_142", name: "Guest G142", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_143", name: "Guest G143", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_144", name: "Guest G144", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_145", name: "Guest G145", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_146", name: "Guest G146", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_147", name: "Guest G147", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_148", name: "Guest G148", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_149", name: "Guest G149", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_150", name: "Guest G150", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_151", name: "Guest G151", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_152", name: "Guest G152", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_153", name: "Guest G153", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_154", name: "Guest G154", householdName: nil, partySize: 1, side: "neutral", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_155", name: "Guest G155", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_156", name: "Guest G156", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_157", name: "Guest G157", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_158", name: "Guest G158", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_159", name: "Guest G159", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_160", name: "Guest G160", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_161", name: "Guest G161", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_162", name: "Guest G162", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_163", name: "Guest G163", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_164", name: "Guest G164", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_165", name: "Guest G165", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_166", name: "Guest G166", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_167", name: "Guest G167", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_168", name: "Guest G168", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_169", name: "Guest G169", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_170", name: "Guest G170", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_171", name: "Guest G171", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_172", name: "Guest G172", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_173", name: "Guest G173", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
            Guest(id: "shadow_guest_174", name: "Guest G174", householdName: nil, partySize: 1, side: "groom", rsvpStatus: .pending, tableNumber: nil, tableName: nil, checkedIn: false, checkedInCount: 0, passSerial: nil),
        ]

        budget = BudgetSummary(
            currency: "USD",
            totalBudget: 30380,
            totalAllocated: 8690,
            totalPaid: 3875,
            categories: [
                BudgetCategory(name: "Attire", allocated: 6000, spent: 1210),
                BudgetCategory(name: "Catering", allocated: 6600, spent: 1850),
                BudgetCategory(name: "Decor", allocated: 4100, spent: 300),
                BudgetCategory(name: "Miscellaneous", allocated: 2320, spent: 1020),
                BudgetCategory(name: "Music", allocated: 1500, spent: 230),
                BudgetCategory(name: "Photo & Video", allocated: 3200, spent: 500),
                BudgetCategory(name: "Stationery", allocated: 700, spent: 120),
                BudgetCategory(name: "Transport", allocated: 900, spent: 500),
                BudgetCategory(name: "Venue", allocated: 5060, spent: 2960)
            ]
        )

        vendors = [
            VendorPresence(id: "shadow_vnd_01", vendorName: "Cake Gourmet", serviceCategory: "caterer", serviceArea: "Imba Manor", state: .notRecorded, expectedTime: "Not recorded"),
            VendorPresence(id: "shadow_vnd_02", vendorName: "MC Aloe The Avangelist", serviceCategory: "dj", serviceArea: "Imba Manor", state: .notRecorded, expectedTime: "Not recorded"),
            VendorPresence(id: "shadow_vnd_03", vendorName: "The Glass Petal Atelier", serviceCategory: "florist", serviceArea: "Imba Manor", state: .notRecorded, expectedTime: "Not recorded"),
            VendorPresence(id: "shadow_vnd_04", vendorName: "Makeup Artist", serviceCategory: "other", serviceArea: "Imba Manor", state: .notRecorded, expectedTime: "Not recorded"),
            VendorPresence(id: "shadow_vnd_05", vendorName: "TBD", serviceCategory: "other", serviceArea: "Imba Manor", state: .notRecorded, expectedTime: "Not recorded"),
            VendorPresence(id: "shadow_vnd_06", vendorName: "FAUME MEDIA", serviceCategory: "photographer", serviceArea: "Imba Manor", state: .notRecorded, expectedTime: "Not recorded"),
            VendorPresence(id: "shadow_vnd_07", vendorName: "Imba Manor", serviceCategory: "venue", serviceArea: "Imba Manor", state: .notRecorded, expectedTime: "Not recorded"),
        ]

        announcements = [
            WeddingAnnouncement(id: "shadow_ann_1", title: "Authentic Shadow Environment", message: "Production-derived Charity & Kudzie wedding graph with 42 tasks, 22 budget items, and 174 guests.", urgency: .info),
            WeddingAnnouncement(id: "shadow_ann_2", title: "Invitation Flow Ready", message: "The Ivory Floral Gold invitation supports individual and party-of-4 admission.", urgency: .info)
        ]
    }

    public func getWedding() async throws -> Wedding { wedding }
    public func getTasks() async throws -> [PlannerTask] { tasks }
    public func getGuests() async throws -> [Guest] { guests }
    public func getBudget() async throws -> BudgetSummary { budget }
    public func getAuditRecords() async throws -> [CheckInAuditRecord] { auditRecords }
    public func getVendors() async throws -> [VendorPresence] { vendors }
    public func getAnnouncements() async throws -> [WeddingAnnouncement] { announcements }

    public func createTask(title: String, priority: TaskPriority, category: String) async throws -> PlannerTask {
        let task = PlannerTask(id: "shadow_task_\(UUID().uuidString.prefix(8))", title: title, status: .todo, priority: priority, category: category)
        tasks.append(task)
        return task
    }

    public func toggleTask(taskId: String) async throws -> PlannerTask {
        guard let index = tasks.firstIndex(where: { $0.id == taskId }) else {
            throw NSError(domain: "ShadowReferenceWeddingRepository", code: 404, userInfo: [NSLocalizedDescriptionKey: "Task not found"])
        }
        tasks[index].status = tasks[index].status == .done ? .todo : .done
        return tasks[index]
    }

    public func getWeddingPass(token: String) async throws -> WeddingPass {
        let guest = try guestForToken(token)
        guard guest.rsvpStatus == .attending else {
            throw NSError(
                domain: "ShadowReferenceWeddingRepository",
                code: 403,
                userInfo: [NSLocalizedDescriptionKey: "Wedding Pass is available only to attending guests in Shadow."]
            )
        }
        return makePass(for: guest)
    }

    public func searchGuests(query: String) async throws -> [Guest] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return guests }
        return guests.filter {
            $0.name.lowercased().contains(normalized) ||
            ($0.householdName?.lowercased().contains(normalized) ?? false) ||
            ($0.tableName?.lowercased().contains(normalized) ?? false)
        }
    }

    public func checkInGuest(qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult {
        guard let index = guests.firstIndex(where: { guest in
            guard let serial = guest.passSerial else { return false }
            return qrPayload.contains(serial)
        }) else {
            return CheckInVerificationResult(status: .invalidPass, guestName: "Unknown Guest", partySize: 0, alreadyCheckedInCount: 0, remainingCount: 0, gateMessage: "Shadow reference pass does not match an attending guest.")
        }

        var guest = guests[index]
        let remaining = max(0, guest.partySize - guest.checkedInCount)

        if remaining == 0 {
            return CheckInVerificationResult(status: .alreadyCheckedIn, guestName: guest.name, householdName: guest.householdName, partySize: guest.partySize, alreadyCheckedInCount: guest.checkedInCount, remainingCount: 0, tableNumber: guest.tableNumber, tableName: guest.tableName, gateMessage: "Duplicate Gate Entry: full shadow party already admitted.")
        }

        if count > remaining {
            return CheckInVerificationResult(status: .capacityExceeded, guestName: guest.name, householdName: guest.householdName, partySize: guest.partySize, alreadyCheckedInCount: guest.checkedInCount, remainingCount: remaining, tableNumber: guest.tableNumber, tableName: guest.tableName, gateMessage: "Capacity Alert: only \(remaining) guest(s) remain in this shadow party.")
        }

        guest.checkedInCount += count
        guest.checkedIn = guest.checkedInCount > 0
        guests[index] = guest

        auditRecords.append(CheckInAuditRecord(passSerial: guest.passSerial ?? "SHADOW", guestName: guest.name, countAdmitted: count, gateName: "Shadow Gate", usherId: usherId, isSynced: false))

        let newRemaining = max(0, guest.partySize - guest.checkedInCount)
        return CheckInVerificationResult(
            status: newRemaining == 0 ? .validPass : .partialCheckedIn,
            guestName: guest.name,
            householdName: guest.householdName,
            partySize: guest.partySize,
            alreadyCheckedInCount: guest.checkedInCount,
            remainingCount: newRemaining,
            tableNumber: guest.tableNumber,
            tableName: guest.tableName,
            gateMessage: newRemaining == 0 ? "Admitted: full shadow party cleared for entry." : "Admitted: partial shadow party arrival."
        )
    }

    public func updateVendorState(id: String, state: VendorPresenceState) async throws -> VendorPresence {
        guard let index = vendors.firstIndex(where: { $0.id == id }) else {
            throw NSError(domain: "ShadowReferenceWeddingRepository", code: 404, userInfo: [NSLocalizedDescriptionKey: "Vendor not found"])
        }
        vendors[index].state = state
        vendors[index].lastUpdated = Date()
        return vendors[index]
    }

    public func postAnnouncement(title: String, message: String, urgency: AnnouncementUrgency) async throws -> WeddingAnnouncement {
        let announcement = WeddingAnnouncement(title: title, message: message, urgency: urgency)
        announcements.insert(announcement, at: 0)
        return announcement
    }

    public func resolveInvitation(weddingSlug: String, token: String) async throws -> InvitationContext {
        let guest = try guestForToken(token)
        return InvitationContext(
            weddingSlug: weddingSlug,
            guestToken: token,
            coupleNames: wedding.coupleNames,
            guestName: guest.name,
            householdName: guest.householdName,
            partySize: guest.partySize,
            weddingDate: "2026-12-23 14:00:00",
            venueName: wedding.venueName,
            venueCity: "\(wedding.city), \(wedding.country)",
            cardStyle: "ivory-floral-gold",
            isConfirmed: guest.rsvpStatus == .attending
        )
    }

    public func confirmRsvp(weddingSlug: String, token: String, attending: Bool) async throws -> WeddingPass {
        guard let index = guestIndexForToken(token) else {
            throw NSError(
                domain: "ShadowReferenceWeddingRepository",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "Shadow invitation token does not map to a reference guest."]
            )
        }

        var current = guests[index]
        current.rsvpStatus = attending ? .attending : .declined
        if attending && current.passSerial == nil {
            current.passSerial = "SHDW\(current.id.uppercased().suffix(8))"
        }
        guests[index] = current

        return attending ? makePass(for: current) : makeNonAdmissionPass(for: current)
    }

    private func guestIndexForToken(_ token: String) -> Int? {
        let guestId: String
        switch token {
        case attendingToken, "native-reference-guest":
            guestId = "shadow_guest_011"
        case partyFourToken:
            guestId = "shadow_guest_007"
        case pendingToken:
            guestId = "shadow_guest_001"
        case declinedToken:
            guestId = "shadow_guest_002"
        default:
            return nil
        }
        return guests.firstIndex(where: { $0.id == guestId })
    }

    private func guestForToken(_ token: String) throws -> Guest {
        guard let index = guestIndexForToken(token) else {
            throw NSError(
                domain: "ShadowReferenceWeddingRepository",
                code: 404,
                userInfo: [NSLocalizedDescriptionKey: "Unknown Shadow guest token."]
            )
        }
        return guests[index]
    }

    private func makePass(for guest: Guest) -> WeddingPass {
        let serial = guest.passSerial ?? primaryPassSerial
        return WeddingPass(
            token: "shadow-pass-\(guest.id)",
            weddingId: wedding.id,
            coupleNames: wedding.coupleNames,
            weddingDate: "2026-12-23 14:00:00",
            venueName: wedding.venueName,
            venueAddress: wedding.venueAddress,
            guestName: guest.name,
            householdName: guest.householdName,
            partySize: guest.partySize,
            tableNumber: guest.tableNumber,
            tableName: guest.tableName,
            seatNumber: guest.tableName == nil ? nil : "Shadow assignment",
            currentStage: .attending,
            qrPayload: "SHADOW_ONLY.WW2_PLACEHOLDER.\(serial).NOT_A_PRODUCTION_CREDENTIAL"
        )
    }

    private func makeNonAdmissionPass(for guest: Guest) -> WeddingPass {
        WeddingPass(
            token: "shadow-non-admission-\(guest.id)",
            weddingId: wedding.id,
            coupleNames: wedding.coupleNames,
            weddingDate: "2026-12-23 14:00:00",
            venueName: wedding.venueName,
            venueAddress: wedding.venueAddress,
            guestName: guest.name,
            householdName: guest.householdName,
            partySize: guest.partySize,
            currentStage: .invitation,
            qrPayload: "SHADOW_DECLINED_NO_ADMISSION"
        )
    }
}
