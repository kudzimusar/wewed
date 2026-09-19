package pro.wewed.app.ui.shared

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.*

/**
 * One row of wedding data. In select mode the whole row toggles selection and shows a labelled checkbox;
 * otherwise the row shows its own actions.
 */
@Composable
fun WeddingRowContainer(
    tag: String,
    selectionMode: Boolean = false,
    selected: Boolean = false,
    onSelectedChange: (Boolean) -> Unit = {},
    content: @Composable RowScope.() -> Unit
) {
    val shape = RoundedCornerShape(14.dp)
    val base = Modifier
        .fillMaxWidth()
        .heightIn(min = 56.dp)
        .clip(shape)
        .background(if (selected) WeddingRowColors.Selected else Ui.Card)
        .border(1.dp, if (selected) Ui.Accent else Ui.Hairline, shape)
    val interactive = if (selectionMode) {
        base.toggleable(value = selected, role = Role.Checkbox, onValueChange = onSelectedChange)
    } else base
    Row(
        modifier = interactive
            .testTag(tag)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        if (selectionMode) {
            // The row itself is the toggle (announced with the row's text); the checkbox only shows its state.
            Checkbox(
                checked = selected,
                onCheckedChange = null,
                colors = CheckboxDefaults.colors(checkedColor = Ui.Accent)
            )
        }
        content()
    }
}

private object WeddingRowColors {
    val Selected = androidx.compose.ui.graphics.Color(0xFFFFF4DE)
}

@Composable
private fun RowTitle(text: String) {
    Text(text, color = Ui.Ink, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, lineHeight = 22.sp)
}

@Composable
private fun RowDetail(text: String) {
    Text(text, color = Ui.Muted, fontSize = 14.sp, lineHeight = 19.sp)
}

fun taskStatusText(status: TaskStatus): String = when (status) {
    TaskStatus.TODO -> "To do"
    TaskStatus.IN_PROGRESS -> "In progress"
    TaskStatus.BLOCKED -> "Blocked"
    TaskStatus.DONE -> "Done"
}

fun rsvpText(status: RSVPStatus): String = when (status) {
    RSVPStatus.ATTENDING -> "Replied yes"
    RSVPStatus.DECLINED -> "Replied no"
    RSVPStatus.PENDING -> "Not replied"
}

@Composable
fun TaskRow(
    task: PlannerTask,
    onToggleDone: (() -> Unit)?,
    busy: Boolean = false,
    selectionMode: Boolean = false,
    selected: Boolean = false,
    onSelectedChange: (Boolean) -> Unit = {}
) {
    WeddingRowContainer(
        tag = "task-row-${task.id}",
        selectionMode = selectionMode,
        selected = selected,
        onSelectedChange = onSelectedChange
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            RowTitle(task.title)
            val details = buildList {
                Formatting.humanize(task.category).takeIf { it.isNotEmpty() }?.let { add(it) }
                add("${task.priority.title} priority")
                task.dueDate?.takeIf { it.isNotBlank() }?.let { add("Due ${Formatting.shortDate(it)}") }
            }
            RowDetail(details.joinToString(" · "))
            StatusText("Status: ${taskStatusText(task.status)}")
        }
        if (!selectionMode && onToggleDone != null) {
            TextButton(
                onClick = onToggleDone,
                enabled = !busy,
                modifier = Modifier.heightIn(min = MinTouchTarget).testTag("task-toggle-${task.id}")
            ) {
                Text(
                    if (task.status == TaskStatus.DONE) "Mark to do" else "Mark done",
                    color = Ui.Positive,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
fun BudgetLineRow(
    line: PlannerBudgetLine,
    currency: String,
    selectionMode: Boolean = false,
    selected: Boolean = false,
    onSelectedChange: (Boolean) -> Unit = {}
) {
    WeddingRowContainer("budget-row-${line.id}", selectionMode, selected, onSelectedChange) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            RowTitle(Formatting.humanize(line.category))
            RowDetail(line.vendorName?.takeIf { it.isNotBlank() }?.let { "Vendor: $it" } ?: "No vendor recorded")
            RowDetail(
                "Estimated ${Formatting.money(line.estimated, currency)} · " +
                    "Actual ${Formatting.money(line.actual, currency)} · " +
                    "Paid ${Formatting.money(line.paid, currency)}"
            )
            line.dueDateLabel?.takeIf { it.isNotBlank() }?.let { RowDetail("Due ${Formatting.shortDate(it)}") }
            StatusText("Status: ${line.statusLabel}")
        }
    }
}

@Composable
fun GuestRow(
    guest: Guest,
    selectionMode: Boolean = false,
    selected: Boolean = false,
    onSelectedChange: (Boolean) -> Unit = {},
    trailing: (@Composable () -> Unit)? = null
) {
    WeddingRowContainer("guest-row-${guest.id}", selectionMode, selected, onSelectedChange) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            RowTitle(guest.name)
            val details = buildList {
                add("Party of ${guest.partySize}")
                add(guest.tableName?.takeIf { it.isNotBlank() } ?: "No table recorded")
            }
            RowDetail(details.joinToString(" · "))
            StatusText("RSVP: ${rsvpText(guest.rsvpStatus)}")
        }
        trailing?.invoke()
    }
}

