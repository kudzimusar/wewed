package pro.wewed.app.invitation

/** What an invited Guest may reach. One name per capability, so views ask rather than decide. */
enum class GuestCapability {
    HOME,
    INVITATION,
    RSVP,
    WEDDING_DETAILS,
    VENUE,
    COUPLE_WEBSITE,
    REGISTRY,
    PROFILE,

    /** Attending only: an admission credential is not issued to anyone else. */
    WEDDING_PASS,
    PARTY_DETAILS,
    SEATING,
    WEDDING_DAY_PROGRAMME,
    ANNOUNCEMENTS,
    CHECK_IN_STATE
}

/**
 * What a Guest may do, given what they have answered.
 *
 * The rule this encodes is the product rule, and it is easy to get backwards: **the invitation
 * establishes identity; RSVP determines capability.** A guest who has not answered is not a
 * stranger to be turned away — they are an invited guest who has not answered yet, and they may
 * see their wedding, their invitation and their own profile.
 *
 * A pure function on purpose. Scattering `attending == true` checks through views is how a
 * declined guest ends up holding an admission credential in one place and not another.
 */
object GuestCapabilityPolicy {

    /** Everything an invited Guest may reach regardless of their answer. */
    private val ALWAYS = setOf(
        GuestCapability.HOME,
        GuestCapability.INVITATION,
        GuestCapability.WEDDING_DETAILS,
        GuestCapability.VENUE,
        GuestCapability.COUPLE_WEBSITE,
        GuestCapability.REGISTRY,
        GuestCapability.PROFILE
    )

    /** Everything that follows from actually coming. */
    private val ATTENDING_ONLY = setOf(
        GuestCapability.WEDDING_PASS,
        GuestCapability.PARTY_DETAILS,
        GuestCapability.SEATING,
        GuestCapability.WEDDING_DAY_PROGRAMME,
        GuestCapability.ANNOUNCEMENTS,
        GuestCapability.CHECK_IN_STATE
    )

    /**
     * @param attending null when the guest has not answered; true attending; false declined.
     */
    fun capabilities(attending: Boolean?): Set<GuestCapability> = when (attending) {
        // Not answered: everything except the pass, plus the question itself.
        null -> ALWAYS + GuestCapability.RSVP

        true -> ALWAYS + ATTENDING_ONLY

        // Declined. They keep their invitation and their profile — they were invited, and that
        // does not stop being true because they cannot come. What they do not get is admission.
        false -> ALWAYS
    }

    fun allows(attending: Boolean?, capability: GuestCapability): Boolean =
        capability in capabilities(attending)

    /**
     * Whether the RSVP question should still be asked.
     *
     * An answered guest is never asked again, whichever way they answered.
     */
    fun awaitsResponse(attending: Boolean?): Boolean = attending == null
}
