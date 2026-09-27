import XCTest

// QRO05-PIQR01 — FINAL NATIVE Planner → More → Invitations & QR, driven through the real
// production_preview lane (production clients, production authority rules, the real role shell)
// against the origin in TEST_RUNNER_WEWED_QRO05_ORIGIN. Skipped unless that origin and a Planner
// credential are supplied, so a plain `xcodebuild test` never reaches a network. Never Shadow, never
// a DevelopmentPersona. Screenshots stay inside the local .xcresult.
final class PlannerInvitationsQrUITests: XCTestCase {
    private var app: XCUIApplication!
    private var env: [String: String] { ProcessInfo.processInfo.environment }

    override func setUpWithError() throws {
        continueAfterFailure = false
        guard let origin = env["WEWED_QRO05_ORIGIN"], let email = env["WEWED_QRO05_EMAIL"],
              env["WEWED_QRO05_PASSWORD"] != nil, env["WEWED_QRO05_GRANT"] != nil, !origin.isEmpty, !email.isEmpty
        else { throw XCTSkip("QRO05 production_preview origin/credential not supplied") }
        app = XCUIApplication()
        app.launchEnvironment["WEWED_NATIVE_ENV"] = "production_preview"
        app.launchEnvironment["WEWED_PREVIEW_ORIGIN"] = origin
        if let bypass = env["WEWED_QRO05_BYPASS"], !bypass.isEmpty {
            app.launchEnvironment["WEWED_PREVIEW_PROTECTION_BYPASS"] = bypass
        }
    }

    private func element(_ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }

    /// Pre-existing entry/shell containers carry their own identifier, which SwiftUI can apply over a
    /// child's; fall back to the control's visible label there.
    private func control(_ id: String, label: String) -> XCUIElement {
        let byId = element(id)
        return byId.exists ? byId : app.buttons[label].firstMatch
    }

    private func tap(_ id: String, timeout: TimeInterval = 30) {
        let target = element(id)
        XCTAssertTrue(target.waitForExistence(timeout: timeout), id)
        target.tap()
    }

    private func scrollTo(_ id: String, file: StaticString = #filePath, line: UInt = #line) -> XCUIElement {
        let target = element(id)
        XCTAssertTrue(target.waitForExistence(timeout: 30), id, file: file, line: line)
        var attempts = 0
        while !target.isHittable && attempts < 12 {
            app.swipeUp(velocity: .slow)
            attempts += 1
        }
        XCTAssertTrue(target.isHittable, "\(id) never became hittable", file: file, line: line)
        return target
    }

    private func screenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func signInAndOpenInvitations() {
        app.launch()
        var email: XCUIElement { element("sign-in-email").exists ? element("sign-in-email") : app.textFields.firstMatch }
        var shell: XCUIElement { control("nav-planner-more", label: "More") }
        var grant: XCUIElement {
            let byId = element("grant-option-\(env["WEWED_QRO05_GRANT"]!)")
            guard !byId.exists, let title = env["WEWED_QRO05_GRANT_LABEL"] else { return byId }
            return app.buttons.containing(NSPredicate(format: "label CONTAINS %@", title)).firstMatch
        }
        let deadline = Date().addingTimeInterval(60)
        while Date() < deadline && !shell.exists {
            let welcome = control("welcome-sign-in", label: "Sign In")
            if !email.exists && welcome.exists { welcome.tap(); _ = email.waitForExistence(timeout: 5) }
            if email.exists {
                email.tap()
                email.typeText(env["WEWED_QRO05_EMAIL"]!)
                let password = element("sign-in-password").exists ? element("sign-in-password") : app.secureTextFields.firstMatch
                password.tap()
                password.typeText(env["WEWED_QRO05_PASSWORD"]!)
                control("sign-in-submit", label: "Sign In").tap()
                _ = shell.waitForExistence(timeout: 20) || grant.waitForExistence(timeout: 1)
            }
            if grant.exists { grant.tap() }
            _ = shell.waitForExistence(timeout: 2)
        }
        shell.tap()
        let chip = control("planner-more-section-invitations-qr", label: "Invitations & QR")
        XCTAssertTrue(chip.waitForExistence(timeout: 20), "Invitations & QR section")
        chip.tap()
        // The screen's root ScrollView takes the enclosing surface's identifier, so anchor on the
        // loaded Invitation design row itself.
        XCTAssertTrue(element("planner-invitation-style").waitForExistence(timeout: 60),
                      "the production Planner Invitations & QR surface must load real data")
    }

