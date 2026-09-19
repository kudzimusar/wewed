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
    val programme: List<ProgrammeItem>,
    val mapsUrl: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null
) {
    val venueLocation: VenueLocation
        get() = VenueLocation(
            name = venueName,
            streetAddress = null,
            city = city,
            country = country,
            mapsUrl = mapsUrl,
            latitude = latitude,
            longitude = longitude
        )
}

/** A venue exactly as recorded on the wedding. streetAddress stays null unless a real street address exists. */
data class VenueLocation(
    val name: String,
    val streetAddress: String? = null,
    val city: String? = null,
    val country: String? = null,
    val mapsUrl: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null
)
