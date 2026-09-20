import XCTest
@testable import WewedKit

/// The Guest Ceremonial Entry Contract, as a set of assertions.
///
/// The invitation was being treated as an onboarding page — shown once, answered, discarded. The
/// Couple recognised this person; the card is that recognition, and it belongs at the start of
/// every visit. These tests hold that rule in place, because it is the kind of rule a later
/// refactor silently undoes.
///
/// The Android counterpart asserts the same rules in the same order.
final class GuestCeremonialEntryTests: XCTestCase {

    private func invitation(confirmed: Bool = false, declined: Bool = false,
                            guest: String = "Invited Guest") -> InvitationContext {
        InvitationContext(
            weddingSlug: "charity-and-kudzie",
            guestToken: "token-\(guest)",
            coupleNames: "Charity & Kudzie",
            guestName: guest,
            partySize: 2,
            weddingDate: "2026-12-23T14:00:00",
            venueName: "Imba Manor",
            venueCity: "Harare, Zimbabwe",
            isConfirmed: confirmed,
            isDeclined: declined
        )
    }

    // MARK: - The card comes first, on every entry session, whatever was answered

    func testARecognisedPendingGuestMeetsTheCardBeforeTheGuestWorkspace() {
        let state = LaunchRouter.route(
            invitation: nil, hasValidSession: true, authorizedRoles: [.guest],
            hasResolvedContext: true,
            recognisedGuestInvitation: invitation(), entrySessionPresentedCard: false
        )
        guard case .invitation = state else {
            return XCTFail("the card must precede the Guest workspace, got \(state)")
        }
    }

    /// Having already answered does not retire the card. It changes what the card asks.
    func testARecognisedAttendingGuestStillMeetsTheCardFirst() {
        let state = LaunchRouter.route(
            invitation: nil, hasValidSession: true, authorizedRoles: [.guest],
            hasResolvedContext: true,
            recognisedGuestInvitation: invitation(confirmed: true), entrySessionPresentedCard: false
        )
        guard case let .invitation(_, stage) = state else { return XCTFail("expected the card") }
        XCTAssertEqual(stage, .confirmed)
    }

    func testARecognisedDeclinedGuestStillMeetsTheCardFirst() {
        let state = LaunchRouter.route(
            invitation: nil, hasValidSession: true, authorizedRoles: [.guest],
            hasResolvedContext: true,
            recognisedGuestInvitation: invitation(declined: true), entrySessionPresentedCard: false
        )
        guard case let .invitation(_, stage) = state else { return XCTFail("expected the card") }
        XCTAssertEqual(stage, .declined)
    }

    /// The ceremony marks a session, not a screen transition.
    func testTheCardDoesNotRepeatWithinOneEntrySession() {
        let state = LaunchRouter.route(
            invitation: nil, hasValidSession: true, authorizedRoles: [.guest],
            hasResolvedContext: true,
            recognisedGuestInvitation: invitation(confirmed: true), entrySessionPresentedCard: true
        )
        XCTAssertEqual(state, .workspace(.guest))
    }

    /// Only Guests are recognised this way; nothing here changes how other roles enter.
    func testACoupleEntryIsUnaffectedByTheGuestContract() {
        let state = LaunchRouter.route(
            invitation: nil, hasValidSession: true, authorizedRoles: [.couple],
            hasResolvedContext: true,
            recognisedGuestInvitation: nil, entrySessionPresentedCard: false
        )
        XCTAssertEqual(state, .workspace(.couple))
    }

    /// A link being opened now still outranks the standing recognition.
    func testAnIncomingInvitationOutranksTheRecognisedGuest() {
        let state = LaunchRouter.route(
            invitation: invitation(guest: "Guest B"), hasValidSession: true,
            authorizedRoles: [.guest], hasResolvedContext: true,
            recognisedGuestInvitation: invitation(confirmed: true, guest: "Guest A"),
            entrySessionPresentedCard: false
        )
        guard case let .invitation(context, _) = state else { return XCTFail("expected the card") }
        XCTAssertEqual(context.guestName, "Guest B")
    }

    // MARK: - What the card asks, across the wedding's life

    func testAPendingGuestIsAskedToRespond() {
        let card = GuestCeremonialEntry.presentation(rsvp: .pending, lifecycle: .before)
        XCTAssertEqual(card.primaryAction, .rsvpNow)
        XCTAssertTrue(card.awaitsResponse)
        XCTAssertFalse(card.issuesPass, "a guest who has not replied has no pass")
    }

    /// The single most important behaviour here: never ask someone the same question twice.
    func testAnAttendingGuestIsNeverAskedToRespondAgain() {
        let card = GuestCeremonialEntry.presentation(rsvp: .attending, lifecycle: .before)
        XCTAssertFalse(card.awaitsResponse, "an answered invitation must not re-ask")
        XCTAssertFalse(card.offers(.rsvpNow))
        XCTAssertEqual(card.statusLabel, "RSVP confirmed")
        XCTAssertEqual(card.primaryAction, .viewPass)
        XCTAssertTrue(card.issuesPass)
    }

    func testADeclinedGuestIsNeverAskedAgainAndNeverGivenAPass() {
        let card = GuestCeremonialEntry.presentation(rsvp: .declined, lifecycle: .before)
        XCTAssertFalse(card.awaitsResponse)
        XCTAssertEqual(card.statusLabel, "Not attending")
        XCTAssertFalse(card.issuesPass, "a declined guest is never admitted")
        XCTAssertFalse(card.offers(.viewPass))
        XCTAssertTrue(card.offers(.viewWeddingSite))
        XCTAssertTrue(card.offers(.changeResponse))
    }

