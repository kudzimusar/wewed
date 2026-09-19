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
    data object Pass : NativeDeepLink
    data class Wedding(val weddingSlug: String) : NativeDeepLink
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
                "pass" -> NativeDeepLink.Pass
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
