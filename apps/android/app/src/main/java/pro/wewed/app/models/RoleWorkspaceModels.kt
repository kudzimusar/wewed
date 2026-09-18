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
        fun fromId(id: String): AppRole =
            entries.find { it.roleId.equals(id, ignoreCase = true) } ?: COUPLE
    }
}

data class DevelopmentPersona(
    val id: String,
    val name: String,
    val subtitle: String,
    val role: AppRole,
    val weddingId: String,
    val weddingTitle: String
) {
    companion object {
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