    /// Every visible label on screen — no private link or token may appear in any of them.
    private func assertNoLinkMaterialOnScreen(file: StaticString = #filePath, line: UInt = #line) {
        let forbidden = (env["WEWED_QRO05_FORBIDDEN_SUBSTRINGS"] ?? "").split(separator: ",").map(String.init) + ["http://", "https://", "rsvp="]
        for query in [app.staticTexts, app.buttons, app.images, app.otherElements] {
            for item in query.allElementsBoundByIndex where item.exists {
                let label = item.label
                for needle in forbidden where !needle.isEmpty {
                    XCTAssertFalse(label.contains(needle), "on-screen label exposes link material", file: file, line: line)
                }
            }
        }
    }

    func testPlannerInvitationsQrRendersRealReadOnlyData() {
        signInAndOpenInvitations()
        XCTAssertFalse(app.staticTexts["Printed-invitation and scan QR destinations are managed in Wewed on the web. The app does not load them yet."].exists)
        XCTAssertTrue(app.staticTexts[env["WEWED_QRO05_EXPECT_STYLE"] ?? "Ivory Floral Gold"].waitForExistence(timeout: 10),
                      "the saved card style must be shown by its human name")
        screenshot("qro05-invitations-design")

        let printedQr = scrollTo("planner-physical-invitation-qr")
        XCTAssertEqual(printedQr.label, "Printed invitation QR code")
        let status = element("planner-physical-invitation-status").label
        XCTAssertTrue(status.hasPrefix("Configured"), status)
        if let invited = env["WEWED_QRO05_EXPECT_INVITED"] { XCTAssertTrue(status.contains("\(invited) guests listed"), status) }
        if let scans = env["WEWED_QRO05_EXPECT_SCANS"] { XCTAssertTrue(status.contains("\(scans) opens"), status) }
        XCTAssertFalse(element("wedding-pass-qr").exists, "an invitation screen must never render a Wedding Pass")
        screenshot("qro05-printed-invitation-access")
        assertNoLinkMaterialOnScreen()

        for pair in (env["WEWED_QRO05_EXPECT_ROWS"] ?? "").split(separator: ",") {
            let parts = pair.split(separator: "=", maxSplits: 1).map(String.init)
            guard parts.count == 2 else { continue }
            _ = scrollTo("planner-guest-invitation-\(parts[0])")
            XCTAssertEqual(element("planner-guest-invitation-status-\(parts[0])").label, parts[1])
        }
        screenshot("qro05-guest-open-invitations")
        assertNoLinkMaterialOnScreen()

        guard let guestId = env["WEWED_QRO05_QR_GUEST"], let guestName = env["WEWED_QRO05_QR_GUEST_NAME"] else { return }
        scrollTo("planner-guest-invitation-show-qr-\(guestId)").tap()
        let guestQr = element("planner-guest-invitation-qr")
        XCTAssertTrue(guestQr.waitForExistence(timeout: 10))
        XCTAssertEqual(guestQr.label, "Invitation QR code for \(guestName)")
        XCTAssertEqual(element("planner-guest-invitation-qr-name").label, guestName)
        XCTAssertFalse(element("wedding-pass-qr").exists)
        screenshot("qro05-guest-invitation-qr")
        assertNoLinkMaterialOnScreen()
        tap("planner-guest-invitation-qr-done")
        XCTAssertTrue(guestQr.waitForNonExistence(timeout: 10))

        scrollTo("planner-guest-invitation-share-\(guestId)").tap()
        let shareSheet = app.otherElements["ActivityListView"]
        XCTAssertTrue(shareSheet.waitForExistence(timeout: 15), "Share Invitation must open the native share sheet")
        screenshot("qro05-guest-invitation-share-sheet")
        let close = app.buttons["Close"].firstMatch
        if close.exists { close.tap() } else { app.swipeDown(velocity: .fast) }
        XCTAssertTrue(shareSheet.waitForNonExistence(timeout: 10))
        XCTAssertTrue(element("planner-invitation-style").exists)
    }
}
