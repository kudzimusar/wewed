package pro.wewed.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.wewed.app.models.AuthorizedSession
import pro.wewed.app.services.SessionAuthority
import pro.wewed.app.services.SessionAuthorityError
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.NativeLaunchConfiguration
import pro.wewed.app.theme.WeddingIdentityPalette

/**
 * Sign-in never asks a person to pick a role. The account decides the roles;
 * a guest opens the app with their own invitation instead of an account.
 */
@Composable
fun LoginScreen(
    appViewModel: AppViewModel,
    launch: NativeLaunchConfiguration,
    onSignedIn: (AuthorizedSession) -> Unit
) {
    val scope = rememberCoroutineScope()
    var showInvitationEntry by remember { mutableStateOf(false) }
    var invitationCode by remember { mutableStateOf(launch.invitationToken ?: "") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun run(block: suspend () -> AuthorizedSession) {
        busy = true
        error = null
        scope.launch {
            try {
                onSignedIn(block())
            } catch (e: SessionAuthorityError) {
                error = e.message
            } catch (e: Exception) {
                error = "We couldn't sign you in. Please try again."
            } finally {
                busy = false
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("login-root"),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "WEWED",
                fontSize = 30.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Serif,
                color = WeddingIdentityPalette.ChampagneDeep
            )
            Text(
                text = "Welcome. Sign in to continue.",
                fontSize = 17.sp,
                color = WeddingIdentityPalette.Ink,
                textAlign = TextAlign.Center
            )

            Button(
                onClick = {
                    run {
                        SessionAuthority.signIn(
                            account = launch.shadowAccount,
                            environment = appViewModel.dataEnvironment,
                            wedding = appViewModel.repository,
                            planner = appViewModel.plannerRepository,
                            invitationToken = launch.invitationToken
                        )
                    }
                },
                enabled = !busy,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 52.dp)
                    .testTag("login-sign-in"),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = WeddingIdentityPalette.ChampagneDeep)
            ) {
                Text("Sign In", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp)
            }

            if (!showInvitationEntry) {
                OutlinedButton(
                    onClick = { showInvitationEntry = true },
                    enabled = !busy,
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 52.dp)
                        .testTag("login-open-invitation"),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text("I have an invitation", color = WeddingIdentityPalette.Ink, fontSize = 17.sp)
                }
            } else {
                OutlinedTextField(
                    value = invitationCode,
                    onValueChange = { invitationCode = it },
                    label = { Text("Invitation code") },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("login-invitation-code")
                )
                Button(
                    onClick = {
                        run {
                            SessionAuthority.signInWithInvitation(
                                token = invitationCode,
                                environment = appViewModel.dataEnvironment,
                                wedding = appViewModel.repository
                            )
                        }
                    },
                    enabled = !busy && invitationCode.isNotBlank(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 52.dp)
                        .testTag("login-invitation-submit"),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = WeddingIdentityPalette.Forest)
                ) {
                    Text("Open my invitation", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                }
            }

            if (busy) {
                CircularProgressIndicator(color = WeddingIdentityPalette.ChampagneDeep)
            }
            error?.let { message ->
                Text(
                    text = message,
                    color = Color(0xFF9B1C1C),
                    fontSize = 15.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .testTag("login-error")
                        .semantics { liveRegion = LiveRegionMode.Polite }
                )
            }
        }
    }
}
