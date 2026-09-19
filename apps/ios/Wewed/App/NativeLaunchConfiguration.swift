import Foundation

public struct NativeLaunchConfiguration: Equatable, Sendable {
    public let environment: NativeDataEnvironment
    public let baseURL: URL?
    /// Which Shadow account "Sign In" authenticates as. Defaults to the couple who owns the wedding.
    public let shadowAccount: ShadowAccount
    /// Invitation link token used when the account is a guest.
    public let invitationToken: String?

    public init(
        environment: NativeDataEnvironment,
        baseURL: URL? = nil,
        shadowAccount: ShadowAccount = .couple,
        invitationToken: String? = nil
    ) {
        self.environment = environment
        self.baseURL = baseURL
        self.shadowAccount = shadowAccount
        self.invitationToken = invitationToken
    }

    /// Data source selection is explicit. With no selection the Git-safe sanitized dataset loads;
    /// private real data is never picked up implicitly, and an explicit private request fails
    /// loudly (in the repository factory) instead of degrading to sanitized data.

    public static func resolve(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        arguments: [String] = ProcessInfo.processInfo.arguments
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
            dataEnvironment = .sanitizedShadow
        }

        let argumentBaseURL = launchArgumentValue(named: "wewed_shadow_base_url", arguments: arguments)
        let baseURL = (environment["WEWED_SHADOW_API_BASE_URL"] ?? argumentBaseURL).flatMap(URL.init(string:))
        let account = ShadowAccount.from(
            key: environment["WEWED_SHADOW_ACCOUNT"] ?? launchArgumentValue(named: "wewed_shadow_account", arguments: arguments)
        ) ?? .couple
        let token = (environment["WEWED_INVITATION_TOKEN"] ?? launchArgumentValue(named: "wewed_invitation_token", arguments: arguments))?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return NativeLaunchConfiguration(
            environment: dataEnvironment,
            baseURL: baseURL,
            shadowAccount: account,
            invitationToken: (token?.isEmpty ?? true) ? nil : token
        )
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
