package pro.wewed.app.services

import pro.wewed.app.models.VenueLocation
import java.util.Locale

data class MapsLinks(
    /** Opens any installed maps app on Android. */
    val geoUri: String,
    /** Universal browser fallback. */
    val webUrl: String,
    /** Apple Maps universal link (used by iOS; kept here so both platforms share test vectors). */
    val appleMapsUrl: String,
    val displayQuery: String
)

/**
 * Builds navigation links from the active wedding's venue record.
 * Preference order: explicit maps URL, then coordinates, then a search over the recorded address fields.
 * Never hard-codes a venue; if the record has nothing usable, returns null so the UI can say so.
 */
object MapsLinkBuilder {
    fun build(venue: VenueLocation): MapsLinks? {
        val query = searchQuery(venue)
        val lat = venue.latitude
        val lng = venue.longitude
        val hasCoordinates = lat != null && lng != null &&
            lat in -90.0..90.0 && lng in -180.0..180.0 && !(lat == 0.0 && lng == 0.0)
        val explicitUrl = venue.mapsUrl?.trim()?.takeIf { it.startsWith("https://") || it.startsWith("http://") }

        if (query.isEmpty() && !hasCoordinates && explicitUrl == null) return null

        val label = query.ifEmpty { venue.name.trim() }
        return if (hasCoordinates) {
            val coords = "${formatCoordinate(lat!!)},${formatCoordinate(lng!!)}"
            MapsLinks(
                geoUri = "geo:$coords?q=$coords" + if (label.isNotEmpty()) "(${encode(label)})" else "",
                webUrl = explicitUrl ?: "https://www.google.com/maps/search/?api=1&query=$coords",
                appleMapsUrl = "https://maps.apple.com/?ll=$coords" + if (label.isNotEmpty()) "&q=${encode(label)}" else "",
                displayQuery = label.ifEmpty { coords }
            )
        } else {
            val encoded = encode(query)
            MapsLinks(
                geoUri = "geo:0,0?q=$encoded",
                webUrl = explicitUrl ?: "https://www.google.com/maps/search/?api=1&query=$encoded",
                appleMapsUrl = "https://maps.apple.com/?q=$encoded",
                displayQuery = query
            )
        }
    }

    /** Name, street, city, country — blanks dropped, case-insensitive duplicates removed. */
    fun searchQuery(venue: VenueLocation): String {
        val seen = mutableSetOf<String>()
        return listOfNotNull(venue.name, venue.streetAddress, venue.city, venue.country)
            .map { it.trim() }
            .filter { it.isNotEmpty() && seen.add(it.lowercase(Locale.ROOT)) }
            .joinToString(", ")
    }

    /** RFC 3986 unreserved characters pass through; everything else is percent-encoded as UTF-8. */
    fun encode(value: String): String {
        val out = StringBuilder()
        for (byte in value.toByteArray(Charsets.UTF_8)) {
            val c = byte.toInt() and 0xFF
            val ch = c.toChar()
            if (ch in 'A'..'Z' || ch in 'a'..'z' || ch in '0'..'9' || ch == '-' || ch == '.' || ch == '_' || ch == '~') {
                out.append(ch)
            } else {
                out.append('%').append(String.format(Locale.ROOT, "%02X", c))
            }
        }
        return out.toString()
    }

    private fun formatCoordinate(value: Double): String =
        String.format(Locale.ROOT, "%.6f", value).trimEnd('0').trimEnd('.')
}
