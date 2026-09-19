import XCTest
@testable import WewedKit

/// Mirrors Android RoleArchitectureTest: same policy matrix, same denials, same test vectors.
final class RoleArchitectureTests: XCTestCase {
    private func matchesPseudonym(_ value: String) -> Bool {
        value.range(of: #"Guest G\d+"#, options: .regularExpression) != nil
    }

    private func sanitized() throws -> NativeRepositoryBundle {
        try NativeRepositoryFactory.make(environment: .sanitizedShadow)
    }

    private func privateOrNil() throws -> NativeRepositoryBundle? {
        guard FileManager.default.fileExists(atPath: PrivateRealShadowWeddingRepository.defaultSnapshotPath()) else { return nil }
        return try NativeRepositoryFactory.make(environment: .privateRealShadow)
    }

    private func session(_ bundle: NativeRepositoryBundle, _ account: ShadowAccount, token: String? = nil) async throws -> AuthorizedSession {
        try await SessionAuthority.signIn(account: account, environment: bundle.environment, wedding: bundle.wedding, planner: bundle.planner, invitationToken: token)
    }

    private func access(_ bundle: NativeRepositoryBundle, _ grant: RoleGrant, audit: AdminAuditLog = AdminAuditLog()) -> RoleScopedAccess {
        RoleScopedAccess(grant: grant, wedding: bundle.wedding, planner: bundle.planner, audit: audit)
    }

    private func assertDenied<T>(_ work: () async throws -> T, file: StaticString = #filePath, line: UInt = #line) async {
        do {
            _ = try await work()
            XCTFail("Expected AccessDeniedError", file: file, line: line)
        } catch is AccessDeniedError {
        } catch {
            XCTFail("Expected AccessDeniedError, got \(error)", file: file, line: line)
        }
    }

    // MARK: Capability matrix

    func testGuestVendorUsherNeverHoldManagementCapabilities() {
        let management: Set<Capability> = [
            .viewGuestRoster, .viewBudget, .viewAllVendorEngagements, .viewContributions, .viewContributorIdentity,
            .viewDocuments, .viewSeating, .plannerWorkspace, .plannerActions, .editWeddingDetails, .adminSupport
        ]
        for role in [AppRole.guest, .vendor, .usher] {
            XCTAssertTrue(CapabilityPolicy.capabilities(for: role).intersection(management).isEmpty, "\(role)")
        }
        XCTAssertTrue(CapabilityPolicy.capabilities(for: .coordinator)
            .intersection([.viewGuestRoster, .viewBudget, .viewAllVendorEngagements, .viewContributions]).isEmpty)
    }

    func testPlannerWorkspaceIsPlannerOnlyAndAdminIsSupportOnly() {
        for role in AppRole.allCases {
            XCTAssertEqual(CapabilityPolicy.allows(role, .plannerWorkspace), role == .planner)
            XCTAssertEqual(CapabilityPolicy.allows(role, .plannerActions), role == .planner)
            XCTAssertEqual(CapabilityPolicy.allows(role, .adminSupport), role == .admin)
        }
        XCTAssertEqual(CapabilityPolicy.capabilities(for: .admin), [.viewWeddingSummary, .adminSupport])
        XCTAssertEqual(
            CapabilityPolicy.capabilities(for: .guest),
            [.viewWeddingSummary, .viewProgramme, .viewOwnInvitation, .respondOwnRsvp, .viewOwnPass]
        )
    }

    func testUnknownRoleIdNeverDefaultsToARole() {
        XCTAssertNil(AppRole.from(roleId: "superuser"))
        XCTAssertNil(AppRole.from(roleId: ""))
        XCTAssertEqual(AppRole.from(roleId: "Planner"), .planner)
    }

    // MARK: Session authority

    func testSanitizedSessionsCarryHonestProvenance() async throws {
        let bundle = try sanitized()
        let couple = try await session(bundle, .couple)
        XCTAssertEqual(couple.grants.map(\.role), [.couple])
        XCTAssertEqual(couple.grants.first?.provenance, .sanitizedFixture)
        XCTAssertFalse(couple.requiresRoleChoice)

        let planner = try await session(bundle, .planner).grants[0]
        XCTAssertEqual(planner.role, .planner)
        XCTAssertEqual(planner.provenance, .shadowTestOverlay)
        XCTAssertTrue(planner.provenanceNote.localizedCaseInsensitiveContains("no planner engagement"))

        let both = try await session(bundle, .coupleAndPlanner)
        XCTAssertTrue(both.requiresRoleChoice)
        XCTAssertEqual(Set(both.grants.map(\.role)), [.couple, .planner])

        let vendor = try await session(bundle, .vendor).grants[0]
        XCTAssertNotNil(vendor.vendorId)
        XCTAssertEqual(vendor.provenance, .shadowTestOverlay)

        for account in [ShadowAccount.usher, .coordinator, .admin] {
            let grants = try await session(bundle, account).grants
            XCTAssertTrue(grants.allSatisfy(\.isTestOverlay))
        }
    }

    func testPrivateRealCoupleIsSourceBackedAndPlannerIsExplicitOverlay() async throws {
        guard let bundle = try privateOrNil() else { return }
        let couple = try await session(bundle, .couple)
        XCTAssertEqual(couple.grants[0].provenance, .sourceRecord)
        // Source truth has WeddingMembership=0 / PlannerEngagement=0: never present planner access as a real relationship.
        let planner = try await session(bundle, .planner)
        XCTAssertEqual(planner.grants[0].provenance, .shadowTestOverlay)
        let vendor = try await session(bundle, .vendor)
        XCTAssertFalse(matchesPseudonym(vendor.displayName))
    }

    func testProductionSignInIsUnavailable() async throws {
        let bundle = try sanitized()
        do {
            _ = try await SessionAuthority.signIn(account: .couple, environment: .production, wedding: bundle.wedding, planner: bundle.planner)
            XCTFail("Production sign-in must not be simulated")
        } catch SessionAuthorityError.productionAuthenticationUnavailable {
        }
    }

    func testUnknownInvitationIsRejected() async throws {
        let bundle = try sanitized()
        do {
            _ = try await SessionAuthority.signInWithInvitation(token: "not-a-real-invitation", environment: bundle.environment, wedding: bundle.wedding)
            XCTFail("Unknown invitation must not produce a guest session")
        } catch SessionAuthorityError.invitationNotRecognised {
        }
    }

    // MARK: Scoped access

    func testGuestSeesOnlyOwnInvitationAndPass() async throws {
        let bundle = try sanitized()
        let grant = try await session(bundle, .guest, token: "shadow-pending-guest").grants[0]
        let guest = access(bundle, grant)

        await assertDenied { try await guest.guestRoster() }
        await assertDenied { try await guest.searchGuests(query: "G") }
        await assertDenied { try await guest.budget() }
        await assertDenied { try await guest.budgetLines() }
        await assertDenied { try await guest.vendorEngagements() }
        await assertDenied { try await guest.contributions() }
        await assertDenied { try await guest.seating() }
        await assertDenied { try await guest.documents() }
        await assertDenied { try await guest.dashboard() }
        await assertDenied { try await guest.admissionLookup(query: "Guest") }
        await assertDenied { try await guest.previewGuestPass(token: "shadow-attending-guest") }

        _ = try await guest.weddingSummary()
        let programme = try await guest.programme()
        XCTAssertFalse(programme.isEmpty)
    }

    func testInvitationToRsvpToPassStaysBoundToTheSameGuestSanitized() async throws {
        _ = try await assertGuestJourney(try sanitized())
    }

    func testInvitationToRsvpToPassStaysBoundToTheSameGuestPrivateReal() async throws {
        guard let bundle = try privateOrNil() else { return }
        let grant = try await assertGuestJourney(bundle)
        // In private mode the personalised name must be the authorized runtime identity, never a pseudonym.
        let name = try await access(bundle, grant).ownInvitation().guestName
        XCTAssertFalse(matchesPseudonym(name))
    }

    private func assertGuestJourney(_ bundle: NativeRepositoryBundle) async throws -> RoleGrant {
        let authorized = try await session(bundle, .guest, token: "shadow-pending-guest")
        let grant = authorized.grants[0]
        XCTAssertEqual(grant.provenance, .invitationToken)
        let guest = access(bundle, grant)

        let invitation = try await guest.ownInvitation()
        XCTAssertFalse(invitation.isConfirmed)
        XCTAssertEqual(invitation.guestId, grant.guestId)
        XCTAssertEqual(invitation.guestName, authorized.displayName)
        let beforeAccept = try await guest.ownPass()
        XCTAssertNil(beforeAccept, "No admission pass before accepting")

        let issued = try await guest.respondToOwnInvitation(attending: true)
        XCTAssertEqual(issued.guestName, invitation.guestName)
        XCTAssertEqual(issued.guestId, grant.guestId)
        XCTAssertEqual(issued.currentStage, .attending)

        // The fixed "pending" test token now points at a different pending guest; the session must not follow it.
        let maybePass = try await guest.ownPass()
        let pass = try XCTUnwrap(maybePass)
        XCTAssertEqual(pass.guestName, invitation.guestName)
        XCTAssertEqual(pass.guestId, grant.guestId)
        XCTAssertEqual(pass.qrPayload, issued.qrPayload)
        let reread = try await guest.ownInvitation()
        XCTAssertEqual(reread.guestName, invitation.guestName)
        XCTAssertTrue(reread.isConfirmed)

        let roster = try await bundle.wedding.getGuests()
        let rosterRow = try XCTUnwrap(roster.first { $0.id == grant.guestId })
        XCTAssertEqual(rosterRow.rsvpStatus, .attending)
        XCTAssertNotNil(rosterRow.passSerial)
        return grant
    }

    func testVendorSeesOnlyOwnEngagementAndPresence() async throws {
        let bundle = try sanitized()
        let grant = try await session(bundle, .vendor).grants[0]
        let vendor = access(bundle, grant)

        let engagements = try await vendor.vendorEngagements()
        XCTAssertEqual(engagements.count, 1)
        XCTAssertEqual(engagements.first?.vendorId, grant.vendorId)
        let presence = try await vendor.vendorPresence()
        XCTAssertEqual(presence.map(\.id), [grant.vendorId].compactMap { $0 })

        await assertDenied { try await vendor.guestRoster() }
        await assertDenied { try await vendor.budget() }
        await assertDenied { try await vendor.contributions() }
        await assertDenied { try await vendor.admissionLookup(query: "Guest") }
        await assertDenied { try await vendor.tasks() }

        let updated = try await vendor.updateOwnVendorPresence(.arrived)
        XCTAssertEqual(updated.id, grant.vendorId)
        let others = try await bundle.wedding.getVendors().filter { $0.id != grant.vendorId }
        XCTAssertTrue(others.allSatisfy { $0.state != .arrived })
    }

    func testUsherGetsGateDataOnly() async throws {
        let bundle = try sanitized()
        let usher = access(bundle, try await session(bundle, .usher).grants[0])
        await assertDenied { try await usher.guestRoster() }
        await assertDenied { try await usher.budget() }
        await assertDenied { try await usher.vendorEngagements() }
        await assertDenied { try await usher.tasks() }

        let rows = try await usher.admissionLookup(query: "Guest G0")
        let attendingIds = Set(try await bundle.wedding.getGuests().filter { $0.rsvpStatus == .attending }.map(\.id))
        XCTAssertFalse(rows.isEmpty)
        XCTAssertTrue(rows.allSatisfy { attendingIds.contains($0.guestId) }, "Lookup returns attending guests only")
        let tooShort = try await usher.admissionLookup(query: "G")
        XCTAssertTrue(tooShort.isEmpty, "Lookup needs at least two characters")

        let summary = try await usher.admissionSummary()
        XCTAssertEqual(summary.attendingParties, attendingIds.count)
    }

    func testCoordinatorRunsTheDayWithoutFinancialsOrRoster() async throws {
        let bundle = try sanitized()
        let coordinator = access(bundle, try await session(bundle, .coordinator).grants[0])
        let tasks = try await coordinator.tasks()
        XCTAssertFalse(tasks.isEmpty)
        let presence = try await coordinator.vendorPresence()
        XCTAssertFalse(presence.isEmpty)
        await assertDenied { try await coordinator.createTask(title: "x", priority: .low, category: "x") }
        await assertDenied { try await coordinator.budget() }
        await assertDenied { try await coordinator.guestRoster() }
        await assertDenied { try await coordinator.vendorEngagements() }
    }

    func testAdminReadsAreExplicitAndAudited() async throws {
        let bundle = try sanitized()
        let audit = AdminAuditLog()
        let admin = access(bundle, try await session(bundle, .admin).grants[0], audit: audit)
        await assertDenied { try await admin.guestRoster() }
        await assertDenied { try await admin.budget() }
        let before = try await admin.auditEntries()
        XCTAssertTrue(before.isEmpty)

        let count = try await admin.supportRead(section: "Guest list") { wedding, _ in try await wedding.getGuests().count }
        XCTAssertEqual(count, 174)
        let entries = try await admin.auditEntries()
        XCTAssertEqual(entries.map(\.section), ["Guest list"])

        let couple = access(bundle, try await session(bundle, .couple).grants[0])
        await assertDenied { try await couple.supportRead(section: "x") { _, _ in 0 } }
    }

    func testOnlyCoupleAndPlannerMayEditWeddingDetails() async throws {
        let bundle = try sanitized()
        let guest = access(bundle, try await session(bundle, .guest, token: "shadow-pending-guest").grants[0])
        let update = WeddingDetailsUpdate(coupleNames: "Charity & Kudzie", date: "2026-12-23 14:00:00", venueName: "Imba Manor", city: "Harare", country: "Zimbabwe")
        await assertDenied { try await guest.updateWeddingDetails(update) }

        let planner = access(bundle, try await session(bundle, .planner).grants[0])
        let edited = try await planner.updateWeddingDetails(
            WeddingDetailsUpdate(coupleNames: "Charity & Kudzie", date: "2026-12-23 14:00:00", venueName: "Imba Manor Gardens", city: "Harare", country: "Zimbabwe")
        )
        XCTAssertEqual(edited.venueName, "Imba Manor Gardens")
        let invitation = try await bundle.wedding.resolveInvitation(weddingSlug: edited.id, token: "shadow-attending-guest")
        XCTAssertEqual(invitation.venueName, "Imba Manor Gardens")
    }

    // MARK: Contributions

    func testSanitizedContributionsResolveToTheirPseudonymousGuests() async throws {
        let bundle = try sanitized()
        let roster = Dictionary(uniqueKeysWithValues: try await bundle.wedding.getGuests().map { ($0.id, $0) })
        let records = try await bundle.planner.getContributions()
        XCTAssertEqual(records.count, 4)
        for record in records {
            XCTAssertNotEqual(record.contributorLabel, "Guest Contributor")
            let guest = try XCTUnwrap(roster[record.contributorGuestId ?? ""], "Contribution \(record.id) must reference a roster guest")
            XCTAssertEqual(record.contributorLabel, guest.name)
            XCTAssertEqual(record.contributorResolution, .resolved)
            XCTAssertEqual(record.value, 0)
            XCTAssertNotNil(record.wordCount)
        }
    }

    func testPrivateContributionsResolveRealContributorsWithoutGenericFallback() async throws {
        guard let bundle = try privateOrNil() else { return }
        let roster = Dictionary(uniqueKeysWithValues: try await bundle.wedding.getGuests().map { ($0.id, $0) })
        let records = try await bundle.planner.getContributions()
        XCTAssertEqual(records.count, 4)
        for record in records {
            XCTAssertFalse(record.contributorLabel.contains("Guest Contributor"))
            XCTAssertFalse(matchesPseudonym(record.contributorLabel))
            if record.contributorResolution == .resolved {
                XCTAssertEqual(record.contributorLabel, roster[record.contributorGuestId ?? ""]?.name)
            } else {
                XCTAssertEqual(record.contributorLabel, "Contributor not recorded")
            }
            // The export excludes message bodies; nothing may be invented in their place.
            XCTAssertNil(record.messageText)
            XCTAssertNotEqual(record.allocationLabel, "Non-monetary contribution")
            XCTAssertEqual(record.value, 0)
        }
    }

    func testContributorIdentityIsGovernedByRoleAndPrivacy() {
        let base = PlannerContributionRecord(
            id: "c1", contributorLabel: "Real Name", typeLabel: "Blessing", value: 0, statusLabel: "Approved",
            allocationLabel: "Guest messages", verified: true, contributorGuestId: "g1", privacyLabel: "Public"
        )
        XCTAssertEqual(RoleScopedAccess.redactContributor(base, roleMayIdentify: true).contributorLabel, "Real Name")
        let hidden = RoleScopedAccess.redactContributor(base, roleMayIdentify: false)
        XCTAssertEqual(hidden.contributorResolution, .hidden)
        XCTAssertNil(hidden.contributorGuestId)
        let anonymous = PlannerContributionRecord(
            id: "c2", contributorLabel: "Real Name", typeLabel: "Blessing", value: 0, statusLabel: "Approved",
            allocationLabel: "Guest messages", verified: true, contributorGuestId: "g1", privacyLabel: "Anonymous"
        )
        XCTAssertEqual(RoleScopedAccess.redactContributor(anonymous, roleMayIdentify: true).contributorLabel, "Anonymous")
        let absent = PlannerContributionRecord(
            id: "c3", contributorLabel: "Contributor not recorded", typeLabel: "Blessing", value: 0, statusLabel: "Approved",
            allocationLabel: "Guest messages", verified: true, contributorResolution: .notRecorded
        )
        XCTAssertEqual(RoleScopedAccess.redactContributor(absent, roleMayIdentify: false), absent)
    }

    // MARK: Venue navigation (same vectors as Android)

    func testMapsLinksAreBuiltFromTheVenueRecord() throws {
        let links = try XCTUnwrap(MapsLinkBuilder.build(VenueLocation(name: "Imba Manor", city: "Harare", country: "Zimbabwe")))
        XCTAssertEqual(links.displayQuery, "Imba Manor, Harare, Zimbabwe")
        XCTAssertEqual(links.geoUri, "geo:0,0?q=Imba%20Manor%2C%20Harare%2C%20Zimbabwe")
        XCTAssertEqual(links.webUrl, "https://www.google.com/maps/search/?api=1&query=Imba%20Manor%2C%20Harare%2C%20Zimbabwe")
        XCTAssertEqual(links.appleMapsUrl, "https://maps.apple.com/?q=Imba%20Manor%2C%20Harare%2C%20Zimbabwe")

        let moved = try XCTUnwrap(MapsLinkBuilder.build(VenueLocation(name: "Meikles Hotel", streetAddress: "Jason Moyo Ave", city: "Harare", country: "Zimbabwe")))
        XCTAssertEqual(moved.displayQuery, "Meikles Hotel, Jason Moyo Ave, Harare, Zimbabwe")

        let explicit = try XCTUnwrap(MapsLinkBuilder.build(VenueLocation(name: "Imba Manor", mapsUrl: "https://maps.app.goo.gl/abc")))
        XCTAssertEqual(explicit.webUrl, "https://maps.app.goo.gl/abc")

        let coords = try XCTUnwrap(MapsLinkBuilder.build(VenueLocation(name: "Imba Manor", latitude: -17.7475, longitude: 31.1283)))
        XCTAssertEqual(coords.geoUri, "geo:-17.7475,31.1283?q=-17.7475,31.1283(Imba%20Manor)")
        XCTAssertEqual(coords.appleMapsUrl, "https://maps.apple.com/?ll=-17.7475,31.1283&q=Imba%20Manor")

        XCTAssertEqual(MapsLinkBuilder.searchQuery(VenueLocation(name: "Imba Manor", streetAddress: "imba manor", city: "Harare", country: " ")), "Imba Manor, Harare")
        XCTAssertNil(MapsLinkBuilder.build(VenueLocation(name: " ")))
        XCTAssertEqual(MapsLinkBuilder.encode("Château & Co"), "Ch%C3%A2teau%20%26%20Co")
    }

    func testInvitationAndPassCarryTheActiveWeddingVenue() async throws {
        var bundles = [try sanitized()]
        if let privateBundle = try privateOrNil() { bundles.append(privateBundle) }
        for bundle in bundles {
            let wedding = try await bundle.wedding.getWedding()
            let invitation = try await bundle.wedding.resolveInvitation(weddingSlug: wedding.id, token: "shadow-attending-guest")
            XCTAssertEqual(invitation.venue, wedding.venueLocation)
            let pass = try await bundle.wedding.getWeddingPass(token: "shadow-attending-guest")
            XCTAssertEqual(pass.venue, wedding.venueLocation)
            XCTAssertNotNil(MapsLinkBuilder.build(try XCTUnwrap(pass.venue)))
        }
    }
}
