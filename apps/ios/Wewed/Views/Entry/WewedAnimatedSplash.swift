import SwiftUI

/// The Wewed animated splash.
///
/// This motion — the mark settling in, the rule drawing out from the centre — belonged only to the
/// guest invitation journey. Every other entry path either flashed a bare window or dropped
/// straight into a form, so the app had two different first impressions depending on how you
/// opened it. One identity, every path: icon launch, invitation link, returning session, new
/// account.
///
/// The OS launch screen before this is deliberately still, because the system draws it before any
/// application code runs. This is where the product's motion begins.
///
/// Brief by design: long enough to read as intentional, short enough that nobody waits for it.
public struct WewedAnimatedSplash: View {
    @State private var appeared = false
    private let holdSeconds: Double
    private let onFinished: (() -> Void)?

    public init(holdSeconds: Double = 1.15, onFinished: (() -> Void)? = nil) {
        self.holdSeconds = holdSeconds
        self.onFinished = onFinished
    }

    public var body: some View {
        ZStack {
            WeddingIdentityPalette.ivory.ignoresSafeArea()
            WeddingFloralBackground(opacity: 0.11)

            VStack(spacing: 14) {
                WeddingBrandMark()
                    .scaleEffect(appeared ? 1 : 0.72)
                    .rotationEffect(.degrees(appeared ? 0 : -10))

                Text("Wewed")
                    .font(.system(size: 42, weight: .medium, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)

                Text("PLAN  •  CONNECT  •  CELEBRATE")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(2.4)
                    .foregroundStyle(WeddingIdentityPalette.muted)

                Capsule()
                    .fill(WeddingIdentityPalette.champagne.opacity(0.72))
                    .frame(width: appeared ? 94 : 26, height: 1.5)

                Text("Weddings Made More Meaningful")
                    .font(.system(size: 18, design: .serif))
                    .italic()
                    .foregroundStyle(WeddingIdentityPalette.ink)
            }
            .padding(28)
            .scaleEffect(appeared ? 1 : 0.94)
            .offset(y: appeared ? 0 : 18)
            .opacity(appeared ? 1 : 0)
            .animation(.easeOut(duration: 0.65), value: appeared)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Wewed. Plan, connect, celebrate. Weddings made more meaningful.")
        .accessibilityIdentifier("wewed-splash")
        .task {
            appeared = true
            guard let onFinished else { return }
            try? await Task.sleep(nanoseconds: UInt64(holdSeconds * 1_000_000_000))
            onFinished()
        }
    }
}
