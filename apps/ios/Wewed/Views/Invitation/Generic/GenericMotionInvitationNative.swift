import SwiftUI

/// Native generic premium invitation renderer for iOS SwiftUI.
///
/// Faithfully ports the PWA generic motion card engine (`premium-invitation-experience.tsx`)
/// across all 11 non-Ivory styles. Ivory Floral Gold retains its dedicated flagship renderer.
///
/// Supports the 6 generic motion presets:
/// - gate-fold (Midnight Gold, African Luxe, Black Tie)
/// - envelope-letter (Royal Emerald, Blush Romance)
/// - book-open (Classic White, Celestial)
/// - single-card-lift (Modern Editorial)
/// - floral-reveal (Garden Romance / botanical, Watercolour Garden)
/// - sleeve-pull (Sunset Terracotta)
///
/// And the 7 atmosphere presets:
/// - champagne-glow, soft-bokeh, petals, candlelight, stars, watercolour-bloom, minimal.
public struct GenericMotionInvitationNative: View {
    private let style: InvitationStyle
    private let data: IvoryInvitationData
    private let rsvp: IvoryRsvpState
    private let actions: IvoryActions
    private let reducedMotion: Bool
    private let onStateChanged: (InvitationPresentationState) -> Void

    @State private var presentationState: InvitationPresentationState

    public init(
        style: InvitationStyle,
        data: IvoryInvitationData,
        rsvp: IvoryRsvpState,
        actions: IvoryActions,
        reducedMotion: Bool = false,
        initialState: InvitationPresentationState = .closed,
        onStateChanged: @escaping (InvitationPresentationState) -> Void = { _ in }
    ) {
        self.style = style
        self.data = data
        self.rsvp = rsvp
        self.actions = actions
        self.reducedMotion = reducedMotion
        self._presentationState = State(initialValue: initialState)
        self.onStateChanged = onStateChanged
    }

    private var isOpen: Bool {
        presentationState == .open || presentationState == .details
    }

    private var palette: InvitationPalette {
        style.palette
    }

    public var body: some View {
        ZStack {
            // Stage background with radial gradient
            RadialGradient(
                colors: [palette.primary.opacity(0.24), palette.stage],
                center: .center,
                startRadius: 50,
                endRadius: 500
            )
            .ignoresSafeArea()

            // Atmosphere overlay
            AtmosphereView(
                atmosphere: style.atmosphere,
                primary: palette.primary,
                accent: palette.accent,
                isOpen: isOpen
            )

            ScrollView {
                VStack(spacing: 20) {
                    Text("Wewed · Private wedding invitation")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(2.5)
                        .foregroundStyle(Color.white.opacity(0.65))
                        .padding(.top, 16)

                    // Motion card container
                    ZStack {
                        switch style.motion {
                        case .gateFold:
                            GateFoldView(data: data, palette: palette, isOpen: isOpen, reducedMotion: reducedMotion)
                        case .envelopeLetter:
                            EnvelopeLetterView(data: data, palette: palette, isOpen: isOpen, reducedMotion: reducedMotion)
                        case .bookOpen:
                            BookOpenView(data: data, palette: palette, isOpen: isOpen, reducedMotion: reducedMotion)
                        case .singleCardLift:
                            SingleCardLiftView(data: data, palette: palette, isOpen: isOpen, reducedMotion: reducedMotion)
                        case .floralReveal:
                            FloralRevealView(data: data, palette: palette, isOpen: isOpen, reducedMotion: reducedMotion)
                        case .sleevePull:
                            SleevePullView(data: data, palette: palette, isOpen: isOpen, reducedMotion: reducedMotion)
                        case .triFold:
                            SingleCardLiftView(data: data, palette: palette, isOpen: isOpen, reducedMotion: reducedMotion)
                        }

                        // Closed state Open Invitation button
                        if !isOpen {
                            VStack {
                                Spacer()
                                Button(action: openInvitation) {
                                    HStack(spacing: 8) {
                                        Image(systemName: "sparkles")
                                        Text("Open invitation")
                                            .font(.system(size: 14, weight: .semibold))
                                    }
                                    .padding(.horizontal, 24)
                                    .padding(.vertical, 12)
                                    .background(palette.primary)
                                    .foregroundStyle(palette.paper)
                                    .clipShape(Capsule())
                                    .overlay(Capsule().stroke(palette.accent, lineWidth: 1.5))
                                    .shadow(color: Color.black.opacity(0.35), radius: 10, y: 5)
                                }
                                .accessibilityIdentifier("invitation-open-button")
                                .padding(.bottom, 24)
                            }
                        }
                    }
                    .frame(minHeight: 500)

                    // Actions section when open
                    if isOpen {
                        GenericInvitationActionsView(
                            rsvp: rsvp,
                            actions: actions,
                            palette: palette
                        )
                        .padding(.top, 12)
                        .padding(.bottom, 32)
                        // A leaf marker, not a modifier on the actions view itself:
                        // `.accessibilityIdentifier` on a container is inherited by every
                        // descendant that does not set its own, which would rename the CTA
                        // buttons inside (see AccessibilityMarker's own documentation).
                        .overlay(AccessibilityMarker("invitation-details", label: "Invitation details"))
                    }
                }
                .padding(.horizontal, 16)
            }

            // A leaf marker rather than a modifier on the ZStack: see the comment above.
            AccessibilityMarker("premium-invitation-experience", label: "Invitation experience")
        }
    }

