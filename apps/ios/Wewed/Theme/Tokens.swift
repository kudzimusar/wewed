// Generated automatically from mobile/design-tokens/tokens.json
// DO NOT EDIT DIRECTLY. Run bun run compile:tokens to regenerate.

import SwiftUI

public enum WewedColors {
    public static let gold = Color(hex: "#C5A880")
    public static let goldLight = Color(hex: "#E6D5B8")
    public static let goldDark = Color(hex: "#8A6D3B")

    public static let emerald = Color(hex: "#1B4D3E")
    public static let emeraldLight = Color(hex: "#2A725D")
    public static let burgundy = Color(hex: "#6B1D2F")
    public static let burgundyLight = Color(hex: "#9B2C47")

    public static let ivory = Color(hex: "#FDFBF7")
    public static let cardLight = Color(hex: "#FFFFFF")
    public static let cardDark = Color(hex: "#1E1E1E")
    public static let backgroundDark = Color(hex: "#121212")

    public static let textPrimaryLight = Color(hex: "#1A1A1A")
    public static let textSecondaryLight = Color(hex: "#666666")
    public static let textPrimaryDark = Color(hex: "#FFFFFF")
    public static let textSecondaryDark = Color(hex: "#A0A0A0")

    public static let success = Color(hex: "#2E7D32")
    public static let warning = Color(hex: "#ED6C02")
    public static let error = Color(hex: "#D32F2F")
    public static let info = Color(hex: "#0288D1")
}

public enum WewedSpacing {
    public static let xs: CGFloat = 4
    public static let sm: CGFloat = 8
    public static let md: CGFloat = 12
    public static let base: CGFloat = 16
    public static let lg: CGFloat = 20
    public static let xl: CGFloat = 24
    public static let xxl: CGFloat = 32
    public static let xxxl: CGFloat = 48
}

public enum WewedRadius {
    public static let sm: CGFloat = 6
    public static let md: CGFloat = 10
    public static let lg: CGFloat = 16
    public static let xl: CGFloat = 24
    public static let pill: CGFloat = 9999
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }

    public static var wewedSecondaryBackground: Color {
        #if canImport(UIKit)
        return Color(uiColor: .secondarySystemBackground)
        #else
        return Color.secondary.opacity(0.12)
        #endif
    }

    public static var wewedBackground: Color {
        #if canImport(UIKit)
        return Color(uiColor: .systemBackground)
        #else
        return Color.white
        #endif
    }
}
