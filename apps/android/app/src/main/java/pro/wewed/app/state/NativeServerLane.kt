package pro.wewed.app.state

import java.net.URI

/**
 * A Vercel "Protection Bypass for Automation" secret for a protected Preview deployment.
 *
 * DEBUG qualification only: supplied by a launch extra, never compiled in, and never printed —
 * [toString] is redacted so it cannot reach logcat, test output or a crash report.
 */
class NativePreviewProtectionBypass private constructor(internal val secret: String) {
    override fun toString(): String = "<redacted>"
    override fun equals(other: Any?): Boolean = other is NativePreviewProtectionBypass && other.secret == secret
    override fun hashCode(): Int = secret.hashCode()

    companion object {
        const val HEADER_NAME = "x-vercel-protection-bypass"

        fun of(raw: String?): NativePreviewProtectionBypass? =
            raw?.trim()?.takeIf { it.isNotEmpty() }?.let(::NativePreviewProtectionBypass)
    }
}

/**
 * Which Wewed server the real production clients talk to.
 *
 * The data environment is PRODUCTION in both lanes: the same `ProductionAuthorityClient`,
 * `NativeDomainApiClient`, `GuestSessionClient` and Wedding Day transport, with the same
 * server-issued authority and no Shadow, fixture or persona path. Only the origin differs.
 * A release build can only ever be [Production] (https://wewed.pro).
 */
sealed class NativeServerLane {
    abstract val origin: String

    object Production : NativeServerLane() {
        override val origin: String = NativeServerOrigin.PRODUCTION
        override fun toString(): String = "Production($origin)"
    }

    data class ProductionPreview(
        override val origin: String,
        val protectionBypass: NativePreviewProtectionBypass?
    ) : NativeServerLane() {
        override fun toString(): String =
            "ProductionPreview($origin, bypass=${if (protectionBypass == null) "none" else "<redacted>"})"
    }

    val isPreview: Boolean get() = this is ProductionPreview

    /** Credentials issued by one origin are never presented to another. */
    fun storageName(base: String): String = if (isPreview) "${base}_production_preview" else base

    /**
     * Headers every real transport adds to a request for [requestUrl]. Only a Preview lane adds
     * anything, and only for its own origin.
     */
    fun additionalHeaders(requestUrl: String): Map<String, String> {
        if (this !is ProductionPreview) return emptyMap()
        val bypass = protectionBypass ?: return emptyMap()
        val prefix = origin.trimEnd('/') + "/"
        return if (requestUrl == origin || requestUrl.startsWith(prefix)) {
            mapOf(NativePreviewProtectionBypass.HEADER_NAME to bypass.secret)
        } else {
            emptyMap()
        }
    }
}

sealed class NativePreviewOriginRejection {
    object Missing : NativePreviewOriginRejection() { override fun toString() = "missing" }
    object Malformed : NativePreviewOriginRejection() { override fun toString() = "malformed" }
    object InsecureScheme : NativePreviewOriginRejection() { override fun toString() = "insecureScheme" }
    object ProductionHost : NativePreviewOriginRejection() { override fun toString() = "productionHost" }
    object UnexpectedComponents : NativePreviewOriginRejection() { override fun toString() = "unexpectedComponents" }
    data class HostNotAllowlisted(val host: String) : NativePreviewOriginRejection()
}

sealed class NativePreviewOriginValidation {
    data class Accepted(val origin: String) : NativePreviewOriginValidation()
    data class Rejected(val reason: NativePreviewOriginRejection) : NativePreviewOriginValidation()
}

object NativeServerOrigin {
    /** The only origin a release build can reach. */
    const val PRODUCTION = "https://wewed.pro"
    val PRODUCTION_HOSTS = setOf("wewed.pro", "www.wewed.pro")

