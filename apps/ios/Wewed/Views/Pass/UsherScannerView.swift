import SwiftUI

// Gate check-in, bound to RoleScopedAccess.admit / admissionLookup / admissionSummary / admissionHistory.
// Results are described from the recorded status and counts, in plain words.

@MainActor
public final class GateModel: ObservableObject {
    public let access: RoleScopedAccess
    public let operatorId: String

    @Published public var admitCount = 1
    @Published public private(set) var lastResult: CheckInVerificationResult?
    @Published public private(set) var lastError: String?
    @Published public private(set) var busy = false
    @Published public private(set) var summary: AdmissionSummary?
    @Published public private(set) var history: [CheckInAuditRecord] = []
    @Published public private(set) var lookupRows: [AdmissionLookupRow] = []
    @Published public private(set) var loadFailed = false

    public init(access: RoleScopedAccess, operatorId: String) {
        self.access = access
        self.operatorId = operatorId
    }

    public func admit(code raw: String) async {
        let code = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty, !busy else { return }
        busy = true
        lastError = nil
        do {
            lastResult = try await access.admit(qrPayload: code, count: admitCount, operatorId: operatorId)
            admitCount = 1
        } catch {
            lastResult = nil
            lastError = "The pass couldn't be checked. Please try again."
        }
        busy = false
        await refresh()
    }

    public func refresh() async {
        do {
            summary = try await access.admissionSummary()
            history = try await access.admissionHistory().sorted { $0.scannedAt > $1.scannedAt }
            loadFailed = false
        } catch {
            loadFailed = true
        }
    }

    public func lookup(_ query: String) async {
        lookupRows = (try? await access.admissionLookup(query: query)) ?? []
    }
}

enum GateResultWords {
    static func title(_ status: CheckInVerificationResult.Status) -> String {
        switch status {
        case .validPass: return "Admitted. Whole party is in."
        case .partialCheckedIn: return "Admitted. More guests still to arrive."
        case .alreadyCheckedIn: return "Already admitted. Do not admit again."
        case .capacityExceeded: return "Too many guests for this pass."
        case .invalidPass: return "Pass not recognised."
        }
    }

    static func icon(_ status: CheckInVerificationResult.Status) -> String {
        switch status {
        case .validPass, .partialCheckedIn: return "checkmark.circle.fill"
        case .alreadyCheckedIn: return "exclamationmark.octagon.fill"
        case .capacityExceeded: return "exclamationmark.triangle.fill"
        case .invalidPass: return "xmark.octagon.fill"
        }
    }

    static func tone(_ status: CheckInVerificationResult.Status) -> StatusText.Tone {
        switch status {
        case .validPass, .partialCheckedIn: return .positive
        case .capacityExceeded: return .attention
        case .alreadyCheckedIn, .invalidPass: return .negative
        }
    }
}

/// How many to admit, manual pass-code entry and the latest result.
public struct GateCheckInPanel: View {
    @ObservedObject var model: GateModel
    @State private var code = ""
    @FocusState private var codeFocused: Bool

