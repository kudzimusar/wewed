import XCTest
@testable import WewedKit

/// Private Real UAT fidelity.
///
/// The previous runtime checks asserted that two pseudonyms were absent. That proves almost
/// nothing: an empty graph also contains no pseudonyms. These tests assert the opposite direction —
/// that the production-derived graph is actually present, actually reaches the surfaces that render
/// it, and that local UAT changes stay distinguishable from production facts.
///
/// They skip when the protected snapshot is not provisioned, so committed CI (Sanitized Shadow) is
/// unaffected. No private value is ever asserted by content; the assertions are structural — counts,
/// relationships, identifiers and provenance.
///
/// This is the counterpart of Android's `PrivateRealUatFidelityTest`; both assert the same
/// invariants against the same canonical snapshot.
final class PrivateRealUatFidelityTests: XCTestCase {

    private var snapshotAvailable: Bool {
        FileManager.default.fileExists(atPath: PrivateRealShadowWeddingRepository.defaultSnapshotPath())
    }

    private func scoped() async throws -> ScopedWeddingRepository {
        guard case let .nonProduction(wedding, _, _, _) = try NativeRepositoryFactory.make(environment: .privateRealShadow) else {
            throw NativeRepositoryFactoryError.privateRealShadowFixtureMissing("Expected .nonProduction for .privateRealShadow")
        }
        return try await wedding.forOnlyWedding()
    }

    // MARK: - The snapshot the runtime actually loaded

    func testRuntimeReportsTheSnapshotItLoaded() async throws {
        try XCTSkipUnless(snapshotAvailable)
        let manifest = try await scoped().snapshotManifest()
        let unwrapped = try XCTUnwrap(manifest, "Private Real UAT must expose a snapshot manifest")
        XCTAssertEqual(unwrapped.schemaVersion, "private-real-uat/2")
        XCTAssertEqual(unwrapped.sourceWeddingId, "cmqos70cb0004q6vxe9g9aiu5")
        XCTAssertEqual(unwrapped.contentHashPrefix.count, 16)
        XCTAssertFalse(unwrapped.domainCounts.isEmpty, "manifest must carry per-domain counts")
    }

    /// The defect this guards against: a domain the snapshot carries but no adapter reads, which
    /// renders as an honest-looking empty screen. If the manifest says a domain has rows, the
    /// repository must return them.
    func testEveryDomainTheManifestCountsIsActuallyReadable() async throws {
        try XCTSkipUnless(snapshotAvailable)
        let repo = try await scoped()
        let loadedManifest = try await repo.snapshotManifest()
        let manifest = try XCTUnwrap(loadedManifest)

        let readBack: [String: Int] = [
            "guests": try await repo.getGuests().count,
            "tasks": try await repo.getTasks().count,
            "weddingContent": try await repo.getWeddingContent().count,
            "songs": try await repo.getSongs().count,
            "qrDestinations": try await repo.getQrDestinations().count,
            "importJobs": try await repo.getImportJobs().count,
            "messages": try await repo.getWallMessages().count,
            "engagementParties": try await repo.getEngagementParties().count,
            "contentRevisions": try await repo.getContentRevisions().count,
            "auditEvents": try await repo.getAuditEvents().count,
            "vendors": try await repo.getVendors().count
        ]

        let gaps = readBack.filter { manifest.count($0.key) > 0 && $0.value == 0 }.keys.sorted()
        XCTAssertTrue(gaps.isEmpty,
                      "Domains counted in the snapshot but unreadable through the repository: \(gaps)")

        for (domain, count) in readBack {
            XCTAssertEqual(manifest.count(domain), count, "\(domain) count must match the manifest")
        }
    }

    // MARK: - Guest and RSVP graph

    func testEveryGuestResolvesExactlyOneRsvpRecord() async throws {
        try XCTSkipUnless(snapshotAvailable)
        let repo = try await scoped()
        let guests = try await repo.getGuests()
        XCTAssertFalse(guests.isEmpty, "guest graph must not be empty")

        var missing = 0
        for guest in guests where try await repo.getRsvpDetail(guestId: guest.id) == nil {
            missing += 1
        }
        XCTAssertEqual(missing, 0, "guests with no RSVP record")

        // Each RSVP belongs to the guest it was fetched for; a positional read would break here.
        for guest in guests.prefix(25) {
            let loaded = try await repo.getRsvpDetail(guestId: guest.id)
            let detail = try XCTUnwrap(loaded)
            XCTAssertEqual(detail.guestId, guest.id)
        }
    }

