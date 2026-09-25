import SwiftUI
#if canImport(UIKit)
import UIKit
#endif


/// Presentation-only width rules for the three NM04 iPhone viewport closures.
///
/// These helpers deliberately know nothing about Guest identity, RSVP authority, Ivory state or
/// Wedding Pass authority. They turn a physical SwiftUI proposal into concrete child widths so
/// intrinsic content can never enlarge the RSVP/note surfaces beyond the phone.
enum GuestViewportGeometry {
    static let rsvpOuterInset: CGFloat = 8
    static let rsvpInternalPadding: CGFloat = 20
    static let rsvpAttendanceSpacing: CGFloat = 8

    static let noteOuterInset: CGFloat = 16
    static let noteInternalPadding: CGFloat = 20
    static let noteMaximumWidth: CGFloat = 420

    static let countdownInterTileSpacing: CGFloat = 6
    static let countdownTileCount: CGFloat = 4

    static func rsvpSheetWidth(viewportWidth: CGFloat) -> CGFloat {
        max(0, viewportWidth - (rsvpOuterInset * 2))
    }

    static func rsvpContentWidth(viewportWidth: CGFloat) -> CGFloat {
        max(0, rsvpSheetWidth(viewportWidth: viewportWidth) - (rsvpInternalPadding * 2))
    }

    static func rsvpAttendanceChoiceWidth(viewportWidth: CGFloat) -> CGFloat {
        max(
            0,
            (rsvpContentWidth(viewportWidth: viewportWidth) - rsvpAttendanceSpacing) / 2
        )
    }

    static func noteSurfaceWidth(viewportWidth: CGFloat) -> CGFloat {
        min(
            max(0, viewportWidth - (noteOuterInset * 2)),
            noteMaximumWidth
        )
    }

    static func noteTextWidth(viewportWidth: CGFloat) -> CGFloat {
        max(0, noteSurfaceWidth(viewportWidth: viewportWidth) - (noteInternalPadding * 2))
    }

    static func countdownTileWidth(rowWidth: CGFloat) -> CGFloat {
        let totalSpacing = countdownInterTileSpacing * (countdownTileCount - 1)
        return max(0, (rowWidth - totalSpacing) / countdownTileCount)
    }
}

/// The guest's invitation, rendered from the live guest session.
///
/// The distinction from `GuestInvitationJourneyView` is where the data and the RSVP write come
/// from: this one talks to the wedding's own authority through ``LiveGuestInvitationCoordinator``,
/// and never to a repository. The Shadow journey is kept for Shadow qualification, and the two
/// never fall back to each other — a guest whose live invitation fails is told so, rather than
/// being shown fixture data that looks like their card.
///
/// It holds no RSVP credential. ``LiveInvitationPresentation`` deliberately has no field for one.
public struct LiveGuestInvitationView: View {
    private let presentation: LiveInvitationPresentation
    private let coordinator: LiveGuestInvitationCoordinator
    private let onRefreshed: (LiveInvitationState) -> Void
    private let onContinue: () -> Void
    private let onBackToWedding: (() -> Void)?
    private let onViewPass: (() -> Void)?

    @State private var rsvpPrompt = false
    @State private var rsvpEditorPresentation: LiveInvitationPresentation? = nil
    @State private var editorLoading = false
    @State private var refreshUnavailable = false
    @State private var formSessionId = UUID()
    @State private var submitting = false
    @State private var reopenRequired = false
    @State private var staleOrReplacedGuest = false
    @State private var childrenNotAllowed = false
    @State private var showNote = false

    public init(
        presentation: LiveInvitationPresentation,
        coordinator: LiveGuestInvitationCoordinator,
        onRefreshed: @escaping (LiveInvitationState) -> Void,
        onContinue: @escaping () -> Void,
        onBackToWedding: (() -> Void)? = nil,
        onViewPass: (() -> Void)? = nil
    ) {
        self.presentation = presentation
        self.coordinator = coordinator
        self.onRefreshed = onRefreshed
        self.onContinue = onContinue
        self.onBackToWedding = onBackToWedding
        self.onViewPass = onViewPass
    }

