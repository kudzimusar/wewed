import SwiftUI

/// NM06 width contract for the canonical Wedding Pass.
///
/// physical containing width -> one card width -> padded content -> QR/text.
/// Decoration is intentionally absent from this model because decoration never owns layout.
enum WeddingPassViewportGeometry {
    static let outerInset: CGFloat = 18
    static let cardPadding: CGFloat = 22
    static let qrPlateMaximum: CGFloat = 174
    static let qrCodeMaximum: CGFloat = 146
    static let qrPlateInnerInset: CGFloat = 14

    static func boundedViewportWidth(
        proposedWidth: CGFloat,
        publishedWidth: CGFloat?
    ) -> CGFloat {
        let proposal = max(proposedWidth, 0)
        guard let publishedWidth else { return proposal }
        return min(proposal, max(publishedWidth, 0))
    }

    static func cardWidth(viewportWidth: CGFloat) -> CGFloat {
        max(0, viewportWidth - outerInset * 2)
    }

    static func cardContentWidth(viewportWidth: CGFloat) -> CGFloat {
        max(0, cardWidth(viewportWidth: viewportWidth) - cardPadding * 2)
    }

    static func qrPlateWidth(viewportWidth: CGFloat) -> CGFloat {
        min(qrPlateMaximum, cardContentWidth(viewportWidth: viewportWidth))
    }

    static func qrCodeWidth(viewportWidth: CGFloat) -> CGFloat {
        min(
            qrCodeMaximum,
            max(0, qrPlateWidth(viewportWidth: viewportWidth) - qrPlateInnerInset * 2)
        )
    }
}

public struct WeddingReferencePassView: View {
    @Environment(\.wewedContentWidth) private var publishedContentWidth
    @EnvironmentObject private var appState: AppState
    @State private var pass: WeddingPass?
    @State private var showingScanner = false
    @State private var showingGuestDetails = false
    @State private var isLoading = true
    private let showScanner: Bool
    private let providedPass: WeddingPass?
    /// The credential of the *current authorized actor*. P0-5: there is no fallback token list —
    /// guessing an attending guest would resolve a different person than the Invitation, RSVP and
    /// Table surfaces, which is precisely the identity break this view must not reintroduce.
    private let passToken: String?

