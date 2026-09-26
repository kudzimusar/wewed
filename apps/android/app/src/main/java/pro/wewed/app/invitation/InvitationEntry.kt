package pro.wewed.app.invitation

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

/**
 * How a private invitation reaches the app.
 *
 * There are three legitimate launch shapes and one illegitimate one, and the difference matters
 * because two of them carry a secret:
 *
 * ```
 * /invite/<slug>?rsvp=<private token>   the link a guest is actually sent
 * /invite/resume?h=<opaque handoff>     after a deferred install, or the Android bridge intent
 * wewed://invite/resume + wewed_handoff the package-targeted bridge extra
 * ```
 *
 * The protocol is the one already running in production; the shapes are pinned in
 * `mobile/contracts/invitation-protocol.json`, generated from `origin/main`. Native speaks that
 * protocol or refuses — it never invents a second one.
 */
sealed interface InvitationEntry {

    /**
     * The guest's own private link.
     *
     * [rsvpToken] is a credential for *entry and exchange only*. It is never stored as client
     * identity, never logged, and never travels onward in a URL.
     */
    data class PrivateInvitation(
        val weddingSlug: String,
        val rsvpToken: String
    ) : InvitationEntry {
        /** Redacted: an invitation credential must not reach a log line via a default toString. */
        override fun toString(): String = "PrivateInvitation(weddingSlug=$weddingSlug, rsvpToken=***)"
    }

    /**
     * A one-time opaque handoff. It identifies a pending invitation on the server and nothing
     * here, which is precisely why it is the value allowed to survive an install.
     */
    data class Handoff(val secret: String) : InvitationEntry {
        override fun toString(): String = "Handoff(secret=***)"
    }

    /**
     * A launch that looked like an invitation and is not honoured.
     *
     * Rejection is a real outcome, not an absence. It must fail closed: it never falls back to
     * whichever guest happened to be active.
     */
    data class Rejected(val reason: Reason) : InvitationEntry

    enum class Reason {
        /** A resume URL carrying a raw `rsvp` credential — the server refuses to build these. */
        RESUME_CARRIED_RAW_CREDENTIAL,

        /** The handoff is not the shape the server issues, so it cannot be genuine. */
        MALFORMED_HANDOFF,

        /** An `/invite/<slug>` link with no credential identifies no one. */
        MISSING_CREDENTIAL
    }
}

/**
 * Parses launch inputs into an [InvitationEntry].
 *
 * Deliberately pure and platform-free: the Activity, the App Link, the bridge intent and the Play
 * install referrer all funnel through here, so there is one place where the protocol's refusals
 * are implemented and one place to test them.
 */
object InvitationEntryParser {

    /** 43 base64url characters — 32 random bytes, per `INVITATION_HANDOFF_PATTERN`. */
    private val HANDOFF = Regex("^[A-Za-z0-9_-]{43}$")

    private const val RESUME_PATH = "invite/resume"
    const val ANDROID_INTENT_EXTRA = "wewed_handoff"
    const val PLAY_REFERRER_KEY = "handoff"

    fun isValidHandoff(secret: String?): Boolean =
        !secret.isNullOrBlank() && HANDOFF.matches(secret)

