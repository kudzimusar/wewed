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
                weddingTitle = "Charity & Kudzie Wedding"
            ),
            DevelopmentPersona(
                id = "pro_planner",
                name = "Eleven Eleven Testing",
                subtitle = "Lead Planner • Tony The Planner",
                role = AppRole.PLANNER,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie Wedding"
            ),
            DevelopmentPersona(
                id = "day_coordinator",
                name = "Chiedza Nyoni",
                subtitle = "Day-of Coordinator",
                role = AppRole.COORDINATOR,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie Wedding"
            ),
            DevelopmentPersona(
                id = "vendor_owner",
                name = "FAUME MEDIA",
                subtitle = "Lead Cinematographer & Media",
                role = AppRole.VENDOR,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie Wedding"
            ),
            DevelopmentPersona(
                id = "vendor_staff",
                name = "MC Aloe The Avangelist",
                subtitle = "Master of Ceremonies & Sound",
                role = AppRole.VENDOR,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie Wedding"
            ),
            DevelopmentPersona(
                id = "gate_usher",
                name = "Gate Usher",
                subtitle = "Stationed at Imba Manor Main Gate",
                role = AppRole.USHER,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie Wedding"
            ),
            DevelopmentPersona(
                id = "attending_guest",
                name = "Test Guest",
                subtitle = "Party of 4 • Attending",
                role = AppRole.GUEST,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Charity & Kudzie Wedding"
            ),
            DevelopmentPersona(
                id = "administrator",
                name = "Global Ops Admin",
                subtitle = "Platform Security & Health",
                role = AppRole.ADMIN,
                weddingId = "cmqos70cb0004q6vxe9g9aiu5",
                weddingTitle = "Global Wewed Ecosystem"
            )
        )
    }
}
