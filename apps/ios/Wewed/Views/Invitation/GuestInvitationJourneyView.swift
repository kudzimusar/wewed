import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// Hosts a guest's entry into the wedding's configured digital invitation.
///
/// This view owns the journey — splash, RSVP submission, the pass — and owns none of the
/// invitation's appearance. That belongs to `NativeInvitationExperience`, which renders whichever
/// design the couple actually saved.
///
/// The previous version chose between the invitation and a different screen based on RSVP state, so
/// a guest who had already answered never saw their invitation again. RSVP state now changes only
/// what the card OFFERS.
public struct GuestInvitationJourneyView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    public let reference: GuestJourneyReference
    private let onExit: (() -> Void)?

    @State private var showSplash: Bool
    @State private var splashVisible = false
    @State private var invitation: InvitationContext
    @State private var configuration: WeddingInvitationConfiguration?
    @State private var showNote = false
    @State private var confirmedPass: WeddingPass?
    @State private var showPass = false
    @State private var rsvpPrompt = false
    @State private var isSubmitting = false

    public init(
        reference: GuestJourneyReference,
        onExit: (() -> Void)? = nil
    ) {
        self.reference = reference
        self.onExit = onExit
        _showSplash = State(initialValue: reference.initialStage == .splash)
        _invitation = State(initialValue: reference.invitation)
    }

    private func exitJourney() {
        if let onExit {
            onExit()
        } else {
            dismiss()
        }
    }

    private var style: InvitationStyle {
        InvitationStyle.fromWire(configuration?.cardStyle ?? reference.invitation.cardStyle)
    }

    /// The couple's own words, where they wrote any. No note means no note.
    private var note: String? {
        configuration?.message.flatMap { $0.isEmpty ? nil : $0 }
    }

    private var status: RSVPStatus {
        if invitation.isConfirmed { return .attending }
        if invitation.isDeclined { return .declined }
        return .pending
    }

    private func submit(attending: Bool) async {
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let pass = try await appState.repository.confirmRsvp(
                weddingSlug: invitation.weddingSlug,
                token: invitation.guestToken,
                attending: attending
            )
            invitation.isConfirmed = attending
            invitation.isDeclined = !attending
            confirmedPass = attending ? pass : nil
            rsvpPrompt = false
        } catch {
            // Keep the invitation actionable when a Shadow RSVP operation fails. A failed write
            // must not leave the guest looking at a card that claims an answer was recorded.
        }
    }

    public var body: some View {
        Group {
            if showSplash {
                splashStage
            } else if showPass {
                ZStack(alignment: .topTrailing) {
                    WeddingReferencePassView(pass: confirmedPass)
                    Button("Done") { showPass = false }
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(.thinMaterial)
                        .clipShape(Capsule())
                        .padding()
                        .accessibilityIdentifier("guest-journey-done")
                }
            } else {
                ZStack {
                    NativeInvitationExperience(
                        style: style,
                        data: ivoryData(
                            from: invitation,
                            monogram: configuration?.monogram,
                            tagline: configuration?.tagline,
                            rsvpDeadlineLabel: configuration?.rsvpDeadline,
                            message: note
                        ),
                        rsvp: ivoryRsvpState(from: status),
                        actions: IvoryActions(
                            // Only a guest who has not answered is offered the question.
                            onRsvp: status == .pending ? { rsvpPrompt = true } : nil,
                            // The date and venue are on the card already; these hand them to the
                            // phone's own calendar and maps rather than asking the guest to copy
                            // them across.
                            onAddToCalendar: { addWeddingToCalendar() },
                            onOpenVenue: { openVenueLocation() },
                            // Gifts open the couple's own registry section, as
                            // `hit('registry', ...)` does on the web: `visitCoupleWebsite('#registry')`.
                            onGifts: { open(coupleSiteUrl(fragment: "#registry")) },
                            // The note is the couple's own words, not a stock sentence.
                            onNote: note == nil ? nil : { showNote = true },
                            // A declined guest never gets a pass. This is the guest's OWN pass —
                            // never the usher scanner, which belongs to the separate Wedding Day
                            // gate project.
                            onViewPass: status == .attending ? { showPass = true } : nil,
                            // The couple's public site is offered to every guest, whatever they
                            // answered.
                            onVisitCoupleSite: { open(coupleSiteUrl(fragment: nil)) },
                            onContinue: { exitJourney() }
                        )
                    )

                    if rsvpPrompt {
                        rsvpAnswerPrompt
                    }

                    if showNote, let note {
                        noteFromTheCouple(note)
                    }
                }
            }
        }
        .task(id: reference.invitation.guestToken) {
            // The wedding row is the authority on the invitation; the invitation context carries a
            // resolved copy for offline entry. If the two disagree, the wedding wins.
            configuration = try? await appState.repository
                .invitationConfigurationForSlug(reference.invitation.weddingSlug)
        }
        .task(id: showSplash) {
            guard showSplash else { return }
            withAnimation(.easeOut(duration: 0.45)) { splashVisible = true }
            try? await Task.sleep(nanoseconds: 1_050_000_000)
            withAnimation(.easeInOut(duration: 0.4)) { showSplash = false }
        }
    }

    /// The RSVP question, asked over the invitation rather than instead of it.
    ///
    /// It is a sheet, not a screen, so the card the couple designed stays on screen while the
    /// guest answers it.
    private var rsvpAnswerPrompt: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.45)
                .ignoresSafeArea()
                .onTapGesture { if !isSubmitting { rsvpPrompt = false } }

            VStack(spacing: 14) {
                Text("Will you be joining us?")
                    .font(.system(size: 20, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                if !invitation.guestName.isEmpty {
                    Text(invitation.guestName)
                        .font(.system(size: 13))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                }
                if isSubmitting {
                    Text("Recording your answer…")
                        .font(.system(size: 13))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                } else {
                    Button("Joyfully accept") { Task { await submit(attending: true) } }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(WewedColors.emerald)
                        .padding(.vertical, 8)
                        .accessibilityIdentifier("invitation-rsvp-accept")
                    Button("Regretfully decline") { Task { await submit(attending: false) } }
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

    private var splashStage: some View {
        ZStack {
            WeddingFloralBackground(opacity: 0.11)

            VStack(spacing: 14) {
                WeddingBrandMark()
                    .scaleEffect(splashVisible ? 1 : 0.72)
                    .rotationEffect(.degrees(splashVisible ? 0 : -10))

                Text("Wewed")
                    .font(.system(size: 42, weight: .medium, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)

                Text("PLAN  •  CONNECT  •  CELEBRATE")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(2.4)
                    .foregroundStyle(WeddingIdentityPalette.muted)

                Capsule()
                    .fill(WeddingIdentityPalette.champagne.opacity(0.72))
                    .frame(width: splashVisible ? 94 : 26, height: 1.5)

                Text("Weddings Made More Meaningful")
                    .font(.system(size: 18, design: .serif))
                    .italic()
                    .foregroundStyle(WeddingIdentityPalette.ink)
            }
            .padding(28)
            .scaleEffect(splashVisible ? 1 : 0.94)
            .offset(y: splashVisible ? 0 : 18)
            .opacity(splashVisible ? 1 : 0)
            .animation(.easeOut(duration: 0.65), value: splashVisible)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Wewed. Plan, connect, celebrate. Weddings made more meaningful.")
        .accessibilityIdentifier("guest-journey-splash")
    }

    /// The couple's own note, shown over the card.
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

    /// Hands the wedding to the phone's calendar.
    ///
    /// An `.ics` the guest saves themselves, so the app never needs calendar permissions.
    private func addWeddingToCalendar() {
        guard let start = Self.weddingInstant(invitation.weddingDate) else { return }
        let stamp = DateFormatter()
        stamp.locale = Locale(identifier: "en_US_POSIX")
        stamp.dateFormat = "yyyyMMdd'T'HHmmss"
        let ics = """
        BEGIN:VCALENDAR\r
        VERSION:2.0\r
        BEGIN:VEVENT\r
        SUMMARY:\(invitation.coupleNames)\r
        LOCATION:\(invitation.venueName)\r
        DTSTART:\(stamp.string(from: start))\r
        DTEND:\(stamp.string(from: start.addingTimeInterval(6 * 3600)))\r
        END:VEVENT\r
        END:VCALENDAR\r
        """
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("wedding.ics")
        try? ics.data(using: .utf8)?.write(to: url)
        open(url.absoluteString)
    }

    /// Opens the couple's own map link where they set one, and a venue search where they did not.
    private func openVenueLocation() {
        if let map = configuration?.venueMapUrl, !map.isEmpty {
            open(map)
            return
        }
        let query = "\(invitation.venueName), \(invitation.venueCity)"
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        open("http://maps.apple.com/?q=\(query)")
    }

    /// The couple's public wedding site.
    ///
    /// Deliberately the generic `/w/<slug>` page and never the guest's private invitation link:
    /// this one is safe to share, and conflating the two is how a private credential ends up
    /// forwarded.
    private func coupleSiteUrl(fragment: String?) -> String {
        let slug = invitation.weddingSlug
            .addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? invitation.weddingSlug
        return "https://wewed.pro/w/\(slug)\(fragment ?? "")"
    }

    private func open(_ url: String) {
        #if canImport(UIKit)
        guard let target = URL(string: url) else { return }
        UIApplication.shared.open(target)
        #endif
    }

    /// The graph writes ISO; older fixtures write a space separator. Both are the same instant.
    private static func weddingInstant(_ raw: String) -> Date? {
        let patterns = ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss",
                        "yyyy-MM-dd'T'HH:mm", "yyyy-MM-dd"]
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        for pattern in patterns {
            formatter.dateFormat = pattern
            if let date = formatter.date(from: raw.trimmingCharacters(in: .whitespaces)) {
                return date
            }
        }
        return nil
    }
}
