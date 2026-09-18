import SwiftUI

public struct WeddingReferencePassView: View {
    @EnvironmentObject private var appState: AppState
    @State private var pass: WeddingPass?
    @State private var showingScanner = false
    @State private var isLoading = true

    public init() {}

    public var body: some View {
        NavigationStack {
            ZStack {
                WeddingFloralBackground()

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 18) {
                        if let pass {
                            header
                            passCard(pass)

                            Button {
                                showingScanner = true
                            } label: {
                                WeddingPrimaryButtonLabel("Usher Check-In Mode", icon: "camera.viewfinder")
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("reference-pass-scanner")
                        } else if isLoading {
                            ProgressView("Loading wedding pass…")
                                .padding(.top, 120)
                        } else {
                            ContentUnavailableView(
                                "Wedding Pass unavailable",
                                systemImage: "qrcode",
                                description: Text("No attending Shadow guest pass is available.")
                            )
                            .padding(.top, 80)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .padding(.bottom, 30)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showingScanner) {
                UsherScannerView {
                    showingScanner = false
                }
            }
            .task { await loadPass() }
        }
        .accessibilityIdentifier("reference-pass-root")
    }

    private var header: some View {
        HStack {
            Spacer()
            Text("Wedding Pass")
                .font(.system(size: 22, weight: .semibold, design: .serif))
                .foregroundStyle(WeddingIdentityPalette.ink)
            Spacer()
        }
    }

    private func passCard(_ pass: WeddingPass) -> some View {
        ZStack {
            Image("ornament-frame", bundle: .module)
                .resizable()
                .scaledToFill()
                .opacity(0.22)

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
                        .frame(width: 170, height: 170)
                    Image(systemName: "qrcode")
                        .resizable()
                        .interpolation(.none)
                        .scaledToFit()
                        .frame(width: 126, height: 126)
                        .foregroundStyle(WeddingIdentityPalette.ink)
                }

                Text("Scan at venue")
                    .font(.system(size: 11))
                    .foregroundStyle(WeddingIdentityPalette.muted)

                Text(pass.token)
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .lineLimit(1)

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

                Button {} label: {
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
    }

    private func loadPass() async {
        if let found = try? await appState.repository.getWeddingPass(token: "shadow-attending-guest") {
            pass = found
        } else if let found = try? await appState.repository.getWeddingPass(token: "native-reference-guest") {
            pass = found
        } else if let found = try? await appState.repository.getWeddingPass(token: "w1-j8doe-7x9") {
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
