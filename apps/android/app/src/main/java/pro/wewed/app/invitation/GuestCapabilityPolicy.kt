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
 * The invitation establishes identity; RSVP completion gates the persistent Guest experience.
 * A pending Guest remains inside the invitation ceremony and its wedding-authorized actions.
 * Attending and declined Guests may both enter the persistent shell; only attending Guests gain
 * admission and Wedding Day capabilities.
 *
 * A pure function on purpose. Scattering `attending == true` checks through views is how a
 * declined guest ends up holding an admission credential in one place and not another.
 */
object GuestCapabilityPolicy {

    /** Invitation-side actions available before an RSVP answer exists. */
    private val INVITATION_ONLY = setOf(
        GuestCapability.INVITATION,
        GuestCapability.WEDDING_DETAILS,
        GuestCapability.VENUE,
        GuestCapability.COUPLE_WEBSITE,
        GuestCapability.REGISTRY
    )

    /** Persistent Guest application capabilities shared by attending and declined Guests. */
    private val PERSISTENT = setOf(
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
        // Pending: invitation ceremony only. No Home/Profile shell before RSVP completion.
        null -> INVITATION_ONLY + GuestCapability.RSVP

        true -> PERSISTENT + ATTENDING_ONLY

        // Declined Guests remain invited and may enter their Guest application, but never admission.
        false -> PERSISTENT
    }

    /** The navigation/state-machine gate; views must not substitute tab hiding for this rule. */
    fun mayEnterPersistentExperience(attending: Boolean?): Boolean = attending != null

    fun allows(attending: Boolean?, capability: GuestCapability): Boolean =
        capability in capabilities(attending)

    /**
     * Whether the RSVP question should still be asked.
     *
     * An answered guest is never asked again, whichever way they answered.
     */
    fun awaitsResponse(attending: Boolean?): Boolean = attending == null
}
