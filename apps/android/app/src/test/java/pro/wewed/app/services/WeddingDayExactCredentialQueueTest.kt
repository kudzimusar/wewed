package pro.wewed.app.services

import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import pro.wewed.app.models.CheckInStatus
import pro.wewed.app.models.CheckInVerificationResult
import pro.wewed.app.navigation.GateOperationalContext
import java.io.File
import java.io.IOException
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.time.Instant
import java.util.Base64
import java.util.TimeZone

/**
 * LQR01 — the offline Gate queue retains the exact scanned WW2 credential and nothing weaker.
 *
 * A queued admission is only ever reconciled by presenting the exact token the usher scanned; the
 * server re-verifies it. A record that cannot present that token (pre-v2 count-only, pre-LQR01
 * serial-only, or a vault that lost the token) is blocked for operator resolution, never sent and
 * never silently trusted. The bearer token lives only in the secure vault, never in the cache file.
 */
class WeddingDayExactCredentialQueueTest {
    private val weddingId = "wedding-1"
    private val shortId = "wedts26"
    private val serial = "WWABC1234"
    private val signer = Ww2TestSigner()
    private val token = signer.token(shortId, serial)
    private val generatedAt = "2026-09-26T00:00:00.000Z"

    private lateinit var dir: File
    private lateinit var vault: InMemorySecureStorage

    private val gateContext = GateOperationalContext(
        grantId = "gate_operator:wedding-1:gate-1",
        assignmentId = "assignment-1",
        weddingId = weddingId,
        weddingTitle = "Doe Wedding",
        gateId = "gate-1",
        gateName = "Gate A",
        operatorUserId = "usher-1",
        capabilities = setOf("gate.manifest.read", "gate.checkin.write")
    )

    /** Records every POST and answers from a scripted queue; an empty queue answers 200. */
    private class ScriptedTransport(vararg replies: () -> WeddingDayHttpResponse) : WeddingDayHttpTransport {
        private val script = ArrayDeque(replies.toList())
        val bodies = mutableListOf<String>()

        override suspend fun get(path: String, headers: Map<String, String>): WeddingDayHttpResponse =
            error("GET not used")

        override suspend fun post(path: String, headers: Map<String, String>, body: String): WeddingDayHttpResponse {
            bodies += body
            val next = script.removeFirstOrNull() ?: { WeddingDayHttpResponse(200, """{"success":true}""") }
            return next()
        }
    }

    @Before
    fun setUp() {
        dir = Files.createTempDirectory("wewed-android-lqr01").toFile()
        vault = InMemorySecureStorage()
    }

    @After
    fun tearDown() {
        dir.deleteRecursively()
    }

    private fun store(credentialVault: SecureStorage = vault) =
        OfflineManifestStore(dir, deviceId = "android-gate-a", credentialVault = credentialVault)

    private fun manifestItem() = GuestManifestItem(
        id = "guest-1",
        serial = serial,
        guestName = "Doe Household",
        partySize = 2,
        eventBitmask = 0x0e,
        signingKeyId = "key-v1",
        nonce = "66f001ab",
        attendeeKeys = listOf("primary", "plus-one"),
        eligible = true,
        expiresAt = "2099-09-18T00:00:00.000Z"
    )

    private suspend fun trustStore(
        generated: String = generatedAt,
        expires: String = "2099-09-18T00:00:00.000Z"
    ) = WeddingDayManifestTrustStore().apply {
        save(
            VerifiedWeddingDayManifestTrust(
                weddingId = weddingId,
                weddingShortId = shortId,
                eventKey = "wedding-day",
                generatedAt = generated,
                expiresAt = expires,
                rootKeyId = "root-v1",
                keys = listOf(
                    WeddingDayManifestKey(
                        keyId = "key-v1",
                        algorithm = "ECDSA_P256_SHA256",
                        publicKeyDerBase64 = signer.publicKeyDerBase64,
                        status = "active",
                        activeFrom = "2026-09-01T00:00:00.000Z"
                    )
                )
            )
        )
    }

