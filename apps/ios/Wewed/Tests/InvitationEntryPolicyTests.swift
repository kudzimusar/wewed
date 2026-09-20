import XCTest
@testable import WewedKit

/// Who this launch belongs to.
///
/// These are the ordering rules from the invitation protocol, each written as the bug it prevents
/// rather than as an abstract precedence table.
final class InvitationEntryPolicyTests: XCTestCase {

    private let guestA = InvitationEntry.privateInvitation(weddingSlug: "charity-and-kudzie",
                                                           rsvpToken: "TOKEN-A")
    private let guestB = InvitationEntry.privateInvitation(weddingSlug: "charity-and-kudzie",
                                                           rsvpToken: "TOKEN-B")
    private let handoff = InvitationEntry.handoff(secret: String(repeating: "A", count: 43))

    /// Tapping a link is present intent. It is the strongest claim there is.
    func testAnExplicitLinkEstablishesThatGuest() {
        XCTAssertEqual(InvitationEntryPolicy.decide(launchEntry: guestA), .establish(guestA))
    }

    /// A guest tapping their own invitation on a planner's phone should see their invitation.
    /// The privileged workspace is not a lock on the device.
    func testAnExplicitLinkOutranksAPrivilegedWorkspace() {
        XCTAssertEqual(
            InvitationEntryPolicy.decide(launchEntry: guestB, hasPrivilegedWorkspace: true),
            .establish(guestB)
        )
    }

    /// The failure this prevents: an invalid Guest B link quietly presenting Guest A, so the wrong
    /// person's card opens and the wrong person's RSVP is offered.
    func testAnInvalidLinkFailsClosedRatherThanFallingBack() {
        let decision = InvitationEntryPolicy.decide(
            launchEntry: .rejected(.malformedHandoff),
            hasRememberedGuestSession: true
        )
        XCTAssertEqual(decision, .reject(.malformedHandoff))
        XCTAssertNotEqual(decision, .restoreRememberedGuest)
    }

    /// A resume URL carrying a raw credential is refused, not downgraded to an ordinary launch.
    func testAResumeCarryingARawCredentialIsRejected() {
        XCTAssertEqual(
            InvitationEntryPolicy.decide(launchEntry: .rejected(.resumeCarriedRawCredential)),
            .reject(.resumeCarriedRawCredential)
        )
    }

    /// A fresh tap beats an install record, which may be months old.
    func testAnExplicitLinkOutranksADeferredInstallRecord() {
        XCTAssertEqual(
            InvitationEntryPolicy.decide(launchEntry: guestB,
                                         deferredInstallEntry: handoff,
                                         deferredInstallAlreadyProcessed: false),
            .establish(guestB)
        )
    }

    /// An unconsumed install record is honoured when nothing newer exists.
    func testAnUnprocessedDeferredInstallEstablishesTheGuest() {
        XCTAssertEqual(
            InvitationEntryPolicy.decide(launchEntry: nil,
                                         deferredInstallEntry: handoff,
                                         deferredInstallAlreadyProcessed: false),
            .establish(handoff)
        )
    }

    /// Once consumed it stays consumed. Otherwise an install record surfaces again on an ordinary
    /// launch weeks later and reopens someone else's invitation.
    func testAProcessedDeferredInstallIsNeverReplayed() {
        XCTAssertEqual(
            InvitationEntryPolicy.decide(launchEntry: nil,
                                         deferredInstallEntry: handoff,
                                         deferredInstallAlreadyProcessed: true),
            .none
        )
    }

    /// An ordinary cold launch restores the guest this device already holds.
    func testAnOrdinaryLaunchRestoresTheRememberedGuest() {
        XCTAssertEqual(
            InvitationEntryPolicy.decide(launchEntry: nil, hasRememberedGuestSession: true),
            .restoreRememberedGuest
        )
    }

    /// Remembered guest state is the weakest claim. A planner signing in to run a wedding must not
    /// find themselves inside a guest's invitation because that device once opened one.
    func testRememberedGuestStateNeverHijacksAPrivilegedWorkspace() {
        XCTAssertEqual(
            InvitationEntryPolicy.decide(launchEntry: nil,
                                         hasRememberedGuestSession: true,
                                         hasPrivilegedWorkspace: true),
            .none
        )
    }

    /// Someone who simply opened the app is not a guest of anyone's wedding.
    func testAnOrdinaryLaunchWithNothingRememberedIsNotInvitationEntry() {
        XCTAssertEqual(InvitationEntryPolicy.decide(launchEntry: nil), .none)
    }
}
