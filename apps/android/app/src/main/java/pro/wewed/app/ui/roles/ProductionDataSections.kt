package pro.wewed.app.ui.roles

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.*
import pro.wewed.app.theme.WeddingIdentityPalette

/**
 * Sections backed by the production `WeddingContent`, `Song`, `QRDestination`, `ImportJob`,
 * `Message` and `EngagementParty` graphs.
 *
 * These twelve content sections, the songbook, the scan destination, the import history and the
 * wedding wall were all reported as "unsupported" while production held 107, 27, 1, 40 and 3 rows
 * respectively. The cause was never the product — it was a snapshot that did not carry the tables.
 *
 * Two states are kept distinct throughout, because collapsing them is what made a real wedding look
 * like an empty one:
 *
 *   HONEST EMPTY  — the source holds no rows, and says so naming the section.
 *   NOT PUBLISHED — the couple has not published this section yet.
 *
 * Neither is ever replaced with invented copy.
 */

/** A content section rendered from real `WeddingContent` rows. */
@Composable
fun WeddingContentSectionView(
    section: WeddingContentSection,
    testTagPrefix: String,
    showMediaReferences: Boolean = true
) {
    if (section.isEmpty) {
        IAEmptyPublishedSection(section.title, testTagPrefix)
        return
    }

    IASectionList(section.title, "${section.entries.size} published entries") {
        // Prose first, in the order the couple arranged it; media references after, so a section
        // that is mostly text does not lead with an image placeholder.
        section.proseEntries.forEach { entry ->
            IACard(
                title = entry.field.humanisedContentField(),
                subtitle = entry.value,
                testTag = "$testTagPrefix-${entry.field}"
            )
        }
        if (showMediaReferences && section.mediaEntries.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            Text(
                "Media",
                color = WeddingIdentityPalette.Muted,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.sp
            )
            section.mediaEntries.forEach { entry ->
                IACard(
                    title = entry.field.humanisedContentField(),
                    subtitle = entry.value,
                    status = "Reference",
                    testTag = "$testTagPrefix-media-${entry.field}"
                )
            }
        }
    }
}

/**
 * The Gallery.
 *
 * `MediaItem` holds zero rows for this wedding, which is why the gallery was previously reported
 * empty. The gallery is not empty: the couple's `WeddingContent` gallery section carries a real
 * heading, a real subtitle and real preview-image references. Those references point at application
 * assets, so they are rendered where the native bundle carries the asset and marked honestly where
 * it does not — never replaced with a generic "no photos yet".
 */
@Composable
fun GalleryContentSection(
    section: WeddingContentSection,
    bundledMedia: Set<String>,
    testTagPrefix: String = "gallery"
) {
    if (section.isEmpty) {
        IAEmptyPublishedSection("Gallery", testTagPrefix)
        return
    }

    val heading = section.value("heading") ?: "Gallery"
    val subtitle = section.value("subtitle")
    val previews = section.entries
        .filter { it.field.startsWith("previewImage") }
        .sortedBy { it.order }

    IASectionList(heading, subtitle) {
        if (previews.isEmpty()) {
            IACard(
                "No preview images published",
                "The couple has published gallery text but no images yet.",
                testTag = "$testTagPrefix-no-previews"
            )
        }
        // A gallery shows pictures. Listing file paths is a manifest, not a gallery, so each
        // reference the native bundle can resolve is rendered as the image itself; a reference it
        // cannot resolve says so plainly rather than being hidden or faked.
        previews.forEach { entry ->
            val assetName = entry.value.substringAfterLast('/').substringBeforeLast('.')
            val drawable = BundledWeddingMedia.drawableFor(assetName)
            if (drawable != null) {
                Image(
                    painter = painterResource(id = drawable),
                    contentDescription = entry.field.humanisedContentField(),
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .testTag("$testTagPrefix-${entry.field}")
                )
            } else {
                IACard(
                    title = entry.field.humanisedContentField(),
                    subtitle = "This image is published for the web experience and is not bundled with the app.",
                    status = "Not bundled",
                    testTag = "$testTagPrefix-${entry.field}"
                )
            }
        }
    }
}

