import XCTest
@testable import WewedKit

final class ShadowReferenceRepositoryTests: XCTestCase {
    func testShadowFactoryBuildsCoherentCharityAndKudzieGraph() async throws {
        let bundle = try NativeRepositoryFactory.make(environment: .shadow)
        XCTAssertEqual(bundle.environment, .shadow)

        let wedding = try await bundle.wedding.getWedding()
        let dashboard = try await bundle.planner.getDashboard()
        let invitation = try await bundle.wedding.resolveInvitation(
            weddingSlug: wedding.id,
            token: "native-reference-guest"
        )
        let pass = try await bundle.wedding.getWeddingPass(token: "native-reference-guest")
        let guests = try await bundle.wedding.getGuests()

        XCTAssertEqual(wedding.coupleNames, "Charity & Kudzie")
        XCTAssertEqual(dashboard.coupleNames, wedding.coupleNames)
        XCTAssertEqual(invitation.coupleNames, wedding.coupleNames)
        XCTAssertEqual(pass.weddingId, wedding.id)
        XCTAssertEqual(pass.coupleNames, wedding.coupleNames)

        let passGuest = try XCTUnwrap(guests.first(where: { $0.id == "shadow_guest_a" }))
        XCTAssertEqual(pass.guestName, passGuest.name)
        XCTAssertEqual(pass.householdName, passGuest.householdName)
        XCTAssertEqual(pass.tableName, passGuest.tableName)
        XCTAssertTrue(pass.qrPayload.contains("NOT_A_PRODUCTION_CREDENTIAL"))
    }

    func testShadowDeclineChangesGuestStateWithoutGrantingAdmissionStage() async throws {
        let repository = ShadowReferenceWeddingRepository()

        let returned = try await repository.confirmRsvp(
            weddingSlug: "shadow_ref_charity_kudzie",
            token: "native-reference-guest",
            attending: false
        )
        let guests = try await repository.getGuests()
        let guest = try XCTUnwrap(guests.first(where: { $0.id == "shadow_guest_a" }))

        XCTAssertEqual(guest.rsvpStatus, .declined)
        XCTAssertEqual(returned.currentStage, .invitation)
        XCTAssertEqual(returned.qrPayload, "SHADOW_DECLINED_NO_ADMISSION")
    }

    func testPlannerReferenceRelationshipsStayConnected() async throws {
        let planner = FixturePlannerDashboardRepository()
        let budget = try await planner.getBudgetLines()
        let contributions = try await planner.getContributions()
        let vendors = try await planner.getVendorEngagements()
        let seating = try await planner.getSeatingTables()
        let timeline = try await planner.getTimelineEntries()

        let vendorNames = Set(vendors.map(\.vendorName))
        for line in budget {
            if let vendorName = line.vendorName {
                XCTAssertTrue(vendorNames.contains(vendorName), "Budget vendor must exist in Vendor engagements: \(vendorName)")
            }
        }

        let budgetCategories = Set(budget.map(\.category))
        for contribution in contributions where contribution.allocationLabel != "Unallocated" {
            XCTAssertTrue(
                budgetCategories.contains(contribution.allocationLabel) || contribution.allocationLabel == "Transport",
                "Contribution allocation must map to a represented budget domain or an explicitly pending category."
            )
        }

        for table in seating {
            XCTAssertLessThanOrEqual(table.assigned, table.capacity)
        }

        for entry in timeline {
            if let linkedVendor = entry.linkedVendor {
                XCTAssertTrue(vendorNames.contains(linkedVendor), "Timeline vendor must exist in Vendor engagements: \(linkedVendor)")
            }
        }
    }

    func testProductionRepositoryModesRemainLocked() {
        XCTAssertThrowsError(try NativeRepositoryFactory.make(environment: .productionReadVerify))
        XCTAssertThrowsError(try NativeRepositoryFactory.make(environment: .production))
    }

    func testShadowHTTPContractRejectsProductionHostAndDefaultsToNoTransport() async throws {
        XCTAssertThrowsError(
            try ShadowRepositoryConfiguration(
                baseURL: URL(string: "https://wewed.pro")!,
                environment: .shadow
            )
        )

        let configuration = try ShadowRepositoryConfiguration(
            baseURL: URL(string: "http://127.0.0.1:8787")!,
            environment: .shadow
        )
        let repository = ShadowPlannerHTTPRepository(configuration: configuration)

        do {
            _ = try await repository.getDashboard()
            XCTFail("Unconfigured Shadow transport must never perform network traffic.")
        } catch let error as ShadowAPIError {
            XCTAssertEqual(error, .transportNotConfigured)
        }
    }
}
