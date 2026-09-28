import XCTest
#if canImport(UIKit)
import UIKit
#endif
@testable import WewedKit

/// The approved Wewed media must actually resolve from the package bundle.
///
/// The hero photograph renders on Android but not on iOS, so this pins the resource lookup
/// rather than relying on a visual check.
final class MediaResourceTests: XCTestCase {

    func testBundleContainsApprovedMedia() throws {
        let bundle = Bundle.module
        for name in ["hero-wedding", "ornament-frame"] {
            let url = bundle.url(forResource: name, withExtension: "png")
            XCTAssertNotNil(url, "\(name).png is missing from Bundle.module (\(bundle.bundlePath))")
        }
    }

    /// Guards the defect where the hero rendered on Android but came out blank on iOS:
    /// the asset-catalog lookup used by `Image(_:bundle:)` did not resolve these loose PNGs once
    /// the package was embedded in the Xcode app target. WewedAsset must resolve them in every
    /// configuration, including the macOS test host.
    func testApprovedMediaResolvesThroughWewedAsset() throws {
        XCTAssertTrue(
            WewedAsset.isAvailable(WewedAsset.heroWedding),
            "hero-wedding did not resolve through WewedAsset; the hero will render blank"
        )
        XCTAssertTrue(
            WewedAsset.isAvailable(WewedAsset.ornamentFrame),
            "ornament-frame did not resolve through WewedAsset; the backdrop will render blank"
        )
    }
}