    private func requestRsvpEdit() {
        guard !editorLoading, !submitting else { return }
        editorLoading = true
        refreshUnavailable = false
        Task {
            let prep = await coordinator.prepareRsvpEditor()
            switch prep {
            case let .ready(snapshot):
                rsvpEditorPresentation = LiveInvitationPresentation.from(snapshot)
                formSessionId = UUID()
                onRefreshed(.presenting(snapshot))
                rsvpPrompt = true
            case .reopenRequired:
                rsvpEditorPresentation = nil
                rsvpPrompt = false
                reopenRequired = true
            case .staleOrReplacedGuest:
                // The coordinator's binding was left untouched — do not clear the presentation
                // or open the editor on top of a snapshot that is no longer current.
                rsvpPrompt = false
                staleOrReplacedGuest = true
            case .unavailable:
                rsvpEditorPresentation = nil
                rsvpPrompt = false
                refreshUnavailable = true
            }
            editorLoading = false
        }
    }

    // Master plan Phase 9 — the full converged RSVP field set, not just attendance. Respects
    // server-provided policy (adults-only) rather than inventing wedding rules client-side; the
    // server remains the final enforcement authority regardless of what this form allows.
    private func answer(_ update: GuestRsvpUpdate) {
        guard !submitting else { return }
        submitting = true
        Task {
            let outcome = await coordinator.answer(update)
            switch outcome {
            case .saved:
                rsvpPrompt = false
                rsvpEditorPresentation = nil
                // Re-read rather than trusting the local edit: what the card shows afterwards is
                // what the server stored.
                onRefreshed(await coordinator.refresh())
            // The card belongs to a guest who is no longer the active one. Saying nothing here
            // would let the guest believe their answer was recorded.
            case .reopenRequired, .unavailable:
                rsvpPrompt = false
                rsvpEditorPresentation = nil
                reopenRequired = true
            // Distinct from reopenRequired: this is a policy refusal (adults-only), not a stale
            // session — a "reopen your invitation" message would be actively misleading here.
            case .childrenNotAllowed:
                childrenNotAllowed = true
            }
            submitting = false
        }
    }

    public var body: some View {
        ZStack {
            NativeInvitationExperience(
                style: presentation.invitationCardStyle,
                data: presentation.ivoryData,
                rsvp: ivoryRsvpState(from: presentation.rsvpStatus),
                actions: resolveLiveInvitationActions(
                    presentation: presentation,
                    onRsvpPrompt: {
                        requestRsvpEdit()
                    },
                    onAddToCalendar: { addWeddingToCalendar() },
                    onOpenVenue: { open(venueDestination) },
                    onGifts: { open(coupleSite(fragment: "#registry")) },
                    onNote: (presentation.invitationCardMessage?.isEmpty == false)
                        ? { showNote = true } : nil,
                    onViewPass: onViewPass,
                    onVisitCoupleSite: { open(coupleSite(fragment: nil)) },
                    onContinue: presentation.attending == nil ? nil : onContinue
                )
            )

            if rsvpPrompt, let editorPresentation = rsvpEditorPresentation {
                LiveRsvpFormView(
                    guestName: editorPresentation.guestName,
                    childrenPolicy: editorPresentation.childrenPolicy,
                    initial: editorPresentation,
                    isSubmitting: submitting,
                    childrenNotAllowed: childrenNotAllowed,
                    onDismissChildrenNotice: { childrenNotAllowed = false },
                    onSubmit: { answer($0) },
                    onDismiss: {
                        if !submitting {
                            rsvpPrompt = false
                            rsvpEditorPresentation = nil
                        }
                    }
                )
                .id(formSessionId)
            }
            if reopenRequired { reopenRequiredView }
            if staleOrReplacedGuest { staleOrReplacedGuestView }
            if refreshUnavailable { refreshUnavailableView }
            if showNote, let note = presentation.invitationCardMessage, !note.isEmpty {
                noteFromTheCouple(note)
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            if let onBackToWedding {
                HStack {
                    Button(action: onBackToWedding) {
                        HStack(spacing: 7) {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 12, weight: .bold))
                            Text("Back to My Wedding")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 44)
                        .background(WeddingIdentityPalette.ivorySoft)
                        .overlay(
                            Capsule()
                                .stroke(WeddingIdentityPalette.champagne.opacity(0.70), lineWidth: 1)
                        )
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("invitation-back-to-wedding")
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(WeddingIdentityPalette.ivory.opacity(0.98))
            }
        }
    }

    private var venueDestination: String {
        resolveLiveVenueDestination(presentation: presentation)
    }

    /// Hands the wedding to the phone's calendar.
    ///
    /// The date arrives as ISO from the graph; older shapes use a space separator. Both are the
    /// same instant, and a parser that accepted only one silently produced no event at all.
    private func addWeddingToCalendar() {
        guard let start = Self.weddingInstant(presentation.weddingDate ?? "") else { return }
        let stamp = DateFormatter()
        stamp.locale = Locale(identifier: "en_US_POSIX")
        stamp.dateFormat = "yyyyMMdd'T'HHmmss"
        let location = [presentation.venue, presentation.venueCityCountry]
            .compactMap { $0?.isEmpty == false ? $0 : nil }
            .joined(separator: ", ")
        let ics = """
        BEGIN:VCALENDAR\r
        VERSION:2.0\r
        BEGIN:VEVENT\r
        SUMMARY:\(presentation.coupleNames)\r
        LOCATION:\(location)\r
        DTSTART:\(stamp.string(from: start))\r
        DTEND:\(stamp.string(from: start.addingTimeInterval(6 * 3600)))\r
        END:VEVENT\r
        END:VCALENDAR\r
        """
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("wedding.ics")
        try? ics.data(using: .utf8)?.write(to: url)
        open(url.absoluteString)
    }

    static func weddingInstant(_ raw: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        for pattern in ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss",
                        "yyyy-MM-dd'T'HH:mm", "yyyy-MM-dd"] {
            formatter.dateFormat = pattern
            if let date = formatter.date(from: raw.trimmingCharacters(in: .whitespaces)) {
                return date
            }
        }
        return nil
    }