    private func openInvitation() {
        guard presentationState == .closed else { return }
        if reducedMotion {
            presentationState = .open
            onStateChanged(.open)
            return
        }
        presentationState = .opening
        onStateChanged(.opening)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.15) {
            presentationState = .open
            onStateChanged(.open)
        }
    }
}

// MARK: - Atmosphere

private struct AtmosphereView: View {
    let atmosphere: InvitationAtmosphere
    let primary: Color
    let accent: Color
    let isOpen: Bool

    private var opacity: Double {
        guard isOpen else { return 0 }
        switch atmosphere {
        case .stars: return 0.70
        case .petals, .watercolourBloom: return 0.55
        case .minimal: return 0.15
        default: return 0.45
        }
    }

    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width
            let h = proxy.size.height

            ZStack {
                Circle()
                    .fill(primary.opacity(0.35))
                    .frame(width: 220, height: 220)
                    .blur(radius: 60)
                    .position(x: w * 0.15, y: h * 0.20)

                Circle()
                    .fill(accent.opacity(0.28))
                    .frame(width: 260, height: 260)
                    .blur(radius: 70)
                    .position(x: w * 0.85, y: h * 0.80)

                if atmosphere == .stars {
                    Circle().fill(Color.white.opacity(0.75)).frame(width: 3, height: 3).position(x: w * 0.20, y: h * 0.25)
                    Circle().fill(Color.white.opacity(0.65)).frame(width: 3, height: 3).position(x: w * 0.75, y: h * 0.18)
                    Circle().fill(Color.white.opacity(0.70)).frame(width: 4, height: 4).position(x: w * 0.62, y: h * 0.72)
                    Circle().fill(Color.white.opacity(0.55)).frame(width: 3, height: 3).position(x: w * 0.30, y: h * 0.80)
                }

                if atmosphere == .petals || atmosphere == .watercolourBloom {
                    Capsule()
                        .fill(primary.opacity(0.45))
                        .frame(width: 24, height: 14)
                        .rotationEffect(.degrees(28))
                        .position(x: w * 0.17, y: h * 0.22)

                    Capsule()
                        .fill(accent.opacity(0.45))
                        .frame(width: 20, height: 12)
                        .rotationEffect(.degrees(-34))
                        .position(x: w * 0.80, y: h * 0.31)
                }
            }
            .opacity(opacity)
            .animation(.easeInOut(duration: 1.0), value: isOpen)
        }
    }
}

// MARK: - Centre Invitation Face

private struct CentreInvitationFace: View {
    let data: IvoryInvitationData
    let palette: InvitationPalette
    var compact: Bool = false

