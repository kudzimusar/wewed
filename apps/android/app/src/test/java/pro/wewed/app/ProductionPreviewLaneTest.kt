package pro.wewed.app

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import pro.wewed.app.invitation.GuestSessionClient
import pro.wewed.app.invitation.InvitationEntryParser
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.InMemorySecureStorage
import pro.wewed.app.state.AppViewModel
import pro.wewed.app.state.NativeLaunchConfiguration
import pro.wewed.app.state.NativePreviewOriginRejection
import pro.wewed.app.state.NativePreviewOriginValidation
import pro.wewed.app.state.NativePreviewProtectionBypass
import pro.wewed.app.state.NativeServerLane
import pro.wewed.app.state.NativeServerOrigin

/**
 * P13-LIVE-2 — DEBUG-only productionPreview on Android (QRO 01 §10, §27). Must be exactly as
 * strict as iOS: same allowlist, same fail-closed rejection, Release pinned to https://wewed.pro.
 */
class ProductionPreviewLaneTest {
    private val preview = "https://wewed-git-integration-phase13-live-11-11.vercel.app"

    @After
    fun resetLane() = NativeServerOrigin.activate(NativeServerLane.Production)

    private fun debugPreview(origin: String?, bypass: String? = null) = NativeLaunchConfiguration.resolve(
        rawEnvironment = "production_preview",
        shadowBaseUrl = null,
        isDebugBuild = true,
        previewOrigin = origin,
        previewProtectionBypass = bypass
    )

    @Test
    fun approvedPreviewAndLoopbackOriginsAreAccepted() {
        mapOf(
            preview to preview,
            "https://wewed-6tu6k3pyc-11-11.vercel.app/" to "https://wewed-6tu6k3pyc-11-11.vercel.app",
            "HTTPS://WEWED-6TU6K3PYC-11-11.VERCEL.APP" to "https://wewed-6tu6k3pyc-11-11.vercel.app",
            "http://127.0.0.1:3000" to "http://127.0.0.1:3000",
            "http://localhost:3000" to "http://localhost:3000"
        ).forEach { (raw, expected) ->
            assertEquals(raw, NativePreviewOriginValidation.Accepted(expected), NativeServerOrigin.validatePreviewOrigin(raw))
        }
    }

    @Test
    fun arbitraryMalformedInsecureAndProductionOriginsAreRejected() {
        listOf(
            null to NativePreviewOriginRejection.Missing,
            "   " to NativePreviewOriginRejection.Missing,
            "not a url" to NativePreviewOriginRejection.Malformed,
            "https://evil.example" to NativePreviewOriginRejection.HostNotAllowlisted("evil.example"),
            "https://wewed-x-11-11.vercel.app.evil.example" to
                NativePreviewOriginRejection.HostNotAllowlisted("wewed-x-11-11.vercel.app.evil.example"),
            "https://other-x-11-11.vercel.app" to NativePreviewOriginRejection.HostNotAllowlisted("other-x-11-11.vercel.app"),
            "https://wewed-x-22-22.vercel.app" to NativePreviewOriginRejection.HostNotAllowlisted("wewed-x-22-22.vercel.app"),
            "https://wewed-x-11-11.vercel.app:8443" to NativePreviewOriginRejection.HostNotAllowlisted("wewed-x-11-11.vercel.app"),
            "http://wewed-x-11-11.vercel.app" to NativePreviewOriginRejection.InsecureScheme,
            "ftp://127.0.0.1" to NativePreviewOriginRejection.InsecureScheme,
            "https://wewed.pro" to NativePreviewOriginRejection.ProductionHost,
            "https://www.wewed.pro" to NativePreviewOriginRejection.ProductionHost,
            "https://api.wewed.pro" to NativePreviewOriginRejection.ProductionHost,
            "https://user:pw@wewed-x-11-11.vercel.app" to NativePreviewOriginRejection.UnexpectedComponents,
            "https://wewed-x-11-11.vercel.app/api" to NativePreviewOriginRejection.UnexpectedComponents,
            "https://wewed-x-11-11.vercel.app?x=1" to NativePreviewOriginRejection.UnexpectedComponents
        ).forEach { (raw, reason) ->
            assertEquals(raw.toString(), NativePreviewOriginValidation.Rejected(reason), NativeServerOrigin.validatePreviewOrigin(raw))
        }
    }

    @Test
    fun debugProductionPreviewUsesRealProductionAuthorityAtThePreviewOrigin() {
        val config = debugPreview(preview)
        assertEquals(NativeDataEnvironment.PRODUCTION, config.environment)
        assertEquals(preview, config.baseUrl)
        assertEquals(NativeServerLane.ProductionPreview(preview, null), config.lane)
        assertNull(config.previewOriginRejection)
        assertFalse("no persona switching", config.environment.allowsDevelopmentPersonaSwitching)
        assertFalse("no Shadow/fixture", config.environment.allowsMutableNativeDevelopment)

        val viewModel = AppViewModel.fromEnvironment(config.environment, config.baseUrl)
        assertEquals(NativeDataEnvironment.PRODUCTION, viewModel.dataEnvironment)
        assertEquals(preview, viewModel.dataBaseUrl)
    }

    @Test
    fun anUnapprovedPreviewOriginFailsClosedInsteadOfFallingBackToProduction() {
        listOf(null, "https://evil.example", "http://wewed-x-11-11.vercel.app", "https://wewed.pro").forEach { raw ->
            val config = debugPreview(raw)
            assertNotNull(raw.toString(), config.previewOriginRejection)
            assertNull("a rejected Preview launch must not resolve any server", config.baseUrl)
            assertEquals(NativeServerLane.Production, config.lane)
        }
    }

