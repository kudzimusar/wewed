import XCTest
@testable import WewedKit

/// P0-1 proof: the active wedding is a real repository scope, not a reload key.
///
/// `TwoWeddingTestRepository` genuinely serves two different wedding graphs, so these tests can
/// distinguish "reloaded" from "reloaded the correct wedding" — which a single-wedding fixture
/// could never do. Mirrors the Android `WeddingScopeTest`.
final class WeddingScopeTests: XCTestCase {

    private let weddingA = "wed_a"
    private let weddingB = "wed_b"

    /// A source holding two distinct wedding graphs.
    private actor TwoWeddingTestRepository: WeddingRepositoryProtocol {
        private struct Graph {
            let wedding: Wedding
            let guests: [Guest]
            let tasks: [PlannerTask]
            let vendors: [VendorPresence]
            let announcements: [WeddingAnnouncement]
        }

        private let graphs: [String: Graph] = [
            "wed_a": Graph(
                wedding: Wedding(
                    id: "wed_a", coupleNames: "Amara & Anesu", date: "2026-10-24T14:00:00Z",
                    venueName: "Venue A", venueAddress: "Address A", city: "Harare",
                    country: "Zimbabwe", lifecycle: "before",
                    programme: [ProgrammeItem(id: "pa", title: "Ceremony A", time: "14:00", location: "Chapel A", description: "A")]
                ),
                guests: [Guest(id: "ga1", name: "Guest A One", householdName: "Household A", partySize: 2, side: "Bride", rsvpStatus: .attending, tableNumber: 1, tableName: "Table A", checkedIn: false, checkedInCount: 0, passSerial: "PASSA1")],
                tasks: [PlannerTask(id: "ta1", title: "Task A", status: .todo, priority: .high, category: "Cat A")],
                vendors: [VendorPresence(id: "va1", vendorName: "Vendor A", serviceCategory: "Decor", serviceArea: "Area A", state: .arrived, expectedTime: "10:00")],
                announcements: [WeddingAnnouncement(id: "aa1", title: "Announce A", message: "Body A", urgency: .info)]
            ),
            "wed_b": Graph(
                wedding: Wedding(
                    id: "wed_b", coupleNames: "Bongai & Blessing", date: "2026-12-12T11:00:00Z",
                    venueName: "Venue B", venueAddress: "Address B", city: "Bulawayo",
                    country: "Zimbabwe", lifecycle: "before",
                    programme: [ProgrammeItem(id: "pb", title: "Ceremony B", time: "11:00", location: "Chapel B", description: "B")]
                ),
                guests: [Guest(id: "gb1", name: "Guest B One", householdName: "Household B", partySize: 4, side: "Groom", rsvpStatus: .pending, tableNumber: 2, tableName: "Table B", checkedIn: false, checkedInCount: 0, passSerial: "PASSB1")],
                tasks: [PlannerTask(id: "tb1", title: "Task B", status: .done, priority: .low, category: "Cat B")],
                vendors: [VendorPresence(id: "vb1", vendorName: "Vendor B", serviceCategory: "Sound", serviceArea: "Area B", state: .enRoute, expectedTime: "09:00")],
                announcements: [WeddingAnnouncement(id: "ab1", title: "Announce B", message: "Body B", urgency: .alert)]
            )
        ]

        private func graph(_ weddingId: String) throws -> Graph {
            guard let g = graphs[weddingId] else {
                throw WeddingScopeMismatch(requestedWeddingId: weddingId, availableWeddingIds: graphs.keys.sorted())
            }
            return g
        }

        func availableWeddingIds() async throws -> [String] { graphs.keys.sorted() }
        func getWedding(weddingId: String) async throws -> Wedding { try graph(weddingId).wedding }
        func getTasks(weddingId: String) async throws -> [PlannerTask] { try graph(weddingId).tasks }
        func getGuests(weddingId: String) async throws -> [Guest] { try graph(weddingId).guests }
        func getVendors(weddingId: String) async throws -> [VendorPresence] { try graph(weddingId).vendors }
        func getAnnouncements(weddingId: String) async throws -> [WeddingAnnouncement] { try graph(weddingId).announcements }
        func getBudget(weddingId: String) async throws -> BudgetSummary {
            _ = try graph(weddingId)
            return BudgetSummary(currency: "USD", totalBudget: 1, totalAllocated: 1, totalPaid: 1, categories: [])
        }
        func getAuditRecords(weddingId: String) async throws -> [CheckInAuditRecord] { _ = try graph(weddingId); return [] }
        func searchGuests(weddingId: String, query: String) async throws -> [Guest] {
            try graph(weddingId).guests.filter { $0.name.localizedCaseInsensitiveContains(query) }
        }
        func createTask(weddingId: String, title: String, priority: TaskPriority, category: String) async throws -> PlannerTask {
            _ = try graph(weddingId)
            return PlannerTask(id: "new", title: title, status: .todo, priority: priority, category: category)
        }
        func toggleTask(weddingId: String, taskId: String) async throws -> PlannerTask { try graph(weddingId).tasks[0] }
        func checkInGuest(weddingId: String, qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult {
            _ = try graph(weddingId)
            return CheckInVerificationResult(status: .invalidPass, guestName: "", householdName: nil, partySize: 0, alreadyCheckedInCount: 0, remainingCount: 0, tableNumber: nil, tableName: nil, gateMessage: "")
        }
        func updateVendorState(weddingId: String, id: String, state: VendorPresenceState) async throws -> VendorPresence {
            try graph(weddingId).vendors[0]
        }
        func postAnnouncement(weddingId: String, title: String, message: String, urgency: AnnouncementUrgency) async throws -> WeddingAnnouncement {
            try graph(weddingId).announcements[0]
        }
        func getWeddingPass(token: String) async throws -> WeddingPass { throw WeddingScopeMismatch(requestedWeddingId: token, availableWeddingIds: []) }
        func resolveInvitation(weddingSlug: String, token: String) async throws -> InvitationContext { throw WeddingScopeMismatch(requestedWeddingId: token, availableWeddingIds: []) }
        func confirmRsvp(weddingSlug: String, token: String, attending: Bool) async throws -> WeddingPass { throw WeddingScopeMismatch(requestedWeddingId: token, availableWeddingIds: []) }
    }

    func testWeddingAContextLoadsWeddingAGraph() async throws {
        let scoped = try await TwoWeddingTestRepository().forWedding(weddingA)
        let wedding = try await scoped.getWedding()
        XCTAssertEqual(wedding.id, weddingA)
        XCTAssertEqual(wedding.coupleNames, "Amara & Anesu")
        let guests = try await scoped.getGuests()
        XCTAssertEqual(guests.map(\.name), ["Guest A One"])
        let tasks = try await scoped.getTasks()
        XCTAssertEqual(tasks.map(\.title), ["Task A"])
    }

    func testWeddingBContextLoadsWeddingBGraph() async throws {
        let scoped = try await TwoWeddingTestRepository().forWedding(weddingB)
        let wedding = try await scoped.getWedding()
        XCTAssertEqual(wedding.id, weddingB)
        XCTAssertEqual(wedding.coupleNames, "Bongai & Blessing")
        let guests = try await scoped.getGuests()
        XCTAssertEqual(guests.map(\.name), ["Guest B One"])
        let tasks = try await scoped.getTasks()
        XCTAssertEqual(tasks.map(\.title), ["Task B"])
    }

    func testSwitchingContextCannotContinueRenderingPreviousWedding() async throws {
        let source = TwoWeddingTestRepository()
        let a = try await source.forWedding(weddingA)
        let b = try await source.forWedding(weddingB)

        let aGuests = try await a.getGuests().map(\.name)
        let bGuests = try await b.getGuests().map(\.name)
        XCTAssertNotEqual(aGuests, bGuests)
        XCTAssertTrue(bGuests.allSatisfy { !aGuests.contains($0) })
    }

    func testScopedRepositoryAlwaysReportsItsBoundWedding() async throws {
        let source = TwoWeddingTestRepository()
        let a = try await source.forWedding(weddingA)
        let b = try await source.forWedding(weddingB)
        XCTAssertEqual(a.weddingId, weddingA)
        XCTAssertEqual(b.weddingId, weddingB)
    }

    func testRequestingAnUnservedWeddingIsRejected() async throws {
        let source = TwoWeddingTestRepository()
        do {
            _ = try await source.forWedding("wed_not_mine")
            XCTFail("An unserved wedding must be rejected")
        } catch let mismatch as WeddingScopeMismatch {
            XCTAssertEqual(mismatch.requestedWeddingId, "wed_not_mine")
        }
    }

    func testSingleWeddingSourceRejectsAnyOtherWedding() async throws {
        let fixture = FixtureWeddingRepository()
        let own = try await fixture.availableWeddingIds()[0]
        let scoped = try await fixture.forWedding(own)
        let wedding = try await scoped.getWedding()
        XCTAssertEqual(wedding.id, own)

        do {
            _ = try await fixture.forWedding("wed_someone_else")
            XCTFail("A foreign wedding must be rejected")
        } catch is WeddingScopeMismatch {
            // expected
        }
    }

    func testDirectSourceCallsForForeignWeddingAreRefusedAtEveryRead() async throws {
        let shadow = ShadowReferenceWeddingRepository()
        let foreign = "wed_someone_else"

        for read in ["getWedding", "getGuests", "getTasks", "getBudget", "getVendors", "getAnnouncements", "getAuditRecords"] {
            do {
                switch read {
                case "getWedding": _ = try await shadow.getWedding(weddingId: foreign)
                case "getGuests": _ = try await shadow.getGuests(weddingId: foreign)
                case "getTasks": _ = try await shadow.getTasks(weddingId: foreign)
                case "getBudget": _ = try await shadow.getBudget(weddingId: foreign)
                case "getVendors": _ = try await shadow.getVendors(weddingId: foreign)
                case "getAnnouncements": _ = try await shadow.getAnnouncements(weddingId: foreign)
                default: _ = try await shadow.getAuditRecords(weddingId: foreign)
                }
                XCTFail("\(read) must refuse a foreign wedding")
            } catch is WeddingScopeMismatch {
                // expected
            }
        }
    }
}
