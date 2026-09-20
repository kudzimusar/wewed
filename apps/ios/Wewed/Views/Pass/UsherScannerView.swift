import SwiftUI

public struct UsherScannerView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    @State private var scanResult: CheckInVerificationResult? = nil
    @State private var manualSearchQuery: String = ""
    @State private var searchResults: [Guest] = []
    @State private var checkInCount: Int = 1
    @State private var auditRecords: [CheckInAuditRecord] = []
    @State private var showingAuditSheet: Bool = false

    private let onDone: (() -> Void)?

    public init(onDone: (() -> Void)? = nil) {
        self.onDone = onDone
    }

    private func closeScanner() {
        if let onDone {
            onDone()
        } else {
            dismiss()
        }
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    viewfinderHeader
                    if let result = scanResult {
                        resultCard(result: result)
                    }
                    manualSearchSection
                    Spacer().frame(height: 40)
                }
                .background(WewedColors.ivory)
            }
            .navigationTitle("Gate Scanner")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        closeScanner()
                    }
                    .accessibilityIdentifier("gate-scanner-done")
                }
            }
            .sheet(isPresented: $showingAuditSheet) {
                GateAuditView(records: auditRecords)
            }
            .task {
                loadAuditRecords()
            }
        }
    }

    private var viewfinderHeader: some View {
        ZStack(alignment: .topLeading) {
            CameraBarcodeScannerView { scannedToken in
                performScan(token: scannedToken)
            }

            VStack {
                HStack {
                    Button {
                        closeScanner()
                    } label: {
                        Label("Exit Scanner", systemImage: "xmark")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color.black.opacity(0.6))
                            .foregroundColor(.white)
                            .cornerRadius(WewedRadius.pill)
                    }
                    .accessibilityIdentifier("gate-scanner-exit")

                    Spacer()
                }
                .padding(.top, WewedSpacing.sm)
                .padding(.leading, WewedSpacing.base)

                Spacer()


                HStack(spacing: 16) {
                    Text("Admitting Now:")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.white)

                    HStack(spacing: 12) {
                        Button {
                            if checkInCount > 1 { checkInCount -= 1 }
                        } label: {
                            Image(systemName: "minus.circle.fill")
                                .font(.title3)
                                .foregroundColor(checkInCount > 1 ? WewedColors.gold : .gray)
                        }

                        Text("\(checkInCount)")
                            .font(.headline)
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                            .frame(minWidth: 20)

                        Button {
                            if checkInCount < 10 { checkInCount += 1 }
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .font(.title3)
                                .foregroundColor(WewedColors.gold)
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.white.opacity(0.15))
                    .cornerRadius(WewedRadius.pill)
                }
                .padding(.bottom, 8)

            }
        }
        .frame(height: 310)
    }

    private func resultCard(result: CheckInVerificationResult) -> some View {
        VStack(spacing: WewedSpacing.sm) {
            HStack(spacing: 8) {
                Image(systemName: statusIcon(result.status))
                    .font(.headline)
                Text(statusTitle(result.status))
                    .font(.headline)
                    .fontWeight(.bold)
                Spacer()
            }
            .foregroundColor(statusColor(result.status))

            Divider()

            VStack(alignment: .leading, spacing: 4) {
                Text(result.guestName)
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(WewedColors.textPrimaryLight)

                if let household = result.householdName, !household.isEmpty {
                    Text("Household: \(household)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                if let table = result.tableName {
                    HStack(spacing: 4) {
                        Image(systemName: "table.furniture")
                            .font(.caption)
                        Text("Seated at: \(table)")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                    }
                    .foregroundColor(WewedColors.emerald)
                    .padding(.top, 2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if result.partySize > 0 {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Admitted: \(result.alreadyCheckedInCount) of \(result.partySize)")
                            .font(.caption)
                            .fontWeight(.medium)
                        Spacer()
                        if result.remainingCount > 0 {
                            Text("\(result.remainingCount) still to arrive")
                                .font(.caption)
                                .foregroundColor(WewedColors.gold)
                        } else {
                            Text("All Present")
                                .font(.caption)
                                .foregroundColor(WewedColors.success)
                        }
                    }

                    GeometryReader { geo in
                        let ratio = CGFloat(min(1.0, Double(result.alreadyCheckedInCount) / Double(max(1, result.partySize))))
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color.gray.opacity(0.2))
                                .frame(height: 6)
                            Capsule()
                                .fill(statusColor(result.status))
                                .frame(width: geo.size.width * ratio, height: 6)
                        }
                    }
                    .frame(height: 6)
                }
                .padding(.vertical, 4)
            }

            Text(result.gateMessage)
                .font(.footnote)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
        .shadow(color: Color.black.opacity(0.06), radius: 8, x: 0, y: 3)
        .padding(.horizontal)
        .padding(.top, WewedSpacing.base)
    }

    private var manualSearchSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Manual Gate Search")
                    .font(.headline)
                    .foregroundColor(WewedColors.textPrimaryLight)
                Spacer()
                Button {
                    loadAuditRecords()
                    showingAuditSheet = true
                } label: {
                    Label("Gate Log", systemImage: "clock.arrow.circlepath")
                        .font(.caption)
                        .foregroundColor(WewedColors.gold)
                }
            }
            .padding(.horizontal)
            .padding(.top, WewedSpacing.base)

            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search by guest or table...", text: $manualSearchQuery)
                    .onChange(of: manualSearchQuery) { _, query in
                        search(query: query)
                    }
            }
            .padding(10)
            .background(Color.wewedSecondaryBackground)
            .cornerRadius(WewedRadius.md)
            .padding(.horizontal)

            if !searchResults.isEmpty {
                VStack(spacing: 8) {
                    ForEach(searchResults) { guest in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(guest.name)
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                Text("Party of \(guest.partySize) • \(guest.tableName ?? "No table")")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Button {
                                checkInManual(guest: guest)
                            } label: {
                                Text("Admit (\(checkInCount))")
                                    .font(.caption)
                                    .fontWeight(.bold)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(WewedColors.gold)
                                    .foregroundColor(.black)
                                    .cornerRadius(WewedRadius.pill)
                            }
                        }
                        .padding(.vertical, 6)
                        .padding(.horizontal)
                        Divider()
                    }
                }
                .background(Color.white)
                .cornerRadius(WewedRadius.md)
                .padding(.horizontal)
            }
        }
    }

    private func performScan(token: String) {
        Task {
            do {
                let res = try await appState.scopedRepository().checkInGuest(qrPayload: token, count: checkInCount, usherId: "gate_usher_1")
                scanResult = res
                loadAuditRecords()
            } catch {
                scanResult = CheckInVerificationResult(
                    status: .invalidPass,
                    guestName: "Unknown Guest",
                    householdName: nil,
                    partySize: 0,
                    alreadyCheckedInCount: 0,
                    remainingCount: 0,
                    tableNumber: nil,
                    tableName: nil,
                    gateMessage: "Offline verification failed: \(error.localizedDescription)"
                )
            }
        }
    }

    private func search(query: String) {
        Task {
            if let results = try? await appState.scopedRepository().searchGuests(query: query) {
                searchResults = results
            }
        }
    }

    private func checkInManual(guest: Guest) {
        let dummyPayload = "WW1.wedts26.\(guest.passSerial ?? "WW0000").0e.66f001ab.signature"
        performScan(token: dummyPayload)
        manualSearchQuery = ""
        searchResults = []
    }

    private func loadAuditRecords() {
        Task {
            if let records = try? await appState.scopedRepository().getAuditRecords() {
                auditRecords = records
            }
        }
    }

    private func statusColor(_ status: CheckInVerificationResult.Status) -> Color {
        switch status {
        case .validPass: return WewedColors.success
        case .partialCheckedIn: return WewedColors.emerald
        case .alreadyCheckedIn: return WewedColors.error
        case .capacityExceeded: return WewedColors.warning
        case .invalidPass: return WewedColors.error
        }
    }

    private func statusIcon(_ status: CheckInVerificationResult.Status) -> String {
        switch status {
        case .validPass: return "checkmark.seal.fill"
        case .partialCheckedIn: return "person.2.badge.gearshape.fill"
        case .alreadyCheckedIn: return "exclamationmark.octagon.fill"
        case .capacityExceeded: return "person.crop.circle.badge.exclamationmark"
        case .invalidPass: return "xmark.diamond.fill"
        }
    }

    private func statusTitle(_ status: CheckInVerificationResult.Status) -> String {
        switch status {
        case .validPass: return "Admitted — Full Party"
        case .partialCheckedIn: return "Admitted — Partial Arrival"
        case .alreadyCheckedIn: return "Duplicate Entry Rejected"
        case .capacityExceeded: return "Gate Capacity Exceeded"
        case .invalidPass: return "Invalid Pass Rejected"
        }
    }
}

public struct GateAuditView: View {
    @Environment(\.dismiss) private var dismiss
    public let records: [CheckInAuditRecord]

    public var body: some View {
        NavigationStack {
            List {
                if records.isEmpty {
                    Text("No gate admissions recorded yet.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                } else {
                    ForEach(records.reversed()) { rec in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(rec.guestName)
                                    .font(.headline)
                                Spacer()
                                Text("+\(rec.countAdmitted)")
                                    .font(.subheadline)
                                    .fontWeight(.bold)
                                    .foregroundColor(WewedColors.emerald)
                            }
                            HStack {
                                Text(rec.gateName)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Spacer()
                                Text(rec.scannedAt.formatted(date: .omitted, time: .shortened))
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .navigationTitle("Gate Audit Log")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
