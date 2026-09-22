package pro.wewed.app.state

import pro.wewed.app.models.NativeDataEnvironment

data class NativeLaunchConfiguration(
    val environment: NativeDataEnvironment,
    val baseUrl: String? = null
) {
    companion object {
        /**
         * Which data environment a launch opens.
         *
         * An ordinary launch — an App Link from Chrome, a tap in WhatsApp, the launcher icon — must
         * not have its data source decided by whether a file happens to exist on the device.
         *
         * It used to. The resolver checked for the Private Real Shadow snapshot and silently
         * selected that environment when it found one, which meant the guest invitation journey
         * depended on a qualification artefact being present, and changed behaviour when it was
         * not. A snapshot that was present but unreadable produced "Private Real Shadow is not
         * available" in the middle of an ordinary invitation, and a snapshot that was absent
         * quietly served demo data instead.
         *
         * Private Real Shadow is a qualification configuration. It is now entered only when it is
         * explicitly asked for.
         *
         * @param isDebugBuild development builds fall back to the sanitized Shadow graph. A release
         *   build is always [NativeDataEnvironment.PRODUCTION] — launch inputs are ignored — which
         *   the repository factory currently refuses, loudly and on purpose. Refusing to start is the correct behaviour
         *   for a release build with no live data path; silently showing a real guest demo data is
         *   not.
         */
        fun resolve(
            rawEnvironment: String?,
            shadowBaseUrl: String?,
            isDebugBuild: Boolean = true
        ): NativeLaunchConfiguration {
            // A release binary is Production, whatever it is launched with. The environment extra
            // is a qualification input, and MainActivity is exported: honouring it in a release
            // build left the Play identity check in the repository factory as the only thing
            // between an arbitrary intent and a Shadow runtime (master plan §8.10).
            if (!isDebugBuild) {
                return NativeLaunchConfiguration(environment = NativeDataEnvironment.PRODUCTION)
            }
            val environment = when (rawEnvironment?.trim()?.lowercase()) {
                "private_real_shadow", "private-real-shadow", "private_shadow", "private" ->
                    NativeDataEnvironment.PRIVATE_REAL_SHADOW
                "sanitized_shadow", "sanitized-shadow" -> NativeDataEnvironment.SANITIZED_SHADOW
                "shadow" -> NativeDataEnvironment.SHADOW
                "production_read_verify", "production-read-verify" ->
                    NativeDataEnvironment.PRODUCTION_READ_VERIFY
                "production" -> NativeDataEnvironment.PRODUCTION
                "fixture" -> NativeDataEnvironment.FIXTURE
                else -> NativeDataEnvironment.SANITIZED_SHADOW
            }
            return NativeLaunchConfiguration(environment = environment, baseUrl = shadowBaseUrl)
        }
    }
}
