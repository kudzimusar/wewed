import SwiftUI

/// Manual recovery path for a guest who opened Wewed from the app icon instead of from the
/// invitation message/QR.
///
/// This does not authenticate a guest and does not invent a wedding. It only feeds the exact
/// private Wewed URL back through the same InvitationEntryParser used by Universal Links.
public struct InvitationLinkEntryView: View {
    private let onOpen: (URL) -> Void
    private let onBack: () -> Void

    @State private var rawLink = ""
    @State private var validationMessage: String?

    public init(
        onOpen: @escaping (URL) -> Void,
        onBack: @escaping () -> Void
    ) {
        self.onOpen = onOpen
        self.onBack = onBack
    }

    public var body: some View {
        ZStack {
            WeddingIdentityPalette.ivory.ignoresSafeArea()
            WeddingFloralBackground(opacity: 0.07)

            VStack(spacing: 16) {
                WewedLogo()

                Text("Open your invitation")
                    .font(.system(size: 28, weight: .medium, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)

                Text("Paste the private Wewed invitation link you received. You do not need a Wewed account.")
                    .font(.system(size: 14))
                    .foregroundStyle(WeddingIdentityPalette.muted)
                    .multilineTextAlignment(.center)

                TextField("https://wewed.pro/invite/…", text: $rawLink, axis: .vertical)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .padding(14)
                    .background(WeddingIdentityPalette.ivorySoft)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(WeddingIdentityPalette.champagne.opacity(0.8), lineWidth: 1)
                    )
                    .accessibilityIdentifier("invitation-link-field")

                if let validationMessage {
                    Text(validationMessage)
                        .font(.system(size: 12))
                        .foregroundStyle(WeddingIdentityPalette.muted)
                        .multilineTextAlignment(.center)
                        .accessibilityIdentifier("invitation-link-error")
                }

                Button(action: openInvitation) {
                    Text("Open Invitation")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .foregroundStyle(WeddingIdentityPalette.ivorySoft)
                        .background(WeddingIdentityPalette.forest)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .accessibilityIdentifier("invitation-link-open")

                Button("Back", action: onBack)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                    .accessibilityIdentifier("invitation-link-back")
            }
            .wewedBoundedWidth(horizontalInset: 28)
        }
        .accessibilityIdentifier("invitation-link-entry")
    }

    private func openInvitation() {
        let candidate = rawLink.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: candidate) else {
            validationMessage = "Paste a valid Wewed invitation link."
            return
        }

        switch InvitationEntryParser.entry(from: candidate) {
        case .privateInvitation, .handoff:
            validationMessage = nil
            onOpen(url)
        case .rejected, .none:
            validationMessage = "That link is not a valid Wewed invitation. Check the full private link and try again."
        }
    }
}
