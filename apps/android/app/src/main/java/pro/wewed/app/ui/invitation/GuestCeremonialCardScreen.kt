package pro.wewed.app.ui.invitation

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import pro.wewed.app.models.InvitationContext
import pro.wewed.app.navigation.GuestCardAction
import pro.wewed.app.navigation.GuestCardPresentation
import pro.wewed.app.theme.WeddingIdentityPalette
import pro.wewed.app.theme.WeddingMonogramBadge
import pro.wewed.app.theme.WeddingOrnamentBackdrop

/**
 * The Guest's ceremonial card, for a guest who has already answered.
 *
 * A guest who had replied was being sent straight past their card to the Pass. That treats the
 * invitation as a form they finished with, when it is the Couple's recognition of them and the way
 * they enter the wedding. The card stays; only what it asks changes.
 *
 * A pending guest still meets [IvoryInvitationScreen], which carries the RSVP. This is the same
 * ivory ground and the same ornament for everyone else — confirmed, declined, on the day, and
 * afterwards — so there is no visual seam between the states of one card.
 *
 * The reveal is staged in the same restrained manner as the Wewed opening: the ornament settles,
 * the champagne edge is drawn, the monogram resolves, then the names, then the personalisation,
 * then the actions. Nothing bounces or spins.
 */
@Composable
fun GuestCeremonialCardScreen(
    invitation: InvitationContext,
    presentation: GuestCardPresentation,
    countdownLabel: String?,
    onAction: (GuestCardAction) -> Unit,
    onContinue: () -> Unit
) {
    val silk = remember { CubicBezierEasing(0.22f, 0.61f, 0.36f, 1f) }
    val ornament = remember { Animatable(0f) }
    val edge = remember { Animatable(0f) }
    val monogram = remember { Animatable(0f) }
    val names = remember { Animatable(0f) }
    val personal = remember { Animatable(0f) }
    val actions = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        launch { ornament.animateTo(1f, tween(820)) }
        edge.animateTo(1f, tween(560, easing = silk))
        monogram.animateTo(1f, tween(520, easing = silk))
        names.animateTo(1f, tween(560, easing = silk))
        personal.animateTo(1f, tween(460, easing = silk))
        actions.animateTo(1f, tween(420, easing = silk))
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeddingIdentityPalette.Ivory)
            .testTag("guest-ceremonial-card"),
        contentAlignment = Alignment.Center
    ) {
        WeddingOrnamentBackdrop(
            modifier = Modifier.matchParentSize(),
            alpha = 0.12f * ornament.value
        )

        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 22.dp)
                .graphicsLayer { alpha = edge.value },
            shape = RoundedCornerShape(18.dp),
            color = WeddingIdentityPalette.IvorySoft,
            border = BorderStroke(1.dp, WeddingIdentityPalette.Champagne.copy(alpha = 0.55f))
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 22.dp, vertical = 26.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(modifier = Modifier.graphicsLayer { alpha = monogram.value }) {
                    WeddingMonogramBadge(names = invitation.coupleNames)
                }

                Text(
                    invitation.coupleNames,
                    fontSize = 27.sp,
                    fontFamily = FontFamily.Serif,
                    color = WeddingIdentityPalette.Ink,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.graphicsLayer { alpha = names.value }
                )

                Box(
                    modifier = Modifier
                        .width(64.dp)
                        .height(1.dp)
                        .background(WeddingIdentityPalette.Champagne.copy(alpha = 0.7f))
                        .graphicsLayer { alpha = names.value }
                )

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.graphicsLayer { alpha = personal.value }
                ) {
                    Text(
                        presentation.headline,
                        fontSize = 19.sp,
                        fontFamily = FontFamily.Serif,
                        fontWeight = FontWeight.Medium,
                        color = WeddingIdentityPalette.Ink,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.testTag("guest-card-headline")
                    )
                    // The guest is named, because this card is addressed to them.
                    Text(
                        invitation.guestName,
                        fontSize = 14.sp,
                        color = WeddingIdentityPalette.Muted,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.testTag("guest-card-guest-name")
                    )
                    presentation.statusLabel?.let {
                        Text(
                            it,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = WeddingIdentityPalette.Forest,
                            modifier = Modifier.testTag("guest-card-status")
                        )
                    }
                    countdownLabel?.let {
                        Text(
                            it,
                            fontSize = 12.sp,
                            color = WeddingIdentityPalette.ChampagneDeep,
                            modifier = Modifier.testTag("guest-card-countdown")
                        )
                    }
                    Text(
                        "${invitation.venueName} · ${invitation.venueCity}",
                        fontSize = 12.sp,
                        color = WeddingIdentityPalette.Muted,
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(Modifier.height(2.dp))

                Column(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .graphicsLayer { alpha = actions.value }
                ) {
                    Button(
                        onClick = { onAction(presentation.primaryAction) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("guest-card-primary-action"),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = WeddingIdentityPalette.Forest,
                            contentColor = WeddingIdentityPalette.IvorySoft
                        )
                    ) {
                        Text(
                            presentation.primaryAction.label,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    presentation.secondaryActions.forEach { action ->
                        OutlinedButton(
                            onClick = { onAction(action) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp)
                                .testTag("guest-card-action-${action.name.lowercase()}"),
                            shape = RoundedCornerShape(12.dp),
                            border = BorderStroke(1.dp, WeddingIdentityPalette.Champagne)
                        ) {
                            Text(
                                action.label,
                                fontSize = 13.sp,
                                color = WeddingIdentityPalette.Ink
                            )
                        }
                    }

                    TextButton(
                        onClick = onContinue,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("guest-card-continue")
                    ) {
                        Text(
                            "Continue",
                            fontSize = 13.sp,
                            color = WeddingIdentityPalette.Muted
                        )
                    }
                }
            }
        }
    }
}
