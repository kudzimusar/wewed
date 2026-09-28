package pro.wewed.app.models

data class ProgrammeItem(
    val id: String,
    val title: String,
    val time: String,
    val location: String,
    val description: String
)

data class Wedding(
    val id: String,
    val coupleNames: String,
    val date: String,
    val venueName: String,
    val venueAddress: String,
    val city: String,
    val country: String,
    val lifecycle: String,
    val programme: List<ProgrammeItem>
)