    var body: some View {
        VStack(spacing: compact ? 8 : 12) {
            Text("TOGETHER WITH OUR FAMILIES")
                .font(.system(size: compact ? 8 : 10, weight: .semibold))
                .tracking(2.5)
                .foregroundStyle(palette.muted)

            if !data.monogram.isEmpty {
                Text(data.monogram)
                    .font(.system(size: compact ? 16 : 22, design: .serif))
                    .tracking(2)
                    .foregroundStyle(palette.primary)
            }

            if let guest = data.guestName, !guest.isEmpty {
                Text("Especially for \(guest)")
                    .font(.system(size: compact ? 11 : 13))
                    .italic()
                    .foregroundStyle(palette.muted)
                    .accessibilityIdentifier("invitation-guest-name")
            }

            Text(data.coupleNames)
                .font(.system(size: compact ? 22 : 28, design: .serif))
                .foregroundStyle(palette.ink)
                .multilineTextAlignment(.center)
                .accessibilityIdentifier("invitation-couple-names")

            if !data.message.isEmpty {
                Text(data.message)
                    .font(.system(size: compact ? 11 : 13))
                    .foregroundStyle(palette.ink.opacity(0.85))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 10)
            }

            let dateComponents = [data.weekdayLabel, data.dayLabel, data.monthLabel, data.yearLabel]
                .compactMap { $0?.isEmpty == false ? $0 : nil }
            if !dateComponents.isEmpty {
                Text(dateComponents.joined(separator: " "))
                    .font(.system(size: compact ? 13 : 16, design: .serif))
                    .foregroundStyle(palette.ink)
            }

            Rectangle()
                .fill(palette.primary.opacity(0.35))
                .frame(width: 48, height: 1)

            if !data.venue.isEmpty {
                Text(data.venue.uppercased())
                    .font(.system(size: compact ? 10 : 12, weight: .semibold))
                    .tracking(1.5)
                    .foregroundStyle(palette.ink)
                    .multilineTextAlignment(.center)
            }

            if !data.venueCityCountry.isEmpty {
                Text(data.venueCityCountry)
                    .font(.system(size: compact ? 10 : 12))
                    .foregroundStyle(palette.muted)
                    .multilineTextAlignment(.center)
            }

            if let deadline = data.rsvpDeadlineLabel, !deadline.isEmpty {
                Text("RSVP BY \(deadline.uppercased())")
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(1.2)
                    .foregroundStyle(palette.primary)
                    .padding(.top, 4)
                    .accessibilityIdentifier("invitation-rsvp-deadline")
            }
        }
        .padding(compact ? 16 : 24)
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Base Stationery Card

private struct BaseStationeryCardView: View {
    let data: IvoryInvitationData
    let palette: InvitationPalette
    var compact: Bool = false

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 20)
                .fill(palette.paper)
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(palette.primary.opacity(0.5), lineWidth: 1)
                )
                .shadow(color: Color.black.opacity(0.2), radius: 12, y: 6)

            CentreInvitationFace(data: data, palette: palette, compact: compact)
        }
    }
}

// MARK: - Motion Presets

private struct GateFoldView: View {
    let data: IvoryInvitationData
    let palette: InvitationPalette
    let isOpen: Bool
    let reducedMotion: Bool

    var body: some View {
        ZStack {
            BaseStationeryCardView(data: data, palette: palette)

            // Left panel
            GeometryReader { geo in
                RoundedRectangle(cornerRadius: 20)
                    .fill(palette.paper)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(palette.primary.opacity(0.5), lineWidth: 1)
                    )
                    .frame(width: geo.size.width / 2)
                    .rotation3DEffect(
                        .degrees(isOpen ? -118 : 0),
                        axis: (x: 0, y: 1, z: 0),
                        anchor: .leading,
                        perspective: 0.5
                    )
                    .animation(reducedMotion ? nil : .easeInOut(duration: 1.1), value: isOpen)
            }

            // Right panel
            GeometryReader { geo in
                HStack {
                    Spacer()
                    RoundedRectangle(cornerRadius: 20)
                        .fill(palette.paper)
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(palette.primary.opacity(0.5), lineWidth: 1)
                        )
                        .frame(width: geo.size.width / 2)
                        .rotation3DEffect(
                            .degrees(isOpen ? 118 : 0),
                            axis: (x: 0, y: 1, z: 0),
                            anchor: .trailing,
                            perspective: 0.5
                        )
                        .animation(reducedMotion ? nil : .easeInOut(duration: 1.1), value: isOpen)
                }
            }
        }
        .accessibilityIdentifier("motion-gate-fold")
    }
}

