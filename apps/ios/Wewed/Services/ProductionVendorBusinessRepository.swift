import Foundation

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §A.
///
/// Real production adapter for a `vendor:business:...` grant (a Vendor business-portfolio identity
/// with no wedding ActorAssignment — see `RootView`'s early "portfolio/business authority" branch).
/// This is NOT the wedding graph: it reads `/api/native/vendor/{business,catalog,bookings}` only.
/// F-3 remains binding — nothing here infers or fabricates a wedding-scoped Vendor relationship;
/// that stays gated entirely by whatever real `vendor:wedding:...` grant (if any) the account
/// separately holds, unrelated to this business-scoped repository.
public struct VendorBusinessIdentity: Equatable, Sendable {
    public let businessAccountId: String
    public let businessName: String
    public let businessType: String
    public let businessStatus: String
    public let onboardingStatus: String
    public let role: String

    public init(
        businessAccountId: String,
        businessName: String,
        businessType: String,
        businessStatus: String,
        onboardingStatus: String,
        role: String
    ) {
        self.businessAccountId = businessAccountId
        self.businessName = businessName
        self.businessType = businessType
        self.businessStatus = businessStatus
        self.onboardingStatus = onboardingStatus
        self.role = role
    }
}

public struct VendorCatalogItem: Identifiable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let category: String
    public let status: String
    public let bookingMode: String
    public let basePriceCents: Int?
    public let currency: String

    public init(
        id: String,
        name: String,
        category: String,
        status: String,
        bookingMode: String,
        basePriceCents: Int?,
        currency: String
    ) {
        self.id = id
        self.name = name
        self.category = category
        self.status = status
        self.bookingMode = bookingMode
        self.basePriceCents = basePriceCents
        self.currency = currency
    }
}

public struct VendorCatalogOffering: Identifiable, Equatable, Sendable {
    public let id: String
    public let category: String
    public let displayName: String
    public let status: String

    public init(id: String, category: String, displayName: String, status: String) {
        self.id = id
        self.category = category
        self.displayName = displayName
        self.status = status
    }
}

public struct VendorBooking: Identifiable, Equatable, Sendable {
    public let id: String
    public let publicReference: String
    public let status: String
    public let weddingTitle: String?
    public let category: String?
    public let totalCents: Int?
    public let currency: String?
    public let eventDate: String?

    public init(
        id: String,
        publicReference: String,
        status: String,
        weddingTitle: String?,
        category: String?,
        totalCents: Int?,
        currency: String?,
        eventDate: String?
    ) {
        self.id = id
        self.publicReference = publicReference
        self.status = status
        self.weddingTitle = weddingTitle
        self.category = category
        self.totalCents = totalCents
        self.currency = currency
        self.eventDate = eventDate
    }
}

public enum VendorBusinessFetch<T> {
    case success(T)
    case unavailable
}

public protocol VendorBusinessRepositoryProtocol: Sendable {
    func getBusinessIdentity() async -> VendorBusinessFetch<VendorBusinessIdentity>
    func getCatalogItems() async -> VendorBusinessFetch<[VendorCatalogItem]>
    func getCatalogOfferings() async -> VendorBusinessFetch<[VendorCatalogOffering]>
    func getBookings() async -> VendorBusinessFetch<[VendorBooking]>
}

public struct ProductionVendorBusinessRepository: VendorBusinessRepositoryProtocol {
    private let client: NativeDomainApiClient
    private let sessionToken: String
    private let grantId: String

    public init(client: NativeDomainApiClient, sessionToken: String, grantId: String) {
        self.client = client
        self.sessionToken = sessionToken
        self.grantId = grantId
    }

    public func getBusinessIdentity() async -> VendorBusinessFetch<VendorBusinessIdentity> {
        guard case let .success(root) = await client.vendorBusiness(sessionToken: sessionToken, grantId: grantId),
              let business = root.wwObject("business")
        else {
            return .unavailable
        }
        return .success(
            VendorBusinessIdentity(
                businessAccountId: business.wwRequiredString("businessAccountId"),
                businessName: business.wwString("businessName") ?? "",
                businessType: business.wwString("businessType") ?? "",
                businessStatus: business.wwString("businessStatus") ?? "",
                onboardingStatus: business.wwString("onboardingStatus") ?? "",
                role: business.wwString("role") ?? ""
            )
        )
    }

    private func catalogRoot() async -> NativeJSONObject? {
        guard case let .success(root) = await client.vendorCatalog(sessionToken: sessionToken, grantId: grantId) else {
            return nil
        }
        return root.wwObject("data")
    }

    public func getCatalogItems() async -> VendorBusinessFetch<[VendorCatalogItem]> {
        guard let data = await catalogRoot() else { return .unavailable }
        let items = (data.wwArray("items") ?? []).map { item in
            VendorCatalogItem(
                id: item.wwRequiredString("id"),
                name: item.wwString("name") ?? "",
                category: item.wwString("category") ?? "",
                status: item.wwString("status") ?? "",
                bookingMode: item.wwString("bookingMode") ?? "",
                basePriceCents: item.wwInt("basePriceCents"),
                currency: item.wwString("currency") ?? "USD"
            )
        }
        return .success(items)
    }

    public func getCatalogOfferings() async -> VendorBusinessFetch<[VendorCatalogOffering]> {
        guard let data = await catalogRoot() else { return .unavailable }
        let offerings = (data.wwArray("offerings") ?? []).map { offering in
            VendorCatalogOffering(
                id: offering.wwRequiredString("id"),
                category: offering.wwString("category") ?? "",
                displayName: offering.wwString("displayName") ?? "",
                status: offering.wwString("status") ?? ""
            )
        }
        return .success(offerings)
    }

    public func getBookings() async -> VendorBusinessFetch<[VendorBooking]> {
        guard case let .success(array) = await client.vendorBookings(sessionToken: sessionToken, grantId: grantId) else {
            return .unavailable
        }
        let bookings = array.map { booking in
            VendorBooking(
                id: booking.wwRequiredString("id"),
                publicReference: booking.wwString("publicReference") ?? "",
                status: booking.wwString("status") ?? "",
                weddingTitle: booking.wwString("weddingTitle")?.wwNilIfBlank,
                category: booking.wwString("category")?.wwNilIfBlank,
                totalCents: booking.wwInt("totalCents"),
                currency: booking.wwString("currency")?.wwNilIfBlank,
                eventDate: booking.wwString("eventDate")?.wwNilIfBlank
            )
        }
        return .success(bookings)
    }
}
