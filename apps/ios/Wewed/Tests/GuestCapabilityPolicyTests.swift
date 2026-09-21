import XCTest
@testable import WewedKit

/// What an invited Guest may do.
///
/// The rule under test is the one that is easy to get backwards: the invitation establishes
/// identity, and RSVP determines capability. A guest who has not answered is an invited guest who
/// has not answered — not a stranger at the door.
final class GuestCapabilityPolicyTests: XCTestCase {

    /// A guest who has not answered still has a wedding, an invitation and a profile.
    func testAPendingGuestMayEnterTheirOwnExperience() {
        let pending = GuestCapabilityPolicy.capabilities(attending: nil)
        for capability in [GuestCapability.home, .invitation, .weddingDetails, .venue,
                           .coupleWebsite, .registry, .profile] {
            XCTAssertTrue(pending.contains(capability),
                          "\(capability) must be available while pending")
        }
    }

    /// And is asked the question, because they have not answered it.
    func testAPendingGuestIsOfferedRsvp() {
        XCTAssertTrue(GuestCapabilityPolicy.allows(attending: nil, .rsvp))
        XCTAssertTrue(GuestCapabilityPolicy.awaitsResponse(attending: nil))
    }

    /// But holds no admission credential: they have not said they are coming.
    func testAPendingGuestHasNoPass() {
        XCTAssertFalse(GuestCapabilityPolicy.allows(attending: nil, .weddingPass))
    }

    /// Accepting is what unlocks the day itself.
    func testAnAttendingGuestGainsTheDayCapabilities() {
        let attending = GuestCapabilityPolicy.capabilities(attending: true)
        for capability in [GuestCapability.weddingPass, .partyDetails, .seating,
                           .weddingDayProgramme, .announcements, .checkInState] {
            XCTAssertTrue(attending.contains(capability), "\(capability) must follow from attending")
        }
    }

    /// An answered guest is never asked again, whichever way they answered.
    func testAnAnsweredGuestIsNotAskedAgain() {
        XCTAssertFalse(GuestCapabilityPolicy.awaitsResponse(attending: true))
        XCTAssertFalse(GuestCapabilityPolicy.awaitsResponse(attending: false))
        XCTAssertFalse(GuestCapabilityPolicy.allows(attending: true, .rsvp))
        XCTAssertFalse(GuestCapabilityPolicy.allows(attending: false, .rsvp))
    }

    /// Declining does not un-invite anyone.
    func testADeclinedGuestKeepsTheirInvitationAndProfile() {
        let declined = GuestCapabilityPolicy.capabilities(attending: false)
        XCTAssertTrue(declined.contains(.invitation))
        XCTAssertTrue(declined.contains(.profile))
        XCTAssertTrue(declined.contains(.home))
        XCTAssertTrue(declined.contains(.coupleWebsite))
    }

    /// What they do not get is admission, or anything that presumes it.
    func testADeclinedGuestReceivesNoAdmission() {
        for capability in [GuestCapability.weddingPass, .seating, .checkInState,
                           .weddingDayProgramme] {
            XCTAssertFalse(GuestCapabilityPolicy.allows(attending: false, capability),
                           "\(capability) must not follow a decline")
        }
    }

    /// The pass is the one capability that separates attending from every other state.
    func testOnlyAttendingEverYieldsAPass() {
        XCTAssertTrue(GuestCapabilityPolicy.allows(attending: true, .weddingPass))
        for attending in [nil, false] as [Bool?] {
            XCTAssertFalse(GuestCapabilityPolicy.allows(attending: attending, .weddingPass))
        }
    }
}
