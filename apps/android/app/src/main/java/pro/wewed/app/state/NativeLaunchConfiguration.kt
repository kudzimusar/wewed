package pro.wewed.app.state

import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.ShadowAccount

data class NativeLaunchConfiguration(
    val environment: NativeDataEnvironment,
    val baseUrl: String? = null,
    /** Which Shadow account "Sign In" authenticates as. Defaults to the couple who owns the wedding. */
    val shadowAccount: ShadowAccount = ShadowAccount.COUPLE,
    /** Invitation link token used when the account is a guest. */
    val invitationToken: String? = null
) {
    companion object {
        /**
         * Data source selection is explicit. With no selection the Git-safe sanitized dataset loads;
         * private real data is never picked up implicitly, and an explicit private request fails
         * loudly (in the repository factory) instead of degrading to sanitized data.
         */
        fun resolve(
            rawEnvironment: String?,
            shadowBaseUrl: String?,
            rawAccount: String? = null,
            invitationToken: String? = null
        ): NativeLaunchConfiguration {
            val environment = when (rawEnvironment?.trim()?.lowercase()) {
                "private_real_shadow", "private-real-shadow", "private_shadow", "private" -> NativeDataEnvironment.PRIVATE_REAL_SHADOW
                "sanitized_shadow", "sanitized-shadow" -> NativeDataEnvironment.SANITIZED_SHADOW
                "shadow" -> NativeDataEnvironment.SHADOW
                "production_read_verify", "production-read-verify" -> NativeDataEnvironment.PRODUCTION_READ_VERIFY
                "production" -> NativeDataEnvironment.PRODUCTION
                "fixture" -> NativeDataEnvironment.FIXTURE
                else -> NativeDataEnvironment.SANITIZED_SHADOW
            }
            return NativeLaunchConfiguration(
                environment = environment,
                baseUrl = shadowBaseUrl,
                shadowAccount = ShadowAccount.fromKey(rawAccount) ?: ShadowAccount.COUPLE,
                invitationToken = invitationToken?.trim()?.takeIf { it.isNotEmpty() }
            )
        }
    }
}