    /// The couple's own note. Shown only when `invitationCardMessage` is set, because the
    /// alternative is putting words in their mouth.
    private func noteFromTheCouple(_ note: String) -> some View {
        GeometryReader { proxy in
            let surfaceWidth = GuestViewportGeometry.noteSurfaceWidth(
                viewportWidth: proxy.size.width
            )
            let textWidth = GuestViewportGeometry.noteTextWidth(
                viewportWidth: proxy.size.width
            )

            ZStack {
                // Dismiss only through the explicit close control. If this background
                // also handles the opening tap, SwiftUI can insert the overlay during the
                // details-button gesture and immediately close it again on the same event.
                Color.black.opacity(0.40)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)

                ZStack {
                    WeddingFloralBackground(opacity: 0.075)

                    VStack(spacing: 14) {
                        HStack {
                            Spacer(minLength: 0)
                            Button { showNote = false } label: {
                                Image(systemName: "xmark")
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                                    .frame(width: 44, height: 44)
                                    .background(WeddingIdentityPalette.ivorySoft.opacity(0.94))
                                    .clipShape(Circle())
                                    .overlay(
                                        Circle().stroke(
                                            WeddingIdentityPalette.champagne.opacity(0.55),
                                            lineWidth: 1
                                        )
                                    )
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Close note")
                            .accessibilityIdentifier("invitation-note-dismiss")
                        }
                        .frame(width: textWidth)

                        WeddingBrandMark()
                        Text("A note from us")
                            .font(.system(size: 22, design: .serif))
                            .foregroundStyle(WeddingIdentityPalette.ink)
                            .multilineTextAlignment(.center)
                            .frame(width: textWidth)

                        Rectangle()
                            .fill(WeddingIdentityPalette.champagne.opacity(0.70))
                            .frame(width: min(64, textWidth), height: 1)

                        Text(note)
                            .font(.system(size: 16, design: .serif))
                            .foregroundStyle(WeddingIdentityPalette.ink)
                            .multilineTextAlignment(.center)
                            .lineSpacing(5)
                            .frame(width: textWidth, alignment: .center)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityIdentifier("invitation-note-message")

                        Text("Your invitation remains behind this note.")
                            .font(.system(size: 11))
                            .foregroundStyle(WeddingIdentityPalette.muted)
                            .multilineTextAlignment(.center)
                            .frame(width: textWidth)
                    }
                    .frame(width: textWidth)
                    .padding(.horizontal, GuestViewportGeometry.noteInternalPadding)
                    .padding(.vertical, 18)
                }
                .frame(width: surfaceWidth)
                .background(WeddingIdentityPalette.ivorySoft)
                .clipShape(RoundedRectangle(cornerRadius: 24))
                .overlay(
                    RoundedRectangle(cornerRadius: 24)
                        .stroke(WeddingIdentityPalette.champagne.opacity(0.55), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.12), radius: 14, x: 0, y: 8)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .clipped()
            .overlay(
                AccessibilityMarker("invitation-note-sheet", label: "A note from us")
            )
        }
    }

    /// The public couple site. Safe to share; the private invitation link is not.
    private func coupleSite(fragment: String?) -> String {
        let slug = presentation.weddingSlug
            .addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? presentation.weddingSlug
        return "https://wewed.pro/w/\(slug)\(fragment ?? "")"
    }

    private func open(_ url: String) {
        #if canImport(UIKit)
        guard let target = URL(string: url) else { return }
        UIApplication.shared.open(target)
        #endif
    }

    /// Shown when the server refused the write because the session moved on.
    ///
    /// It says the answer was not saved. A silent failure here is worse than an error, because the
    /// guest walks away believing they have replied.
    private var reopenRequiredView: some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
                .onTapGesture { reopenRequired = false }
            VStack(spacing: 10) {
                Text("Your answer wasn't saved")
                    .font(.system(size: 18, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Text("Open your invitation link again, then reply.")
                    .font(.system(size: 13))
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .multilineTextAlignment(.center)
            }
            .padding(24)
            .background(WeddingIdentityPalette.ivory)
            .padding(28)
        }
        .accessibilityIdentifier("invitation-reopen-required")
    }

    /// Shown when the pre-open refresh finds the session now names a different wedding or guest.
    ///
    /// Distinct from `reopenRequiredView`: nothing was submitted and nothing failed to save — the
    /// presented card simply is not the one the server would hand back right now. The
    /// coordinator's binding is left untouched, so the guest can still answer as themselves; this
    /// only stops the editor from opening on top of a snapshot that is no longer current.
    private var staleOrReplacedGuestView: some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
                .onTapGesture { staleOrReplacedGuest = false }
            VStack(spacing: 10) {
                Text("This invitation has moved on")
                    .font(.system(size: 18, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Text("Open your invitation link again to see the latest.")
                    .font(.system(size: 13))
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .multilineTextAlignment(.center)
            }
            .padding(24)
            .background(WeddingIdentityPalette.ivory)
            .padding(28)
        }
        .accessibilityIdentifier("invitation-stale-or-replaced-guest")
    }

    private var refreshUnavailableView: some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
                .onTapGesture { refreshUnavailable = false }
            VStack(spacing: 10) {
                Text("Couldn't load latest RSVP")
                    .font(.system(size: 18, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Text("Please check your internet connection and try again.")
                    .font(.system(size: 13))
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .multilineTextAlignment(.center)
            }
            .padding(24)
            .background(WeddingIdentityPalette.ivory)
            .padding(28)
        }
        .accessibilityIdentifier("invitation-refresh-unavailable")
    }
}

/// Resolves the actions available from the live invitation details surface.
///
/// RSVP editing remains accessible across all states (pending, accepted, declined) so guests
/// can update meal choice, plus-one, children, notes, or change attendance at any time.
public func resolveLiveVenueDestination(presentation: LiveInvitationPresentation) -> String {
    if let map = presentation.venueMapUrl, !map.isEmpty { return map }
    let query = [presentation.venue, presentation.venueCityCountry]
        .compactMap { $0?.isEmpty == false ? $0 : nil }
        .joined(separator: ", ")
        .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
    return "http://maps.apple.com/?q=\(query)"
}

public func resolveLiveInvitationActions(
    presentation: LiveInvitationPresentation,
    onRsvpPrompt: @escaping () -> Void,
    onAddToCalendar: @escaping () -> Void = {},
    onOpenVenue: @escaping () -> Void = {},
    onGifts: @escaping () -> Void = {},
    onNote: (() -> Void)? = nil,
    onViewPass: (() -> Void)? = nil,
    onVisitCoupleSite: @escaping () -> Void = {},
    onContinue: (() -> Void)? = nil
) -> IvoryActions {
    IvoryActions(
        onRsvp: onRsvpPrompt,
        onAddToCalendar: onAddToCalendar,
        onOpenVenue: onOpenVenue,
        onGifts: onGifts,
        onNote: onNote,
        // Pending stays inside Ivory: the locked Pass affordance opens RSVP instead of navigating.
        // Once answered, both attending and declined Guests may enter the persistent Pass destination.
        onViewPass: presentation.attending == nil ? onRsvpPrompt : onViewPass,
        onVisitCoupleSite: onVisitCoupleSite,
        onContinue: presentation.attending == nil ? nil : onContinue
    )
}

/// The 5 meal options the PWA's own premium RSVP dialog offers (`mealChoice` is otherwise free
/// text).
private let liveRsvpMealOptions: [(value: String, label: String)] = [
    ("beef", "Beef"), ("chicken", "Chicken"), ("vegetarian", "Vegetarian"),
    ("vegan", "Vegan"), ("traditional", "Traditional")
]

/// Master plan Phase 9 — the full converged RSVP form: attendance, meal, plus-one (+ name/meal),
/// children (+ count, respecting adults-only), dietary notes and a message to the couple. Mirrors
/// the PWA's own `premium-invitation-rsvp-dialog.tsx` field set and submission shape exactly, so the
/// two clients converge on the same server contract rather than inventing a mobile-only one.
private struct LiveRsvpFormView: View {
    let guestName: String
    let childrenPolicy: String?
    let initial: LiveInvitationPresentation
    let isSubmitting: Bool
    let childrenNotAllowed: Bool
    let onDismissChildrenNotice: () -> Void
    let onSubmit: (GuestRsvpUpdate) -> Void
    let onDismiss: () -> Void