    private fun service(transport: WeddingDayHttpTransport) =
        WeddingDaySyncService(transport, trustedRootPublicKeyDerBase64 = "unused")

    private suspend fun sync(
        store: OfflineManifestStoreProtocol,
        transport: WeddingDayHttpTransport,
        trust: WeddingDayManifestTrustStore
    ) = service(transport).syncPendingCheckIns(
        bearerToken = "native-session",
        weddingId = weddingId,
        grantId = gateContext.grantId,
        offlineStore = store,
        trustStore = trust
    )

    private fun cacheFileText(): String =
        dir.walkTopDown().filter { it.isFile }.joinToString("\n") { it.readText() }

    private fun b64(value: String): String = Base64.getUrlEncoder().withoutPadding()
        .encodeToString(value.toByteArray(StandardCharsets.UTF_8))

    private fun millis(iso: String): Long = Instant.parse(iso).toEpochMilli()

    // --- Recording ----------------------------------------------------------------------------

    @Test
    fun recordOfflineCheckInKeepsTheExactTokenOnlyInTheVault() = runBlocking {
        val store = store()
        store.saveManifest(weddingId, listOf(manifestItem()))

        val result = store.recordOfflineCheckIn(weddingId, token, 1)
        assertEquals(CheckInStatus.PARTIAL_CHECKED_IN, result.status)
        assertFalse(result.gateMessage.contains(token))

        val record = store.getPendingCheckIns(weddingId).single()
        assertEquals(serial, record.passSerial)
        assertEquals(listOf("primary"), record.attendeeKeys)
        assertEquals("ww2.offline.${record.id}", record.credentialRef)
        assertNull(record.rejectionCode)
        assertEquals(token, vault.get(record.credentialRef!!))
        assertEquals(token, store.credential(record))
        assertEquals(
            QueuedCheckInReconciliation.EXACT_CREDENTIAL,
            QueuedCheckInReconciliation.classify(record, store.credential(record))
        )

        // The durable cache holds queue metadata and the vault key, never the bearer token —
        // neither raw nor in the cache's own field encoding.
        val cache = cacheFileText()
        val signature = token.substringAfterLast('.')
        assertFalse("cache must not contain the WW2 token", cache.contains(token))
        assertFalse("cache must not contain the token signature", cache.contains(signature))
        assertFalse("cache must not contain the encoded token", cache.contains(b64(token)))
        assertTrue(cache.contains(b64(record.credentialRef!!)))

        // V3 queue line: the 12 V2 columns (ending "v2"), then credentialRef, rejectionCode, "v3".
        val queueLine = cache.lineSequence().single { it.startsWith("Q|") }.split('|')
        assertEquals(15, queueLine.size)
        assertEquals("v2", queueLine[11])
        assertEquals("v3", queueLine[14])
    }

    @Test
    fun anUnreadableOrNonWw2CredentialIsNeverAdmittedOrQueued() = runBlocking {
        val store = store()
        store.saveManifest(weddingId, listOf(manifestItem()))
        val ww1 = "WW1.$shortId.$serial.0e.66f001ab.0123456789abcdef0123456789abcdef"

        for (candidate in listOf("not-a-token", serial, ww1)) {
            val result = store.recordOfflineCheckIn(weddingId, candidate, 1)
            assertEquals(CheckInStatus.INVALID_PASS, result.status)
        }
        assertTrue(store.getPendingCheckIns(weddingId).isEmpty())
        assertEquals(emptyList<String>(), store.lookupBySerial(weddingId, serial)!!.checkedInAttendeeKeys)
    }

    @Test
    fun aVaultThatCannotSecureTheTokenAdmitsNobody() = runBlocking {
        val failingVault = object : SecureStorage {
            override fun save(key: String, value: String) = throw IllegalStateException("keystore unavailable")
            override fun get(key: String): String? = null
            override fun delete(key: String) = Unit
            override fun clear() = Unit
        }
        val store = store(failingVault)
        store.saveManifest(weddingId, listOf(manifestItem()))

        val result = store.recordOfflineCheckIn(weddingId, token, 1)
        assertEquals(CheckInStatus.INVALID_PASS, result.status)
        assertTrue(store.getPendingCheckIns(weddingId).isEmpty())
        assertEquals(emptyList<String>(), store.lookupBySerial(weddingId, serial)!!.checkedInAttendeeKeys)
    }

