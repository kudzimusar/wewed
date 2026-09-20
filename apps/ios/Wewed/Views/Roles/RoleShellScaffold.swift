import SwiftUI

/// Contract-driven Level-1 shell shared by every IA V2 role.
///
/// The tab bar is rendered from `IANavigationContract` rather than hand-written per role, so
/// labels and order cannot drift between roles or platforms. Every destination switch resolves
/// through `Entitlements.resolve` with the active `NavigationContext` carried forward unchanged.
public struct RoleShellScaffold<Content: View>: View {
    private let context: NavigationContext
    private let onSwitchPersona: (() -> Void)?
    /// A parsed but not yet authorized deep link / notification target (P0-8).
    private let pendingDeepLink: NativeDeepLink?
    private let onDeepLinkHandled: (() -> Void)?
    @ObservedObject private var sectionMemory: WorkspaceSectionMemory
    private let content: (PrimaryDestination, NavigationContext) -> Content

    @State private var selectedId: String
    @State private var denialReason: String?

    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    #endif

    /// IA V2 §15.2 — regular width promotes Level-1 into a navigation rail. The taxonomy is
    /// identical; only the presentation adapts, so there is no separate tablet IA.
    private var useRail: Bool {
        #if os(iOS)
        return horizontalSizeClass == .regular
        #else
        return true
        #endif
    }

    public init(
        context: NavigationContext,
        onSwitchPersona: (() -> Void)? = nil,
        pendingDeepLink: NativeDeepLink? = nil,
        sectionMemory: WorkspaceSectionMemory,
        onDeepLinkHandled: (() -> Void)? = nil,
        @ViewBuilder content: @escaping (PrimaryDestination, NavigationContext) -> Content
    ) {
        self.context = context
        self.onSwitchPersona = onSwitchPersona
        self.pendingDeepLink = pendingDeepLink
        self.sectionMemory = sectionMemory
        self.onDeepLinkHandled = onDeepLinkHandled
        self.content = content
        _selectedId = State(initialValue: IANavigationContract.forRole(context.activeRole).primary[0].id)
    }

    private var navigation: RoleNavigation {
        IANavigationContract.forRole(context.activeRole)
    }

    public var body: some View {
        VStack(spacing: 0) {
            RoleContextBar(context: context, onSwitchPersona: onSwitchPersona)

            if useRail {
                HStack(spacing: 0) {
                    navigationRail
                    Divider().overlay(WeddingIdentityPalette.hairline)
                    workspace
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .accessibilityIdentifier("layout-rail")
            } else {
                TabView(selection: tabSelection) {
                    ForEach(navigation.primary) { destination in
                        // Every workspace renders inside the Wewed screen container, which
                        // publishes an explicit bounded width. Media then fills that width
                        // instead of dictating the screen's width (P0 responsive contract).
                        WewedScreenContainer {
                            if let denialReason {
                                AccessBoundaryNotice(reason: denialReason) {
                                    self.denialReason = nil
                                }
                            } else {
                                content(destination, context)
                            }
                        }
                        .tabItem {
                            Label(destination.label, systemImage: Self.iconFor(destination.id))
                        }
                        .tag(destination.id)
                        .accessibilityIdentifier("nav-\(context.activeRole.roleId)-\(destination.id)")
                    }
                }
                .tint(WeddingIdentityPalette.champagneDeep)
                .accessibilityIdentifier("layout-bottom-bar")
            }
        }
        .background(WeddingIdentityPalette.ivory)
        .accessibilityIdentifier("role-shell-\(context.activeRole.roleId)")
        // P0-8: the WHOLE deep link is resolved here — target wedding, destination, Level-2
        // section and entity id — through the same gate as a tap. Nothing is discarded before
        // authorization.
        .onChange(of: pendingDeepLink) { _, link in
            guard let link else { return }
            switch DeepLinkRouter.resolve(link, context: context) {
            case let .allowed(destination, _):
                denialReason = nil
                selectedId = destination.id
                if case let .workspace(workspace) = link {
                    // Level-2 deep links land on the requested section, not the workspace default.
                    sectionMemory.applyRequested(
                        context: context,
                        destinationId: destination.id,
                        requested: workspace.section,
                        available: destination.sections
                    )
                }
            case let .denied(reason, safeReturn):
                denialReason = reason
                selectedId = safeReturn
            }
            onDeepLinkHandled?()
        }
    }

    /// Rail rendering of the very same contract destinations used by the tab bar.
    private var navigationRail: some View {
        VStack(spacing: 4) {
            ForEach(navigation.primary) { destination in
                Button {
                    tabSelection.wrappedValue = destination.id
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: Self.iconFor(destination.id))
                            .font(.system(size: 17))
                        Text(destination.label)
                            .font(.system(size: 11, weight: selectedId == destination.id ? .semibold : .regular))
                            .lineLimit(1)
                    }
                    .foregroundColor(
                        selectedId == destination.id
                            ? WeddingIdentityPalette.champagneDeep
                            : WeddingIdentityPalette.muted
                    )
                    // 48pt practical touch target (IA V2 §19).
                    .frame(width: 96, height: 56)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("nav-\(context.activeRole.roleId)-\(destination.id)")
            }
            Spacer()
        }
        .padding(.top, 10)
        .frame(width: 96)
        .background(WeddingIdentityPalette.ivorySoft)
        .accessibilityIdentifier("nav-rail-\(context.activeRole.roleId)")
    }

    @ViewBuilder
    private var workspace: some View {
        if let denialReason {
            AccessBoundaryNotice(reason: denialReason) {
                self.denialReason = nil
            }
        } else {
            content(navigation.destination(selectedId) ?? navigation.primary[0], context)
        }
    }

