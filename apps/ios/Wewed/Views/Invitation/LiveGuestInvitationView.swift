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

    @State private var rsvpPrompt = false
    @State private var submitting = false
    @State private var reopenRequired = false
    @State private var showNote = false

    public init(
        presentation: LiveInvitationPresentation,
        coordinator: LiveGuestInvitationCoordinator,
        onRefreshed: @escaping (LiveInvitationState) -> Void,
        onContinue: @escaping () -> Void
    ) {
        self.presentation = presentation
        self.coordinator = coordinator
        self.onRefreshed = onRefreshed
        self.onContinue = onContinue
    }

    private func answer(attending: Bool) {
        guard !submitting else { return }
        submitting = true
        Task {
            let outcome = await coordinator.answer(attending: attending)
            switch outcome {
            case .saved:
                rsvpPrompt = false
                // Re-read rather than trusting the local edit: what the card shows afterwards is
                // what the server stored.
                onRefreshed(await coordinator.refresh())
            // The card belongs to a guest who is no longer the active one. Saying nothing here
            // would let the guest believe their answer was recorded.
            case .reopenRequired, .childrenNotAllowed, .unavailable:
                rsvpPrompt = false
                reopenRequired = true
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
                    onViewPass: nil,
                    // The public page, never the private invitation link.
                    onVisitCoupleSite: { open(coupleSite(fragment: nil)) },
                    onContinue: onContinue
                )
            )

            if rsvpPrompt { rsvpPromptView }
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

    private var rsvpPromptView: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.45)
                .ignoresSafeArea()
                .onTapGesture { if !submitting { rsvpPrompt = false } }
            VStack(spacing: 14) {
                Text("Will you be joining us?")
                    .font(.system(size: 20, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                if !presentation.guestName.isEmpty {
                    Text(presentation.guestName)
                        .font(.system(size: 13))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                }
                if submitting {
                    Text("Recording your answer…")
                        .font(.system(size: 13))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                } else {
                    Button("Joyfully accept") { answer(attending: true) }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(WewedColors.emerald)
                        .padding(.vertical, 8)
                        .accessibilityIdentifier("invitation-rsvp-accept")
                    Button("Regretfully decline") { answer(attending: false) }
                        .font(.system(size: 14))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                        .padding(.vertical, 8)
                        .accessibilityIdentifier("invitation-rsvp-decline")
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity)
            .background(WeddingIdentityPalette.ivory)
        }
        .accessibilityIdentifier("invitation-rsvp-prompt")
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
