import SwiftUI

public struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var email: String = "tariro@wewed.pro"
    @State private var password: String = "wewed-admin-2026"
    @State private var selectedRole: String = "couple"

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(spacing: WewedSpacing.xl) {
                Spacer()

                VStack(spacing: WewedSpacing.sm) {
                    Text("WEWED")
                        .font(.system(size: 28, weight: .bold, design: .serif))
                        .foregroundColor(WewedColors.gold)
                    Text("Native Mobile Division")
                        .font(.subheadline)
                        .foregroundColor(WewedColors.textSecondaryLight)
                }

                VStack(spacing: WewedSpacing.base) {
                    TextField("Email Address", text: $email)
                        .padding()
                        .background(Color.wewedSecondaryBackground)
                        .cornerRadius(WewedRadius.md)

                    SecureField("Password", text: $password)
                        .padding()
                        .background(Color.wewedSecondaryBackground)
                        .cornerRadius(WewedRadius.md)

                    Picker("Role", selection: $selectedRole) {
                        Text("Couple / Host").tag("couple")
                        Text("Usher (Check-In)").tag("usher")
                        Text("Planner").tag("planner")
                    }
                    .pickerStyle(.segmented)
                }
                .padding(.horizontal, WewedSpacing.xl)

                Button {
                    session.login(email: email, role: selectedRole)
                } label: {
                    Text("Sign In")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(WewedColors.gold)
                        .foregroundColor(.white)
                        .cornerRadius(WewedRadius.lg)
                }
                .padding(.horizontal, WewedSpacing.xl)

                Spacer()

                Text("Zimbabwe-First Wedding Ecosystem")
                    .font(.caption)
                    .foregroundColor(WewedColors.textSecondaryLight)
                    .padding(.bottom, WewedSpacing.lg)
            }
            .background(WewedColors.ivory)
        }
    }
}
