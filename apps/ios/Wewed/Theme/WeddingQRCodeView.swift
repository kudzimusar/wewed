import SwiftUI
import CoreImage
import CoreImage.CIFilterBuiltins

public struct WeddingQRCodeView: View {
    private let payload: String
    private let size: CGFloat

    public init(payload: String, size: CGFloat = 150) {
        self.payload = payload
        self.size = size
    }

    public var body: some View {
        Group {
            if let image = qrImage {
                Image(decorative: image, scale: 1)
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
        .accessibilityLabel("Wedding pass QR code")
    }

    private var qrImage: CGImage? {
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