/**
 * The songbook, from the couple's real `Song` rows.
 *
 * `guestVisible` drops the couple's private planning notes: a guest may see the song and who it is
 * by, never the note the couple wrote about it.
 */
@Composable
fun SongbookSection(
    songs: List<SongEntry>,
    guestVisible: Boolean,
    testTagPrefix: String = "songbook"
) {
    if (songs.isEmpty()) {
        IAEmptySourceSection("Songbook", "No songs are recorded for this wedding.", testTagPrefix)
        return
    }

    val visible = if (guestVisible) songs.map { it.guestVisible() } else songs
    val played = visible.count { !it.playedAt.isNullOrBlank() }
    val subtitle = buildString {
        append("${visible.size} songs")
        if (played > 0) append(" · $played played")
    }

    IASectionList("Songbook", subtitle) {
        visible.forEach { song ->
            val detail = listOfNotNull(
                song.artist,
                song.moment?.takeIf { it.isNotBlank() },
                song.notes?.takeIf { it.isNotBlank() }
            ).joinToString(" · ")
            IACard(
                title = song.title,
                subtitle = detail.ifBlank { null },
                trailing = if (song.votes > 0) "${song.votes} votes" else null,
                status = song.phase?.replaceFirstChar { it.uppercase() },
                testTag = "$testTagPrefix-${song.id}"
            )
        }
    }
}

/**
 * Invitations & QR, from the real `QRDestination` rows.
 *
 * A scan destination is routing configuration: a label, a kind, a URL and a scan count. It is not
 * a Wedding Pass credential, and the two must not be conflated — the pass carries signing material
 * that never appears here.
 */
@Composable
fun InvitationsQrSection(
    destinations: List<QrDestination>,
    invitationCardStyle: String? = null,
    testTagPrefix: String = "invitations-qr"
) {
    if (destinations.isEmpty()) {
        IAEmptySourceSection(
            "Invitations & QR",
            "No scan destinations are configured for this wedding.",
            testTagPrefix
        )
        return
    }

    IASectionList("Invitations & QR", "${destinations.size} scan destinations") {
        destinations.forEach { destination ->
            IACard(
                title = destination.label.ifBlank { destination.type },
                subtitle = destination.url,
                trailing = "${destination.scanCount} scans",
                status = if (destination.isActive) "Active" else "Inactive",
                testTag = "$testTagPrefix-${destination.id}"
            )
        }
        invitationCardStyle?.takeIf { it.isNotBlank() }?.let {
            IACard(
                title = "Invitation card style",
                subtitle = it.replaceFirstChar { c -> c.uppercase() },
                testTag = "$testTagPrefix-card-style"
            )
        }
        Spacer(Modifier.height(4.dp))
        Text(
            "Scan destinations route a scan. They are not Wedding Pass credentials.",
            color = WeddingIdentityPalette.Muted,
            fontSize = 11.sp
        )
    }
}

/**
 * Recent Imports, from the real `ImportJob` history.
 *
 * Rollback tokens, rollback payloads and preview rows are deliberately absent from the native
 * model: an import history screen needs what happened, not the material to replay or undo it.
 */
@Composable
fun RecentImportsSection(
    jobs: List<ImportJobRecord>,
    testTagPrefix: String = "recent-imports"
) {
    if (jobs.isEmpty()) {
        IAEmptySourceSection(
            "Recent Imports",
            "No imports have been performed for this wedding.",
            testTagPrefix
        )
        return
    }

    val failed = jobs.count { !it.succeeded }
    val subtitle = buildString {
        append("${jobs.size} imports")
        if (failed > 0) append(" · $failed not completed")
    }

    IASectionList("Recent Imports", subtitle) {
        jobs.forEach { job ->
            val counts = listOfNotNull(
                job.createdCount.takeIf { it > 0 }?.let { "$it created" },
                job.updatedCount.takeIf { it > 0 }?.let { "$it updated" },
                job.skippedCount.takeIf { it > 0 }?.let { "$it skipped" },
                job.errorCount.takeIf { it > 0 }?.let { "$it errors" }
            ).joinToString(" · ").ifBlank { "${job.totalRows} rows" }
            IACard(
                title = job.moduleTitle,
                subtitle = listOfNotNull(job.fileName, counts).joinToString(" — "),
                trailing = job.performedAt?.asDisplayDate(),
                status = job.status.replaceFirstChar { it.uppercase() },
                testTag = "$testTagPrefix-${job.id}"
            )
        }
    }
}

