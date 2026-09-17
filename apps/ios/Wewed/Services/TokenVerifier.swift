import Foundation
import CryptoKit

public struct ParsedQRToken: Equatable, Sendable {
    public let version: String
    public let weddingShortId: String
    public let passSerial: String
    public let eventBitmask: UInt8
    public let nonce: String
    public let signature: String
}

public enum TokenVerificationError: Error, Equatable, Sendable {
    case invalidFormat
    case unsupportedVersion
    case signatureMismatch
    case unauthorizedEvent
}

public enum TokenVerifier {
    public static func parse(token: String) -> Result<ParsedQRToken, TokenVerificationError> {
        let parts = token.split(separator: ".")
        guard parts.count == 6 else {
            return .failure(.invalidFormat)
        }

        let version = String(parts[0])
        guard version == "WW1" else {
            return .failure(.unsupportedVersion)
        }

        let weddingShortId = String(parts[1])
        let passSerial = String(parts[2])
        guard let bitmask = UInt8(parts[3], radix: 16) else {
            return .failure(.invalidFormat)
        }
        let nonce = String(parts[4])
        let signature = String(parts[5])

        return .success(ParsedQRToken(
            version: version,
            weddingShortId: weddingShortId,
            passSerial: passSerial,
            eventBitmask: bitmask,
            nonce: nonce,
            signature: signature
        ))
    }

    public static func verify(token: String, secretKey: String, requiredEventBit: UInt8 = 0x04) -> Result<ParsedQRToken, TokenVerificationError> {
        switch parse(token: token) {
        case .failure(let error):
            return .failure(error)
        case .success(let parsed):
            // 1. Verify Event Bitmask
            if (parsed.eventBitmask & requiredEventBit) == 0 {
                return .failure(.unauthorizedEvent)
            }

            // 2. Compute HMAC-SHA256
            let payloadPrefix = "\(parsed.version).\(parsed.weddingShortId).\(parsed.passSerial).\(String(format: "%02x", parsed.eventBitmask)).\(parsed.nonce)"
            let key = SymmetricKey(data: Data(secretKey.utf8))
            let signatureData = HMAC<SHA256>.authenticationCode(for: Data(payloadPrefix.utf8), using: key)
            let computedHex = signatureData.map { String(format: "%02x", $0) }.joined()
            let expected16Bytes = String(computedHex.prefix(32))

            if parsed.signature.lowercased() == expected16Bytes.lowercased() {
                return .success(parsed)
            } else {
                return .failure(.signatureMismatch)
            }
        }
    }
}
