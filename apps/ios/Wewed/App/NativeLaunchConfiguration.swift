import Foundation

public struct NativeLaunchConfiguration: Equatable, Sendable {
    public let environment: NativeDataEnvironment
    public let baseURL: URL?
    /// The server the real production clients use. Always `.production` outside DEBUG.
    public let lane: NativeServerLane
    /// Set when a DEBUG `production_preview` launch named no, or an unapproved, origin. The app
    /// must then build nothing: it never silently falls back to https://wewed.pro, because a
    /// qualifier believing they are on Preview would otherwise act on live production data.
    public let previewOriginRejection: NativePreviewOriginRejection?

    public init(
        environment: NativeDataEnvironment,
        baseURL: URL? = nil,
        lane: NativeServerLane = .production,
        previewOriginRejection: NativePreviewOriginRejection? = nil
    ) {
        self.environment = environment
        self.baseURL = baseURL
        self.lane = lane
        self.previewOriginRejection = previewOriginRejection
    }

    /// The Release/production launch: https://wewed.pro, and nothing else.
    public static let production = NativeLaunchConfiguration(
        environment: .production,
        baseURL: NativeServerOrigin.production,
        lane: .production
    )

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
        // A release binary is Production, whatever it is launched with. The environment variable
        // and launch argument are qualification inputs; honouring them in a release build left the
        // store-identity check in the repository factory as the only barrier between a launch
        // input and a Shadow runtime (master plan §8.10).
        guard isDebugBuild else { return .production }
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
            // Real production authority at the one production origin. The Shadow base URL input
            // never applies to production.
            return .production
        case "production_preview", "production-preview":
            // DEBUG qualification lane: the exact production clients and authority rules, against
            // one allowlisted Preview origin. Not Shadow, not Fixture, never a persona.
            let rawOrigin = environment["WEWED_PREVIEW_ORIGIN"]
                ?? launchArgumentValue(named: "wewed_preview_origin", arguments: arguments)
            switch NativeServerOrigin.validatePreviewOrigin(rawOrigin) {
            case let .success(origin):
                // The bypass secret is read from the environment only (never a launch argument,
                // never compiled in) and is redacted in every textual representation.
                let bypass = NativePreviewProtectionBypass(environment["WEWED_PREVIEW_PROTECTION_BYPASS"])
                return NativeLaunchConfiguration(
                    environment: .production,
                    baseURL: origin,
                    lane: .productionPreview(origin: origin, protectionBypass: bypass)
                )
            case let .failure(rejection):
                return NativeLaunchConfiguration(
                    environment: .production,
                    baseURL: nil,
                    lane: .production,
                    previewOriginRejection: rejection
                )
            }
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
            // A release build never reaches here: it returned `.production` above. Phase 5 now
            // provides a fail-closed read-only production workspace bootstrap; Guest identity still
            // uses its separate bootstrap and is chosen before account workspace construction when
            // a remembered Guest session exists. There is never a fixture/Shadow fallback.
            dataEnvironment = .sanitizedShadow
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

public enum AppLaunchMode {
    case workspace(AppState)
    case guestOnly
}

public enum AppLaunchModeResolver {
    /// Phase 5 production bootstrap is now read-only and fail-closed, so production resolves to a
    /// real workspace host rather than deliberately degrading to Guest-only. Guest entry remains a
    /// separate decision made by WewedMainApp before this resolver when a remembered Guest exists.
    public static func resolve(
        configuration: NativeLaunchConfiguration,
        makeAppState: (NativeDataEnvironment, URL?) throws -> AppState = {
            try AppState.make(environment: $0, baseURL: $1)
        }
    ) throws -> AppLaunchMode {
        .workspace(try makeAppState(configuration.environment, configuration.baseURL))
    }
}