    /// Every tab change passes through the entitlement gate before the destination is shown.
    private var tabSelection: Binding<String> {
        Binding(
            get: { selectedId },
            set: { requested in
                switch Entitlements.resolve(context, destinationId: requested) {
                case let .allowed(destination, _):
                    denialReason = nil
                    selectedId = destination.id
                case let .denied(reason, safeReturn):
                    denialReason = reason
                    selectedId = safeReturn
                }
            }
        )
    }

    static func iconFor(_ destinationId: String) -> String {
        switch destinationId {
        case "home": return "house.fill"
        case "plan", "workspace": return "calendar.badge.checkmark"
        case "guests": return "person.2.fill"
        case "wedding_day": return "sparkles"
        case "clients": return "folder.fill"
        case "daily_ops": return "bolt.fill"
        case "invitation": return "envelope.fill"
        case "pass": return "qrcode"
        case "jobs": return "bag.fill"
        case "schedule": return "clock.fill"
        case "messages": return "tray.full.fill"
        case "scan": return "qrcode.viewfinder"
        case "admissions": return "person.badge.check.mark.fill"
        case "incidents": return "exclamationmark.triangle.fill"
        case "today": return "sun.max.fill"
        case "run_sheet": return "list.bullet.rectangle.portrait"
        case "team": return "person.3.fill"
        case "dashboard": return "square.grid.2x2.fill"
        case "cases": return "lifepreserver.fill"
        case "accounts": return "person.crop.circle.fill"
        case "audit": return "lock.shield.fill"
        default: return "line.3.horizontal"
        }
    }
}

/// IA V2 §1.2 — role and active wedding must never be ambiguous.
struct RoleContextBar: View {
    let context: NavigationContext
    let onSwitchPersona: (() -> Void)?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(IANavigationContract.forRole(context.activeRole).displayName)
                        .font(.system(size: 17, weight: .semibold, design: .serif))
                        .foregroundColor(WeddingIdentityPalette.ink)
                        .lineLimit(1)
                    Text(context.activeWeddingTitle)
                        .font(.system(size: 12))
                        .foregroundColor(WeddingIdentityPalette.muted)
                        .lineLimit(1)
                        .accessibilityIdentifier("active-wedding-label")
                }

                Spacer()

                Text(context.environment.title)
                    .font(.system(size: 9, weight: .bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(WeddingIdentityPalette.forestSoft)
                    .foregroundColor(WeddingIdentityPalette.forest)
                    .clipShape(Capsule())
                    .accessibilityIdentifier("environment-badge")

                if let onSwitchPersona {
                    Button(action: onSwitchPersona) {
                        Image(systemName: "person.crop.circle.badge.questionmark")
                            .foregroundColor(WeddingIdentityPalette.champagneDeep)
                    }
                    .accessibilityLabel("Switch role")
                    .accessibilityIdentifier("role-switch-button")
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .accessibilityIdentifier("role-context-bar")

            Divider().overlay(WeddingIdentityPalette.hairline)
        }
        .background(WeddingIdentityPalette.ivorySoft)
    }
}

/// IA V2 §14 — explain the boundary, leak no destination data, offer a safe return.
struct AccessBoundaryNotice: View {
    let reason: String
    let onDismiss: () -> Void

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "lock.fill")
                .font(.system(size: 30))
                .foregroundColor(WeddingIdentityPalette.muted)
            Text("Not available for this role")
                .font(.system(size: 18, weight: .semibold, design: .serif))
                .foregroundColor(WeddingIdentityPalette.ink)
            Text(reason)
                .font(.system(size: 13))
                .foregroundColor(WeddingIdentityPalette.muted)
                .multilineTextAlignment(.center)
            Button("Go back", action: onDismiss)
                .foregroundColor(WeddingIdentityPalette.champagneDeep)
                .fontWeight(.semibold)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WeddingIdentityPalette.ivory)
        .accessibilityIdentifier("access-boundary-notice")
    }
}

/// Level-2 workspace selector. Renders the documented section taxonomy as chips; depth lives here
/// rather than in the tab bar (IA V2 §1.1).
public struct WorkspaceSectionChips: View {
    let sections: [String]
    let selected: String
    let testIdPrefix: String
    let onSelect: (String) -> Void

    public init(sections: [String], selected: String, testIdPrefix: String, onSelect: @escaping (String) -> Void) {
        self.sections = sections
        self.selected = selected
        self.testIdPrefix = testIdPrefix
        self.onSelect = onSelect
    }

    public var body: some View {
        if sections.isEmpty {
            EmptyView()
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 7) {
                    ForEach(sections, id: \.self) { section in
                        let isSelected = section == selected
                        Button {
                            onSelect(section)
                        } label: {
                            Text(section)
                                .font(.system(size: 11, weight: isSelected ? .semibold : .regular))
                                .lineLimit(1)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(isSelected ? WeddingIdentityPalette.champagneDeep : WeddingIdentityPalette.ivorySoft)
                                .foregroundColor(isSelected ? WeddingIdentityPalette.ivorySoft : WeddingIdentityPalette.muted)
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule().stroke(
                                        isSelected ? Color.clear : WeddingIdentityPalette.hairline,
                                        lineWidth: 1
                                    )
                                )
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("\(testIdPrefix)-section-\(section.iaSlug)")
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
            }
            .accessibilityIdentifier("\(testIdPrefix)-sections")
        }
    }
}

extension String {
    var iaSlug: String {
        lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
    }
}
