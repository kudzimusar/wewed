package pro.wewed.app

import android.content.Intent
import android.os.Bundle
import android.graphics.Color
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.core.view.WindowCompat
import pro.wewed.app.models.DevelopmentPersona
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.BuildConfig
import pro.wewed.app.invitation.GuestInvitationBootstrap
import pro.wewed.app.invitation.GuestOnlyEntryState
import pro.wewed.app.invitation.InvitationEntryParser
import pro.wewed.app.ui.invitation.GuestOnlyInvitationShell
import pro.wewed.app.state.NativeLaunchConfiguration
import pro.wewed.app.state.SessionViewModel
import pro.wewed.app.theme.WewedTheme
import pro.wewed.app.ui.RootScreen
import pro.wewed.app.ui.entry.NativeEnvironmentUnavailableScreen

@OptIn(ExperimentalComposeUiApi::class)
class MainActivity : ComponentActivity() {
    private lateinit var appViewModel: AppViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.rgb(251, 247, 239)
        window.navigationBarColor = Color.rgb(255, 253, 248)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }

        val launch = NativeLaunchConfiguration.resolve(
            rawEnvironment = intent.getStringExtra(EXTRA_NATIVE_ENV),
            shadowBaseUrl = intent.getStringExtra(EXTRA_SHADOW_BASE_URL),
            isDebugBuild = BuildConfig.DEBUG
        )
        // A missing protected snapshot must not take the process down. The app refuses to fall
        // back to demo data — that refusal is the point — but it says so on screen instead of
        // disappearing back to the launcher with no explanation.
        val resolved = AppViewModel.fromEnvironmentOrNull(
            environment = launch.environment,
            baseUrl = launch.baseUrl
        )
        if (resolved == null) {
            // An invited guest does not need the whole production workspace to open their card.
            //
            // The general repository is deliberately still disabled in production, and a launch
            // that carries a credential must not die behind that. The guest-only shell is built
            // from `GuestInvitationBootstrap`, which depends on nothing but the guest-session
            // authority — so this unlocks the invitation slice and nothing else.
            val hasInvitation = GuestOnlyEntryState.publish(
                rawUrl = intent?.dataString,
                intentExtra = intent?.getStringExtra(InvitationEntryParser.ANDROID_INTENT_EXTRA)
            )
            // An invited Guest should not need WhatsApp every time they open the app. If this
            // device already holds a Guest session, an ordinary icon launch restores their wedding
            // — the same decision a returning account holder gets, by a different credential.
            val hasRememberedGuest =
                GuestInvitationBootstrap.hasGuestSession(applicationContext)
            if (hasInvitation || hasRememberedGuest) {
                setContent {
                    WewedTheme {
                        Box(modifier = Modifier.semantics { testTagsAsResourceId = true }) {
                            GuestOnlyInvitationShell(
                                hasIncomingInvitation = hasInvitation,
                                onForgetWedding = {
                                    // Ends the wedding relationship on this device. Deliberately
                                    // not Sign Out: no account session is touched.
                                    GuestInvitationBootstrap.forgetGuest(applicationContext)
                                    finish()
                                },
                                coordinator = GuestInvitationBootstrap.coordinator(
                                    context = applicationContext,
                                    // Debug builds only, and never read in a release binary: this
                                    // is how the guest-only shell can be driven end to end against
                                    // a stub instead of production. A release build has no way to
                                    // be pointed anywhere but wewed.pro.
                                    baseUrl = if (BuildConfig.DEBUG) {
                                        intent?.getStringExtra(EXTRA_GUEST_BASE_URL)
                                            ?: GuestInvitationBootstrap.PRODUCTION_BASE_URL
                                    } else {
                                        GuestInvitationBootstrap.PRODUCTION_BASE_URL
                                    }
                                )
                            )
                        }
                    }
                }
                return
            }

            val reason = AppViewModel.lastEnvironmentFailure
                ?: "This data environment could not be opened."
            setContent {
                WewedTheme {
                    Box(modifier = Modifier.semantics { testTagsAsResourceId = true }) {
                        NativeEnvironmentUnavailableScreen(
                            environmentName = launch.environment.displayName,
                            reason = reason
                        )
                    }
                }
            }
            return
        }
        appViewModel = resolved
        appViewModel.handleIncomingUrl(intent?.dataString)

        // Built only once the environment is known, because the environment decides whether a
        // Shadow persona may be applied at all. It starts empty: no identity, role or wedding
        // until something with authority supplies one (master plan §8.2).
        val sessionViewModel = SessionViewModel(environment = launch.environment)

        // Development/Shadow qualification only (P0-16): lets automated role traversal start as a
        // specific authorized persona. Ignored entirely in production and production-read-verify.
        if (launch.environment.allowsDevelopmentPersonaSwitching) {
            intent.getStringExtra(EXTRA_NATIVE_PERSONA)
                ?.let { requested -> DevelopmentPersona.allPersonas.firstOrNull { it.id == requested } }
                ?.let { sessionViewModel.switchPersona(it) }
        }

        setContent {
            WewedTheme {
                // testTagsAsResourceId was applied deep inside the authenticated tree, so the
                // splash, welcome and sign-in surfaces exposed no test ids at all — a UI flow
                // could see their text but could not address a single control on them. Set once
                // at the root, it propagates to every surface including the entry ones.
                Box(modifier = Modifier.semantics { testTagsAsResourceId = true }) {
                    RootScreen(
                        sessionViewModel = sessionViewModel,
                        appViewModel = appViewModel
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        // Published unconditionally, before the view-model check. In production the general
        // repository is never built, so `appViewModel` is never initialised — and a warm Guest B
        // link used to be received and then dropped because the only listener did not exist.
        GuestOnlyEntryState.publish(
            rawUrl = intent.dataString,
            intentExtra = intent.getStringExtra(InvitationEntryParser.ANDROID_INTENT_EXTRA)
        )
        if (::appViewModel.isInitialized) {
            appViewModel.handleIncomingUrl(intent.dataString)
        }
    }

    companion object {
        const val EXTRA_NATIVE_ENV = "wewed_native_env"
        const val EXTRA_SHADOW_BASE_URL = "wewed_shadow_base_url"
        const val EXTRA_NATIVE_PERSONA = "wewed_native_persona"

        /**
         * Debug-only origin override for the guest-only shell.
         *
         * It exists so the real Activity and shell can be exercised against a stub server. A
         * release build ignores it entirely, so it cannot become a way to point a guest's
         * invitation somewhere other than Wewed.
         */
        const val EXTRA_GUEST_BASE_URL = "wewed_guest_base_url"
    }
}
