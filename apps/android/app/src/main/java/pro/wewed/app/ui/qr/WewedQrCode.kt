package pro.wewed.app.ui.qr

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

/**
 * Generic QR renderer (QRO05-PIQR01). It only draws [payload]; the caller names what the code IS
 * through [contentDescription]/[testTag]. Printed Invitation Access, Guest Open Invitation and the
 * Wedding Pass are separate trust domains — each wraps this with its own description and tag, so a
 * pass assertion (`wedding-pass-qr`) can never match an invitation QR.
 */
@Composable
fun WewedQrCode(
    payload: String,
    contentDescription: String,
    testTag: String,
    modifier: Modifier = Modifier,
    size: Dp = 150.dp,
) {
    val bitmap = remember(payload) { generateQrBitmap(payload) }
    Image(
        bitmap = bitmap.asImageBitmap(),
        contentDescription = contentDescription,
        modifier = modifier.size(size).testTag(testTag)
    )
}

fun generateQrBitmap(payload: String): Bitmap {
    val size = 640
    val matrix = QRCodeWriter().encode(
        payload,
        BarcodeFormat.QR_CODE,
        size,
        size,
        mapOf(
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
            EncodeHintType.MARGIN to 1
        )
    )
    val pixels = IntArray(size * size)
    for (y in 0 until size) {
        val offset = y * size
        for (x in 0 until size) {
            pixels[offset + x] = if (matrix[x, y]) 0xFF111111.toInt() else 0xFFFFFFFF.toInt()
        }
    }
    return Bitmap.createBitmap(pixels, size, size, Bitmap.Config.ARGB_8888)
}
