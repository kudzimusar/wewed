import SwiftUI

public struct LiveWallMessage: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let author: String
    public let content: String
    public let time: String
}

public struct LiveWallView: View {
    @State private var messages: [LiveWallMessage] = []
    @State private var applauseCount: Int = 0
    @State private var showingComposeSheet: Bool = false
    @State private var newMessageText: String = ""

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Live Applause Header
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Live Wall & Celebration")
                            .font(.headline)
                        Text("\(applauseCount) claps shared today")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Button {
                        applauseCount += 1
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "hands.clap.fill")
                                .foregroundColor(WewedColors.gold)
                            Text("Applaud")
                                .font(.subheadline)
                                .fontWeight(.bold)
                                .foregroundColor(WewedColors.textPrimaryLight)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(WewedColors.goldLight.opacity(0.3))
                        .cornerRadius(WewedRadius.pill)
                    }
                }
                .padding()
                .background(Color.white)
                .shadow(color: Color.black.opacity(0.02), radius: 4, x: 0, y: 1)

                // Message List
                if messages.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "bubble.left.and.bubble.right.fill")
                            .font(.system(size: 40))
                            .foregroundColor(WewedColors.gold.opacity(0.5))
                            .padding(.top, 40)
                        Text("No live wall messages yet.")
                            .font(.headline)
                        Text("Messages from attending guests will appear here during the celebration.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                        Spacer()
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(messages) { msg in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(msg.author)
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                        .foregroundColor(WewedColors.emerald)
                                    Spacer()
                                    Text(msg.time)
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                                Text(msg.content)
                                    .font(.body)
                                    .foregroundColor(WewedColors.textPrimaryLight)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }

                // Compose Button at bottom
                Button {
                    showingComposeSheet = true
                } label: {
                    Label("Send Well Wishes", systemImage: "square.and.pencil")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(WewedColors.gold)
                        .foregroundColor(.white)
                        .cornerRadius(WewedRadius.lg)
                }
                .padding()
            }
            .background(WewedColors.ivory)
            .navigationTitle("Live Wall")
            .sheet(isPresented: $showingComposeSheet) {
                NavigationStack {
                    Form {
                        TextField("Write your message to the couple...", text: $newMessageText, axis: .vertical)
                            .lineLimit(4...8)
                    }
                    .navigationTitle("Send Well Wishes")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { showingComposeSheet = false }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Post") {
                                if !newMessageText.isEmpty {
                                    messages.insert(LiveWallMessage(
                                        id: "m_\(UUID().uuidString.prefix(6))",
                                        author: "Guest",
                                        content: newMessageText,
                                        time: "Just now"
                                    ), at: 0)
                                    newMessageText = ""
                                    showingComposeSheet = false
                                }
                            }
                            .disabled(newMessageText.isEmpty)
                        }
                    }
                }
            }
        }
    }
}
