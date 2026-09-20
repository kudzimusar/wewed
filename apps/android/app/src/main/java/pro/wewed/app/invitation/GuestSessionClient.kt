package pro.wewed.app.invitation

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import pro.wewed.app.services.SecureStorage
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL

/** Who the server says this device's guest is, after a credential has been exchanged. */
data class GuestSessionIdentity(
    val weddingSlug: String,
    val guestId: String,
    val guestName: String
)

/** Everything the invitation needs, as the wedding's own authority reports it. */
data class GuestInvitationSnapshot(
    val weddingSlug: String,
    val title: String,
    val monogram: String?,
    val tagline: String?,
    val date: String?,
    val venue: String?,
    val venueMapUrl: String?,
    val venueCity: String?,
    val venueCountry: String?,
    val invitationCardStyle: String?,
    val invitationCardMessage: String?,
    val rsvpDeadline: String?,
    val childrenPolicy: String?,
    val guestId: String,
    val guestName: String,
    val attending: Boolean?,
    val dietaryNotes: String?,
    val message: String?,
    val checkedIn: Boolean
)

/** What happened when a guest answered. */
sealed interface RsvpSaveResult {
    data class Saved(val attending: Boolean?) : RsvpSaveResult

    /**
     * The session moved on while the form was open — Guest B became authoritative, or the session
     * expired. The server refuses rather than writing the answer to whoever is active now.
     */
    data object StaleGuestContext : RsvpSaveResult
    data object ChildrenNotAllowed : RsvpSaveResult
    data object NotAuthorized : RsvpSaveResult
    data class Failed(val status: Int) : RsvpSaveResult
}

sealed interface GuestSessionError {
    data object Unauthorized : GuestSessionError
    data class Transport(val status: Int) : GuestSessionError
}

class GuestSessionException(val error: GuestSessionError) : Exception("guest session unavailable")

/**
 * The native client of Wewed's existing guest-session authority.
 *
 * There is one guest identity system, and it lives on the server. This class is a first-class
 * client of it — it exchanges the private credential for a session over JSON and holds the session
 * the server issues — rather than a second auth model or a browser whose cookie jar we read.
 *
 * Three rules shape the whole class:
 *
 * 1. The **raw RSVP credential is never persisted**. It is a key for the door, not a name badge.
 *    Only the server-issued session credential is stored, in the platform keystore.
 * 2. **Nothing is logged.** Invitation URLs and credentials never reach logcat, analytics or a
 *    crash report, so there is deliberately no logging in this file at all.
 * 3. **Replacement is atomic.** A new credential replaces the active guest only after the server
 *    has validated it. An invalid Guest B link leaves Guest A exactly as they were.
 */
