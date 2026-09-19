import Foundation

public struct MapsLinks: Equatable, Sendable {
    /// Android `geo:` URI (kept so both platforms share test vectors).
    public let geoUri: String
    /// Universal browser fallback.
    public let webUrl: String
    /// Apple Maps universal link; opens Maps on iOS, the browser elsewhere.
    public let appleMapsUrl: String
    public let displayQuery: String
}

/// Builds navigation links from the active wedding's venue record. Mirrors Android `MapsLinkBuilder`.
/// Preference order: explicit maps URL, then coordinates, then a search over the recorded address fields.
/// Never hard-codes a venue; if the record has nothing usable, returns nil so the UI can say so.
public enum MapsLinkBuilder {
    public static func build(_ venue: VenueLocation) -> MapsLinks? {
        let query = searchQuery(venue)
        let explicitUrl = venue.mapsUrl?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .nonEmpty
            .flatMap { $0.hasPrefix("https://") || $0.hasPrefix("http://") ? $0 : nil }

        var coordinates: (Double, Double)?
        if let lat = venue.latitude, let lng = venue.longitude,
           (-90.0...90.0).contains(lat), (-180.0...180.0).contains(lng), !(lat == 0 && lng == 0) {
            coordinates = (lat, lng)
        }

        if query.isEmpty && coordinates == nil && explicitUrl == nil { return nil }

        let label = query.isEmpty ? venue.name.trimmingCharacters(in: .whitespacesAndNewlines) : query
        if let (lat, lng) = coordinates {
            let coords = "\(formatCoordinate(lat)),\(formatCoordinate(lng))"
            return MapsLinks(
                geoUri: "geo:\(coords)?q=\(coords)" + (label.isEmpty ? "" : "(\(encode(label)))"),
                webUrl: explicitUrl ?? "https://www.google.com/maps/search/?api=1&query=\(coords)",
                appleMapsUrl: "https://maps.apple.com/?ll=\(coords)" + (label.isEmpty ? "" : "&q=\(encode(label))"),
                displayQuery: label.isEmpty ? coords : label
            )
        }
        let encoded = encode(query)
        return MapsLinks(
            geoUri: "geo:0,0?q=\(encoded)",
            webUrl: explicitUrl ?? "https://www.google.com/maps/search/?api=1&query=\(encoded)",
            appleMapsUrl: "https://maps.apple.com/?q=\(encoded)",
            displayQuery: query
        )
    }

    /// Name, street, city, country — blanks dropped, case-insensitive duplicates removed.
    public static func searchQuery(_ venue: VenueLocation) -> String {
        var seen = Set<String>()
        return [venue.name, venue.streetAddress, venue.city, venue.country]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && seen.insert($0.lowercased()).inserted }
            .joined(separator: ", ")
    }

    /// RFC 3986 unreserved characters pass through; everything else is percent-encoded as UTF-8.
    public static func encode(_ value: String) -> String {
        var out = ""
        for byte in value.utf8 {
            let scalar = Unicode.Scalar(byte)
            let isUnreserved = (byte >= 0x41 && byte <= 0x5A) || (byte >= 0x61 && byte <= 0x7A) ||
                (byte >= 0x30 && byte <= 0x39) || byte == 0x2D || byte == 0x2E || byte == 0x5F || byte == 0x7E
            if isUnreserved {
                out.unicodeScalars.append(scalar)
            } else {
                out += String(format: "%%%02X", byte)
            }
        }
        return out
    }

    private static func formatCoordinate(_ value: Double) -> String {
        var text = String(format: "%.6f", locale: Locale(identifier: "en_US_POSIX"), value)
        while text.hasSuffix("0") { text.removeLast() }
        if text.hasSuffix(".") { text.removeLast() }
        return text
    }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
