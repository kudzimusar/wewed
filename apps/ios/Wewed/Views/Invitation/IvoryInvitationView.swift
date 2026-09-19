import SwiftUI

/// The ivory floral gold invitation.
/// - `.guest`: the guest's own invitation; Accept and Decline call `respond`, which the guest shell binds
///   to `RoleScopedAccess.respondToOwnInvitation`.
/// - `.preview`: what the couple's guests see. Nothing is sent and no guest record changes.
public struct IvoryInvitationView: View {
    public enum Mode: Equatable { case guest, preview }

    private enum Reply { case none, accepted, declined }

    @Environment(\.dismiss) private var dismiss

    public let invitation: InvitationContext
    public let mode: Mode
    private let fallbackVenue: VenueLocation?
    private let allowsClose: Bool
    private let respond: ((Bool) async throws -> Void)?
    private let onViewPass: (() -> Void)?

    @State private var showDetails = false
    @State private var reply: Reply
    @State private var isSubmitting = false
    @State private var errorText: String?
    @State private var previewTapped = false

    @ScaledMetric(relativeTo: .title) private var namesSize: CGFloat = 29
    @ScaledMetric(relativeTo: .title2) private var dateSize: CGFloat = 23

    public init(
        invitation: InvitationContext,
        mode: Mode,
        fallbackVenue: VenueLocation? = nil,
        allowsClose: Bool = true,
        respond: ((Bool) async throws -> Void)? = nil,
        onViewPass: (() -> Void)? = nil
    ) {
        self.invitation = invitation
        self.mode = mode
        self.fallbackVenue = fallbackVenue
        self.allowsClose = allowsClose
        self.respond = respond
        self.onViewPass = onViewPass
        _reply = State(initialValue: mode == .guest && invitation.isConfirmed ? .accepted : .none)
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                WeddingFloralBackground(opacity: 0.07)
                    .accessibilityHidden(true)

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 18) {
                        invitationHeader
                        if mode == .preview {
                            previewNotice
                        }
                        invitationCard
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 30)
                }
            }
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("ivory-invitation-root")
    }

    private var invitationHeader: some View {
        ZStack {
            Text("You’re Invited")
                .font(.system(.title3, design: .serif).weight(.semibold))
                .foregroundStyle(WeddingIdentityPalette.ink)
                .accessibilityAddTraits(.isHeader)

            if allowsClose {
                HStack {
                    Button {
                        dismiss()
                    } label: {
                        Label("Close", systemImage: "chevron.left")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(WeddingIdentityPalette.ink)
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("invitation-close")
                    Spacer()
                }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var previewNotice: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "eye")
                .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                .accessibilityHidden(true)
            Text("This is how your guests see their invitation. Guests reply from their own invitation.")
                .font(.callout)
                .foregroundStyle(WeddingIdentityPalette.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(WeddingIdentityPalette.champagne.opacity(0.16), in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("invitation-preview-notice")
    }

    private var invitationCard: some View {
        ZStack {
            Image("ornament-frame", bundle: .module)
                .resizable()
                .scaledToFill()
                .opacity(0.15)
                .accessibilityHidden(true)

            VStack(spacing: 14) {
                WeddingMonogram(names: invitation.coupleNames, size: 54)

                Text(invitation.coupleNames)
                    .font(.system(size: namesSize, weight: .regular, design: .serif))
                    .italic()
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .multilineTextAlignment(.center)

                Text("TOGETHER WITH OUR FAMILIES\nWE INVITE YOU TO CELEBRATE\nOUR WEDDING")
                    .font(.caption.weight(.semibold))
                    .tracking(1.5)
                    .foregroundStyle(WeddingIdentityPalette.ink.opacity(0.86))
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)

                Rectangle()
                    .fill(WeddingIdentityPalette.champagne)
                    .frame(width: 72, height: 1)
                    .accessibilityHidden(true)

                Text(WeddingDateText.short(invitation.weddingDate).uppercased())
                    .font(.system(size: dateSize, weight: .medium, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                    .accessibilityLabel(WeddingDateText.long(invitation.weddingDate))

                Text(invitation.venueCity.uppercased())
                    .font(.caption.weight(.medium))
                    .tracking(1.8)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .multilineTextAlignment(.center)

                VStack(spacing: 3) {
                    Text("Invitation for")
                        .font(.footnote)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                    Text(invitation.guestName)
                        .font(.system(.headline, design: .serif))
                        .foregroundStyle(WeddingIdentityPalette.ink)
                        .multilineTextAlignment(.center)
                        .accessibilityIdentifier("invitation-guest-name")
                    Text("Party of \(invitation.partySize)")
                        .font(.footnote)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                }
                .padding(.top, 2)

                if showDetails {
                    details
                }

                responseArea
                    .padding(.top, 4)
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 32)
        }
        .frame(maxWidth: .infinity)
        .background(WeddingIdentityPalette.ivorySoft)
        .overlay(
            RoundedRectangle(cornerRadius: 24)
                .stroke(WeddingIdentityPalette.champagne.opacity(0.70), lineWidth: 1.2)
        )
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(color: Color.black.opacity(0.06), radius: 14, x: 0, y: 5)
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(invitation.venueName, systemImage: "mappin.and.ellipse")
            Label(WeddingDateText.longWithTime(invitation.weddingDate), systemImage: "calendar")
            OpenInMapsButton(venue: invitation.venue ?? fallbackVenue, identifier: "invitation-open-maps")
        }
        .font(.body)
        .foregroundStyle(WeddingIdentityPalette.ink)
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("invitation-details")
    }

    private var responseArea: some View {
        VStack(spacing: 10) {
            switch reply {
            case .accepted:
                acceptedCard
            case .declined:
                declinedCard
            case .none:
                replyButtons
            }

            detailsToggle

            if let errorText {
                Text(errorText)
                    .font(.callout)
                    .foregroundStyle(Color(red: 0.61, green: 0.11, blue: 0.11))
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("ivory-rsvp-error")
            }
            if previewTapped {
                Text("This is a preview. No reply was sent.")
                    .font(.callout)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("invitation-preview-rsvp-note")
            }
        }
    }

    private var replyButtons: some View {
        VStack(spacing: 10) {
            Button {
                submit(attending: true)
            } label: {
                HStack {
                    if isSubmitting {
                        ProgressView().tint(.white)
                    } else {
                        Text("Accept")
                    }
                }
                .font(.body.weight(.semibold))
                .frame(maxWidth: .infinity, minHeight: 50)
                .foregroundStyle(.white)
                .background(
                    LinearGradient(
                        colors: [WeddingIdentityPalette.champagneDeep, WeddingIdentityPalette.champagne],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    in: RoundedRectangle(cornerRadius: 13)
                )
            }
            .disabled(isSubmitting)
            .buttonStyle(.plain)
            .accessibilityLabel("Accept invitation")
            .accessibilityIdentifier("ivory-rsvp-accept")

            Button {
                submit(attending: false)
            } label: {
                Text("Decline")
            }
            .buttonStyle(WeddingActionButtonStyle(.secondary))
            .disabled(isSubmitting)
            .accessibilityLabel("Decline invitation")
            .accessibilityIdentifier("ivory-rsvp-decline")
        }
    }

    private var detailsToggle: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                showDetails.toggle()
            }
        } label: {
            Text(showDetails ? "Hide details" : "View details")
        }
        .buttonStyle(WeddingActionButtonStyle(.quiet))
        .accessibilityIdentifier("ivory-details-toggle")
    }

    private var acceptedCard: some View {
        WeddingSectionCard {
            VStack(spacing: 12) {
                StatusText("You are attending", systemImage: "checkmark.seal.fill", tone: .positive)
                    .accessibilityIdentifier("ivory-rsvp-accepted")
                if let onViewPass {
                    Button(action: onViewPass) {
                        Label("View my pass", systemImage: "qrcode")
                    }
                    .buttonStyle(WeddingActionButtonStyle(.primary))
                    .accessibilityIdentifier("ivory-view-wedding-pass")
                }
                Button("Change my reply") {
                    reply = .none
                }
                .buttonStyle(WeddingActionButtonStyle(.quiet))
                .accessibilityIdentifier("ivory-change-reply")
            }
            .frame(maxWidth: .infinity)
        }
    }

    private var declinedCard: some View {
        WeddingSectionCard {
            VStack(spacing: 10) {
                StatusText("You have declined", systemImage: "heart", tone: .neutral)
                    .accessibilityIdentifier("ivory-rsvp-declined")
                Text("Thank you for letting the couple know. A pass is only issued to guests who accept.")
                    .font(.subheadline)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Change my reply") {
                    reply = .none
                }
                .buttonStyle(WeddingActionButtonStyle(.quiet))
                .accessibilityIdentifier("ivory-change-reply")
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func submit(attending: Bool) {
        errorText = nil
        guard mode == .guest, let respond else {
            // Preview: nothing is sent and no guest record changes.
            previewTapped = true
            return
        }
        isSubmitting = true
        Task {
            do {
                try await respond(attending)
                reply = attending ? .accepted : .declined
            } catch {
                errorText = "Your reply couldn't be sent. Please try again."
            }
            isSubmitting = false
        }
    }
}
