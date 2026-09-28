import SwiftUI

/// Remembers the selected Level-2 section per role + context + workspace (P0-17).
///
/// Previously each `WorkspaceSurface` owned local state, so leaving Plan and coming back reset the
/// worksheet to the first section. Hoisting selection here keeps it across destination switches,
/// while still being scoped tightly enough that two different weddings never share a selection.
@MainActor
public final class WorkspaceSectionMemory: ObservableObject {
    @Published private var selections: [String: String] = [:]

    public init() {}

    private func key(_ context: NavigationContext, _ destinationId: String) -> String {
        "\(context.activeRole.roleId)|\(context.activeWeddingId)|\(destinationId)"
    }

    public func selected(_ context: NavigationContext, _ destinationId: String, default defaultValue: String) -> String {
        selections[key(context, destinationId)] ?? defaultValue
    }

    public func select(_ context: NavigationContext, _ destinationId: String, _ section: String) {
        selections[key(context, destinationId)] = section
    }

    /// Applies a section requested by a deep link, when the workspace actually declares it.
    public func applyRequested(
        context: NavigationContext,
        destinationId: String,
        requested: String?,
        available: [String]
    ) {
        guard let requested else { return }
        guard let match = available.first(where: {
            $0.caseInsensitiveCompare(requested) == .orderedSame || $0.iaSlug == requested.iaSlug
        }) else { return }
        select(context, destinationId, match)
    }
}
