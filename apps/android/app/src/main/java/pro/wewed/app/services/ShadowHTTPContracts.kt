package pro.wewed.app.services

import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.models.PlannerActivityItem
import pro.wewed.app.models.PlannerAttentionItem
import pro.wewed.app.models.PlannerAttentionSeverity
import pro.wewed.app.models.PlannerBudgetLine
import pro.wewed.app.models.PlannerContributionRecord
import pro.wewed.app.models.PlannerDashboardSnapshot
import pro.wewed.app.models.PlannerModuleSummary
import pro.wewed.app.models.PlannerSeatingTable
import pro.wewed.app.models.PlannerTimelineEntry
import pro.wewed.app.models.PlannerVendorEngagement

sealed class ShadowAPIError(message: String) : IllegalStateException(message) {
    data object InvalidEnvironment : ShadowAPIError("Shadow repository requires the SHADOW environment.")
    data object TransportNotConfigured : ShadowAPIError("Shadow HTTP transport is not configured.")
}

data class ShadowRepositoryConfiguration(
    val baseUrl: String,
    val environment: NativeDataEnvironment = NativeDataEnvironment.SHADOW
) {
    init {
        if (environment != NativeDataEnvironment.SHADOW) {
            throw ShadowAPIError.InvalidEnvironment
        }
        NativeEnvironmentGuard.validate(baseUrl, environment)
    }
}

interface ShadowAPITransport {
    suspend fun get(path: String): String
    suspend fun post(path: String, body: String): String
    suspend fun patch(path: String, body: String): String
}

class UnconfiguredShadowAPITransport : ShadowAPITransport {
    override suspend fun get(path: String): String = throw ShadowAPIError.TransportNotConfigured
    override suspend fun post(path: String, body: String): String = throw ShadowAPIError.TransportNotConfigured
    override suspend fun patch(path: String, body: String): String = throw ShadowAPIError.TransportNotConfigured
}

object ShadowEndpoint {
    const val PLANNER_DASHBOARD = "/mobile-shadow/planner/overview"
    const val PLANNER_BUDGET = "/mobile-shadow/planner/budget"
    const val PLANNER_CONTRIBUTIONS = "/mobile-shadow/planner/contributions"
    const val PLANNER_VENDORS = "/mobile-shadow/planner/vendors"
    const val PLANNER_SEATING = "/mobile-shadow/planner/seating"
    const val PLANNER_TIMELINE = "/mobile-shadow/planner/timeline"
    const val WEDDING_CONTEXT = "/mobile-shadow/wedding"
    const val GUESTS = "/mobile-shadow/guests"
    const val INVITATION = "/mobile-shadow/invitation"
    const val PASS = "/mobile-shadow/pass"
}

/**
 * Contract placeholder for the future shadow Planner HTTP repository.
 *
 * Android deliberately has no JSON/network dependency added in this phase.
 * The interface is fixed now; transport/serialization is added only after the
 * real Shadow backend contract is approved.
 */
interface ShadowPlannerWireContract {
    suspend fun plannerDashboardJson(): String
    suspend fun budgetJson(): String
    suspend fun contributionsJson(): String
    suspend fun vendorsJson(): String
    suspend fun seatingJson(): String
    suspend fun timelineJson(): String
}

class TransportBackedShadowPlannerWireContract(
    private val configuration: ShadowRepositoryConfiguration,
    private val transport: ShadowAPITransport = UnconfiguredShadowAPITransport()
) : ShadowPlannerWireContract {
    init {
        // Keep configuration strongly referenced and validated at construction.
        NativeEnvironmentGuard.validate(configuration.baseUrl, configuration.environment)
    }

    override suspend fun plannerDashboardJson(): String = transport.get(ShadowEndpoint.PLANNER_DASHBOARD)
    override suspend fun budgetJson(): String = transport.get(ShadowEndpoint.PLANNER_BUDGET)
    override suspend fun contributionsJson(): String = transport.get(ShadowEndpoint.PLANNER_CONTRIBUTIONS)
    override suspend fun vendorsJson(): String = transport.get(ShadowEndpoint.PLANNER_VENDORS)
    override suspend fun seatingJson(): String = transport.get(ShadowEndpoint.PLANNER_SEATING)
    override suspend fun timelineJson(): String = transport.get(ShadowEndpoint.PLANNER_TIMELINE)
}
