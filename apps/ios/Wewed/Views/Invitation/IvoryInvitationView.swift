import SwiftUI

/// Premium native Ivory Floral Gold invitation experience.
/// In Shadow/UAT this is driven by the real wedding graph while RSVP/pass credentials remain Shadow-only.
public struct IvoryInvitationView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    public let invitation: InvitationContext
    public let allowsClose: Bool
    public let onRsvpConfirmed: (WeddingPass) -> Void
    public let onRsvpDeclined: () -> Void

    @State private var showDetails = false
    @State private var rsvpSubmitted = false
    @State private var declined = false
    @State private var isSubmitting = false
    @State private var generatedPass: WeddingPass?

    public init(
        invitation: InvitationContext,
        allowsClose: Bool = true,
        onRsvpConfirmed: @escaping (WeddingPass) -> Void,
        onRsvpDeclined: @escaping () -> Void = {}
    ) {
        self.invitation = invitation
        self.allowsClose = allowsClose
        self.onRsvpConfirmed = onRsvpConfirmed
        self.onRsvpDeclined = onRsvpDeclined
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                WeddingFloralBackground(opacity: 0.14)

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 18) {
                        invitationCard
                        responseArea
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 30)
                }
            }
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .overlay(alignment: .topLeading) {
                if allowsClose {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(WeddingIdentityPalette.ink)
                            .frame(width: 42, height: 42)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                    }
                    .padding(.leading, 12)
                    .padding(.top, 8)
                    .accessibilityLabel("Close invitation")
                }
            }
        }
        .accessibilityIdentifier("ivory-invitation-root")
    }

    private var invitationCard: some View {
        ZStack {
            Image("ornament-frame", bundle: .module)
                .resizable()
                .scaledToFill()
                .opacity(0.42)

            VStack(spacing: 14) {
                Text("You’re Invited")
                    .font(.system(size: 18, weight: .semibold, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)

                WeddingMonogram(names: invitation.coupleNames, size: 54)

                Text(invitation.coupleNames)
                    .font(.system(size: 29, weight: .regular, design: .serif))
                    .italic()
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .multilineTextAlignment(.center)

                Text("TOGETHER WITH OUR FAMILIES\nWE INVITE YOU TO CELEBRATE\nOUR WEDDING")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(1.5)
                    .foregroundStyle(WeddingIdentityPalette.ink.opacity(0.86))
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)

                Rectangle()
                    .fill(WeddingIdentityPalette.champagne)
                    .frame(width: 72, height: 1)

                Text(displayDate(invitation.weddingDate))
                    .font(.system(size: 23, weight: .medium, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)

                Text(invitation.venueCity.uppercased())
                    .font(.system(size: 10, weight: .medium))
                    .tracking(1.8)
                    .foregroundStyle(WeddingIdentityPalette.muted)

                Text("For \(invitation.guestName) • Party of \(invitation.partySize)")
                    .font(.system(size: 11))
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .padding(.top, 2)

                if showDetails {
                    VStack(spacing: 8) {
                        Label(invitation.venueName, systemImage: "mappin.and.ellipse")
                        Label(invitation.weddingDate, systemImage: "calendar")
                    }
                    .font(.system(size: 12))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .padding(12)
                    .frame(maxWidth: .infinity)
                    .background(.white.opacity(0.72))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 34)
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

    @ViewBuilder
    private var responseArea: some View {
        if declined {
            WeddingSectionCard {
                VStack(spacing: 8) {
                    Image(systemName: "heart")
                        .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                    Text("Response Recorded")
                        .font(.headline)
                        .foregroundStyle(WeddingIdentityPalette.ink)
                    Text("Thank you for letting the wedding team know.")
                        .font(.subheadline)
                        .foregroundStyle(WeddingIdentityPalette.muted)
                }
                .frame(maxWidth: .infinity)
            }
        } else if rsvpSubmitted, let generatedPass {
            WeddingSectionCard {
                VStack(spacing: 12) {
                    Label("RSVP Confirmed", systemImage: "checkmark.seal.fill")
                        .font(.headline)
                        .foregroundStyle(WeddingIdentityPalette.forest)

                    Button {
                        onRsvpConfirmed(generatedPass)
                        if allowsClose { dismiss() }
                    } label: {
                        WeddingPrimaryButtonLabel("View My Wedding Pass", icon: "qrcode")
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("ivory-view-wedding-pass")
                }
            }
        } else {
            VStack(spacing: 10) {
                Button {
                    submitRsvp(attending: true)
                } label: {
                    HStack {
                        if isSubmitting {
                            ProgressView().tint(.white)
                        } else {
                            Text("RSVP Now")
                                .fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(.white)
                    .background(
                        LinearGradient(
                            colors: [WeddingIdentityPalette.champagneDeep, WeddingIdentityPalette.champagne],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 13))
                }
                .disabled(isSubmitting)
                .buttonStyle(.plain)
                .accessibilityIdentifier("ivory-rsvp-accept")

                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        showDetails.toggle()
                    }
                } label: {
                    Text(showDetails ? "Hide Details" : "View Details")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(WeddingIdentityPalette.ink)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 13)
                                .stroke(WeddingIdentityPalette.champagne, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)

                Button {
                    submitRsvp(attending: false)
                } label: {
                    Text("Decline with Regret")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                        .padding(.vertical, 7)
                }
                .disabled(isSubmitting)
                .accessibilityIdentifier("ivory-rsvp-decline")
            }
        }
    }

    private func submitRsvp(attending: Bool) {
        isSubmitting = true
        Task {
            do {
                let pass = try await appState.repository.confirmRsvp(
                    weddingSlug: invitation.weddingSlug,
                    token: invitation.guestToken,
                    attending: attending
                )
                if attending {
                    generatedPass = pass
                    rsvpSubmitted = true
                    declined = false
                } else {
                    generatedPass = nil
                    rsvpSubmitted = false
                    declined = true
                    onRsvpDeclined()
                }
            } catch {
                // Preserve the existing interaction contract: failed RSVP leaves the card actionable.
            }
            isSubmitting = false
        }
    }

    private func displayDate(_ raw: String) -> String {
        let input = DateFormatter()
        input.locale = Locale(identifier: "en_US_POSIX")
        input.dateFormat = "yyyy-MM-dd HH:mm:ss"
        guard let date = input.date(from: raw) else { return raw }

        let output = DateFormatter()
        output.locale = Locale(identifier: "en_US_POSIX")
        output.dateFormat = "dd MMM yyyy"
        return output.string(from: date).uppercased()
    }
}
