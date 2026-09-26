package pro.wewed.app.invitation

import android.content.Context
import java.io.File
import java.security.MessageDigest
import java.text.Normalizer
import org.json.JSONObject
import pro.wewed.app.BuildConfig
import pro.wewed.app.state.NativeServerOrigin

/**
 * wewed.parity.v1 evidence from the Android app itself (QRO 01 §13–§15). Identical in shape and
 * digests to iOS `NativeParityRecord` and the server checker (`mobile/contracts/wewed-parity-v1.json`).
 *
 * Never carries a secret: human text is SHA-256 of its normalized form, the Wedding Pass is SHA-256
 * of the exact credential bytes, and no session, cookie or invitation token is read.
 */
object NativeParityRecord {
    const val CONTRACT = "wewed.parity.v1"

    /** JavaScript's `\s` set (the server normalizes with it); Java's `\s` is ASCII-only. */
    private val WHITESPACE = Regex("[\\s\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]+")
    private val UTC_INSTANT = Regex("^(\\d{4}-\\d{2}-\\d{2})T[0-9:.]+Z$")

    fun sha256Hex(value: String): String =
        MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }

    /** NFC, trimmed, internal whitespace collapsed, lowercased — then SHA-256. */
    fun textDigest(value: String?): String? {
        if (value == null) return null
        val normalized = Normalizer.normalize(value, Normalizer.Form.NFC)
            .replace(WHITESPACE, " ")
            .trim(' ')
            .lowercase()
        return if (normalized.isEmpty()) null else sha256Hex(normalized)
    }

    /** The server serializes dates as UTC instants; the parity date is that instant's UTC day. */
    internal fun weddingDate(iso: String?): String? = iso?.let { UTC_INSTANT.find(it)?.groupValues?.get(1) }

    fun guestRecord(
        label: String,
        baseUrl: String,
        commitSha: String,
        snapshot: GuestInvitationSnapshot,
        passState: String?,
        passSerial: String?,
        passToken: String?
    ): JSONObject {
        val rsvpStatus = when (snapshot.attending) {
            true -> "attending"
            false -> "declined"
            null -> "pending"
        }
        val values = linkedMapOf<String, Any?>(
            "contract" to CONTRACT, "label" to label, "role" to "guest", "client" to "android",
            "baseUrl" to baseUrl, "commitSha" to commitSha,
            "accessUserId" to null, "grantId" to null, "membershipRole" to null, "permissions" to null,
            "weddingId" to snapshot.weddingId, "coupleId" to null,
            "weddingDate" to weddingDate(snapshot.date),
            "weddingTitleDigest" to textDigest(snapshot.title),
            "coupleNamesDigest" to null,
            "venueDigest" to textDigest(snapshot.venue),
            "businessAccountId" to null, "vendorId" to null, "serviceEngagementId" to null,
            "guestId" to snapshot.guestId.ifEmpty { null },
            "guestNameDigest" to textDigest(snapshot.guestName),
            "rsvpStatus" to rsvpStatus,
            "partySize" to snapshot.partySize,
            "tableId" to snapshot.seatingTableId,
            "mealChoice" to snapshot.mealChoice,
            "invitationStyle" to snapshot.invitationCardStyle,
            "invitationMessageDigest" to textDigest(snapshot.invitationCardMessage),
            "passAvailability" to passState,
            "passSerial" to passSerial,
            "passDigest" to passToken?.let(::sha256Hex),
            "gateGrantId" to null, "gateId" to null, "capabilities" to null
        )
        return JSONObject().apply { values.forEach { (key, value) -> put(key, value ?: JSONObject.NULL) } }
    }
}

/**
 * DEBUG-only writer. Output: `files/wewed-parity/<label>-android.json`, retrieved with
 * `adb shell run-as pro.wewed.app.dev cat files/wewed-parity/<label>-android.json`.
 * Active only in a DEBUG build, only in the productionPreview lane, and only when MainActivity
 * received the `wewed_parity_export_label` and `wewed_parity_commit_sha` extras.
 */
object NativeParityExporter {
    data class Request(val label: String, val commitSha: String, val allowPassRetrieval: Boolean)

    @Volatile
    var request: Request? = null
        private set

    fun configure(label: String?, commitSha: String?, allowPassRetrieval: Boolean) {
        if (!BuildConfig.DEBUG || !NativeServerOrigin.active.isPreview) {
            request = null
            return
        }
        val cleanLabel = label?.trim()?.takeIf { Regex("^[A-Z][A-Z0-9_-]{0,15}$").matches(it) }
        val cleanSha = commitSha?.trim()?.takeIf { Regex("^[0-9a-f]{7,40}$").matches(it) }
        request = if (cleanLabel != null && cleanSha != null) Request(cleanLabel, cleanSha, allowPassRetrieval) else null
    }

    suspend fun exportGuestIfRequested(context: Context, snapshot: GuestInvitationSnapshot, coordinator: LiveGuestInvitationCoordinator) {
        val current = request ?: return
        if (!BuildConfig.DEBUG || !NativeServerOrigin.active.isPreview) return
        var passState: String? = null
        var passSerial: String? = null
        var passToken: String? = null
        // Inside the T-14 window a Pass retrieval can issue a credential (a write): opt-in only.
        if (current.allowPassRetrieval) {
            try {
                val pass = coordinator.weddingPass(snapshot.guestId)
                passState = "active"
                passSerial = pass.passSerial
                passToken = pass.qrPayload
            } catch (error: GuestSessionException) {
                passState = (error.error as? GuestSessionError.PassUnavailable)?.availability?.state?.wireValue
            } catch (_: Exception) {
                passState = null
            }
        }
        val record = NativeParityRecord.guestRecord(
            label = current.label,
            baseUrl = NativeServerOrigin.active.origin,
            commitSha = current.commitSha,
            snapshot = snapshot,
            passState = passState,
            passSerial = passSerial,
            passToken = passToken
        )
        val directory = File(context.filesDir, "wewed-parity").apply { mkdirs() }
        File(directory, "${current.label}-android.json").writeText(record.toString(2))
    }
}
