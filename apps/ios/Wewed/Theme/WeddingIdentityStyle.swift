import SwiftUI

public enum WeddingIdentityPalette {
    public static let ivory = Color(hex: "#FBF7EF")
    public static let ivorySoft = Color(hex: "#FFFDF8")
    public static let champagne = Color(hex: "#D5B47A")
    public static let champagneDeep = Color(hex: "#A77322")
    public static let forest = Color(hex: "#0E5A3F")
    public static let forestSoft = Color(hex: "#EAF3EE")
    public static let ink = Color(hex: "#13212B")
    public static let muted = Color(hex: "#667381")
    public static let hairline = Color(hex: "#E9E1D5")
}

public struct WeddingFloralBackground: View {
    private let opacity: Double

    public init(opacity: Double = 0.16) {
        self.opacity = opacity
    }

    public var body: some View {
        ZStack {
            WeddingIdentityPalette.ivory
            Image("ornament-frame", bundle: .module)
                .resizable()
                .scaledToFill()
                .opacity(opacity)
                .ignoresSafeArea()
        }
    }
}

public struct WeddingHeaderOrnament: View {
    public init() {}

    public var body: some View {
        Image("ornament-frame", bundle: .module)
            .resizable()
            .scaledToFill()
            .frame(width: 112, height: 92, alignment: .topTrailing)
            .clipped()
            .opacity(0.24)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

public struct WeddingBrandMark: View {
    public init() {}

    public var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .stroke(WeddingIdentityPalette.champagne, lineWidth: 2)
                .frame(width: 12, height: 20)
                .rotationEffect(.degrees(38))
                .offset(x: -4)

            RoundedRectangle(cornerRadius: 8)
                .stroke(WeddingIdentityPalette.champagne, lineWidth: 2)
                .frame(width: 12, height: 20)
                .rotationEffect(.degrees(-38))
                .offset(x: 4)
        }
        .frame(width: 30, height: 26)
        .accessibilityLabel("Wewed")
    }
}

public struct WeddingMonogram: View {
    let names: String
    let size: CGFloat

    public init(names: String, size: CGFloat = 44) {
        self.names = names
        self.size = size
    }

    public var body: some View {
        Text(monogram)
            .font(.system(size: size, weight: .medium, design: .serif))
            .italic()
            .foregroundStyle(WeddingIdentityPalette.champagneDeep)
            .accessibilityLabel("Wedding monogram \(monogram)")
    }

    private var monogram: String {
        let pieces = names
            .components(separatedBy: "&")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard pieces.count >= 2,
              let first = pieces[0].first,
              let second = pieces[1].first else {
            return "C&K"
        }
        return "\(first)&\(second)"
    }
}

public struct WeddingSectionCard<Content: View>: View {
    @ViewBuilder let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        content
            .padding(16)
            .background(WeddingIdentityPalette.ivorySoft)
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .stroke(WeddingIdentityPalette.hairline, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18))
            .shadow(color: Color.black.opacity(0.035), radius: 10, x: 0, y: 4)
    }
}

public struct WeddingMetricTile: View {
    let title: String
    let value: String
    let icon: String

    public init(title: String, value: String, icon: String) {
        self.title = title
        self.value = value
        self.icon = icon
    }

    public var body: some View {
        VStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(WeddingIdentityPalette.champagne.opacity(0.14))
                    .frame(width: 44, height: 44)
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
            }
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(WeddingIdentityPalette.ink)
            Text(value)
                .font(.system(size: 12))
                .foregroundStyle(WeddingIdentityPalette.muted)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(WeddingIdentityPalette.ivorySoft)
        .overlay(
            RoundedRectangle(cornerRadius: 15)
                .stroke(WeddingIdentityPalette.hairline, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 15))
    }
}

public struct WeddingPrimaryButtonLabel: View {
    let title: String
    let icon: String?

    public init(_ title: String, icon: String? = nil) {
        self.title = title
        self.icon = icon
    }

    public var body: some View {
        HStack(spacing: 8) {
            if let icon {
                Image(systemName: icon)
            }
            Text(title)
                .fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 13)
        .foregroundStyle(.white)
        .background(WeddingIdentityPalette.forest)
        .clipShape(RoundedRectangle(cornerRadius: 13))
    }
}
