import SwiftUI

/// Publishes the bounded content width for the current screen.
///
/// `.frame(maxWidth: .infinity)` does **not** bound a view when the proposal it receives is itself
/// unbounded — the modifier resolves to the child's ideal width. Media that uses `scaledToFill()`
/// then reports its own aspect-driven width, the enclosing stack adopts it, and the whole screen
/// lays out wider than the device and clips on both edges.
///
/// The rule this enforces is: **parent width controls media; media never controls screen width.**
/// A `WewedScreenContainer` measures the viewport once and publishes an explicit width, so any
/// descendant can size itself against a real number rather than an unbounded proposal.
private struct WewedContentWidthKey: EnvironmentKey {
    static let defaultValue: CGFloat? = nil
}

public extension EnvironmentValues {
    /// Bounded content width published by the nearest `WewedScreenContainer`, if any.
    var wewedContentWidth: CGFloat? {
        get { self[WewedContentWidthKey.self] }
        set { self[WewedContentWidthKey.self] = newValue }
    }
}

/// The Wewed screen container: role shell → safe viewport → **this** → bounded content width.
///
/// Phone content must never scroll horizontally. Horizontal taxonomy chips may scroll, but the
/// screen body may not, so the body is pinned to the measured width.
public struct WewedScreenContainer<Content: View>: View {
    private let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        GeometryReader { proxy in
            content
                .frame(width: proxy.size.width, height: proxy.size.height, alignment: .top)
                .environment(\.wewedContentWidth, proxy.size.width)
                .clipped()
        }
    }
}

public extension View {
    /// Pins a screen body to the bounded content width.
    ///
    /// Children of a stack inherit the stack's width, and a stack sizes itself to its widest
    /// child. Without an explicit bound, one greedy child (a fill-scaled image, a fixed-width
    /// row) widens the whole body and every sibling is laid out — and clipped — with it.
    func wewedBoundedWidth(horizontalInset: CGFloat = 0) -> some View {
        modifier(WewedBoundedWidth(horizontalInset: horizontalInset))
    }

    /// Bounds a media view to the container width so it fills rather than dictates the layout.
    ///
    /// Use in place of `scaledToFill().frame(height:)`, which leaves the width unconstrained.
    func wewedMedia(height: CGFloat, horizontalInset: CGFloat = 0) -> some View {
        modifier(WewedMediaFrame(height: height, horizontalInset: horizontalInset))
    }
}

private struct WewedMediaFrame: ViewModifier {
    @Environment(\.wewedContentWidth) private var containerWidth
    let height: CGFloat
    let horizontalInset: CGFloat

    func body(content: Content) -> some View {
        // When a container width is known, pin the media to it explicitly. Falling back to
        // maxWidth keeps previews and unit-test hosts working.
        if let containerWidth {
            content
                .frame(width: max(containerWidth - horizontalInset, 1), height: height)
                .clipped()
        } else {
            content
                .frame(maxWidth: .infinity, minHeight: height, maxHeight: height)
                .clipped()
        }
    }
}

private struct WewedBoundedWidth: ViewModifier {
    @Environment(\.wewedContentWidth) private var containerWidth
    let horizontalInset: CGFloat

    func body(content: Content) -> some View {
        if let containerWidth {
            content.frame(width: max(containerWidth - horizontalInset, 1))
        } else {
            content.frame(maxWidth: .infinity)
        }
    }
}
