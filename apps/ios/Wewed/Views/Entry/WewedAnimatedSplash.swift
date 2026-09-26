import SwiftUI

/// Where the splash is going, which changes how it leaves.
///
/// A splash that always exits the same way is a loader. One that leaves differently depending on
/// what it is handing over to reads as the product opening: an invitation is *revealed*, a
/// workspace is *entered*.
public enum SplashDestination {
    /// An invitation is being presented. The stage settles and lifts, like a card being offered.
    case invitation
    /// A returning member. The stage recedes and the workspace comes forward.
    case workspace
    /// Someone new. The mark stays put and the welcome resolves around it.
    case welcome
}

/// The Wewed opening.
///
/// The first version faded a mark in, showed some text and cut to the next screen after a second.
/// That is an app loader, and it read as one. A wedding product's opening should feel composed —
/// unhurried, restrained, and clearly *presenting* something.
///
/// The motion is staged rather than simultaneous, because simultaneity is what makes a fade feel
/// cheap: everything arriving at once carries no intent. Here each element waits for the one
/// before it, and nothing bounces, spins or overshoots:
///
///   1. the ivory stage settles, ornament breathing up from nothing
///   2. the Wewed logo enters, rising slightly as it scales from 0.86
///   3. the wordmark resolves — letter-spacing drawing IN rather than merely fading
///   4. the champagne rule draws outward from the centre
///   5. the payoff line lifts into place
///   6. the whole stage yields to its destination, in the manner that destination deserves
///
/// Total ~1.9s to hand-over. Long enough to read as deliberate; short enough that nobody waits.
/// If the destination is not ready by then, `onFinished` still fires: the splash hands over to an
/// honest loading state rather than holding the brand hostage to a slow query.
///
/// The Android counterpart uses the same stages, timings and easing.
public struct WewedAnimatedSplash: View {
    private let destination: SplashDestination
    private let onFinished: (() -> Void)?

    @State private var ornament: Double = 0
    @State private var markScale: Double = 0.86
    @State private var markAlpha: Double = 0
    @State private var markRise: Double = 26
    @State private var wordAlpha: Double = 0
    @State private var wordTracking: Double = 14
    @State private var ruleWidth: Double = 0
    @State private var payoffAlpha: Double = 0
    @State private var payoffRise: Double = 10
    @State private var stageScale: Double = 1
    @State private var stageAlpha: Double = 1

    /// Wedding-appropriate easing: a soft arrival with no overshoot. Anything springy reads as a
    /// game loader, which is the opposite of what this surface is for.
    private static let silk = Animation.timingCurve(0.22, 0.61, 0.36, 1)

    public init(destination: SplashDestination = .welcome, onFinished: (() -> Void)? = nil) {
        self.destination = destination
        self.onFinished = onFinished
    }

    public var body: some View {
        ZStack {
            WeddingIdentityPalette.ivory.ignoresSafeArea()
            WeddingFloralBackground(opacity: 0.13 * ornament)

            VStack(spacing: 14) {
                WewedLogo(size: 132)
                    .scaleEffect(markScale)
                    .opacity(markAlpha)
                    .offset(y: markRise)

                Text("Wewed")
                    .font(.system(size: 42, weight: .medium, design: .serif))
                    .tracking(wordTracking)
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .opacity(wordAlpha)

                Text("PLAN  •  CONNECT  •  CELEBRATE")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(2.4)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .opacity(payoffAlpha)

                Capsule()
                    .fill(WeddingIdentityPalette.champagne.opacity(0.72))
                    .frame(width: ruleWidth, height: 1.5)

                Text("Weddings Made More Meaningful")
                    .font(.system(size: 18, design: .serif))
                    .italic()
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .opacity(payoffAlpha)
                    .offset(y: payoffRise)
            }
            .padding(28)
            .scaleEffect(stageScale)
            .opacity(stageAlpha)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Wewed. Plan, connect, celebrate. Weddings made more meaningful.")
        .accessibilityIdentifier("wewed-splash")
        .task { await run() }
    }

    private func run() async {
        // 1 — the stage. The ornament comes up under everything so the logo never lands on bare white.
        withAnimation(.easeOut(duration: 0.9)) { ornament = 1 }

        // 2 — the logo enters.
        withAnimation(.easeInOut(duration: 0.62)) { markAlpha = 1 }
        withAnimation(Self.silk.speed(1 / 0.76)) { markRise = 0; markScale = 1 }
        try? await Task.sleep(nanoseconds: 760_000_000)

        // 3 — the wordmark RESOLVES: the letters draw together rather than simply appearing.
        withAnimation(.easeInOut(duration: 0.52)) { wordAlpha = 1 }
        withAnimation(Self.silk.speed(1 / 0.7)) { wordTracking = 0 }
        try? await Task.sleep(nanoseconds: 700_000_000)

        // 4 — the rule draws outward from the centre.
        withAnimation(Self.silk.speed(1 / 0.52)) { ruleWidth = 94 }
        try? await Task.sleep(nanoseconds: 520_000_000)

        // 5 — the payoff lifts into place.
        withAnimation(Self.silk.speed(1 / 0.48)) { payoffRise = 0 }
        withAnimation(.easeInOut(duration: 0.48)) { payoffAlpha = 1 }
        try? await Task.sleep(nanoseconds: 720_000_000)

        // 6 — hand over, in the manner the destination deserves.
        switch destination {
        // An invitation is being presented: the stage lifts away, leaving the ivory and the
        // ornament for the card to arrive into. The continuity is the point — Wewed is revealing
        // the invitation, not being replaced by it.
        case .invitation:
            withAnimation(Self.silk.speed(1 / 0.62)) { stageScale = 1.06 }
            withAnimation(.easeInOut(duration: 0.56)) { stageAlpha = 0 }
            try? await Task.sleep(nanoseconds: 620_000_000)
        // A workspace is entered: the stage recedes slightly as the app comes forward.
        case .workspace:
            withAnimation(Self.silk.speed(1 / 0.46)) { stageScale = 0.97 }
            withAnimation(.easeInOut(duration: 0.42)) { stageAlpha = 0 }
            try? await Task.sleep(nanoseconds: 460_000_000)
        // The welcome resolves around the mark, so the stage simply yields.
        case .welcome:
            withAnimation(.easeInOut(duration: 0.42)) { stageAlpha = 0 }
            try? await Task.sleep(nanoseconds: 420_000_000)
        }

        onFinished?()
    }
}

/// The official Wewed logo.
///
/// `WeddingBrandMark` is a small drawn ring glyph. As a decorative accent inside the wedding hero
/// that is fine — it reads as ornament. As "the Wewed brand mark" on the splash, the welcome and
/// the sign-in surfaces it was a placeholder standing in for an asset the repository already
/// ships, so the OS launch screen showed the real logo and the very next frame showed an
/// approximation of it.
public struct WewedLogo: View {
    private let size: CGFloat
    private let label: String?

    public init(size: CGFloat = 96, label: String? = "Wewed") {
        self.size = size
        self.label = label
    }

    public var body: some View {
        WewedMediaImage(WewedAsset.logo)
            .aspectRatio(contentMode: .fit)
            .frame(width: size, height: size)
            .accessibilityLabel(label ?? "")
            .accessibilityHidden(label == nil)
    }
}
