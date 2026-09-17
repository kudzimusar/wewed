import SwiftUI

public struct PersonaPickerSheet: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.dismiss) private var dismiss

    public init() {}

    private func isSelected(_ persona: DevelopmentPersona) -> Bool {
        if let active = session.activePersona {
            return active.id == persona.id
        }
        return persona.id == "couple_owner"
    }

    public var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Select a development persona to test role-scoped workspace navigation and capabilities in isolation.")
                        .font(.footnote)
                        .foregroundColor(.secondary)
                }

                Section("Workspaces & Personas") {
                    ForEach(DevelopmentPersona.allPersonas) { persona in
                        Button {
                            session.switchPersona(persona)
                            session.showingPersonaPicker = false
                            dismiss()
                        } label: {
                            personaRow(for: persona)
                        }
                    }
                }
            }
            .navigationTitle("Switch Persona")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        session.showingPersonaPicker = false
                        dismiss()
                    }
                }
            }
        }
    }

    private func personaRow(for persona: DevelopmentPersona) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(persona.name)
                        .font(.headline)
                        .foregroundColor(.primary)
                    Spacer()
                    Text(persona.role.title)
                        .font(.caption2)
                        .fontWeight(.bold)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.secondary.opacity(0.15))
                        .cornerRadius(WewedRadius.sm)
                }
                Text(persona.subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            if isSelected(persona) {
                Image(systemName: "checkmark")
                    .foregroundColor(WewedColors.gold)
                    .fontWeight(.semibold)
            }
        }
        .padding(.vertical, 4)
    }
}
