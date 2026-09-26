import XCTest
@testable import WewedKit

/// The Guest Entry Contract (master plan §6.2, §6.3), as a set of assertions.
///
/// An explicit invitation arrival opens on the configured card. An ordinary return by a remembered
/// Guest opens on Guest Home, with the invitation one tap away. The earlier contract here — the card
/// on EVERY entry session — was never production behaviour, and asserting it only qualified the
/// Shadow harness against a rule the Guest shell does not follow (master plan §8.11).
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

    // MARK: - Explicit arrival opens on the card; an ordinary return opens on Home

    func testAnExplicitInvitationArrivalOpensOnTheCard() {
        XCTAssertTrue(GuestCeremonialEntry.opensOnInvitation(isExplicitInvitationArrival: true))
    }

    func testAnOrdinaryReturnOpensOnGuestHomeNotTheCard() {
        XCTAssertFalse(GuestCeremonialEntry.opensOnInvitation(isExplicitInvitationArrival: false))
    }

    /// An explicit link meets the card whatever the Guest has already answered.
    func testAnExplicitLinkMeetsTheCardWhateverWasAnswered() {
        for card in [invitation(), invitation(confirmed: true), invitation(declined: true)] {
            let state = LaunchRouter.route(
                invitation: card, hasValidSession: false, authorizedRoles: [], hasResolvedContext: false
            )
            guard case .invitation = state else { return XCTFail("an explicit link must open on the card") }
        }
    }

    /// A returning Guest workspace is not routed back through the card by the router.
    func testAReturningGuestWithoutALinkIsNotRoutedToTheCard() {
        let state = LaunchRouter.route(
            invitation: nil, hasValidSession: true, authorizedRoles: [.guest], hasResolvedContext: true
        )
        XCTAssertEqual(state, .workspace(.guest))
    }

    /// Only Guests have an invitation entrance; nothing here changes how other roles enter.
    func testACoupleEntryIsUnaffectedByTheGuestContract() {
        let state = LaunchRouter.route(
            invitation: nil, hasValidSession: true, authorizedRoles: [.couple], hasResolvedContext: true
        )
        XCTAssertEqual(state, .workspace(.couple))
    }

    /// A link being opened now outranks an existing session.
    func testAnIncomingInvitationOutranksAnExistingSession() {
        let state = LaunchRouter.route(
            invitation: invitation(guest: "Guest B"), hasValidSession: true,
            authorizedRoles: [.guest], hasResolvedContext: true
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
