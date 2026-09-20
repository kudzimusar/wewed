package pro.wewed.app

import kotlinx.coroutines.runBlocking
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.Assert.*
import pro.wewed.app.models.*
import pro.wewed.app.services.*
import java.io.File

/**
 * Private Real UAT fidelity.
 *
 * The previous runtime checks asserted that two pseudonyms were absent. That proves almost nothing:
 * an empty graph also contains no pseudonyms. These tests assert the opposite direction — that the
 * production-derived graph is actually present, actually reaches the surfaces that render it, and
 * that local UAT changes stay distinguishable from production facts.
 *
 * They skip when the protected snapshot is not provisioned, so committed CI (Sanitized Shadow) is
 * unaffected. No private value is ever asserted by content; the assertions are structural — counts,
 * relationships, identifiers and provenance.
 */
class PrivateRealUatFidelityTest {

    private fun snapshotAvailable(): Boolean =
        File(PrivateRealShadowWeddingRepository.defaultSnapshotPath()).exists()

    private suspend fun scoped(): ScopedWeddingRepository =
        NativeRepositoryFactory.make(NativeDataEnvironment.PRIVATE_REAL_SHADOW)
            .wedding.forOnlyWedding()

    // -----------------------------------------------------------------------------------
    // The snapshot the runtime actually loaded
    // -----------------------------------------------------------------------------------

    @Test
    fun runtimeReportsTheSnapshotItLoaded() = runBlocking {
        assumeTrue(snapshotAvailable())
        val manifest = scoped().snapshotManifest()
        assertNotNull("Private Real UAT must expose a snapshot manifest", manifest)
        assertEquals("private-real-uat/2", manifest!!.schemaVersion)
        assertEquals("cmqos70cb0004q6vxe9g9aiu5", manifest.sourceWeddingId)
        assertEquals(16, manifest.contentHashPrefix.length)
        assertTrue("manifest must carry per-domain counts", manifest.domainCounts.isNotEmpty())
    }

    /**
     * The defect this guards against: a domain the snapshot carries but no adapter reads, which
     * renders as an honest-looking empty screen. If the manifest says a domain has rows, the
     * repository must return them.
     */
    @Test
    fun everyDomainTheManifestCountsIsActuallyReadable() = runBlocking {
        assumeTrue(snapshotAvailable())
        val repo = scoped()
        val manifest = repo.snapshotManifest()!!

        val readBack = mapOf(
            "guests" to repo.getGuests().size,
            "tasks" to repo.getTasks().size,
            "weddingContent" to repo.getWeddingContent().size,
            "songs" to repo.getSongs().size,
            "qrDestinations" to repo.getQrDestinations().size,
            "importJobs" to repo.getImportJobs().size,
            "messages" to repo.getWallMessages().size,
            "engagementParties" to repo.getEngagementParties().size,
            "contentRevisions" to repo.getContentRevisions().size,
            "auditEvents" to repo.getAuditEvents().size,
            "vendors" to repo.getVendors().size
        )

        val gaps = readBack.filter { (domain, count) ->
            manifest.count(domain) > 0 && count == 0
        }.keys
        assertTrue(
            "Domains counted in the snapshot but unreadable through the repository: $gaps",
            gaps.isEmpty()
        )

        readBack.forEach { (domain, count) ->
            assertEquals("$domain count must match the manifest", manifest.count(domain), count)
        }
    }

    // -----------------------------------------------------------------------------------
    // Guest and RSVP graph
    // -----------------------------------------------------------------------------------

    @Test
    fun everyGuestResolvesExactlyOneRsvpRecord() = runBlocking {
        assumeTrue(snapshotAvailable())
        val repo = scoped()
        val guests = repo.getGuests()
        assertTrue("guest graph must not be empty", guests.isNotEmpty())

        val missing = guests.filter { repo.getRsvpDetail(it.id) == null }
        assertTrue("guests with no RSVP record: ${missing.size}", missing.isEmpty())

        // Each RSVP belongs to the guest it was fetched for; a positional read would break here.
        guests.take(25).forEach { guest ->
            assertEquals(guest.id, repo.getRsvpDetail(guest.id)!!.guestId)
        }
    }

