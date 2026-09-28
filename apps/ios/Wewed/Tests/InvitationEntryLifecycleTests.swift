import XCTest
@testable import WewedKit

/// QRO02B1 — the workspace root's invitation exchange must not cancel itself.
///
/// The root view ran the exchange in `.task(id: appState.pendingInvitationEntry)` and consumed
/// (cleared) that entry inside the task. Clearing the task's own id made SwiftUI cancel the task and
/// the in-flight exchange (`NSURLErrorCancelled`, zero bytes sent): a real Guest opening their link
/// while the account workspace was showing saw "We couldn't reach Wewed". The task is now keyed on
/// `invitationEntryRevision`, which changes only when a new entry arrives.
@MainActor
final class InvitationEntryLifecycleTests: XCTestCase {
    private let link = URL(string: "https://wewed.pro/invite/charity-and-kudzie?rsvp=TOKEN-A")!
    private let other = URL(string: "https://wewed.pro/invite/charity-and-kudzie?rsvp=TOKEN-B")!

    private func appState() -> AppState { AppState(dataEnvironment: .production, dataBaseURL: URL(string: "https://example.test")) }

    func testConsumingThePendingEntryDoesNotChangeTheTaskKey() {
        let state = appState()
        state.handleIncomingURL(link)
        let key = state.invitationEntryRevision
        XCTAssertNotNil(state.pendingInvitationEntry)

        XCTAssertEqual(state.consumePendingInvitationEntry(), .privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "TOKEN-A"))
        XCTAssertEqual(state.invitationEntryRevision, key, "consuming must not restart (cancel) the exchange task")
    }

    func testTheEntryIsExchangedExactlyOnce() {
        let state = appState()
        state.handleIncomingURL(link)
        XCTAssertNotNil(state.consumePendingInvitationEntry())
        XCTAssertNil(state.consumePendingInvitationEntry(), "a re-run of the same task must find nothing to replay")
    }

    func testALaterInvitationIsProcessed() {
        let state = appState()
        state.handleIncomingURL(link)
        let first = state.invitationEntryRevision
        _ = state.consumePendingInvitationEntry()

        state.handleIncomingURL(other)
        XCTAssertGreaterThan(state.invitationEntryRevision, first)
        XCTAssertEqual(state.consumePendingInvitationEntry(), .privateInvitation(weddingSlug: "charity-and-kudzie", rsvpToken: "TOKEN-B"))

        // The same link tapped again is a new arrival too.
        let second = state.invitationEntryRevision
        state.handleIncomingURL(other)
        XCTAssertGreaterThan(state.invitationEntryRevision, second)
    }

    func testRejectedAndNonInvitationLinksNeverStartAnExchange() {
        let state = appState()
        let before = state.invitationEntryRevision
        state.handleIncomingURL(URL(string: "https://wewed.pro/invite/charity-and-kudzie")!)  // no credential: rejected
        state.handleIncomingURL(URL(string: "https://evil.example/invite/x?rsvp=T")!)          // foreign host: ignored
        XCTAssertEqual(state.invitationEntryRevision, before)
        XCTAssertNil(state.pendingInvitationEntry)
    }

    func testAnArrivingInvitationStillOutranksTheWorkspace() throws {
        let state = appState()
        state.handleIncomingURL(link)
        XCTAssertNotNil(state.pendingInvitationEntry, "the root treats a pending entry as an invitation arrival")
        let source = try String(contentsOf: rootViewSource(), encoding: .utf8)
        XCTAssertTrue(source.contains("if appState.pendingInvitationEntry != nil { return true }"))
    }

    func testTheRootKeysTheExchangeOnTheRevisionNotTheEntryItConsumes() throws {
        let source = try String(contentsOf: rootViewSource(), encoding: .utf8)
        XCTAssertTrue(source.contains(".task(id: appState.invitationEntryRevision)"))
        XCTAssertFalse(source.contains(".task(id: appState.pendingInvitationEntry)"),
                       "keying the task on the entry it clears cancels the exchange")
    }

    private func rootViewSource() throws -> URL {
        var dir = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        while dir.path != "/" {
            let candidate = dir.appendingPathComponent("Views/RootView.swift")
            if FileManager.default.fileExists(atPath: candidate.path) { return candidate }
            dir = dir.deletingLastPathComponent()
        }
        throw NSError(domain: "InvitationEntryLifecycleTests", code: 1)
    }
}