    /**
     * Compiled Preview allowlist: deployments of the `wewed` Vercel project in the `11-11` team
     * (`wewed-<deployment-or-branch>-11-11.vercel.app`). Identical to iOS.
     */
    private val APPROVED_PREVIEW_HOST = Regex("^wewed-[a-z0-9]([a-z0-9-]*[a-z0-9])?-11-11\\.vercel\\.app$")

    internal fun isApprovedPreviewHost(host: String): Boolean = APPROVED_PREVIEW_HOST.matches(host)

    /** Loopback only, for a locally run integration backend. */
    internal fun isLocalTestHost(host: String): Boolean = host == "127.0.0.1" || host == "localhost"

    /**
     * Validates a DEBUG qualification origin: https + allowlisted Preview host, or http(s)
     * loopback. Rejects everything else, including the production host (Production has its own
     * lane) and any path, query, fragment or embedded credentials.
     */
    fun validatePreviewOrigin(raw: String?): NativePreviewOriginValidation {
        val trimmed = raw?.trim().orEmpty()
        if (trimmed.isEmpty()) return NativePreviewOriginValidation.Rejected(NativePreviewOriginRejection.Missing)
        val uri = runCatching { URI(trimmed) }.getOrNull()
        val scheme = uri?.scheme?.lowercase()
        val host = uri?.host?.lowercase()
        if (uri == null || scheme == null || host.isNullOrEmpty()) {
            return NativePreviewOriginValidation.Rejected(NativePreviewOriginRejection.Malformed)
        }
        val path = uri.rawPath.orEmpty()
        if (uri.rawUserInfo != null || uri.rawQuery != null || uri.rawFragment != null || !(path.isEmpty() || path == "/")) {
            return NativePreviewOriginValidation.Rejected(NativePreviewOriginRejection.UnexpectedComponents)
        }
        if (host in PRODUCTION_HOSTS || host == "api.wewed.pro") {
            return NativePreviewOriginValidation.Rejected(NativePreviewOriginRejection.ProductionHost)
        }
        if (isLocalTestHost(host)) {
            if (scheme != "http" && scheme != "https") {
                return NativePreviewOriginValidation.Rejected(NativePreviewOriginRejection.InsecureScheme)
            }
        } else {
            if (scheme != "https") {
                return NativePreviewOriginValidation.Rejected(NativePreviewOriginRejection.InsecureScheme)
            }
            if (uri.port != -1 || !isApprovedPreviewHost(host)) {
                return NativePreviewOriginValidation.Rejected(NativePreviewOriginRejection.HostNotAllowlisted(host))
            }
        }
        val port = if (uri.port == -1) "" else ":${uri.port}"
        return NativePreviewOriginValidation.Accepted("$scheme://$host$port")
    }

    /**
     * The origin of the guest-only shell. A release build always uses the lane origin
     * (https://wewed.pro); the historical DEBUG `wewed_guest_base_url` stub override is honoured
     * only when it passes the same qualification allowlist as the Preview lane — it used to accept
     * any host. A rejected override is returned as such so the caller fails closed rather than
     * silently falling back to production.
     */
    fun guestOrigin(isDebugBuild: Boolean, override: String?, lane: NativeServerLane): NativePreviewOriginValidation {
        if (!isDebugBuild || override == null) return NativePreviewOriginValidation.Accepted(lane.origin)
        return validatePreviewOrigin(override)
    }

    @Volatile
    var active: NativeServerLane = NativeServerLane.Production
        private set

    /** The lane chosen at launch. Set once, before any client is built. */
    @Synchronized
    fun activate(lane: NativeServerLane) {
        active = lane
    }

    /**
     * Hosts whose wedding/invitation URLs identify a Wewed destination for this process: the
     * production hosts, plus the one validated Preview host while the Preview lane is active.
     */
    fun isWeddingHost(host: String?): Boolean {
        val normalized = host?.lowercase() ?: return false
        if (normalized in PRODUCTION_HOSTS) return true
        val lane = active
        return lane is NativeServerLane.ProductionPreview &&
            runCatching { URI(lane.origin).host?.lowercase() }.getOrNull() == normalized
    }
}
