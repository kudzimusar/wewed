package pro.wewed.app.services

import java.io.ByteArrayOutputStream
import java.security.KeyFactory
import java.security.PublicKey
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

data class ParsedQRToken(
    val version: String,
    val weddingShortId: String,
    val passSerial: String,
    val eventBitmask: Int,
    val nonce: String,
    val signature: String
)

sealed class TokenVerificationResult {
    data class Success(val token: ParsedQRToken) : TokenVerificationResult()
    data class Failure(val reason: String) : TokenVerificationResult()
}

object TokenVerifier {
    fun parse(token: String): TokenVerificationResult {
        val parts = token.trim().split(".")
        if (parts.size != 6) {
            return TokenVerificationResult.Failure("Invalid format: expected 6 parts, got ${parts.size}")
        }
        val version = parts[0]
        if (version != "WW1" && version != "WW2") {
            return TokenVerificationResult.Failure("Unsupported version: $version")
        }
        val weddingShortId = parts[1]
        val passSerial = parts[2]
        val eventBitmask = parts[3].toIntOrNull(16)
            ?: return TokenVerificationResult.Failure("Invalid event bitmask")
        val nonce = parts[4]
        val signature = parts[5]
        if (weddingShortId.isBlank() || passSerial.isBlank() || nonce.isBlank()) {
            return TokenVerificationResult.Failure("Invalid token identifiers")
        }

        return TokenVerificationResult.Success(
            ParsedQRToken(
                version = version,
                weddingShortId = weddingShortId,
                passSerial = passSerial,
                eventBitmask = eventBitmask,
                nonce = nonce,
                signature = signature
            )
        )
    }

    /**
     * Asymmetric ECDSA (NIST P-256 / SHA-256) signature verification (WW2 Canonical Standard).
     * Scanning devices verify against a pre-cached public key and never possess a pass-signing private key.
     */
    fun verifyAsymmetric(
        token: String,
        publicKeyDerBase64: String,
        requiredEventBit: Int = 0x04
    ): TokenVerificationResult {
        val parseResult = parse(token)
        if (parseResult is TokenVerificationResult.Failure) return parseResult
        val parsed = (parseResult as TokenVerificationResult.Success).token
        if (parsed.version != "WW2") {
            return TokenVerificationResult.Failure("Asymmetric verification requires WW2.")
        }
        if ((parsed.eventBitmask and requiredEventBit) == 0) {
            return TokenVerificationResult.Failure("Unauthorized for this wedding event.")
        }

        return try {
            val publicKey = decodePublicKey(publicKeyDerBase64)
            val payload = "${parsed.version}.${parsed.weddingShortId}.${parsed.passSerial}.${String.format("%02x", parsed.eventBitmask)}.${parsed.nonce}"
            if (verifyP1363Bytes(payload, parsed.signature, publicKey)) {
                TokenVerificationResult.Success(parsed)
            } else {
                TokenVerificationResult.Failure("Signature mismatch.")
            }
        } catch (e: Exception) {
            TokenVerificationResult.Failure("Verification exception: ${e.message}")
        }
    }

    /** Verifies an IEEE-P1363 P-256/SHA-256 signature over an arbitrary canonical payload. */
    fun verifyP1363(
        payload: String,
        signatureHex: String,
        publicKeyDerBase64: String
    ): Boolean {
        return try {
            verifyP1363Bytes(payload, signatureHex, decodePublicKey(publicKeyDerBase64))
        } catch (_: Exception) {
            false
        }
    }

    /** Legacy symmetric HMAC-SHA256 verifier (WW1). */
    fun verify(token: String, secretKey: String, requiredEventBit: Int = 0x04): TokenVerificationResult {
        val parseResult = parse(token)
        if (parseResult is TokenVerificationResult.Failure) return parseResult
        val parsed = (parseResult as TokenVerificationResult.Success).token

        if ((parsed.eventBitmask and requiredEventBit) == 0) {
            return TokenVerificationResult.Failure("Unauthorized for this wedding event.")
        }

        val payloadPrefix = "${parsed.version}.${parsed.weddingShortId}.${parsed.passSerial}.${String.format("%02x", parsed.eventBitmask)}.${parsed.nonce}"
        val keySpec = SecretKeySpec(secretKey.toByteArray(Charsets.UTF_8), "HmacSHA256")
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(keySpec)
        val hmacBytes = mac.doFinal(payloadPrefix.toByteArray(Charsets.UTF_8))
        val computedHex = hmacBytes.joinToString("") { "%02x".format(it) }
        val expected16Bytes = computedHex.take(32)

        return if (parsed.signature.equals(expected16Bytes, ignoreCase = true)) {
            TokenVerificationResult.Success(parsed)
        } else {
            TokenVerificationResult.Failure("Signature mismatch.")
        }
    }

    private fun decodePublicKey(publicKeyDerBase64: String): PublicKey {
        val spkiBytes = Base64.getDecoder().decode(publicKeyDerBase64)
        return KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(spkiBytes))
    }

    private fun verifyP1363Bytes(payload: String, signatureHex: String, publicKey: PublicKey): Boolean {
        val sigBytes = hexToBytes(signatureHex)
        if (sigBytes.size != 64) return false
        val ecdsa = Signature.getInstance("SHA256withECDSA")
        ecdsa.initVerify(publicKey)
        ecdsa.update(payload.toByteArray(Charsets.UTF_8))
        return ecdsa.verify(p1363ToDer(sigBytes))
    }

    private fun p1363ToDer(p1363: ByteArray): ByteArray {
        require(p1363.size == 64) { "P-256 IEEE-P1363 signature must be 64 bytes" }
        val r = p1363.copyOfRange(0, 32)
        val s = p1363.copyOfRange(32, 64)

        val out = ByteArrayOutputStream()
        writeDerInteger(out, r)
        writeDerInteger(out, s)
        val body = out.toByteArray()

        val seq = ByteArrayOutputStream()
        seq.write(0x30)
        seq.write(body.size)
        seq.write(body)
        return seq.toByteArray()
    }

    private fun writeDerInteger(out: ByteArrayOutputStream, value: ByteArray) {
        var start = 0
        while (start < value.size - 1 && value[start].toInt() == 0) start++
        val pad = (value[start].toInt() and 0x80) != 0
        val len = value.size - start + if (pad) 1 else 0
        out.write(0x02)
        out.write(len)
        if (pad) out.write(0x00)
        out.write(value, start, value.size - start)
    }

    private fun hexToBytes(value: String): ByteArray {
        val s = value.trim()
        require(s.length % 2 == 0) { "Hex value must have an even length" }
        val data = ByteArray(s.length / 2)
        var i = 0
        while (i < s.length) {
            val high = Character.digit(s[i], 16)
            val low = Character.digit(s[i + 1], 16)
            require(high >= 0 && low >= 0) { "Invalid hex value" }
            data[i / 2] = ((high shl 4) + low).toByte()
            i += 2
        }
        return data
    }
}