private struct EnvelopeLetterView: View {
    let data: IvoryInvitationData
    let palette: InvitationPalette
    let isOpen: Bool
    let reducedMotion: Bool

    var body: some View {
        ZStack {
            BaseStationeryCardView(data: data, palette: palette)
                .offset(y: isOpen ? -30 : 60)
                .scaleEffect(isOpen ? 1.0 : 0.94)
                .animation(reducedMotion ? nil : .easeInOut(duration: 1.1), value: isOpen)

            VStack {
                Spacer()
                RoundedRectangle(cornerRadius: 20)
                    .fill(palette.primary.opacity(0.85))
                    .frame(height: 90)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(palette.accent, lineWidth: 1)
                    )
                    .opacity(isOpen ? 0.15 : 0.95)
                    .animation(reducedMotion ? nil : .easeInOut(duration: 1.1), value: isOpen)
            }
        }
        .accessibilityIdentifier("motion-envelope-letter")
    }
}

private struct BookOpenView: View {
    let data: IvoryInvitationData
    let palette: InvitationPalette
    let isOpen: Bool
    let reducedMotion: Bool

    var body: some View {
        ZStack {
            BaseStationeryCardView(data: data, palette: palette, compact: true)

            // Right cover
            GeometryReader { geo in
                HStack {
                    Spacer()
                    RoundedRectangle(cornerRadius: 20)
                        .fill(palette.paper)
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(palette.primary.opacity(0.45), lineWidth: 1)
                        )
                        .frame(width: geo.size.width / 2)
                        .rotation3DEffect(
                            .degrees(isOpen ? -165 : 0),
                            axis: (x: 0, y: 1, z: 0),
                            anchor: .leading,
                            perspective: 0.5
                        )
                        .animation(reducedMotion ? nil : .easeInOut(duration: 1.1), value: isOpen)
                }
            }
        }
        .accessibilityIdentifier("motion-book-open")
    }
}

private struct SingleCardLiftView: View {
    let data: IvoryInvitationData
    let palette: InvitationPalette
    let isOpen: Bool
    let reducedMotion: Bool

    var body: some View {
        BaseStationeryCardView(data: data, palette: palette)
            .offset(y: isOpen ? 0 : 28)
            .scaleEffect(isOpen ? 1.0 : 0.94)
            .rotation3DEffect(.degrees(isOpen ? 0 : 8), axis: (x: 1, y: 0, z: 0))
            .opacity(isOpen ? 1.0 : 0.78)
            .animation(reducedMotion ? nil : .easeInOut(duration: 1.1), value: isOpen)
            .accessibilityIdentifier("motion-single-card-lift")
    }
}

private struct FloralRevealView: View {
    let data: IvoryInvitationData
    let palette: InvitationPalette
    let isOpen: Bool
    let reducedMotion: Bool

    var body: some View {
        BaseStationeryCardView(data: data, palette: palette)
            .offset(y: isOpen ? 0 : 12)
            .scaleEffect(isOpen ? 1.0 : 0.92)
            .opacity(isOpen ? 1.0 : 0.75)
            .animation(reducedMotion ? nil : .easeInOut(duration: 1.1), value: isOpen)
            .accessibilityIdentifier("motion-floral-reveal")
    }
}

private struct SleevePullView: View {
    let data: IvoryInvitationData
    let palette: InvitationPalette
    let isOpen: Bool
    let reducedMotion: Bool

