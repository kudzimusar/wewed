import SwiftUI

/// Ivory Floral Gold, natively.
///
/// This is a port of the approved web invitation
/// (`src/components/wedding/invitation-experience/ivory-floral-gold-trifold.tsx`), not a design
/// inspired by it. The artwork is the shipped artwork, converted losslessly; the geometry, the
/// four states and the door keyframes are transcribed from the approved CSS.
///
/// What this replaces is the mistake: a `GuestCeremonialCardView` was invented — monogram, names,
/// status, countdown, buttons — and used as the guest's entrance. An invitation is a
/// wedding-configured product object that Wewed already designed, approved and shipped.
/// Substituting an app-specific summary card for it is not parity, however carefully it matches
/// the palette.
///
/// ```
/// CLOSED ──tap──▶ OPENING ──1800ms──▶ OPEN ──▶ DETAILS
/// ```
///
/// Geometry is expressed as percentages of the 1080×2340 canvas, exactly as the web `Region`
/// boxes are, so the two stay aligned when either changes. The Android counterpart uses the same
/// constants.
public enum IvoryGeometry {
    /// From `.ivory-stage { aspect-ratio: 9/19.5 }`.
    public static let aspect: CGFloat = 9.0 / 19.5
    /// `.ivory-stage { max-width: 430px }` — the card keeps a card's size, even on an iPad.
    public static let maxStageWidth: CGFloat = 430
    /// `perspective: 1900px` on `.ivory-object`.
    public static let perspective: CGFloat = 1900
    /// The approved opening duration.
    public static let openingSeconds: Double = 1.8

    // Region boxes: [left%, top%, width%, height%] over the open surface.
    public static let names: [CGFloat] = [27, 20, 46, 19]
    public static let message: [CGFloat] = [24, 43, 52, 12]
    public static let date: [CGFloat] = [24, 57, 52, 8]
    public static let location: [CGFloat] = [23, 68, 54, 8]
    public static let tagline: [CGFloat] = [28, 79, 44, 4.2]
    public static let guest: [CGFloat] = [22, 83.3, 56, 4.2]
    public static let monogram: [CGFloat] = [38, 39, 24, 6]

    public static let detailCouple: [CGFloat] = [25, 2, 55, 3]
    public static let detailNoteIntro: [CGFloat] = [28, 26, 46, 5]
    public static let detailVenue: [CGFloat] = [35, 56, 44, 5]
    public static let detailNote: [CGFloat] = [36, 76, 44, 4]

    /// `cubic-bezier(0.3, 0.1, 0.2, 1)` from the door animations.
    public static let doorEasing: [Double] = [0.3, 0.1, 0.2, 1]

    /// Interactive regions on the details surface: left 11%, width 78%, per the web `hit()`.
    public static let hitLeft: CGFloat = 11
    public static let hitWidth: CGFloat = 78
    public static let hitRsvp: [CGFloat] = [35, 7.2]
    public static let hitCalendar: [CGFloat] = [44.2, 7.3]
    public static let hitVenue: [CGFloat] = [53.2, 8.4]
    public static let hitRegistry: [CGFloat] = [63.4, 7.3]
    public static let hitNote: [CGFloat] = [72.4, 8]
}

/// Everything the invitation renders. Resolved from the wedding graph, never hard-coded.
public struct IvoryInvitationData: Equatable {
    public let coupleNames: String
    public let monogram: String
    public let message: String
    public let weekdayLabel: String?
    public let dayLabel: String?
    public let monthLabel: String?
    public let yearLabel: String?
    public let venue: String
    public let venueAddress: String?
    public let venueCityCountry: String
    public let tagline: String?
    /// The invited guest. This is what makes it *their* invitation.
    public let guestName: String?
    public let rsvpDeadlineLabel: String?

    public init(coupleNames: String, monogram: String, message: String, weekdayLabel: String?,
                dayLabel: String?, monthLabel: String?, yearLabel: String?, venue: String,
                venueAddress: String?, venueCityCountry: String, tagline: String?,
                guestName: String?, rsvpDeadlineLabel: String?) {
        self.coupleNames = coupleNames
        self.monogram = monogram
        self.message = message
        self.weekdayLabel = weekdayLabel
        self.dayLabel = dayLabel
        self.monthLabel = monthLabel
        self.yearLabel = yearLabel
        self.venue = venue
        self.venueAddress = venueAddress
        self.venueCityCountry = venueCityCountry
        self.tagline = tagline
        self.guestName = guestName
        self.rsvpDeadlineLabel = rsvpDeadlineLabel
    }
}

