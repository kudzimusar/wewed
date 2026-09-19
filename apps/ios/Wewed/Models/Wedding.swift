import Foundation

public struct ProgrammeItem: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let time: String
    public let location: String
    public let description: String

    public init(id: String, title: String, time: String, location: String, description: String) {
        self.id = id
        self.title = title
        self.time = time
        self.location = location
        self.description = description
    }
}

public struct Wedding: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let coupleNames: String
    public let date: String
    public let venueName: String
    public let venueAddress: String
    public let city: String
    public let country: String
    public let lifecycle: String
    public let programme: [ProgrammeItem]
    public let mapsUrl: String?
    public let latitude: Double?
    public let longitude: Double?

    public init(
        id: String,
        coupleNames: String,
        date: String,
        venueName: String,
        venueAddress: String,
        city: String,
        country: String,
        lifecycle: String,
        programme: [ProgrammeItem],
        mapsUrl: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil
    ) {
        self.mapsUrl = mapsUrl
        self.latitude = latitude
        self.longitude = longitude
        self.id = id
        self.coupleNames = coupleNames
        self.date = date
        self.venueName = venueName
        self.venueAddress = venueAddress
        self.city = city
        self.country = country
        self.lifecycle = lifecycle
        self.programme = programme
    }
}

extension Wedding {
    public var venueLocation: VenueLocation {
        VenueLocation(
            name: venueName,
            streetAddress: nil,
            city: city,
            country: country,
            mapsUrl: mapsUrl,
            latitude: latitude,
            longitude: longitude
        )
    }
}

/// A venue exactly as recorded on the wedding. streetAddress stays nil unless a real street address exists.
public struct VenueLocation: Codable, Equatable, Sendable {
    public let name: String
    public let streetAddress: String?
    public let city: String?
    public let country: String?
    public let mapsUrl: String?
    public let latitude: Double?
    public let longitude: Double?

    public init(
        name: String,
        streetAddress: String? = nil,
        city: String? = nil,
        country: String? = nil,
        mapsUrl: String? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil
    ) {
        self.name = name
        self.streetAddress = streetAddress
        self.city = city
        self.country = country
        self.mapsUrl = mapsUrl
        self.latitude = latitude
        self.longitude = longitude
    }
}
