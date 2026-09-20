import SwiftUI

/// The one place that decides which invitation a guest meets.
///
/// The invitation is a wedding-configured product object. Individual screens must not decide its
/// design, and RSVP state must not decide it either — that is precisely how an invented summary
/// card came to replace the approved stationery for confirmed guests.
///
/// ```
/// NativeInvitationExperience
///   ├── ivoryFloralGold ──▶ IvoryFloralGoldNative   (the approved reference implementation)
///   └── (future styles plug in here)
/// ```
///
/// A style this build cannot render is stated plainly. Falling back to Ivory would show one couple
/// another couple's stationery, which is worse than saying the design is not available yet.
public struct NativeInvitationExperience: View {
    private let style: InvitationStyle
    private let data: IvoryInvitationData
    private let rsvp: IvoryRsvpState
    private let actions: IvoryActions
    private let reducedMotion: Bool
    private let initialState: InvitationPresentationState
    private let onStateChanged: (InvitationPresentationState) -> Void

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
        self.initialState = initialState
        self.onStateChanged = onStateChanged
    }

    public var body: some View {
        if style.hasNativeRenderer {
            // Exactly one design has an exact native renderer today, and the enum — not this view —
            // is what says so.
            IvoryFloralGoldNative(
                data: data, rsvp: rsvp, actions: actions,
                reducedMotion: reducedMotion, initialState: initialState,
                onStateChanged: onStateChanged
            )
        } else {
            // A style native cannot yet reproduce is named and declined. Substituting Ivory would
            // show one couple another couple's stationery and report it as parity.
            ZStack {
                WeddingIdentityPalette.ivory.ignoresSafeArea()
                VStack(spacing: 10) {
                    Text("\(style.displayName) isn't available on mobile yet")
                        .font(.system(size: 18, design: .serif))
                        .foregroundStyle(WeddingIdentityPalette.ink)
                        .multilineTextAlignment(.center)
                        .accessibilityIdentifier("invitation-style-name")
                    Text("This is the invitation design your wedding is set to. Open your "
                         + "invitation link in a browser to see it exactly as it was made.")
                        .font(.system(size: 13))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                        .multilineTextAlignment(.center)
                }
                .padding(30)
            }
            .accessibilityIdentifier("invitation-style-unsupported")
        }
    }
}

/// Builds the invitation's content from the wedding graph.
///
/// Every value is resolved, never written here. Baking "Charity & Kudzie" into the renderer would
/// make it a picture of one wedding rather than an invitation.
public func ivoryData(
    from invitation: InvitationContext,
    venueAddress: String? = nil,
    monogram: String? = nil,
    tagline: String? = nil,
    rsvpDeadlineLabel: String? = nil,
    /// The couple's own invitation line, where they wrote one.
    message: String? = nil
) -> IvoryInvitationData {
    let iso = String(invitation.weddingDate.prefix(10))
    let parts = iso.split(separator: "-").map(String.init)
    let months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    let monthIndex = parts.count > 1 ? (Int(parts[1]).map { $0 - 1 }) : nil

    let input = DateFormatter()
    input.locale = Locale(identifier: "en_US_POSIX")
    input.dateFormat = "yyyy-MM-dd"
    let weekday: String? = input.date(from: iso).map { date in
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_US_POSIX")
        out.dateFormat = "EEEE"
        return out.string(from: date)
    }

    let initials = invitation.coupleNames
        .components(separatedBy: "&")
        .compactMap { $0.trimmingCharacters(in: .whitespaces).first.map(String.init)?.uppercased() }
        .joined(separator: " ")

    return IvoryInvitationData(
        coupleNames: invitation.coupleNames,
        monogram: monogram ?? initials,
        message: (message?.isEmpty == false ? message : nil)
            ?? "Request the pleasure of your company as we celebrate our marriage.",
        weekdayLabel: weekday,
        dayLabel: parts.count > 2 ? Int(parts[2]).map(String.init) : nil,
        monthLabel: monthIndex.flatMap { $0 >= 0 && $0 < months.count ? months[$0] : nil },
        yearLabel: parts.first,
        venue: invitation.venueName,
        venueAddress: venueAddress != invitation.venueName ? venueAddress : nil,
        venueCityCountry: invitation.venueCity,
        tagline: tagline,
        guestName: invitation.guestName,
        rsvpDeadlineLabel: rsvpDeadlineLabel
    )
}

/// Maps RSVP state onto what the invitation offers.
///
/// It changes the card's ACTIONS and its status line. It never changes which card is shown, and it
/// never asks an answered guest again.
public func ivoryRsvpState(from status: RSVPStatus) -> IvoryRsvpState {
    switch status {
    case .pending:
        return IvoryRsvpState(answer: .awaiting, statusLabel: nil, offersPass: false)
    case .attending:
        return IvoryRsvpState(answer: .attending, statusLabel: "RSVP confirmed", offersPass: true)
    // A declined guest keeps the invitation and the wedding's public content, but never a pass.
    case .declined:
        return IvoryRsvpState(answer: .declined,
                              statusLabel: "Response recorded — not attending", offersPass: false)
    }
}