/// What the details surface offers. Availability is data-driven, never assumed.
public struct IvoryActions {
    public let onRsvp: (() -> Void)?
    public let onAddToCalendar: (() -> Void)?
    public let onOpenVenue: (() -> Void)?
    /// Only present when the wedding actually has a configured gift destination.
    public let onGifts: (() -> Void)?
    public let onNote: (() -> Void)?
    public let onViewPass: (() -> Void)?
    /// The couple's public wedding site. Present for every guest; it is not private.
    public let onVisitCoupleSite: (() -> Void)?
    public let onContinue: (() -> Void)?

    public init(onRsvp: (() -> Void)? = nil, onAddToCalendar: (() -> Void)? = nil,
                onOpenVenue: (() -> Void)? = nil, onGifts: (() -> Void)? = nil,
                onNote: (() -> Void)? = nil, onViewPass: (() -> Void)? = nil,
                onVisitCoupleSite: (() -> Void)? = nil,
                onContinue: (() -> Void)? = nil) {
        self.onRsvp = onRsvp
        self.onAddToCalendar = onAddToCalendar
        self.onOpenVenue = onOpenVenue
        self.onGifts = onGifts
        self.onNote = onNote
        self.onViewPass = onViewPass
        self.onVisitCoupleSite = onVisitCoupleSite
        self.onContinue = onContinue
    }
}

/// A line the invitation shows instead of RSVP once the guest has already answered.
/// What the guest has already said. Three states, because "not attending" is not "not answered".
public enum IvoryRsvpAnswer: Sendable { case awaiting, attending, declined }

public struct IvoryRsvpState: Equatable {
    public let answer: IvoryRsvpAnswer
    public let statusLabel: String?
    public let offersPass: Bool

    /// An answered guest is never asked again, whichever way they answered.
    public var awaitsResponse: Bool { answer == .awaiting }

    public init(answer: IvoryRsvpAnswer, statusLabel: String?, offersPass: Bool) {
        self.answer = answer
        self.statusLabel = statusLabel
        self.offersPass = offersPass
    }
}

/// Label for the details surface RSVP action: "RSVP" while awaiting response, "Update RSVP" once answered.
public func ivoryRsvpActionLabel(rsvp: IvoryRsvpState) -> String {
    rsvp.awaitsResponse ? "RSVP" : "Update RSVP"
}

/// Ink and gold sampled from the approved stationery.
/// The stationery's own colours, taken from `ivory-floral-gold.css` rather than chosen.
///
/// The whole open face inherits one warm gold-brown from `.ivory-stage { color: #70501f }`. Using a
/// darker "ink" instead is subtle enough to survive review and still be the wrong invitation.
public enum IvoryPalette {
    /// The surface the card sits on.
    public static let stage = Color(red: 0x15 / 255, green: 0x10 / 255, blue: 0x0B / 255)
    /// `.ivory-stage { color: #70501f }` — inherited by every region on the open face.
    public static let ink = Color(red: 0x70 / 255, green: 0x50 / 255, blue: 0x1F / 255)
    /// `.ivory-detail-venue, .ivory-detail-note { color: #322b22 }` on the details surface.
    public static let inkSoft = Color(red: 0x32 / 255, green: 0x2B / 255, blue: 0x22 / 255)
    /// The footer actions on the details surface, `#76501d`.
    public static let gold = Color(red: 0x76 / 255, green: 0x50 / 255, blue: 0x1D / 255)
}

/// The invitation.
///
/// - Parameter reducedMotion: when true the doors do not animate; the guest still meets the closed
///   stationery and still opens it, because the object and its ceremony are the product — only the
///   motion is reduced.
public struct IvoryFloralGoldNative: View {
    private let data: IvoryInvitationData
    private let rsvp: IvoryRsvpState
    private let actions: IvoryActions
    private let reducedMotion: Bool
    private let onStateChanged: (InvitationPresentationState) -> Void

    @State private var view: InvitationPresentationState = .closed
    @State private var doorProgress: Double = 0
    @State private var centreSettle: Double = 0

