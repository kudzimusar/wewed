# Wewed Wedding Pass — Cryptographic Token Specification (Asymmetric Public-Key)

**Specification Version:** `WW2.0` (Asymmetric Public-Key Signed Credential)  
**Governing Document:** [`docs/native-mobile/MASTER_MOBILE_SPRINT_PLAN.md`](file:///Users/shadreckmusarurwa/Project%20AI/wewed-native-mobile/docs/native-mobile/MASTER_MOBILE_SPRINT_PLAN.md)  
**Status:** Frozen Canonical Standard

---

## 1. Architectural Rationale: Asymmetric vs. Symmetric

In gate-access operations where thousands of guests present credentials to usher terminals across multiple physical gates:

1. **Gate Device Vulnerability:** Gate devices (usher mobile phones, rented tablets) operate in untrusted physical environments.
2. **Symmetric Risk:** Under symmetric schemes (HMAC-SHA256), the verification secret key is stored on every scanner. If an usher device is reverse-engineered, extracted, or compromised, the secret key can be extracted to mint fraudulent passes offline.
3. **Asymmetric Protection:** Under asymmetric ECDSA (NIST P-256), the **Private Signing Key** is held exclusively by the Wewed Key Authority (server/issuer). Gate scanning devices receive only the **Public Verification Key** via the encrypted wedding manifest.
4. **Result:** Scanning devices can verify passes offline indefinitely with zero latency, but possess zero capability to mint valid credentials.

---

## 2. Token Structure

The Wewed Wedding Pass QR code encodes a URL-safe, compact dot-separated string:

```text
WW2.<wedding_short_id>.<pass_serial>.<event_bitmask>.<nonce>.<signature_hex>
```

### Segment Definitions

| Index | Field | Format | Description |
|:---:|---|---|---|
| 0 | `version` | `WW2` | Protocol Version 2: Asymmetric ECDSA-P256 signed pass |
| 1 | `wedding_short_id` | Alphanumeric (7-8 chars) | Short unique identifier of the wedding (e.g. `wedts26`) |
| 2 | `pass_serial` | Alphanumeric (8-10 chars) | Unique serial bound to a `Guest` or `Household` (e.g. `WWJD0824`) |
| 3 | `event_bitmask` | Hex (2 chars) | 8-bit integer representing event access entitlements |
| 4 | `nonce` | Hex (8 chars) | Timestamp / salt (epoch seconds in hex) for replay tracking |
| 5 | `signature_hex` | Hex (128 chars) | ECDSA P-256 signature in IEEE P1363 format (r \|\| s, 64 bytes) |

### Event Bitmask Reference

| Bit | Hex | Event Access |
|:---:|:---:|---|
| `0000 0001` | `0x01` | Welcome Dinner / Pre-wedding Drinks |
| `0000 0010` | `0x02` | Traditional Ceremony (Lobola / Roora celebration) |
| `0000 0100` | `0x04` | Church / Main Wedding Ceremony & Vows |
| `0000 1000` | `0x08` | Grand Reception & Dinner |
| `0001 0000` | `0x10` | After Party |
| `0010 0000` | `0x20` | Post-Wedding Brunch |

*Example:* `0x0E` (`0000 1110`) entitles the bearer to Traditional Ceremony (`0x02`), Wedding Ceremony (`0x04`), and Grand Reception (`0x08`).

---

## 3. Cryptographic Parameters

* **Curve:** NIST P-256 (secp256r1 / prime256v1), FIPS 186-4.
* **Hash Function:** SHA-256.
* **Algorithm:** `SHA256withECDSA`.
* **Signing Payload:** The exact UTF-8 string prior to the signature segment:
  ```text
  "WW2.<wedding_short_id>.<pass_serial>.<event_bitmask>.<nonce>"
  ```
* **Signature Encoding:** IEEE P1363 (concatenation of raw 32-byte `r` and raw 32-byte `s`, total 64 bytes = 128 hexadecimal characters).
* **Public Key Encoding:**
  - Raw uncompressed 65-byte EC point (`0x04 || X (32 bytes) || Y (32 bytes)`).
  - X.509 SubjectPublicKeyInfo (SPKI) DER Base64 (91 bytes).

---

## 4. Native Verification Implementation

### iOS Native (`CryptoKit`)
```swift
let rawPubData = Data(hex: rawPublicKeyHex)
let publicKey = try P256.Signing.PublicKey(rawRepresentation: rawPubData)
let signature = try P256.Signing.ECDSASignature(rawRepresentation: Data(hex: signatureHex))
let isValid = publicKey.isValidSignature(signature, for: Data(payload.utf8))
```

### Android Native (`java.security`)
```kotlin
val spkiBytes = Base64.decode(publicKeyDerBase64, Base64.DEFAULT)
val keyFactory = KeyFactory.getInstance("EC")
val publicKey = keyFactory.generatePublic(X509EncodedKeySpec(spkiBytes))
// Convert IEEE P1363 (64 bytes) to DER or use SHA256withECDSAinP1363Format
val signature = Signature.getInstance("SHA256withECDSA")
signature.initVerify(publicKey)
signature.update(payload.toByteArray(Charsets.UTF_8))
val isValid = signature.verify(p1363ToDer(signatureBytes))
```

---

## 5. Offline Gate Verification Algorithm

When an usher scans a QR code at the wedding gate:

1. **Parse & Structure Check:** Split by `.`. Verify prefix is `WW2` and segment count is 6.
2. **Event Entitlement Check:** Compute `(event_bitmask & target_event_bit)`. If 0, immediately reject with `UNAUTHORIZED_EVENT`.
3. **Public-Key Cryptographic Verification:** Verify signature against the pre-cached public key using native cryptographic primitives.
   - If invalid -> Immediately reject with `INVALID_PASS` (tampered token or signature mismatch).
4. **Manifest Lookup:** Match `pass_serial` against the locally cached manifest.
   - If missing -> Reject with `PASS_NOT_IN_MANIFEST`.
5. **Capacity & Household State Check:**
   - If `alreadyCheckedInCount >= partySize` -> Alert `ALREADY_CHECKED_IN` (duplicate entry attempt).
   - If `alreadyCheckedInCount + admitCount > partySize` -> Alert `CAPACITY_EXCEEDED`.
6. **Admit & Local Audit Logging:**
   - Increment `alreadyCheckedInCount` by `admitCount`.
   - Append `CheckInAuditRecord` to local SQLite/disk queue.
   - Surface guest name, household, and assigned table name/number.
