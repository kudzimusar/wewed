package pro.wewed.app.navigation

/**
 * How strongly a role depends on a context scope (P0-3, P0-15).
 *
 * The previous model treated every missing scope as satisfied, so a vendor with no engagement and
 * an usher with no gate both looked "complete". These three kinds make the distinction explicit.
 */
enum class ScopeRequirement(val key: String) {
    /** Must be resolved from a verified relationship before the workspace opens. */
    REQUIRED("required"),

    /** Selectable when a relationship exists; absent means unselected, not invalid. */
    OPTIONAL("optional"),

    /** Global administrative scope; not tied to a single wedding. */
    SYSTEM("system");

    companion object {
        fun fromKey(key: String): ScopeRequirement =
            entries.firstOrNull { it.key == key } ?: OPTIONAL
    }
}

/** A context dimension together with how strongly the role depends on it. */
data class ScopeDeclaration(
    val scope: ContextScope,
    val requirement: ScopeRequirement
)
