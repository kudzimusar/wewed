import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(__dirname, "..");
const tokensPath = path.join(rootDir, "design-tokens", "tokens.json");
const raw = fs.readFileSync(tokensPath, "utf-8");
const tokens = JSON.parse(raw);

// 1. Generate Swift Tokens
const swiftOutput = `// Generated automatically from mobile/design-tokens/tokens.json
// DO NOT EDIT DIRECTLY. Run bun run compile:tokens to regenerate.

import SwiftUI

public enum WewedColors {
    public static let gold = Color(hex: "${tokens.color.primary.gold}")
    public static let goldLight = Color(hex: "${tokens.color.primary.goldLight}")
    public static let goldDark = Color(hex: "${tokens.color.primary.goldDark}")

    public static let emerald = Color(hex: "${tokens.color.secondary.emerald}")
    public static let emeraldLight = Color(hex: "${tokens.color.secondary.emeraldLight}")
    public static let burgundy = Color(hex: "${tokens.color.secondary.burgundy}")
    public static let burgundyLight = Color(hex: "${tokens.color.secondary.burgundyLight}")

    public static let ivory = Color(hex: "${tokens.color.surface.ivory}")
    public static let cardLight = Color(hex: "${tokens.color.surface.cardLight}")
    public static let cardDark = Color(hex: "${tokens.color.surface.cardDark}")
    public static let backgroundDark = Color(hex: "${tokens.color.surface.backgroundDark}")

    public static let textPrimaryLight = Color(hex: "${tokens.color.text.primaryLight}")
    public static let textSecondaryLight = Color(hex: "${tokens.color.text.secondaryLight}")
    public static let textPrimaryDark = Color(hex: "${tokens.color.text.primaryDark}")
    public static let textSecondaryDark = Color(hex: "${tokens.color.text.secondaryDark}")

    public static let success = Color(hex: "${tokens.color.status.success}")
    public static let warning = Color(hex: "${tokens.color.status.warning}")
    public static let error = Color(hex: "${tokens.color.status.error}")
    public static let info = Color(hex: "${tokens.color.status.info}")
}

public enum WewedSpacing {
    public static let xs: CGFloat = ${tokens.spacing.xs}
    public static let sm: CGFloat = ${tokens.spacing.sm}
    public static let md: CGFloat = ${tokens.spacing.md}
    public static let base: CGFloat = ${tokens.spacing.base}
    public static let lg: CGFloat = ${tokens.spacing.lg}
    public static let xl: CGFloat = ${tokens.spacing.xl}
    public static let xxl: CGFloat = ${tokens.spacing.xxl}
    public static let xxxl: CGFloat = ${tokens.spacing.xxxl}
}

public enum WewedRadius {
    public static let sm: CGFloat = ${tokens.radius.sm}
    public static let md: CGFloat = ${tokens.radius.md}
    public static let lg: CGFloat = ${tokens.radius.lg}
    public static let xl: CGFloat = ${tokens.radius.xl}
    public static let pill: CGFloat = ${tokens.radius.pill}
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
}
`;

// 2. Generate Kotlin Tokens
const kotlinOutput = `// Generated automatically from mobile/design-tokens/tokens.json
// DO NOT EDIT DIRECTLY. Run bun run compile:tokens to regenerate.

package pro.wewed.app.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

object WewedColors {
    val Gold = Color(android.graphics.Color.parseColor("${tokens.color.primary.gold}"))
    val GoldLight = Color(android.graphics.Color.parseColor("${tokens.color.primary.goldLight}"))
    val GoldDark = Color(android.graphics.Color.parseColor("${tokens.color.primary.goldDark}"))

    val Emerald = Color(android.graphics.Color.parseColor("${tokens.color.secondary.emerald}"))
    val EmeraldLight = Color(android.graphics.Color.parseColor("${tokens.color.secondary.emeraldLight}"))
    val Burgundy = Color(android.graphics.Color.parseColor("${tokens.color.secondary.burgundy}"))
    val BurgundyLight = Color(android.graphics.Color.parseColor("${tokens.color.secondary.burgundyLight}"))

    val Ivory = Color(android.graphics.Color.parseColor("${tokens.color.surface.ivory}"))
    val CardLight = Color(android.graphics.Color.parseColor("${tokens.color.surface.cardLight}"))
    val CardDark = Color(android.graphics.Color.parseColor("${tokens.color.surface.cardDark}"))
    val BackgroundDark = Color(android.graphics.Color.parseColor("${tokens.color.surface.backgroundDark}"))

    val TextPrimaryLight = Color(android.graphics.Color.parseColor("${tokens.color.text.primaryLight}"))
    val TextSecondaryLight = Color(android.graphics.Color.parseColor("${tokens.color.text.secondaryLight}"))
    val TextPrimaryDark = Color(android.graphics.Color.parseColor("${tokens.color.text.primaryDark}"))
    val TextSecondaryDark = Color(android.graphics.Color.parseColor("${tokens.color.text.secondaryDark}"))

    val Success = Color(android.graphics.Color.parseColor("${tokens.color.status.success}"))
    val Warning = Color(android.graphics.Color.parseColor("${tokens.color.status.warning}"))
    val Error = Color(android.graphics.Color.parseColor("${tokens.color.status.error}"))
    val Info = Color(android.graphics.Color.parseColor("${tokens.color.status.info}"))
}

object WewedSpacing {
    val xs: Dp = ${tokens.spacing.xs}.dp
    val sm: Dp = ${tokens.spacing.sm}.dp
    val md: Dp = ${tokens.spacing.md}.dp
    val base: Dp = ${tokens.spacing.base}.dp
    val lg: Dp = ${tokens.spacing.lg}.dp
    val xl: Dp = ${tokens.spacing.xl}.dp
    val xxl: Dp = ${tokens.spacing.xxl}.dp
    val xxxl: Dp = ${tokens.spacing.xxxl}.dp
}

object WewedRadius {
    val sm: Dp = ${tokens.radius.sm}.dp
    val md: Dp = ${tokens.radius.md}.dp
    val lg: Dp = ${tokens.radius.lg}.dp
    val xl: Dp = ${tokens.radius.xl}.dp
    val pill: Dp = ${tokens.radius.pill}.dp
}
`;

const iosDir = path.resolve(rootDir, "../apps/ios/Wewed/Theme");
const androidDir = path.resolve(rootDir, "../apps/android/app/src/main/java/pro/wewed/app/theme");

fs.mkdirSync(iosDir, { recursive: true });
fs.mkdirSync(androidDir, { recursive: true });

fs.writeFileSync(path.join(iosDir, "Tokens.swift"), swiftOutput, "utf-8");
fs.writeFileSync(path.join(androidDir, "Tokens.kt"), kotlinOutput, "utf-8");

console.log("Tokens compiled successfully to iOS and Android targets.");
