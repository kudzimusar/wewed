import XCTest
@testable import WewedKit

/// P13-LIVE-2 — DEBUG-only productionPreview (QRO 01 §9, §27).
///
/// productionPreview is the Release production client stack pointed at one allowlisted Preview
/// origin: data environment `.production` (no Shadow, no fixture, no persona), one origin for the
/// account, Guest, domain and Wedding Day clients, and a Release binary that can never leave
/// https://wewed.pro.
final class ProductionPreviewLaneTests: XCTestCase {
    private let preview = "https://wewed-git-integration-phase13-live-11-11.vercel.app"
    private let production = URL(string: "https://wewed.pro")!

    override func tearDown() {
        NativeServerOrigin.activate(.production)
        GuestInvitationBootstrap.reset()
        super.tearDown()
    }

    private func debugPreview(_ origin: String?, bypass: String? = nil) -> NativeLaunchConfiguration {
        var environment = ["WEWED_NATIVE_ENV": "production_preview"]
        environment["WEWED_PREVIEW_ORIGIN"] = origin
        environment["WEWED_PREVIEW_PROTECTION_BYPASS"] = bypass
        return NativeLaunchConfiguration.resolve(environment: environment, arguments: [], isDebugBuild: true)
    }

    // MARK: - Origin allowlist

    func testApprovedPreviewAndLoopbackOriginsAreAccepted() throws {
        let accepted = [
            preview: preview,
            "https://wewed-6tu6k3pyc-11-11.vercel.app/": "https://wewed-6tu6k3pyc-11-11.vercel.app",
            "HTTPS://WEWED-6TU6K3PYC-11-11.VERCEL.APP": "https://wewed-6tu6k3pyc-11-11.vercel.app",
            "http://127.0.0.1:3000": "http://127.0.0.1:3000",
            "http://localhost:3000": "http://localhost:3000",
        ]
        for (raw, expected) in accepted {
            XCTAssertEqual(try NativeServerOrigin.validatePreviewOrigin(raw).get().absoluteString, expected, raw)
        }
    }

    func testArbitraryMalformedInsecureAndProductionOriginsAreRejected() {
        let rejected: [(String?, NativePreviewOriginRejection)] = [
            (nil, .missing),
            ("   ", .missing),
            ("not a url", .malformed),
            ("https://evil.example", .hostNotAllowlisted("evil.example")),
            ("https://wewed-x-11-11.vercel.app.evil.example", .hostNotAllowlisted("wewed-x-11-11.vercel.app.evil.example")),
            ("https://other-x-11-11.vercel.app", .hostNotAllowlisted("other-x-11-11.vercel.app")),
            ("https://wewed-x-22-22.vercel.app", .hostNotAllowlisted("wewed-x-22-22.vercel.app")),
            ("https://wewed-x-11-11.vercel.app:8443", .hostNotAllowlisted("wewed-x-11-11.vercel.app")),
            ("http://wewed-x-11-11.vercel.app", .insecureScheme),
            ("ftp://127.0.0.1", .insecureScheme),
            ("https://wewed.pro", .productionHost),
            ("https://www.wewed.pro", .productionHost),
            ("https://api.wewed.pro", .productionHost),
            ("https://user:pw@wewed-x-11-11.vercel.app", .unexpectedComponents),
            ("https://wewed-x-11-11.vercel.app/api", .unexpectedComponents),
            ("https://wewed-x-11-11.vercel.app?x=1", .unexpectedComponents),
        ]
        for (raw, reason) in rejected {
            guard case let .failure(actual) = NativeServerOrigin.validatePreviewOrigin(raw) else {
                return XCTFail("\(String(describing: raw)) must be rejected")
            }
            XCTAssertEqual(actual, reason, String(describing: raw))
        }
    }

    // MARK: - Launch resolution

