import XCTest
@testable import WewedKit

final class CompositionTests: XCTestCase {
    func testFixtureModeEnablesDemoSimulations() {
        let comp = AppComposition.fixture()
        XCTAssertTrue(comp.showDemoSimulations)
        if case .fixture = comp.mode {
            // expected
        } else {
            XCTFail("Expected .fixture mode")
        }
    }

    func testIsolatedModeEnablesDemoSimulations() {
        let comp = AppComposition.isolatedWeddingDay(
            baseURL: URL(string: "http://127.0.0.1:3000")!,
            bearerToken: "test_bearer",
            weddingId: "wed_test"
        )
        XCTAssertTrue(comp.showDemoSimulations)
        XCTAssertNotNil(comp.server)
        XCTAssertNotNil(comp.gate)
    }

    func testProductionModeDisablesDemoSimulations() {
        // Create a custom non-fixture repository to satisfy production requirement
        let customRepo = CustomMockWeddingRepository()
        let comp = AppComposition.production(
            baseURL: URL(string: "http://127.0.0.1:3000")!,
            bearerToken: "prod_bearer",
            weddingId: "wed_prod",
            trustedRootPublicKeyDerBase64: "dummyKey",
            base: customRepo
        )
        XCTAssertFalse(comp.showDemoSimulations)
        XCTAssertNotNil(comp.server)
        XCTAssertNotNil(comp.gate)
        if case .production = comp.mode {
            // expected
        } else {
            XCTFail("Expected .production mode")
        }
    }
}

private actor CustomMockWeddingRepository: WeddingRepositoryProtocol {
    func getWedding() async throws -> Wedding {
        throw NSError(domain: "test", code: 1)
    }
    func getTasks() async throws -> [PlannerTask] { [] }
    func createTask(title: String, priority: TaskPriority, category: String) async throws -> PlannerTask {
        throw NSError(domain: "test", code: 1)
    }
    func toggleTask(taskId: String) async throws -> PlannerTask {
        throw NSError(domain: "test", code: 1)
    }
    func getGuests() async throws -> [Guest] { [] }
    func getBudget() async throws -> BudgetSummary {
        BudgetSummary(currency: "USD", totalBudget: 0, totalAllocated: 0, totalPaid: 0, categories: [])
    }
    func getWeddingPass(token: String) async throws -> WeddingPass {
        throw NSError(domain: "test", code: 1)
    }
    func checkInGuest(qrPayload: String, count: Int, usherId: String) async throws -> CheckInVerificationResult {
        throw NSError(domain: "test", code: 1)
    }
    func searchGuests(query: String) async throws -> [Guest] { [] }
    func getAuditRecords() async throws -> [CheckInAuditRecord] { [] }
    func getVendors() async throws -> [VendorPresence] { [] }
    func updateVendorState(id: String, state: VendorPresenceState) async throws -> VendorPresence {
        throw NSError(domain: "test", code: 1)
    }
    func getAnnouncements() async throws -> [WeddingAnnouncement] { [] }
    func postAnnouncement(title: String, message: String, urgency: AnnouncementUrgency) async throws -> WeddingAnnouncement {
        throw NSError(domain: "test", code: 1)
    }
    func resolveInvitation(weddingSlug: String, token: String) async throws -> InvitationContext {
        throw NSError(domain: "test", code: 1)
    }
    func confirmRsvp(weddingSlug: String, token: String, attending: Bool) async throws -> WeddingPass {
        throw NSError(domain: "test", code: 1)
    }
}
