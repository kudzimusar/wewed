import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

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
    @State private var submitting = false
    @State private var reopenRequired = false
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
                // Re-read rather than trusting the local edit: what the card shows afterwards is
                // what the server stored.
                onRefreshed(await coordinator.refresh())
            // The card belongs to a guest who is no longer the active one. Saying nothing here
            // would let the guest believe their answer was recorded.
            case .reopenRequired, .unavailable:
                rsvpPrompt = false
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
                actions: IvoryActions(
                    onRsvp: presentation.rsvpStatus == .pending ? { rsvpPrompt = true } : nil,
                    // The snapshot already carries the date and venue, so there was never a reason
                    // to withhold this. An .ics the guest saves themselves, so the app needs no
                    // calendar permission.
                    onAddToCalendar: { addWeddingToCalendar() },
                    onOpenVenue: { open(venueDestination) },
                    onGifts: { open(coupleSite(fragment: "#registry")) },
                    // The couple's own words, offered only when they wrote some. An invitation that
                    // always has "a note from us" is inventing words on their behalf.
                    onNote: (presentation.invitationCardMessage?.isEmpty == false)
                        ? { showNote = true } : nil,
                    // Deliberately absent, and it is a release blocker rather than an oversight: no
                    // production authority issues a guest admission credential, and this app will
                    // not manufacture one out of a token, an id, an email or a name.
                    onViewPass: presentation.attending == true ? onViewPass : nil,
                    // The public page, never the private invitation link.
                    onVisitCoupleSite: { open(coupleSite(fragment: nil)) },
                    onContinue: onContinue
                )
            )

            if let onBackToWedding {
                VStack {
                    HStack {
                        Button("Back to My Wedding", action: onBackToWedding)
                            .accessibilityIdentifier("invitation-back-to-wedding")
                        Spacer()
                    }.padding()
                    Spacer()
                }
            }
            if rsvpPrompt {
                LiveRsvpFormView(
                    guestName: presentation.guestName,
                    childrenPolicy: presentation.childrenPolicy,
                    initial: presentation,
                    isSubmitting: submitting,
                    childrenNotAllowed: childrenNotAllowed,
                    onDismissChildrenNotice: { childrenNotAllowed = false },
                    onSubmit: { answer($0) },
                    onDismiss: { if !submitting { rsvpPrompt = false } }
                )
            }
            if reopenRequired { reopenRequiredView }
            if showNote, let note = presentation.invitationCardMessage, !note.isEmpty {
                noteFromTheCouple(note)
            }
        }
    }

    private var venueDestination: String {
        if let map = presentation.venueMapUrl, !map.isEmpty { return map }
        let query = [presentation.venue, presentation.venueCityCountry]
            .compactMap { $0?.isEmpty == false ? $0 : nil }
            .joined(separator: ", ")
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return "http://maps.apple.com/?q=\(query)"
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
        ZStack {
            Color.black.opacity(0.45)
                .ignoresSafeArea()
                .onTapGesture { showNote = false }
            VStack(spacing: 12) {
                Text("A note from us")
                    .font(.system(size: 13))
                    .tracking(1.8)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                Text(note)
                    .font(.system(size: 16, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .multilineTextAlignment(.center)
            }
            .padding(24)
            .background(WeddingIdentityPalette.ivory)
            .padding(32)
        }
        .accessibilityIdentifier("invitation-note-sheet")
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
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.45)
                .ignoresSafeArea()
                .onTapGesture { if !isSubmitting { onDismiss() } }
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Will you be joining us?")
                        .font(.system(size: 20, design: .serif))
                        .foregroundStyle(WeddingIdentityPalette.ink)
                    if !guestName.isEmpty {
                        Text(guestName)
                            .font(.system(size: 13))
                            .foregroundStyle(WeddingIdentityPalette.muted)
                    }

                    HStack(spacing: 12) {
                        choiceChip("Joyfully accept", selected: accepting,
                                   identifier: "invitation-rsvp-accept") { accepting = true }
                        choiceChip("Regretfully decline", selected: !accepting,
                                   identifier: "invitation-rsvp-decline") { accepting = false }
                    }

                    if accepting {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Meal preference")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(WeddingIdentityPalette.muted)
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(liveRsvpMealOptions, id: \.value) { option in
                                        choiceChip(option.label, selected: mealChoice == option.value,
                                                   identifier: "invitation-rsvp-meal-\(option.value)") {
                                            mealChoice = option.value
                                        }
                                    }
                                }
                            }

                            Divider().padding(.vertical, 4)

                            toggleRow("Bringing a plus one", isOn: $plusOne,
                                      identifier: "invitation-rsvp-plus-one-toggle")
                            if plusOne {
                                VStack(spacing: 8) {
                                    TextField("Plus one's name", text: $plusOneName)
                                        .textFieldStyle(.roundedBorder)
                                        .accessibilityIdentifier("invitation-rsvp-plus-one-name")
                                    TextField("Their meal preference", text: $plusOneMeal)
                                        .textFieldStyle(.roundedBorder)
                                        .accessibilityIdentifier("invitation-rsvp-plus-one-meal")
                                }
                                .accessibilityIdentifier("invitation-rsvp-plus-one-details")
                            }

                            Divider().padding(.vertical, 4)

                            if adultsOnly {
                                Text("With love, we kindly ask that this be an adults-only celebration.")
                                    .font(.system(size: 12))
                                    .foregroundStyle(WeddingIdentityPalette.muted)
                                    .accessibilityIdentifier("invitation-rsvp-adults-only-note")
                            } else {
                                toggleRow("Children are attending", isOn: $kidsAttending,
                                          identifier: "invitation-rsvp-kids-toggle")
                                if kidsAttending {
                                    HStack(spacing: 16) {
                                        Text("−")
                                            .font(.system(size: 20, weight: .bold))
                                            .foregroundStyle(WeddingIdentityPalette.ink)
                                            .padding(8)
                                            .onTapGesture {
                                                if kidsCount > 0 { kidsCount -= 1 }
                                            }
                                        Text("\(kidsCount)")
                                            .font(.system(size: 15))
                                            .foregroundStyle(WeddingIdentityPalette.ink)
                                        Text("+")
                                            .font(.system(size: 20, weight: .bold))
                                            .foregroundStyle(WeddingIdentityPalette.ink)
                                            .padding(8)
                                            .onTapGesture {
                                                kidsCount = min(kidsCount + 1, 20)
                                            }
                                    }
                                    .accessibilityIdentifier("invitation-rsvp-kids-stepper")
                                }
                            }

                            TextField("Dietary notes", text: $dietaryNotes, axis: .vertical)
                                .textFieldStyle(.roundedBorder)
                                .accessibilityIdentifier("invitation-rsvp-dietary-notes")
                        }
                        .accessibilityIdentifier("invitation-rsvp-attending-fields")
                    }

                    TextField("Message to the couple", text: $message, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .accessibilityIdentifier("invitation-rsvp-message")

                    if childrenNotAllowed {
                        Text("This celebration is adults only, so children can't be added to your RSVP.")
                            .font(.system(size: 12))
                            .foregroundStyle(WewedColors.error)
                            .onTapGesture(perform: onDismissChildrenNotice)
                            .accessibilityIdentifier("invitation-rsvp-children-not-allowed")
                    }

                    if isSubmitting {
                        Text("Recording your answer…")
                            .font(.system(size: 13))
                            .foregroundStyle(WeddingIdentityPalette.muted)
                    } else {
                        Button("Save RSVP") { onSubmit(buildUpdate()) }
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(WewedColors.emerald)
                            .padding(.vertical, 8)
                            .accessibilityIdentifier("invitation-rsvp-save")
                    }
                }
                .padding(24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(WeddingIdentityPalette.ivory)
        }
        .accessibilityIdentifier("invitation-rsvp-prompt")
    }

    private func choiceChip(
        _ label: String, selected: Bool, identifier: String, action: @escaping () -> Void
    ) -> some View {
        Text(label)
            .font(.system(size: 13, weight: selected ? .semibold : .regular))
            .foregroundStyle(selected ? WewedColors.emerald : WeddingIdentityPalette.muted)
            .padding(.vertical, 8)
            .padding(.horizontal, 14)
            .onTapGesture(perform: action)
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
                .tint(WewedColors.emerald)
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
                Button("Continue to Wewed", action: onRetry)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(WewedColors.emerald)
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