    @Test
    fun partySizeIsDerivedFromTheRealRsvpRow() = runBlocking {
        assumeTrue(snapshotAvailable())
        val repo = scoped()
        repo.getGuests().forEach { guest ->
            val rsvp = repo.getRsvpDetail(guest.id)!!
            val expected = 1 + (if (rsvp.plusOne) 1 else 0) + rsvp.kidsCount
            assertEquals(
                "party size for ${guest.id} must be guest + plus-one + children",
                expected,
                guest.partySize
            )
        }
    }

    @Test
    fun seatedGuestsResolveARealTable() = runBlocking {
        assumeTrue(snapshotAvailable())
        val guests = scoped().getGuests()
        val seated = guests.filter { !it.tableName.isNullOrBlank() }
        assertEquals("seated guest count", 22, seated.size)
        seated.forEach {
            assertFalse("a seated guest must not carry a blank table name", it.tableName!!.isBlank())
        }
    }

    // -----------------------------------------------------------------------------------
    // Role gating
    // -----------------------------------------------------------------------------------

    /**
     * The Gate admits people. It has no business knowing what they eat, what they wrote, or how to
     * contact them. `operationalOnly()` is the boundary, and this asserts it actually drops the
     * private fields rather than merely not displaying them.
     */
    @Test
    fun gateProjectionDropsPrivateGuestDetail() = runBlocking {
        assumeTrue(snapshotAvailable())
        val repo = scoped()
        val withDetail = repo.getGuests()
            .mapNotNull { repo.getRsvpDetail(it.id) }
            .firstOrNull { it.hasDietaryRequirement || it.hasMessage || it.mealChoice != null }
        assumeTrue("production holds at least one detailed RSVP", withDetail != null)

        val operational = withDetail!!.operationalOnly()
        assertNull("gate must not receive dietary notes", operational.dietaryNotes)
        assertNull("gate must not receive the guest's message", operational.message)
        assertNull("gate must not receive the meal choice", operational.mealChoice)
        assertNull("gate must not receive song requests", operational.songRequests)
        // Admission facts survive.
        assertEquals(withDetail.guestId, operational.guestId)
        assertEquals(withDetail.checkedIn, operational.checkedIn)
        assertEquals(withDetail.kidsCount, operational.kidsCount)
    }

    @Test
    fun guestVisibleSongDropsThePlannersNotes() = runBlocking {
        assumeTrue(snapshotAvailable())
        val songs = scoped().getSongs()
        assumeTrue("production holds songs", songs.isNotEmpty())
        songs.forEach { assertNull("a guest must not see planning notes", it.guestVisible().notes) }
        // The song itself still renders.
        assertTrue(songs.all { it.guestVisible().title.isNotBlank() })
    }

    // -----------------------------------------------------------------------------------
    // Wedding content
    // -----------------------------------------------------------------------------------

    @Test
    fun publishedContentSectionsAreReadable() = runBlocking {
        assumeTrue(snapshotAvailable())
        val repo = scoped()
        val sections = repo.getWeddingContentSections()
        assertTrue("the wedding publishes content sections", sections.isNotEmpty())

        // Every section the couple published must be non-empty and titled.
        sections.forEach { section ->
            assertFalse("published section ${section.section} must hold entries", section.isEmpty)
            assertTrue("section ${section.section} needs a display title", section.title.isNotBlank())
        }

        // Every entry belongs to the section it was grouped under.
        sections.forEach { section ->
            section.entries.forEach { assertEquals(section.section, it.section) }
        }
    }

    /**
     * Gallery is not empty merely because MediaItem holds no rows. The couple's gallery content
     * carries a heading and preview references, and this is the regression guard for the screen
     * that used to say "will be available during and after the wedding".
     */
    @Test
    fun galleryIsBackedByPublishedContentNotMediaItems() = runBlocking {
        assumeTrue(snapshotAvailable())
        val gallery = scoped().getWeddingContentSection("gallery")
        assumeTrue("production publishes a gallery section", !gallery.isEmpty)

        assertNotNull("gallery must carry a heading", gallery.value("heading"))
        val previews = gallery.entries.filter { it.field.startsWith("previewImage") }
        assertTrue("gallery must carry preview references", previews.isNotEmpty())
        previews.forEach {
            assertTrue("a preview must reference something", it.value.isNotBlank())
        }
    }

