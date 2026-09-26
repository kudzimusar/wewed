import Foundation

/// The result of answering an invitation.
///
/// The old contract was `confirmRsvp(...) -> WeddingPass`: answering an invitation *returned an
/// admission pass*. That encodes two untruths. A guest who declines is still answering, and has no
/// pass. And whether an attending guest may be admitted is the server's decision — capacity,
/// revocation and signing all live there — not something the phone concludes from a tap.
///
/// Answering is one thing; being admitted is another. This separates them.
public struct RsvpSubmissionResult: Equatable {
    public let guestId: String
    public let status: RSVPStatus
    public let partySize: Int
    /// What the guest should be told they have just done.
    public let confirmationMessage: String
    /// Whether the server says this guest may hold an admission pass.
    ///
    /// A declining guest is never eligible. An attending guest is eligible only if the server says
    /// so — the client does not infer it from the fact that someone tapped "attending".
    public let passEligible: Bool
    /// The issued pass, when one exists. Nil for a declined guest, and nil until issued.
    public let pass: WeddingPass?
    /// Echoed back from the request.
    ///
    /// A double tap, a retry after a timeout, or a resumed request must produce ONE answer, not
    /// several. The key is how the server recognises the repeat.
    public let idempotencyKey: String?
    public let provenance: DataProvenance

    /// Fails when a declined answer is given admission material. Expressed as a failable
    /// initializer so the invariant cannot be bypassed by a screen.
    public init?(
        guestId: String,
        status: RSVPStatus,
        partySize: Int,
        confirmationMessage: String,
        passEligible: Bool,
        pass: WeddingPass? = nil,
        idempotencyKey: String? = nil,
        provenance: DataProvenance = .productionDerived
    ) {
        // A declined guest must never be handed an admission credential.
        if status == .declined && (passEligible || pass != nil) { return nil }
        self.guestId = guestId
        self.status = status
        self.partySize = partySize
        self.confirmationMessage = confirmationMessage
        self.passEligible = passEligible
        self.pass = pass
        self.idempotencyKey = idempotencyKey
        self.provenance = provenance
    }

    public var isAttending: Bool { status == .attending }

    /// The guest is coming, and the server has issued their pass.
    public static func attending(
        guestId: String,
        partySize: Int,
        pass: WeddingPass?,
        idempotencyKey: String? = nil
    ) -> RsvpSubmissionResult {
        RsvpSubmissionResult(
            guestId: guestId,
            status: .attending,
            partySize: partySize,
            confirmationMessage: "You're confirmed. We can't wait to celebrate with you.",
            passEligible: true,
            pass: pass,
            idempotencyKey: idempotencyKey
        )!
    }

    /// The guest cannot come. Their answer is recorded; no pass is created.
    public static func declined(
        guestId: String,
        partySize: Int,
        idempotencyKey: String? = nil
    ) -> RsvpSubmissionResult {
        RsvpSubmissionResult(
            guestId: guestId,
            status: .declined,
            partySize: partySize,
            confirmationMessage: "Your response has been recorded. You'll be missed.",
            passEligible: false,
            pass: nil,
            idempotencyKey: idempotencyKey
        )!
    }
}

/// What an invitation actually permits this household to answer.
///
/// "Party of 4" does not mean the guest may invent three names. How many may come, whether a
/// plus-one is allowed, whether children are included and which questions are even asked are
/// properties of the invitation the couple issued — the server states them, and the form is built
/// from them rather than from a party-size number.
public struct RsvpFormPermissions: Equatable {
    public let maxAttendees: Int
    public let allowsPlusOne: Bool
    public let allowsNamedPlusOne: Bool
    public let allowsChildren: Bool
    public let maxChildren: Int
    public let asksMealChoice: Bool
    public let mealOptions: [String]
    public let asksDietaryNotes: Bool
    public let asksSongRequest: Bool
    public let asksMessage: Bool
    public let allowsResponseChange: Bool

    public init(maxAttendees: Int, allowsPlusOne: Bool, allowsNamedPlusOne: Bool,
                allowsChildren: Bool, maxChildren: Int, asksMealChoice: Bool,
                mealOptions: [String] = [], asksDietaryNotes: Bool, asksSongRequest: Bool,
                asksMessage: Bool, allowsResponseChange: Bool) {
        self.maxAttendees = maxAttendees
        self.allowsPlusOne = allowsPlusOne
        self.allowsNamedPlusOne = allowsNamedPlusOne
        self.allowsChildren = allowsChildren
        self.maxChildren = maxChildren
        self.asksMealChoice = asksMealChoice
        self.mealOptions = mealOptions
        self.asksDietaryNotes = asksDietaryNotes
        self.asksSongRequest = asksSongRequest
        self.asksMessage = asksMessage
        self.allowsResponseChange = allowsResponseChange
    }

    /// Whether a proposed answer is within what this invitation permits.
    public func permits(attendees: Int, plusOne: Bool, children: Int) -> Bool {
        (1...max(1, maxAttendees)).contains(attendees)
            && attendees <= maxAttendees
            && (!plusOne || allowsPlusOne)
            && (children == 0 || allowsChildren)
            && children <= maxChildren
    }

    /// The narrowest sensible permissions: one person, nothing optional.
    ///
    /// Used only where the server has not stated the invitation's terms. Defaulting narrow means
    /// an unstated permission is refused rather than granted.
    public static func singleAttendeeOnly() -> RsvpFormPermissions {
        RsvpFormPermissions(
            maxAttendees: 1, allowsPlusOne: false, allowsNamedPlusOne: false,
            allowsChildren: false, maxChildren: 0, asksMealChoice: false,
            asksDietaryNotes: false, asksSongRequest: false, asksMessage: false,
            allowsResponseChange: false
        )
    }
}
