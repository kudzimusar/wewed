package pro.wewed.app.models

/**
 * title: internal role name. choiceLabel: the plain words a person sees when choosing how to use the app.
 */
enum class AppRole(val roleId: String, val title: String, val choiceLabel: String) {
    COUPLE("couple", "Couple", "My Wedding"),
    PLANNER("planner", "Planner", "Planner Workspace"),
    COORDINATOR("coordinator", "Coordinator", "Wedding-Day Coordination"),
    VENDOR("vendor", "Vendor", "My Vendor Work"),
    USHER("usher", "Gate Team", "Gate Check-In"),
    GUEST("guest", "Guest", "My Invitation"),
    ADMIN("admin", "Wewed Support", "Wewed Support");

    companion object {
        /** Unknown ids resolve to null, never to a default role. */
        fun fromId(id: String): AppRole? =
            entries.find { it.roleId.equals(id, ignoreCase = true) }
    }
}
