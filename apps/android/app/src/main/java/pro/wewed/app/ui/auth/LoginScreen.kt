package pro.wewed.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing

@Composable
fun LoginScreen(sessionViewModel: SessionViewModel) {
    var email by remember { mutableStateOf("tariro@wewed.pro") }
    var password by remember { mutableStateOf("wewed-admin-2026") }
    var selectedRole by remember { mutableStateOf("couple") }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WewedColors.Ivory),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = WewedSpacing.xl),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(WewedSpacing.lg)
        ) {
            Text(
                text = "WEWED",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Serif,
                color = WewedColors.Gold
            )
            Text(
                text = "Native Android Division",
                style = MaterialTheme.typography.bodyMedium,
                color = WewedColors.TextSecondaryLight
            )

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Email Address") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(WewedRadius.md)
            )

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(WewedRadius.md)
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                FilterChip(
                    selected = selectedRole == "couple",
                    onClick = { selectedRole = "couple" },
                    label = { Text("Couple") }
                )
                FilterChip(
                    selected = selectedRole == "usher",
                    onClick = { selectedRole = "usher" },
                    label = { Text("Usher") }
                )
                FilterChip(
                    selected = selectedRole == "planner",
                    onClick = { selectedRole = "planner" },
                    label = { Text("Planner") }
                )
            }

            Button(
                onClick = { sessionViewModel.login(email, selectedRole) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(WewedRadius.lg),
                colors = ButtonDefaults.buttonColors(containerColor = WewedColors.Gold)
            ) {
                Text("Sign In", color = Color.White, fontWeight = FontWeight.Bold)
            }

            Text(
                text = "Zimbabwe-First Wedding Ecosystem",
                style = MaterialTheme.typography.bodySmall,
                color = WewedColors.TextSecondaryLight
            )
        }
    }
}