    var body: some View {
        ZStack {
            BaseStationeryCardView(data: data, palette: palette)
                .offset(y: isOpen ? -15 : 20)
                .animation(reducedMotion ? nil : .easeInOut(duration: 1.1), value: isOpen)

            VStack {
                Spacer()
                RoundedRectangle(cornerRadius: 20)
                    .fill(palette.primary.opacity(0.88))
                    .frame(height: 160)
                    .overlay(RoundedRectangle(cornerRadius: 20).stroke(palette.accent, lineWidth: 1))
                    .offset(y: isOpen ? 130 : 0)
                    .opacity(isOpen ? 0.15 : 0.95)
                    .animation(reducedMotion ? nil : .easeInOut(duration: 1.1), value: isOpen)
            }
        }
        .accessibilityIdentifier("motion-sleeve-pull")
    }
}

// MARK: - Actions Surface

private struct GenericInvitationActionsView: View {
    let rsvp: IvoryRsvpState
    let actions: IvoryActions
    let palette: InvitationPalette

    var body: some View {
        VStack(spacing: 12) {
            // Confirmation status badge
            if let label = rsvp.statusLabel, !label.isEmpty {
                let isDeclined = label.localizedCaseInsensitiveContains("not attending")
                Text(label)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(isDeclined ? palette.ink : palette.primary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(isDeclined ? palette.muted.opacity(0.2) : palette.primary.opacity(0.15))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(isDeclined ? palette.muted.opacity(0.4) : palette.primary.opacity(0.3), lineWidth: 1))
                    .accessibilityIdentifier(isDeclined ? "invitation-status-declined" : "invitation-status-attending")
            }

            // Primary RSVP CTA
            Button(action: { actions.onRsvp?() }) {
                Text(ivoryRsvpActionLabel(rsvp: rsvp))
                    .font(.system(size: 14, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(palette.primary)
                    .foregroundStyle(palette.paper)
                    .clipShape(Capsule())
            }
            .accessibilityIdentifier("invitation-cta-rsvp")

            // Calendar & Venue row
            HStack(spacing: 10) {
                Button(action: { actions.onAddToCalendar?() }) {
                    Text("Calendar")
                        .font(.system(size: 12))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .foregroundStyle(Color.white)
                        .overlay(Capsule().stroke(Color.white.opacity(0.35), lineWidth: 1))
                }
                .accessibilityIdentifier("invitation-cta-calendar")

                Button(action: { actions.onOpenVenue?() }) {
                    Text("Venue")
                        .font(.system(size: 12))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .foregroundStyle(Color.white)
                        .overlay(Capsule().stroke(Color.white.opacity(0.35), lineWidth: 1))
                }
                .accessibilityIdentifier("invitation-cta-venue")
            }

            if let onGifts = actions.onGifts {
                Button(action: onGifts) {
                    Text("Gift Contributions")
                        .font(.system(size: 12))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .foregroundStyle(Color.white)
                        .overlay(Capsule().stroke(Color.white.opacity(0.35), lineWidth: 1))
                }
                .accessibilityIdentifier("invitation-cta-gifts")
            }

            if let onNote = actions.onNote {
                Button(action: onNote) {
                    Text("A note from us")
                        .font(.system(size: 12))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .foregroundStyle(Color.white)
                        .overlay(Capsule().stroke(Color.white.opacity(0.35), lineWidth: 1))
                }
                .accessibilityIdentifier("invitation-cta-note")
            }

            if rsvp.offersPass, let onViewPass = actions.onViewPass {
                Button(action: onViewPass) {
                    Text("View Guest Pass")
                        .font(.system(size: 13, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(palette.accent)
                        .foregroundStyle(palette.paper)
                        .clipShape(Capsule())
                }
                .accessibilityIdentifier("invitation-cta-pass")
            }

            if let onVisitCoupleSite = actions.onVisitCoupleSite {
                Button(action: onVisitCoupleSite) {
                    Text("Visit Couple Website")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.white.opacity(0.75))
                }
                .accessibilityIdentifier("invitation-cta-couple-site")
            }

            if let onContinue = actions.onContinue {
                Button(action: onContinue) {
                    Text("Continue to wedding details")
                        .font(.system(size: 13))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(Color.white.opacity(0.15))
                        .foregroundStyle(Color.white)
                        .clipShape(Capsule())
                }
                .accessibilityIdentifier("invitation-continue-button")
            }
        }
        .frame(maxWidth: 320)
    }
}
