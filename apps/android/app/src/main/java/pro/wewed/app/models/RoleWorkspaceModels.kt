package pro.wewed.app.models

enum class AppRole(val roleId: String, val title: String) {
    COUPLE("couple", "Couple"),
    PLANNER("planner", "Professional Planner"),
    COORDINATOR("coordinator", "Day-of Coordinator"),
    VENDOR("vendor", "Vendor & Staff"),
    USHER("usher", "Gate Usher"),
    GUEST("guest", "Attending Guest"),
    ADMIN("admin", "Administrator");

    companion object {
        /**
         * Parses a NATIVE workspace identifier — exactly one of the [roleId] values above — and
         * nothing else. Unknown input is `null`, never a default workspace.
         *
         * This is not a server authority mapper. Wewed authority has several axes (account class,
         * BusinessAccountMember, WeddingMembership, operational assignment), and a single server
         * role string cannot choose a workspace: `owner`, `viewer`, `business_owner`,
         * `couple_owner`, `vendor_manager` and `venue_manager` have no workspace here at all, and
         * `planner` or `coordinator` mean different things on different axes. The production
         * grant contract is master-plan Phase 2; until it exists, nothing server-supplied reaches
         * a workspace. The old `?: COUPLE` fallback turned any unrecognised string into the
         * Couple workspace (master plan §8.1).
         */
        fun fromId(id: String): AppRole? = entries.firstOrNull { it.roleId == id }
    }
}

/**
 * A Shadow/fixture qualification actor. Development and Shadow environments only.
 *
 * Personas are test actors, not accounts: they are applied only where
 * [NativeDataEnvironment.allowsDevelopmentPersonaSwitching] holds, and [SessionViewModel] refuses
 * them anywhere else. Production identity starts unknown and is never seeded from this list.
 */
data class DevelopmentPersona(
    val id: String,
    val name: String,
    val subtitle: String,
    val role: AppRole,
    val weddingId: String,
    val weddingTitle: String
) {
    companion object {
        /** The actor a Shadow session opens as when no specific persona was requested. */
        const val DEFAULT_SHADOW_PERSONA_ID = "couple_owner"

        val defaultShadowPersona: DevelopmentPersona
            get() = allPersonas.first { it.id == DEFAULT_SHADOW_PERSONA_ID }

        val allPersonas = listOf(
            DevelopmentPersona(
                id = "couple_owner",
                name = "Charity & Kudzie",
                subtitle = "Couple Owner • Imba Manor",
                role = AppRole.COUPLE,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie"
            ),
            DevelopmentPersona(
                id = "pro_planner",
                name = "Eleven Eleven Testing",
                subtitle = "Lead Planner • Accepted Interest",
                role = AppRole.PLANNER,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie"
            ),
            DevelopmentPersona(
                id = "day_coordinator",
                name = "Shadow Coordinator Test Role",
                subtitle = "SHADOW TEST-ONLY • Day-of Coordinator",
                role = AppRole.COORDINATOR,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie"
            ),
            DevelopmentPersona(
                id = "vendor_owner",
                name = "FAUME MEDIA",
                subtitle = "Lead Cinematographer & Media",
                role = AppRole.VENDOR,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie"
            ),
            DevelopmentPersona(
                id = "vendor_staff",
                name = "MC Aloe The Avangelist",
                subtitle = "Master of Ceremonies & Sound",
                role = AppRole.VENDOR,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie"
            ),
            DevelopmentPersona(
                id = "gate_usher",
                name = "Shadow Usher Test Role",
                subtitle = "SHADOW TEST-ONLY • Gate Scanner",
                role = AppRole.USHER,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie"
            ),
            DevelopmentPersona(
                id = "attending_guest",
                name = "Shadow Guest Test Role",
                subtitle = "SHADOW TEST-ONLY • Attending Guest",
                role = AppRole.GUEST,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie"
            ),
            DevelopmentPersona(
                id = "attending_guest_party4",
                name = "Shadow Guest Test Role (party of four)",
                subtitle = "SHADOW TEST-ONLY • Second attending guest",
                role = AppRole.GUEST,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie"
            ),
            DevelopmentPersona(
                id = "administrator",
                name = "Shadow Admin Test Role",
                subtitle = "SHADOW TEST-ONLY • Platform Admin",
                role = AppRole.ADMIN,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie"
            )
        )
    }
}