    public init(
        data: IvoryInvitationData,
        rsvp: IvoryRsvpState,
        actions: IvoryActions,
        reducedMotion: Bool = false,
        initialState: InvitationPresentationState = .closed,
        onStateChanged: @escaping (InvitationPresentationState) -> Void = { _ in }
    ) {
        self.data = data
        self.rsvp = rsvp
        self.actions = actions
        self.reducedMotion = reducedMotion
        self.onStateChanged = onStateChanged
        _view = State(initialValue: initialState)
        _centreSettle = State(initialValue: initialState == .closed ? 0 : 1)
    }

    public var body: some View {
        GeometryReader { proxy in
            // The stationery keeps its authored aspect and is centred, the way a physical card
            // sits on a surface. It is never stretched to the viewport.
            let stageWidth = min(proxy.size.width,
                                 proxy.size.height * IvoryGeometry.aspect,
                                 IvoryGeometry.maxStageWidth)
            let stageHeight = stageWidth / IvoryGeometry.aspect

            ZStack {
                IvoryPalette.stage.ignoresSafeArea()

                // The stage marks itself with a leaf element rather than an identifier on the
                // container. `.accessibilityIdentifier` is inherited in SwiftUI: on the container
                // it overwrote every descendant's identifier, so the doors, the seal and the
                // couple's own names all reported as `ivory-card-stage` and none could be asserted.
                AccessibilityMarker("invitation-trifold", label: "Your invitation")

                ZStack {
                    if view != .details { openFace(stageWidth, stageHeight) }
                    if view == .details { detailsFace(stageWidth, stageHeight) }
                    if view == .closed || view == .opening { doors(stageWidth, stageHeight) }
                    if view == .opening {
                        AccessibilityMarker("invitation-opening", label: "Your invitation, opening")
                    }
                }
                .frame(width: stageWidth, height: stageHeight)
                .clipped()
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .onChange(of: view) { _, next in onStateChanged(next) }
    }

    // MARK: - The invitation face, beneath the doors

    @ViewBuilder
    private func openFace(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            WewedMediaImage("ivory-open-surface")
                .aspectRatio(contentMode: .fill)
                .frame(width: w, height: h)
                .clipped()

            region(IvoryGeometry.names, w, h) {
                Text(data.coupleNames)
                    // `.ivory-names { font-family: IvoryScript }`.
                    .font(IvoryTypography.script(size: w * 0.112))
                    .foregroundStyle(IvoryPalette.ink)
                    .multilineTextAlignment(.center)
            }
            .accessibilityIdentifier("invitation-couple-names")

            region(IvoryGeometry.message, w, h) {
                // `.ivory-message { text-transform: uppercase; letter-spacing: .13em }`
                Text(data.message.uppercased())
                    .font(IvoryTypography.body(size: w * 0.030))
                    .tracking(w * 0.030 * 0.13)
                    .lineSpacing(w * 0.030 * 0.7)
                    .foregroundStyle(IvoryPalette.ink)
                    .multilineTextAlignment(.center)
            }

            region(IvoryGeometry.date, w, h) {
                VStack(spacing: 2) {
                    if let weekday = data.weekdayLabel {
                        Text(weekday.uppercased())
                            .font(IvoryTypography.body(size: w * 0.026))
                            .tracking(w * 0.006)
                            .foregroundStyle(IvoryPalette.gold)
                    }
                    // `.ivory-date-parts { justify-content: space-between; width: 100% }`
                    HStack {
                        if let month = data.monthLabel {
                            Text(month.uppercased())
                                .font(IvoryTypography.body(size: w * 0.030))
                                .foregroundStyle(IvoryPalette.ink)
                        }
                        Spacer(minLength: 0)
                        if let day = data.dayLabel {
                            Text(day)
                                .font(IvoryTypography.body(size: w * 0.050, weight: .semibold))
                                .foregroundStyle(IvoryPalette.ink)
                        }
                        Spacer(minLength: 0)
                        if let year = data.yearLabel {
                            Text(year)
                                .font(IvoryTypography.body(size: w * 0.030))
                                .foregroundStyle(IvoryPalette.ink)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .accessibilityIdentifier("invitation-date")

            region(IvoryGeometry.location, w, h) {
                VStack(spacing: 1) {
                    // `.ivory-location strong { text-transform: uppercase; font-size: 3.8cqw }`
                    Text(data.venue.uppercased())
                        .font(IvoryTypography.body(size: w * 0.038))
                        .foregroundStyle(IvoryPalette.ink)
                    if let address = data.venueAddress {
                        Text(address)
                            .font(IvoryTypography.body(size: w * 0.030))
                            .foregroundStyle(IvoryPalette.ink)
                    }
                    Text(data.venueCityCountry)
                        .font(IvoryTypography.body(size: w * 0.030))
                        .foregroundStyle(IvoryPalette.ink)
                }
                .multilineTextAlignment(.center)
            }
            .accessibilityIdentifier("invitation-venue")

            if let tagline = data.tagline, !tagline.isEmpty {
                region(IvoryGeometry.tagline, w, h) {
                    Text(tagline)
                        // `.ivory-tagline { font-family: IvoryScript }`.
                        .font(IvoryTypography.script(size: w * 0.050))
                        .foregroundStyle(IvoryPalette.gold)
                }
            }

            // The personalisation. Without it this is a template, not an invitation.
            region(IvoryGeometry.guest, w, h) {
                // `.ivory-guest { gap: .25cqw; font-size: 2.2cqw; line-height: 1.4 }`
                VStack(spacing: w * 0.0025) {
                    if let guest = data.guestName, !guest.isEmpty {
                        Text("Especially for \(guest)")
                            .font(IvoryTypography.body(size: w * 0.022))
                            .foregroundStyle(IvoryPalette.ink)
                    }
                    if let deadline = data.rsvpDeadlineLabel {
                        Text("RSVP by \(deadline)")
                            .font(IvoryTypography.body(size: w * 0.022))
                            .foregroundStyle(IvoryPalette.ink)
                    }
                }
                .multilineTextAlignment(.center)
            }
            .accessibilityIdentifier("invitation-guest-personalization")

            if view == .open {
                VStack {
                    Spacer()
                    Button { view = .details } label: {
                        Text(rsvp.statusLabel ?? "Wedding details ↓")
                            .font(IvoryTypography.body(size: w * 0.030))
                            .foregroundStyle(IvoryPalette.gold)
                            .frame(maxWidth: .infinity, minHeight: h * 0.075)
                    }
                    .accessibilityIdentifier("invitation-details-button")

                    // The status is marked beside the control, not inside it: a nested identifier
                    // would replace the button's own and the control would stop being findable.
                    AccessibilityMarker(
                        Self.statusIdentifier(rsvp.answer),
                        label: rsvp.statusLabel ?? "Wedding details"
                    )
                }
                .frame(width: w, height: h)
            }
        }
        .frame(width: w, height: h)
        // `ivory-settle`: 0.94 -> 1.
        .scaleEffect(0.94 + 0.06 * centreSettle)
        .overlay(AccessibilityMarker("invitation-panel-centre", label: "Your invitation, open"))
    }

    // MARK: - The details surface

    @ViewBuilder
    private func detailsFace(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            WewedMediaImage("ivory-details-surface")
                .aspectRatio(contentMode: .fill)
                .frame(width: w, height: h)
                .clipped()

            AccessibilityMarker("invitation-details", label: "Invitation details")

            region(IvoryGeometry.detailCouple, w, h) {
                Text(data.coupleNames)
                    .font(IvoryTypography.body(size: w * 0.030))
                    .foregroundStyle(IvoryPalette.ink)
            }
            // The artwork's own sample copy is erased in these regions; leaving them empty showed
            // the erasure as a smudge where the couple's words belong.
            if let tagline = data.tagline, !tagline.isEmpty {
                region(IvoryGeometry.detailNoteIntro, w, h) {
                    Text(tagline)
                        .font(IvoryTypography.script(size: w * 0.052))
                        .foregroundStyle(IvoryPalette.gold)
                        .multilineTextAlignment(.center)
                }
            }
            region(IvoryGeometry.detailVenue, w, h) {
                VStack(spacing: 1) {
                    Text(data.venue).font(IvoryTypography.body(size: w * 0.024))
                        .foregroundStyle(IvoryPalette.ink)
                    if let address = data.venueAddress, !address.isEmpty {
                        Text(address).font(IvoryTypography.body(size: w * 0.022))
                            .foregroundStyle(IvoryPalette.inkSoft)
                    }
                    Text(data.venueCityCountry).font(IvoryTypography.body(size: w * 0.022))
                        .foregroundStyle(IvoryPalette.inkSoft)
                }
                .multilineTextAlignment(.center)
            }
            region(IvoryGeometry.detailNote, w, h) {
                Text("A special message from us")
                    .font(IvoryTypography.body(size: w * 0.024))
                    .foregroundStyle(IvoryPalette.inkSoft)
                    .multilineTextAlignment(.center)
            }

            // The details hits, at the approved coordinates. RSVP remains reachable
            // across pending, accepted, and declined states so guests can update choices.
            hit(IvoryGeometry.hitRsvp, w, h, ivoryRsvpActionLabel(rsvp: rsvp), "invitation-cta-rsvp",
                actions.onRsvp)
            hit(IvoryGeometry.hitCalendar, w, h, "Add to Calendar", "invitation-cta-calendar",
                actions.onAddToCalendar)
            hit(IvoryGeometry.hitVenue, w, h, "Venue Location", "invitation-cta-venue",
                actions.onOpenVenue)
            hit(IvoryGeometry.hitRegistry, w, h, "Gift / Contributions",
                "invitation-cta-registry", actions.onGifts)
            hit(IvoryGeometry.hitNote, w, h, "A Note from Us", "invitation-cta-note", actions.onNote)

            VStack {
                Spacer()
                HStack(spacing: 20) {
                    Button("View invitation") { view = .open }
                        .font(IvoryTypography.body(size: w * 0.026))
                        .foregroundStyle(IvoryPalette.gold)
                        .accessibilityIdentifier("invitation-back-to-invitation")
                    if rsvp.offersPass, let onViewPass = actions.onViewPass {
                        Button("Guest Pass", action: onViewPass)
                            .font(IvoryTypography.body(size: w * 0.026))
                            .foregroundStyle(IvoryPalette.gold)
                            .accessibilityIdentifier("invitation-cta-pass")
                    }
                    if let onVisitCoupleSite = actions.onVisitCoupleSite {
                        Button("Visit Couple Website", action: onVisitCoupleSite)
                            .font(IvoryTypography.body(size: w * 0.026))
                            .foregroundStyle(IvoryPalette.gold)
                            .accessibilityIdentifier("invitation-cta-couple-site")
                    }
                    if let onContinue = actions.onContinue {
                        Button("Continue", action: onContinue)
                            .font(IvoryTypography.body(size: w * 0.026))
                            .foregroundStyle(IvoryPalette.inkSoft)
                            .accessibilityIdentifier("invitation-continue")
                    }
                }
                .padding(.bottom, h * 0.02)
            }
            .frame(width: w, height: h)
        }
        .frame(width: w, height: h)
        .overlay(AccessibilityMarker("invitation-interactive-details", label: "Wedding details"))
    }

    // MARK: - The doors

    @ViewBuilder
    private func doors(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            HStack(spacing: 0) {
                door("ivory-left-door", isLeft: true, w: w / 2, h: h)
                    .accessibilityIdentifier("invitation-panel-left")
                door("ivory-right-door", isLeft: false, w: w / 2, h: h)
                    .accessibilityIdentifier("invitation-panel-right")
            }

            // The seal sits over the closed doors, and inks out as they part.
            region(IvoryGeometry.monogram, w, h) {
                Text(data.monogram.replacingOccurrences(of: "·", with: " ")
                        .replacingOccurrences(of: "|", with: " "))
                    .font(IvoryTypography.body(size: w * 0.055))
                    .foregroundStyle(IvoryPalette.ink)
                    .opacity(max(0, min(1, 1 - doorProgress * 6)))
            }
            .accessibilityIdentifier("invitation-monogram")

            if view == .closed {
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture { openDoors() }
                    .accessibilityLabel("A special invitation awaits. Tap to open.")
                    .accessibilityAddTraits(.isButton)
                    .accessibilityIdentifier("invitation-open-button")
            }

            // A marker rather than an identifier on the group: SwiftUI publishes a container's
            // identifier only when the container is itself an accessibility element, and making it
            // one would swallow the doors and the seal — the very things worth asserting. The
            // marker carries the closed card's own description, so it is a real element rather
            // than an empty focus stop.
            AccessibilityMarker("invitation-closed-cover", label: "Your invitation, still closed")
        }
        .frame(width: w, height: h)
    }

    /// One hinged door.
    ///
    /// The keyframes are the approved ones: a small lift away from the centre, a mid-swing at 44°,
    /// and a finish translated fully clear at 82°. The anchor puts the hinge on the outer edge and
    /// `perspective` supplies what the web gets from `perspective: 1900px`.
    /// The approved keyframes at 0 / 12% / 60% / 100%, as a pure function so the view builder
    /// stays a view builder.
    /// The status line carries its own identity so a confirmed guest and a declined guest are
    /// distinguishable in tests — they are different outcomes, not one "answered" state.
    private static func statusIdentifier(_ answer: IvoryRsvpAnswer) -> String {
        switch answer {
        case .attending: return "invitation-rsvp-confirmed"
        case .declined: return "invitation-response-recorded"
        case .awaiting: return "invitation-details-cue"
        }
    }

    private func doorTransform(isLeft: Bool) -> (rotation: Double, translate: Double) {
        let sign: Double = isLeft ? -1 : 1
        if doorProgress < 0.12 {
            let t = doorProgress / 0.12
            return (sign * 2 * t, 0)
        }
        if doorProgress < 0.60 {
            let t = (doorProgress - 0.12) / 0.48
            return (sign * (2 + 42 * t), sign * 0.24 * t)
        }
        let t = (doorProgress - 0.60) / 0.40
        return (sign * (44 + 38 * t), sign * (0.24 + 0.88 * t))
    }

    @ViewBuilder
    private func door(_ asset: String, isLeft: Bool, w: CGFloat, h: CGFloat) -> some View {
        let transform = doorTransform(isLeft: isLeft)
        WewedMediaImage(asset)
            .aspectRatio(contentMode: .fill)
            .frame(width: w, height: h)
            .clipped()
            .rotation3DEffect(
                .degrees(transform.rotation),
                axis: (x: 0, y: 1, z: 0),
                anchor: isLeft ? .leading : .trailing,
                perspective: 1 / IvoryGeometry.perspective * w
            )
            .offset(x: transform.translate * w)
    }

    // MARK: - Layout helpers

    /// Positions a child over the artwork using the approved percentage box, exactly as the web
    /// `Region` does, so the two implementations stay comparable line by line.
    @ViewBuilder
    private func region<Content: View>(
        _ box: [CGFloat], _ w: CGFloat, _ h: CGFloat, @ViewBuilder content: () -> Content
    ) -> some View {
        content()
            .frame(width: w * box[2] / 100, height: h * box[3] / 100)
            .position(
                x: w * (box[0] + box[2] / 2) / 100,
                y: h * (box[1] + box[3] / 2) / 100
            )
    }

    /// A tappable region over the details artwork, matching the web hit boxes.
    @ViewBuilder
    private func hit(
        _ box: [CGFloat], _ w: CGFloat, _ h: CGFloat,
        _ label: String, _ identifier: String, _ action: (() -> Void)?
    ) -> some View {
        if let action {
            Color.clear
                .contentShape(Rectangle())
                .frame(width: w * IvoryGeometry.hitWidth / 100, height: h * box[1] / 100)
                .position(
                    x: w * (IvoryGeometry.hitLeft + IvoryGeometry.hitWidth / 2) / 100,
                    y: h * (box[0] + box[1] / 2) / 100
                )
                .onTapGesture(perform: action)
                .accessibilityLabel(label)
                .accessibilityAddTraits(.isButton)
                .accessibilityIdentifier(identifier)
        }
    }

    private func openDoors() {
        if reducedMotion {
            doorProgress = 1
            centreSettle = 1
            view = .open
            return
        }
        view = .opening
        withAnimation(.timingCurve(IvoryGeometry.doorEasing[0], IvoryGeometry.doorEasing[1],
                                   IvoryGeometry.doorEasing[2], IvoryGeometry.doorEasing[3],
                                   duration: IvoryGeometry.openingSeconds)) {
            doorProgress = 1
        }
        withAnimation(.easeInOut(duration: IvoryGeometry.openingSeconds)) {
            centreSettle = 1
        }
        Task {
            try? await Task.sleep(nanoseconds: UInt64(IvoryGeometry.openingSeconds * 1_000_000_000))
            view = .open
        }
    }
}

