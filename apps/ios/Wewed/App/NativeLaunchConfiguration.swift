import Foundation

public struct NativeLaunchConfiguration: Equatable, Sendable {
    public let environment: NativeDataEnvironment
    public let baseURL: URL?

    public init(environment: NativeDataEnvironment, baseURL: URL? = nil) {
        self.environment = environment
        self.baseURL = baseURL
    }

    /// Whether this binary is a development build.
    public static var isDebugBuildDefault: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }

    public static func resolve(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        arguments: [String] = ProcessInfo.processInfo.arguments,
        isDebugBuild: Bool = NativeLaunchConfiguration.isDebugBuildDefault
    ) -> NativeLaunchConfiguration {
        let environmentValue = environment["WEWED_NATIVE_ENV"]?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let argumentValue = launchArgumentValue(named: "wewed_native_env", arguments: arguments)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let rawEnvironment = environmentValue ?? argumentValue
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
            // An ordinary launch — a Universal Link from Safari, a tap in WhatsApp, the home
            // screen icon — must not have its data source decided by whether a file happens to
            // exist on the device.
            //
            // It used to. The resolver checked for the Private Real Shadow snapshot and silently
            // selected that environment when it found one, so the guest invitation journey
            // depended on a qualification artefact being present, and changed behaviour when it
            // was not. Private Real Shadow is a qualification configuration and is now entered
            // only when it is explicitly asked for.
            //
            // A release build falls through to `.production`, which the repository factory
            // currently refuses — loudly and on purpose. Refusing to start is the correct
            // behaviour for a release build with no live data path; silently showing a real guest
            // demo data is not.
            dataEnvironment = isDebugBuild ? .sanitizedShadow : .production
        }

        let argumentBaseURL = launchArgumentValue(named: "wewed_shadow_base_url", arguments: arguments)
        let baseURL = (environment["WEWED_SHADOW_API_BASE_URL"] ?? argumentBaseURL).flatMap(URL.init(string:))
        return NativeLaunchConfiguration(environment: dataEnvironment, baseURL: baseURL)
    }

    private static func launchArgumentValue(named name: String, arguments: [String]) -> String? {
        let normalizedNames = [name, "--\(name)", "-\(name)"]
        for (index, argument) in arguments.enumerated() {
            for candidate in normalizedNames {
                if argument == candidate, arguments.indices.contains(index + 1) {
                    return arguments[index + 1]
                }
                let prefix = "\(candidate)="
                if argument.hasPrefix(prefix) {
                    return String(argument.dropFirst(prefix.count))
                }
            }
        }
        return nil
    }
}

public extension NativeLaunchConfiguration {
    /// Development/Shadow qualification only (P0-16): lets automated role traversal start as a
    /// specific authorized persona. Ignored entirely in production and production-read-verify.
    ///
    /// Read from `-wewed_native_persona <id>` or the `wewed_native_persona` environment variable,
    /// mirroring the Android launch extra.
    static func requestedPersonaId(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        arguments: [String] = ProcessInfo.processInfo.arguments
    ) -> String? {
        if let index = arguments.firstIndex(of: "-wewed_native_persona"),
           index + 1 < arguments.count {
            let value = arguments[index + 1].trimmingCharacters(in: .whitespacesAndNewlines)
            if !value.isEmpty { return value }
        }
        if let value = environment["wewed_native_persona"]?.trimmingCharacters(in: .whitespacesAndNewlines),
           !value.isEmpty {
            return value
        }
        return nil
    }
}
