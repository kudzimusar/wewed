import SwiftUI

public enum ShellFixtureState: String, CaseIterable, Identifiable, Sendable {
    case populated = "Populated"
    case empty = "Empty"
    case loading = "Loading"
    case error = "Error"
    case offline = "Offline"
    case attention = "Attention"
    case readOnly = "Read-Only"
    case editable = "Editable"

    public var id: String { rawValue }
}

public protocol ShellStateAware {
    var fixtureState: ShellFixtureState { get }
}
