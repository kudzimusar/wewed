import SwiftUI

/// A one-point leaf element that names a state without renaming what is inside it.
///
/// SwiftUI inherits `.accessibilityIdentifier` down the view tree. Putting a state's identifier on
/// its container therefore renames every descendant — the doors, the couple's names, the RSVP
/// controls all report as the container — and the screen becomes unassertable while still looking
/// perfectly correct.
///
/// The marker carries the state's own description so it is a real element rather than an empty
/// focus stop for assistive technology.
public struct AccessibilityMarker: View {
    private let identifier: String
    private let label: String

    public init(_ identifier: String, label: String) {
        self.identifier = identifier
        self.label = label
    }

    public var body: some View {
        Color.clear
            .frame(width: 1, height: 1)
            .allowsHitTesting(false)
            .accessibilityElement()
            .accessibilityLabel(label)
            .accessibilityIdentifier(identifier)
    }
}
