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

        let passGuest = try XCTUnwrap(guests.first(where: { $0.id == "shadow_guest_011" }))
        XCTAssertEqual(pass.guestName, passGuest.name)
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
        let guest = try XCTUnwrap(guests.first(where: { $0.id == "shadow_guest_011" }))

        XCTAssertEqual(guest.rsvpStatus, .declined)
        XCTAssertEqual(returned.currentStage, .invitation)
        XCTAssertEqual(returned.qrPayload, "SHADOW_DECLINED_NO_ADMISSION")
    }

    func testPlannerReferenceRelationshipsStayConnected() async throws {
        let planner = ShadowReferencePlannerRepository()
        let budget = try await planner.getBudgetLines()
        let contributions = try await planner.getContributions()
        let vendors = try await planner.getVendorEngagements()
        let seating = try await planner.getSeatingTables()
        let timeline = try await planner.getTimelineEntries()

        XCTAssertEqual(budget.count, 22)
        XCTAssertEqual(vendors.count, 7)
        XCTAssertEqual(seating.count, 8)
        XCTAssertEqual(timeline.count, 13)
        XCTAssertEqual(contributions.count, 4)

        for table in seating {
            XCTAssertLessThanOrEqual(table.assigned, table.capacity)
        }
    }

    func testPendingInvitationTransitionsToAttendingPassWithoutChangingAttendingFixtureGuest() async throws {
        let repository = ShadowReferenceWeddingRepository()

        let invitation = try await repository.resolveInvitation(
            weddingSlug: "shadow_ref_charity_kudzie",
            token: "shadow-pending-guest"
        )
        XCTAssertFalse(invitation.isConfirmed)
        XCTAssertEqual(invitation.guestName, "Guest G001")

        let pass = try await repository.confirmRsvp(
            weddingSlug: "shadow_ref_charity_kudzie",
            token: "shadow-pending-guest",
            attending: true
        )
        let guests = try await repository.getGuests()
        let converted = try XCTUnwrap(guests.first(where: { $0.id == "shadow_guest_001" }))
        let existing = try XCTUnwrap(guests.first(where: { $0.id == "shadow_guest_011" }))

        XCTAssertEqual(converted.rsvpStatus, .attending)
        XCTAssertNotNil(converted.passSerial)
        XCTAssertEqual(pass.guestName, converted.name)
        XCTAssertEqual(pass.currentStage, .attending)
        XCTAssertEqual(existing.rsvpStatus, .attending)
    }

    func testPartyOfFourCheckInLifecycle() async throws {
        let repository = ShadowReferenceWeddingRepository()
        let guests = try await repository.getGuests()
        let party4Guest = try XCTUnwrap(guests.first(where: { $0.id == "shadow_guest_007" }))
        XCTAssertEqual(party4Guest.partySize, 4)
        XCTAssertEqual(party4Guest.checkedInCount, 1)

        // 1. Partial check-in of 2 more guests (1 + 2 = 3 admitted, 1 remaining)
        let partial = try await repository.checkInGuest(qrPayload: "SHDWGSTP04", count: 2, usherId: "usher_1")
        XCTAssertEqual(partial.status, .partialCheckedIn)
        XCTAssertEqual(partial.alreadyCheckedInCount, 3)
        XCTAssertEqual(partial.remainingCount, 1)

        // 2. Capacity exceeded check (requesting 2 when 1 remaining)
        let exceeded = try await repository.checkInGuest(qrPayload: "SHDWGSTP04", count: 2, usherId: "usher_1")
        XCTAssertEqual(exceeded.status, .capacityExceeded)
        XCTAssertEqual(exceeded.remainingCount, 1)

        // 3. Complete check-in of last guest (3 + 1 = 4 admitted, 0 remaining)
        let complete = try await repository.checkInGuest(qrPayload: "SHDWGSTP04", count: 1, usherId: "usher_1")
        XCTAssertEqual(complete.status, .validPass)
        XCTAssertEqual(complete.alreadyCheckedInCount, 4)
        XCTAssertEqual(complete.remainingCount, 0)

        // 4. Duplicate scan
        let duplicate = try await repository.checkInGuest(qrPayload: "SHDWGSTP04", count: 1, usherId: "usher_1")
        XCTAssertEqual(duplicate.status, .alreadyCheckedIn)
        XCTAssertEqual(duplicate.remainingCount, 0)
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
