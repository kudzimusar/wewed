package pro.wewed.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WewedLogo
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WeddingOrnamentBackdrop

/**
 * Wewed sign in.
 *
 * What this replaces, and why each part had to go:
 *
 *   * A pre-filled address and a real password compiled into the binary. Anyone with the APK had
 *     the credential. Shipping a password is not a convenience, it is a disclosure.
 *   * "Native Android Division" — an internal label on the product's front door.
 *   * Couple / Usher / Planner chips. A person choosing their own role is not authentication; it
 *     is self-service authorization. Role is what the server answers AFTER it knows who you are.
 *
 * What remains is the whole of sign in: who you are, and proof. Everything else follows from the
 * authorization the server returns.
 */
@Composable
fun LoginScreen(
    sessionViewModel: SessionViewModel,
    environment: NativeDataEnvironment,
    onBack: (() -> Unit)? = null,
    onForgotPassword: (() -> Unit)? = null,
    onCreateAccount: (() -> Unit)? = null
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var validationError by remember { mutableStateOf<String?>(null) }
    val submitting by sessionViewModel.isSigningIn.collectAsState()
    val sessionError by sessionViewModel.authenticationError.collectAsState()

    val canSubmit = email.isNotBlank() && password.isNotBlank() && !submitting

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("sign-in-root"),
        contentAlignment = Alignment.Center
    ) {
        WeddingOrnamentBackdrop(modifier = Modifier.matchParentSize(), alpha = 0.08f)

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            WewedLogo()
            Text(
                "Welcome back",
                fontSize = 30.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.Ink
            )
            Text(
                "Sign in to your Wewed account",
                fontSize = 14.sp,
                color = WeddingIdentityPalette.Muted,
                textAlign = TextAlign.Center
            )

            OutlinedTextField(
                value = email,
                onValueChange = {
                    email = it
                    validationError = null
                    sessionViewModel.clearAuthenticationError()
                },
                label = { Text("Email") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("sign-in-email"),
                shape = RoundedCornerShape(12.dp)
            )

            OutlinedTextField(
                value = password,
                onValueChange = {
                    password = it
                    validationError = null
                    sessionViewModel.clearAuthenticationError()
                },
                label = { Text("Password") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag("sign-in-password"),
                shape = RoundedCornerShape(12.dp)
            )

            (validationError ?: sessionError)?.let {
                Text(
                    it,
                    color = WeddingIdentityPalette.ChampagneDeep,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.testTag("sign-in-error")
                )
            }

            Button(
                onClick = {
                    validationError = null
                    sessionViewModel.clearAuthenticationError()
                    // Role is deliberately NOT passed. The session resolves authorization from the
                    // identity; a caller cannot assert what it is allowed to be.
                    validationError = runCatching {
                        sessionViewModel.signIn(email.trim(), password)
                    }.exceptionOrNull()?.message
                },
                enabled = canSubmit,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .testTag("sign-in-submit"),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = WeddingIdentityPalette.Forest,
                    contentColor = WeddingIdentityPalette.IvorySoft
                )
            ) {
                Text(
                    if (submitting) "Signing in…" else "Sign In",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }

            onForgotPassword?.let {
                TextButton(onClick = it, modifier = Modifier.testTag("sign-in-forgot-password")) {
                    Text(
                        "Forgot password?",
                        fontSize = 13.sp,
                        color = WeddingIdentityPalette.ChampagneDeep
                    )
                }
            }

            onCreateAccount?.let {
                TextButton(onClick = it, modifier = Modifier.testTag("sign-in-create-account")) {
                    Text(
                        "Create an account",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = WeddingIdentityPalette.ChampagneDeep
                    )
                }
            }

            onBack?.let {
                TextButton(onClick = it, modifier = Modifier.testTag("sign-in-back")) {
                    Text("Back", fontSize = 13.sp, color = WeddingIdentityPalette.Muted)
                }
            }

            // Shadow and UAT lanes need a way in without a production credential. The affordance
            // is named for what it is, appears only where persona switching is already permitted,
            // and carries no credential of any kind.
            if (environment.allowsDevelopmentPersonaSwitching) {
                Spacer(Modifier.height(4.dp))
                TextButton(
                    onClick = { sessionViewModel.enterShadowSession() },
                    modifier = Modifier.testTag("sign-in-shadow-entry")
                ) {
                    Text(
                        "Continue in ${environment.displayName}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = WeddingIdentityPalette.Muted
                    )
                }
            }
        }
    }
}
