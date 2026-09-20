package pro.wewed.app.ui.entry

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.theme.WewedLogo
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WeddingOrnamentBackdrop

/**
 * The first surface a new installation shows.
 *
 * Opening the app used to land straight on a sign-in form carrying a pre-filled address and
 * password, three role chips and the words "Native Android Division". That is an internal build's
 * front door. It also assumed the only reason to open Wewed is to sign in, which is untrue: the
 * most common first contact is an invitation.
 *
 * Three doors, in the order people actually arrive:
 *
 *   I Have an Invitation   — the guest path, which needs no account at all
 *   Sign In                — an existing Wewed account
 *   Create Account         — a couple or a professional starting out
 *
 * No role is chosen here. Role is an authorization result, not a self-service selection.
 */
@Composable
fun WewedWelcomeScreen(
    onOpenInvitation: () -> Unit,
    onSignIn: () -> Unit,
    onCreateAccount: () -> Unit,
    /**
     * Shadow/UAT only: enters the qualification environment without a production credential.
     *
     * Null in production and production-read-verify, so the production front door offers exactly
     * three doors and no way around them.
     */
    shadowEntry: ShadowEntryOption? = null
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("welcome-root"),
        contentAlignment = Alignment.Center
    ) {
        WeddingOrnamentBackdrop(
            modifier = Modifier.matchParentSize(),
            alpha = 0.09f
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            WewedLogo(contentDescription = "Wewed")
            Spacer(Modifier.height(2.dp))
            Text(
                "Wewed",
                fontSize = 38.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink
            )
            Text(
                "Weddings Made More Meaningful",
                fontSize = 15.sp,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Muted,
                textAlign = TextAlign.Center
            )
            Box(
                modifier = Modifier
                    .padding(vertical = 10.dp)
                    .width(72.dp)
                    .height(1.5.dp)
                    .background(WeddingIdentityPalette.Champagne.copy(alpha = 0.72f))
            )

            // The invitation door comes first, and is the emphasised one: an invited guest is the
            // most common first-time arrival, and they must never be asked for an account.
            Button(
                onClick = onOpenInvitation,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .testTag("welcome-have-invitation"),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = WeddingIdentityPalette.Forest,
                    contentColor = WeddingIdentityPalette.IvorySoft
                )
            ) {
                Text("I Have an Invitation", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }

            OutlinedButton(
                onClick = onSignIn,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .testTag("welcome-sign-in"),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, WeddingIdentityPalette.Champagne),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = WeddingIdentityPalette.Ink
                )
            ) {
                Text("Sign In", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }

            TextButton(
                onClick = onCreateAccount,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("welcome-create-account")
            ) {
                Text(
                    "Create Account",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = WeddingIdentityPalette.ChampagneDeep
                )
            }

            shadowEntry?.let { option ->
                Spacer(Modifier.height(6.dp))
                TextButton(
                    onClick = option.onEnter,
                    modifier = Modifier.testTag("welcome-shadow-entry")
                ) {
                    Text(
                        "Continue in ${option.environmentName}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = WeddingIdentityPalette.Muted
                    )
                }
            }
        }
    }
}

/** The Shadow/UAT way in, named for what it is and carrying no credential. */
data class ShadowEntryOption(
    val environmentName: String,
    val onEnter: () -> Unit
)
