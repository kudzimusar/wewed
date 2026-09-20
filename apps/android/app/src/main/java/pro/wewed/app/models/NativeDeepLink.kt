package pro.wewed.app.models

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

data class InvitationDeepLink(
    val weddingSlug: String,
    val rsvpToken: String
)

sealed interface NativeDeepLink {
    data class Invitation(val value: InvitationDeepLink) : NativeDeepLink
    /**
     * A Wedding Pass link. [token] is the credential that identifies *which* pass — P0-9: it must
     * be carried through resolution, never discarded and replaced with a default guest.
     */
    data class Pass(val token: String? = null) : NativeDeepLink
    data class Wedding(val weddingSlug: String) : NativeDeepLink

    /**
     * Canonical IA V2 §14 workspace link, e.g. `wewed://wedding/{id}/plan/tasks`.
     * Carries the requested entity/context only; authorization is resolved separately by
     * `DeepLinkRouter` so a link can never be its own permission.
     */
    data class Workspace(
        val weddingId: String?,
        val destinationId: String,
        val section: String? = null,
        val entityId: String? = null
    ) : NativeDeepLink
}

object NativeDeepLinkParser {
    fun parse(rawUrl: String?): NativeDeepLink? {
        if (rawUrl.isNullOrBlank()) return null

        return runCatching {
            val uri = URI(rawUrl.trim())
            val scheme = uri.scheme?.lowercase() ?: return@runCatching null
            val route = uri.path
                .orEmpty()
                .split("/")
                .filter { it.isNotBlank() }
                .toMutableList()

            when (scheme) {
                "https" -> {
                    val host = uri.host?.lowercase()
                    if (host != "wewed.pro" && host != "www.wewed.pro") {
                        return@runCatching null
                    }
                }
                "wewed" -> {
                    uri.host?.takeIf { it.isNotBlank() }?.let { route.add(0, it) }
                }
                else -> return@runCatching null
            }

            when (route.firstOrNull()?.lowercase()) {
                "invite" -> {
                    val weddingSlug = route.getOrNull(1)?.trim().orEmpty()
                    val rsvpToken = queryParameter(uri.rawQuery, "rsvp").orEmpty().trim()
                    if (weddingSlug.isEmpty() || rsvpToken.isEmpty()) null
                    else NativeDeepLink.Invitation(
                        InvitationDeepLink(
                            weddingSlug = weddingSlug,
                            rsvpToken = rsvpToken
                        )
                    )
                }
                "pass" -> NativeDeepLink.Pass(
                    route.getOrNull(1)?.trim()?.takeIf { it.isNotEmpty() }
                )
                // IA V2 §14 canonical workspace routes. Parsing only — never authorization.
                "wedding" -> {
                    val weddingId = route.getOrNull(1)?.trim().orEmpty()
                    val requested = route.getOrNull(2)?.trim()?.lowercase()
                    if (weddingId.isEmpty() || requested.isNullOrEmpty()) null
                    else when (requested) {
                        "invitation" -> route.getOrNull(3)?.trim()?.takeIf { it.isNotEmpty() }?.let {
                            NativeDeepLink.Invitation(InvitationDeepLink(weddingId, it))
                        }
                        else -> NativeDeepLink.Workspace(
                            weddingId = weddingId,
                            destinationId = if (requested == "day") "wedding_day" else requested,
                            section = route.getOrNull(3)?.trim()?.takeIf { it.isNotEmpty() }
                        )
                    }
                }
                "planner" -> route.getOrNull(1)?.trim()?.lowercase()
                    ?.takeIf { it.isNotEmpty() }
                    ?.let {
                        NativeDeepLink.Workspace(
                            weddingId = route.getOrNull(2)?.trim(),
                            destinationId = it
                        )
                    }
                "vendor" -> route.getOrNull(1)?.trim()?.lowercase()
                    ?.takeIf { it.isNotEmpty() }
                    ?.let {
                        NativeDeepLink.Workspace(
                            weddingId = null,
                            destinationId = it,
                            entityId = route.getOrNull(2)?.trim()
                        )
                    }
                "gate" -> {
                    val gateId = route.getOrNull(1)?.trim()
                    val requested = route.getOrNull(2)?.trim()?.lowercase() ?: "scan"
                    if (gateId.isNullOrEmpty()) null
                    else NativeDeepLink.Workspace(
                        weddingId = null,
                        destinationId = requested,
                        entityId = gateId
                    )
                }
                "admin" -> route.getOrNull(1)?.trim()?.lowercase()
                    ?.takeIf { it.isNotEmpty() }
                    ?.let {
                        NativeDeepLink.Workspace(
                            weddingId = null,
                            destinationId = it,
                            entityId = route.getOrNull(2)?.trim()
                        )
                    }
                "w" -> route.getOrNull(1)?.trim()
                    ?.takeIf { it.isNotEmpty() }
                    ?.let { NativeDeepLink.Wedding(it) }
                else -> null
            }
        }.getOrNull()
    }

    private fun queryParameter(rawQuery: String?, name: String): String? {
        if (rawQuery.isNullOrBlank()) return null
        return rawQuery
            .split("&")
            .mapNotNull { part ->
                val separator = part.indexOf('=')
                val rawName = if (separator >= 0) part.substring(0, separator) else part
                val rawValue = if (separator >= 0) part.substring(separator + 1) else ""
                val decodedName = URLDecoder.decode(rawName, StandardCharsets.UTF_8.name())
                if (decodedName == name) {
                    URLDecoder.decode(rawValue, StandardCharsets.UTF_8.name())
                } else null
            }
            .firstOrNull()
    }
}
