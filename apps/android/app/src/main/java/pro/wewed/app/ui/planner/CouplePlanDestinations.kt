package pro.wewed.app.ui.planner

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import pro.wewed.app.services.RoleScopedAccess
import pro.wewed.app.ui.shared.*

/**
 * The couple's plan detail screens. They read through the couple's scoped access so contributor
 * privacy (anonymous gifts) is applied the same way as everywhere else.
 */
@Composable
private fun PlanListScreen(
    title: String,
    rootTag: String,
    onBack: () -> Unit,
    content: LazyListScope.() -> Unit
) {
    SubScreen(title, onBack) {
        LazyColumn(
            modifier = Modifier.fillMaxSize().testTag(rootTag),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            content = content
        )
    }
}

@Composable
fun CoupleBudgetDestination(access: RoleScopedAccess, onBack: () -> Unit) {
    val lines = rememberLoad(Unit) { access.budgetLines() to access.budget().currency }
    PlanListScreen("Budget", "planner-budget-root", onBack) {
        when (lines) {
            Load.Loading -> item { LoadingIndicator() }
            is Load.Failed -> item { ProblemText(lines.message) }
            is Load.Ready -> {
                val (rows, currency) = lines.value
                item {
                    InfoCard {
                        SectionTitle("Totals")
                        BodyText("Estimated ${Formatting.money(rows.sumOf { it.estimated }, currency)}")
                        BodyText("Actual ${Formatting.money(rows.sumOf { it.actual }, currency)}")
                        BodyText("Paid ${Formatting.money(rows.sumOf { it.paid }, currency)}")
                        BodyText("Outstanding ${Formatting.money(rows.sumOf { (it.actual - it.paid).coerceAtLeast(0.0) }, currency)}")
                    }
                }
                if (rows.isEmpty()) item { EmptyStateText("No budget lines are recorded for this wedding.", "planner-budget-empty") }
                items(rows, key = { it.id }) { BudgetLineRow(it, currency) }
            }
        }
    }
}

@Composable
fun CoupleContributionsDestination(access: RoleScopedAccess, onBack: () -> Unit) {
    val records = rememberLoad(Unit) { access.contributions() }
    PlanListScreen("Contributions", "planner-contributions-root", onBack) {
        when (records) {
            Load.Loading -> item { LoadingIndicator() }
            is Load.Failed -> item { ProblemText(records.message) }
            is Load.Ready -> {
                val rows = records.value
                item {
                    val types = rows.map { it.typeLabel }.distinct()
                    InfoCard(modifier = Modifier.testTag("contributions-summary")) {
                        BodyText(Formatting.plural(rows.size, "contribution") + " recorded")
                        if (types.isNotEmpty()) SupportingText("Types: ${types.joinToString(", ")}")
                    }
                }
                if (rows.isEmpty()) item { EmptyStateText("No contributions are recorded for this wedding.", "planner-contributions-empty") }
                items(rows, key = { it.id }) { ContributionRow(it) }
            }
        }
    }
}

@Composable
fun CoupleVendorsDestination(access: RoleScopedAccess, onBack: () -> Unit) {
    val vendors = rememberLoad(Unit) { access.vendorEngagements() }
    PlanListScreen("Vendors", "planner-vendors-root", onBack) {
        when (vendors) {
            Load.Loading -> item { LoadingIndicator() }
            is Load.Failed -> item { ProblemText(vendors.message) }
            is Load.Ready -> {
                if (vendors.value.isEmpty()) item { EmptyStateText("No vendors are recorded for this wedding.", "planner-vendors-empty") }
                items(vendors.value, key = { it.id }) { VendorEngagementRow(it) }
            }
        }
    }
}

@Composable
fun CoupleSeatingDestination(access: RoleScopedAccess, onBack: () -> Unit) {
    val tables = rememberLoad(Unit) { access.seating() }
    PlanListScreen("Seating", "planner-seating-root", onBack) {
        when (tables) {
            Load.Loading -> item { LoadingIndicator() }
            is Load.Failed -> item { ProblemText(tables.message) }
            is Load.Ready -> {
                val rows = tables.value
                item {
                    val capacity = rows.sumOf { it.capacity }
                    val assigned = rows.sumOf { it.assigned }
                    InfoCard {
                        BodyText("${Formatting.plural(rows.size, "table")} · $capacity seats")
                        SupportingText("$assigned assigned · ${(capacity - assigned).coerceAtLeast(0)} free")
                    }
                }
                if (rows.isEmpty()) item { EmptyStateText("No tables are recorded for this wedding.", "planner-seating-empty") }
                items(rows, key = { it.id }) { SeatingRow(it) }
            }
        }
    }
}

@Composable
fun CoupleTimelineDestination(access: RoleScopedAccess, onBack: () -> Unit) {
    val entries = rememberLoad(Unit) { access.programme() }
    PlanListScreen("Timeline", "planner-timeline-root", onBack) {
        when (entries) {
            Load.Loading -> item { LoadingIndicator() }
            is Load.Failed -> item { ProblemText(entries.message) }
            is Load.Ready -> {
                if (entries.value.isEmpty()) item { EmptyStateText("No programme is recorded for this wedding.", "planner-timeline-empty") }
                items(entries.value.sortedBy { it.time }, key = { it.id }) { ProgrammeRow(it) }
            }
        }
    }
}

@Composable
fun CoupleDocumentsDestination(access: RoleScopedAccess, onBack: () -> Unit) {
    val records = rememberLoad(Unit) { access.documents() }
    PlanListScreen("Documents", "planner-documents-root", onBack) {
        when (records) {
            Load.Loading -> item { LoadingIndicator() }
            is Load.Failed -> item { ProblemText(records.message) }
            is Load.Ready -> {
                if (records.value.isEmpty()) item { EmptyStateText("No contracts or documents recorded for this wedding.", "planner-documents-empty") }
                items(records.value, key = { it.id }) { DocumentRow(it) }
            }
        }
    }
}
