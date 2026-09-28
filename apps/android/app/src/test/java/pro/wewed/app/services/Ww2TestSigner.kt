package pro.wewed.app.services

import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.Base64

/**
 * LQR01 test fixture: a throwaway P-256 pass-signing key, generated per test, that mints WW2 tokens
 * the way the server does — an IEEE-P1363 (r||s) signature, hex-encoded, over the five-field
 * payload `WW2.<weddingShortId>.<passSerial>.<eventBitmask hex>.<nonce>`.
 *
 * Only the JDK's own ECDSA provider is used; there is no hand-rolled cryptography here.
 */
class Ww2TestSigner {
    private val keyPair: KeyPair = KeyPairGenerator.getInstance("EC")
        .apply { initialize(ECGenParameterSpec("secp256r1")) }
        .generateKeyPair()

    /** X.509 SubjectPublicKeyInfo, Base64 — the shape the manifest and Pass API publish. */
    val publicKeyDerBase64: String = Base64.getEncoder().encodeToString(keyPair.public.encoded)

    fun token(
        weddingShortId: String,
        passSerial: String,
        eventBitmask: Int = 0x0e,
        nonce: String = "66f001ab"
    ): String {
        val payload = "WW2.$weddingShortId.$passSerial.${String.format("%02x", eventBitmask)}.$nonce"
        val signature = Signature.getInstance("SHA256withECDSAinP1363Format").apply {
            initSign(keyPair.private)
            update(payload.toByteArray(Charsets.UTF_8))
        }.sign()
        return payload + "." + signature.joinToString("") { "%02x".format(it) }
    }
}