    public init(pass: WeddingPass? = nil, passToken: String? = nil, showScanner: Bool = true) {
        self.showScanner = showScanner
        self.providedPass = pass
        self.passToken = passToken
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                WeddingFloralBackground(opacity: 0.055)

                GeometryReader { proxy in
                    let viewportWidth = WeddingPassViewportGeometry.boundedViewportWidth(
                        proposedWidth: proxy.size.width,
                        publishedWidth: publishedContentWidth
                    )
                    let cardWidth = WeddingPassViewportGeometry.cardWidth(
                        viewportWidth: viewportWidth
                    )

                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(spacing: 18) {
                            if let pass {
                                header
                                passCard(pass, cardWidth: cardWidth)

                            } else if isLoading {
                                ProgressView("Loading wedding pass…")
                                    .padding(.top, 120)
                            } else {
                                ContentUnavailableView(
                                    "Wedding Pass unavailable",
                                    systemImage: "qrcode",
                                    description: Text("No Wedding Pass is issued to this account for the active wedding.")
                                )
                                .padding(.top, 80)
                            }
                        }
                        .frame(width: cardWidth)
                        .padding(.horizontal, WeddingPassViewportGeometry.outerInset)
                        .padding(.top, 12)
                        .padding(.bottom, 30)
                    }
                    .frame(width: viewportWidth, height: proxy.size.height)
                    .clipped()
                }
            }
            #if os(iOS)
            .toolbar(.hidden, for: .navigationBar)
            #endif
            .sheet(isPresented: $showingScanner) {
                UsherScannerView {
                    showingScanner = false
                }
            }
            .sheet(isPresented: $showingGuestDetails) {
                if let pass {
                    NavigationStack {
                        List {
                            Section("Guest") {
                                LabeledContent("Name", value: pass.guestName)
                                LabeledContent("Party", value: "Party of \(pass.partySize)")
                                if let table = pass.tableName {
                                    LabeledContent("Seating", value: table)
                                }
                            }
                            Section("Wedding") {
                                LabeledContent("Venue", value: pass.venueName)
                                LabeledContent("Date", value: displayDate(pass.weddingDate))
                            }
                        }
                        .navigationTitle("Guest Details")
                        .toolbar {
                            ToolbarItem(placement: .confirmationAction) {
                                Button("Done") { showingGuestDetails = false }
                            }
                        }
                    }
                }
            }
            .task { await preparePass() }
        }
        .accessibilityIdentifier("pass-root")
    }

    private var header: some View {
        ZStack {
            Text("Wedding Pass")
                .font(.system(size: 22, weight: .semibold, design: .serif))
                .foregroundStyle(WeddingIdentityPalette.ink)

            if showScanner {
            HStack {
                Spacer()
                Button {
                    showingScanner = true
                } label: {
                    Image(systemName: "qrcode.viewfinder")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(WeddingIdentityPalette.ink)
                        .frame(width: 38, height: 38)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("pass-open-scanner")
            }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func passCard(_ pass: WeddingPass, cardWidth: CGFloat) -> some View {
        let viewportWidth = cardWidth + WeddingPassViewportGeometry.outerInset * 2
        let qrPlateWidth = WeddingPassViewportGeometry.qrPlateWidth(viewportWidth: viewportWidth)
        let qrCodeWidth = WeddingPassViewportGeometry.qrCodeWidth(viewportWidth: viewportWidth)

        return VStack(spacing: 12) {
            WeddingMonogram(names: pass.coupleNames, size: 42)
                .frame(maxWidth: .infinity)

            Text(pass.coupleNames)
                .font(.system(size: 22, weight: .regular, design: .serif))
                .italic()
                .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity)

            Text(pass.guestName)
                .font(.system(size: 20, weight: .semibold, design: .serif))
                .foregroundStyle(WeddingIdentityPalette.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity)

            Text(pass.currentStage == .checkedIn ? "ADMITTED" : "ATTENDING")
                .font(.system(size: 11, weight: .bold))
                .tracking(1.2)
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 5)
                .background(WeddingIdentityPalette.forest)
                .clipShape(Capsule())

            Text("Party of \(pass.partySize)")
                .font(.system(size: 13))
                .foregroundStyle(WeddingIdentityPalette.muted)

            ZStack {
                RoundedRectangle(cornerRadius: 14)
                    .fill(.white)
                    .frame(width: qrPlateWidth, height: qrPlateWidth)
                WeddingQRCodeView(payload: pass.qrPayload, size: qrCodeWidth)
                    .accessibilityIdentifier("wedding-pass-qr")
            }

            let productionCredential = pass.qrPayload.hasPrefix("WW2.")
            Text(productionCredential ? "Scan at venue" : "Shadow preview — not valid for admission")
                .font(.system(size: 11))
                .foregroundStyle(WeddingIdentityPalette.muted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity)

            Text(productionCredential ? "WEWED PASS CREDENTIAL" : "SHADOW TEST CREDENTIAL")
                .font(.system(size: 9, weight: .semibold))
                .tracking(1.3)
                .foregroundStyle(WeddingIdentityPalette.muted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity)

            if let table = pass.tableName {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Image(systemName: "table.furniture")
                    Text(table)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(WeddingIdentityPalette.forest)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, alignment: .center)
            }

            Text(pass.venueName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(WeddingIdentityPalette.ink)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity)

            Text(displayDate(pass.weddingDate))
                .font(.system(size: 11))
                .foregroundStyle(WeddingIdentityPalette.muted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity)

            let venueAddress = pass.venueAddress.isEmpty ? pass.venueName : pass.venueAddress
            if let query = venueAddress.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
               let mapURL = URL(string: "https://maps.apple.com/?q=\(query)") {
                Link(destination: mapURL) {
                    HStack(spacing: 4) {
                        Image(systemName: "mappin.and.ellipse")
                        Text("Open in Maps")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                    .padding(.vertical, 2)
                }
                .accessibilityIdentifier("pass-open-maps")
            }

            Button { showingGuestDetails = true } label: {
                Text("View Guest Details")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(WeddingIdentityPalette.champagne, lineWidth: 1)
                    )
            }
            .buttonStyle(.plain)
        }
        .padding(WeddingPassViewportGeometry.cardPadding)
        .frame(width: cardWidth)
        .background {
            // Backgrounds receive the resolved card size and cannot become ZStack sizing authority.
            WewedMediaImage(WewedAsset.ornamentFrame)
                .scaledToFill()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
                .opacity(0.12)
        }
        .background(WeddingIdentityPalette.ivorySoft)
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(WeddingIdentityPalette.champagne.opacity(0.7), lineWidth: 1.2)
        )
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .shadow(color: Color.black.opacity(0.06), radius: 14, x: 0, y: 5)
        .overlay(alignment: .topLeading) {
            AccessibilityMarker("wedding-pass-card", label: "Wedding pass card")
        }
    }

    private func preparePass() async {
        if let providedPass {
            pass = providedPass
            isLoading = false
            return
        }
        await loadPass()
    }

    private func loadPass() async {
        // P0-5: only this actor's credential resolves a pass. No default guest is guessed.
        if let passToken, let found = try? await appState.repository.getWeddingPass(token: passToken) {
            pass = found
        }
        isLoading = false
    }

    private func displayDate(_ raw: String) -> String {
        let input = DateFormatter()
        input.locale = Locale(identifier: "en_US_POSIX")
        input.dateFormat = "yyyy-MM-dd HH:mm:ss"
        guard let date = input.date(from: raw) else { return raw }

        let output = DateFormatter()
        output.locale = Locale(identifier: "en_US_POSIX")
        output.dateStyle = .medium
        output.timeStyle = .short
        return output.string(from: date)
    }
}