/**
 * The wedding wall, from the real `Message` rows.
 *
 * Production holds these as `type = "wall"`, `isPublic = true`: they are guest-facing wall posts.
 * They are NOT planner-to-couple correspondence, and this surface says so rather than letting three
 * public messages stand in for a private messaging system that has not been located.
 */
@Composable
fun LiveWallMessagesSection(
    messages: List<WallMessage>,
    testTagPrefix: String = "live-wall"
) {
    val publicMessages = messages.filter { it.isPublic }
    if (publicMessages.isEmpty()) {
        IAEmptySourceSection(
            "Live Wall",
            "No wall messages have been posted for this wedding.",
            testTagPrefix
        )
        return
    }

    IASectionList("Live Wall", "${publicMessages.size} public messages") {
        publicMessages.forEach { message ->
            IACard(
                title = message.authorName?.takeIf { it.isNotBlank() } ?: "A guest",
                subtitle = message.content,
                trailing = message.createdAt?.asDisplayDate(),
                testTag = "$testTagPrefix-${message.id}"
            )
        }
    }
}

/**
 * Parties to the wedding's service engagements.
 *
 * Where production records a real party relation, it is used. Inferring the counterparty from a
 * vendor's name would be a guess presented as a fact.
 */
@Composable
fun EngagementPartiesSection(
    parties: List<EngagementPartyRecord>,
    testTagPrefix: String = "engagement-parties"
) {
    if (parties.isEmpty()) {
        IAEmptySourceSection(
            "Engagement Parties",
            "No named parties are recorded against this wedding's service engagements.",
            testTagPrefix
        )
        return
    }

    IASectionList("Engagement Parties", "${parties.size} named parties") {
        parties.forEach { party ->
            IACard(
                title = party.displayName.ifBlank { party.legalName ?: party.partyRole },
                subtitle = listOfNotNull(
                    party.partyRole.takeIf { it.isNotBlank() },
                    party.authorityBasis?.takeIf { it.isNotBlank() }
                ).joinToString(" · "),
                status = party.status?.replaceFirstChar { it.uppercase() },
                testTag = "$testTagPrefix-${party.id}"
            )
        }
    }
}

/** Content-management history. Never rendered for guests. */
@Composable
fun ContentRevisionsSection(
    revisions: List<ContentRevisionRecord>,
    testTagPrefix: String = "content-revisions"
) {
    if (revisions.isEmpty()) {
        IAEmptySourceSection(
            "Content History",
            "No content revisions are recorded for this wedding.",
            testTagPrefix
        )
        return
    }

    IASectionList("Content History", "${revisions.size} revisions") {
        revisions.forEach { revision ->
            IACard(
                title = "${WeddingContentSection.titleFor(revision.section)} · ${revision.fieldKey}",
                subtitle = when {
                    revision.isPublished -> "Published${revision.publishedAt?.let { " ${it.asDisplayDate()}" } ?: ""}"
                    revision.isScheduled -> "Scheduled for ${revision.scheduledFor?.asDisplayDate()}"
                    else -> "Draft"
                },
                status = revision.status.replaceFirstChar { it.uppercase() },
                testTag = "$testTagPrefix-${revision.id}"
            )
        }
    }
}

/**
 * Admin audit, from the real wedding-scoped `AuditEvent` rows.
 *
 * Request forensics and before/after values are not in the model at all, so they cannot leak
 * through a screen that merely lists activity. Access is gated by the caller on Admin authorization.
 */
