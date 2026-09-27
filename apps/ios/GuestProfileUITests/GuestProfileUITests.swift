import XCTest

// FINAL NATIVE GUEST SURFACE tests (QRO04-UI01): real final Guest components (GuestOnlyInvitationShellView,
// LiveGuestInvitationView, LiveGuestShellView) against the loopback synthetic server
// scripts/native-mobile/guest-profile-ui-server.py. Never Shadow, never a DevelopmentPersona.

final class GuestProfileUITests: XCTestCase {
    private var app: XCUIApplication!
    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchEnvironment["WEWED_GUEST_UI_ORIGIN"] = "http://127.0.0.1:8768"
    }
    private func start(_ status: String = "pending") {
        app.launchEnvironment["WEWED_GUEST_UI_LINK"] = "https://wewed.pro/invite/guest-ui?rsvp=\(status)"
        app.launch()
    }
    private func element(_ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }
    private func tap(_ id: String) {
        let target = element(id)
        XCTAssertTrue(target.waitForExistence(timeout: 20), id)
        target.tap()
    }
    private func enterAnsweredGuest(_ status: String = "attending", destination: String = "home") {
        start(status)
        tap("invitation-open-button")
        tap("invitation-details-button")
        tap("invitation-cta-pass")
        XCTAssertTrue(element("live-guest-shell").waitForExistence(timeout: 10))
        if destination == "home" { tap("nav-guest-home") }
    }
    func testInvitationHomeReopenAndRelaunch() {
        enterAnsweredGuest("attending")
        tap("guest-home-digital-invitation")
        XCTAssertTrue(element("invitation-open-button").waitForExistence(timeout: 10))
        tap("invitation-back-to-wedding")
        XCTAssertTrue(element("guest-home-digital-invitation").exists)
        app.terminate()
        app.launchEnvironment.removeValue(forKey: "WEWED_GUEST_UI_LINK")
        app.launch()
        XCTAssertTrue(element("guest-home-digital-invitation").waitForExistence(timeout: 20))
        tap("nav-guest-invitation")
        XCTAssertTrue(element("invitation-open-button").waitForExistence(timeout: 10))
    }
    func testProfileAndPassReturnToPreviousSurface() {
        enterAnsweredGuest("declined")

        tap("nav-guest-more")
        XCTAssertTrue(element("live-guest-profile-name").waitForExistence(timeout: 10))
        tap("nav-guest-invitation")
        tap("invitation-back-to-wedding")
        XCTAssertTrue(element("live-guest-profile-name").waitForExistence(timeout: 10))

        tap("nav-guest-pass")
        XCTAssertTrue(element("live-guest-pass-declined").waitForExistence(timeout: 10))
        tap("nav-guest-invitation")
        tap("invitation-back-to-wedding")
        XCTAssertTrue(element("live-guest-pass-declined").waitForExistence(timeout: 10))
    }
    func testAttendingCardOpensServerPassAndWeddingDay() {
        start("attending")
        tap("invitation-open-button"); tap("invitation-details-button"); tap("invitation-cta-pass")
        let qrExists = element("wedding-pass-qr").waitForExistence(timeout: 20)
        if !qrExists { print(app.debugDescription) }
        XCTAssertTrue(qrExists)
        XCTAssertFalse(app.staticTexts["2027-06-12"].exists, "Pass must not expose a raw database date")
        XCTAssertTrue(app.staticTexts["Jun 12, 2027"].exists, "Pass must format a date-only wedding date")
        tap("nav-guest-wedding_day")
        XCTAssertTrue(element("guest-programme-ceremony").waitForExistence(timeout: 20))
        XCTAssertTrue(element("guest-announcement-welcome").exists)
        XCTAssertTrue(element("guest-day-table").exists)

        tap("nav-guest-more")
        XCTAssertTrue(element("live-guest-profile-email").waitForExistence(timeout: 10))
        XCTAssertTrue(element("live-guest-profile-seating").exists)
        XCTAssertTrue(element("live-guest-profile-party").exists)
        XCTAssertTrue(element("live-guest-profile-meal").exists)
        XCTAssertTrue(element("live-guest-profile-dietary").exists)
        XCTAssertTrue(element("live-guest-profile-message").exists)
    }
    func testPendingAndDeclinedDoNotGetPass() {
        // Pending is intentionally invitation-only until RSVP completion.
        start("pending")
        tap("invitation-open-button")
        tap("invitation-details-button")
        XCTAssertFalse(element("invitation-continue").exists)
        XCTAssertFalse(element("live-guest-shell").exists)
        XCTAssertTrue(element("invitation-leave-wedding").exists)
        tap("invitation-cta-pass")
        XCTAssertTrue(element("invitation-rsvp-prompt").waitForExistence(timeout: 10))
        XCTAssertFalse(element("wedding-pass-qr").exists)
        app.terminate()

        // Declined is an answered Guest: persistent wedding context is allowed, admission is not.
        enterAnsweredGuest("declined", destination: "pass")
        XCTAssertTrue(element("live-guest-pass-declined").waitForExistence(timeout: 10))
        XCTAssertFalse(element("wedding-pass-qr").exists)
        app.terminate()
    }
    func testProductionGuestOnlyLaunchSurvivesWithoutCrash() {
        let prodApp = XCUIApplication()
        prodApp.launchEnvironment["WEWED_NATIVE_ENV"] = "production"
        prodApp.launchEnvironment["WEWED_GUEST_UI_CLEAR_SESSION"] = "1"
        prodApp.launchEnvironment.removeValue(forKey: "WEWED_GUEST_UI_ORIGIN")
        prodApp.launchEnvironment.removeValue(forKey: "WEWED_GUEST_UI_LINK")
        prodApp.launch()
        XCTAssertTrue(prodApp.wait(for: .runningForeground, timeout: 15))
        let welcome = prodApp.descendants(matching: .any).matching(identifier: "welcome-root").firstMatch
        let unavailable = prodApp.descendants(matching: .any).matching(identifier: "invitation-unavailable").firstMatch
        let awaitingLink = prodApp.descendants(matching: .any).matching(identifier: "invitation-awaiting-link").firstMatch
        let shell = prodApp.descendants(matching: .any).matching(identifier: "live-guest-shell").firstMatch
        let exchanging = prodApp.descendants(matching: .any).matching(identifier: "invitation-exchanging").firstMatch
        XCTAssertTrue(welcome.waitForExistence(timeout: 10) || unavailable.waitForExistence(timeout: 5) || awaitingLink.waitForExistence(timeout: 5) || shell.waitForExistence(timeout: 5) || exchanging.waitForExistence(timeout: 5))
    }
}