    // -----------------------------------------------------------------------------------
    // Planner and Admin context
    // -----------------------------------------------------------------------------------

    /**
     * Production holds no PlannerEngagement and no WeddingMembership for this pairing. The planner's
     * access is a UAT overlay, and the app must say so rather than implying a contract.
     */
    @Test
    fun plannerAccessIsMarkedAsUatOverlayNotProductionEngagement() = runBlocking {
        assumeTrue(snapshotAvailable())
        val access = scoped().plannerAccessContext()
        assertNotNull("planner context must be present", access)
        assertEquals(0, access!!.productionEngagementCount)
        assertEquals(0, access.productionMembershipCount)
        assertEquals(DataProvenance.UAT_OVERLAY, access.accessBasis)
        assertFalse(access.isProductionEngagement)
        assertTrue(
            "the UI sentence must not claim a production engagement",
            access.accessDescription.contains("UAT", ignoreCase = true)
        )
    }

    /**
     * Admin is blocked by an authorization boundary, not by an absence of data. Conflating the two
     * would let a missing grant look like an empty product.
     */
    @Test
    fun adminIsBlockedByAuthorizationRatherThanReportedEmpty() = runBlocking {
        assumeTrue(snapshotAvailable())
        val admin = scoped().adminAccessContext()
        assertNotNull(admin)
        assertTrue(admin!!.isBlockedByAuthorization)
        assertTrue("the blocked domains must be named", admin.deniedDomains.isNotEmpty())
    }

    // -----------------------------------------------------------------------------------
    // Mutation isolation
    // -----------------------------------------------------------------------------------

    /**
     * A UAT change must be recoverable and must never be mistaken for a production fact.
     */
    @Test
    fun uatMutationsStayDistinguishableFromProductionTruth() = runBlocking {
        assumeTrue(snapshotAvailable())
        val source = PrivateRealShadowWeddingRepository()
        val repo = source.forOnlyWedding()

        assertTrue("a freshly loaded snapshot has no local changes", source.isPristine())

        val task = repo.getTasks().first()
        assertEquals(DataProvenance.PRODUCTION_DERIVED, source.provenanceForTask(task.id))

        repo.toggleTask(task.id)

        assertFalse(source.isPristine())
        assertEquals(DataProvenance.SHADOW_MUTATION, source.provenanceForTask(task.id))
        assertEquals(
            "an untouched task is still a production fact",
            DataProvenance.PRODUCTION_DERIVED,
            source.provenanceForTask(repo.getTasks().last { it.id != task.id }.id)
        )
        assertEquals(1, source.mutationSummary()["taskStatus"])

        // Reset returns the view to the production-derived snapshot.
        source.resetMutations()
        assertTrue(source.isPristine())
        assertEquals(DataProvenance.PRODUCTION_DERIVED, source.provenanceForTask(task.id))
        assertEquals(
            "reset must restore the task's original status",
            task.status,
            repo.getTasks().first { it.id == task.id }.status
        )
    }

    // -----------------------------------------------------------------------------------
    // Credential boundary
    // -----------------------------------------------------------------------------------

    /**
     * The snapshot on disk must carry no credential or request-forensics column. This asserts the
     * allowlist held all the way to the provisioned file, not only inside the build tooling.
     */
    @Test
    fun provisionedSnapshotCarriesNoCredentialColumns() {
        assumeTrue(snapshotAvailable())
        val raw = File(PrivateRealShadowWeddingRepository.defaultSnapshotPath()).readText()
        listOf(
            "\"token\":", "\"authorToken\":", "\"contributionToken\":", "\"rollbackToken\":",
            "\"rollbackData\":", "\"previewData\":", "\"ipAddress\":", "\"userAgent\":",
            "\"beforeValue\":", "\"afterValue\":"
        ).forEach { forbidden ->
            assertFalse(
                "provisioned UAT snapshot must not contain $forbidden",
                raw.contains(forbidden)
            )
        }
    }
}