    // --- Gate → queue → sync ------------------------------------------------------------------

    @Test
    fun theGatePassesTheScannedTokenAndSyncPostsItByteForByte() = runBlocking {
        val store = store()
        store.saveManifest(weddingId, listOf(manifestItem()))
        val trust = trustStore()
        val transport = ScriptedTransport()
        val gate = ManifestBackedWeddingDayGate("native-session", gateContext, store, trust, service(transport))

        val admitted = gate.checkIn(token, 1)
        assertEquals(CheckInStatus.PARTIAL_CHECKED_IN, admitted.status)
        val record = store.getPendingCheckIns(weddingId).single()

        val result = gate.reconcilePending()
        assertEquals(listOf(record.id), result.syncedIds)
        assertTrue(result.failedIds.isEmpty())
        assertTrue(result.blockedLegacyIds.isEmpty())
        assertTrue(result.rejectedIds.isEmpty())

        val body = JSONObject(transport.bodies.single())
        assertEquals(token, body.getString("token"))
        assertEquals(listOf("primary"), List(body.getJSONArray("attendeeKeys").length()) {
            body.getJSONArray("attendeeKeys").getString(it)
        })
        assertEquals(record.id, body.getString("clientEventId"))
        assertEquals("android-gate-a", body.getString("deviceId"))
        assertFalse("serial-only admission is unsupported", body.has("passSerial"))
        for (forbidden in listOf("guestId", "weddingId", "gateId", "usherId", "operatorUserId", "source", "eventKey")) {
            assertFalse("offline sync must not submit $forbidden", body.has(forbidden))
        }

        // Synced: the credential is no longer retained and nothing is re-sent.
        assertNull(vault.get(record.credentialRef!!))
        assertTrue(store.getPendingCheckIns(weddingId).isEmpty())
        val again = gate.reconcilePending()
        assertTrue(again.syncedIds.isEmpty())
        assertEquals(1, transport.bodies.size)
    }

    @Test
    fun aResendAfterALostResponseReusesTheSameClientEventId() = runBlocking {
        val store = store()
        store.saveManifest(weddingId, listOf(manifestItem()))
        store.recordOfflineCheckIn(weddingId, token, 2)
        val record = store.getPendingCheckIns(weddingId).single()
        val trust = trustStore()
        val transport = ScriptedTransport(
            { throw IOException("response lost after the server applied it") },
            { WeddingDayHttpResponse(200, """{"success":true,"duplicate":true}""") }
        )

        val first = sync(store, transport, trust)
        assertEquals(listOf(record.id), first.failedIds)
        assertEquals(token, vault.get(record.credentialRef!!))

        val second = sync(store, transport, trust)
        assertEquals(listOf(record.id), second.syncedIds)
        assertEquals(2, transport.bodies.size)
        val bodies = transport.bodies.map(::JSONObject)
        assertEquals(bodies[0].getString("clientEventId"), bodies[1].getString("clientEventId"))
        assertEquals(token, bodies[1].getString("token"))
        assertNull(vault.get(record.credentialRef!!))
    }

