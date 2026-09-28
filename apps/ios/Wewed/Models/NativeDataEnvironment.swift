import Foundation

public enum NativeDataEnvironment: String, Codable, CaseIterable, Sendable {
    case fixture
    case shadow
    case sanitizedShadow = "sanitized_shadow"
    case privateRealShadow = "private_real_shadow"
    case productionReadVerify = "production_read_verify"
    case production

    /// The environment name as it is shown to a person, e.g. on the welcome surface.
    public var displayName: String { title }

    public var title: String {
        switch self {
        case .fixture: return "Fixture"
        case .shadow, .sanitizedShadow: return "Sanitized Shadow"
        case .privateRealShadow: return "Private Real Shadow"
        case .productionReadVerify: return "Production Read Verify"
        case .production: return "Production"
        }
    }

    public var allowsMutableNativeDevelopment: Bool {
        switch self {
        case .fixture, .shadow, .sanitizedShadow, .privateRealShadow: return true
        case .productionReadVerify, .production: return false
        }
    }

    /// Whether development persona switching may be offered (P0-16).
    ///
    /// Persona switching hands an actor an arbitrary role. That is a development and Shadow
    /// qualification affordance only: in production the available roles must come from the actor's
    /// real authorizations, never from a picker.
    public var allowsDevelopmentPersonaSwitching: Bool { allowsMutableNativeDevelopment }
}
