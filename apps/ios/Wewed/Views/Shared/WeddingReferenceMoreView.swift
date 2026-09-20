import SwiftUI

public struct WeddingReferenceMoreView: View {
    @EnvironmentObject private var appState: AppState
    @State private var wedding: Wedding?
    @State private var isLoading = true
    // Our Story and Gallery are published through the wedding content graph, which the couple's
    // More screen previously never read — so two populated sections rendered as "will appear here".
    @State private var contentSections: [WeddingContentSection] = []
    @State private var weddingSlug: String?

    public init() {}

    public var body: some View {
        NavigationStack {
            ZStack {
                WeddingFloralBackground(opacity: 0.025)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 14) {
                        header

                        if isLoading {
                            ProgressView("Loading wedding…")
                                .frame(maxWidth: .infinity)
                                .padding(.top, 80)
                        } else if let wedding {
                            NavigationLink {
                                ReferenceWeddingProfileView(wedding: wedding)
                            } label: {
                                weddingCard(wedding)
                            }
                            .buttonStyle(.plain)

                            // The couple's published site lives in the same graph as the app, so
                            // it belongs in the app rather than being treated as a separate
                            // product elsewhere.
                            menuLink(title: "Wedding Site", subtitle: "Your published wedding site", icon: "globe", identifier: "more-wedding-site") {
                                WeddingSiteView(
                                    coupleNames: wedding.coupleNames,
                                    weddingSlug: weddingSlug,
                                    sections: contentSections
                                )
                            }

                            menuLink(title: "Our Story", subtitle: "Photos, videos and milestones", icon: "photo.on.rectangle.angled", identifier: "more-story") {
                                WeddingContentSectionView(
                                    section: contentSection("story"),
                                    testIdPrefix: "more-story"
                                )
                            }

                            menuLink(title: "Gallery", subtitle: "Wedding photos and inspiration", icon: "photo.stack", identifier: "more-gallery") {
                                GalleryContentSection(
                                    section: contentSection("gallery"),
                                    testIdPrefix: "more-gallery"
                                )
                            }

                            // P0-12: the four Private Real Shadow contributions are
                            // blessing/wish/story/memory records, not monetary honeymoon gifts.
                            // Routing Honeymoon at them presented guest messages as honeymoon
                            // funding. No honeymoon/gift contract exists natively yet.
                            menuLink(title: "Honeymoon", subtitle: "Gift and honeymoon fund", icon: "airplane.departure", identifier: "more-honeymoon") {
                                ReferenceEmptyFeatureView(
                                    title: "Honeymoon",
                                    message: "Honeymoon and gift contributions are not configured for this wedding. The wedding graph records guest messages and memories, which are shown under Plan → Contributions; it holds no honeymoon fund.",
                                    coupleNames: wedding.coupleNames
                                )
                            }

                            // P0-10: Documents and Account are declared in the IA V2 Couple More
                            // contract and must exist at runtime, not only in the declaration.
                            menuLink(title: "Documents", subtitle: "Contracts and wedding files", icon: "doc.text", identifier: "more-documents") {
                                ShadowPlannerDocumentsView()
                            }

                            menuLink(title: "Settings", subtitle: "App preferences", icon: "gearshape", identifier: "more-settings") {
                                SettingsView()
                            }

                            menuLink(title: "Help & Support", subtitle: "Get in touch", icon: "questionmark.circle", identifier: "more-support") {
                                ReferenceEmptyFeatureView(
                                    title: "Help & Support",
                                    message: "Need assistance? Contact the wedding team at support@wewed.pro • Version 1.0.0 (ECDSA P-256 Offline Active)",
                                    coupleNames: wedding.coupleNames
                                )
                            }

                            menuLink(title: "Account", subtitle: "Identity, privacy and sign out", icon: "person.crop.circle", identifier: "more-account") {
                                AccountPrivacyView()
                            }
                        }
                    }
                    .wewedBoundedWidth(horizontalInset: 28)
                    .padding(.horizontal, 14)
                    .padding(.top, 12)
                    .padding(.bottom, 24)
                }
            }
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .task { await load() }
        }
        .accessibilityIdentifier("more-root")
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text("More")
                    .font(.system(size: 28, weight: .semibold, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Text("Your wedding, beautifully organised.")
                    .font(.system(size: 12))
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }

            Spacer()

            NavigationLink {
                SettingsView()
            } label: {
                Image(systemName: "gearshape")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .frame(width: 40, height: 40)
                    .background(WeddingIdentityPalette.ivorySoft)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(WeddingIdentityPalette.hairline, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("more-settings-shortcut")
        }
    }

    private func weddingCard(_ wedding: Wedding) -> some View {
        HStack(spacing: 12) {
            WewedMediaImage(WewedAsset.heroWedding)
                .scaledToFill()
                .frame(width: 58, height: 58)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(wedding.coupleNames)
                    .font(.system(size: 16, weight: .semibold, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Text("Wedding Couple")
                    .font(.system(size: 11))
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(WeddingIdentityPalette.muted)
        }
        .padding(14)
        .background(WeddingIdentityPalette.ivorySoft)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(WeddingIdentityPalette.hairline, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .accessibilityIdentifier("more-wedding-profile")
    }

    private func menuLink<Destination: View>(
        title: String,
        subtitle: String,
        icon: String,
        identifier: String? = nil,
        @ViewBuilder destination: () -> Destination
    ) -> some View {
        NavigationLink(destination: destination()) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(WeddingIdentityPalette.champagne.opacity(0.14))
                        .frame(width: 40, height: 40)
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 14, weight: .semibold, design: .serif))
                        .foregroundStyle(WeddingIdentityPalette.ink)
                    Text(subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }
            .padding(13)
            .background(WeddingIdentityPalette.ivorySoft)
            .overlay(
                RoundedRectangle(cornerRadius: 15)
                    .stroke(WeddingIdentityPalette.hairline, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 15))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier ?? "more-\(title.lowercased().replacingOccurrences(of: " ", with: "-"))")
    }

    private func contentSection(_ key: String) -> WeddingContentSection {
        contentSections.first { $0.section == key }
            ?? WeddingContentSection(section: key, title: WeddingContentSection.titleFor(key), entries: [])
    }

    private func load() async {
        do {
            let scoped = try await appState.scopedRepository()
            wedding = try await scoped.getWedding()
            contentSections = try await scoped.getWeddingContentSections()
            weddingSlug = try await scoped.weddingSlug()
        } catch {
            wedding = nil
        }
        isLoading = false
    }
}