    @Test
    fun aTerminalRejectionIsRecordedAndNeverResent() = runBlocking {
        var store = store()
        store.saveManifest(weddingId, listOf(manifestItem()))
        store.recordOfflineCheckIn(weddingId, token, 1)
        val record = store.getPendingCheckIns(weddingId).single()
        val trust = trustStore()
        val transport = ScriptedTransport({
            WeddingDayHttpResponse(
                400,
                """{"success":false,"code":"PASS_REVOKED_OR_EXPIRED","error":"PASS_REVOKED_OR_EXPIRED"}"""
            )
        })

        val result = sync(store, transport, trust)
        assertEquals(listOf(record.id), result.rejectedIds)
        assertTrue(result.failedIds.isEmpty())
        assertTrue(result.syncedIds.isEmpty())
        assertNull(vault.get(record.credentialRef!!))
        assertTrue(store.getPendingCheckIns(weddingId).isEmpty())

        // The rejection is durable: a restarted store still does not resend it.
        store = store()
        assertTrue(store.getPendingCheckIns(weddingId).isEmpty())
        val next = sync(store, transport, trust)
        assertTrue(next.syncedIds.isEmpty() && next.failedIds.isEmpty() && next.rejectedIds.isEmpty())
        assertEquals(1, transport.bodies.size)
    }

    @Test
    fun everyTerminalCodeIsRejectedButOtherRefusalsStayRetryable() = runBlocking {
        val terminal = listOf(
            "PASS_NOT_FOUND", "PASS_REVOKED_OR_EXPIRED", "INVALID_PASS_TOKEN", "PASS_WEDDING_MISMATCH",
            "PASS_EVENT_NOT_PERMITTED", "PASS_SIGNATURE_INVALID", "PASS_CREDENTIAL_MISMATCH",
            "PASS_TOKEN_REQUIRED", "SERIAL_ONLY_ADMISSION_UNSUPPORTED", "GUEST_INELIGIBLE", "INVALID_ATTENDEE_KEY"
        )
        assertEquals(terminal.toSet(), WeddingDaySyncService.TERMINAL_CHECK_IN_REJECTION_CODES)

        val trust = trustStore()
        for (code in terminal) {
            val store = OfflineManifestStore(credentialVault = InMemorySecureStorage())
            store.saveManifest(weddingId, listOf(manifestItem()))
            store.recordOfflineCheckIn(weddingId, token, 1)
            val transport = ScriptedTransport({
                WeddingDayHttpResponse(400, """{"success":false,"code":"$code","error":"$code"}""")
            })
            val result = sync(store, transport, trust)
            assertEquals("$code must be terminal", 1, result.rejectedIds.size)
        }
    }

    @Test
    fun retryableFailuresStayPendingWithTheirCredential() = runBlocking {
        val store = store()
        store.saveManifest(weddingId, listOf(manifestItem()))
        store.recordOfflineCheckIn(weddingId, token, 1)
        val record = store.getPendingCheckIns(weddingId).single()
        val trust = trustStore()
        val transport = ScriptedTransport(
            { WeddingDayHttpResponse(500, """{"success":false,"code":"INTERNAL"}""") },
            { throw IOException("offline") },
            { WeddingDayHttpResponse(400, """{"success":false,"code":"PASS_SIGNING_KEY_INACTIVE","error":"PASS_SIGNING_KEY_INACTIVE"}""") },
            { WeddingDayHttpResponse(400, """{"success":false,"code":"GATE_INACTIVE_OR_INVALID"}""") },
            { WeddingDayHttpResponse(401, "") },
            { WeddingDayHttpResponse(403, """{"success":false,"code":"PASS_REVOKED_OR_EXPIRED"}""") },
            { WeddingDayHttpResponse(409, "") },
            { WeddingDayHttpResponse(429, "not json") }
        )

        repeat(8) {
            val result = sync(store, transport, trust)
            assertEquals(listOf(record.id), result.failedIds)
            assertTrue(result.rejectedIds.isEmpty())
            assertEquals(record.id, store.getPendingCheckIns(weddingId).single().id)
            assertEquals(token, vault.get(record.credentialRef!!))
        }
        assertEquals(8, transport.bodies.size)
    }

    // --- Legacy and unavailable credentials fail closed -----------------------------------------

