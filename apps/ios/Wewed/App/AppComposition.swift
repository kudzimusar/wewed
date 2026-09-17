import Foundation

public enum AppCompositionMode: Sendable {
    case fixture
    case isolatedWeddingDay(baseURL: URL, bearerToken: String, weddingId: String)
    case production(baseURL: URL, bearerToken: String, weddingId: String)
}

public struct AppComposition: Sendable {
    public let mode: AppCompositionMode
    public let repository: WeddingRepositoryProtocol
    public let gate: WeddingDayGateOperations?
    public let server: ServerBackedWeddingDayOperations?
    public let showDemoSimulations: Bool

    public init(
        mode: AppCompositionMode,
        repository: WeddingRepositoryProtocol,
        gate: WeddingDayGateOperations?,
        server: ServerBackedWeddingDayOperations?,
        showDemoSimulations: Bool
    ) {
        self.mode = mode
        self.repository = repository
        self.gate = gate
        self.server = server
        self.showDemoSimulations = showDemoSimulations
    }

    public static func fixture(base: WeddingRepositoryProtocol = FixtureWeddingRepository()) -> AppComposition {
        AppComposition(
            mode: .fixture,
            repository: base,
            gate: nil,
            server: nil,
            showDemoSimulations: true
        )
    }

    public static func isolatedWeddingDay(
        baseURL: URL,
        bearerToken: String,
        weddingId: String,
        trustedRootPublicKeyDerBase64: String = "",
        trustedRootKeyId: String? = nil,
        base: WeddingRepositoryProtocol = FixtureWeddingRepository(),
        storageDirectory: URL? = nil
    ) -> AppComposition {
        let server = ServerBackedWeddingDayOperations(baseURL: baseURL, bearerToken: bearerToken, weddingId: weddingId)
        let storeDir = storageDirectory ?? FileManager.default.temporaryDirectory
        let offlineStore = OfflineManifestStore(storageDirectory: storeDir)
        let trustStore = WeddingDayManifestTrustStore(storageDirectory: storeDir)
        let gate = ManifestBackedWeddingDayGate(
            baseURL: baseURL,
            bearerToken: bearerToken,
            weddingId: weddingId,
            trustedRootPublicKeyDerBase64: trustedRootPublicKeyDerBase64,
            trustedRootKeyId: trustedRootKeyId,
            offlineStore: offlineStore,
            trustStore: trustStore
        )
        let repo = WeddingDayGateAwareRepository(base: base, gate: gate, server: server)
        return AppComposition(
            mode: .isolatedWeddingDay(baseURL: baseURL, bearerToken: bearerToken, weddingId: weddingId),
            repository: repo,
            gate: gate,
            server: server,
            showDemoSimulations: true
        )
    }

    public static func production(
        baseURL: URL,
        bearerToken: String,
        weddingId: String,
        trustedRootPublicKeyDerBase64: String,
        trustedRootKeyId: String? = nil,
        base: WeddingRepositoryProtocol = FixtureWeddingRepository(),
        storageDirectory: URL? = nil
    ) -> AppComposition {
        let server = ServerBackedWeddingDayOperations(baseURL: baseURL, bearerToken: bearerToken, weddingId: weddingId)
        let storeDir = storageDirectory ?? (FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first ?? FileManager.default.temporaryDirectory)
        let offlineStore = OfflineManifestStore(storageDirectory: storeDir)
        let trustStore = WeddingDayManifestTrustStore(storageDirectory: storeDir)
        let gate = ManifestBackedWeddingDayGate(
            baseURL: baseURL,
            bearerToken: bearerToken,
            weddingId: weddingId,
            trustedRootPublicKeyDerBase64: trustedRootPublicKeyDerBase64,
            trustedRootKeyId: trustedRootKeyId,
            offlineStore: offlineStore,
            trustStore: trustStore
        )
        let repo = WeddingDayGateAwareRepository(base: base, gate: gate, server: server)
        return AppComposition(
            mode: .production(baseURL: baseURL, bearerToken: bearerToken, weddingId: weddingId),
            repository: repo,
            gate: gate,
            server: server,
            showDemoSimulations: false
        )
    }
}
