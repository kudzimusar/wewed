package pro.wewed.app.services

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
        if (version != "WW1") {
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
}
