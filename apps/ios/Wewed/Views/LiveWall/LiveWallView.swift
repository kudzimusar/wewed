import SwiftUI

public struct LiveWallMessage: Identifiable, Codable, Equatable, Sendable {
    public let id: String
    public let author: String
    public let content: String
    public let time: String
}

public struct LiveWallView: View {
    @State private var messages: [LiveWallMessage] = [
        LiveWallMessage(id: "m1", author: "Uncle Farai", content: "Congratulations Charity & Kudzie! May God bless this union abundantly!", time: "14:15"),
        LiveWallMessage(id: "m2", author: "Auntie Chipo", content: "Such a beautiful celebration at Imba Manor! Welcome to the family Kudzie!", time: "14:22"),
        LiveWallMessage(id: "m3", author: "Tony M.", content: "Waiting for the dance floor to open! Cheers to Charity & Kudzie!", time: "14:35")
    ]
    @State private var applauseCount: Int = 142
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
