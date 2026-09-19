package pro.wewed.app.services

import java.net.URI
import pro.wewed.app.models.NativeDataEnvironment

sealed class NativeEnvironmentGuardError(message: String) : IllegalStateException(message) {
    data object ProductionDisabled : NativeEnvironmentGuardError("Production native runtime is disabled during the shadow parity sprint.")
    data class ShadowPointsToProductionHost(val host: String) :
        NativeEnvironmentGuardError("Shadow runtime cannot target production host: $host")
}

object NativeEnvironmentGuard {
    private val productionHosts = setOf(
        "wewed.pro",
        "www.wewed.pro",
        "api.wewed.pro",
        "pro.wewed.app"
    )

    fun validate(baseUrl: String?, environment: NativeDataEnvironment) {
        if (environment == NativeDataEnvironment.PRODUCTION) {
            throw NativeEnvironmentGuardError.ProductionDisabled
        }

        val shadowFamily = environment == NativeDataEnvironment.SHADOW ||
            environment == NativeDataEnvironment.SANITIZED_SHADOW ||
            environment == NativeDataEnvironment.PRIVATE_REAL_SHADOW
        if (!shadowFamily || baseUrl.isNullOrBlank()) return

        val host = runCatching { URI(baseUrl).host?.lowercase() }.getOrNull() ?: return
        if (host in productionHosts) {
            throw NativeEnvironmentGuardError.ShadowPointsToProductionHost(host)
        }
    }
}
