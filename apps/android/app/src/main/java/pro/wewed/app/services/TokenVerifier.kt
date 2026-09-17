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
        val parts = token.split(".")
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
     * Scanning devices verify against pre-cached Public Key; they possess no private keys and cannot mint passes.
     */
    fun verifyAsymmetric(
        token: String,
        publicKeyDerBase64: String,
        requiredEventBit: Int = 0x04
    ): TokenVerificationResult {
        val parseResult = parse(token)
        if (parseResult is TokenVerificationResult.Failure) {
            return parseResult
        }
        val parsed = (parseResult as TokenVerificationResult.Success).token

        // 1. Bitmask check
        if ((parsed.eventBitmask and requiredEventBit) == 0) {
            return TokenVerificationResult.Failure("Unauthorized for this wedding event.")
        }

        return try {
            val spkiBytes = Base64.getDecoder().decode(publicKeyDerBase64)
            val keyFactory = KeyFactory.getInstance("EC")
            val pubKey = keyFactory.generatePublic(X509EncodedKeySpec(spkiBytes))

            val payload = "${parsed.version}.${parsed.weddingShortId}.${parsed.passSerial}.${String.format("%02x", parsed.eventBitmask)}.${parsed.nonce}"
            val sigBytes = hexToBytes(parsed.signature)
            val derSig = p1363ToDer(sigBytes)

            val ecdsa = Signature.getInstance("SHA256withECDSA")
            ecdsa.initVerify(pubKey)
            ecdsa.update(payload.toByteArray(Charsets.UTF_8))

            if (ecdsa.verify(derSig)) {
                TokenVerificationResult.Success(parsed)
            } else {
                TokenVerificationResult.Failure("Signature mismatch.")
            }
        } catch (e: Exception) {
            TokenVerificationResult.Failure("Verification exception: ${e.message}")
        }
    }

    /**
     * Legacy symmetric HMAC-SHA256 verifier (WW1)
     */
    fun verify(token: String, secretKey: String, requiredEventBit: Int = 0x04): TokenVerificationResult {
        val parseResult = parse(token)
        if (parseResult is TokenVerificationResult.Failure) {
            return parseResult
        }
        val parsed = (parseResult as TokenVerificationResult.Success).token

        // 1. Bitmask check
        if ((parsed.eventBitmask and requiredEventBit) == 0) {
            return TokenVerificationResult.Failure("Unauthorized for this wedding event.")
        }

        // 2. Compute HMAC-SHA256
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

    private fun p1363ToDer(p1363: ByteArray): ByteArray {
        val r = ByteArray(32)
        val s = ByteArray(32)
        System.arraycopy(p1363, 0, r, 0, 32)
        System.arraycopy(p1363, 32, s, 0, 32)

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
        val len = value.size - start + (if (pad) 1 else 0)
        out.write(0x02)
        out.write(len)
        if (pad) out.write(0x00)
        out.write(value, start, value.size - start)
    }

    private fun hexToBytes(s: String): ByteArray {
        val len = s.length
        val data = ByteArray(len / 2)
        var i = 0
        while (i < len) {
            data[i / 2] = ((Character.digit(s[i], 16) shl 4) + Character.digit(s[i + 1], 16)).toByte()
            i += 2
        }
        return data
    }
}