    public init(model: GateModel) {
        self.model = model
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            admitCountControl

            VStack(alignment: .leading, spacing: 8) {
                Text("Type the pass code")
                    .font(.headline)
                    .foregroundStyle(WeddingIdentityPalette.ink)
                TextField("Pass code", text: $code)
                    .font(.body)
                    .autocorrectionDisabled()
                    #if os(iOS)
                    .textInputAutocapitalization(.characters)
                    #endif
                    .padding(.horizontal, 12)
                    .frame(minHeight: 48)
                    .background(WeddingIdentityPalette.ivorySoft, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(WeddingIdentityPalette.hairline, lineWidth: 1))
                    .focused($codeFocused)
                    .submitLabel(.go)
                    .onSubmit(check)
                    .accessibilityIdentifier("gate-manual-code")
                Button(action: check) {
                    if model.busy { ProgressView() } else { Text("Check pass") }
                }
                .buttonStyle(WeddingActionButtonStyle(.primary))
                .disabled(model.busy || code.trimmingCharacters(in: .whitespaces).isEmpty)
                .accessibilityIdentifier("gate-manual-submit")
            }

            if let error = model.lastError {
                StatusText(error, systemImage: "exclamationmark.triangle.fill", tone: .negative)
                    .accessibilityIdentifier("gate-error")
            }
            if let result = model.lastResult {
                GateResultCard(result: result)
            }
        }
    }

    private func check() {
        let value = code
        codeFocused = false
        Task {
            await model.admit(code: value)
            if model.lastError == nil { code = "" }
        }
    }

    private var admitCountControl: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 12) { countContent }
            VStack(alignment: .leading, spacing: 8) { countContent }
        }
    }

    @ViewBuilder
    private var countContent: some View {
        Text("Guests to admit now: \(model.admitCount)")
            .font(.headline)
            .foregroundStyle(WeddingIdentityPalette.ink)
            .accessibilityIdentifier("gate-admit-count")
        HStack(spacing: 10) {
            Button {
                if model.admitCount > 1 { model.admitCount -= 1 }
            } label: {
                Image(systemName: "minus")
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(WeddingActionButtonStyle(.secondary, fullWidth: false))
            .disabled(model.admitCount <= 1)
            .accessibilityLabel("One fewer guest")
            .accessibilityIdentifier("gate-admit-fewer")
            Button {
                if model.admitCount < 20 { model.admitCount += 1 }
            } label: {
                Image(systemName: "plus")
                    .frame(width: 24, height: 24)
            }
            .buttonStyle(WeddingActionButtonStyle(.secondary, fullWidth: false))
            .accessibilityLabel("One more guest")
            .accessibilityIdentifier("gate-admit-more")
        }
    }
}

struct GateResultCard: View {
    let result: CheckInVerificationResult

    var body: some View {
        PlainCard {
            VStack(alignment: .leading, spacing: 8) {
                StatusText(GateResultWords.title(result.status), systemImage: GateResultWords.icon(result.status), tone: GateResultWords.tone(result.status))
                if result.status != .invalidPass {
                    Text(result.guestName)
                        .font(.system(.title3, design: .serif).weight(.semibold))
                        .foregroundStyle(WeddingIdentityPalette.ink)
                    Text("Admitted \(result.alreadyCheckedInCount) of \(result.partySize)")
                        .font(.body)
                    Text(result.remainingCount > 0 ? "\(result.remainingCount) still to arrive" : "Nobody else to admit on this pass")
                        .font(.body)
                    Text(result.tableName.map { "Table: \($0)" } ?? "No table recorded")
                        .font(.body)
                        .foregroundStyle(WeddingIdentityPalette.forest)
                }
            }
            .foregroundStyle(WeddingIdentityPalette.ink)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityElement(children: .combine)
        }
        .accessibilityIdentifier("gate-result")
    }
}

/// Camera scanning plus manual entry, presented as a sheet from any shell allowed to scan.
public struct UsherScannerView: View {
    @ObservedObject var model: GateModel
    private let onDone: () -> Void

    public init(model: GateModel, onDone: @escaping () -> Void) {
        self.model = model
        self.onDone = onDone
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    ZStack(alignment: .topLeading) {
                        CameraBarcodeScannerView { scanned in
                            Task { await model.admit(code: scanned) }
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 16))

                        Button(action: onDone) {
                            Label("Close scanner", systemImage: "xmark")
                                .font(.subheadline.weight(.semibold))
                                .padding(.horizontal, 12)
                                .frame(minHeight: 44)
                                .background(Color.black.opacity(0.6), in: Capsule())
                                .foregroundStyle(.white)
                        }
                        .padding(10)
                        .accessibilityIdentifier("gate-scanner-exit")
                    }
                    .frame(height: 300)

                    GateCheckInPanel(model: model)
                }
                .padding(16)
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle("Scan pass")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done", action: onDone)
                        .accessibilityIdentifier("gate-scanner-done")
                }
            }
        }
        .accessibilityIdentifier("gate-scanner-root")
    }
}

/// Gate scanning: a large Scan pass button (opens the camera sheet) and manual code entry.
public struct GateScanSection: View {
    @ObservedObject var model: GateModel
    @State private var showingScanner = false

    public init(model: GateModel) {
        self.model = model
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Button {
                showingScanner = true
            } label: {
                Label("Scan pass", systemImage: "qrcode.viewfinder")
                    .font(.title3.weight(.semibold))
                    .frame(minHeight: 64)
            }
            .buttonStyle(WeddingActionButtonStyle(.primary))
            .accessibilityIdentifier("usher-scanner-open")

            GateCheckInPanel(model: model)
        }
        .sheet(isPresented: $showingScanner) {
            UsherScannerView(model: model) { showingScanner = false }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("usher-scan-root")
    }
}

