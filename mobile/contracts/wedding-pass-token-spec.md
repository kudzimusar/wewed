# Wewed Wedding Pass — QR Token Cryptographic Specification

**Specification Version:** `WW1.0`  
**Governing Document:** [`docs/native-mobile/MASTER_MOBILE_SPRINT_PLAN.md`](file:///Users/shadreckmusarurwa/Project%20AI/wewed-native-mobile/docs/native-mobile/MASTER_MOBILE_SPRINT_PLAN.md)

---

## 1. Token Structure

The Wewed Wedding Pass QR code encodes a URL-safe, compact base64-encoded string:

```text
WW1.<wedding_short_id>.<pass_serial>.<event_bitmask>.<nonce>.<signature>
```

### Fields:
1. **`WW1`**: Static protocol version identifier (3 characters).
2. **`wedding_short_id`**: 8-character base62 truncated hash of the unique Wedding ID.
3. **`pass_serial`**: 10-character base62 pass serial number uniquely bound to a `Guest` or `Household`.
4. **`event_bitmask`**: Hex-encoded 8-bit integer representing event access:
   - `0x01`: Welcome Dinner
   - `0x02`: Traditional Ceremony
   - `0x04`: Wedding Ceremony & Vows
   - `0x08`: Reception & Dinner
   - `0x10`: After Party
   - `0x20`: Post-Wedding Brunch
   - Example: `0x0E` (00001110) grants Ceremony (0x02), Reception (0x04), and After Party (0x08).
5. **`nonce`**: 8-character timestamp/salt (epoch seconds in hex) for replay tracking and cache busting.
6. **`signature`**: First 16 bytes (32 hex characters) of:
   ```text
   HMAC-SHA256(wedding_secret_key, "WW1.<wedding_short_id>.<pass_serial>.<event_bitmask>.<nonce>")
   ```

---

## 2. Offline Verification Algorithm (Usher Native App)

When an usher scans a QR code without network connectivity:

1. **Extract and Parse:** Split the scanned string by `.`. Verify prefix is `WW1` and segment count is 6.
2. **Key Retrieval:** Look up `wedding_secret_key` from the pre-cached, AES-GCM encrypted local wedding manifest.
3. **Verify Signature:** Compute `HMAC-SHA256` over the payload prefix. Compare the first 16 bytes in constant time.
   - If mismatch -> Return `INVALID_PASS`.
4. **Event Entitlement Check:** Bitwise AND between the target event's bitmask and `event_bitmask`.
   - If `(event_bitmask & target_event_bit) == 0` -> Return `UNAUTHORIZED_EVENT`.
5. **Local Manifest Lookup:** Find `Guest` or `Household` matching `pass_serial`.
   - If not found -> Return `PASS_NOT_IN_MANIFEST`.
6. **Attendance & Concurrency Check:**
   - Verify `alreadyCheckedInCount + requestCheckInCount <= totalPartySize`.
   - If exceeded -> Return `ALREADY_CHECKED_IN` or `CAPACITY_EXCEEDED`.
7. **Write to Local Queue:**
   - Record scan event with local ISO-8601 timestamp, usher ID, and device UUID.
   - Emit haptic feedback (`.success` or `.warning`).
   - Sync back to server when connection resumes.
