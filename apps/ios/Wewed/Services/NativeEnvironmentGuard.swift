import Foundation

public enum NativeEnvironmentGuardError: Error, Equatable, Sendable {
    case productionDisabled
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
        if environment == .production {
            throw NativeEnvironmentGuardError.productionDisabled
        }

        guard environment == .shadow, let host = baseURL?.host?.lowercased() else {
            return
        }

        if productionHosts.contains(host) {
            throw NativeEnvironmentGuardError.shadowPointsToProductionHost(host)
        }
    }
}