@Composable
fun AuditEventsSection(
    events: List<AuditEventRecord>,
    adminAccess: AdminAccessContext?,
    testTagPrefix: String = "audit-events"
) {
    if (adminAccess?.isBlockedByAuthorization == true) {
        IASectionList("Audit", "Authorization required") {
            IACard(
                title = "Admin audit is not authorized for this reader",
                subtitle = adminAccess.note,
                status = "Blocked",
                testTag = "$testTagPrefix-blocked"
            )
            if (adminAccess.deniedDomains.isNotEmpty()) {
                IACard(
                    title = "Denied domains",
                    subtitle = adminAccess.deniedDomains.joinToString(", "),
                    testTag = "$testTagPrefix-denied"
                )
            }
        }
        return
    }

    if (events.isEmpty()) {
        IAEmptySourceSection("Audit", "No audit activity is recorded for this wedding.", testTagPrefix)
        return
    }

    IASectionList("Audit", "${events.size} events") {
        events.take(100).forEach { event ->
            IACard(
                title = event.action.replace('_', ' ').replaceFirstChar { it.uppercase() },
                subtitle = listOfNotNull(event.resourceType, event.resourceId?.take(12))
                    .joinToString(" · "),
                trailing = event.createdAt?.asDisplayDate(),
                testTag = "$testTagPrefix-${event.id}"
            )
        }
        if (events.size > 100) {
            Text(
                "Showing the 100 most recent of ${events.size} events.",
                color = WeddingIdentityPalette.Muted,
                fontSize = 11.sp
            )
        }
    }
}

/**
 * A guest's RSVP detail.
 *
 * [canSeePrivateDetail] is the authorization boundary, not a display preference: the Gate sees
 * admission facts, the Couple and an authorized Planner see the full record, and a guest sees only
 * their own. Dietary requirements, private messages and contact details never cross that line.
 */
@Composable
fun GuestRsvpDetailSection(
    guest: Guest,
    rsvp: GuestRsvpDetail?,
    contact: GuestContactDetail?,
    canSeePrivateDetail: Boolean,
    testTagPrefix: String = "rsvp-detail"
) {
    IASectionList(guest.name, guest.rsvpStatus.title) {
        IACard(
            title = "RSVP",
            subtitle = when (rsvp?.attending) {
                true -> "Attending"
                false -> "Not attending"
                null -> "No response yet"
            },
            trailing = "Party of ${guest.partySize}",
            testTag = "$testTagPrefix-status"
        )

        if (rsvp == null) {
            IACard(
                title = "No RSVP record",
                subtitle = "This guest has no RSVP row in the wedding graph.",
                testTag = "$testTagPrefix-missing"
            )
            return@IASectionList
        }

        if (rsvp.plusOne) {
            IACard(
                title = "Plus one",
                subtitle = listOfNotNull(rsvp.plusOneName, rsvp.plusOneMeal).joinToString(" · ")
                    .ifBlank { "Confirmed, no name recorded" },
                testTag = "$testTagPrefix-plus-one"
            )
        }
        if (rsvp.kidsAttending || rsvp.kidsCount > 0) {
            IACard(
                title = "Children",
                subtitle = "${rsvp.kidsCount} attending",
                testTag = "$testTagPrefix-kids"
            )
        }
        guest.tableName?.let {
            IACard("Seating", it, testTag = "$testTagPrefix-seating")
        }
        IACard(
            title = "Check-in",
            subtitle = if (rsvp.checkedIn) {
                "Checked in${rsvp.checkedInAt?.let { " on ${it.asDisplayDateTime()}" } ?: ""}"
            } else {
                "Not checked in"
            },
            testTag = "$testTagPrefix-check-in"
        )

        // Everything below this line is private to the guest and the couple's planning team.
        if (!canSeePrivateDetail) {
            Spacer(Modifier.height(4.dp))
            Text(
                "Meal, dietary and contact details are not visible in this role.",
                color = WeddingIdentityPalette.Muted,
                fontSize = 11.sp,
                modifier = Modifier.testTag("$testTagPrefix-restricted")
            )
            return@IASectionList
        }

        rsvp.mealChoice?.takeIf { it.isNotBlank() }?.let {
            IACard("Meal choice", it, testTag = "$testTagPrefix-meal")
        }
        if (rsvp.hasDietaryRequirement) {
            IACard(
                title = "Dietary and accessibility",
                subtitle = rsvp.dietaryNotes,
                status = "Action",
                testTag = "$testTagPrefix-dietary"
            )
        }
        if (rsvp.hasSongRequest) {
            IACard("Song request", rsvp.songRequests, testTag = "$testTagPrefix-song")
        }
        if (rsvp.hasMessage) {
            IACard("Message from guest", rsvp.message, testTag = "$testTagPrefix-message")
        }
        contact?.let { details ->
            val contactLine = listOfNotNull(details.email, details.phone).joinToString(" · ")
            if (contactLine.isNotBlank()) {
                IACard("Contact", contactLine, testTag = "$testTagPrefix-contact")
            }
            val roleLine = listOfNotNull(
                details.role?.replace('_', ' ')?.replaceFirstChar { it.uppercase() },
                details.roleDetail
            ).joinToString(" · ")
            if (roleLine.isNotBlank()) {
                IACard("Role", roleLine, testTag = "$testTagPrefix-role")
            }
        }
    }
}

