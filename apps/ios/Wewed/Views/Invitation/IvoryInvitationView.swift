import SwiftUI

/// Premium native Ivory Floral Gold invitation experience.
/// Ceremonial opening sequence transitioning seamlessly into the Wewed Wedding Pass.
public struct IvoryInvitationView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    public let invitation: InvitationContext
    public let allowsClose: Bool
    public let onRsvpConfirmed: (WeddingPass) -> Void
    public let onRsvpDeclined: () -> Void

    @State private var isRevealed: Bool = false
    @State private var rsvpSubmitted: Bool = false
    @State private var isSubmitting: Bool = false
    @State private var generatedPass: WeddingPass? = nil
    @State private var declined: Bool = false

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
                // Background Stage
                Color(red: 0.09, green: 0.07, blue: 0.06) // #17130F Stage backdrop
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        Spacer().frame(height: 20)

                        if !isRevealed {
                            closedEnvelopeCard
                        } else {
                            unfoldedInvitationCard
                        }

                        Spacer().frame(height: 40)
                    }
                    .padding(.horizontal, 20)
                }
            }
            .navigationTitle("Wedding Invitation")
            .accessibilityIdentifier("ivory-invitation-root")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                if allowsClose {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close") { dismiss() }
                            .foregroundColor(WewedColors.gold)
                    }
                }
            }
        }
    }

    // MARK: - Closed Ceremonial Envelope
    private var closedEnvelopeCard: some View {
        VStack(spacing: 20) {
            ZStack {
                // Outer Stationery Envelope
                RoundedRectangle(cornerRadius: WewedRadius.lg)
                    .fill(Color(red: 0.98, green: 0.96, blue: 0.91)) // #FBF5E9 Ivory paper
                    .overlay(
                        RoundedRectangle(cornerRadius: WewedRadius.lg)
                            .stroke(WewedColors.gold.opacity(0.4), lineWidth: 1.5)
                    )
                    .shadow(color: Color.black.opacity(0.35), radius: 16, x: 0, y: 8)

                VStack(spacing: 16) {
                    // Gold Monogram Seal
                    ZStack {
                        Circle()
                            .fill(WewedColors.gold)
                            .frame(width: 64, height: 64)
                            .shadow(color: WewedColors.gold.opacity(0.5), radius: 8, x: 0, y: 3)

                        Text(coupleInitials)
                            .font(.system(size: 20, weight: .bold, design: .serif))
                            .foregroundColor(.black)
                    }
                    .padding(.top, 40)

                    Text(invitation.coupleNames.uppercased())
                        .font(.system(size: 14, weight: .semibold, design: .serif))
                        .tracking(3)
                        .foregroundColor(Color(red: 0.26, green: 0.22, blue: 0.18)) // #42372F Ink

                    Text("A PERSONAL INVITATION FOR")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(2)
                        .foregroundColor(WewedColors.goldDark)

                    Text(invitation.guestName)
                        .font(.system(size: 22, weight: .bold, design: .serif))
                        .foregroundColor(Color(red: 0.26, green: 0.22, blue: 0.18))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)

                    Text("\(invitation.partySize) Seats Reserved in Your Honour")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Spacer().frame(height: 20)

                    Button {
                        withAnimation(.spring(response: 0.6, dampingFraction: 0.75)) {
                            isRevealed = true
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "envelope.open.fill")
                            Text("Open Invitation")
                                .fontWeight(.bold)
                        }
                        .font(.subheadline)
                        .padding(.horizontal, 28)
                        .padding(.vertical, 14)
                        .background(WewedColors.gold)
                        .foregroundColor(.black)
                        .cornerRadius(WewedRadius.pill)
                        .shadow(color: WewedColors.gold.opacity(0.4), radius: 8, x: 0, y: 3)
                    }
                    .padding(.bottom, 40)
                    .accessibilityIdentifier("ivory-invitation-open")
                }
            }
            .frame(minHeight: 440)
        }
    }

    // MARK: - Unfolded Premium Stationery
    private var unfoldedInvitationCard: some View {
        VStack(spacing: 24) {
            ZStack {
                RoundedRectangle(cornerRadius: WewedRadius.lg)
                    .fill(Color(red: 0.98, green: 0.96, blue: 0.91)) // #FBF5E9 Ivory paper
                    .overlay(
                        RoundedRectangle(cornerRadius: WewedRadius.lg)
                            .stroke(WewedColors.gold.opacity(0.5), lineWidth: 1.5)
                    )
                    .shadow(color: Color.black.opacity(0.4), radius: 20, x: 0, y: 10)

                VStack(spacing: 20) {
                    // Header flourish
                    VStack(spacing: 6) {
                        Text("TOGETHER WITH THEIR FAMILIES")
                            .font(.system(size: 11, weight: .bold))
                            .tracking(2.5)
                            .foregroundColor(WewedColors.goldDark)

                        Text(invitation.coupleNames)
                            .font(.system(size: 32, weight: .bold, design: .serif))
                            .foregroundColor(Color(red: 0.26, green: 0.22, blue: 0.18))
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 36)

                    Divider()
                        .frame(width: 80)
                        .overlay(WewedColors.gold)

                    Text("REQUEST THE PLEASURE OF YOUR COMPANY\nTO CELEBRATE THEIR MARRIAGE")
                        .font(.system(size: 11, weight: .medium))
                        .tracking(1.8)
                        .multilineTextAlignment(.center)
                        .foregroundColor(Color(red: 0.48, green: 0.43, blue: 0.38))
                        .lineSpacing(4)

                    // Event Details Card
                    VStack(spacing: 12) {
                        HStack(spacing: 10) {
                            Image(systemName: "calendar")
                                .foregroundColor(WewedColors.gold)
                            Text(invitation.weddingDate)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundColor(Color(red: 0.26, green: 0.22, blue: 0.18))
                        }

                        HStack(spacing: 10) {
                            Image(systemName: "clock")
                                .foregroundColor(WewedColors.gold)
                            Text("Ceremony at 14:00 (Doors open 13:15)")
                                .font(.subheadline)
                                .foregroundColor(Color(red: 0.26, green: 0.22, blue: 0.18))
                        }

                        HStack(spacing: 10) {
                            Image(systemName: "mappin.and.ellipse")
                                .foregroundColor(WewedColors.gold)
                            Text("\(invitation.venueName) • \(invitation.venueCity)")
                                .font(.subheadline)
                                .foregroundColor(Color(red: 0.26, green: 0.22, blue: 0.18))
                        }
                    }
                    .padding()
                    .background(Color.white.opacity(0.7))
                    .cornerRadius(WewedRadius.md)
                    .padding(.horizontal, 24)

                    // RSVP Section
                    if !rsvpSubmitted && !declined {
                        VStack(spacing: 14) {
                            Text("Kindly respond to continue your wedding experience")
                                .font(.caption)
                                .foregroundColor(.secondary)

                            Button {
                                submitRsvp(attending: true)
                            } label: {
                                HStack {
                                    if isSubmitting {
                                        ProgressView().tint(.black)
                                    } else {
                                        Image(systemName: "checkmark.circle.fill")
                                        Text("Accept with Pleasure")
                                            .fontWeight(.bold)
                                    }
                                }
                                .font(.subheadline)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(WewedColors.gold)
                                .foregroundColor(.black)
                                .cornerRadius(WewedRadius.pill)
                            }
                            .disabled(isSubmitting)
                            .accessibilityIdentifier("ivory-rsvp-accept")

                            Button {
                                submitRsvp(attending: false)
                            } label: {
                                Text("Decline with Regret")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .foregroundColor(Color(red: 0.26, green: 0.22, blue: 0.18))
                                    .background(Color.white.opacity(0.72))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: WewedRadius.pill)
                                            .stroke(WewedColors.gold.opacity(0.45), lineWidth: 1)
                                    )
                                    .cornerRadius(WewedRadius.pill)
                            }
                            .disabled(isSubmitting)
                            .accessibilityIdentifier("ivory-rsvp-decline")
                        }
                        .padding(.horizontal, 24)
                        .padding(.bottom, 36)
                    } else if declined {
                        VStack(spacing: 12) {
                            Image(systemName: "heart")
                                .foregroundColor(WewedColors.gold)
                            Text("Response Recorded")
                                .font(.headline)
                                .fontWeight(.bold)
                                .foregroundColor(Color(red: 0.26, green: 0.22, blue: 0.18))
                            Text("Thank you for letting \(invitation.coupleNames)'s wedding team know. No admission pass is issued for a declined RSVP.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.horizontal, 24)
                        .padding(.bottom, 36)
                    } else {
                        // Confirmed State
                        VStack(spacing: 16) {
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.seal.fill")
                                    .foregroundColor(WewedColors.success)
                                Text("RSVP Confirmed")
                                    .font(.headline)
                                    .fontWeight(.bold)
                                    .foregroundColor(WewedColors.success)
                            }

                            Text("We are thrilled to celebrate with you!")
                                .font(.subheadline)
                                .foregroundColor(Color(red: 0.26, green: 0.22, blue: 0.18))

                            if let p = generatedPass {
                                Button {
                                    onRsvpConfirmed(p)
                                    if allowsClose {
                                        dismiss()
                                    }
                                } label: {
                                    HStack(spacing: 8) {
                                        Image(systemName: "qrcode")
                                        Text("View My Wedding Pass")
                                            .fontWeight(.bold)
                                    }
                                    .font(.headline)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 14)
                                    .background(WewedColors.gold)
                                    .foregroundColor(.black)
                                    .cornerRadius(WewedRadius.pill)
                                    .shadow(color: WewedColors.gold.opacity(0.4), radius: 8, x: 0, y: 3)
                                }
                                .padding(.horizontal, 24)
                                .accessibilityIdentifier("ivory-view-wedding-pass")
                            }
                        }
                        .padding(.bottom, 36)
                    }
                }
            }
        }
    }

    private var coupleInitials: String {
        invitation.coupleNames
            .components(separatedBy: "&")
            .compactMap { part in
                part.trimmingCharacters(in: .whitespacesAndNewlines).first.map(String.init)
            }
            .joined(separator: "&")
            .uppercased()
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
                isSubmitting = false
            } catch {
                isSubmitting = false
            }
        }
    }
}
