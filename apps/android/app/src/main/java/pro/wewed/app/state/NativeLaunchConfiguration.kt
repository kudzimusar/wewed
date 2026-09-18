package pro.wewed.app.state

import pro.wewed.app.models.NativeDataEnvironment

data class NativeLaunchConfiguration(
    val environment: NativeDataEnvironment,
    val baseUrl: String? = null
) {
    companion object {
        fun resolve(rawEnvironment: String?, shadowBaseUrl: String?): NativeLaunchConfiguration {
            val environment = when (rawEnvironment?.trim()?.lowercase()) {
                "private_real_shadow", "private-real-shadow", "private_shadow", "private" -> NativeDataEnvironment.PRIVATE_REAL_SHADOW
                "sanitized_shadow", "sanitized-shadow" -> NativeDataEnvironment.SANITIZED_SHADOW
                "shadow" -> NativeDataEnvironment.SHADOW
                "production_read_verify", "production-read-verify" -> NativeDataEnvironment.PRODUCTION_READ_VERIFY
                "production" -> NativeDataEnvironment.PRODUCTION
                else -> NativeDataEnvironment.FIXTURE
            }
            return NativeLaunchConfiguration(environment = environment, baseUrl = shadowBaseUrl)
        }
    }
}