    func testPartySizeIsDerivedFromTheRealRsvpRow() async throws {
        try XCTSkipUnless(snapshotAvailable)
        let repo = try await scoped()
        for guest in try await repo.getGuests() {
            let loaded = try await repo.getRsvpDetail(guestId: guest.id)
            let rsvp = try XCTUnwrap(loaded)
            let expected = 1 + (rsvp.plusOne ? 1 : 0) + rsvp.kidsCount
            XCTAssertEqual(guest.partySize, expected,
                           "party size for \(guest.id) must be guest + plus-one + children")
        }
    }

    func testSeatedGuestsResolveARealTable() async throws {
        try XCTSkipUnless(snapshotAvailable)
        let seated = try await scoped().getGuests().filter { !($0.tableName ?? "").isEmpty }
        XCTAssertEqual(seated.count, 22, "seated guest count")
    }

    // MARK: - Role gating

    /// The Gate admits people. It has no business knowing what they eat, what they wrote, or how to
    /// contact them. `operationalOnly()` is the boundary, and this asserts it actually drops the
    /// private fields rather than merely not displaying them.
    func testGateProjectionDropsPrivateGuestDetail() async throws {
        try XCTSkipUnless(snapshotAvailable)
        let repo = try await scoped()
        var detailed: GuestRsvpDetail?
        for guest in try await repo.getGuests() {
            if let detail = try await repo.getRsvpDetail(guestId: guest.id),
               detail.hasDietaryRequirement || detail.hasMessage || detail.mealChoice != nil {
                detailed = detail
                break
            }
        }
        try XCTSkipIf(detailed == nil, "production holds at least one detailed RSVP")

        let source = try XCTUnwrap(detailed)
        let operational = source.operationalOnly()
        XCTAssertNil(operational.dietaryNotes, "gate must not receive dietary notes")
        XCTAssertNil(operational.message, "gate must not receive the guest's message")
        XCTAssertNil(operational.mealChoice, "gate must not receive the meal choice")
        XCTAssertNil(operational.songRequests, "gate must not receive song requests")
        // Admission facts survive.
        XCTAssertEqual(operational.guestId, source.guestId)
        XCTAssertEqual(operational.checkedIn, source.checkedIn)
        XCTAssertEqual(operational.kidsCount, source.kidsCount)
    }

    func testGuestVisibleSongDropsThePlannersNotes() async throws {
        try XCTSkipUnless(snapshotAvailable)
        let songs = try await scoped().getSongs()
        try XCTSkipIf(songs.isEmpty, "production holds songs")
        for song in songs {
            XCTAssertNil(song.guestVisible().notes, "a guest must not see planning notes")
            XCTAssertFalse(song.guestVisible().title.isEmpty)
        }
    }

    // MARK: - Wedding content

    func testPublishedContentSectionsAreReadable() async throws {
        try XCTSkipUnless(snapshotAvailable)
        let sections = try await scoped().getWeddingContentSections()
        XCTAssertFalse(sections.isEmpty, "the wedding publishes content sections")

        for section in sections {
            XCTAssertFalse(section.isEmpty, "published section \(section.section) must hold entries")
            XCTAssertFalse(section.title.isEmpty, "section \(section.section) needs a display title")
            for entry in section.entries {
                XCTAssertEqual(entry.section, section.section)
            }
        }
    }

    /// Gallery is not empty merely because MediaItem holds no rows. The couple's gallery content
    /// carries a heading and preview references, and this is the regression guard for the screen
    /// that used to say "will be available during and after the wedding".
    func testGalleryIsBackedByPublishedContentNotMediaItems() async throws {
        try XCTSkipUnless(snapshotAvailable)
        let gallery = try await scoped().getWeddingContentSection("gallery")
        try XCTSkipIf(gallery.isEmpty, "production publishes a gallery section")

        XCTAssertNotNil(gallery.value("heading"), "gallery must carry a heading")
        let previews = gallery.entries.filter { $0.field.hasPrefix("previewImage") }
        XCTAssertFalse(previews.isEmpty, "gallery must carry preview references")
        for preview in previews {
            XCTAssertFalse(preview.value.isEmpty, "a preview must reference something")
        }
    }