    @State private var accepting: Bool
    @State private var mealChoice: String
    @State private var plusOne: Bool
    @State private var plusOneName: String
    @State private var plusOneMeal: String
    @State private var kidsAttending: Bool
    @State private var kidsCount: Int
    @State private var dietaryNotes: String
    @State private var message: String

    private var adultsOnly: Bool { childrenPolicy == "adults_only" }

    init(
        guestName: String,
        childrenPolicy: String?,
        initial: LiveInvitationPresentation,
        isSubmitting: Bool,
        childrenNotAllowed: Bool,
        onDismissChildrenNotice: @escaping () -> Void,
        onSubmit: @escaping (GuestRsvpUpdate) -> Void,
        onDismiss: @escaping () -> Void
    ) {
        self.guestName = guestName
        self.childrenPolicy = childrenPolicy
        self.initial = initial
        self.isSubmitting = isSubmitting
        self.childrenNotAllowed = childrenNotAllowed
        self.onDismissChildrenNotice = onDismissChildrenNotice
        self.onSubmit = onSubmit
        self.onDismiss = onDismiss
        // Never let a stale client pre-select children attendance on an adults-only wedding — the
        // server remains final enforcement authority regardless, but the form must not encourage it.
        let adultsOnlyPolicy = childrenPolicy == "adults_only"
        _accepting = State(initialValue: initial.attending != false)
        _mealChoice = State(initialValue: initial.mealChoice ?? "")
        _plusOne = State(initialValue: initial.plusOne)
        _plusOneName = State(initialValue: initial.plusOneName ?? "")
        _plusOneMeal = State(initialValue: initial.plusOneMeal ?? "")
        _kidsAttending = State(initialValue: adultsOnlyPolicy ? false : initial.kidsAttending)
        _kidsCount = State(initialValue: initial.kidsCount ?? 0)
        _dietaryNotes = State(initialValue: initial.dietaryNotes ?? "")
        _message = State(initialValue: initial.message ?? "")
    }