    /**
     * Parses a launch URL. Returns null when the URL is not invitation entry at all, which is
     * different from [InvitationEntry.Rejected] — an ordinary `wewed://pass` link is simply not
     * our business, whereas a malformed invitation must fail closed.
     */
    fun fromUrl(rawUrl: String?): InvitationEntry? {
        if (rawUrl.isNullOrBlank()) return null

        return runCatching {
            val uri = URI(rawUrl.trim())
            val scheme = uri.scheme?.lowercase() ?: return@runCatching null
            val segments = uri.path.orEmpty()
                .split("/")
                .filter { it.isNotBlank() }
                .toMutableList()

            when (scheme) {
                "https" -> {
                    val host = uri.host?.lowercase()
                    if (host != "wewed.pro" && host != "www.wewed.pro") return@runCatching null
                }
                "wewed" -> uri.host?.takeIf { it.isNotBlank() }?.let { segments.add(0, it) }
                else -> return@runCatching null
            }

            if (segments.firstOrNull()?.lowercase() != "invite") return@runCatching null
            val query = uri.rawQuery

            // Resume: opaque only. `buildAndroidInvitationIntentUrl` refuses to emit a resume URL
            // containing `rsvp`, so one arriving here did not come from Wewed.
            if (segments.getOrNull(1)?.lowercase() == "resume") {
                if (parameter(query, "rsvp") != null) {
                    return@runCatching InvitationEntry.Rejected(
                        InvitationEntry.Reason.RESUME_CARRIED_RAW_CREDENTIAL
                    )
                }
                val handoff = parameter(query, "h")?.trim()
                return@runCatching if (isValidHandoff(handoff)) {
                    InvitationEntry.Handoff(handoff!!)
                } else {
                    InvitationEntry.Rejected(InvitationEntry.Reason.MALFORMED_HANDOFF)
                }
            }

            val slug = segments.getOrNull(1)?.trim().orEmpty()
            if (slug.isEmpty()) return@runCatching null
            val token = parameter(query, "rsvp")?.trim().orEmpty()
            if (token.isEmpty()) {
                InvitationEntry.Rejected(InvitationEntry.Reason.MISSING_CREDENTIAL)
            } else {
                // The `card` parameter is deliberately ignored. The wedding's saved design is
                // authoritative; a long-lived or forwarded link must not select the stationery.
                InvitationEntry.PrivateInvitation(weddingSlug = slug, rsvpToken = token)
            }
        }.getOrNull()
    }

    /** The package-targeted bridge intent carries the handoff as an extra rather than in the URL. */
    fun fromIntentExtra(handoff: String?): InvitationEntry? {
        if (handoff.isNullOrBlank()) return null
        return if (isValidHandoff(handoff.trim())) {
            InvitationEntry.Handoff(handoff.trim())
        } else {
            InvitationEntry.Rejected(InvitationEntry.Reason.MALFORMED_HANDOFF)
        }
    }

    /**
     * The Play install referrer, e.g. `handoff=<secret>&utm_source=...`.
     *
     * Only the opaque handoff is read. A referrer carrying anything that looks like a raw RSVP
     * credential is refused outright rather than used: Play referrers are attacker-supplied.
     */
    fun fromInstallReferrer(referrer: String?): InvitationEntry? {
        if (referrer.isNullOrBlank()) return null
        if (parameter(referrer, "rsvp") != null) {
            return InvitationEntry.Rejected(InvitationEntry.Reason.RESUME_CARRIED_RAW_CREDENTIAL)
        }
        val handoff = parameter(referrer, PLAY_REFERRER_KEY)?.trim() ?: return null
        return if (isValidHandoff(handoff)) {
            InvitationEntry.Handoff(handoff)
        } else {
            InvitationEntry.Rejected(InvitationEntry.Reason.MALFORMED_HANDOFF)
        }
    }

    /**
     * Whether a launch is explicit invitation intent.
     *
     * A fresh link outranks a stale install referrer: the referrer records how the app was
     * obtained, possibly long ago, while a tapped link is what the guest wants now.
     */
    fun isExplicitInvitationLaunch(rawUrl: String?): Boolean = fromUrl(rawUrl) != null

    private fun parameter(rawQuery: String?, name: String): String? {
        if (rawQuery.isNullOrBlank()) return null
        return rawQuery.split("&").firstNotNullOfOrNull { part ->
            val separator = part.indexOf('=')
            val rawName = if (separator >= 0) part.substring(0, separator) else part
            val rawValue = if (separator >= 0) part.substring(separator + 1) else ""
            runCatching {
                if (URLDecoder.decode(rawName, StandardCharsets.UTF_8.name()) == name) {
                    URLDecoder.decode(rawValue, StandardCharsets.UTF_8.name())
                } else null
            }.getOrNull()
        }
    }
}