/// Gate admissions: counts, name lookup and this device's scan history.
public struct GateAdmissionsSection: View {
    @ObservedObject var model: GateModel
    @State private var query = ""

    public init(model: GateModel) {
        self.model = model
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if model.loadFailed {
                LoadFailureText("admissions")
            }
            if let summary = model.summary {
                AdmissionSummaryCard(summary: summary)
            }

            SectionHeading("Find a guest")
            TextField("Guest name (at least 2 letters)", text: $query)
                .font(.body)
                .autocorrectionDisabled()
                .padding(.horizontal, 12)
                .frame(minHeight: 48)
                .background(WeddingIdentityPalette.ivorySoft, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(WeddingIdentityPalette.hairline, lineWidth: 1))
                .accessibilityLabel("Find a guest by name")
                .accessibilityIdentifier("usher-lookup-field")
                .onChange(of: query) { _, value in
                    Task { await model.lookup(value) }
                }
            if query.trimmingCharacters(in: .whitespaces).count >= 2 && model.lookupRows.isEmpty {
                EmptyStateText("No attending guest matches “\(query)”.", identifier: "usher-lookup-empty")
            }
            ForEach(model.lookupRows) { row in
                PlainCard {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(row.displayName)
                            .font(.body.weight(.semibold))
                        Text("Party of \(row.partySize) · Admitted \(row.admittedCount) · \(row.remaining) still to arrive")
                            .font(.subheadline)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(row.tableName.map { "Table: \($0)" } ?? "No table recorded")
                            .font(.subheadline)
                            .foregroundStyle(WeddingIdentityPalette.forest)
                    }
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .accessibilityElement(children: .combine)
                }
                .accessibilityIdentifier("usher-lookup-row-\(row.guestId)")
            }

            SectionHeading("Scanned on this device")
            if model.history.isEmpty {
                EmptyStateText("No passes have been scanned on this device yet.", identifier: "usher-history-empty")
            }
            ForEach(model.history) { record in
                PlainCard {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(record.guestName)
                                .font(.body.weight(.semibold))
                            Text("Admitted \(record.countAdmitted)")
                                .font(.subheadline)
                        }
                        Spacer()
                        Text(record.scannedAt.formatted(date: .omitted, time: .shortened))
                            .font(.subheadline)
                            .foregroundStyle(WeddingIdentityPalette.muted)
                    }
                    .foregroundStyle(WeddingIdentityPalette.ink)
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .task { await model.refresh() }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("usher-admissions-root")
    }
}

/// A gate tab: one or both sections in a scrolling, navigable screen.
public struct GateTabView: View {
    public enum Content { case scan, admissions, both }
    @ObservedObject var model: GateModel
    let content: Content
    let title: String
    let identifier: String?

    public init(model: GateModel, content: Content, title: String, identifier: String? = nil) {
        self.model = model
        self.content = content
        self.title = title
        self.identifier = identifier
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if content != .admissions {
                        GateScanSection(model: model)
                    }
                    if content != .scan {
                        GateAdmissionsSection(model: model)
                    }
                }
                .padding(16)
            }
            .background(WeddingIdentityPalette.ivory.ignoresSafeArea())
            .navigationTitle(title)
            .refreshable { await model.refresh() }
        }
        .accessibilityElement(children: .contain)
        .modifier(OptionalIdentifier(identifier: identifier))
    }
}

struct AdmissionSummaryCard: View {
    let summary: AdmissionSummary

    var body: some View {
        PlainCard {
            VStack(alignment: .leading, spacing: 6) {
                Text("Check-in so far")
                    .font(.headline)
                Text("\(summary.admittedGuests) of \(summary.expectedGuests) expected guests admitted")
                    .font(.body)
                Text("\(max(summary.expectedGuests - summary.admittedGuests, 0)) still to arrive")
                    .font(.body)
                Text(PlainStatus.plural(summary.attendingParties, "attending party", "attending parties"))
                    .font(.subheadline)
                    .foregroundStyle(WeddingIdentityPalette.muted)
            }
            .foregroundStyle(WeddingIdentityPalette.ink)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityElement(children: .combine)
        }
        .accessibilityIdentifier("admission-summary")
    }
}