    private func buildUpdate() -> GuestRsvpUpdate {
        GuestRsvpUpdate(
            attending: accepting,
            // Sent (never omitted) only while accepting — an empty string here intentionally
            // clears a previously-saved choice, matching the server's own trim-to-nil semantics;
            // omitted entirely while declining, so a decline never disturbs a meal choice saved
            // from a prior acceptance.
            mealChoice: accepting ? mealChoice.trimmingCharacters(in: .whitespacesAndNewlines) : nil,
            plusOne: accepting ? plusOne : false,
            plusOneName: (accepting && plusOne)
                ? plusOneName.trimmingCharacters(in: .whitespacesAndNewlines) : nil,
            plusOneMeal: (accepting && plusOne)
                ? plusOneMeal.trimmingCharacters(in: .whitespacesAndNewlines) : nil,
            kidsAttending: (accepting && !adultsOnly) ? kidsAttending : false,
            kidsCount: (accepting && !adultsOnly && kidsAttending) ? kidsCount : nil,
            dietaryNotes: accepting ? dietaryNotes.trimmingCharacters(in: .whitespacesAndNewlines) : nil,
            // Always sent: a message to the couple is meaningful whether or not the guest is
            // attending.
            message: message.trimmingCharacters(in: .whitespacesAndNewlines)
        )
    }

