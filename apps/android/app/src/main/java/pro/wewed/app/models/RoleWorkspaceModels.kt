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
                name = "Tariro & Shadreck",
                subtitle = "Couple Owner • Imba Manor Estate",
                role = AppRole.COUPLE,
                weddingId = "wed_tariro_shadreck_2026",
                weddingTitle = "Tariro & Shadreck Wedding"
            ),
            DevelopmentPersona(
                id = "pro_planner",
                name = "Kudzi Musarurwa",
                subtitle = "Lead Architect • 3 Active Weddings",
                role = AppRole.PLANNER,
                weddingId = "wed_tariro_shadreck_2026",
                weddingTitle = "Tariro & Shadreck Wedding"
            ),
            DevelopmentPersona(
                id = "day_coordinator",
                name = "Chiedza Nyoni",
                subtitle = "Ground Operations Lead",
                role = AppRole.COORDINATOR,
                weddingId = "wed_tariro_shadreck_2026",
                weddingTitle = "Tariro & Shadreck Wedding"
            ),
            DevelopmentPersona(
                id = "vendor_owner",
                name = "Kudzi Visuals",
                subtitle = "Lead Cinematographer & Drone",
                role = AppRole.VENDOR,
                weddingId = "wed_tariro_shadreck_2026",
                weddingTitle = "Tariro & Shadreck Wedding"
            ),
            DevelopmentPersona(
                id = "vendor_staff",
                name = "Crown Sound Crew",
                subtitle = "Audio & Acoustics Engineer",
                role = AppRole.VENDOR,
                weddingId = "wed_tariro_shadreck_2026",
                weddingTitle = "Tariro & Shadreck Wedding"
            ),
            DevelopmentPersona(
                id = "gate_usher",
                name = "Gate A Usher",
                subtitle = "Stationed at Main Entrance",
                role = AppRole.USHER,
                weddingId = "wed_tariro_shadreck_2026",
                weddingTitle = "Tariro & Shadreck Wedding"
            ),
            DevelopmentPersona(
                id = "attending_guest",
                name = "Jane Doe",
                subtitle = "Party of 2 • Table 8",
                role = AppRole.GUEST,
                weddingId = "wed_tariro_shadreck_2026",
                weddingTitle = "Tariro & Shadreck Wedding"
            ),
            DevelopmentPersona(
                id = "administrator",
                name = "Global Ops Admin",
                subtitle = "Platform Security & Health",
                role = AppRole.ADMIN,
                weddingId = "wed_tariro_shadreck_2026",
                weddingTitle = "Global Wewed Ecosystem"
            )
        )
    }
}