    @Test
    fun releaseIgnoresEveryPreviewInputAndStaysOnWewedPro() {
        listOf("production_preview", "production", "shadow", null).forEach { raw ->
            listOf(preview, "https://evil.example", null).forEach { origin ->
                val config = NativeLaunchConfiguration.resolve(
                    rawEnvironment = raw,
                    shadowBaseUrl = "https://evil.example",
                    isDebugBuild = false,
                    previewOrigin = origin,
                    previewProtectionBypass = "release-must-ignore"
                )
                assertEquals(NativeLaunchConfiguration.PRODUCTION, config)
                assertEquals("https://wewed.pro", config.baseUrl)
                assertEquals("https://wewed.pro", config.lane.origin)
                assertNull(config.previewOriginRejection)
            }
        }
    }

    /** The release defect this unit closes: production resolved `baseUrl == null`, so RootScreen
     * never bound a NativeDomainApiClient and the real domain data could not load. */
    @Test
    fun productionAlwaysResolvesTheProductionOriginForDomainClients() {
        listOf(false, true).forEach { isDebugBuild ->
            val config = NativeLaunchConfiguration.resolve("production", "http://127.0.0.1:9", isDebugBuild)
            assertEquals("https://wewed.pro", config.baseUrl)
            assertEquals("https://wewed.pro", AppViewModel.fromEnvironment(config.environment, config.baseUrl).dataBaseUrl)
        }
    }

    @Test
    fun guestOverrideIsConstrainedByTheSameQualificationPolicy() {
        val lane = debugPreview(preview).lane
        // Release: always the lane origin, whatever the extra says.
        assertEquals(
            NativePreviewOriginValidation.Accepted("https://wewed.pro"),
            NativeServerOrigin.guestOrigin(false, "https://evil.example", NativeServerLane.Production)
        )
        // Debug without an override: the lane origin, i.e. the same origin as the account client.
        assertEquals(NativePreviewOriginValidation.Accepted(preview), NativeServerOrigin.guestOrigin(true, null, lane))
        // Debug loopback stub still works; an arbitrary host (previously accepted) is now refused.
        assertEquals(
            NativePreviewOriginValidation.Accepted("http://127.0.0.1:8787"),
            NativeServerOrigin.guestOrigin(true, "http://127.0.0.1:8787", lane)
        )
        assertEquals(
            NativePreviewOriginValidation.Rejected(NativePreviewOriginRejection.HostNotAllowlisted("evil.example")),
            NativeServerOrigin.guestOrigin(true, "https://evil.example", lane)
        )
    }

    @Test
    fun guestAndAccountClientsShareOneOriginAndSeparateStorage() {
        val config = debugPreview(preview)
        NativeServerOrigin.activate(config.lane)
        assertEquals(config.baseUrl, NativeServerOrigin.active.origin)
        assertEquals(
            NativePreviewOriginValidation.Accepted(config.baseUrl!!),
            NativeServerOrigin.guestOrigin(true, null, NativeServerOrigin.active)
        )
        assertEquals("wewed_secure_account_session_production_preview", config.lane.storageName("wewed_secure_account_session"))
        assertEquals("wewed_secure_session_production_preview", config.lane.storageName("wewed_secure_session"))
        assertEquals("wewed_secure_session", NativeServerLane.Production.storageName("wewed_secure_session"))
    }

    @Test
    fun protectionBypassIsSentOnlyToThePreviewOriginAndIsNeverPrinted() {
        val config = debugPreview(preview, bypass = "s3cr3t-bypass-value")
        val lane = config.lane as NativeServerLane.ProductionPreview
        listOf(config.toString(), lane.toString(), lane.protectionBypass.toString()).forEach {
            assertFalse("secret leaked into: $it", it.contains("s3cr3t-bypass-value"))
        }
        assertEquals(
            mapOf(NativePreviewProtectionBypass.HEADER_NAME to "s3cr3t-bypass-value"),
            lane.additionalHeaders("$preview/api/native/account/authority")
        )
        assertTrue(lane.additionalHeaders("https://wewed.pro/api/native/account/authority").isEmpty())
        assertTrue(lane.additionalHeaders("$preview.evil.example/api").isEmpty())
        assertTrue(NativeServerLane.Production.additionalHeaders("https://wewed.pro/api/x").isEmpty())
        assertTrue(debugPreview(preview).lane.additionalHeaders("$preview/api/x").isEmpty())
    }

    @Test
    fun previewHostIsAWeddingHostOnlyWhileThePreviewLaneIsActive() {
        val link = "$preview/invite/charity-and-kudzie?rsvp=TOKEN"
        NativeServerOrigin.activate(NativeServerLane.Production)
        assertNull(InvitationEntryParser.fromUrl(link))
        assertNotNull(InvitationEntryParser.fromUrl("https://wewed.pro/invite/charity-and-kudzie?rsvp=TOKEN"))

        NativeServerOrigin.activate(debugPreview(preview).lane)
        assertNotNull(InvitationEntryParser.fromUrl(link))
        assertNull(
            "only the configured Preview host, not every allowlisted one",
            InvitationEntryParser.fromUrl("https://wewed-other-11-11.vercel.app/invite/s?rsvp=T")
        )
        val client = GuestSessionClient(baseUrl = preview, secureStorage = InMemorySecureStorage())
        assertEquals("charity-and-kudzie", client.weddingSlugFromResume("$preview/w/charity-and-kudzie"))
        assertNull(client.weddingSlugFromResume("https://evil.example/w/charity-and-kudzie"))
    }
}
