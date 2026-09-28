import SwiftUI

/// The couple's Wedding Site, inside the app.
///
/// The published wedding site was treated as a separate product that happened to belong to the
/// same couple. It is not: the site and the app read the same `WeddingContent` graph. Modelling it
/// as somewhere else is what produced native-only placeholder copy sitting beside a real published
/// site — two sources of truth for one wedding's story.
///
///     WeddingContent
///        ├── the published wedding site (web)
///        ├── Couple → Wedding Site        (this screen)
///        ├── Guest → wedding information
///        └── Planner → client content, where authorized
///
/// One graph, several audiences. Change it on the web and this reflects it after a refresh,
/// because there is nothing else for it to read.
///
/// Editing is deliberately absent rather than disabled-looking: production writes are gated, and a
/// save control that silently does nothing is worse than no control at all.
public struct WeddingSiteView: View {
    private let coupleNames: String
    private let weddingSlug: String?
    private let sections: [WeddingContentSection]
    @State private var openSection: String?

    public init(coupleNames: String, weddingSlug: String?, sections: [WeddingContentSection]) {
        self.coupleNames = coupleNames
        self.weddingSlug = weddingSlug
        self.sections = sections
    }

    /// Reading order — the order a visitor meets the site — rather than alphabetical.
    private static let readingOrder = [
        "hero", "story", "gallery", "venue", "theday", "faq",
        "travel", "songbook", "guests", "vendors", "memory", "after"
    ]

    private var ordered: [WeddingContentSection] {
        sections.sorted { lhs, rhs in
            let l = Self.readingOrder.firstIndex(of: lhs.section) ?? Self.readingOrder.count
            let r = Self.readingOrder.firstIndex(of: rhs.section) ?? Self.readingOrder.count
            return l < r
        }
    }

    public var body: some View {
        if let openSection, let section = sections.first(where: { $0.section == openSection }) {
            VStack(spacing: 0) {
                HStack {
                    Button("Back") { self.openSection = nil }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                        .accessibilityIdentifier("wedding-site-back")
                    Spacer()
                }
                .padding(.horizontal, 14)
                .padding(.top, 8)

                if section.section == "gallery" {
                    GalleryContentSection(section: section, testIdPrefix: "wedding-site-gallery")
                } else {
                    WeddingContentSectionView(section: section,
                                              testIdPrefix: "wedding-site-\(section.section)")
                }
            }
        } else if sections.isEmpty {
            IAEmptySourceSection(
                title: "Wedding Site",
                reason: "No wedding site content has been published for this wedding yet.",
                testIdPrefix: "wedding-site"
            )
        } else {
            let totalEntries = sections.reduce(0) { $0 + $1.entries.count }
            IASectionList("Wedding Site", coupleNames) {
                if let slug = weddingSlug, !slug.isEmpty {
                    IACard("Published at", "wewed.pro/w/\(slug)", testId: "wedding-site-address")
                }
                IACard("Published content",
                       "\(sections.count) sections · \(totalEntries) entries",
                       testId: "wedding-site-summary")

                Text("Sections")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(WeddingIdentityPalette.muted)

                ForEach(ordered) { section in
                    IACard(section.title,
                           "\(section.entries.count) published entries",
                           testId: "wedding-site-section-\(section.section)",
                           onTap: { openSection = section.section })
                }

                Text("This is the same published content your guests see on your wedding site. "
                     + "Editing is available on the web while native writes remain gated.")
                    .font(.system(size: 11))
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }
        }
    }
}
