import SwiftUI

// Shared, accessible building blocks for every shell: account, test-access notice, maps,
// support links and plain cards. Sizes use text styles so they follow Dynamic Type.

// MARK: - Buttons

public struct WeddingActionButtonStyle: ButtonStyle {
    public enum Kind { case primary, secondary, quiet, destructive }
    let kind: Kind
    let fullWidth: Bool

    public init(_ kind: Kind = .primary, fullWidth: Bool = true) {
        self.kind = kind
        self.fullWidth = fullWidth
    }

    public func makeBody(configuration: Configuration) -> some View {
        StyledLabel(configuration: configuration, kind: kind, fullWidth: fullWidth)
    }

    private struct StyledLabel: View {
        let configuration: Configuration
        let kind: Kind
        let fullWidth: Bool
        @Environment(\.isEnabled) private var isEnabled

        var body: some View {
            configuration.label
                .font(.body.weight(.semibold))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: 48)
                .foregroundStyle(foreground)
                .background(background, in: RoundedRectangle(cornerRadius: 13))
                .overlay(
                    RoundedRectangle(cornerRadius: 13)
                        .stroke(kind == .secondary ? WeddingIdentityPalette.champagne : .clear, lineWidth: 1.2)
                )
                .contentShape(RoundedRectangle(cornerRadius: 13))
                .opacity(isEnabled ? (configuration.isPressed ? 0.75 : 1) : 0.45)
        }

        private var foreground: Color {
            switch kind {
            case .primary: return .white
            case .secondary, .quiet: return WeddingIdentityPalette.ink
            case .destructive: return Color(red: 0.61, green: 0.11, blue: 0.11)
            }
        }

        private var background: Color {
            switch kind {
            case .primary: return WeddingIdentityPalette.forest
            case .secondary: return WeddingIdentityPalette.ivorySoft
            case .quiet: return WeddingIdentityPalette.champagne.opacity(0.14)
            case .destructive: return Color(red: 0.61, green: 0.11, blue: 0.11).opacity(0.08)
            }
        }
    }
}

// MARK: - Cards and text

public struct PlainCard<Content: View>: View {
    private let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(WeddingIdentityPalette.ivorySoft, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(WeddingIdentityPalette.hairline, lineWidth: 1))
    }
}

/// A label above its value; reads as "Label, value" to VoiceOver.
public struct InfoLine: View {
    let label: String
    let value: String
    let identifier: String?

    public init(_ label: String, _ value: String, identifier: String? = nil) {
        self.label = label
        self.value = value
        self.identifier = identifier
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(WeddingIdentityPalette.muted)
            Text(value)
                .font(.body.weight(.semibold))
                .foregroundStyle(WeddingIdentityPalette.ink)
                .fixedSize(horizontal: false, vertical: true)
                .modifier(OptionalIdentifier(identifier: identifier))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: identifier == nil ? .combine : .contain)
    }
}

struct OptionalIdentifier: ViewModifier {
    let identifier: String?

    func body(content: Content) -> some View {
        if let identifier {
            content.accessibilityIdentifier(identifier)
        } else {
            content
        }
    }
}

public struct SectionHeading: View {
    let title: String

    public init(_ title: String) {
        self.title = title
    }

    public var body: some View {
        Text(title)
            .font(.system(.title3, design: .serif).weight(.semibold))
            .foregroundStyle(WeddingIdentityPalette.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityAddTraits(.isHeader)
    }
}

/// Honest empty or unavailable state, in plain words.
public struct EmptyStateText: View {
    let text: String
    let identifier: String

    public init(_ text: String, identifier: String) {
        self.text = text
        self.identifier = identifier
    }

    public var body: some View {
        Text(text)
            .font(.body)
            .foregroundStyle(WeddingIdentityPalette.muted)
            .multilineTextAlignment(.leading)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .padding(14)
            .background(WeddingIdentityPalette.ivorySoft, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(WeddingIdentityPalette.hairline, lineWidth: 1))
            .accessibilityIdentifier(identifier)
    }
}

/// Status always carries words; the icon only supports them.
public struct StatusText: View {
    public enum Tone { case positive, attention, neutral, negative }
    let text: String
    let systemImage: String?
    let tone: Tone

    public init(_ text: String, systemImage: String? = nil, tone: Tone = .neutral) {
        self.text = text
        self.systemImage = systemImage
        self.tone = tone
    }

    public var body: some View {
        HStack(spacing: 6) {
            if let systemImage {
                Image(systemName: systemImage)
                    .accessibilityHidden(true)
            }
            Text(text)
        }
        .font(.subheadline.weight(.semibold))
        .foregroundStyle(color)
    }

    private var color: Color {
        switch tone {
        case .positive: return WeddingIdentityPalette.forest
        case .attention: return WeddingIdentityPalette.champagneDeep
        case .neutral: return WeddingIdentityPalette.muted
        case .negative: return Color(red: 0.61, green: 0.11, blue: 0.11)
        }
    }
}

public struct LoadFailureText: View {
    let what: String

    public init(_ what: String) {
        self.what = what
    }

    public var body: some View {
        EmptyStateText("We couldn't load \(what). Pull down or use Refresh to try again.", identifier: "load-failure")
    }
}

// MARK: - Test access notice

/// Shown near the top of a shell when the active grant is an explicit test overlay.
public struct TestAccessNotice: View {
    let grant: RoleGrant

    public init(grant: RoleGrant) {
        self.grant = grant
    }

    public var body: some View {
        if grant.isTestOverlay {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "info.circle.fill")
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                    .accessibilityHidden(true)
                Text(grant.provenanceNote)
                    .font(.footnote)
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(WeddingIdentityPalette.champagne.opacity(0.18))
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("test-access-notice")
        }
    }
}