    @Test
    fun legacySerialOnlyAndCountOnlyRecordsAreBlockedAndNeverSent() = runBlocking {
        // A queue written before LQR01 (V2 lines, 12 columns) — the exact credential was never kept.
        val serialOnly = listOf(
            "Q", b64(weddingId), b64("legacy-serial-only"), b64(serial), b64("guest-1"), "1",
            "1000", b64(""), "false", b64("primary"), b64("android-gate-a"), "v2"
        ).joinToString("|")
        val countOnly = listOf(
            "Q", b64(weddingId), b64("legacy-count-only"), b64(serial), b64("guest-1"), "2",
            "2000", b64("usher-1"), "false", "-", "-", "v2"
        ).joinToString("|")
        File(dir, "wewed_offline_manifest.json").writeText("WEWED_OFFLINE_V2\n$serialOnly\n$countOnly\n")

        val store = store()
        val pending = store.getPendingCheckIns(weddingId)
        assertEquals(setOf("legacy-serial-only", "legacy-count-only"), pending.map { it.id }.toSet())
        assertEquals(
            QueuedCheckInReconciliation.LEGACY_SERIAL_ONLY,
            QueuedCheckInReconciliation.classify(pending.single { it.id == "legacy-serial-only" }, null)
        )
        assertEquals(
            QueuedCheckInReconciliation.LEGACY_COUNT_ONLY,
            QueuedCheckInReconciliation.classify(pending.single { it.id == "legacy-count-only" }, null)
        )

        val transport = ScriptedTransport()
        val result = sync(store, transport, trustStore())
        assertEquals(setOf("legacy-serial-only", "legacy-count-only"), result.blockedLegacyIds.toSet())
        assertTrue(result.syncedIds.isEmpty())
        assertTrue("legacy records must never be sent", transport.bodies.isEmpty())
        // Left visible for operator resolution, not silently dropped or trusted.
        assertEquals(2, store.getPendingCheckIns(weddingId).size)
    }

    @Test
    fun aCredentialRefWhoseVaultEntryIsGoneIsBlocked() = runBlocking {
        store().apply {
            saveManifest(weddingId, listOf(manifestItem()))
            recordOfflineCheckIn(weddingId, token, 1)
        }

        // Reinstall / wiped keystore: the queue survives, the vault does not.
        val store = store(InMemorySecureStorage())
        val record = store.getPendingCheckIns(weddingId).single()
        assertNotNull(record.credentialRef)
        assertNull(store.credential(record))

        val transport = ScriptedTransport()
        val result = sync(store, transport, trustStore())
        assertEquals(listOf(record.id), result.blockedLegacyIds)
        assertTrue(transport.bodies.isEmpty())
        assertEquals(1, store.getPendingCheckIns(weddingId).size)
    }

    @Test
    fun classificationRequiresAWw2TokenForTheRecordedSerial() {
        val record = QueuedCheckIn(
            id = "event-1",
            weddingId = weddingId,
            passSerial = serial,
            guestId = "guest-1",
            count = 1,
            usherId = "",
            attendeeKeys = listOf("primary"),
            credentialRef = "ww2.offline.event-1"
        )
        assertEquals(QueuedCheckInReconciliation.EXACT_CREDENTIAL, QueuedCheckInReconciliation.classify(record, token))
        assertEquals(QueuedCheckInReconciliation.CREDENTIAL_UNAVAILABLE, QueuedCheckInReconciliation.classify(record, null))
        assertEquals(
            QueuedCheckInReconciliation.CREDENTIAL_UNAVAILABLE,
            QueuedCheckInReconciliation.classify(record, signer.token(shortId, "WWOTHER99"))
        )
        assertEquals(
            QueuedCheckInReconciliation.CREDENTIAL_UNAVAILABLE,
            QueuedCheckInReconciliation.classify(record, "WW1.$shortId.$serial.0e.66f001ab.00")
        )
        assertEquals(QueuedCheckInReconciliation.CREDENTIAL_UNAVAILABLE, QueuedCheckInReconciliation.classify(record, "garbage"))
    }

