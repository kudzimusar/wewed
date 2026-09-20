package pro.wewed.app.services

import pro.wewed.app.models.NativeDataEnvironment

/**
 * System-level administrative projection (P0-13).
 *
 * Admin is system-scoped in IA V2: Dashboard, Cases, Accounts and Audit describe the platform,
 * not one wedding. Reading them from the wedding graph forced a global console to depend on an
 * active wedding, which is why Admin previously needed a wedding context just to open.
 *
 * Wedding-scoped data is loaded only after an administrator deliberately drills into a wedding.
 */
data class AdminSystemSnapshot(
    val environment: NativeDataEnvironment,
    /** Weddings this administrator may act on; the console itself does not require one. */
    val weddingsInScope: Int,
    /** Native contracts that do not exist yet, surfaced as honest unsupported states. */
    val unsupportedStreams: List<String>
)

interface AdminSystemRepository {
    suspend fun snapshot(): AdminSystemSnapshot
}

/**
 * The only administrative source available natively today.
 *
 * The protected snapshot contains no support cases, no account administration records, no payment
 * events and no audit stream, so this reports scope honestly and names what is missing rather
 * than borrowing wedding rows to fill a dashboard.
 */
class ShadowAdminSystemRepository(
    private val weddingRepository: WeddingRepository,
    private val environment: NativeDataEnvironment
) : AdminSystemRepository {
    override suspend fun snapshot(): AdminSystemSnapshot = AdminSystemSnapshot(
        environment = environment,
        weddingsInScope = runCatching { weddingRepository.availableWeddingIds().size }.getOrDefault(0),
        unsupportedStreams = listOf(
            "Support cases",
            "Account administration",
            "Access and role-membership records",
            "Payment events",
            "Data-change and access audit streams"
        )
    )
}