/** The couple has not published this section. Distinct from "the source holds nothing". */
@Composable
fun IAEmptyPublishedSection(title: String, testTagPrefix: String) {
    IASectionList(title, null) {
        IACard(
            title = "Not published yet",
            subtitle = "The couple has not published $title for this wedding.",
            testTag = "$testTagPrefix-empty"
        )
    }
}

/** The source genuinely holds no rows. Distinct from "we could not read it". */
@Composable
fun IAEmptySourceSection(title: String, reason: String, testTagPrefix: String) {
    IASectionList(title, null) {
        IACard(
            title = "Nothing recorded",
            subtitle = reason,
            testTag = "$testTagPrefix-empty"
        )
    }
}

/**
 * Formats a production timestamp for display.
 *
 * The graph stores ISO-8601 (`2026-06-22T05:35:00`). Printing the raw string leaks the storage
 * format onto the screen, which is how a check-in read "Checked in at 2026-06-22T05:35".
 */
internal fun String.asDisplayDate(): String {
    val date = runCatching {
        java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).parse(take(10))
    }.getOrNull() ?: return this
    return java.text.SimpleDateFormat("d MMM yyyy", java.util.Locale.US).format(date)
}

/** Formats a production timestamp with its time of day. */
internal fun String.asDisplayDateTime(): String {
    val normalised = replace('T', ' ').take(16)
    val date = runCatching {
        java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", java.util.Locale.US).parse(normalised)
    }.getOrNull() ?: return asDisplayDate()
    return java.text.SimpleDateFormat("d MMM yyyy, HH:mm", java.util.Locale.US).format(date)
}

/**
 * Turns a production content field key into a readable label.
 *
 * Content keys come in three shapes: camelCase (`previewImage0`), hyphenated (`milestone-0`) and
 * snake_case. All three reached the screen verbatim, so a couple's story read "Milestone-0".
 * Repeated fields are zero-indexed in storage and are shown one-indexed, because "Milestone 0" is
 * a storage detail, not how anyone counts their own milestones.
 */
internal fun String.humanisedContentField(): String {
    if (isBlank()) return "Detail"
    val spaced = replace(Regex("([a-z])([A-Z])"), "$1 $2")
        .replace(Regex("([A-Za-z])(\\d)"), "$1 $2")
        .replace('_', ' ')
        .replace('-', ' ')
        .trim()
    val oneIndexed = Regex("^(.*?)\\s(\\d+)$").find(spaced)?.let { match ->
        val (label, index) = match.destructured
        "$label ${index.toInt() + 1}"
    } ?: spaced
    return oneIndexed.replaceFirstChar { it.uppercase() }
}