    func testDebugProductionPreviewUsesRealProductionAuthorityAtThePreviewOrigin() throws {
        let config = debugPreview(preview)
        XCTAssertEqual(config.environment, .production, "productionPreview is the production data environment")
        XCTAssertEqual(config.baseURL?.absoluteString, preview)
        XCTAssertEqual(config.lane, .productionPreview(origin: URL(string: preview)!, protectionBypass: nil))
        XCTAssertNil(config.previewOriginRejection)
        XCTAssertFalse(config.environment.allowsDevelopmentPersonaSwitching, "no persona switching in productionPreview")
        XCTAssertFalse(config.environment.allowsMutableNativeDevelopment, "no Shadow/fixture in productionPreview")

        guard case .productionBootstrap(let baseURL) = try NativeRepositoryFactory.make(
            environment: config.environment, baseURL: config.baseURL
        ) else {
            return XCTFail("productionPreview must never construct a Shadow or fixture repository")
        }
        XCTAssertEqual(baseURL?.absoluteString, preview)
    }

    func testAnUnapprovedPreviewOriginFailsClosedInsteadOfFallingBackToProduction() {
        for raw in [nil, "https://evil.example", "http://wewed-x-11-11.vercel.app", "https://wewed.pro"] {
            let config = debugPreview(raw)
            XCTAssertNotNil(config.previewOriginRejection, String(describing: raw))
            XCTAssertNil(config.baseURL, "a rejected Preview launch must not resolve any server")
            XCTAssertEqual(config.lane, .production)
        }
    }

    func testReleaseIgnoresEveryPreviewInputAndStaysOnWewedPro() {
        let inputs: [[String: String]] = [
            ["WEWED_NATIVE_ENV": "production_preview", "WEWED_PREVIEW_ORIGIN": preview,
             "WEWED_PREVIEW_PROTECTION_BYPASS": "release-must-ignore"],
            ["WEWED_NATIVE_ENV": "production_preview", "WEWED_PREVIEW_ORIGIN": "https://evil.example"],
            ["WEWED_NATIVE_ENV": "production", "WEWED_SHADOW_API_BASE_URL": "https://evil.example"],
        ]
        for environment in inputs {
            for arguments in [[], ["-wewed_native_env", "production_preview", "-wewed_preview_origin", preview]] {
                let config = NativeLaunchConfiguration.resolve(
                    environment: environment, arguments: arguments, isDebugBuild: false
                )
                XCTAssertEqual(config, .production)
                XCTAssertEqual(config.baseURL, production)
                XCTAssertEqual(config.lane.origin, production)
                XCTAssertNil(config.previewOriginRejection)
            }
        }
    }

    /// The Release defect this unit closes: production used to resolve `baseURL == nil`, so
    /// RootView never bound a NativeDomainApiClient and the real domain data could not load.
    func testProductionAlwaysResolvesTheProductionOriginForDomainClients() throws {
        for isDebugBuild in [false, true] {
            let config = NativeLaunchConfiguration.resolve(
                environment: ["WEWED_NATIVE_ENV": "production", "WEWED_SHADOW_API_BASE_URL": "http://127.0.0.1:9"],
                arguments: [],
                isDebugBuild: isDebugBuild
            )
            XCTAssertEqual(config.baseURL, production)
            let appState = try AppState.make(environment: config.environment, baseURL: config.baseURL)
            XCTAssertEqual(appState.dataBaseURL, production)
        }
    }

    func testPreviewOriginIsReadFromLaunchArgumentsButTheBypassSecretIsNot() {
        let config = NativeLaunchConfiguration.resolve(
            environment: [:],
            arguments: ["-wewed_native_env", "production_preview", "-wewed_preview_origin", preview,
                        "-WEWED_PREVIEW_PROTECTION_BYPASS", "argument-secret"],
            isDebugBuild: true
        )
        XCTAssertEqual(config.lane, .productionPreview(origin: URL(string: preview)!, protectionBypass: nil))
    }

    // MARK: - One origin, one session policy

