package pro.wewed.app.ui.pass

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import pro.wewed.app.ui.qr.WewedQrCode

/**
 * The Wedding Pass QR. Its description and `wedding-pass-qr` tag are part of the pass contract and
 * stay unchanged; rendering is shared with the invitation QRs through [WewedQrCode].
 */
@Composable
fun WeddingQrCode(
    payload: String,
    modifier: Modifier = Modifier
) {
    WewedQrCode(
        payload = payload,
        contentDescription = "Wedding pass QR code",
        testTag = "wedding-pass-qr",
        modifier = modifier,
    )
}