    @Test
    fun aRestartedStoreWithTheSameVaultStillSyncsTheExactToken() = runBlocking {
        store().apply {
            saveManifest(weddingId, listOf(manifestItem()))
            recordOfflineCheckIn(weddingId, token, 2)
        }

        val restarted = store()
        val record = restarted.getPendingCheckIns(weddingId).single()
        assertEquals("ww2.offline.${record.id}", record.credentialRef)

        val transport = ScriptedTransport()
        val result = sync(restarted, transport, trustStore())
        assertEquals(listOf(record.id), result.syncedIds)
        val body = JSONObject(transport.bodies.single())
        assertEquals(token, body.getString("token"))
        assertEquals(record.id, body.getString("clientEventId"))
        assertFalse(body.has("passSerial"))
    }

    @Test
    fun clearingAWeddingAlsoDeletesItsQueuedCredentials() = runBlocking {
        val store = store()
        store.saveManifest(weddingId, listOf(manifestItem()))
        store.recordOfflineCheckIn(weddingId, token, 1)
        val ref = store.getPendingCheckIns(weddingId).single().credentialRef!!
        assertEquals(token, vault.get(ref))

        store.clearManifest(weddingId)
        assertNull(vault.get(ref))
        assertTrue(store.getPendingCheckIns(weddingId).isEmpty())
    }

    // --- Offline authority observability ------------------------------------------------------

    @Test
    fun authorityStatusReportsAgeStalenessAndExpiryWithoutBlocking() = runBlocking {
        val store = store()
        store.saveManifest(weddingId, listOf(manifestItem()))
        val trust = trustStore(expires = "2026-09-26T12:00:00.000Z")
        val gate = ManifestBackedWeddingDayGate("native-session", gateContext, store, trust, service(ScriptedTransport()))
        val generated = millis(generatedAt)

        val fresh = gate.authorityStatus(generated + 10 * 60_000L)!!
        assertEquals(600L, fresh.ageSeconds)
        assertFalse(fresh.isStale)
        assertFalse(fresh.isExpired)
        assertTrue(fresh.relyingOnCachedAuthority)
        assertEquals(generated, fresh.generatedAt.time)
        assertEquals(millis("2026-09-26T12:00:00.000Z"), fresh.expiresAt.time)

        val threeHours = gate.authorityStatus(generated + 3 * 3_600_000L)!!
        assertEquals(3 * 3_600L, threeHours.ageSeconds)
        assertTrue(threeHours.isStale)
        assertFalse(threeHours.isExpired)
        assertEquals(
            "Offline authority · generated 00:00 · expires 12:00 · age 3h (stale)",
            threeHours.summaryLine(TimeZone.getTimeZone("UTC"))
        )

        val expired = gate.authorityStatus(generated + 13 * 3_600_000L)!!
        assertTrue(expired.isExpired)
        assertTrue(expired.isStale)
        assertTrue(expired.summaryLine(TimeZone.getTimeZone("UTC")).endsWith("(expired)"))

        assertEquals(2 * 60 * 60L, WeddingDayAuthorityStatus.STALE_AFTER_SECONDS)
        assertTrue(WeddingDayAuthorityStatus.CACHED_AUTHORITY_NOTICE.contains("cached list"))
    }

    @Test
    fun authorityStatusIsAbsentWithoutVerifiedTrustAndDefaultsToNull() = runBlocking {
        val gate = ManifestBackedWeddingDayGate(
            "native-session", gateContext, store(), WeddingDayManifestTrustStore(), service(ScriptedTransport())
        )
        assertNull(gate.authorityStatus(System.currentTimeMillis()))

        val legacyFake = object : WeddingDayGateOperations {
            override val gateContext: GateOperationalContext = this@WeddingDayExactCredentialQueueTest.gateContext
            override suspend fun refreshManifest() = Unit
            override suspend fun checkIn(qrPayload: String, count: Int): CheckInVerificationResult = error("unused")
            override suspend fun reconcilePending(): WeddingDaySyncResult = WeddingDaySyncResult(emptyList(), emptyList(), emptyList())
            override suspend fun revokePass(passSerial: String, reason: String): WeddingDayRevokeResult = error("unused")
        }
        assertNull(legacyFake.authorityStatus(System.currentTimeMillis()))
        assertTrue(legacyFake.reconcilePending().rejectedIds.isEmpty())
    }
}
