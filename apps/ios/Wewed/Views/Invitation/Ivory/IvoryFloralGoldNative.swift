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
    public let onContinue: (() -> Void)?

    public init(onRsvp: (() -> Void)? = nil, onAddToCalendar: (() -> Void)? = nil,
                onOpenVenue: (() -> Void)? = nil, onGifts: (() -> Void)? = nil,
                onNote: (() -> Void)? = nil, onViewPass: (() -> Void)? = nil,
                onContinue: (() -> Void)? = nil) {
        self.onRsvp = onRsvp
        self.onAddToCalendar = onAddToCalendar
        self.onOpenVenue = onOpenVenue
        self.onGifts = onGifts
        self.onNote = onNote
        self.onViewPass = onViewPass
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

/// Ink and gold sampled from the approved stationery.
public enum IvoryPalette {
    public static let stage = Color(red: 0x15 / 255, green: 0x10 / 255, blue: 0x0B / 255)
    public static let ink = Color(red: 0x4A / 255, green: 0x3B / 255, blue: 0x27 / 255)
    public static let inkSoft = Color(red: 0x6B / 255, green: 0x5A / 255, blue: 0x44 / 255)
    public static let gold = Color(red: 0x9C / 255, green: 0x7A / 255, blue: 0x3C / 255)
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
                IvoryMarker("ivory-card-stage", label: "Your invitation")

                ZStack {
                    if view != .details { openFace(stageWidth, stageHeight) }
                    if view == .details { detailsFace(stageWidth, stageHeight) }
                    if view == .closed || view == .opening { doors(stageWidth, stageHeight) }
                    if view == .opening {
                        IvoryMarker("ivory-card-opening", label: "Your invitation, opening")
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
                    .font(.system(size: w * 0.072, design: .serif))
                    .foregroundStyle(IvoryPalette.ink)
                    .multilineTextAlignment(.center)
            }
            .accessibilityIdentifier("ivory-card-couple-names")

            region(IvoryGeometry.message, w, h) {
                Text(data.message)
                    .font(.system(size: w * 0.030, design: .serif))
                    .foregroundStyle(IvoryPalette.inkSoft)
                    .multilineTextAlignment(.center)
            }

            region(IvoryGeometry.date, w, h) {
                VStack(spacing: 2) {
                    if let weekday = data.weekdayLabel {
                        Text(weekday.uppercased())
                            .font(.system(size: w * 0.026))
                            .tracking(w * 0.006)
                            .foregroundStyle(IvoryPalette.gold)
                    }
                    HStack(spacing: w * 0.02) {
                        if let month = data.monthLabel {
                            Text(month.uppercased())
                                .font(.system(size: w * 0.030, design: .serif))
                                .foregroundStyle(IvoryPalette.ink)
                        }
                        if let day = data.dayLabel {
                            Text(day)
                                .font(.system(size: w * 0.050, weight: .semibold, design: .serif))
                                .foregroundStyle(IvoryPalette.ink)
                        }
                        if let year = data.yearLabel {
                            Text(year)
                                .font(.system(size: w * 0.030, design: .serif))
                                .foregroundStyle(IvoryPalette.ink)
                        }
                    }
                }
            }
            .accessibilityIdentifier("ivory-card-date")

            region(IvoryGeometry.location, w, h) {
                VStack(spacing: 1) {
                    Text(data.venue)
                        .font(.system(size: w * 0.030, weight: .medium, design: .serif))
                        .foregroundStyle(IvoryPalette.ink)
                    if let address = data.venueAddress {
                        Text(address)
                            .font(.system(size: w * 0.024))
                            .foregroundStyle(IvoryPalette.inkSoft)
                    }
                    Text(data.venueCityCountry)
                        .font(.system(size: w * 0.024))
                        .foregroundStyle(IvoryPalette.inkSoft)
                }
                .multilineTextAlignment(.center)
            }
            .accessibilityIdentifier("ivory-card-venue")

            if let tagline = data.tagline, !tagline.isEmpty {
                region(IvoryGeometry.tagline, w, h) {
                    Text(tagline)
                        .font(.system(size: w * 0.026, design: .serif))
                        .foregroundStyle(IvoryPalette.gold)
                }
            }

            // The personalisation. Without it this is a template, not an invitation.
            region(IvoryGeometry.guest, w, h) {
                VStack(spacing: 1) {
                    if let guest = data.guestName, !guest.isEmpty {
                        Text("Especially for \(guest)")
                            .font(.system(size: w * 0.026, design: .serif))
                            .foregroundStyle(IvoryPalette.ink)
                    }
                    if let deadline = data.rsvpDeadlineLabel {
                        Text("RSVP by \(deadline)")
                            .font(.system(size: w * 0.022))
                            .foregroundStyle(IvoryPalette.inkSoft)
                    }
                }
                .multilineTextAlignment(.center)
            }
            .accessibilityIdentifier("ivory-card-guest-personalization")

            if view == .open {
                VStack {
                    Spacer()
                    Button { view = .details } label: {
                        Text(rsvp.statusLabel ?? "Wedding details ↓")
                            .font(.system(size: w * 0.030, design: .serif))
                            .foregroundStyle(IvoryPalette.gold)
                            .frame(maxWidth: .infinity, minHeight: h * 0.075)
                    }
                    .accessibilityIdentifier("ivory-card-details-button")

                    // The status is marked beside the control, not inside it: a nested identifier
                    // would replace the button's own and the control would stop being findable.
                    IvoryMarker(
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
        .overlay(IvoryMarker("ivory-card-open", label: "Your invitation, open"))
    }

    // MARK: - The details surface

    @ViewBuilder
    private func detailsFace(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            WewedMediaImage("ivory-details-surface")
                .aspectRatio(contentMode: .fill)
                .frame(width: w, height: h)
                .clipped()

            region(IvoryGeometry.detailCouple, w, h) {
                Text(data.coupleNames)
                    .font(.system(size: w * 0.030, design: .serif))
                    .foregroundStyle(IvoryPalette.ink)
            }
            // The artwork's own sample copy is erased in these regions; leaving them empty showed
            // the erasure as a smudge where the couple's words belong.
            if let tagline = data.tagline, !tagline.isEmpty {
                region(IvoryGeometry.detailNoteIntro, w, h) {
                    Text(tagline)
                        .font(.system(size: w * 0.042, design: .serif))
                        .italic()
                        .foregroundStyle(IvoryPalette.gold)
                        .multilineTextAlignment(.center)
                }
            }
            region(IvoryGeometry.detailVenue, w, h) {
                VStack(spacing: 1) {
                    Text(data.venue).font(.system(size: w * 0.024))
                        .foregroundStyle(IvoryPalette.ink)
                    if let address = data.venueAddress, !address.isEmpty {
                        Text(address).font(.system(size: w * 0.022))
                            .foregroundStyle(IvoryPalette.inkSoft)
                    }
                    Text(data.venueCityCountry).font(.system(size: w * 0.022))
                        .foregroundStyle(IvoryPalette.inkSoft)
                }
                .multilineTextAlignment(.center)
            }
            region(IvoryGeometry.detailNote, w, h) {
                Text("A special message from us")
                    .font(.system(size: w * 0.024))
                    .foregroundStyle(IvoryPalette.inkSoft)
                    .multilineTextAlignment(.center)
            }

            // A guest who has already answered is never offered RSVP again; gifts appear only
            // when the wedding has a configured destination.
            hit(IvoryGeometry.hitRsvp, w, h, "RSVP", "ivory-card-rsvp",
                rsvp.awaitsResponse ? actions.onRsvp : nil)
            hit(IvoryGeometry.hitCalendar, w, h, "Add to Calendar", "ivory-card-calendar",
                actions.onAddToCalendar)
            hit(IvoryGeometry.hitVenue, w, h, "Venue Location", "ivory-card-venue-action",
                actions.onOpenVenue)
            hit(IvoryGeometry.hitRegistry, w, h, "Gift / Contributions",
                "ivory-card-contributions", actions.onGifts)
            hit(IvoryGeometry.hitNote, w, h, "A Note from Us", "ivory-card-note", actions.onNote)

            VStack {
                Spacer()
                HStack(spacing: 20) {
                    Button("View invitation") { view = .open }
                        .font(.system(size: w * 0.026))
                        .foregroundStyle(IvoryPalette.gold)
                        .accessibilityIdentifier("ivory-card-view-invitation")
                    if rsvp.offersPass, let onViewPass = actions.onViewPass {
                        Button("Guest Pass", action: onViewPass)
                            .font(.system(size: w * 0.026))
                            .foregroundStyle(IvoryPalette.gold)
                            .accessibilityIdentifier("ivory-card-view-pass")
                    }
                    if let onContinue = actions.onContinue {
                        Button("Continue", action: onContinue)
                            .font(.system(size: w * 0.026))
                            .foregroundStyle(IvoryPalette.inkSoft)
                            .accessibilityIdentifier("ivory-card-continue")
                    }
                }
                .padding(.bottom, h * 0.02)
            }
            .frame(width: w, height: h)
        }
        .frame(width: w, height: h)
        .overlay(IvoryMarker("ivory-card-details", label: "Wedding details"))
    }

    // MARK: - The doors

    @ViewBuilder
    private func doors(_ w: CGFloat, _ h: CGFloat) -> some View {
        ZStack {
            HStack(spacing: 0) {
                door("ivory-left-door", isLeft: true, w: w / 2, h: h)
                    .accessibilityIdentifier("ivory-card-left-door")
                door("ivory-right-door", isLeft: false, w: w / 2, h: h)
                    .accessibilityIdentifier("ivory-card-right-door")
            }

            // The seal sits over the closed doors, and inks out as they part.
            region(IvoryGeometry.monogram, w, h) {
                Text(data.monogram.replacingOccurrences(of: "·", with: " ")
                        .replacingOccurrences(of: "|", with: " "))
                    .font(.system(size: w * 0.055, design: .serif))
                    .foregroundStyle(IvoryPalette.ink)
                    .opacity(max(0, min(1, 1 - doorProgress * 6)))
            }
            .accessibilityIdentifier("ivory-card-monogram")

            if view == .closed {
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture { openDoors() }
                    .accessibilityLabel("A special invitation awaits. Tap to open.")
                    .accessibilityAddTraits(.isButton)
                    .accessibilityIdentifier("ivory-card-open-button")
            }

            // A marker rather than an identifier on the group: SwiftUI publishes a container's
            // identifier only when the container is itself an accessibility element, and making it
            // one would swallow the doors and the seal — the very things worth asserting. The
            // marker carries the closed card's own description, so it is a real element rather
            // than an empty focus stop.
            IvoryMarker("ivory-card-closed", label: "Your invitation, still closed")
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
        case .attending: return "ivory-card-rsvp-confirmed"
        case .declined: return "ivory-card-response-recorded"
        case .awaiting: return "ivory-card-details-cue"
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

/// A one-point leaf element carrying a state identifier.
///
/// SwiftUI inherits `.accessibilityIdentifier` down the tree, so putting a state's identifier on
/// its container renames every descendant and makes the card unassertable. A leaf marker names the
/// state without touching anything inside it.
private struct IvoryMarker: View {
    private let identifier: String
    private let label: String

    init(_ identifier: String, label: String) {
        self.identifier = identifier
        self.label = label
    }

    var body: some View {
        Color.clear
            .frame(width: 1, height: 1)
            .allowsHitTesting(false)
            .accessibilityElement()
            .accessibilityLabel(label)
            .accessibilityIdentifier(identifier)
    }
}
