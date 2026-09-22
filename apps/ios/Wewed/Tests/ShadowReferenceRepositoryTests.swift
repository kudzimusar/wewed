import XCTest
@testable import WewedKit

final class ShadowReferenceRepositoryTests: XCTestCase {
    func testShadowFactoryBuildsCoherentCharityAndKudzieGraph() async throws {
        let bundle = try NativeRepositoryFactory.make(environment: .shadow)
        XCTAssertEqual(bundle.environment, .shadow)

        let wedding = try await bundle.wedding.forOnlyWedding().getWedding()
        let dashboard = try await bundle.planner.getDashboard()
        let invitation = try await bundle.wedding.resolveInvitation(
            weddingSlug: wedding.id,
            token: "native-reference-guest"
        )
        let pass = try await bundle.wedding.getWeddingPass(token: "native-reference-guest")
        let guests = try await bundle.wedding.forOnlyWedding().getGuests()

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
        let repository = try await ShadowReferenceWeddingRepository().forOnlyWedding()

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
        let repository = try await ShadowReferenceWeddingRepository().forOnlyWedding()

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
        let repository = try await ShadowReferenceWeddingRepository().forOnlyWedding()
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

    func testProductionReadVerifyStaysLockedWhilePhase5ProductionUsesBoundaryRepositories() throws {
        XCTAssertThrowsError(try NativeRepositoryFactory.make(environment: .productionReadVerify))

        let production = try NativeRepositoryFactory.make(environment: .production)
        XCTAssertTrue(production.wedding is ProductionBoundaryWeddingRepository)
        XCTAssertTrue(production.planner is ProductionBoundaryPlannerRepository)
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

    func testSanitizedShadowEnvironmentFactoryBuildsValidBundle() throws {
        let bundle = try NativeRepositoryFactory.make(environment: .sanitizedShadow)
        XCTAssertEqual(bundle.environment, .sanitizedShadow)
    }

    func testPrivateRealShadowLoadsWhenSnapshotAvailable() async throws {
        let snapshotPath = PrivateRealShadowWeddingRepository.defaultSnapshotPath()
        guard FileManager.default.fileExists(atPath: snapshotPath) else {
            // If fixture is not present, make should throw privateRealShadowFixtureMissing
            XCTAssertThrowsError(try NativeRepositoryFactory.make(environment: .privateRealShadow))
            return
        }

        let bundle = try NativeRepositoryFactory.make(environment: .privateRealShadow)
        XCTAssertEqual(bundle.environment, .privateRealShadow)

        let wedding = try await bundle.wedding.forOnlyWedding().getWedding()
        let guests = try await bundle.wedding.forOnlyWedding().getGuests()
        let tasks = try await bundle.wedding.forOnlyWedding().getTasks()
        let budget = try await bundle.wedding.forOnlyWedding().getBudget()
        let vendors = try await bundle.wedding.forOnlyWedding().getVendors()
        let announcements = try await bundle.wedding.forOnlyWedding().getAnnouncements()
        let dashboard = try await bundle.planner.getDashboard()
        let budgetLines = try await bundle.planner.getBudgetLines()
        let contributions = try await bundle.planner.getContributions()
        let vendorEngagements = try await bundle.planner.getVendorEngagements()
        let seatingTables = try await bundle.planner.getSeatingTables()
        let timelineEntries = try await bundle.planner.getTimelineEntries()
        let documents = try await bundle.planner.getDocuments()

        // 1. Wedding metadata
        XCTAssertEqual(wedding.coupleNames, "Charity & Kudzie")
        XCTAssertEqual(wedding.venueName, "Imba Manor")
        XCTAssertEqual(wedding.city, "Harare")
        XCTAssertEqual(wedding.country, "Zimbabwe")
        XCTAssertEqual(wedding.lifecycle, "before")

        // 2. Tasks (42 tasks, 7 done, 8 high priority)
        XCTAssertEqual(tasks.count, 42)
        XCTAssertEqual(tasks.filter { $0.status == .done }.count, 7)
        XCTAssertEqual(tasks.filter { $0.priority == .high }.count, 13)

        // 3. Guests.
        //
        // Reconciled 2026-09-20: production moved from 174 to 175 guests because one bridal-party
        // guest was created on 2026-09-19, after the September-18 export. All 175 are scoped to
        // this wedding, all 175 have exactly one RSVP row, and there are no orphans. 175 rows
        // carry 174 distinct names: one name is held by two separate production rows created six
        // minutes apart with different sides and roles. Both are rendered — deduplicating them
        // here would hide a production fact.
        //
        // The count is asserted against the snapshot's own manifest as well as the reconciled
        // number, so a stale snapshot fails loudly instead of quietly re-baselining.
        let manifest = try await bundle.wedding.forOnlyWedding().snapshotManifest()
        XCTAssertNotNil(manifest, "Private Real UAT snapshot must carry a manifest")
        XCTAssertEqual(manifest?.schemaVersion, "private-real-uat/2")
        XCTAssertEqual(manifest?.count("guests"), guests.count)
        XCTAssertEqual(guests.count, 175)
        XCTAssertEqual(Set(guests.map { $0.name }).count, 174)
        let guestPseudonymRegex = try NSRegularExpression(pattern: #"Guest G\d+"#)
        for guest in guests {
            let range = NSRange(location: 0, length: guest.name.utf16.count)
            XCTAssertNil(guestPseudonymRegex.firstMatch(in: guest.name, options: [], range: range), "Guest name \(guest.name) must not match pseudonym pattern")
        }
        let totalInvitedCapacity = guests.reduce(0) { $0 + $1.partySize }
        // Party size is derived from the real RSVP row (guest + confirmed plus-one + children),
        // because production's Guest table has no partySize column.
        XCTAssertEqual(totalInvitedCapacity, 178)
        XCTAssertEqual(guests.filter { $0.rsvpStatus == .attending }.count, 2)
        XCTAssertEqual(guests.filter { $0.rsvpStatus == .pending }.count, 173)
        XCTAssertEqual(guests.filter { $0.rsvpStatus == .declined }.count, 0)
        let attendingPassSerials = guests
            .filter { $0.rsvpStatus == .attending }
            .compactMap { $0.passSerial }
        XCTAssertEqual(attendingPassSerials.count, 2)
        XCTAssertEqual(Set(attendingPassSerials).count, attendingPassSerials.count)
        XCTAssertTrue(attendingPassSerials.allSatisfy { $0.hasPrefix("SHDW") })

        // 4. Seating Tables (8 tables, 22 assigned, 64 capacity, 42 free)
        XCTAssertEqual(seatingTables.count, 8)
        let totalSeatingCapacity = seatingTables.reduce(0) { $0 + $1.capacity }
        let totalAssigned = seatingTables.reduce(0) { $0 + $1.assigned }
        XCTAssertEqual(totalSeatingCapacity, 64)
        XCTAssertEqual(totalAssigned, 22)
        XCTAssertEqual(totalSeatingCapacity - totalAssigned, 42)

        // 5. Budget (22 lines, $30,380 est, $8,690 act, $3,875 paid)
        XCTAssertEqual(budgetLines.count, 22)
        XCTAssertEqual(budget.totalBudget, 30380)
        XCTAssertEqual(budget.totalAllocated, 8690)
        XCTAssertEqual(budget.totalPaid, 3875)

        // 6. Vendors (7 vendors, 8 service engagements)
        XCTAssertEqual(vendors.count, 7)
        XCTAssertEqual(vendorEngagements.count, 8)

        // 7. Contributions (4 non-monetary guest contributions).
        // Do not commit private contributor names into the test contract.
        XCTAssertEqual(contributions.count, 4)
        let contributorPseudonymRegex = try NSRegularExpression(pattern: #"Guest Contributor|Guest G\d+"#)
        for contribution in contributions {
            XCTAssertEqual(contribution.value, 0.0)
            XCTAssertFalse(contribution.contributorLabel.isEmpty)
            let range = NSRange(location: 0, length: contribution.contributorLabel.utf16.count)
            XCTAssertNil(contributorPseudonymRegex.firstMatch(in: contribution.contributorLabel, options: [], range: range), "Contribution author must not match generic pseudonym")
            XCTAssertFalse(contribution.typeLabel.isEmpty)
            XCTAssertFalse(contribution.allocationLabel.isEmpty)
        }
        let contributionModule = try XCTUnwrap(dashboard.modules.first(where: { $0.id == "contributions" }))
        XCTAssertEqual(contributionModule.value, "4 messages")
        XCTAssertEqual(contributionModule.attention, "Non-monetary")

        // 8. Timeline (13 programme items)
        XCTAssertEqual(timelineEntries.count, 13)

        // 9. Documents/contracts and announcements are honest real empty states.
        XCTAssertEqual(documents.count, 0)
        XCTAssertEqual(announcements.count, 0)

        // 10. Planner Dashboard
        XCTAssertEqual(dashboard.plannerContext, "Eleven Eleven Testing")
        XCTAssertEqual(dashboard.taskCompletionLabel, "7 / 42")
    }

    func testPrivateRealShadowInvitationToRsvpToPassUsesSameGuest() async throws {
        let snapshotPath = PrivateRealShadowWeddingRepository.defaultSnapshotPath()
        guard FileManager.default.fileExists(atPath: snapshotPath) else { return }

        let bundle = try NativeRepositoryFactory.make(environment: .privateRealShadow)
        let wedding = try await bundle.wedding.forOnlyWedding().getWedding()

        // 1. Resolve pending invitation
        let invitation = try await bundle.wedding.resolveInvitation(
            weddingSlug: wedding.id,
            token: "shadow-pending-guest"
        )
        XCTAssertFalse(invitation.isConfirmed)
        let pseudonymRegex = try NSRegularExpression(pattern: #"Guest G\d+"#)
        let range = NSRange(location: 0, length: invitation.guestName.utf16.count)
        XCTAssertNil(pseudonymRegex.firstMatch(in: invitation.guestName, options: [], range: range))

        // 2. Accept RSVP
        let pass = try await bundle.wedding.confirmRsvp(
            weddingSlug: wedding.id,
            token: "shadow-pending-guest",
            attending: true
        )
        XCTAssertEqual(invitation.guestName, pass.guestName)
        XCTAssertEqual(pass.currentStage, .attending)
        XCTAssertTrue(pass.qrPayload.hasPrefix("REAL_SHADOW_ONLY"))

        // 3. Get wedding pass
        let retrievedPass = try await bundle.wedding.getWeddingPass(token: pass.token)
        XCTAssertEqual(invitation.guestName, retrievedPass.guestName)
        XCTAssertEqual(pass.qrPayload, retrievedPass.qrPayload)

        // 4. Verify guest roster state
        let guests = try await bundle.wedding.forOnlyWedding().getGuests()
        let updatedGuest = try XCTUnwrap(guests.first(where: { $0.name == invitation.guestName }))
        XCTAssertEqual(updatedGuest.rsvpStatus, .attending)
        XCTAssertNotNil(updatedGuest.passSerial)
    }

    func testMapsUriQueryConstruction() {
        let venueName = "Imba Manor"
        let venueCity = "Harare, Zimbabwe"
        let queryAddress = "\(venueName), \(venueCity)".trimmingCharacters(in: .whitespacesAndNewlines)
        let encoded = queryAddress.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let appleMapsUrl = "maps:?q=\(encoded)"
        let googleMapsUrl = "https://www.google.com/maps/search/?api=1&query=\(encoded)"

        XCTAssertEqual(appleMapsUrl, "maps:?q=Imba%20Manor,%20Harare,%20Zimbabwe")
        XCTAssertEqual(googleMapsUrl, "https://www.google.com/maps/search/?api=1&query=Imba%20Manor,%20Harare,%20Zimbabwe")
    }

    func testPrivateRealShadowZeroProhibitedDemoData() {
        let prohibitedNames = [
            "Faith Mutasa",
            "Uncle Farai",
            "Auntie Chipo",
            "Tony M.",
            "Chiedza Nyoni",
            "Ruvimbo & Farai",
            "Chido & Tinashe",
            "Honeyfund"
        ]

        for persona in DevelopmentPersona.allPersonas {
            for prohibited in prohibitedNames {
                XCTAssertFalse(persona.name.contains(prohibited), "Persona name \(persona.name) contains prohibited demo string \(prohibited)")
            }
        }
    }

    func testPrivateRealShadowFailsExplicitlyWhenFixtureMissing() {
        XCTAssertThrowsError(
            try PrivateRealShadowWeddingRepository(path: "/nonexistent/path/fixture.json")
        ) { error in
            guard case NativeRepositoryFactoryError.privateRealShadowFixtureMissing(let msg) = error else {
                XCTFail("Expected privateRealShadowFixtureMissing but got \(error)")
                return
            }
            XCTAssertTrue(msg.contains("Private real shadow fixture not found"))
        }

        XCTAssertThrowsError(
            try PrivateRealShadowPlannerRepository(path: "/nonexistent/path/fixture.json")
        ) { error in
            guard case NativeRepositoryFactoryError.privateRealShadowFixtureMissing(let msg) = error else {
                XCTFail("Expected privateRealShadowFixtureMissing but got \(error)")
                return
            }
            XCTAssertTrue(msg.contains("Private real shadow fixture not found"))
        }
    }
}
