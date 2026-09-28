package pro.wewed.app.state

import pro.wewed.app.models.NativeDataEnvironment

data class NativeLaunchConfiguration(
    val environment: NativeDataEnvironment,
    val baseUrl: String? = null,
    /** The server the real production clients use. Always [NativeServerLane.Production] in release. */
    val lane: NativeServerLane = NativeServerLane.Production,
    /**
     * Set when a DEBUG `production_preview` launch named no, or an unapproved, origin. The app then
     * builds nothing: it never silently falls back to https://wewed.pro, because a qualifier who
     * believes they are on Preview would otherwise act on live production data.
     */
    val previewOriginRejection: NativePreviewOriginRejection? = null
) {
    companion object {
        /** The release/production launch: https://wewed.pro, and nothing else. */
        val PRODUCTION = NativeLaunchConfiguration(
            environment = NativeDataEnvironment.PRODUCTION,
            baseUrl = NativeServerOrigin.PRODUCTION,
            lane = NativeServerLane.Production
        )

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
            isDebugBuild: Boolean = true,
            previewOrigin: String? = null,
            previewProtectionBypass: String? = null
        ): NativeLaunchConfiguration {
            // A release binary is Production, whatever it is launched with. The environment extra
            // is a qualification input, and MainActivity is exported: honouring it in a release
            // build left the Play identity check in the repository factory as the only thing
            // between an arbitrary intent and a Shadow runtime (master plan §8.10).
            if (!isDebugBuild) {
                return PRODUCTION
            }
            when (rawEnvironment?.trim()?.lowercase()) {
                // Real production authority at the one production origin; the Shadow base URL
                // input never applies to production.
                "production" -> return PRODUCTION
                // DEBUG qualification lane: the exact production clients and authority rules
                // against one allowlisted Preview origin. Not Shadow, not Fixture, never a persona.
                "production_preview", "production-preview" ->
                    return when (val validation = NativeServerOrigin.validatePreviewOrigin(previewOrigin)) {
                        is NativePreviewOriginValidation.Accepted -> NativeLaunchConfiguration(
                            environment = NativeDataEnvironment.PRODUCTION,
                            baseUrl = validation.origin,
                            lane = NativeServerLane.ProductionPreview(
                                origin = validation.origin,
                                protectionBypass = NativePreviewProtectionBypass.of(previewProtectionBypass)
                            )
                        )
                        is NativePreviewOriginValidation.Rejected -> NativeLaunchConfiguration(
                            environment = NativeDataEnvironment.PRODUCTION,
                            baseUrl = null,
                            lane = NativeServerLane.Production,
                            previewOriginRejection = validation.reason
                        )
                    }
            }
            val environment = when (rawEnvironment?.trim()?.lowercase()) {
                "private_real_shadow", "private-real-shadow", "private_shadow", "private" ->
                    NativeDataEnvironment.PRIVATE_REAL_SHADOW
                "sanitized_shadow", "sanitized-shadow" -> NativeDataEnvironment.SANITIZED_SHADOW
                "shadow" -> NativeDataEnvironment.SHADOW
                "production_read_verify", "production-read-verify" ->
                    NativeDataEnvironment.PRODUCTION_READ_VERIFY
                "fixture" -> NativeDataEnvironment.FIXTURE
                else -> NativeDataEnvironment.SANITIZED_SHADOW
            }
            return NativeLaunchConfiguration(environment = environment, baseUrl = shadowBaseUrl)
        }
    }
}
