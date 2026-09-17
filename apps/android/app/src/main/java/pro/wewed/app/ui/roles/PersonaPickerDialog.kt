package pro.wewed.app.ui.roles

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.models.AppRole
import pro.wewed.app.models.DevelopmentPersona
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing

@Composable
fun PersonaPickerDialog(
    sessionViewModel: SessionViewModel,
    onDismiss: () -> Unit
) {
    val activePersonaId by sessionViewModel.activePersonaId.collectAsState()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Switch Persona", fontWeight = FontWeight.Bold) },
        text = {
            LazyColumn(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(WewedSpacing.sm)
            ) {
                items(DevelopmentPersona.allPersonas) { persona ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                sessionViewModel.switchPersona(persona)
                                onDismiss()
                            },
                        shape = RoundedCornerShape(WewedRadius.md),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(1.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(WewedSpacing.base),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(persona.name, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    if (activePersonaId == persona.id) {
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Icon(
                                            Icons.Default.CheckCircle,
                                            contentDescription = null,
                                            tint = WewedColors.Gold,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                                Text(persona.subtitle, fontSize = 11.sp, color = Color.Gray)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    persona.role.title.uppercase(),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = roleColor(persona.role),
                                    modifier = Modifier
                                        .background(roleColor(persona.role).copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        }
    )
}

fun roleColor(role: AppRole): Color = when (role) {
    AppRole.COUPLE -> WewedColors.Gold
    AppRole.PLANNER -> WewedColors.Emerald
    AppRole.COORDINATOR -> WewedColors.Burgundy
    AppRole.VENDOR -> Color(0xFF1976D2)
    AppRole.USHER -> Color(0xFF7B1FA2)
    AppRole.GUEST -> Color(0xFFE65100)
    AppRole.ADMIN -> Color(0xFFD32F2F)
}
