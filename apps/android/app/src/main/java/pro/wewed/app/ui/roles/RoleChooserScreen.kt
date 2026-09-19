package pro.wewed.app.ui.roles

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.AuthorizedSession
import pro.wewed.app.models.RoleGrant
import pro.wewed.app.theme.WeddingIdentityPalette

/** Shown only when an account legitimately holds more than one role. Lists only those roles. */
@Composable
fun RoleChooserScreen(
    session: AuthorizedSession,
    onChoose: (RoleGrant) -> Unit,
    onSignOut: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 40.dp)
            .testTag("role-chooser-root"),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            "Welcome back",
            fontFamily = FontFamily.Serif,
            fontSize = 30.sp,
            fontWeight = FontWeight.SemiBold,
            color = WeddingIdentityPalette.Ink
        )
        Text(
            "How are you using Wewed today?",
            fontSize = 18.sp,
            color = WeddingIdentityPalette.Ink
        )

        session.grants.forEach { grant ->
            RoleChoiceRow(grant = grant, onClick = { onChoose(grant) })
        }

        Spacer(Modifier.height(8.dp))
        TextButton(
            onClick = onSignOut,
            modifier = Modifier
                .heightIn(min = 48.dp)
                .testTag("role-chooser-sign-out")
        ) {
            Text("Sign out", fontSize = 16.sp, color = WeddingIdentityPalette.Muted)
        }
    }
}

@Composable
private fun RoleChoiceRow(grant: RoleGrant, onClick: () -> Unit) {
    val spoken = buildString {
        append(grant.role.choiceLabel)
        append(", ")
        append(grant.weddingTitle)
        if (grant.isTestOverlay) append(", test access")
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 72.dp)
            .background(WeddingIdentityPalette.IvorySoft, RoundedCornerShape(16.dp))
            .border(1.dp, WeddingIdentityPalette.Hairline, RoundedCornerShape(16.dp))
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = spoken }
            .padding(horizontal = 20.dp, vertical = 14.dp)
            .testTag("role-choice-${grant.role.roleId}"),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(grant.role.choiceLabel, fontSize = 19.sp, fontWeight = FontWeight.SemiBold, color = WeddingIdentityPalette.Ink)
            Text(grant.weddingTitle, fontSize = 15.sp, color = WeddingIdentityPalette.Muted)
            if (grant.isTestOverlay) {
                Text("Test access", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = WeddingIdentityPalette.ChampagneDeep)
            }
        }
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = WeddingIdentityPalette.Muted)
    }
}
