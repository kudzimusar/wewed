import SwiftUI
#if canImport(CoreText)
import CoreText
#endif

/// The invitation's own typefaces.
///
/// The script face is part of the approved stationery, not a styling choice: substituting a system
/// face because it "looks elegant" is the same class of error as redrawing the flowers.
/// `GreatVibes-Regular.ttf` is imported byte-identical from `origin/main:public/fonts/`, where the
/// web loads it as `@font-face { font-family: IvoryScript }`.
///
/// The split follows `ivory-floral-gold.css` exactly:
///
/// ```
/// .ivory-names, .ivory-tagline   IvoryScript          the couple, and their line
/// .ivory-stage (everything else) Georgia, serif       including the seal monogram
/// ```
public enum IvoryTypography {

    /// The PostScript name the font registers under.
    public static let scriptPostScriptName = "GreatVibes-Regular"

    /// Registered at runtime rather than declared in `UIAppFonts`, because the file ships inside
    /// the package bundle and must resolve identically for the app and for tests.
    private static let registered: Bool = {
        #if canImport(CoreText)
        guard let url = Bundle.module.url(forResource: "GreatVibes-Regular", withExtension: "ttf")
        else { return false }
        var error: Unmanaged<CFError>?
        let ok = CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error)
        // Already-registered is success: tests and the app can both reach this path.
        if !ok, let code = error?.takeUnretainedValue(), CFErrorGetCode(code) == 105 { return true }
        return ok
        #else
        return false
        #endif
    }()

    /// Whether the approved script face is actually available.
    ///
    /// Exposed so a test can fail when the font is missing from the bundle. A silent fallback to a
    /// system face is exactly the regression this type exists to prevent.
    public static var isScriptAvailable: Bool {
        guard registered else { return false }
        #if canImport(UIKit)
        return UIFont(name: scriptPostScriptName, size: 12) != nil
        #else
        return true
        #endif
    }

    /// `.ivory-names`, `.ivory-tagline` — the script face.
    public static func script(size: CGFloat) -> Font {
        _ = registered
        return .custom(scriptPostScriptName, size: size)
    }

    /// `.ivory-stage { font-family: Georgia, serif }`.
    ///
    /// Android has no Georgia; a platform serif is the closest available roman face, and unlike
    /// the script it is a body face whose exact identity the design does not depend on.
    public static func body(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .serif)
    }
}
