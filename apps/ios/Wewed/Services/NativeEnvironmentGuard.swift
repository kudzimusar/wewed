import Foundation

public enum NativeEnvironmentGuardError: Error, Equatable, Sendable {
    case shadowPointsToProductionHost(String)
}

public enum NativeEnvironmentGuard {
    private static let productionHosts: Set<String> = [
        "wewed.pro",
        "www.wewed.pro",
        "api.wewed.pro",
        "pro.wewed.app"
    ]

    public static func validate(baseURL: URL?, environment: NativeDataEnvironment) throws {
        let shadowFamily: Set<NativeDataEnvironment> = [
            .shadow,
            .sanitizedShadow,
            .privateRealShadow
        ]
        guard shadowFamily.contains(environment),
              let host = baseURL?.host?.lowercased() else {
            return
        }

        if productionHosts.contains(host) {
            throw NativeEnvironmentGuardError.shadowPointsToProductionHost(host)
        }
    }
}
