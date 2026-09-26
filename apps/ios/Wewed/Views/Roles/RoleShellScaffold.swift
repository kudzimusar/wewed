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

    /// Every render decision comes from here; see `RoleShellAuthorization`.
    @State private var authorization: RoleShellAuthorization

    /// The tab that reads as selected: the last AUTHORIZED one, never an unresolved safe return.
    private var selectedId: String {
        authorization.authorizedDestinationId ?? navigation.primary[0].id
    }

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
        // The initial destination is resolved through Entitlements like any other. It used to be
        // rendered directly, before any authorization had run (Phase 1 independent review).
        _authorization = State(initialValue: RoleShellAuthorization.initial(context))
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
                            // Only the destination Entitlements allowed renders content; every
                            // other tab page is the access boundary.
                            if authorization.visibleDestinationId == destination.id {
                                content(destination, context)
                            } else {
                                accessBoundary
                            }
                        }
                        .tabItem {
                            // The identifier must sit on the tab BUTTON, not on the tab's content
                            // view. Applied outside .tabItem it lands on the page, leaving the bar
                            // itself addressable only by its SF Symbol name — so a UI flow could
                            // not tap a tab at all, and "Guests" matched the Home metric tile
                            // instead. Android exposes the same nav-<role>-<destination> ids.
                            Label(destination.label, systemImage: Self.iconFor(destination.id))
                                .accessibilityIdentifier("nav-\(context.activeRole.roleId)-\(destination.id)")
                        }
                        .tag(destination.id)
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
        // A different wedding, assignment or scope is re-resolved from the start rather than
        // inheriting an authorization granted to another context (matches Android's keyed state).
        .onChange(of: context) { _, updated in
            authorization = RoleShellAuthorization.initial(updated)
        }
        .onChange(of: pendingDeepLink) { _, link in
            guard let link else { return }
            let resolution = DeepLinkRouter.resolve(link, context: context)
            authorization = authorization.applying(resolution)
            if case let .allowed(destination, _) = resolution {
                if case let .workspace(workspace) = link {
                    // Level-2 deep links land on the requested section, not the workspace default.
                    sectionMemory.applyRequested(
                        context: context,
                        destinationId: destination.id,
                        requested: workspace.section,
                        available: destination.sections
                    )
                }
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
        // Content renders ONLY for a destination Entitlements.resolve allowed for this context.
        if let visible = authorization.visibleDestinationId.flatMap(navigation.destination) {
            content(visible, context)
        } else {
            accessBoundary
        }
    }

    /// The boundary, with "Go back" offered only when there is an authorized destination to return
    /// to. Dismissing never reveals a destination that has not been resolved.
    private var accessBoundary: some View {
        AccessBoundaryNotice(
            reason: authorization.denialReason ?? "This workspace is not authorized for this session.",
            onDismiss: authorization.canDismissDenial
                ? { authorization = authorization.dismissingDenial() }
                : nil
        )
    }

    /// Every tab change passes through the entitlement gate before the destination is shown.
    private var tabSelection: Binding<String> {
        Binding(
            get: { selectedId },
            set: { requested in
                authorization = authorization.selecting(context, destinationId: requested)
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
    /// Nil when there is nowhere authorized to go back to.
    let onDismiss: (() -> Void)?

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
            if let onDismiss {
                Button("Go back", action: onDismiss)
                    .foregroundColor(WeddingIdentityPalette.champagneDeep)
                    .fontWeight(.semibold)
                    .accessibilityIdentifier("access-boundary-dismiss")
            }
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