    /// On the day the card stops being an invitation and becomes the way in.
    func testOnTheDayTheCardBecomesOperational() {
        let card = GuestCeremonialEntry.presentation(rsvp: .attending, lifecycle: .weddingDay)
        XCTAssertEqual(card.headline, "Today")
        XCTAssertEqual(card.primaryAction, .viewPass)
        XCTAssertTrue(card.offers(.openMaps))
        XCTAssertTrue(card.offers(.viewProgramme))
        XCTAssertTrue(card.offers(.viewTable))
    }

    /// Afterwards it must stop implying an event that has already happened.
    func testAfterTheWeddingTheCardThanksRatherThanConfirms() {
        let card = GuestCeremonialEntry.presentation(rsvp: .attending, lifecycle: .after)
        XCTAssertEqual(card.headline, "Thank you for celebrating with us")
        XCTAssertNil(card.statusLabel)
        XCTAssertFalse(card.issuesPass, "a past wedding issues no pass")
        XCTAssertFalse(card.offers(.rsvpNow))
        XCTAssertTrue(card.offers(.viewGallery))
    }

    func testTheLifecyclePhaseIsDerivedFromTheWeddingDate() {
        XCTAssertEqual(GuestCeremonialEntry.phase(daysRemaining: 93), .before)
        XCTAssertEqual(GuestCeremonialEntry.phase(daysRemaining: 0), .weddingDay)
        XCTAssertEqual(GuestCeremonialEntry.phase(daysRemaining: -1), .after)
    }

    func testTheReminderLineReadsNaturallyAsTheDayApproaches() {
        XCTAssertEqual(GuestCeremonialEntry.countdownLabel(daysRemaining: 93), "93 days to go")
        XCTAssertEqual(GuestCeremonialEntry.countdownLabel(daysRemaining: 4), "This week")
        XCTAssertEqual(GuestCeremonialEntry.countdownLabel(daysRemaining: 1), "Tomorrow")
        XCTAssertEqual(GuestCeremonialEntry.countdownLabel(daysRemaining: 0), "Today")
    }

    // MARK: - Replacing the active guest

    func testOpeningAnotherGuestsInvitationReplacesTheActiveOne() {
        let outcome = GuestCeremonialEntry.replaceActiveGuest(
            current: invitation(confirmed: true, guest: "Guest A"),
            incoming: invitation(guest: "Guest B")
        )
        guard case let .activate(context) = outcome else { return XCTFail("expected activation") }
        XCTAssertEqual(context.guestName, "Guest B")
    }

    /// The worst outcome available here would be showing one person another person's invitation.
    func testAnInvalidIncomingClaimNeverFallsBackToThePreviousGuest() {
        let outcome = GuestCeremonialEntry.replaceActiveGuest(
            current: invitation(confirmed: true, guest: "Guest A"), incoming: nil
        )
        XCTAssertEqual(outcome, .rejectAndClear)
    }

    // MARK: - Answering is not admission

    /// The old contract returned a WeddingPass from confirmRsvp. A declining guest is still
    /// answering, and has no pass; this is now impossible to express.
    func testADeclinedSubmissionCannotCarryAPass() {
        let declined = RsvpSubmissionResult.declined(guestId: "g1", partySize: 2)
        XCTAssertFalse(declined.passEligible)
        XCTAssertNil(declined.pass)

        XCTAssertNil(
            RsvpSubmissionResult(guestId: "g1", status: .declined, partySize: 2,
                                 confirmationMessage: "recorded", passEligible: true),
            "a declined answer must not be expressible with admission material"
        )
    }

    /// Eligibility is the server's answer, so an attending guest may be confirmed without a pass yet.
    func testAnAttendingSubmissionMayBeConfirmedBeforeAPassIsIssued() {
        let attending = RsvpSubmissionResult.attending(
            guestId: "g1", partySize: 2, pass: nil, idempotencyKey: "key-1"
        )
        XCTAssertTrue(attending.isAttending)
        XCTAssertTrue(attending.passEligible)
        XCTAssertNil(attending.pass, "the pass is the server's to issue")
        XCTAssertEqual(attending.idempotencyKey, "key-1")
    }

    // MARK: - What an invitation permits

    private let household = RsvpFormPermissions(
        maxAttendees: 4, allowsPlusOne: true, allowsNamedPlusOne: true, allowsChildren: true,
        maxChildren: 2, asksMealChoice: true, mealOptions: ["chicken", "vegetarian"],
        asksDietaryNotes: true, asksSongRequest: true, asksMessage: true, allowsResponseChange: true
    )

    func testAnAnswerWithinTheInvitationsTermsIsPermitted() {
        XCTAssertTrue(household.permits(attendees: 2, plusOne: true, children: 1))
    }

    func testMoreAttendeesThanTheInvitationAllowsIsRefused() {
        XCTAssertFalse(household.permits(attendees: 5, plusOne: false, children: 0))
    }

    func testAPlusOneIsRefusedWhenTheInvitationDoesNotOfferOne() {
        let single = RsvpFormPermissions.singleAttendeeOnly()
        XCTAssertFalse(single.permits(attendees: 1, plusOne: true, children: 0))
        XCTAssertTrue(single.permits(attendees: 1, plusOne: false, children: 0))
    }

    /// An unstated permission is refused, not granted.
    func testAnUnstatedInvitationDefaultsToTheNarrowestTerms() {
        let unstated = RsvpFormPermissions.singleAttendeeOnly()
        XCTAssertEqual(unstated.maxAttendees, 1)
        XCTAssertFalse(unstated.allowsPlusOne)
        XCTAssertFalse(unstated.allowsChildren)
        XCTAssertFalse(unstated.allowsResponseChange)
    }
}
