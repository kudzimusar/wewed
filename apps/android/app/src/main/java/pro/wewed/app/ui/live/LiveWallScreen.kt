package pro.wewed.app.ui.live

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.material.icons.filled.Create
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import pro.wewed.app.theme.WewedColors
import pro.wewed.app.theme.WewedRadius
import pro.wewed.app.theme.WewedSpacing

data class LiveMessage(
    val id: String,
    val author: String,
    val content: String,
    val time: String
)

@Composable
fun LiveWallScreen() {
    var messages by remember {
        mutableStateOf(emptyList<LiveMessage>())
    }
    var applauseCount by remember { mutableIntStateOf(0) }
    var showDialog by remember { mutableStateOf(false) }
    var draftText by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Live Wall", fontWeight = FontWeight.SemiBold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = WewedColors.Ivory)
            )
        },
        containerColor = WewedColors.Ivory
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = WewedSpacing.base)
        ) {
            // Applause Header Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(WewedRadius.md),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(2.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(WewedSpacing.base),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Live Celebration", fontWeight = FontWeight.Bold)
                        Text("$applauseCount claps shared today", fontSize = 12.sp, color = Color.Gray)
                    }

                    Button(
                        onClick = { applauseCount++ },
                        colors = ButtonDefaults.buttonColors(containerColor = WewedColors.GoldLight.copy(alpha = 0.5f))
                    ) {
                        Icon(Icons.Default.Celebration, contentDescription = null, tint = WewedColors.GoldDark)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Applaud", color = WewedColors.TextPrimaryLight, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(WewedSpacing.sm))

            if (messages.isEmpty()) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "No live messages yet. Be the first to share well wishes!",
                        color = Color.Gray,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(WewedSpacing.sm)
                ) {
                    items(messages, key = { it.id }) { msg ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(WewedRadius.md),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(1.dp)
                        ) {
                            Column(modifier = Modifier.padding(WewedSpacing.base)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(msg.author, fontWeight = FontWeight.Bold, color = WewedColors.Emerald)
                                    Text(msg.time, fontSize = 11.sp, color = Color.Gray)
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(msg.content, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            }

            Button(
                onClick = { showDialog = true },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = WewedSpacing.base)
                    .height(50.dp),
                shape = RoundedCornerShape(WewedRadius.lg),
                colors = ButtonDefaults.buttonColors(containerColor = WewedColors.Gold)
            ) {
                Icon(Icons.Default.Create, contentDescription = null)
                Spacer(modifier = Modifier.width(WewedSpacing.sm))
                Text("Send Well Wishes", color = Color.White, fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.height(56.dp))
        }

        if (showDialog) {
            AlertDialog(
                onDismissRequest = { showDialog = false },
                title = { Text("Send Well Wishes") },
                text = {
                    OutlinedTextField(
                        value = draftText,
                        onValueChange = { draftText = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Write your message to the couple...") }
                    )
                },
                confirmButton = {
                    TextButton(onClick = {
                        if (draftText.isNotBlank()) {
                            messages = listOf(
                                LiveMessage("m_${System.currentTimeMillis()}", "Guest", draftText, "Just now")
                            ) + messages
                            draftText = ""
                            showDialog = false
                        }
                    }) {
                        Text("Post")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}
