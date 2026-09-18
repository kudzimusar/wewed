import SwiftUI

public struct WeddingReferenceMoreView: View {
    @EnvironmentObject private var appState: AppState
    @State private var wedding: Wedding?
    @State private var isLoading = true

    public init() {}

    public var body: some View {
        NavigationStack {
            ZStack {
                WeddingFloralBackground()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 14) {
                        header

                        if isLoading {
                            ProgressView("Loading wedding…")
                                .frame(maxWidth: .infinity)
                                .padding(.top, 80)
                        } else if let wedding {
                            weddingCard(wedding)

                            menuLink(title: "Our Story", subtitle: "Photos, videos and milestones", icon: "photo.on.rectangle.angled") {
                                ReferenceEmptyFeatureView(
                                    title: "Our Story",
                                    message: "No story or media records are available in this Shadow wedding yet."
                                )
                            }

                            menuLink(title: "Gallery", subtitle: "Wedding photos and inspiration", icon: "photo.stack") {
                                ReferenceEmptyFeatureView(
                                    title: "Gallery",
                                    message: "No gallery media is available in this Shadow wedding yet."
                                )
                            }

                            menuLink(title: "Honeymoon", subtitle: "Contributions and plans", icon: "airplane.departure") {
                                ShadowPlannerContributionsView()
                            }

                            menuLink(title: "Settings", subtitle: "App preferences", icon: "gearshape") {
                                SettingsView()
                            }

                            menuLink(title: "Help & Support", subtitle: "Get in touch", icon: "questionmark.circle") {
                                ReferenceEmptyFeatureView(
                                    title: "Help & Support",
                                    message: "Support contact configuration is not part of this Shadow wedding dataset."
                                )
                            }
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.top, 12)
                    .padding(.bottom, 24)
                }
            }
            #if os(iOS)\n            .toolbar(.hidden, for: .navigationBar)\n            #endif
            .task { await load() }
        }
        .accessibilityIdentifier("reference-more-root")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text("More")
                .font(.system(size: 28, weight: .semibold, design: .serif))
                .foregroundStyle(WeddingIdentityPalette.ink)
            Text("Your wedding, beautifully organised.")
                .font(.system(size: 12))
                .foregroundStyle(WeddingIdentityPalette.muted)
        }
    }

    private func weddingCard(_ wedding: Wedding) -> some View {
        HStack(spacing: 12) {
            Image("hero-wedding", bundle: .module)
                .resizable()
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
    }

    private func menuLink<Destination: View>(
        title: String,
        subtitle: String,
        icon: String,
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
    }

    private func load() async {
        do {
            wedding = try await appState.repository.getWedding()
        } catch {
            wedding = nil
        }
        isLoading = false
    }
}

private struct ReferenceEmptyFeatureView: View {
    let title: String
    let message: String

    var body: some View {
        ZStack {
            WeddingFloralBackground()
            VStack(spacing: 12) {
                WeddingMonogram(names: "C & K", size: 40)
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
