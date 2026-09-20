package pro.wewed.app.models

/**
 * The result of answering an invitation.
 *
 * The old contract was `confirmRsvp(...) -> WeddingPass`: answering an invitation *returned an
 * admission pass*. That encodes two untruths. A guest who declines is still answering, and has no
 * pass. And whether an attending guest may be admitted is the server's decision — capacity,
 * revocation and signing all live there — not something the phone concludes from a tap.
 *
 * Answering is one thing; being admitted is another. This separates them.
 */
data class RsvpSubmissionResult(
    val guestId: String,
    val status: RSVPStatus,
    val partySize: Int,
    /** What the guest should be told they have just done. */
    val confirmationMessage: String,
    /**
     * Whether the server says this guest may hold an admission pass.
     *
     * A declining guest is never eligible. An attending guest is eligible only if the server says
     * so — the client does not infer it from the fact that someone tapped "attending".
     */
    val passEligible: Boolean,
    /** The issued pass, when one exists. Null for a declined guest, and null until issued. */
    val pass: WeddingPass? = null,
    /**
     * Echoed back from the request.
     *
     * A double tap, a retry after a timeout, or a resumed request must produce ONE answer, not
     * several. The key is how the server recognises the repeat.
     */
    val idempotencyKey: String? = null,
    val provenance: DataProvenance = DataProvenance.PRODUCTION_DERIVED
) {
    init {
        // A declined guest must never be handed an admission credential. This is an invariant
        // rather than a rendering choice, so it cannot be undone by a screen.
        require(!(status == RSVPStatus.DECLINED && (passEligible || pass != null))) {
            "A declined guest is never eligible for an admission pass."
        }
    }

    val isAttending: Boolean get() = status == RSVPStatus.ATTENDING

    companion object {
        /** The guest is coming, and the server has issued their pass. */
        fun attending(
            guestId: String,
            partySize: Int,
            pass: WeddingPass?,
            idempotencyKey: String? = null
        ) = RsvpSubmissionResult(
            guestId = guestId,
            status = RSVPStatus.ATTENDING,
            partySize = partySize,
            confirmationMessage = "You're confirmed. We can't wait to celebrate with you.",
            passEligible = true,
            pass = pass,
            idempotencyKey = idempotencyKey
        )

        /** The guest cannot come. Their answer is recorded; no pass is created. */
        fun declined(
            guestId: String,
            partySize: Int,
            idempotencyKey: String? = null
        ) = RsvpSubmissionResult(
            guestId = guestId,
            status = RSVPStatus.DECLINED,
            partySize = partySize,
            confirmationMessage = "Your response has been recorded. You'll be missed.",
            passEligible = false,
            pass = null,
            idempotencyKey = idempotencyKey
        )
    }
}

/**
 * What an invitation actually permits this household to answer.
 *
 * "Party of 4" does not mean the guest may invent three names. How many may come, whether a
 * plus-one is allowed, whether children are included and which questions are even asked are
 * properties of the invitation the couple issued — the server states them, and the form is built
 * from them rather than from a party-size number.
 */
data class RsvpFormPermissions(
    val maxAttendees: Int,
    val allowsPlusOne: Boolean,
    val allowsNamedPlusOne: Boolean,
    val allowsChildren: Boolean,
    val maxChildren: Int,
    val asksMealChoice: Boolean,
    val mealOptions: List<String> = emptyList(),
    val asksDietaryNotes: Boolean,
    val asksSongRequest: Boolean,
    val asksMessage: Boolean,
    val allowsResponseChange: Boolean
) {
    /** Whether a proposed answer is within what this invitation permits. */
    fun permits(attendees: Int, plusOne: Boolean, children: Int): Boolean =
        attendees in 1..maxAttendees &&
            (!plusOne || allowsPlusOne) &&
            (children == 0 || allowsChildren) &&
            children <= maxChildren

    companion object {
        /**
         * The narrowest sensible permissions: one person, nothing optional.
         *
         * Used only where the server has not stated the invitation's terms. Defaulting narrow
         * means an unstated permission is refused rather than granted.
         */
        fun singleAttendeeOnly() = RsvpFormPermissions(
            maxAttendees = 1,
            allowsPlusOne = false,
            allowsNamedPlusOne = false,
            allowsChildren = false,
            maxChildren = 0,
            asksMealChoice = false,
            asksDietaryNotes = false,
            asksSongRequest = false,
            asksMessage = false,
            allowsResponseChange = false
        )
    }
}
