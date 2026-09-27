import XCTest

// QRO06-GUEST-LAUNCH01 — READ-ONLY qualification of the final native Guest components on a REAL
// pending invitation (TEST_RUNNER_WEWED_QRO06_REAL_LINK, never committed or printed). Never submits
// an RSVP, never opens a pass issuance for an attending Guest, never taps a write. Skipped unless
// the link is supplied.
final class ProductionGuestReadUITests: XCTestCase {
    private var app: XCUIApplication!
    private var env: [String: String] { ProcessInfo.processInfo.environment }

    private func element(_ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }
    private func text(_ contains: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", contains)).firstMatch
    }
    private func shot(_ name: String) {
        guard let dir = env["WEWED_QRO06_SHOT_DIR"], !dir.isEmpty else { return }
        try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
    }
    private func tap(_ id: String, timeout: TimeInterval = 30) {
        let target = element(id)
        XCTAssertTrue(target.waitForExistence(timeout: timeout), id)
        target.tap()
    }

    func testRealPendingInvitationReadOnly() throws {
        guard let link = env["WEWED_QRO06_REAL_LINK"], !link.isEmpty, let url = URL(string: link) else {
            throw XCTSkip("real invitation link not supplied")
        }
        app = XCUIApplication()
        app.launchEnvironment["WEWED_NATIVE_ENV"] = "production"
        app.launch()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 20))
        app.open(url)

        XCTAssertTrue(element("invitation-style-ivory-floral-gold").waitForExistence(timeout: 60), "saved Ivory Floral Gold")
        XCTAssertTrue(element("invitation-couple-names").label.contains("Charity"), "right wedding")
        shot("prod-native-cover")
        tap("invitation-open-button")
        XCTAssertTrue(element("invitation-guest-personalization").waitForExistence(timeout: 15), "personalized card")
        shot("prod-native-opened")
        tap("invitation-details-button")
        for cta in ["rsvp", "calendar", "venue", "registry", "pass", "couple-site"] {
            XCTAssertTrue(element("invitation-cta-\(cta)").waitForExistence(timeout: 10), cta)
        }
        let hasNote = element("invitation-cta-note").exists
        XCTAssertFalse(element("live-guest-shell").exists, "pending stays invitation-bound")
        for query in [app.staticTexts, app.buttons, app.otherElements] {
            for item in query.allElementsBoundByIndex where item.exists {
                XCTAssertFalse(item.label.contains("rsvp="), "credential on screen")
            }
        }
        shot("prod-native-details")

        tap("invitation-cta-pass")
        XCTAssertTrue(element("invitation-rsvp-prompt").waitForExistence(timeout: 15), "Guest Pass asks for RSVP")
        XCTAssertFalse(element("wedding-pass-qr").exists, "no admission QR")
        shot("prod-native-pass-requires-rsvp")
        // Dismiss the RSVP form without saving anything.
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.06)).tap()
        XCTAssertTrue(element("invitation-cta-rsvp").waitForExistence(timeout: 15))
        XCTAssertFalse(element("invitation-rsvp-save").exists, "RSVP form closed without saving")
        print("QRO06-REAL note-present=\(hasNote)")

        tap("invitation-leave-wedding")
        let confirm = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Leave'")).firstMatch
        if confirm.waitForExistence(timeout: 5) { confirm.tap() }
        XCTAssertTrue(element("invitation-open-button").waitForNonExistence(timeout: 20), "left the wedding")
        shot("prod-native-left")
        app.open(url)
        XCTAssertTrue(element("invitation-style-ivory-floral-gold").waitForExistence(timeout: 60), "invitation reopens from its link")
        shot("prod-native-reopened")
    }
}
