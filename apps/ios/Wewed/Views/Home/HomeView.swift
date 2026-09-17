import SwiftUI

public struct HomeView: View {
    @EnvironmentObject private var appState: AppState
    @State private var wedding: Wedding? = nil
    @State private var isLoading: Bool = true

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: WewedSpacing.xl) {
                    if let wedding = wedding {
                        // Hero Section
                        VStack(spacing: WewedSpacing.sm) {
                            Text("T & S")
                                .font(.system(size: 36, weight: .bold, design: .serif))
                                .foregroundColor(WewedColors.gold)
                                .padding(.top, WewedSpacing.base)

                            Text(wedding.coupleNames)
                                .font(.system(size: 26, weight: .semibold, design: .serif))
                                .foregroundColor(WewedColors.textPrimaryLight)

                            Text("24 October 2026 • Harare, Zimbabwe")
                                .font(.subheadline)
                                .foregroundColor(WewedColors.textSecondaryLight)

                            // Countdown Box
                            HStack(spacing: WewedSpacing.md) {
                                CountdownUnit(value: "37", label: "Days")
                                CountdownUnit(value: "04", label: "Hours")
                                CountdownUnit(value: "22", label: "Mins")
                            }
                            .padding(.top, WewedSpacing.sm)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WewedRadius.lg)
                        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)

                        // Venue Card
                        VStack(alignment: .leading, spacing: WewedSpacing.sm) {
                            HStack {
                                Image(systemName: "mappin.and.ellipse")
                                    .foregroundColor(WewedColors.emerald)
                                Text("The Venue")
                                    .font(.headline)
                            }
                            Text(wedding.venueName)
                                .font(.title3)
                                .fontWeight(.semibold)
                            Text(wedding.venueAddress)
                                .font(.subheadline)
                                .foregroundColor(WewedColors.textSecondaryLight)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WewedRadius.lg)
                        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)

                        // Programme Section
                        VStack(alignment: .leading, spacing: WewedSpacing.md) {
                            Text("The Day's Programme")
                                .font(.headline)
                                .foregroundColor(WewedColors.textPrimaryLight)

                            ForEach(wedding.programme) { item in
                                HStack(alignment: .top, spacing: WewedSpacing.md) {
                                    Text(item.time)
                                        .font(.subheadline)
                                        .fontWeight(.bold)
                                        .foregroundColor(WewedColors.gold)
                                        .frame(width: 50, alignment: .leading)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.title)
                                            .font(.subheadline)
                                            .fontWeight(.semibold)
                                        Text(item.location)
                                            .font(.caption)
                                            .foregroundColor(WewedColors.emerald)
                                        Text(item.description)
                                            .font(.caption)
                                            .foregroundColor(WewedColors.textSecondaryLight)
                                    }
                                }
                                .padding(.vertical, 4)
                                Divider()
                            }
                        }
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WewedRadius.lg)
                        .shadow(color: Color.black.opacity(0.04), radius: 8, x: 0, y: 2)
                    } else if isLoading {
                        ProgressView("Loading wedding details...")
                            .padding(.top, 60)
                    }
                }
                .padding(.horizontal, WewedSpacing.base)
                .padding(.bottom, WewedSpacing.xl)
            }
            .background(WewedColors.ivory)
            .navigationTitle("Wedding Overview")
            .task {
                do {
                    wedding = try await appState.repository.getWedding()
                    isLoading = false
                } catch {
                    isLoading = false
                }
            }
        }
    }
}

private struct CountdownUnit: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(WewedColors.goldDark)
            Text(label)
                .font(.caption2)
                .foregroundColor(WewedColors.textSecondaryLight)
        }
        .frame(width: 60, height: 50)
        .background(WewedColors.goldLight.opacity(0.3))
        .cornerRadius(WewedRadius.sm)
    }
}
