import XCTest
@testable import WewedKit

/// Mirrors Android WorksheetCsvTest.
final class WorksheetCsvTests: XCTestCase {
    func testTemplatesUseTheWebImportEngineLabels() {
        XCTAssertEqual(WorksheetCsv.template(.tasks), "Task ID,Task,Category,Description,Assigned Person,Due Date,Priority,Status,Order\r\n")
        XCTAssertEqual(WorksheetCsv.template(.seating), "Guest ID,Guest Name,Table ID,Table Name,Table Capacity\r\n")
        XCTAssertEqual(WorksheetCsv.headers(.guests).count, 20)
        XCTAssertFalse(PlannerWorksheet.overview.supportsExport)
        XCTAssertTrue(PlannerWorksheet.tasks.supportsImport)
        XCTAssertFalse(PlannerWorksheet.guests.supportsImport)
        XCTAssertEqual(PlannerWorksheet.tasks.exportFileName, "wewed-checklist-export.csv")
    }

    func testEncodeEscapesCommasQuotesAndLineBreaks() {
        let csv = WorksheetCsv.encode(headers: ["A", "B"], rows: [["x, y", "say \"hi\"\nthere"]])
        XCTAssertEqual(csv, "A,B\r\n\"x, y\",\"say \"\"hi\"\"\nthere\"\r\n")
        XCTAssertEqual(WorksheetCsv.parse(csv), [["A", "B"], ["x, y", "say \"hi\"\nthere"]])
    }

    func testExportRoundTripsEveryTaskOfTheWorksheet() async throws {
        let bundle = try NativeRepositoryFactory.make(environment: .sanitizedShadow)
        let tasks = try await bundle.wedding.getTasks()
        let rows = WorksheetCsv.parse(WorksheetCsv.tasks(tasks))
        XCTAssertEqual(rows.count, tasks.count + 1)
        XCTAssertEqual(rows.dropFirst().map { $0[0] }, tasks.map(\.id))
        XCTAssertEqual(rows.dropFirst().map { $0[1] }, tasks.map(\.title))
    }

    func testExportsLeaveFieldsTheAppDoesNotHoldBlank() async throws {
        let bundle = try NativeRepositoryFactory.make(environment: .sanitizedShadow)
        let guests = WorksheetCsv.parse(WorksheetCsv.guests(try await bundle.wedding.getGuests()))
        let email = try XCTUnwrap(guests.first?.firstIndex(of: "Email"))
        let phone = try XCTUnwrap(guests.first?.firstIndex(of: "Phone"))
        XCTAssertTrue(guests.dropFirst().allSatisfy { $0[email].isEmpty && $0[phone].isEmpty })

        let contributions = WorksheetCsv.parse(WorksheetCsv.contributions(try await bundle.planner.getContributions()))
        let amount = try XCTUnwrap(contributions.first?.firstIndex(of: "Amount"))
        XCTAssertTrue(contributions.dropFirst().allSatisfy { $0[amount].isEmpty }, "Non-monetary contributions never gain an amount")
    }

    func testTaskImportPreviewValidatesLikeTheWeb() {
        let preview = WorksheetCsv.previewTaskImport(
            "\u{FEFF}Task,Category,Priority,Status,Due Date\n" +
            "Book photographer,photo_video,high,todo,2026-10-01\n" +
            "No category,,low,,\n" +
            "Bad values,venue,critical,finished,01/10/2026\n" +
            "Defaults apply,other,,,\n"
        )
        XCTAssertTrue(preview.headerErrors.isEmpty)
        XCTAssertEqual(preview.validRows.map(\.rowNumber), [2, 5])
        XCTAssertEqual(preview.validRows[0].priority, .high)
        XCTAssertEqual(preview.validRows[0].dueDate, "2026-10-01")
        XCTAssertEqual(preview.validRows[1].priority, .medium)
        XCTAssertEqual(preview.validRows[1].status, .todo)
        XCTAssertEqual(preview.rowErrors.map(\.rowNumber), [3, 4])
        XCTAssertTrue(preview.rowErrors[0].message.contains("Category is required"))
        XCTAssertTrue(preview.rowErrors[1].message.contains("Priority"))
        XCTAssertTrue(preview.rowErrors[1].message.contains("Status"))
        XCTAssertTrue(preview.rowErrors[1].message.contains("Due Date"))
        XCTAssertTrue(preview.canImport)
    }

    func testTaskImportRejectsFilesMissingRequiredColumns() {
        let preview = WorksheetCsv.previewTaskImport("Title,Notes\nSomething,else\n")
        XCTAssertFalse(preview.canImport)
        XCTAssertEqual(preview.headerErrors, ["Missing required column: Task", "Missing required column: Category"])
        XCTAssertEqual(WorksheetCsv.previewTaskImport("").headerErrors, ["The file is empty."])
    }
}