@Composable
fun VendorEngagementRow(
    vendor: PlannerVendorEngagement,
    selectionMode: Boolean = false,
    selected: Boolean = false,
    onSelectedChange: (Boolean) -> Unit = {}
) {
    WeddingRowContainer("vendor-row-${vendor.id}", selectionMode, selected, onSelectedChange) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            RowTitle(vendor.vendorName)
            RowDetail("Service: ${Formatting.humanize(vendor.category)}")
            RowDetail("Booking: ${vendor.bookingStatus}")
            RowDetail("Contract: ${vendor.contractStatus}")
            RowDetail("Payment: ${vendor.paymentStatus}")
        }
    }
}

/** The single display rule for contributions on every surface (spec §5): never an amount. */
object ContributionText {
    fun contributor(record: PlannerContributionRecord): String =
        if (record.contributorResolution == ContributorResolution.NOT_RECORDED) "Contributor not recorded"
        else record.contributorLabel

    fun meta(record: PlannerContributionRecord): String = listOfNotNull(
        record.privacyLabel?.takeIf { it.isNotBlank() },
        record.wordCount?.let { Formatting.plural(it, "word") },
        record.submittedAtLabel?.takeIf { it.isNotBlank() }
    ).joinToString(" · ")

    fun message(record: PlannerContributionRecord): String =
        record.messageText?.takeIf { it.isNotBlank() } ?: "Message text isn't available in the app yet."
}

@Composable
fun ContributionRow(
    record: PlannerContributionRecord,
    selectionMode: Boolean = false,
    selected: Boolean = false,
    onSelectedChange: (Boolean) -> Unit = {}
) {
    WeddingRowContainer("contribution-row-${record.id}", selectionMode, selected, onSelectedChange) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                ContributionText.contributor(record),
                color = Ui.Ink,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.testTag("contribution-contributor")
            )
            RowDetail(record.typeLabel)
            StatusText("Status: ${record.statusLabel}")
            ContributionText.meta(record).takeIf { it.isNotEmpty() }?.let { RowDetail(it) }
            Text(
                ContributionText.message(record),
                color = if (record.messageText.isNullOrBlank()) Ui.Muted else Ui.Ink,
                fontSize = 15.sp,
                lineHeight = 21.sp
            )
        }
    }
}

@Composable
fun SeatingRow(
    table: PlannerSeatingTable,
    selectionMode: Boolean = false,
    selected: Boolean = false,
    onSelectedChange: (Boolean) -> Unit = {}
) {
    WeddingRowContainer("seating-row-${table.id}", selectionMode, selected, onSelectedChange) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            RowTitle(table.name)
            if (table.zone.isNotBlank()) RowDetail(table.zone)
            val free = (table.capacity - table.assigned).coerceAtLeast(0)
            RowDetail("Capacity ${table.capacity} · Assigned ${table.assigned} · Free $free")
            if (table.assigned > table.capacity) StatusText("Over capacity")
        }
    }
}

@Composable
fun ProgrammeRow(
    entry: PlannerTimelineEntry,
    selectionMode: Boolean = false,
    selected: Boolean = false,
    onSelectedChange: (Boolean) -> Unit = {}
) {
    WeddingRowContainer("programme-row-${entry.id}", selectionMode, selected, onSelectedChange) {
        Text(
            entry.time,
            color = Ui.Accent,
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.widthIn(min = 56.dp)
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            RowTitle(entry.title)
            val details = listOfNotNull(
                entry.location.takeIf { it.isNotBlank() },
                entry.linkedVendor?.takeIf { it.isNotBlank() }?.let { "Vendor: $it" }
            )
            if (details.isNotEmpty()) RowDetail(details.joinToString(" · "))
        }
    }
}

@Composable
fun DocumentRow(
    record: PlannerDocumentRecord,
    selectionMode: Boolean = false,
    selected: Boolean = false,
    onSelectedChange: (Boolean) -> Unit = {}
) {
    WeddingRowContainer("document-row-${record.id}", selectionMode, selected, onSelectedChange) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            RowTitle(record.title)
            RowDetail(Formatting.humanize(record.kind))
            record.statusLabel?.takeIf { it.isNotBlank() }?.let { StatusText("Status: $it") }
        }
    }
}

@Composable
fun VendorPresenceRow(presence: VendorPresence, showService: Boolean = true) {
    WeddingRowContainer("presence-row-${presence.id}") {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            RowTitle(presence.vendorName)
            if (showService) RowDetail(Formatting.humanize(presence.serviceCategory))
            StatusText("Status: ${presence.state.title}")
        }
    }
}
