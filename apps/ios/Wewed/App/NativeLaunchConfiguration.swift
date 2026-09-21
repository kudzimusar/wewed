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
            // A release build falls through to `.production`. The general repository is
            // deliberately unavailable there — the repository factory refuses to build one — but
            // the *app* does not refuse to start: `AppLaunchModeResolver` degrades that one
            // expected refusal to the guest-only shell, so an invited guest still gets their card.
            // What must not happen is showing that guest a real wedding's demo data, which is why
            // there is no fixture/Shadow fallback here — only guest-only, or nothing.
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

public enum AppLaunchMode {
    case workspace(AppState)
    case guestOnly
}

public enum AppLaunchModeResolver {
    /// Resolves the launch mode for the given launch configuration.
    ///
    /// Exactly one failure is allowed to degrade production to `.guestOnly`:
    /// `NativeRepositoryFactoryError.productionDisabled`, the general repository being
    /// deliberately unavailable. That is a known, intentional shutdown, and the guest-only shell
    /// exists precisely so an invited guest still reaches their card when it happens.
    ///
    /// Every other failure — in production or anywhere else — throws visibly instead of being
    /// swallowed. A `catch { return .guestOnly }` that ignored the error's *identity* used to sit
    /// here: it caught `productionDisabled` correctly, but it would just as happily have caught a
    /// guard rejection, a decoding bug, or any other unexpected production failure and shown the
    /// exact same guest-only screen for all of them. That made a real defect indistinguishable
    /// from a deliberate shutdown from the outside — the one case this resolver must not allow.
    ///
    /// `productionReadVerify`, `shadow`, `privateRealShadow` and `sanitizedShadow` are all entered
    /// deliberately, for qualification. A failure there belongs on screen, not degraded.
    ///
    /// - Parameter makeAppState: how the workspace is constructed. Defaults to `AppState.make`;
    ///   overridden only by tests, so an unexpected error can be simulated without a mocking
    ///   framework or weakening `NativeEnvironmentGuard`/`NativeRepositoryFactory` themselves.
    public static func resolve(
        configuration: NativeLaunchConfiguration,
        makeAppState: (NativeDataEnvironment, URL?) throws -> AppState = {
            try AppState.make(environment: $0, baseURL: $1)
        }
    ) throws -> AppLaunchMode {
        do {
            return .workspace(try makeAppState(configuration.environment, configuration.baseURL))
        } catch let error where configuration.environment == .production && isExpectedProductionShutdown(error) {
            // The one expected shutdown. Guest-only carries no AppState at all — there is nothing
            // to construct, and nothing here manufactures a fixture, Shadow or placeholder one.
            return .guestOnly
        }
    }

    /// The general repository being deliberately unavailable in production, and nothing else.
    ///
    /// Two layers can say this, not one: `NativeEnvironmentGuard.validate` rejects `.production`
    /// before `NativeRepositoryFactory.make`'s own switch ever reaches its `.production` case, so
    /// in the real path today the error is always `NativeEnvironmentGuardError.productionDisabled`
    /// — the factory's own `NativeRepositoryFactoryError.productionDisabled` is presently
    /// unreachable for this environment, but is kept recognized here as defence-in-depth: if the
    /// guard's check were ever loosened, the factory's still stands, and either one continues to
    /// mean exactly the same thing. Nothing else — a guard rejection for a different reason, an
    /// unexpected construction failure, a bug — matches, and so nothing else is swallowed.
    private static func isExpectedProductionShutdown(_ error: Error) -> Bool {
        switch error {
        case NativeEnvironmentGuardError.productionDisabled: return true
        case NativeRepositoryFactoryError.productionDisabled: return true
        default: return false
        }
    }
}
