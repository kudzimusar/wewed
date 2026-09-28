import XCTest
@testable import WewedKit

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §A/§13.
///
/// `ProductionVendorBusinessRepository` against a `URLProtocol` stub, mirroring the established
/// pattern in `ProductionDomainRepositoriesTests` (the Android sibling is
/// `ProductionVendorBusinessRepositoryTest`). Proves the real business-scoped Vendor adapter calls
/// `/api/native/vendor/{business,catalog,bookings}` — never the wedding graph — maps real rows
/// without fabrication, and reports `.unavailable` (not an invented empty catalog) when a call fails.
final class ProductionVendorBusinessRepositoryTests: XCTestCase {

    private struct Reply { let status: Int; var body: String = "" }

    private final class Stub: URLProtocol, @unchecked Sendable {
        nonisolated(unsafe) static var routes: [String: Reply] = [:]
        nonisolated(unsafe) static var defaultStatus = 503

        static func reset() {
            routes = [:]
            defaultStatus = 503
        }

        override class func canInit(with request: URLRequest) -> Bool { true }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

        override func startLoading() {
            let path = request.url?.path ?? ""
            let key = path.hasPrefix("/") ? String(path.dropFirst()) : path
            let reply = Stub.routes[key] ?? Reply(status: Stub.defaultStatus)
            let response = HTTPURLResponse(
                url: request.url!, statusCode: reply.status, httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "application/json"]
            )!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data(reply.body.utf8))
            client?.urlProtocolDidFinishLoading(self)
        }

        override func stopLoading() {}
    }

    private let grantId = "vendor:business:biz-1"
    private let token = "test-session-token"

    private func client() -> NativeDomainApiClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [Stub.self]
        return NativeDomainApiClient(baseURL: URL(string: "https://wewed.pro")!, session: URLSession(configuration: configuration))
    }

    override func setUp() {
        super.setUp()
        Stub.reset()
    }

    func testBusinessIdentityCatalogAndBookingsMapRealRows() async throws {
        Stub.routes["api/native/vendor/business"] = Reply(status: 200, body: """
            {"success":true,"business":{"businessAccountId":"biz-1","businessName":"Shandy Events","businessType":"vendor","businessStatus":"active","onboardingStatus":"complete","role":"business_owner"}}
            """)
        Stub.routes["api/native/vendor/catalog"] = Reply(status: 200, body: """
            {"success":true,"data":{"businessAccountId":"biz-1","offerings":[{"id":"off-1","category":"decor","displayName":"Decor","status":"published"}],"items":[{"id":"item-1","name":"Floral Arch","category":"decor","status":"published","bookingMode":"request","basePriceCents":50000,"currency":"USD"}]}}
            """)
        Stub.routes["api/native/vendor/bookings"] = Reply(status: 200, body: """
            {"success":true,"count":1,"data":[{"id":"bk-1","publicReference":"WW-BKG-1","status":"confirmed","weddingTitle":"A & B","category":"decor","totalCents":50000,"currency":"USD","eventDate":"2027-01-01"}]}
            """)
        let repo = ProductionVendorBusinessRepository(client: client(), sessionToken: token, grantId: grantId)

        let identity = await repo.getBusinessIdentity()
        guard case let .success(identityValue) = identity else {
            return XCTFail("Expected a successful business identity fetch")
        }
        XCTAssertEqual(identityValue.businessName, "Shandy Events")

        let catalog = await repo.getCatalogItems()
        guard case let .success(catalogValue) = catalog else {
            return XCTFail("Expected a successful catalog fetch")
        }
        XCTAssertEqual(catalogValue.first?.name, "Floral Arch")

        let offerings = await repo.getCatalogOfferings()
        guard case let .success(offeringsValue) = offerings else {
            return XCTFail("Expected a successful offerings fetch")
        }
        XCTAssertEqual(offeringsValue.first?.category, "decor")

        let bookings = await repo.getBookings()
        guard case let .success(bookingsValue) = bookings else {
            return XCTFail("Expected a successful bookings fetch")
        }
        XCTAssertEqual(bookingsValue.first?.publicReference, "WW-BKG-1")
    }

    func testAFailedCallReportsUnavailableNeverAnInventedEmptyResult() async {
        let repo = ProductionVendorBusinessRepository(client: client(), sessionToken: token, grantId: grantId)

        if case .unavailable = await repo.getBusinessIdentity() {} else {
            XCTFail("Expected .unavailable for a failed business identity fetch")
        }
        if case .unavailable = await repo.getCatalogItems() {} else {
            XCTFail("Expected .unavailable for a failed catalog fetch")
        }
        if case .unavailable = await repo.getBookings() {} else {
            XCTFail("Expected .unavailable for a failed bookings fetch")
        }
    }
}
