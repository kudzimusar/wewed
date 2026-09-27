import XCTest

// QRO06-GUEST-LAUNCH01 — FINAL NATIVE Guest corridor against a REAL Wewed backend.
//
// Drives the final Guest components (GuestOnlyInvitationShellView → LiveGuestInvitationView →
// LiveGuestShellView) through the DEBUG loopback Guest lane, pointed at the origin in
// TEST_RUNNER_WEWED_QRO06_ORIGIN (a local `next dev` of this branch on a disposable database).
// Skipped unless that origin and the synthetic Guest links are supplied. Never Shadow, never a
// DevelopmentPersona. Links are synthetic fixture credentials, never real invitees'.
final class GuestLaunchLaneUITests: XCTestCase {
    private var app: XCUIApplication!
    private let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
    private var env: [String: String] { ProcessInfo.processInfo.environment }

    override func record(_ issue: XCTIssue) {
        if let dir = env["WEWED_QRO06_SHOT_DIR"], !dir.isEmpty, let app {
            let name = "\(self.name.split(separator: " ").last?.dropLast() ?? "test")-failure"
            try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
            try? app.debugDescription.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).txt"), atomically: true, encoding: .utf8)
        }
        super.record(issue)
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
        guard let origin = env["WEWED_QRO06_ORIGIN"], !origin.isEmpty else {
            throw XCTSkip("QRO06 local Guest lane origin not supplied")
        }
    }

    private func link(_ key: String) throws -> String {
        guard let value = env["WEWED_QRO06_\(key)_LINK"], !value.isEmpty else { throw XCTSkip("\(key) link not supplied") }
        return value
    }

    private func launch(_ link: String) {
        app = XCUIApplication()
        app.launchEnvironment["WEWED_GUEST_UI_ORIGIN"] = env["WEWED_QRO06_ORIGIN"]
        app.launchEnvironment["WEWED_GUEST_UI_LINK"] = link
        app.launch()
    }

    private func element(_ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }

    @discardableResult
    private func tap(_ id: String, timeout: TimeInterval = 20, file: StaticString = #filePath, line: UInt = #line) -> XCUIElement {
        let target = element(id)
        XCTAssertTrue(target.waitForExistence(timeout: timeout), id, file: file, line: line)
        var swipes = 0
        while !target.isHittable && swipes < 8 { app.swipeUp(); swipes += 1 }
        target.tap()
        return target
    }

    private func screenshot(_ name: String) {
        let shot = XCUIScreen.main.screenshot()
        // Local-only evidence directory (the simulator runner writes to the host's scratchpad).
        if let dir = env["WEWED_QRO06_SHOT_DIR"], !dir.isEmpty {
            try? shot.pngRepresentation.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
        }
        let attachment = XCTAttachment(screenshot: shot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func label(_ id: String) -> String { element(id).label }

    private func text(_ contains: String, in target: XCUIApplication) -> XCUIElement {
        target.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", contains)).firstMatch
    }

    /// Every visible label — a private link or raw credential must never appear.
    private func assertNoCredentialOnScreen(file: StaticString = #filePath, line: UInt = #line) {
        let forbidden = ["rsvp=", "q6tok", "wewed_wedding_guest", "guest-browser-handoff"]
        for query in [app.staticTexts, app.buttons, app.otherElements] {
            for item in query.allElementsBoundByIndex where item.exists {
                for needle in forbidden {
                    XCTAssertFalse(item.label.contains(needle), "credential material on screen", file: file, line: line)
                }
            }
        }
    }

    /// The browser must show the couple's site as THIS Guest — never the invitation gateway.
    private func assertBrowserShowsAuthorizedSite(expect: String, _ name: String, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 25), "Safari did not open", file: file, line: line)
        // Let the handoff page finish: until it has, the previous page's content may still be in
        // Safari's accessibility tree.
        let handoffPage = text("Opening your wedding", in: safari)
        _ = handoffPage.waitForExistence(timeout: 10)
        _ = handoffPage.waitForNonExistence(timeout: 75)
        let wanted = text(expect, in: safari)
        let gateway = text("Open your invitation", in: safari)
        _ = wanted.waitForExistence(timeout: 45)
        screenshot(name)
        XCTAssertFalse(gateway.exists, "the browser lost Guest authority and showed the gateway", file: file, line: line)
        XCTAssertTrue(wanted.exists, "the browser did not show \(expect)", file: file, line: line)
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10), file: file, line: line)
    }

    private func openInvitationDetails(personalizedFor guest: String? = nil) {
        tap("invitation-open-button", timeout: 40)
        if let guest {
            XCTAssertTrue(text(guest, in: app).waitForExistence(timeout: 10), "card personalized for \(guest)")
            screenshot("qro06-opened-card")
        }
        tap("invitation-details-button")
        XCTAssertTrue(element("invitation-interactive-details").waitForExistence(timeout: 15))
    }

    // MARK: Pending — invitation-bound, every CTA functions, no admission

    func testPendingGuestIvoryInvitationAndEveryCta() throws {
        launch(try link("PENDING"))
        XCTAssertTrue(element("invitation-style-ivory-floral-gold").waitForExistence(timeout: 40), "saved Ivory Floral Gold design")
        XCTAssertTrue(label("invitation-couple-names").contains("Rudo"))
        screenshot("qro06-pending-cover")
        openInvitationDetails(personalizedFor: "Tariro")
        screenshot("qro06-pending-details")
        for cta in ["invitation-cta-rsvp", "invitation-cta-calendar", "invitation-cta-venue", "invitation-cta-note",
                    "invitation-cta-pass"] {
            XCTAssertTrue(element(cta).exists, "\(cta) missing")
        }
        XCTAssertTrue(element("invitation-cta-gifts").exists || element("invitation-cta-registry").exists, "Gift / Contributions CTA")
        // NM03 (accepted): the native Ivory gateway holds only View Invitation + Guest Pass; the
        // Couple Website lives in More.
        XCTAssertTrue(element("invitation-back-to-invitation").exists)
        XCTAssertFalse(element("invitation-cta-couple-site").exists)
        XCTAssertFalse(element("live-guest-shell").exists, "pending stays invitation-bound")
        assertNoCredentialOnScreen()

        // A Note from Us: shown because a real message exists.
        tap("invitation-cta-note")
        XCTAssertTrue(element("invitation-note-sheet").waitForExistence(timeout: 10))
        XCTAssertTrue(text("celebrate with us", in: app).exists)
        tap("invitation-note-dismiss")

        // Guest Pass: RSVP required, never an admission QR.
        tap("invitation-cta-pass")
        XCTAssertTrue(element("invitation-rsvp-prompt").waitForExistence(timeout: 15))
        XCTAssertFalse(element("wedding-pass-qr").exists)
        screenshot("qro06-pending-pass-requires-rsvp")
    }

    func testPendingGuestBrowserCtasKeepGuestAuthority() throws {
        launch(try link("PENDING"))
        openInvitationDetails()
        let gifts = element("invitation-cta-gifts").exists ? "invitation-cta-gifts" : "invitation-cta-registry"
        tap(gifts)
        assertBrowserShowsAuthorizedSite(expect: env["WEWED_QRO06_REGISTRY_TEXT"] ?? "With Gratitude", "qro06-pending-gifts-browser")
    }

    func testPendingGuestVenueAndCalendarOpenRealDestinations() throws {
        launch(try link("PENDING"))
        openInvitationDetails()
        tap("invitation-cta-venue")
        let maps = XCUIApplication(bundleIdentifier: "com.apple.Maps")
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 20) || maps.wait(for: .runningForeground, timeout: 5),
                      "Venue must open a real map destination")
        screenshot("qro06-venue-destination")
        app.activate()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 10))
        tap("invitation-cta-calendar")
        // The system event editor, prefilled with the real wedding — never a no-op.
        let editor = app.navigationBars["New Event"]
        XCTAssertTrue(editor.waitForExistence(timeout: 20), "Add to Calendar must present the system event editor")
        XCTAssertTrue(app.textFields["Rudo & Tendai Wedding"].exists || text("Rudo & Tendai Wedding", in: app).exists,
                      "event is prefilled with the real couple")
        screenshot("qro06-add-to-calendar")
        editor.buttons["Cancel"].tap()
        XCTAssertTrue(editor.waitForNonExistence(timeout: 10))
    }

    func testLeaveWeddingThenReopenInvitation() throws {
        let pending = try link("PENDING")
        launch(pending)
        openInvitationDetails()
        tap("invitation-leave-wedding")
        let confirm = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Leave'")).firstMatch
        if confirm.waitForExistence(timeout: 5) { confirm.tap() }
        XCTAssertTrue(element("invitation-open-button").waitForNonExistence(timeout: 15), "left the wedding")
        screenshot("qro06-left-wedding")
        app.terminate()
        launch(pending)
        XCTAssertTrue(element("invitation-open-button").waitForExistence(timeout: 40), "the invitation reopens from its link")
    }

    // MARK: Attending — full shell with real data; Pass outside the issuance window

    func testAttendingGuestShellRealDataAndCtas() throws {
        launch(try link("ATTENDING"))
        openInvitationDetails(personalizedFor: "Chipo")
        XCTAssertTrue(text("Update RSVP", in: app).exists, "an answered Guest can update RSVP")
        tap("invitation-cta-pass")
        XCTAssertTrue(element("live-guest-shell").waitForExistence(timeout: 20))

        // Home
        tap("nav-guest-home")
        XCTAssertTrue(text("Rudo", in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(text("Chipo Attending", in: app).exists)
        XCTAssertTrue(text("Qualification Manor", in: app).exists, "venue on Home")
        XCTAssertTrue(text("Days", in: app).waitForExistence(timeout: 5), "countdown")
        // Home tells the truth about the Pass: attending, but not yet issuable.
        XCTAssertTrue(text("Not yet", in: app).waitForExistence(timeout: 20), "Home shows the server's pass state")
        XCTAssertFalse(text("Your admission pass is ready.", in: app).exists)
        XCTAssertTrue(element("guest-home-digital-invitation").exists)
        XCTAssertTrue(element("guest-home-next-programme").waitForExistence(timeout: 10))
        screenshot("qro06-attending-home")
        assertNoCredentialOnScreen()

        // Pass — attending but outside the 14-day window: real not_yet_issuable + opening date.
        tap("nav-guest-pass")
        XCTAssertTrue(text("available closer to the wedding", in: app).waitForExistence(timeout: 20))
        XCTAssertTrue(text("Available from", in: app).exists, "opening date shown")
        XCTAssertFalse(element("wedding-pass-qr").exists, "no early Pass for presentation")
        screenshot("qro06-attending-pass-not-yet-issuable")

        // Wedding Day — real programme, table and party.
        tap("nav-guest-wedding_day")
        // Real ProgrammeItem rows, in order, identified by their row ids.
        XCTAssertTrue(element("guest-day-programme").waitForExistence(timeout: 20))
        for (row, title) in [("q6-p1", "Ceremony"), ("q6-p2", "Photographs"), ("q6-p3", "Reception"), ("q6-p4", "First Dance")] {
            XCTAssertTrue(element("guest-programme-\(row)").exists, row)
            XCTAssertTrue(text(title, in: app).exists, title)
        }
        XCTAssertTrue(element("guest-party-member-plus-one").exists, "real party (plus one)")
        XCTAssertTrue(element("guest-day-table").exists)
        XCTAssertTrue(text("Acacia", in: app).exists)
        XCTAssertTrue(element("guest-day-party").exists)
        screenshot("qro06-attending-wedding-day")

        // More / Profile — rich real fields.
        tap("nav-guest-more")
        XCTAssertTrue(element("live-guest-profile-name").waitForExistence(timeout: 10))
        for id in ["live-guest-profile-email", "live-guest-profile-rsvp", "live-guest-profile-seating",
                   "live-guest-profile-party", "live-guest-profile-meal", "live-guest-profile-dietary",
                   "live-guest-profile-message"] {
            XCTAssertTrue(element(id).exists, "\(id) missing")
        }
        XCTAssertTrue(text("Beef", in: app).exists)
        XCTAssertTrue(text("No nuts", in: app).exists)
        XCTAssertTrue(text("Tawanda", in: app).exists)
        screenshot("qro06-attending-more")
        assertNoCredentialOnScreen()

        tap("guest-profile-couple-site")
        assertBrowserShowsAuthorizedSite(expect: "Rudo", "qro06-more-couple-site-browser")
        tap("guest-more-gifts")
        assertBrowserShowsAuthorizedSite(expect: env["WEWED_QRO06_REGISTRY_TEXT"] ?? "With Gratitude", "qro06-more-gifts-browser")
        tap("guest-more-help")
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 20), "Help opens")
        screenshot("qro06-help")
        app.activate()
        tap("guest-more-privacy")
        XCTAssertTrue(safari.wait(for: .runningForeground, timeout: 20), "Privacy & Legal opens")
        screenshot("qro06-legal")
        app.activate()

        // Forget this wedding: only the device relationship goes.
        tap("live-guest-forget-wedding")
        let confirm = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Forget'")).firstMatch
        if confirm.waitForExistence(timeout: 5) { confirm.tap() }
        XCTAssertTrue(element("live-guest-shell").waitForNonExistence(timeout: 15))
        screenshot("qro06-forgot-wedding")
    }

    // MARK: Declined — persistent shell, no admission, no attendance-only profile data

    func testDeclinedGuestNoAdmissionNoAttendanceOnlyProfile() throws {
        launch(try link("DECLINED"))
        openInvitationDetails(personalizedFor: "Kuda")
        XCTAssertTrue(text("Update RSVP", in: app).exists, "a declined Guest can still update RSVP")
        tap("invitation-cta-pass")
        XCTAssertTrue(element("live-guest-shell").waitForExistence(timeout: 20))
        tap("nav-guest-pass")
        XCTAssertTrue(element("live-guest-pass-declined").waitForExistence(timeout: 15))
        XCTAssertFalse(element("wedding-pass-qr").exists)
        tap("nav-guest-more")
        XCTAssertTrue(element("live-guest-profile-rsvp").waitForExistence(timeout: 10))
        XCTAssertTrue(element("live-guest-profile-message").exists)
        for id in ["live-guest-profile-seating", "live-guest-profile-party", "live-guest-profile-meal", "live-guest-profile-dietary"] {
            XCTAssertFalse(element(id).exists, "declined Guest shown attendance-only \(id)")
        }
        screenshot("qro06-declined-more")
    }

    // MARK: Attending inside the issuance window — verified WW2 credential

    func testAttendingInsideWindowGetsVerifiedPass() throws {
        launch(try link("WINDOW"))
        openInvitationDetails()
        tap("invitation-cta-pass")
        XCTAssertTrue(element("wedding-pass-qr").waitForExistence(timeout: 30), "verified WW2 pass")
        screenshot("qro06-window-pass")
    }

    // MARK: RSVP — a pending Guest answers through the real server

    func testPendingGuestSubmitsRsvpThroughTheServer() throws {
        launch(try link("RSVP"))
        openInvitationDetails()
        tap("invitation-cta-rsvp")
        tap("invitation-rsvp-accept")
        tap("invitation-rsvp-save")
        // The server accepted it: the same card now offers Update RSVP and the persistent Pass door.
        XCTAssertTrue(text("Update RSVP", in: app).waitForExistence(timeout: 20), "RSVP saved through the server")
        tap("invitation-cta-pass")
        XCTAssertTrue(element("live-guest-shell").waitForExistence(timeout: 20), "answered Guest enters the shell")
        screenshot("qro06-rsvp-saved")
    }
}
