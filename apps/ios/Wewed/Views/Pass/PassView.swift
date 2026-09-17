import SwiftUI

public struct PassView: View {
    @EnvironmentObject private var appState: AppState
    @EnvironmentObject private var session: SessionStore
    @State private var pass: WeddingPass? = nil
    @State private var showingScanner: Bool = false
    @State private var isLoading: Bool = true

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: WewedSpacing.xl) {
                    if let pass = pass {
                        // The Wewed Wedding Pass Card
                        VStack(spacing: WewedSpacing.base) {
                            // Header
                            VStack(spacing: 4) {
                                Text("WEWED WEDDING PASS")
                                    .font(.caption)
                                    .fontWeight(.bold)
                                    .tracking(2)
                                    .foregroundColor(WewedColors.gold)

                                Text(pass.coupleNames)
                                    .font(.system(size: 22, weight: .bold, design: .serif))
                                    .foregroundColor(WewedColors.textPrimaryLight)

                                Text("24 October 2026 • 14:00")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.top, WewedSpacing.sm)

                            Divider()
                                .padding(.horizontal, WewedSpacing.base)

                            // Guest & Table info
                            VStack(spacing: 6) {
                                Text(pass.guestName)
                                    .font(.title2)
                                    .fontWeight(.bold)

                                Text("Party of \(pass.partySize)")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)

                                if let table = pass.tableName {
                                    HStack(spacing: 6) {
                                        Image(systemName: "table.furniture")
                                            .foregroundColor(WewedColors.emerald)
                                        Text(table)
                                            .font(.headline)
                                            .foregroundColor(WewedColors.emerald)
                                    }
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(WewedColors.emerald.opacity(0.1))
                                    .cornerRadius(WewedRadius.pill)
                                    .padding(.top, 4)
                                }
                            }

                            // QR Representation Box
                            VStack(spacing: 8) {
                                Image(systemName: "qrcode")
                                    .resizable()
                                    .interpolation(.none)
                                    .scaledToFit()
                                    .frame(width: 160, height: 160)
                                    .foregroundColor(WewedColors.textPrimaryLight)

                                Text("Scan at venue entrance")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            .padding()
                            .background(Color.wewedBackground)
                            .cornerRadius(WewedRadius.md)
                            .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 2)

                            // Venue Details
                            VStack(spacing: 2) {
                                Text(pass.venueName)
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                Text(pass.venueAddress)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.bottom, WewedSpacing.base)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WewedRadius.xl)
                        .shadow(color: Color.black.opacity(0.08), radius: 16, x: 0, y: 4)

                        // Operational Buttons
                        VStack(spacing: WewedSpacing.md) {
                            Button {
                                // Save to Camera Roll
                            } label: {
                                Label("Save Pass to Photos", systemImage: "square.and.arrow.down")
                                    .font(.headline)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(WewedColors.gold)
                                    .foregroundColor(.white)
                                    .cornerRadius(WewedRadius.lg)
                            }

                            Button {
                                showingScanner = true
                            } label: {
                                Label("Usher Check-In Mode", systemImage: "camera.viewfinder")
                                    .font(.headline)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(WewedColors.emerald)
                                    .foregroundColor(.white)
                                    .cornerRadius(WewedRadius.lg)
                            }
                        }
                    } else if isLoading {
                        ProgressView("Loading wedding pass...")
                            .padding(.top, 60)
                    }
                }
                .padding(.horizontal, WewedSpacing.xl)
                .padding(.vertical, WewedSpacing.lg)
            }
            .background(WewedColors.ivory)
            .navigationTitle("Wedding Pass")
            .sheet(isPresented: $showingScanner) {
                UsherScannerView()
            }
            .task {
                do {
                    pass = try await appState.repository.getWeddingPass(token: "w1-j8doe-7x9")
                    isLoading = false
                } catch {
                    isLoading = false
                }
            }
        }
    }
}