// MARK: - Maps

/// "Open in Maps" built from the recorded venue; says so plainly when nothing usable is recorded.
public struct OpenInMapsButton: View {
    @Environment(\.openURL) private var openURL
    let venue: VenueLocation?
    let identifier: String
    let kind: WeddingActionButtonStyle.Kind

    public init(venue: VenueLocation?, identifier: String, kind: WeddingActionButtonStyle.Kind = .secondary) {
        self.venue = venue
        self.identifier = identifier
        self.kind = kind
    }

    public var body: some View {
        if let venue, let links = MapsLinkBuilder.build(venue), let url = URL(string: links.appleMapsUrl) {
            Button {
                openURL(url)
            } label: {
                Label("Open in Maps", systemImage: "map")
            }
            .buttonStyle(WeddingActionButtonStyle(kind))
            .accessibilityHint("Shows \(links.displayQuery) in Maps")
            .accessibilityIdentifier(identifier)
        } else {
            Text("Venue location not recorded")
                .font(.callout)
                .foregroundStyle(WeddingIdentityPalette.muted)
                .frame(maxWidth: .infinity, minHeight: 44)
                .accessibilityIdentifier("venue-location-not-recorded")
        }
    }
}

// MARK: - Account

/// Who is signed in, their current role, the wedding, role switching and sign-out.
public struct AccountView: View {
    @EnvironmentObject private var session: SessionStore
    let grant: RoleGrant

    public init(grant: RoleGrant) {
        self.grant = grant
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PlainCard {
                    VStack(alignment: .leading, spacing: 14) {
                        InfoLine("Signed in as", session.session?.displayName ?? "", identifier: "account-display-name")
                        InfoLine("Using Wewed as", grant.role.choiceLabel, identifier: "account-current-role")
                        InfoLine("Wedding", grant.weddingTitle, identifier: "account-wedding")
                    }
                }

                if let switchAction {
                    Button(action: switchAction.perform) {
                        Label(switchAction.title, systemImage: "arrow.left.arrow.right")
                    }
                    .buttonStyle(WeddingActionButtonStyle(.secondary))
                    .accessibilityIdentifier("account-switch-role")
                }

                Button {
                    session.signOut()
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                }
                .buttonStyle(WeddingActionButtonStyle(.destructive))
                .accessibilityIdentifier("account-sign-out")
            }
            .padding(16)
        }
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .navigationTitle("Account")
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("account-root")
    }

    private struct SwitchAction {
        let title: String
        let perform: () -> Void
    }

    /// Only offered when the session holds more than one grant; never offers a role it was not granted.
    private var switchAction: SwitchAction? {
        guard let current = session.session, current.grants.count > 1 else { return nil }
        let others = current.grants.filter { $0.role != grant.role }
        if others.count == 1, let other = others.first {
            return SwitchAction(title: "Switch to \(other.role.choiceLabel)") { session.activate(other.role) }
        }
        return SwitchAction(title: "Switch to another way of using Wewed") { session.clearActiveRole() }
    }
}

// MARK: - Help & Support

public struct HelpSupportView: View {
    public static let supportEmail = "support@wewed.pro"
    public static let helpCentre = URL(string: "https://wewed.pro/help")!

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                PlainCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Wewed support")
                            .font(.headline)
                            .foregroundStyle(WeddingIdentityPalette.ink)
                        Text("Questions about the app or your wedding account? Email Wewed support or read the Help Centre.")
                            .font(.body)
                            .foregroundStyle(WeddingIdentityPalette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                Link(destination: URL(string: "mailto:\(Self.supportEmail)")!) {
                    Label("Email \(Self.supportEmail)", systemImage: "envelope")
                }
                .buttonStyle(WeddingActionButtonStyle(.secondary))
                .accessibilityIdentifier("support-email")

                Link(destination: Self.helpCentre) {
                    Label("Open the Help Centre", systemImage: "questionmark.circle")
                }
                .buttonStyle(WeddingActionButtonStyle(.secondary))
                .accessibilityIdentifier("support-help-centre")
            }
            .padding(16)
        }
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .navigationTitle("Help & Support")
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("help-support-root")
    }
}

// MARK: - Navigation rows

/// A full-width navigation row with a visible title, optional subtitle and a decorative icon.
public struct MenuRowLabel: View {
    let title: String
    let subtitle: String?
    let systemImage: String

    public init(_ title: String, subtitle: String? = nil, systemImage: String) {
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
    }

    public var body: some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                .frame(width: 36, height: 36)
                .background(WeddingIdentityPalette.champagne.opacity(0.14), in: Circle())
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(.body, design: .serif).weight(.semibold))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(WeddingIdentityPalette.muted)
                .accessibilityHidden(true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
        .background(WeddingIdentityPalette.ivorySoft, in: RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(WeddingIdentityPalette.hairline, lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 15))
    }
}

// MARK: - Shell frame

/// Puts the test-access notice at the top of a shell and marks the shell root for tests.
public struct ShellFrame<Content: View>: View {
    let grant: RoleGrant
    let identifier: String
    let content: Content

    public init(grant: RoleGrant, identifier: String, @ViewBuilder content: () -> Content) {
        self.grant = grant
        self.identifier = identifier
        self.content = content()
    }

    public var body: some View {
        VStack(spacing: 0) {
            TestAccessNotice(grant: grant)
            // The identifier sits on the tab container itself: SwiftUI cannot expose a plain stack as
            // an accessibility container around a UIKit-backed TabView, but it does label the TabView.
            content
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier(identifier)
        }
        .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
        .tint(WeddingIdentityPalette.champagneDeep)
    }
}
