package pro.wewed.app.ui.invitation

/** One destination owns both the shell selection and the full stationery surface. */
data class GuestNavigation(
    val selected: GuestSection = GuestSection.HOME,
    val returnTo: GuestSection = GuestSection.HOME,
    val ceremonial: Boolean = false
) {
    fun openInvitation() = copy(
        selected = GuestSection.INVITATION,
        returnTo = if (selected == GuestSection.INVITATION) returnTo else selected,
        ceremonial = false
    )
    fun back() = copy(selected = returnTo, ceremonial = false)
    fun select(destination: GuestSection) = if (destination == GuestSection.INVITATION) openInvitation()
        else copy(selected = destination, ceremonial = false)
}