private struct ReferenceEmptyFeatureView: View {
    let title: String
    let message: String
    let coupleNames: String

    var body: some View {
        ZStack {
            WeddingFloralBackground()
            VStack(spacing: 12) {
                WeddingMonogram(names: coupleNames, size: 40)
                Text(title)
                    .font(.title2)
                    .fontWeight(.semibold)
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 28)
            }
        }
        .navigationTitle(title)
    }
}


private struct ReferenceWeddingProfileView: View {
    let wedding: Wedding

    var body: some View {
        ZStack {
            WeddingFloralBackground(opacity: 0.06)
            ScrollView {
                VStack(spacing: 18) {
                    WewedMediaImage(WewedAsset.heroWedding)
                        .scaledToFill()
                        .wewedMedia(height: 260, horizontalInset: 28)
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: 22))

                    WeddingMonogram(names: wedding.coupleNames, size: 42)

                    Text(wedding.coupleNames)
                        .font(.system(size: 27, weight: .semibold, design: .serif))

                    VStack(spacing: 8) {
                        Label(wedding.venueName, systemImage: "mappin.and.ellipse")
                        Label("\(wedding.city), \(wedding.country)", systemImage: "globe")
                        Label(wedding.date, systemImage: "calendar")
                    }
                    .font(.subheadline)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                }
                .padding(18)
            }
        }
        .navigationTitle("Wedding")
    }
}
