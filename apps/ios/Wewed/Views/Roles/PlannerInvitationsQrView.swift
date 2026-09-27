import SwiftUI

/// QRO05-PIQR01 — production Planner → More → Invitations & QR.
///
/// Three distinct sections read from the same canonical server projections as the desktop Planner:
/// Invitation design, Printed Invitation Access (one shared QR for the printed card) and Guest Open
/// Invitations (each Guest's own private link). Read-only: no issue, rotate, style or QR-create
/// control exists here.
///
/// The loaded snapshot lives only in this view's `@State` — it is fetched when the Planner opens
/// this screen and dropped when they leave it. Private links are never rendered as text or put in an
/// accessibility label; they reach the screen only as a QR image or the system share sheet.
public struct PlannerInvitationsQrView: View {
    private let load: () async -> PlannerInvitationsLoad
    @State private var state: PlannerInvitationsLoad?
    @State private var qrGuest: PlannerGuestInvitation?

    public init(load: @escaping () async -> PlannerInvitationsLoad) {
        self.load = load
    }

    public var body: some View {
        Group {
            switch state {
            case nil:
                IASectionList("Invitations & QR", "Loading invitations…") {
                    ProgressView().frame(maxWidth: .infinity)
                }
                .accessibilityIdentifier("planner-invitations-loading")
            case let .unavailable(reason):
                IASectionList("Invitations & QR") {
                    IACard("Invitations are unavailable", reason, testId: "planner-invitations-unavailable")
                    Button("Try again") { Task { state = nil; state = await load() } }
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(WeddingIdentityPalette.forest)
                        .accessibilityIdentifier("planner-invitations-retry")
                }
            case let .loaded(snapshot):
                loaded(snapshot)
            }
        }
        .task { state = await load() }
        .sheet(item: $qrGuest) { guest in
            GuestInvitationQrSheet(guest: guest) { qrGuest = nil }
        }
    }

    @ViewBuilder
    private func loaded(_ snapshot: PlannerInvitationsSnapshot) -> some View {
        IASectionList("Invitations & QR", "Read from Wewed. Edit the design and printed code on the web.") {
            designSection(snapshot.design)
            physicalSection(snapshot.physical, weddingTitle: snapshot.design.weddingTitle)
            guestSection(snapshot)
        }
        .accessibilityIdentifier("planner-invitations-qr")
    }

    // MARK: Invitation design

    private func designSection(_ design: PlannerInvitationDesign) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionHeading("Invitation design")
            IACard("Card style", design.styleLabel, testId: "planner-invitation-style")
            if let message = design.message {
                IACard("Invitation message", message, testId: "planner-invitation-message")
            }
            IACard("RSVP deadline", design.rsvpDeadline.map(Self.formatDate) ?? "No deadline set",
                   testId: "planner-invitation-rsvp-deadline")
            IACard("Children", design.childrenPolicyLabel, testId: "planner-invitation-children-policy")
        }
    }

    // MARK: Printed Invitation Access

    @ViewBuilder
    private func physicalSection(_ physical: PlannerPhysicalInvitation, weddingTitle: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionHeading("Printed Invitation Access")
            if physical.configured, let accessUrl = physical.accessUrl {
                VStack(spacing: 10) {
                    WewedQRCodeView(
                        payload: accessUrl,
                        size: 180,
                        accessibilityLabel: "Printed invitation QR code",
                        accessibilityIdentifier: "planner-physical-invitation-qr"
                    )
                    if let code = physical.code {
                        Text("Shared fallback code \(code)")
                            .font(.system(size: 13, weight: .semibold, design: .monospaced))
                            .foregroundColor(WeddingIdentityPalette.ink)
                            .accessibilityIdentifier("planner-physical-invitation-code")
                    }
                    Text("Configured · \(physical.invitedCount) guests listed · \(physical.scanCount) opens")
                        .font(.system(size: 12))
                        .foregroundColor(WeddingIdentityPalette.muted)
                        .accessibilityIdentifier("planner-physical-invitation-status")
                    if let url = URL(string: accessUrl) {
                        ShareLink(item: url, subject: Text(weddingTitle),
                                  message: Text("Printed invitation access for \(weddingTitle)")) {
                            Label("Share printed invitation link", systemImage: "square.and.arrow.up")
                                .font(.system(size: 13, weight: .semibold))
                        }
                        .accessibilityIdentifier("planner-physical-invitation-share")
                    }
                    Text("One shared QR for every printed card. It opens the invitation; it is not a Wedding Pass.")
                        .font(.system(size: 11))
                        .foregroundColor(WeddingIdentityPalette.muted)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(12)
                .background(WeddingIdentityPalette.ivorySoft)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                IACard("Not configured",
                       "No printed-invitation QR exists yet. Create it in Wewed on the web before printing.",
                       trailing: "\(physical.invitedCount) guests",
                       testId: "planner-physical-invitation-unconfigured")
            }
        }
    }

    // MARK: Guest Open Invitations

    private func guestSection(_ snapshot: PlannerInvitationsSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            sectionHeading("Guest Open Invitations")
            Text(guestSummary(snapshot))
                .font(.system(size: 12))
                .foregroundColor(WeddingIdentityPalette.muted)
                .accessibilityIdentifier("planner-guest-invitations-summary")
            if snapshot.guests.isEmpty {
                IACard("No guests yet", "Add guests in Wewed to send them their own invitation.",
                       testId: "planner-guest-invitations-empty")
            }
            ForEach(snapshot.guests) { guest in
                GuestInvitationRow(guest: guest, weddingTitle: snapshot.design.weddingTitle) { qrGuest = guest }
            }
        }
    }

    private func guestSummary(_ snapshot: PlannerInvitationsSnapshot) -> String {
        let base = "\(snapshot.guests.count) guests, each with their own private invitation."
        return snapshot.missingLinks > 0
            ? base + " \(snapshot.missingLinks) without a link yet — issue links from Wewed on the web."
            : base
    }

    private func sectionHeading(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 15, weight: .semibold, design: .serif))
            .foregroundColor(WeddingIdentityPalette.ink)
            .padding(.top, 8)
            .accessibilityAddTraits(.isHeader)
    }

    static func formatDate(_ iso: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return iso }
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .none
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter.string(from: date)
    }
}

