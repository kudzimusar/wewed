import XCTest
@testable import WewedKit

final class PlannerDashboardRepositoryTests: XCTestCase {
    func testFixtureDashboardIsExplicitlySanitizedAndPlannerComplete() async throws {
        let repository = FixturePlannerDashboardRepository()
        let dashboard = try await repository.getDashboard()

        XCTAssertEqual(dashboard.coupleNames, "Charity & Kudzie")
        XCTAssertEqual(dashboard.plannerContext, "Eleven Eleven Testing")
        XCTAssertEqual(dashboard.readinessScore, 78)
        XCTAssertEqual(Set(dashboard.modules.map(\.id)), Set(["tasks", "budget", "contributions", "vendors", "guests", "seating", "timeline"]))
        XCTAssertTrue(dashboard.sourceLabel.contains("NOT production snapshot"))
        XCTAssertFalse(dashboard.attentionItems.isEmpty)
    }

    func testDataEnvironmentPreventsMutableProductionDevelopment() {
        XCTAssertTrue(NativeDataEnvironment.fixture.allowsMutableNativeDevelopment)
        XCTAssertTrue(NativeDataEnvironment.shadow.allowsMutableNativeDevelopment)
        XCTAssertFalse(NativeDataEnvironment.productionReadVerify.allowsMutableNativeDevelopment)
        XCTAssertFalse(NativeDataEnvironment.production.allowsMutableNativeDevelopment)
    }
}