/**
 * Media the native bundle actually carries, keyed by the asset base name used in the wedding
 * content graph. A reference outside this set is a real published reference the app cannot
 * resolve — it is reported as such, never hidden and never substituted.
 */
object BundledWeddingMedia {
    val names: Set<String> = setOf("hero-wedding", "ornament-frame")

    fun drawableFor(assetName: String): Int? = when (assetName) {
        "hero-wedding" -> pro.wewed.app.R.drawable.hero_wedding
        "ornament-frame" -> pro.wewed.app.R.drawable.ornament_frame
        else -> null
    }
}

// ---------------------------------------------------------------------------
// Planner "More" routes, rebuilt on the real graph.
//
// These six destinations previously rendered static fixture copy — sample rate sheets, invented
// insurance and tax lines, an "AI active" banner, a placeholder team roster. In Private Real UAT
// that placed invented operational facts beside a real wedding, which is the most misleading
// failure mode available to us. Each now reads the repository or says plainly that the graph holds
// nothing.
// ---------------------------------------------------------------------------

/** The client, from the real wedding and the real planner profile/enquiry. */
@Composable
fun PlannerClientProfileSection(graph: WeddingGraphState) {
    val wedding = graph.wedding
    if (wedding == null) {
        IAEmptySourceSection("Client Profile", "No wedding is bound to this workspace.", "client-profile")
        return
    }

    IASectionList("Client Profile", wedding.coupleNames) {
        IACard("Wedding", wedding.coupleNames, testTag = "client-profile-couple")
        IACard("Date", wedding.date.asDisplayDate(), testTag = "client-profile-date")
        IACard(
            title = "Venue",
            subtitle = "${wedding.venueName} — ${wedding.city}, ${wedding.country}",
            testTag = "client-profile-venue"
        )
        IACard(
            title = "Planning stage",
            subtitle = wedding.lifecycle.replaceFirstChar { it.uppercase() },
            testTag = "client-profile-lifecycle"
        )
        IACard(
            title = "Guest list",
            subtitle = "${graph.guests.size} guests · ${graph.guests.count { it.rsvpStatus == RSVPStatus.ATTENDING }} attending",
            testTag = "client-profile-guests"
        )
        graph.budget?.let {
            IACard(
                title = "Budget",
                subtitle = "Estimated ${it.currency} ${it.totalBudget.asMoney()} · paid ${it.currency} ${it.totalPaid.asMoney()}",
                testTag = "client-profile-budget"
            )
        }

        // How this planner reaches the wedding is stated, not implied. Production holds no
        // engagement and no membership for this pairing; calling that a client relationship would
        // be a fabrication.
        graph.plannerAccess?.let { access ->
            Spacer(Modifier.height(4.dp))
            IACard(
                title = access.businessName ?: "Planner",
                subtitle = access.accessDescription,
                status = if (access.isProductionEngagement) "Engaged" else "UAT",
                testTag = "client-profile-access"
            )
            access.enquiryStatus?.let {
                IACard(
                    title = "Enquiry",
                    subtitle = it.replace('_', ' ').replaceFirstChar { c -> c.uppercase() },
                    testTag = "client-profile-enquiry"
                )
            }
        }
    }
}

/**
 * Planner intelligence, derived strictly from the repository.
 *
 * Every line here is a calculation over rows the workspace already holds. Nothing claims an
 * inference the app did not make, and there is no "AI active" banner, because no model runs here.
 */