    // MARK: - Planner and Admin context

    /// Production holds no PlannerEngagement and no WeddingMembership for this pairing. The
    /// planner's access is a UAT overlay, and the app must say so rather than implying a contract.
    func testPlannerAccessIsMarkedAsUatOverlayNotProductionEngagement() async throws {
        try XCTSkipUnless(snapshotAvailable)
        let plannerContext = try await scoped().plannerAccessContext()
        let access = try XCTUnwrap(plannerContext, "planner context must be present")
        XCTAssertEqual(access.productionEngagementCount, 0)
        XCTAssertEqual(access.productionMembershipCount, 0)
        XCTAssertEqual(access.accessBasis, .uatOverlay)
        XCTAssertFalse(access.isProductionEngagement)
        XCTAssertTrue(access.accessDescription.lowercased().contains("uat"),
                      "the UI sentence must not claim a production engagement")
    }

    /// Admin is blocked by an authorization boundary, not by an absence of data. Conflating the two
    /// would let a missing grant look like an empty product.
    func testAdminIsBlockedByAuthorizationRatherThanReportedEmpty() async throws {
        try XCTSkipUnless(snapshotAvailable)
        let adminContext = try await scoped().adminAccessContext()
        let admin = try XCTUnwrap(adminContext)
        XCTAssertTrue(admin.isBlockedByAuthorization)
        XCTAssertFalse(admin.deniedDomains.isEmpty, "the blocked domains must be named")
    }

    // MARK: - Mutation isolation

    /// A UAT change must be recoverable and must never be mistaken for a production fact.
    func testUatMutationsStayDistinguishableFromProductionTruth() async throws {
        try XCTSkipUnless(snapshotAvailable)
        let source = try PrivateRealShadowWeddingRepository()
        let repo = try await source.forOnlyWedding()

        var pristine = await source.isPristine()
        XCTAssertTrue(pristine, "a freshly loaded snapshot has no local changes")

        let allTasks = try await repo.getTasks()
        let task = try XCTUnwrap(allTasks.first)
        var provenance = await source.provenanceForTask(task.id)
        XCTAssertEqual(provenance, .productionDerived)

        _ = try await repo.toggleTask(taskId: task.id)

        pristine = await source.isPristine()
        XCTAssertFalse(pristine)
        provenance = await source.provenanceForTask(task.id)
        XCTAssertEqual(provenance, .shadowMutation)

        let currentTasks = try await repo.getTasks()
        let untouched = try XCTUnwrap(currentTasks.last { $0.id != task.id })
        let untouchedProvenance = await source.provenanceForTask(untouched.id)
        XCTAssertEqual(untouchedProvenance, .productionDerived,
                       "an untouched task is still a production fact")

        let summary = await source.mutationSummary()
        XCTAssertEqual(summary["taskStatus"], 1)

        // Reset returns the view to the production-derived snapshot.
        await source.resetMutations()
        pristine = await source.isPristine()
        XCTAssertTrue(pristine)
        provenance = await source.provenanceForTask(task.id)
        XCTAssertEqual(provenance, .productionDerived)
        let restoredTasks = try await repo.getTasks()
        let restored = try XCTUnwrap(restoredTasks.first { $0.id == task.id })
        XCTAssertEqual(restored.status, task.status,
                       "reset must restore the task's original status")
    }

    // MARK: - Credential boundary

    /// The snapshot on disk must carry no credential or request-forensics column. This asserts the
    /// allowlist held all the way to the provisioned file, not only inside the build tooling.
    func testProvisionedSnapshotCarriesNoCredentialColumns() throws {
        try XCTSkipUnless(snapshotAvailable)
        let raw = try String(contentsOfFile: PrivateRealShadowWeddingRepository.defaultSnapshotPath(),
                             encoding: .utf8)
        for forbidden in ["\"token\":", "\"authorToken\":", "\"contributionToken\":",
                          "\"rollbackToken\":", "\"rollbackData\":", "\"previewData\":",
                          "\"ipAddress\":", "\"userAgent\":", "\"beforeValue\":", "\"afterValue\":"] {
            XCTAssertFalse(raw.contains(forbidden),
                           "provisioned UAT snapshot must not contain \(forbidden)")
        }
    }
}
