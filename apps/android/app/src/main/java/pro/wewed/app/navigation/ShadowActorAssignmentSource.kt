package pro.wewed.app.navigation

import pro.wewed.app.models.AppRole
import pro.wewed.app.models.DevelopmentPersona
import pro.wewed.app.models.NativeDataEnvironment
import pro.wewed.app.services.PlannerDashboardRepository
import pro.wewed.app.services.WeddingRepository
import pro.wewed.app.services.forWedding

/**
 * Resolves actor assignments for the non-production environments, verifying every scoped id
 * against the canonical repository before it is trusted (P0-2, P0-3).
 *
 * Nothing here invents a scope. A vendor engagement must exist as a real `VendorPresence` on the
 * wedding; a guest identity must be resolvable from a real credential; a gate must be declared in
 * the Shadow assignment table below. When the repository cannot confirm the relationship, no
 * assignment is returned and the workspace is denied rather than opened with a placeholder.
 *
 * Every assignment produced here is marked [ActorAssignment.isShadowTestAccess] unless it is the
 * couple's own wedding, because Shadow authorisation is test access — not a production
 * relationship (P0-13).
 */
class ShadowActorAssignmentSource(
    private val repository: WeddingRepository,
    private val environment: NativeDataEnvironment,
    /** Supplies service engagements, which live in the planner projection, not the wedding graph. */
    private val plannerRepository: PlannerDashboardRepository? = null,
    private val personas: List<DevelopmentPersona> = DevelopmentPersona.allPersonas,
    private val scenario: AuthorizedScenario = AuthorizedScenario.CHARITY_AND_KUDZIE,
    private val gateAssignments: Map<String, String> = SHADOW_GATE_ASSIGNMENTS,
    private val guestCredentials: Map<String, String> = SHADOW_GUEST_CREDENTIALS
) : ActorAssignmentSource {

    override suspend fun assignments(actorId: String): List<ActorAssignment> {
        val persona = personas.firstOrNull { it.id == actorId } ?: return emptyList()

        // The persona names an authorized scenario and actor, never a wedding id: the same real
        // wedding has a different identity in fixture, sanitized Shadow and Private Real Shadow.
        // The environment-canonical id is declared per environment and must also be served by the
        // loaded repository, so a misprovisioned environment yields no assignment at all.
        val weddingId = EnvironmentWeddingDirectory.resolveWeddingId(repository, scenario, environment)
            ?: return emptyList()
        val scoped = runCatching { repository.forWedding(weddingId) }.getOrNull() ?: return emptyList()
        val shadowTest = persona.role != AppRole.COUPLE

        return when (persona.role) {
            AppRole.COUPLE, AppRole.PLANNER, AppRole.COORDINATOR -> listOf(
                ActorAssignment(
                    actorId = actorId,
                    role = persona.role,
                    weddingId = weddingId,
                    // No verified client record exists in Shadow; client stays unresolved rather
                    // than being set to the wedding id (P0-3).
                    clientId = null,
                    isShadowTestAccess = shadowTest
                )
            )

            AppRole.VENDOR -> {
                // P0-9: resolve the VENDOR first, then its service engagements separately. The
                // vendor id and an engagement id are different entities; a vendor may hold several
                // engagements, and most in the Private Real Shadow graph are historical records.
                val vendor = runCatching { scoped.getVendors() }.getOrNull()
                    ?.firstOrNull { it.vendorName.equals(persona.name, ignoreCase = true) }
                    ?: return emptyList()

                val engagements = runCatching { plannerRepository?.getVendorEngagements() }
                    .getOrNull()
                    .orEmpty()
                    .filter { engagement ->
                        engagement.vendorId == vendor.id ||
                            engagement.vendorName.equals(vendor.vendorName, ignoreCase = true)
                    }

                listOf(
                    ActorAssignment(
                        actorId = actorId,
                        role = AppRole.VENDOR,
                        weddingId = weddingId,
                        vendorId = vendor.id,
                        // Auto-select only when exactly one engagement exists. Several means the
                        // vendor must choose; none means there is nothing to select.
                        engagementId = engagements.singleOrNull()?.id,
                        isShadowTestAccess = true
                    )
                )
            }

            AppRole.GUEST -> {
                // The Private Real Shadow snapshot carries no invitation or pass credentials, so a
                // documented Shadow-only overlay supplies them. The overlay uses the stable
                // id-addressed form (`real-pass-<guestId>`) rather than a predicate token such as
                // "first attending guest", which would reintroduce order-dependent identity.
                val token = guestCredentials[actorId] ?: return emptyList()
                // Identity comes from the credential, resolved by the repository (P0-4/P0-5).
                val identity = runCatching { scoped.resolveGuestIdentity(token) }.getOrNull()
                    ?: return emptyList()
                if (identity.weddingId != weddingId) return emptyList()
                listOf(
                    ActorAssignment(
                        actorId = actorId,
                        role = AppRole.GUEST,
                        weddingId = weddingId,
                        guestId = identity.guestId,
                        passToken = identity.passToken,
                        isShadowTestAccess = true
                    )
                )
            }

            AppRole.USHER -> {
                // A gate assignment is a declared Shadow record, not a display string invented by
                // the root. Without one, the gate role has no authorised scope.
                val gateId = gateAssignments[actorId] ?: return emptyList()
                listOf(
                    ActorAssignment(
                        actorId = actorId,
                        role = AppRole.USHER,
                        weddingId = weddingId,
                        gateId = gateId,
                        isShadowTestAccess = true
                    )
                )
            }

            AppRole.ADMIN -> listOf(
                // Admin is system-scoped: no wedding is required to open the console (P0-15).
                ActorAssignment(
                    actorId = actorId,
                    role = AppRole.ADMIN,
                    weddingId = null,
                    isShadowTestAccess = true
                )
            )
        }
    }

    companion object {
        /**
         * Declared Shadow gate assignments, keyed by actor.
         *
         * This is the Shadow environment's assignment record. It is deliberately explicit and
         * auditable; an actor absent from this table has no gate and is denied the Gate workspace.
         */
        val SHADOW_GATE_ASSIGNMENTS: Map<String, String> = mapOf(
            "gate_usher" to "gate_main_entrance"
        )

        /**
         * Credentials that identify each Shadow guest actor. Two distinct guests are declared so
         * identity binding cannot pass by collection order (P0-4).
         */
        val SHADOW_GUEST_CREDENTIALS: Map<String, String> = mapOf(
            "attending_guest" to "shadow-attending-guest",
            "attending_guest_party4" to "shadow-party4-guest"
        )
    }
}
