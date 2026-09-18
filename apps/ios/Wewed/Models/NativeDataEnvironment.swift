import Foundation

public enum NativeDataEnvironment: String, Codable, CaseIterable, Sendable {
    case fixture
    case shadow
    case productionReadVerify = "production_read_verify"
    case production

    public var title: String {
        switch self {
        case .fixture: return "Fixture"
        case .shadow: return "Shadow"
        case .productionReadVerify: return "Production Read Verify"
        case .production: return "Production"
        }
    }

    public var allowsMutableNativeDevelopment: Bool {
        switch self {
        case .fixture, .shadow: return true
        case .productionReadVerify, .production: return false
        }
    }
}
