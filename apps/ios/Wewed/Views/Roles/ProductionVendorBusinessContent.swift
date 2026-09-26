import SwiftUI

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 closure §A.
///
/// The real production Vendor business shell: business identity, catalog, offerings and bookings —
/// never the wedding graph (a `vendor:business` grant has no wedding ActorAssignment). Each section
/// fetches independently and shows its own honest EMPTY/UNAVAILABLE state rather than one shared
/// all-or-nothing loader, so a transient failure on one section never hides the others.
public struct ProductionVendorBusinessContent: View {
    let repository: VendorBusinessRepositoryProtocol
    let onSignOut: (() -> Void)?
    let onSwitchContext: (() -> Void)?

    @State private var identity: VendorBusinessFetch<VendorBusinessIdentity>?
    @State private var catalog: VendorBusinessFetch<[VendorCatalogItem]>?
    @State private var offerings: VendorBusinessFetch<[VendorCatalogOffering]>?
    @State private var bookings: VendorBusinessFetch<[VendorBooking]>?

    public init(
        repository: VendorBusinessRepositoryProtocol,
        onSignOut: (() -> Void)? = nil,
        onSwitchContext: (() -> Void)? = nil
    ) {
        self.repository = repository
        self.onSignOut = onSignOut
        self.onSwitchContext = onSwitchContext
    }

    private var businessName: String {
        if case let .success(value) = identity { return value.businessName }
        return "Vendor business"
    }

    public var body: some View {
        IASectionList(businessName, "Business portfolio") {
            identitySection

            sectionHeader("Catalog").accessibilityIdentifier("vendor-business-catalog-header")
            catalogSection

            sectionHeader("Offerings").accessibilityIdentifier("vendor-business-offerings-header")
            offeringsSection

            sectionHeader("Bookings").accessibilityIdentifier("vendor-business-bookings-header")
            bookingsSection

            if let onSwitchContext {
                Button("Switch context", action: onSwitchContext)
                    .accessibilityIdentifier("vendor-business-switch-context")
            }
            if let onSignOut {
                Button("Sign out", action: onSignOut)
                    .accessibilityIdentifier("vendor-business-sign-out")
            }
        }
        .task {
            identity = await repository.getBusinessIdentity()
            catalog = await repository.getCatalogItems()
            offerings = await repository.getCatalogOfferings()
            bookings = await repository.getBookings()
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(WeddingIdentityPalette.ink)
            .padding(.top, 4)
    }

    @ViewBuilder
    private var identitySection: some View {
        if let identity {
            switch identity {
            case .unavailable:
                IACard("Business identity unavailable", "Could not refresh your business identity. No cached data is shown.")
            case let .success(value):
                IACard("Business", value.businessName, trailing: value.businessType)
                IACard("Status", value.businessStatus, trailing: "Onboarding: \(value.onboardingStatus)")
                IACard("Your role", value.role)
            }
        } else {
            IALoading()
        }
    }

    @ViewBuilder
    private var catalogSection: some View {
        if let catalog {
            switch catalog {
            case .unavailable:
                IACard("Catalog unavailable", "Could not load your catalog right now.")
            case let .success(items):
                if items.isEmpty {
                    IACard("No catalog items", "This business has not published any catalog items yet.")
                } else {
                    ForEach(items) { item in
                        IACard(
                            item.name,
                            item.category,
                            trailing: item.basePriceCents.map { "\(Double($0) / 100.0) \(item.currency)" },
                            status: item.status
                        )
                    }
                }
            }
        } else {
            IALoading()
        }
    }

    @ViewBuilder
    private var offeringsSection: some View {
        if let offerings {
            switch offerings {
            case .unavailable:
                IACard("Offerings unavailable", "Could not load your service offerings right now.")
            case let .success(items):
                if items.isEmpty {
                    IACard("No offerings", "This business has not published any service offerings yet.")
                } else {
                    ForEach(items) { offering in
                        IACard(offering.displayName, offering.category, status: offering.status)
                    }
                }
            }
        } else {
            IALoading()
        }
    }

    @ViewBuilder
    private var bookingsSection: some View {
        if let bookings {
            switch bookings {
            case .unavailable:
                IACard("Bookings unavailable", "Could not load your bookings right now.")
            case let .success(items):
                if items.isEmpty {
                    IACard("No bookings", "This business has no bookings recorded yet.")
                } else {
                    ForEach(items) { booking in
                        IACard(
                            booking.weddingTitle ?? booking.publicReference,
                            booking.category,
                            trailing: booking.totalCents.map { "\(Double($0) / 100.0) \(booking.currency ?? "")" },
                            status: booking.status
                        )
                    }
                }
            }
        } else {
            IALoading()
        }
    }
}
