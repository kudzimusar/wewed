import XCTest
@testable import WewedKit

/// What an invited Guest may do.
///
/// The rule under test is the one that is easy to get backwards: the invitation establishes
/// identity, and RSVP determines capability. A guest who has not answered is an invited guest who
/// has not answered — not a stranger at the door.
final class GuestCapabilityPolicyTests: XCTestCase {

    /// Pending is invitation-only: identity is known, but persistent Guest entry is not yet open.
    func testAPendingGuestCannotEnterThePersistentExperience() {
        let pending = GuestCapabilityPolicy.capabilities(attending: nil)
        for capability in [GuestCapability.invitation, .weddingDetails, .venue,
                           .coupleWebsite, .registry] {
            XCTAssertTrue(pending.contains(capability),
                          "\(capability) must remain available from the invitation")
        }
        XCTAssertFalse(pending.contains(.home))
        XCTAssertFalse(pending.contains(.profile))
        XCTAssertFalse(GuestCapabilityPolicy.mayEnterPersistentExperience(attending: nil))
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

    /// Any completed RSVP unlocks the persistent Guest application.
    func testAnsweredGuestsMayEnterThePersistentExperience() {
        XCTAssertTrue(GuestCapabilityPolicy.mayEnterPersistentExperience(attending: true))
        XCTAssertTrue(GuestCapabilityPolicy.mayEnterPersistentExperience(attending: false))
    }

    /// Both answered states may see the shared wedding-day information.
    func testAnsweredGuestsCanSeeSharedWeddingDayDetails() {
        for attending in [true, false] {
            let capabilities = GuestCapabilityPolicy.capabilities(attending: attending)
            for capability in [GuestCapability.partyDetails, .weddingDayProgramme, .announcements] {
                XCTAssertTrue(capabilities.contains(capability),
                              "\(capability) must remain available to invited guests")
            }
        }
    }

    /// Attending alone unlocks venue-admission and attendance operations.
    func testAnAttendingGuestGainsAdmissionCapabilities() {
        let attending = GuestCapabilityPolicy.capabilities(attending: true)
        for capability in [GuestCapability.weddingPass, .seating, .checkInState] {
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

    /// Declining removes venue admission, not the benefit of remaining an invited Guest.
    func testADeclinedGuestReceivesNoVenueAdmission() {
        for capability in [GuestCapability.weddingPass, .seating, .checkInState] {
            XCTAssertFalse(GuestCapabilityPolicy.allows(attending: false, capability),
                           "\(capability) must not follow a decline")
        }
        XCTAssertTrue(GuestCapabilityPolicy.allows(attending: false, .weddingDayProgramme))
        XCTAssertTrue(GuestCapabilityPolicy.allows(attending: false, .announcements))
    }

    /// The pass is the one capability that separates attending from every other state.
    func testOnlyAttendingEverYieldsAPass() {
        XCTAssertTrue(GuestCapabilityPolicy.allows(attending: true, .weddingPass))
        for attending in [nil, false] as [Bool?] {
            XCTAssertFalse(GuestCapabilityPolicy.allows(attending: attending, .weddingPass))
        }
    }
}