    var body: some View {
        GeometryReader { proxy in
            let sheetWidth = GuestViewportGeometry.rsvpSheetWidth(
                viewportWidth: proxy.size.width
            )
            let contentWidth = GuestViewportGeometry.rsvpContentWidth(
                viewportWidth: proxy.size.width
            )
            let attendanceChoiceWidth = GuestViewportGeometry.rsvpAttendanceChoiceWidth(
                viewportWidth: proxy.size.width
            )
            let sheetHeight = min(max(0, proxy.size.height * 0.90), 720)

            ZStack(alignment: .bottom) {
                Color.black.opacity(0.40)
                    .ignoresSafeArea()
                    .onTapGesture { if !isSubmitting { onDismiss() } }

                ZStack {
                    WeddingFloralBackground(opacity: 0.045)

                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 16) {
                            HStack(spacing: 12) {
                                WeddingBrandMark()
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("RSVP")
                                        .font(.system(size: 11, weight: .semibold))
                                        .tracking(2)
                                        .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                                    Text("Will you be joining us?")
                                        .font(.system(size: 23, design: .serif))
                                        .foregroundStyle(WeddingIdentityPalette.ink)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .frame(width: contentWidth, alignment: .leading)

                            if !guestName.isEmpty {
                                Text("For \(guestName)")
                                    .font(.system(size: 13))
                                    .foregroundStyle(WeddingIdentityPalette.muted)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .frame(width: contentWidth, alignment: .leading)
                            }

                            HStack(spacing: GuestViewportGeometry.rsvpAttendanceSpacing) {
                                choiceChip(
                                    "Joyfully accept",
                                    selected: accepting,
                                    identifier: "invitation-rsvp-accept",
                                    fixedWidth: attendanceChoiceWidth
                                ) { accepting = true }
                                choiceChip(
                                    "Regretfully decline",
                                    selected: !accepting,
                                    identifier: "invitation-rsvp-decline",
                                    fixedWidth: attendanceChoiceWidth
                                ) { accepting = false }
                            }
                            .frame(width: contentWidth, alignment: .leading)

                            if accepting {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Meal preference")
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundStyle(WeddingIdentityPalette.muted)

                                    // The meal options are the only intentionally horizontal region
                                    // inside RSVP. The ScrollView itself is bounded to contentWidth,
                                    // so its wider HStack cannot enlarge the modal.
                                    ScrollView(.horizontal, showsIndicators: false) {
                                        HStack(spacing: 8) {
                                            ForEach(liveRsvpMealOptions, id: \.value) { option in
                                                choiceChip(
                                                    option.label,
                                                    selected: mealChoice == option.value,
                                                    identifier: "invitation-rsvp-meal-\(option.value)"
                                                ) {
                                                    mealChoice = option.value
                                                }
                                            }
                                        }
                                    }
                                    .frame(width: contentWidth)
                                    .accessibilityIdentifier("invitation-rsvp-meal-carousel")

                                    Divider().padding(.vertical, 4)

                                    toggleRow(
                                        "Bringing a plus one",
                                        isOn: $plusOne,
                                        identifier: "invitation-rsvp-plus-one-toggle"
                                    )
                                    .frame(width: contentWidth)

                                    if plusOne {
                                        VStack(spacing: 8) {
                                            TextField("Plus one's name", text: $plusOneName)
                                                .textFieldStyle(.roundedBorder)
                                                .frame(width: contentWidth)
                                                .accessibilityIdentifier("invitation-rsvp-plus-one-name")
                                            TextField("Their meal preference", text: $plusOneMeal)
                                                .textFieldStyle(.roundedBorder)
                                                .frame(width: contentWidth)
                                                .accessibilityIdentifier("invitation-rsvp-plus-one-meal")
                                        }
                                        .frame(width: contentWidth)
                                        .accessibilityIdentifier("invitation-rsvp-plus-one-details")
                                    }

                                    Divider().padding(.vertical, 4)

                                    if adultsOnly {
                                        Text("With love, we kindly ask that this be an adults-only celebration.")
                                            .font(.system(size: 12))
                                            .foregroundStyle(WeddingIdentityPalette.muted)
                                            .fixedSize(horizontal: false, vertical: true)
                                            .frame(width: contentWidth, alignment: .leading)
                                            .accessibilityIdentifier("invitation-rsvp-adults-only-note")
                                    } else {
                                        toggleRow(
                                            "Children are attending",
                                            isOn: $kidsAttending,
                                            identifier: "invitation-rsvp-kids-toggle"
                                        )
                                        .frame(width: contentWidth)

                                        if kidsAttending {
                                            HStack(spacing: 16) {
                                                Button {
                                                    if kidsCount > 0 { kidsCount -= 1 }
                                                } label: {
                                                    Text("−")
                                                        .font(.system(size: 20, weight: .bold))
                                                        .frame(width: 44, height: 44)
                                                }
                                                .buttonStyle(.plain)
                                                .foregroundStyle(WeddingIdentityPalette.ink)

                                                Text("\(kidsCount)")
                                                    .font(.system(size: 15))
                                                    .foregroundStyle(WeddingIdentityPalette.ink)

                                                Button {
                                                    kidsCount = min(kidsCount + 1, 20)
                                                } label: {
                                                    Text("+")
                                                        .font(.system(size: 20, weight: .bold))
                                                        .frame(width: 44, height: 44)
                                                }
                                                .buttonStyle(.plain)
                                                .foregroundStyle(WeddingIdentityPalette.ink)
                                            }
                                            .frame(width: contentWidth, alignment: .leading)
                                            .accessibilityIdentifier("invitation-rsvp-kids-stepper")
                                        }
                                    }

                                    TextField("Dietary notes", text: $dietaryNotes, axis: .vertical)
                                        .textFieldStyle(.roundedBorder)
                                        .frame(width: contentWidth)
                                        .accessibilityIdentifier("invitation-rsvp-dietary-notes")
                                }
                                .frame(width: contentWidth, alignment: .leading)
                                .accessibilityIdentifier("invitation-rsvp-attending-fields")
                            }

                            TextField("Message to the couple", text: $message, axis: .vertical)
                                .textFieldStyle(.roundedBorder)
                                .frame(width: contentWidth)
                                .accessibilityIdentifier("invitation-rsvp-message")

                            if childrenNotAllowed {
                                Text("This celebration is adults only, so children can't be added to your RSVP.")
                                    .font(.system(size: 12))
                                    .foregroundStyle(WewedColors.error)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .frame(width: contentWidth, alignment: .leading)
                                    .onTapGesture(perform: onDismissChildrenNotice)
                                    .accessibilityIdentifier("invitation-rsvp-children-not-allowed")
                            }

                            if isSubmitting {
                                HStack(spacing: 10) {
                                    ProgressView()
                                        .tint(WeddingIdentityPalette.champagneDeep)
                                    Text("Recording your answer…")
                                        .font(.system(size: 13))
                                        .foregroundStyle(WeddingIdentityPalette.muted)
                                }
                                .frame(width: contentWidth, alignment: .leading)
                                .frame(minHeight: 44, alignment: .leading)
                            } else {
                                Button { onSubmit(buildUpdate()) } label: {
                                    HStack(spacing: 8) {
                                        Image(systemName: "checkmark")
                                        Text("Save RSVP")
                                            .fontWeight(.semibold)
                                    }
                                    .foregroundStyle(.white)
                                    .frame(width: contentWidth)
                                    .frame(minHeight: 50)
                                    .background(WeddingIdentityPalette.champagneDeep)
                                    .clipShape(RoundedRectangle(cornerRadius: 13))
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("invitation-rsvp-save")
                            }
                        }
                        .frame(width: contentWidth, alignment: .leading)
                        .padding(.horizontal, GuestViewportGeometry.rsvpInternalPadding)
                        .padding(.vertical, 22)
                    }
                    .frame(width: sheetWidth)
                }
                .frame(width: sheetWidth, height: sheetHeight)
                .background(WeddingIdentityPalette.ivorySoft)
                .clipShape(RoundedRectangle(cornerRadius: 28))
                .overlay(
                    RoundedRectangle(cornerRadius: 28)
                        .stroke(WeddingIdentityPalette.champagne.opacity(0.42), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.14), radius: 16, x: 0, y: -3)
                .padding(.bottom, 4)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .clipped()
        }
        .accessibilityIdentifier("invitation-rsvp-prompt")
    }

