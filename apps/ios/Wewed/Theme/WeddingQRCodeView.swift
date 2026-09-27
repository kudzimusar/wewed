import SwiftUI

/// The Wedding Pass QR. Its label and `wedding-pass-qr` identifier are part of the pass contract and
/// stay unchanged; rendering is shared with the invitation QRs through `WewedQRCodeView`.
public struct WeddingQRCodeView: View {
    private let payload: String
    private let size: CGFloat

    public init(payload: String, size: CGFloat = 150) {
        self.payload = payload
        self.size = size
    }

    public var body: some View {
        WewedQRCodeView(
            payload: payload,
            size: size,
            accessibilityLabel: "Wedding pass QR code",
            accessibilityIdentifier: "wedding-pass-qr"
        )
    }
}
