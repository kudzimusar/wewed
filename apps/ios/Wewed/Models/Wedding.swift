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

    public init(
        id: String,
        coupleNames: String,
        date: String,
        venueName: String,
        venueAddress: String,
        city: String,
        country: String,
        lifecycle: String,
        programme: [ProgrammeItem]
    ) {
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
