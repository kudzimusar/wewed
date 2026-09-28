package pro.wewed.app.ui.roles

import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import pro.wewed.app.navigation.NavigationContext

/**
 * Remembers the selected Level-2 section per role + context + workspace (P0-17).
 *
 * Previously each `WorkspaceSurface` owned local state, so leaving Plan and coming back reset the
 * worksheet to the first section. Hoisting selection here keeps it across destination switches,
 * while still being scoped tightly enough that two different weddings never share a selection.
 */
class WorkspaceSectionMemory {
    private val selections = mutableStateMapOf<String, String>()

    private fun key(context: NavigationContext, destinationId: String): String =
        "${context.activeRole.roleId}|${context.activeWeddingId}|$destinationId"

    fun selected(context: NavigationContext, destinationId: String, default: String): String =
        selections[key(context, destinationId)] ?: default

    fun select(context: NavigationContext, destinationId: String, section: String) {
        selections[key(context, destinationId)] = section
    }

    /** Applies a section requested by a deep link, when the workspace actually declares it. */
    fun applyRequested(context: NavigationContext, destinationId: String, requested: String?, available: List<String>) {
        val match = requested?.let { wanted ->
            available.firstOrNull { it.equals(wanted, ignoreCase = true) || it.iaSlug() == wanted.iaSlug() }
        } ?: return
        select(context, destinationId, match)
    }
}

/** Slug used to match a deep-link section against a documented section label. */
fun String.iaSlug(): String = lowercase().replace(Regex("[^a-z0-9]+"), "-").trim('-')

@Composable
fun rememberWorkspaceSectionMemory(): WorkspaceSectionMemory = remember { WorkspaceSectionMemory() }
