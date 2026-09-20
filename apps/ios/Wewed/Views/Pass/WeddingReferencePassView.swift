import SwiftUI

public struct WeddingReferencePassView: View {
    @EnvironmentObject private var appState: AppState
    @State private var pass: WeddingPass?
    @State private var showingScanner = false
    @State private var showingGuestDetails = false
    @State private var isLoading = true
    private let providedPass: WeddingPass?
    /// The credential of the *current authorized actor*. P0-5: there is no fallback token list —
    /// guessing an attending guest would resolve a different person than the Invitation, RSVP and
    /// Table surfaces, which is precisely the identity break this view must not reintroduce.
    private let passToken: String?

    public init(pass: WeddingPass? = nil, passToken: String? = nil) {
        self.providedPass = pass
        self.passToken = passToken
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                WeddingFloralBackground(opacity: 0.055)

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 18) {
                        if let pass {
                            header
                            passCard(pass)

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
                    .wewedBoundedWidth(horizontalInset: 36)
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .padding(.bottom, 30)
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
        .frame(maxWidth: .infinity)
    }

    private func passCard(_ pass: WeddingPass) -> some View {
        ZStack {
            WewedMediaImage(WewedAsset.ornamentFrame)
                .scaledToFill()
                .opacity(0.12)

            VStack(spacing: 12) {
                WeddingMonogram(names: pass.coupleNames, size: 42)

                Text(pass.coupleNames)
                    .font(.system(size: 22, weight: .regular, design: .serif))
                    .italic()
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)

                Text(pass.guestName)
                    .font(.system(size: 20, weight: .semibold, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)

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
                        .frame(width: 174, height: 174)
                    WeddingQRCodeView(payload: pass.qrPayload, size: 146)
                }

                let productionCredential = pass.qrPayload.hasPrefix("WW2.")
                Text(productionCredential ? "Scan at venue" : "Shadow preview — not valid for admission")
                    .font(.system(size: 11))
                    .foregroundStyle(WeddingIdentityPalette.muted)

                Text(productionCredential ? "WEWED PASS CREDENTIAL" : "SHADOW TEST CREDENTIAL")
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(1.3)
                    .foregroundStyle(WeddingIdentityPalette.muted)

                if let table = pass.tableName {
                    Label(table, systemImage: "table.furniture")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(WeddingIdentityPalette.forest)
                }

                Text(pass.venueName)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(WeddingIdentityPalette.ink)

                Text(displayDate(pass.weddingDate))
                    .font(.system(size: 11))
                    .foregroundStyle(WeddingIdentityPalette.muted)

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
            .padding(22)
        }
        .background(WeddingIdentityPalette.ivorySoft)
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .stroke(WeddingIdentityPalette.champagne.opacity(0.7), lineWidth: 1.2)
        )
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .shadow(color: Color.black.opacity(0.06), radius: 14, x: 0, y: 5)
        .accessibilityIdentifier("wedding-pass-card")
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
