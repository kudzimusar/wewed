import XCTest

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
    private func continueToHome() {
        tap("invitation-open-button")
        tap("invitation-details-button")
        tap("invitation-continue")
        XCTAssertTrue(element("guest-home-digital-invitation").waitForExistence(timeout: 10))
    }
    func testInvitationHomeReopenAndRelaunch() {
        start(); continueToHome()
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
        start(); continueToHome()
        tap("nav-guest-more"); tap("guest-profile-digital-invitation")
        tap("invitation-back-to-wedding")
        XCTAssertTrue(element("guest-profile-digital-invitation").exists)
        tap("nav-guest-pass"); tap("nav-guest-invitation")
        tap("invitation-back-to-wedding")
        XCTAssertTrue(element("live-guest-pass-pending").exists)
    }
    func testAttendingCardOpensServerPassAndWeddingDay() {
        start("attending")
        tap("invitation-open-button"); tap("invitation-details-button"); tap("invitation-cta-pass")
        let qrExists = element("wedding-pass-qr").waitForExistence(timeout: 20)
        if !qrExists { print(app.debugDescription) }
        XCTAssertTrue(qrExists)
        tap("nav-guest-wedding_day")
        XCTAssertTrue(element("guest-programme-ceremony").waitForExistence(timeout: 20))
        XCTAssertTrue(element("guest-announcement-welcome").exists)
        XCTAssertTrue(element("guest-day-table").exists)
    }
    func testPendingAndDeclinedDoNotGetPass() {
        for status in ["pending", "declined"] {
            start(status); continueToHome(); tap("nav-guest-pass")
            XCTAssertTrue(element("live-guest-pass-\(status)").exists)
            XCTAssertFalse(element("wedding-pass-qr").exists)
            app.terminate()
        }
    }
}