private struct GuestInvitationRow: View {
    let guest: PlannerGuestInvitation
    let weddingTitle: String
    let onShowQr: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(guest.name)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(WeddingIdentityPalette.ink)
                    Text(guest.tableLabel)
                        .font(.system(size: 11))
                        .foregroundColor(WeddingIdentityPalette.muted)
                }
                Spacer()
                Text(guest.status.label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(WeddingIdentityPalette.forest)
                    .accessibilityIdentifier("planner-guest-invitation-status-\(guest.id)")
            }
            if guest.hasInvitationLink {
                HStack(spacing: 16) {
                    Button(action: onShowQr) {
                        Label("Show QR", systemImage: "qrcode")
                    }
                    .accessibilityLabel("Show invitation QR for \(guest.name)")
                    .accessibilityIdentifier("planner-guest-invitation-show-qr-\(guest.id)")
                    if let message = guest.shareMessage {
                        ShareLink(item: message, subject: Text(weddingTitle)) {
                            Label("Share Invitation", systemImage: "square.and.arrow.up")
                        }
                        .accessibilityLabel("Share invitation with \(guest.name)")
                        .accessibilityIdentifier("planner-guest-invitation-share-\(guest.id)")
                    }
                }
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(WeddingIdentityPalette.champagneDeep)
            } else {
                Text("No invitation link yet")
                    .font(.system(size: 11))
                    .foregroundColor(WeddingIdentityPalette.muted)
                    .accessibilityIdentifier("planner-guest-invitation-missing-\(guest.id)")
            }
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(WeddingIdentityPalette.ivorySoft)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(WeddingIdentityPalette.hairline, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("planner-guest-invitation-\(guest.id)")
    }
}

private struct GuestInvitationQrSheet: View {
    let guest: PlannerGuestInvitation
    let onDone: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text(guest.name)
                .font(.system(size: 20, weight: .semibold, design: .serif))
                .foregroundColor(WeddingIdentityPalette.ink)
                .accessibilityIdentifier("planner-guest-invitation-qr-name")
            if let value = guest.qrValue {
                WewedQRCodeView(
                    payload: value,
                    size: 240,
                    accessibilityLabel: "Invitation QR code for \(guest.name)",
                    accessibilityIdentifier: "planner-guest-invitation-qr"
                )
            }
            Text("\(guest.name)'s own invitation. It opens their RSVP; it is not a Wedding Pass.")
                .font(.system(size: 12))
                .foregroundColor(WeddingIdentityPalette.muted)
                .multilineTextAlignment(.center)
            Button("Done", action: onDone)
                .font(.system(size: 14, weight: .semibold))
                .accessibilityIdentifier("planner-guest-invitation-qr-done")
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(WeddingIdentityPalette.ivory)
        .presentationDetents([.medium, .large])
    }
}