    func testGuestAndAccountClientsShareTheLaneOrigin() async {
        let config = debugPreview(preview)
        NativeServerOrigin.activate(config.lane)
        GuestInvitationBootstrap.reset()

        let account = ProductionAuthorityClient(baseURL: config.lane.origin)
        let guest = GuestInvitationBootstrap.coordinator(storage: InMemoryPreviewStorage())
        let domain = NativeDomainApiClient(baseURL: config.baseURL!)

        XCTAssertEqual(account.baseURL.absoluteString, preview)
        let guestClient = await guest.client
        let guestOrigin = await guestClient.baseUrl.absoluteString
        XCTAssertEqual(guestOrigin, preview)
        XCTAssertEqual(domain.baseURL.absoluteString, preview)
        XCTAssertEqual(GuestInvitationBootstrap.guestSessionService, "pro.wewed.app.guest-session.production-preview")
        XCTAssertEqual(config.lane.keychainService("pro.wewed.app.account-session"),
                       "pro.wewed.app.account-session.production-preview")
    }

    func testProductionLaneKeepsReleaseSessionsAndKeychainServices() {
        NativeServerOrigin.activate(.production)
        XCTAssertTrue(NativeServerOrigin.urlSession === URLSession.shared)
        XCTAssertEqual(GuestInvitationBootstrap.guestSessionService, "pro.wewed.app.guest-session")
        XCTAssertNil(NativeLaunchConfiguration.production.lane.sessionConfiguration(.ephemeral)
            .httpAdditionalHeaders?[NativePreviewProtectionBypass.headerName])
    }

    func testProtectionBypassIsSentOnlyInThePreviewLaneAndIsNeverPrinted() throws {
        let config = debugPreview(preview, bypass: "s3cr3t-bypass-value")
        guard case let .productionPreview(_, bypass?) = config.lane else { return XCTFail("bypass expected") }
        for rendered in [String(describing: config), String(reflecting: config), "\(config.lane)", "\(bypass)"] {
            XCTAssertFalse(rendered.contains("s3cr3t-bypass-value"), "secret leaked into: \(rendered)")
        }
        let headers = config.lane.sessionConfiguration(.ephemeral).httpAdditionalHeaders
        XCTAssertEqual(headers?[NativePreviewProtectionBypass.headerName] as? String, "s3cr3t-bypass-value")

        NativeServerOrigin.activate(config.lane)
        let shared = NativeServerOrigin.urlSession
        XCTAssertFalse(shared === URLSession.shared)
        XCTAssertEqual(shared.configuration.httpAdditionalHeaders?[NativePreviewProtectionBypass.headerName] as? String,
                       "s3cr3t-bypass-value")
        XCTAssertTrue(NativeServerOrigin.urlSession === shared, "one session per lane")
    }

    func testPreviewHostIsAWeddingHostOnlyWhileThePreviewLaneIsActive() {
        let link = "\(preview)/invite/charity-and-kudzie?rsvp=TOKEN"
        NativeServerOrigin.activate(.production)
        XCTAssertNil(InvitationEntryParser.entry(from: link))
        XCTAssertNotNil(InvitationEntryParser.entry(from: "https://wewed.pro/invite/charity-and-kudzie?rsvp=TOKEN"))

        NativeServerOrigin.activate(debugPreview(preview).lane)
        XCTAssertNotNil(InvitationEntryParser.entry(from: link))
        XCTAssertNil(InvitationEntryParser.entry(from: "https://wewed-other-11-11.vercel.app/invite/s?rsvp=T"),
                     "only the one configured Preview host, not every allowlisted one")
        XCTAssertEqual(GuestSessionClient.weddingSlugFromResume("\(preview)/w/charity-and-kudzie"), "charity-and-kudzie")
        XCTAssertNil(GuestSessionClient.weddingSlugFromResume("https://evil.example/w/charity-and-kudzie"))
    }
}

private final class InMemoryPreviewStorage: SecureStorageProtocol, @unchecked Sendable {
    private var values: [String: String] = [:]
    func save(key: String, value: String) { values[key] = value }
    func get(key: String) -> String? { values[key] }
    func delete(key: String) { values[key] = nil }
    func clear() { values.removeAll() }
}
