package pro.wewed.app.ui.shared

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import pro.wewed.app.models.RoleGrant
import pro.wewed.app.state.SessionViewModel

/** Canonical Wewed support contacts (src/lib/email/addresses.ts and src/lib/public-site-documents.ts). */
object WewedSupportContacts {
    const val EMAIL = "support@wewed.pro"
    const val HELP_CENTRE_URL = "https://wewed.pro/help"
}

/**
 * Who is signed in, how they are using Wewed, and the only two account actions:
 * switching between roles this account actually holds, and signing out.
 */
@Composable
fun AccountContent(
    sessionViewModel: SessionViewModel,
    grant: RoleGrant,
    modifier: Modifier = Modifier
) {
    val session by sessionViewModel.session.collectAsState()
    val current = session ?: return
    val otherRoles = current.grants.filter { it.role != grant.role }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .testTag("account-root")
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        TestAccessNotice(grant)
        InfoCard {
            LabeledValue("Signed in as", current.displayName, Modifier.testTag("account-display-name"))
            LabeledValue("Using Wewed as", grant.role.choiceLabel, Modifier.testTag("account-role"))
            LabeledValue("Wedding", grant.weddingTitle, Modifier.testTag("account-wedding"))
        }

        if (current.grants.size > 1) {
            InfoCard {
                SupportingText("This account can also use Wewed as: ${otherRoles.joinToString { it.role.choiceLabel }}.")
                SecondaryButton(
                    text = "Switch to another role",
                    icon = Icons.Default.SwapHoriz,
                    onClick = { sessionViewModel.clearActiveRole() },
                    modifier = Modifier.fillMaxWidth().testTag("account-switch-role")
                )
            }
        }

        PrimaryButton(
            text = "Sign out",
            icon = Icons.AutoMirrored.Filled.Logout,
            onClick = { sessionViewModel.signOut() },
            modifier = Modifier.fillMaxWidth().testTag("account-sign-out"),
            containerColor = Ui.Ink
        )
    }
}

/** Account as a pushed screen (couple More → Settings, planner More → Account). */
@Composable
fun AccountScreen(sessionViewModel: SessionViewModel, grant: RoleGrant, onBack: () -> Unit) {
    SubScreen(title = "Account", onBack = onBack) {
        AccountContent(sessionViewModel, grant)
    }
}

@Composable
fun HelpSupportContent(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var problem by remember { mutableStateOf<String?>(null) }
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .testTag("help-support-root")
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        InfoCard {
            SectionTitle("Wewed support")
            BodyText("Email the Wewed support team at ${WewedSupportContacts.EMAIL}.")
            SecondaryButton(
                text = "Email support",
                icon = Icons.Default.Email,
                onClick = {
                    if (!openExternal(context, "mailto:${WewedSupportContacts.EMAIL}")) {
                        problem = "No email app is available on this device. Write to ${WewedSupportContacts.EMAIL}."
                    }
                },
                modifier = Modifier.fillMaxWidth().testTag("help-support-email")
            )
        }
        InfoCard {
            SectionTitle("Help Centre")
            BodyText("Guides for couples, planners, guests and vendors are in the Wewed Help Centre.")
            SecondaryButton(
                text = "Open the Help Centre",
                icon = Icons.Default.HelpOutline,
                onClick = {
                    if (!openExternal(context, WewedSupportContacts.HELP_CENTRE_URL)) {
                        problem = "No web browser is available on this device. Visit ${WewedSupportContacts.HELP_CENTRE_URL}."
                    }
                },
                modifier = Modifier.fillMaxWidth().testTag("help-support-centre")
            )
        }
        problem?.let { ProblemText(it) }
    }
}

@Composable
fun HelpSupportScreen(onBack: () -> Unit) {
    SubScreen(title = "Help & Support", onBack = onBack) {
        HelpSupportContent()
    }
}
