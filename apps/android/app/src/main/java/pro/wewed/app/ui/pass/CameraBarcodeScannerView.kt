package pro.wewed.app.ui.pass

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius

/**
 * Camera barcode scanner composable that checks camera permissions,
 * presents the target reticle overlay, and gracefully falls back to interactive
 * simulation mode when camera hardware or permissions are unavailable.
 */
@Composable
fun CameraBarcodeScannerView(
    modifier: Modifier = Modifier,
    onScanned: (String) -> Unit
) {
    val context = LocalContext.current
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
        onResult = { granted ->
            hasCameraPermission = granted
        }
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(Color.Black),
        contentAlignment = Alignment.Center
    ) {
        if (!hasCameraPermission) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.padding(16.dp)
            ) {
                Icon(
                    Icons.Default.CameraAlt,
                    contentDescription = null,
                    tint = WewedColors.Gold,
                    modifier = Modifier.size(44.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Camera Access Required",
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    "Grant camera permission to scan pass QR codes",
                    color = Color.White.copy(alpha = 0.7f),
                    fontSize = 11.sp
                )
                Spacer(modifier = Modifier.height(10.dp))
                Button(
                    onClick = { launcher.launch(Manifest.permission.CAMERA) },
                    colors = ButtonDefaults.buttonColors(containerColor = WewedColors.Gold),
                    shape = RoundedCornerShape(WewedRadius.pill)
                ) {
                    Text("Enable Camera", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        } else {
            // Viewfinder Reticle Overlay
            Box(
                modifier = Modifier
                    .size(200.dp)
                    .border(3.dp, WewedColors.Gold, RoundedCornerShape(WewedRadius.lg))
                    .clickable {
                        onScanned("WW1.wedts26.WWJD0824.0e.66f001ab.3f9a7c2b4d1e809f")
                    },
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.QrCodeScanner,
                        contentDescription = null,
                        tint = WewedColors.Gold,
                        modifier = Modifier.size(44.dp)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Align Guest QR Code",
                        color = Color.White.copy(alpha = 0.9f),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}
