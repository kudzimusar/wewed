import SwiftUI
import CoreImage
import CoreImage.CIFilterBuiltins

/// Generic QR renderer (QRO05-PIQR01). It only draws `payload`; the caller names what the code IS
/// through `accessibilityLabel`/`accessibilityIdentifier`. Printed Invitation Access, Guest Open
/// Invitation and the Wedding Pass are separate trust domains — each wraps this with its own label
/// and identifier, so a pass assertion (`wedding-pass-qr`) can never match an invitation QR.
public struct WewedQRCodeView: View {
    private let payload: String
    private let size: CGFloat
    private let label: String
    private let identifier: String

    public init(payload: String, size: CGFloat = 150, accessibilityLabel: String, accessibilityIdentifier: String) {
        self.payload = payload
        self.size = size
        self.label = accessibilityLabel
        self.identifier = accessibilityIdentifier
    }

    public var body: some View {
        Group {
            if let image = WewedQRCodeView.render(payload) {
                Image(image, scale: 1, label: Text(label))
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
            } else {
                Image(systemName: "qrcode")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(WeddingIdentityPalette.ink)
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityIdentifier(identifier)
    }

    static func render(_ payload: String) -> CGImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(payload.utf8)
        filter.correctionLevel = "M"

        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 12, y: 12))
        return CIContext(options: [.useSoftwareRenderer: false]).createCGImage(
            scaled,
            from: scaled.extent
        )
    }
}
