import XCTest
@testable import WewedKit

final class WeddingPlanLogicTests: XCTestCase {
    private func sanitizedSnapshot() async throws -> WeddingPlanSnapshot {
        let bundle = try NativeRepositoryFactory.make(environment: .sanitizedShadow)
        return WeddingPlanSnapshot(
            wedding: try await bundle.wedding.getWedding(),
            dashboard: try await bundle.planner.getDashboard(),
            tasks: try await bundle.wedding.getTasks(),
            budgetLines: try await bundle.planner.getBudgetLines(),
            currency: try await bundle.wedding.getBudget().currency,
            guests: try await bundle.wedding.getGuests(),
            vendors: try await bundle.planner.getVendorEngagements(),
            contributions: try await bundle.planner.getContributions(),
            seating: try await bundle.planner.getSeatingTables(),
            programme: try await bundle.planner.getTimelineEntries(),
            documents: try await bundle.planner.getDocuments(),
            presence: try await bundle.wedding.getVendors()
        )
    }

    private func day(_ text: String) -> Date {
        WeddingDateText.day(text)!
    }

    func testDailyOpsIsDerivedFromRecordedDueDatesAndRsvps() async throws {
        let data = try await sanitizedSnapshot()
        let ops = PlannerInsights.dailyOps(data, today: day("2026-09-19"))
        XCTAssertEqual(ops.overdue.map(\.id), ["shadow_task_18"], "Only the open task due 2026-08-22 is overdue")
        XCTAssertTrue(ops.dueSoon.isEmpty)
        XCTAssertTrue(ops.highPriorityOpen.allSatisfy { $0.status != .done && ($0.priority == .high || $0.priority == .urgent) })
        XCTAssertEqual(ops.guestsNotReplied, data.guests.filter { $0.rsvpStatus == .pending }.count)
        XCTAssertEqual(ops.totalGuests, 174)

        let weekBefore = PlannerInsights.dailyOps(data, today: day("2026-12-16"))
        XCTAssertEqual(Set(weekBefore.dueSoon.map(\.id)), ["shadow_task_10", "shadow_task_14", "shadow_task_17"])
    }

    func testRecommendationsCarryEvidenceFromTheData() async throws {
        let data = try await sanitizedSnapshot()
        let recs = PlannerInsights.recommendations(data, today: day("2026-09-19"))
        let byId = Dictionary(uniqueKeysWithValues: recs.map { ($0.id, $0) })
        XCTAssertEqual(byId["overdue-tasks"]?.evidenceCount, 1)
        XCTAssertEqual(byId["guests-not-replied"]?.evidenceCount, data.guests.filter { $0.rsvpStatus == .pending }.count)
        XCTAssertEqual(byId["no-contracts"]?.evidenceCount, data.vendors.count)
        XCTAssertEqual(byId["unpaid-budget"]?.evidenceCount, data.budgetLines.filter { $0.paid <= 0 && ($0.actual > 0 || $0.estimated > 0) }.count)
        XCTAssertNotNil(byId["seating-capacity"])

        let empty = PlannerInsights.recommendations(WeddingPlanSnapshot(), today: Date())
        XCTAssertTrue(empty.isEmpty, "No data means no recommendations, never invented ones")
    }

    func testArrangeIsStableAndOnlyReorders() async throws {
        let data = try await sanitizedSnapshot()
        for worksheet in PlannerWorksheet.allCases {
            for arrangement in WorksheetArrangement.options(for: worksheet) {
                XCTAssertEqual(
                    Set(data.rowIds(worksheet, arrangement)),
                    Set(data.rowIds(worksheet, .standard)),
                    "\(worksheet) \(arrangement) must keep every row"
                )
            }
        }
        let byName = data.arrangedTasks(.name).map(\.title)
        XCTAssertEqual(byName, byName.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending })
        let byDue = data.arrangedTasks(.dueDate)
        XCTAssertEqual(byDue.first?.id, "shadow_task_18")
        XCTAssertNil(byDue.last?.dueDate)
        XCTAssertTrue(WorksheetArrangement.options(for: .overview).isEmpty)
    }

    func testExportAndPrintSelectedUseOnlyTheSelectedRows() async throws {
        let data = try await sanitizedSnapshot()
        let selected: Set<String> = ["shadow_task_01", "shadow_task_18"]
        let csv = try XCTUnwrap(data.csv(.tasks, arrangement: .standard, only: selected))
        let rows = WorksheetCsv.parse(csv)
        XCTAssertEqual(rows.count, 3)
        XCTAssertEqual(Set(rows.dropFirst().map { $0[0] }), selected)
        XCTAssertNil(data.csv(.overview, arrangement: .standard))

        let table = data.table(.tasks, arrangement: .standard, only: selected)
        XCTAssertEqual(table.rows.count, 2)
        let html = table.html(title: "Charity & Kudzie <Tasks>", subtitle: "Printed")
        XCTAssertTrue(html.contains("Charity &amp; Kudzie &lt;Tasks&gt;"))
        XCTAssertFalse(html.contains("<Tasks>"))

        let seatingCsv = try XCTUnwrap(data.csv(.seating, arrangement: .standard, only: ["shadow_tbl_08"]))
        let seated = WorksheetCsv.parse(seatingCsv).dropFirst()
        XCTAssertFalse(seated.isEmpty)
        XCTAssertTrue(seated.allSatisfy { $0[3] == "Table 8 — VIPs" })
    }

    func testContributionRowsFollowTheHonestyRules() {
        let notRecorded = PlannerContributionRecord(
            id: "c1", contributorLabel: "", typeLabel: "Blessing", value: 250, statusLabel: "Approved",
            allocationLabel: "", verified: true, contributorResolution: .notRecorded,
            privacyLabel: "Public", wordCount: 41, submittedAtLabel: "18 Jun 2026"
        )
        XCTAssertEqual(PlainStatus.contributor(notRecorded), "Contributor not recorded")
        XCTAssertEqual(PlainStatus.contributionFacts(notRecorded), "Public · 41 words · 18 Jun 2026")
        let table = WeddingPlanSnapshot(contributions: [notRecorded]).table(.contributions, arrangement: .standard)
        XCTAssertFalse(table.rows.flatMap { $0 }.contains { $0.contains("250") }, "Contributions never show an amount")
    }

    func testRecordedDatesReadPlainly() {
        XCTAssertEqual(WeddingDateText.long("2026-12-23 14:00:00"), "Wednesday 23 December 2026")
        XCTAssertEqual(WeddingDateText.short("2026-12-22 00:00:00"), "22 Dec 2026")
        XCTAssertEqual(WeddingDateText.time("2026-12-23 14:00:00"), "14:00")
        XCTAssertNil(WeddingDateText.time("2026-12-22 00:00:00"))
        XCTAssertEqual(WeddingDateText.long("Not a date"), "Not a date")
        XCTAssertEqual(WeddingMoney.format(1800, currency: "USD"), "$1,800")
    }
}
