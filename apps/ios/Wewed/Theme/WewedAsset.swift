import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// Loads approved Wewed media from the package bundle.
///
/// `Image(name, bundle:)` resolves through the asset-catalog lookup path. The Wewed media ships as
/// loose PNGs processed by SwiftPM, and that lookup does not reliably resolve them once the package
/// is embedded in the Xcode app target — the hero photograph rendered on Android but came out blank
/// on iOS, leaving only the gradient. Loading from the bundle URL works for loose resources in
/// every configuration, so this is the single place media is created.
public enum WewedAsset {
    public static let heroWedding = "hero-wedding"
    public static let ornamentFrame = "ornament-frame"

    /// True when the named media can actually be loaded, so tests can assert it without a screenshot.
    public static func isAvailable(_ name: String) -> Bool {
        image(name) != nil
    }

    #if canImport(UIKit)
    static func uiImage(_ name: String) -> UIImage? {
        if let direct = UIImage(named: name, in: .module, compatibleWith: nil) {
            return direct
        }
        guard let url = Bundle.module.url(forResource: name, withExtension: "png"),
              let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }

    static func image(_ name: String) -> Image? {
        guard let ui = uiImage(name) else { return nil }
        return Image(uiImage: ui)
    }
    #else
    static func image(_ name: String) -> Image? {
        guard Bundle.module.url(forResource: name, withExtension: "png") != nil else { return nil }
        return Image(name, bundle: .module)
    }
    #endif
}

/// Approved Wewed media, or an ivory placeholder when the asset cannot be loaded.
///
/// The placeholder is deliberately plain: a missing photograph must not be mistaken for content.
public struct WewedMediaImage: View {
    private let name: String

    public init(_ name: String) {
        self.name = name
    }

    public var body: some View {
        if let image = WewedAsset.image(name) {
            image.resizable()
        } else {
            WeddingIdentityPalette.ivorySoft
        }
    }
}