class GuestSessionClient(
    private val baseUrl: String,
    private val secureStorage: SecureStorage,
    private val sessionCookieName: String = SESSION_COOKIE
) {

    companion object {
        /** Mirrors `WEDDING_GUEST_SESSION_COOKIE` on the server. */
        const val SESSION_COOKIE = "wewed_wedding_guest"
        private const val STORED_SESSION = "wewed.guest.session"
        private const val STORED_SLUG = "wewed.guest.session.slug"
    }

    /** The active session credential, if this device currently holds one. */
    fun activeSessionSlug(): String? = secureStorage.get(STORED_SLUG)

    fun hasActiveSession(): Boolean = secureStorage.get(STORED_SESSION) != null

    /** Ends the guest session on this device. Used by Sign Out, never by a failed exchange. */
    fun clearSession() {
        secureStorage.delete(STORED_SESSION)
        secureStorage.delete(STORED_SLUG)
    }

    /**
     * Exchanges the guest's private invitation credential for a session.
     *
     * `POST /api/weddings/{slug}/guest-session` is the server's own native-shaped entry point: it
     * takes the token as JSON and answers with the guest's identity. The credential is used here
     * and then dropped.
     */
    suspend fun exchangePrivateInvitation(
        weddingSlug: String,
        rsvpToken: String
    ): GuestSessionIdentity = withContext(Dispatchers.IO) {
        val body = JSONObject().put("token", rsvpToken).toString()
        val (status, payload, cookie) = request(
            method = "POST",
            path = "/api/weddings/${encode(weddingSlug)}/guest-session",
            body = body,
            // The exchange must not present an existing session: this call is how a *different*
            // guest takes over, and sending Guest A's cookie invites the server to keep them.
            withSession = false
        )
        if (status != 200 || payload == null) {
            throw GuestSessionException(
                if (status == 401) GuestSessionError.Unauthorized
                else GuestSessionError.Transport(status)
            )
        }
        val json = JSONObject(payload)
        if (!json.optBoolean("success")) throw GuestSessionException(GuestSessionError.Unauthorized)

        // Only now — after the server has accepted Guest B — is Guest A replaced.
        val issued = cookie ?: throw GuestSessionException(GuestSessionError.Transport(status))
        val slug = json.optJSONObject("wedding")?.optString("slug").orEmpty().ifEmpty { weddingSlug }
        secureStorage.save(STORED_SESSION, issued)
        secureStorage.save(STORED_SLUG, slug)

        val guest = json.optJSONObject("guest")
        GuestSessionIdentity(
            weddingSlug = slug,
            guestId = guest?.optString("id").orEmpty(),
            guestName = guest?.optString("name").orEmpty()
        )
    }

    /**
     * Redeems a one-time install handoff.
     *
     * `/invite/resume` answers with a redirect and a session cookie. The redirect is not followed —
     * the destination is a web page this app has no use for. What matters is the credential on the
     * response, and the fact that the server has just decided who the guest is.
     */
    suspend fun redeemHandoff(secret: String): GuestSessionIdentity = withContext(Dispatchers.IO) {
        if (!InvitationEntryParser.isValidHandoff(secret)) {
            throw GuestSessionException(GuestSessionError.Unauthorized)
        }
        val (status, _, cookie) = request(
            method = "GET",
            path = "/invite/resume?h=${encode(secret)}",
            body = null,
            withSession = false,
            followRedirects = false
        )
        // A rejected handoff redirects to the recovery page without issuing a session. The active
        // guest is intentionally left alone.
        val issued = cookie
            ?: throw GuestSessionException(
                if (status in 300..399) GuestSessionError.Unauthorized
                else GuestSessionError.Transport(status)
            )
        secureStorage.save(STORED_SESSION, issued)

        // The handoff response does not name the wedding, so the session is read back to find out
        // who the server decided this is.
        val snapshot = loadInternal(slug = null)
        secureStorage.save(STORED_SLUG, snapshot.weddingSlug)
        GuestSessionIdentity(snapshot.weddingSlug, snapshot.guestId, snapshot.guestName)
    }

    /** Reads the current guest's invitation from the wedding's own authority. */
    suspend fun loadInvitation(weddingSlug: String? = null): GuestInvitationSnapshot =
        withContext(Dispatchers.IO) { loadInternal(weddingSlug) }

    private fun loadInternal(slug: String?): GuestInvitationSnapshot {
        val target = slug ?: activeSessionSlug()
            ?: throw GuestSessionException(GuestSessionError.Unauthorized)
        val (status, payload, _) = request(
            method = "GET",
            path = "/api/weddings/${encode(target)}/guest-session",
            body = null,
            withSession = true
        )
        if (status == 401) throw GuestSessionException(GuestSessionError.Unauthorized)
        if (status != 200 || payload == null) {
            throw GuestSessionException(GuestSessionError.Transport(status))
        }
        val json = JSONObject(payload)
        val wedding = json.optJSONObject("wedding") ?: JSONObject()
        val guest = json.optJSONObject("guest") ?: JSONObject()
        val rsvp = json.optJSONObject("rsvp") ?: JSONObject()
        return GuestInvitationSnapshot(
            weddingSlug = wedding.optStringOrNull("slug") ?: target,
            title = wedding.optStringOrNull("title").orEmpty(),
            monogram = wedding.optStringOrNull("monogram"),
            tagline = wedding.optStringOrNull("tagline"),
            date = wedding.optStringOrNull("date"),
            venue = wedding.optStringOrNull("venue"),
            venueMapUrl = wedding.optStringOrNull("venueMapUrl"),
            venueCity = wedding.optStringOrNull("venueCity"),
            venueCountry = wedding.optStringOrNull("venueCountry"),
            invitationCardStyle = wedding.optStringOrNull("invitationCardStyle"),
            invitationCardMessage = wedding.optStringOrNull("invitationCardMessage"),
            rsvpDeadline = wedding.optStringOrNull("rsvpDeadline"),
            childrenPolicy = wedding.optStringOrNull("childrenPolicy"),
            guestId = guest.optStringOrNull("id").orEmpty(),
            guestName = guest.optStringOrNull("name").orEmpty(),
            attending = if (rsvp.isNull("attending")) null else rsvp.optBoolean("attending"),
            dietaryNotes = rsvp.optStringOrNull("dietaryNotes"),
            message = rsvp.optStringOrNull("message"),
            checkedIn = rsvp.optBoolean("checkedIn")
        )
    }

    /**
     * Saves the guest's answer.
     *
     * [originGuestId] is the binding the server checks. It is what turns "save this answer" into
     * "save this answer *for the guest whose card is open*", so an answer typed as Guest A can
     * never land on Guest B after a switch.
     */
    suspend fun saveRsvp(
        weddingSlug: String,
        originGuestId: String,
        attending: Boolean,
        dietaryNotes: String? = null,
        message: String? = null
    ): RsvpSaveResult = withContext(Dispatchers.IO) {
        val body = JSONObject()
            .put("originGuestId", originGuestId)
            .put("attending", attending)
            .apply {
                dietaryNotes?.let { put("dietaryNotes", it) }
                message?.let { put("message", it) }
            }
            .toString()
        val (status, payload, _) = request(
            method = "PUT",
            path = "/api/weddings/${encode(weddingSlug)}/guest-session",
            body = body,
            withSession = true
        )
        when {
            status == 200 -> {
                val rsvp = payload?.let { JSONObject(it).optJSONObject("rsvp") }
                RsvpSaveResult.Saved(
                    if (rsvp == null || rsvp.isNull("attending")) null else rsvp.optBoolean("attending")
                )
            }
            status == 401 -> RsvpSaveResult.NotAuthorized
            status == 409 -> RsvpSaveResult.StaleGuestContext
            status == 400 &&
                payload?.let { JSONObject(it).optString("code") } == "CHILDREN_NOT_ALLOWED" ->
                RsvpSaveResult.ChildrenNotAllowed
            else -> RsvpSaveResult.Failed(status)
        }
    }

    private data class Response(val status: Int, val body: String?, val issuedSession: String?)

    private operator fun Response.component1() = status
    private operator fun Response.component2() = body
    private operator fun Response.component3() = issuedSession

    private fun request(
        method: String,
        path: String,
        body: String?,
        withSession: Boolean,
        followRedirects: Boolean = true
    ): Response {
        val connection = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.instanceFollowRedirects = followRedirects
            connection.connectTimeout = 15_000
            connection.readTimeout = 20_000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("x-wewed-client", "native")
            if (withSession) {
                secureStorage.get(STORED_SESSION)?.let {
                    connection.setRequestProperty("Cookie", "$sessionCookieName=$it")
                }
            }
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }

            val status = connection.responseCode
            val payload = runCatching {
                (if (status in 200..299) connection.inputStream else connection.errorStream)
                    ?.bufferedReader()
                    ?.use(BufferedReader::readText)
            }.getOrNull()
            return Response(status, payload, issuedSessionCookie(connection))
        } finally {
            connection.disconnect()
        }
    }

    /** Extracts the session the server issued, without touching any other cookie it sets. */
    private fun issuedSessionCookie(connection: HttpURLConnection): String? {
        val headers = connection.headerFields ?: return null
        val values = headers.entries
            .firstOrNull { it.key?.equals("Set-Cookie", ignoreCase = true) == true }
            ?.value
            ?: return null
        return values.asSequence()
            .mapNotNull { raw ->
                val first = raw.substringBefore(';')
                val name = first.substringBefore('=').trim()
                val value = first.substringAfter('=', "").trim()
                if (name.equals(sessionCookieName, ignoreCase = true) && value.isNotEmpty()) value
                else null
            }
            .firstOrNull()
    }

    private fun encode(value: String): String =
        java.net.URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
}

private fun JSONObject.optStringOrNull(key: String): String? {
    if (isNull(key)) return null
    return optString(key).takeIf { it.isNotEmpty() && it != "null" }
}