@Composable
fun PlannerIntelligenceSection(graph: WeddingGraphState) {
    if (graph.wedding == null) {
        IAEmptySourceSection("Intelligence", "No wedding is bound to this workspace.", "intelligence")
        return
    }

    val tasks = graph.tasks
    val guests = graph.guests
    val openTasks = tasks.count { it.status != TaskStatus.DONE }
    val highOpen = tasks.count { it.status != TaskStatus.DONE && it.priority == TaskPriority.HIGH }
    val awaiting = guests.count { it.rsvpStatus == RSVPStatus.PENDING }
    val seated = guests.count { !it.tableName.isNullOrBlank() }
    val dietary = graph.rsvpDetails.values.count { it.hasDietaryRequirement }
    // Same rounding rule as the Couple home surface, so the two never disagree.
    val completion = if (tasks.isEmpty()) 0 else {
        Math.round(tasks.count { it.status == TaskStatus.DONE } * 100.0 / tasks.size).toInt()
    }

    IASectionList("Intelligence", "Derived from this wedding's graph") {
        IACard("Planning completion", "$completion% of ${tasks.size} tasks complete", testTag = "intelligence-completion")
        IACard("Open tasks", "$openTasks open · $highOpen high priority", testTag = "intelligence-open-tasks")
        IACard("RSVP", "$awaiting of ${guests.size} guests have not responded", testTag = "intelligence-rsvp")
        IACard("Seating", "$seated of ${guests.size} guests are seated", testTag = "intelligence-seating")
        if (dietary > 0) {
            IACard(
                title = "Dietary requirements",
                subtitle = "$dietary ${if (dietary == 1) "guest" else "guests"} recorded a dietary or accessibility need",
                status = "Action",
                testTag = "intelligence-dietary"
            )
        }
        graph.budget?.let {
            val remaining = it.totalBudget - it.totalPaid
            IACard(
                title = "Budget remaining",
                subtitle = "${it.currency} ${remaining.asMoney()} of ${it.currency} ${it.totalBudget.asMoney()} unpaid",
                testTag = "intelligence-budget"
            )
        }
        Spacer(Modifier.height(4.dp))
        Text(
            "These figures are calculated from the loaded wedding graph. No model or external service is involved.",
            color = WeddingIdentityPalette.Muted,
            fontSize = 11.sp
        )
    }
}

/**
 * Team Hub.
 *
 * Production exposes the planner's own profile — including a real team size — but no per-member
 * roster is reachable through the authorized read. The distinction is stated rather than filled
 * with placeholder members.
 */
@Composable
fun PlannerTeamHubSection(graph: WeddingGraphState) {
    val access = graph.plannerAccess
    if (access == null) {
        IAEmptySourceSection("Team Hub", "No planner context is bound to this workspace.", "team-hub")
        return
    }

    IASectionList("Team Hub", access.businessName) {
        access.teamSize?.let {
            IACard("Team size", "$it recorded on the planner profile", testTag = "team-hub-size")
        }
        access.completedWeddings?.let {
            IACard("Completed weddings", "$it", testTag = "team-hub-completed")
        }
        access.profileStatus?.let {
            IACard(
                title = "Profile status",
                subtitle = it.replaceFirstChar { c -> c.uppercase() },
                testTag = "team-hub-status"
            )
        }
        IACard(
            title = "Access to this wedding",
            subtitle = access.accessDescription,
            status = if (access.isProductionEngagement) "Engaged" else "UAT",
            testTag = "team-hub-access"
        )
        IACard(
            title = "Team members",
            subtitle = "No per-member roster is reachable through the authorized read. " +
                "Only the planner profile's aggregate team size is available.",
            status = "Not available",
            testTag = "team-hub-members"
        )

        // Tasks carry a real assignee string where one was recorded; that is the only per-person
        // planner data the graph actually holds.
        val assignees = graph.tasks.mapNotNull { it.assignee?.takeIf { a -> a.isNotBlank() } }.distinct()
        if (assignees.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            Text("Task assignees", color = WeddingIdentityPalette.Muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            assignees.forEach { assignee ->
                val count = graph.tasks.count { it.assignee == assignee }
                IACard(assignee, "$count tasks", testTag = "team-hub-assignee")
            }
        }
    }
}

/**
 * Media Archive.
 *
 * `MediaItem` holds zero rows, so the archive is not backed by an uploaded-media table. It is
 * backed by the media references the couple published through `WeddingContent`, which is where this
 * wedding's media actually lives.
 */
@Composable
fun PlannerMediaArchiveSection(graph: WeddingGraphState) {
    val mediaEntries = graph.contentSections.flatMap { sectionGroup ->
        sectionGroup.mediaEntries.map { sectionGroup to it }
    }

    if (mediaEntries.isEmpty()) {
        IAEmptySourceSection(
            "Media Archive",
            "No media references are published for this wedding, and no uploaded media items exist.",
            "media-archive"
        )
        return
    }

    IASectionList("Media Archive", "${mediaEntries.size} published media references") {
        mediaEntries.forEach { (sectionGroup, entry) ->
            val assetName = entry.value.substringAfterLast('/').substringBeforeLast('.')
            IACard(
                title = "${sectionGroup.title} · ${entry.field.humanisedContentField()}",
                subtitle = entry.value,
                status = if (assetName in BundledWeddingMedia.names) "Available" else "Not bundled",
                testTag = "media-archive-${entry.id}"
            )
        }
        Spacer(Modifier.height(4.dp))
        Text(
            "Media is referenced by the wedding content graph. No uploaded media items are recorded for this wedding.",
            color = WeddingIdentityPalette.Muted,
            fontSize = 11.sp
        )
    }
}

/** A tappable row that opens a detail surface. Kept minimal so it reads as an affordance. */
@Composable
fun IAOpenRow(label: String, testTag: String, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .testTag(testTag),
        shape = RoundedCornerShape(10.dp),
        color = WeddingIdentityPalette.Ivory,
        onClick = onClick
    ) {
        Text(
            label,
            color = WeddingIdentityPalette.ChampagneDeep,
            fontWeight = FontWeight.SemiBold,
            fontSize = 12.sp,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        )
    }
}

