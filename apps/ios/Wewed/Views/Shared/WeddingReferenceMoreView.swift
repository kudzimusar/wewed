import SwiftUI

/// Couple "More": wedding profile, story, gallery, honeymoon & gifts, settings (Account) and help.
public struct WeddingReferenceMoreView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var session: SessionStore

    public init() {}

    public var body: some View {
        if let grant = session.activeGrant {
            CoupleMoreContent(access: appState.access(for: grant))
        }
    }
}

private struct CoupleMoreContent: View {
    @StateObject private var model: WeddingPlanModel
    @ScaledMetric(relativeTo: .largeTitle) private var titleSize: CGFloat = 28

    init(access: RoleScopedAccess) {
        _model = StateObject(wrappedValue: WeddingPlanModel(access: access))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                WeddingFloralBackground(opacity: 0.025)
                    .accessibilityHidden(true)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 12) {
                        header

                        if let wedding = model.data.wedding {
                            NavigationLink {
                                CoupleWeddingProfileView(wedding: wedding)
                            } label: {
                                weddingCard(wedding)
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("more-wedding-profile")
                        } else if !model.hasLoaded {
                            ProgressView("Loading wedding…")
                                .frame(maxWidth: .infinity)
                                .padding(.top, 40)
                        } else {
                            LoadFailureText("your wedding")
                        }

                        row("Our Story", subtitle: "Your wedding story", icon: "book", id: "more-story") {
                            MoreEmptyFeatureView(title: "Our Story", message: "Your wedding story isn't available in the app yet.")
                        }
                        row("Gallery", subtitle: "Wedding photos", icon: "photo.stack", id: "more-gallery") {
                            MoreEmptyFeatureView(title: "Gallery", message: "Wedding photos aren't available in the app yet.")
                        }
                        row("Honeymoon & Gifts", subtitle: "Contributions from guests", icon: "gift", id: "more-honeymoon") {
                            HoneymoonGiftsView(model: model)
                        }
                        row("Settings", subtitle: "Your account and sign out", icon: "gearshape", id: "more-settings") {
                            AccountView(grant: model.grant)
                        }
                        row("Help & Support", subtitle: "Contact Wewed support", icon: "questionmark.circle", id: "more-support") {
                            HelpSupportView()
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.top, 12)
                    .padding(.bottom, 24)
                }
            }
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .task { await model.load() }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("more-root")
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text("More")
                    .font(.system(size: titleSize, weight: .semibold, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .accessibilityAddTraits(.isHeader)
                Text("Your wedding, beautifully organised.")
                    .font(.caption)
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }

            Spacer()

            NavigationLink {
                AccountView(grant: model.grant)
            } label: {
                Image(systemName: "gearshape")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .frame(width: 44, height: 44)
                    .background(WeddingIdentityPalette.ivorySoft, in: Circle())
                    .overlay(Circle().stroke(WeddingIdentityPalette.hairline, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Settings")
            .accessibilityIdentifier("more-settings-shortcut")
        }
    }

    private func weddingCard(_ wedding: Wedding) -> some View {
        HStack(spacing: 12) {
            Image("hero-wedding", bundle: .module)
                .resizable()
                .scaledToFill()
                .frame(width: 58, height: 58)
                .clipShape(Circle())
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(wedding.coupleNames)
                    .font(.system(.headline, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Text("Wedding Profile")
                    .font(.footnote)
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(WeddingIdentityPalette.muted)
                .accessibilityHidden(true)
        }
        .padding(14)
        .background(WeddingIdentityPalette.ivorySoft, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(WeddingIdentityPalette.hairline, lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 16))
    }

    private func row<Destination: View>(
        _ title: String,
        subtitle: String,
        icon: String,
        id: String,
        @ViewBuilder destination: @escaping () -> Destination
    ) -> some View {
        NavigationLink {
            destination()
        } label: {
            MenuRowLabel(title, subtitle: subtitle, systemImage: icon)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }
}

/// Content the source has but this app's copy does not carry yet.
private struct MoreEmptyFeatureView: View {
    let title: String
    let message: String

    var body: some View {
        ScrollView {
            EmptyStateText(message, identifier: "more-empty-state")
                .padding(16)
        }
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .navigationTitle(title)
    }
}

private struct CoupleWeddingProfileView: View {
    let wedding: Wedding

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                WeddingMonogram(names: wedding.coupleNames, size: 42)
                    .frame(maxWidth: .infinity)
                PlainCard {
                    VStack(alignment: .leading, spacing: 12) {
                        InfoLine("Couple", wedding.coupleNames, identifier: "profile-couple")
                        InfoLine("Date", WeddingDateText.longWithTime(wedding.date), identifier: "profile-date")
                        InfoLine("Venue", wedding.venueName, identifier: "profile-venue")
                        InfoLine("City", wedding.city.isEmpty ? "Not recorded" : wedding.city, identifier: "profile-city")
                        InfoLine("Country", wedding.country.isEmpty ? "Not recorded" : wedding.country, identifier: "profile-country")
                        OpenInMapsButton(venue: wedding.venueLocation, identifier: "profile-open-maps")
                    }
                }
            }
            .padding(16)
        }
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .navigationTitle("Wedding Profile")
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("more-profile-root")
    }
}

private struct HoneymoonGiftsView: View {
    @ObservedObject var model: WeddingPlanModel

    var body: some View {
        let records = model.data.contributions
        let types = Dictionary(grouping: records, by: \.typeLabel)
            .map { (type: $0.key, count: $0.value.count) }
            .sorted { $0.type.localizedCaseInsensitiveCompare($1.type) == .orderedAscending }
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if model.failures.contains(.contributions) {
                    LoadFailureText("contributions")
                }
                PlainCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Contributions")
                            .font(.headline)
                            .foregroundStyle(WeddingIdentityPalette.ink)
                        Text(records.isEmpty ? "No contributions recorded for this wedding." : PlainStatus.plural(records.count, "contribution") + " recorded")
                            .font(.body)
                            .foregroundStyle(WeddingIdentityPalette.ink)
                            .accessibilityIdentifier("honeymoon-contribution-count")
                        ForEach(types, id: \.type) { entry in
                            Text("\(entry.type): \(entry.count)")
                                .font(.subheadline)
                                .foregroundStyle(WeddingIdentityPalette.muted)
                        }
                    }
                }
                .accessibilityElement(children: .combine)

                if !records.isEmpty {
                    NavigationLink {
                        WorksheetScreen(model: model, worksheet: .contributions, identifier: "planner-contributions-root")
                    } label: {
                        MenuRowLabel("See all contributions", systemImage: "list.bullet")
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("honeymoon-open-contributions")
                }

                EmptyStateText("The honeymoon fund isn't available in the app yet.", identifier: "more-empty-state")
            }
            .padding(16)
        }
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .navigationTitle("Honeymoon & Gifts")
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("more-honeymoon-root")
    }
}