    private func choiceChip(
        _ label: String,
        selected: Bool,
        identifier: String,
        fixedWidth: CGFloat? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: selected ? .semibold : .regular))
                .multilineTextAlignment(.center)
                .foregroundStyle(
                    selected ? WeddingIdentityPalette.forest : WeddingIdentityPalette.muted
                )
                .padding(.horizontal, 10)
                .frame(width: fixedWidth)
                .frame(minHeight: 44)
                .background(
                    selected
                        ? WeddingIdentityPalette.forestSoft
                        : WeddingIdentityPalette.ivorySoft
                )
                .clipShape(Capsule())
                .overlay(
                    Capsule().stroke(
                        selected
                            ? WeddingIdentityPalette.forest.opacity(0.55)
                            : WeddingIdentityPalette.hairline,
                        lineWidth: 1
                    )
                )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    private func toggleRow(_ label: String, isOn: Binding<Bool>, identifier: String) -> some View {
        HStack {
            Text(label)
                .font(.system(size: 14))
                .foregroundStyle(WeddingIdentityPalette.ink)
            Spacer()
            Toggle("", isOn: isOn)
                .labelsHidden()
                .tint(WeddingIdentityPalette.forest)
        }
        .accessibilityIdentifier(identifier)
    }
}

/// Wewed could not be reached.
///
/// Deliberately distinct from a refusal: "try again in a moment" and "this link is not yours" are
/// opposite messages, and showing the wrong one is how a working invitation gets abandoned.
public struct InvitationUnavailableView: View {
    private let onRetry: () -> Void

