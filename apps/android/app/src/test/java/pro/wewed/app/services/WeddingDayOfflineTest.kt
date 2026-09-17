package pro.wewed.app.services

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files

class WeddingDayOfflineTest {
    @Test
    fun offlineQueueSurvivesRestartWithExactAttendeeKeys() = runBlocking {
        val dir = Files.createTempDirectory("wewed-android-offline").toFile()
        try {
            val weddingId = "wedding-1"
            var store = OfflineManifestStore(dir, deviceId = "android-gate-a")
            store.saveManifest(
                weddingId,
                listOf(
                    GuestManifestItem(
                        id = "guest-1",
                        serial = "WWABC1234",
                        guestName = "Doe Household",
                        partySize = 3,
                        checkedInCount = 1,
                        tableAssignment = "Table 9",
                        eventBitmask = 0x0e,
                        signingKeyId = "key-v2",
                        nonce = "66f001ab",
                        attendeeKeys = listOf("primary", "plus-one", "child-1"),
                        checkedInAttendeeKeys = listOf("primary"),
                        eligible = true
                    )
                )
            )

            val result = store.recordOfflineCheckIn(
                weddingId = weddingId,
                serial = "WWABC1234",
                count = 1,
                usherId = "usher-1"
            )
            assertEquals(2, result.alreadyCheckedInCount)
            assertEquals(1, result.remainingCount)

            var pending = store.getPendingCheckIns(weddingId)
            assertEquals(1, pending.size)
            assertEquals(listOf("plus-one"), pending.single().attendeeKeys)
            assertEquals("android-gate-a", pending.single().deviceId)

            // Simulate process death / app restart against the same durable storage directory.
            store = OfflineManifestStore(dir, deviceId = "android-gate-a")
            val restoredGuest = store.lookupBySerial(weddingId, "WWABC1234")!!
            assertEquals(listOf("primary", "plus-one"), restoredGuest.checkedInAttendeeKeys)
            pending = store.getPendingCheckIns(weddingId)
            assertEquals(listOf("plus-one"), pending.single().attendeeKeys)
            assertFalse(pending.single().synced)

            store.markCheckInSynced(pending.single().id)
            store = OfflineManifestStore(dir, deviceId = "android-gate-a")
            assertTrue(store.getPendingCheckIns(weddingId).isEmpty())
        } finally {
            dir.deleteRecursively()
        }
    }

    @Test
    fun revokedManifestCredentialIsRejectedOffline() = runBlocking {
        val dir = Files.createTempDirectory("wewed-android-revoked").toFile()
        try {
            val store = OfflineManifestStore(dir)
            store.saveManifest(
                "wedding-1",
                listOf(
                    GuestManifestItem(
                        id = "guest-1",
                        serial = "WWREVOKED",
                        guestName = "Revoked Guest",
                        partySize = 1,
                        attendeeKeys = listOf("primary"),
                        eligible = true,
                        revokedAt = "2026-09-17T00:00:00.000Z"
                    )
                )
            )

            val result = store.recordOfflineCheckIn("wedding-1", "WWREVOKED", 1, "usher-1")
            assertEquals(pro.wewed.app.models.CheckInStatus.INVALID_PASS, result.status)
            assertTrue(store.getPendingCheckIns("wedding-1").isEmpty())
        } finally {
            dir.deleteRecursively()
        }
    }

    @Test
    fun verifiedTrustAndRotatedKeysSurviveRestart() = runBlocking {
        val dir = Files.createTempDirectory("wewed-android-trust").toFile()
        try {
            var trustStore = WeddingDayManifestTrustStore(dir)
            trustStore.save(
                VerifiedWeddingDayManifestTrust(
                    weddingId = "wedding-1",
                    weddingShortId = "abc12345",
                    eventKey = "wedding-day",
                    generatedAt = "2026-09-17T00:00:00.000Z",
                    expiresAt = "2026-09-18T00:00:00.000Z",
                    rootKeyId = "root-v1",
                    keys = listOf(
                        WeddingDayManifestKey(
                            keyId = "key-v1",
                            algorithm = "ECDSA_P256_SHA256",
                            publicKeyDerBase64 = "old-key",
                            status = "retired",
                            activeFrom = "2026-09-01T00:00:00.000Z"
                        ),
                        WeddingDayManifestKey(
                            keyId = "key-v2",
                            algorithm = "ECDSA_P256_SHA256",
                            publicKeyDerBase64 = "new-key",
                            status = "active",
                            activeFrom = "2026-09-17T00:00:00.000Z"
                        )
                    )
                )
            )

            trustStore = WeddingDayManifestTrustStore(dir)
            assertEquals("new-key", trustStore.signingKey("wedding-1", "key-v2")?.publicKeyDerBase64)
            assertEquals("old-key", trustStore.signingKey("wedding-1", "key-v1")?.publicKeyDerBase64)
        } finally {
            dir.deleteRecursively()
        }
    }

    @Test
    fun p1363VerifierAcceptsCanonicalPayloadAndRejectsTampering() {
        val publicKeyDerBase64 = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEPSF40dU2YlZRMbV5EweSiFFtJbrJmwtufFc4Bx2eJrC2erZirTgNiKFYBjAIgZsNpWDsGhWRsxToZUz+mdHSNQ=="
        val token = "WW2.wedts26.WWJD0824.0e.66f001ab.8d4ba7eca9ef156da73f31e98456a9eaae676f66e4e33d4afaeb5f36cc5f4e06d612a90d0519d343346872759e675437934043ba97fec6a763b7ae3430d6ab30"
        val parts = token.split(".")
        val payload = parts.take(5).joinToString(".")
        val signature = parts[5]

        assertTrue(TokenVerifier.verifyP1363(payload, signature, publicKeyDerBase64))
        assertFalse(TokenVerifier.verifyP1363(payload + "tampered", signature, publicKeyDerBase64))
    }
}
