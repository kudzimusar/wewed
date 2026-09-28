import Foundation

/// How strongly a role depends on a context scope (P0-3, P0-15).
///
/// The previous model treated every missing scope as satisfied, so a vendor with no engagement and
/// an usher with no gate both looked "complete". These three kinds make the distinction explicit.
public enum ScopeRequirement: String, Equatable, Sendable {
    /// Must be resolved from a verified relationship before the workspace opens.
    case required
    /// Selectable when a relationship exists; absent means unselected, not invalid.
    case optional
    /// Global administrative scope; not tied to a single wedding.
    case system

    public static func fromKey(_ key: String) -> ScopeRequirement {
        ScopeRequirement(rawValue: key) ?? .optional
    }
}

/// A context dimension together with how strongly the role depends on it.
public struct ScopeDeclaration: Equatable, Sendable {
    public let scope: ContextScope
    public let requirement: ScopeRequirement

    public init(_ scope: ContextScope, _ requirement: ScopeRequirement) {
        self.scope = scope
        self.requirement = requirement
    }
}