/**
 * A vendor's services on this wedding, from the real `Vendor`, `ServiceEngagement` and
 * `EngagementParty` graph.
 *
 * The engagement's counterparties come from the real party relation where production records one.
 * Inferring them from a vendor's name would present a guess as a contractual fact.
 */
@Composable
fun VendorServicesSection(graph: WeddingGraphState, context: pro.wewed.app.navigation.NavigationContext) {
    if (graph.loading) return IALoading()

    // A vendor sees their own engagement, not the whole wedding's vendor list.
    val activeVendorId = context.activeVendorId
    val vendors = graph.vendors.filter { activeVendorId == null || it.id == activeVendorId }

    if (vendors.isEmpty()) {
        IAEmptySourceSection(
            "Services",
            "No vendor record is bound to this session for this wedding.",
            "vendor-services"
        )
        return
    }

    IASectionList("Services", graph.wedding?.coupleNames) {
        vendors.forEach { vendor ->
            IACard(
                title = vendor.vendorName,
                subtitle = vendor.serviceCategory,
                status = vendor.state.title,
                testTag = "vendor-services-${vendor.id}"
            )

            val parties = graph.engagementParties.filter { party ->
                party.displayName.equals(vendor.vendorName, ignoreCase = true) ||
                    party.legalName.equals(vendor.vendorName, ignoreCase = true)
            }
            parties.forEach { party ->
                IACard(
                    title = "Party · ${party.partyRole.replaceFirstChar { it.uppercase() }}",
                    subtitle = listOfNotNull(
                        party.displayName.takeIf { it.isNotBlank() },
                        party.authorityBasis?.takeIf { it.isNotBlank() }
                    ).joinToString(" · "),
                    status = party.status?.replaceFirstChar { it.uppercase() },
                    testTag = "vendor-party-${party.id}"
                )
            }
        }

        if (graph.engagementParties.isEmpty()) {
            Spacer(Modifier.height(4.dp))
            Text(
                "No named engagement parties are recorded for this wedding's service engagements.",
                color = WeddingIdentityPalette.Muted,
                fontSize = 11.sp
            )
        }
    }
}

/** Groups thousands so a budget reads as money rather than as a raw number. */
internal fun Double.asMoney(): String = String.format(java.util.Locale.US, "%,d", toLong())
