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
    case invalidKey
}

public enum TokenVerifier {
    public static func parse(token: String) -> Result<ParsedQRToken, TokenVerificationError> {
        let parts = token.split(separator: ".")
        guard parts.count == 6 else {
            return .failure(.invalidFormat)
        }

        let version = String(parts[0])
        guard version == "WW1" || version == "WW2" else {
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

    /// Asymmetric ECDSA (NIST P-256 / SHA-256) signature verification (WW2 Canonical Standard)
    public static func verifyAsymmetric(
        token: String,
        rawPublicKeyHex: String,
        requiredEventBit: UInt8 = 0x04
    ) -> Result<ParsedQRToken, TokenVerificationError> {
        switch parse(token: token) {
        case .failure(let error):
            return .failure(error)
        case .success(let parsed):
            guard parsed.version == "WW2" else {
                return .failure(.unsupportedVersion)
            }
            if (parsed.eventBitmask & requiredEventBit) == 0 {
                return .failure(.unauthorizedEvent)
            }

            guard let pubData = dataFromHex(rawPublicKeyHex),
                  let publicKey = try? P256.Signing.PublicKey(x963Representation: pubData) else {
                return .failure(.invalidKey)
            }
            return verify(parsed: parsed, publicKey: publicKey)
        }
    }

    /// DER/SPKI variant used by the signed Wedding Day manifest. This matches Android's key contract.
    public static func verifyAsymmetric(
        token: String,
        publicKeyDerBase64: String,
        requiredEventBit: UInt8 = 0x04
    ) -> Result<ParsedQRToken, TokenVerificationError> {
        switch parse(token: token) {
        case .failure(let error):
            return .failure(error)
        case .success(let parsed):
            guard parsed.version == "WW2" else {
                return .failure(.unsupportedVersion)
            }
            if (parsed.eventBitmask & requiredEventBit) == 0 {
                return .failure(.unauthorizedEvent)
            }
            guard let der = Data(base64Encoded: publicKeyDerBase64),
                  let publicKey = try? P256.Signing.PublicKey(derRepresentation: der) else {
                return .failure(.invalidKey)
            }
            return verify(parsed: parsed, publicKey: publicKey)
        }
    }

    /// Verifies a raw IEEE-P1363 P-256 signature over an arbitrary canonical payload.
    /// Used to authenticate the root-signed offline manifest before it is cached.
    public static func verifyP1363(
        payload: String,
        signatureHex: String,
        publicKeyDerBase64: String
    ) -> Bool {
        guard let der = Data(base64Encoded: publicKeyDerBase64),
              let publicKey = try? P256.Signing.PublicKey(derRepresentation: der),
              let signatureData = dataFromHex(signatureHex),
              let signature = try? P256.Signing.ECDSASignature(rawRepresentation: signatureData) else {
            return false
        }
        return publicKey.isValidSignature(signature, for: Data(payload.utf8))
    }

    private static func verify(
        parsed: ParsedQRToken,
        publicKey: P256.Signing.PublicKey
    ) -> Result<ParsedQRToken, TokenVerificationError> {
        let payload = "\(parsed.version).\(parsed.weddingShortId).\(parsed.passSerial).\(String(format: "%02x", parsed.eventBitmask)).\(parsed.nonce)"
        guard let sigData = dataFromHex(parsed.signature),
              let ecdsaSignature = try? P256.Signing.ECDSASignature(rawRepresentation: sigData) else {
            return .failure(.signatureMismatch)
        }

        if publicKey.isValidSignature(ecdsaSignature, for: Data(payload.utf8)) {
            return .success(parsed)
        } else {
            return .failure(.signatureMismatch)
        }
    }

    /// Legacy symmetric HMAC-SHA256 verifier (WW1)
    public static func verify(token: String, secretKey: String, requiredEventBit: UInt8 = 0x04) -> Result<ParsedQRToken, TokenVerificationError> {
        switch parse(token: token) {
        case .failure(let error):
            return .failure(error)
        case .success(let parsed):
            if (parsed.eventBitmask & requiredEventBit) == 0 {
                return .failure(.unauthorizedEvent)
            }

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

    private static func dataFromHex(_ hex: String) -> Data? {
        let clean = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        guard clean.count % 2 == 0 else { return nil }
        var data = Data(capacity: clean.count / 2)
        var index = clean.startIndex
        for _ in 0..<(clean.count / 2) {
            let nextIndex = clean.index(index, offsetBy: 2)
            guard let byte = UInt8(clean[index..<nextIndex], radix: 16) else { return nil }
            data.append(byte)
            index = nextIndex
        }
        return data
    }
}
