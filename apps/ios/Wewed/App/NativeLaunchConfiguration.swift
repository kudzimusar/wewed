import Foundation

public struct NativeLaunchConfiguration: Equatable, Sendable {
    public let environment: NativeDataEnvironment
    public let baseURL: URL?

    public init(environment: NativeDataEnvironment, baseURL: URL? = nil) {
        self.environment = environment
        self.baseURL = baseURL
    }

    public static func resolve(
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> NativeLaunchConfiguration {
        let rawEnvironment = environment["WEWED_NATIVE_ENV"]?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let dataEnvironment: NativeDataEnvironment

        switch rawEnvironment {
        case "private_real_shadow", "private-real-shadow", "private_shadow", "private":
            dataEnvironment = .privateRealShadow
        case "sanitized_shadow", "sanitized-shadow":
            dataEnvironment = .sanitizedShadow
        case "shadow":
            dataEnvironment = .shadow
        case "production_read_verify", "production-read-verify":
            dataEnvironment = .productionReadVerify
        case "production":
            dataEnvironment = .production
        case "fixture":
            dataEnvironment = .fixture
        default:
            let privatePath = PrivateRealShadowWeddingRepository.defaultSnapshotPath()
            dataEnvironment = FileManager.default.fileExists(atPath: privatePath)
                ? .privateRealShadow
                : .sanitizedShadow
        }

        let baseURL = environment["WEWED_SHADOW_API_BASE_URL"].flatMap(URL.init(string:))
        return NativeLaunchConfiguration(environment: dataEnvironment, baseURL: baseURL)
    }
}