    public init(onRetry: @escaping () -> Void) { self.onRetry = onRetry }

    public var body: some View {
        ZStack {
            WeddingIdentityPalette.ivory.ignoresSafeArea()
            AccessibilityMarker("invitation-unavailable", label: "We couldn't reach Wewed")
            VStack(spacing: 12) {
                Text("We couldn't reach Wewed")
                    .font(.system(size: 20, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Text("Your invitation is fine. Check your connection and open the link again.")
                    .font(.system(size: 14))
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .multilineTextAlignment(.center)
                Button(action: onRetry) {
                    Text("Continue to Wewed")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(WeddingIdentityPalette.champagneDeep)
                        .clipShape(RoundedRectangle(cornerRadius: 13))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("invitation-unavailable-dismiss")
            }
            .padding(32)
        }
    }
}

private extension LiveInvitationPresentation {
    var ivoryData: IvoryInvitationData {
        let iso = String((weddingDate ?? "").prefix(10))
        let parts = iso.split(separator: "-").map(String.init)
        let months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                      "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
        let input = DateFormatter()
        input.locale = Locale(identifier: "en_US_POSIX")
        input.dateFormat = "yyyy-MM-dd"
        let weekday: String? = input.date(from: iso).map { date in
            let out = DateFormatter()
            out.locale = Locale(identifier: "en_US_POSIX")
            out.dateFormat = "EEEE"
            return out.string(from: date)
        }
        let initials = coupleNames
            .components(separatedBy: "&")
            .compactMap { $0.trimmingCharacters(in: .whitespaces).first.map(String.init)?.uppercased() }
            .joined(separator: " ")

        return IvoryInvitationData(
            coupleNames: coupleNames,
            monogram: monogram ?? initials,
            message: (invitationCardMessage?.isEmpty == false ? invitationCardMessage : nil)
                ?? "Request the pleasure of your company as we celebrate our marriage.",
            weekdayLabel: weekday,
            dayLabel: parts.count > 2 ? Int(parts[2]).map(String.init) : nil,
            monthLabel: parts.count > 1 ? Int(parts[1]).flatMap { $0 >= 1 && $0 <= 12 ? months[$0 - 1] : nil } : nil,
            yearLabel: parts.first,
            venue: venue ?? "",
            venueAddress: nil,
            venueCityCountry: venueCityCountry,
            tagline: tagline,
            guestName: guestName,
            rsvpDeadlineLabel: rsvpDeadline
        )
    }
}
