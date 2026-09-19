import SwiftUI

/// The ivory wedding pass card. Every value comes from the WeddingPass record.
public struct WeddingPassCard: View {
    let pass: WeddingPass
    let fallbackVenue: VenueLocation?

    @ScaledMetric(relativeTo: .title2) private var coupleSize: CGFloat = 22
    @ScaledMetric(relativeTo: .title3) private var guestSize: CGFloat = 20

    public init(pass: WeddingPass, fallbackVenue: VenueLocation? = nil) {
        self.pass = pass
        self.fallbackVenue = fallbackVenue
    }

    private var stageText: String {
        switch pass.currentStage {
        case .checkedIn: return "Admitted"
        case .invitation: return "Not attending"
        case .after: return "Attended"
        case .attending, .preWedding, .morning: return "Attending"
        }
    }

    public var body: some View {
        ZStack {
            Image("ornament-frame", bundle: .module)
                .resizable()
                .scaledToFill()
                .opacity(0.12)
                .accessibilityHidden(true)

            VStack(spacing: 12) {
                WeddingMonogram(names: pass.coupleNames, size: 42)

                Text(pass.coupleNames)
                    .font(.system(size: coupleSize, weight: .regular, design: .serif))
                    .italic()
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                    .multilineTextAlignment(.center)

                Text(pass.guestName)
                    .font(.system(size: guestSize, weight: .semibold, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("guest-pass-guest-name")

                Text(stageText)
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 5)
                    .background(pass.currentStage == .invitation ? WeddingIdentityPalette.muted : WeddingIdentityPalette.forest, in: Capsule())
                    .accessibilityLabel("Status: \(stageText)")
                    .accessibilityIdentifier("pass-status")

                Text("Party of \(pass.partySize)")
                    .font(.subheadline)
                    .foregroundStyle(WeddingIdentityPalette.muted)

                ZStack {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(.white)
                        .frame(width: 174, height: 174)
                    WeddingQRCodeView(payload: pass.qrPayload, size: 146)
                }

                Text("Show this code at the entrance")
                    .font(.footnote)
                    .foregroundStyle(WeddingIdentityPalette.muted)

                Text("WEWED WEDDING PASS")
                    .font(.caption2.weight(.semibold))
                    .tracking(1.3)
                    .foregroundStyle(WeddingIdentityPalette.muted)

                if let table = pass.tableName, !table.isEmpty {
                    Label("Table: \(table)", systemImage: "table.furniture")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(WeddingIdentityPalette.forest)
                        .accessibilityIdentifier("pass-table")
                }

                Text(pass.venueName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .multilineTextAlignment(.center)

                Text(WeddingDateText.longWithTime(pass.weddingDate))
                    .font(.subheadline)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .multilineTextAlignment(.center)

                OpenInMapsButton(venue: pass.venue ?? fallbackVenue, identifier: "pass-open-maps")
            }
            .padding(22)
        }
        .background(WeddingIdentityPalette.ivorySoft)
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(WeddingIdentityPalette.champagne.opacity(0.7), lineWidth: 1.2)
        )
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .shadow(color: Color.black.opacity(0.06), radius: 14, x: 0, y: 5)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("wedding-pass-card")
    }
}

/// Couple "Pass" tab: a preview of an attending guest's pass (previewGuestPasses) and the gate scanner.
public struct WeddingReferencePassView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var session: SessionStore
    @State private var pass: WeddingPass?
    @State private var wedding: Wedding?
    @State private var isLoading = true
    @State private var gate: GateModel?

    public init() {}

    private var access: RoleScopedAccess? {
        session.activeGrant.map { appState.access(for: $0) }
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                WeddingFloralBackground(opacity: 0.055)
                    .accessibilityHidden(true)

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 18) {
                        header
                        if let pass {
                            Text("Preview of an attending guest's pass")
                                .font(.subheadline)
                                .foregroundStyle(WeddingIdentityPalette.muted)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .accessibilityIdentifier("pass-preview-caption")
                            WeddingPassCard(pass: pass, fallbackVenue: wedding?.venueLocation)
                        } else if isLoading {
                            ProgressView("Loading pass…")
                                .padding(.top, 120)
                        } else {
                            EmptyStateText(
                                "No guest has accepted yet, so there is no pass to preview.",
                                identifier: "pass-unavailable"
                            )
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .padding(.bottom, 30)
                }
            }
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .sheet(isPresented: Binding(get: { gate != nil }, set: { if !$0 { gate = nil } })) {
                if let gate {
                    UsherScannerView(model: gate) { self.gate = nil }
                }
            }
            .task { await load() }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("pass-root")
    }

    private var header: some View {
        ViewThatFits(in: .horizontal) {
            HStack {
                title
                Spacer()
                scanButton
            }
            VStack(alignment: .leading, spacing: 10) {
                title
                scanButton
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var title: some View {
        Text("Wedding Pass")
            .font(.system(.title2, design: .serif).weight(.semibold))
            .foregroundStyle(WeddingIdentityPalette.ink)
            .accessibilityAddTraits(.isHeader)
    }

    @ViewBuilder
    private var scanButton: some View {
        if let access, access.can(.scanAdmission) {
            Button {
                gate = GateModel(access: access, operatorId: "\(access.grant.role.roleId):\(access.grant.weddingId)")
            } label: {
                Label("Scan pass", systemImage: "qrcode.viewfinder")
            }
            .buttonStyle(WeddingActionButtonStyle(.secondary, fullWidth: false))
            .accessibilityIdentifier("pass-open-scanner")
        }
    }

    private func load() async {
        defer { isLoading = false }
        guard let access else { return }
        wedding = try? await access.weddingSummary()
        guard access.can(.previewGuestPasses),
              let guest = try? await access.guestRoster().first(where: { $0.rsvpStatus == .attending }) else {
            pass = nil
            return
        }
        pass = try? await access.previewGuestPass(token: guest.id)
    }
}
