import SwiftUI

public struct ShadowPlannerBudgetView: View {
    @EnvironmentObject private var appState: AppState
    @State private var lines: [PlannerBudgetLine] = []

    public init() {}

    private var totalEstimated: Double { lines.reduce(0) { $0 + $1.estimated } }
    private var totalActual: Double { lines.reduce(0) { $0 + $1.actual } }
    private var totalPaid: Double { lines.reduce(0) { $0 + $1.paid } }
    private var totalOutstanding: Double { max(0, totalActual - totalPaid) }

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.lg) {
                plannerFinanceSummary
                VStack(alignment: .leading, spacing: 12) {
                    Text("Budget Items")
                        .font(.headline)
                    ForEach(lines) { line in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(line.category)
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                    if let vendor = line.vendorName {
                                        Text(vendor)
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                }
                                Spacer()
                                Text(line.statusLabel)
                                    .font(.caption2)
                                    .fontWeight(.semibold)
                                    .foregroundColor(WewedColors.emerald)
                            }
                            HStack {
                                valueColumn("Estimated", line.estimated)
                                valueColumn("Actual", line.actual)
                                valueColumn("Paid", line.paid)
                                valueColumn("Outstanding", max(0, line.actual - line.paid))
                            }
                            Text(line.fundingLabel)
                                .font(.caption2)
                                .foregroundColor(WewedColors.goldDark)
                            if let due = line.dueDateLabel {
                                Text(due)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WewedRadius.lg)
                    }
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Budget")
        .accessibilityIdentifier("planner-budget-root")
        .task {
            lines = (try? await appState.plannerRepository.getBudgetLines()) ?? []
        }
    }

    private var plannerFinanceSummary: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Financial Position")
                .font(.headline)
            HStack {
                valueColumn("Estimated", totalEstimated)
                valueColumn("Actual", totalActual)
                valueColumn("Paid", totalPaid)
                valueColumn("Outstanding", totalOutstanding)
            }
            ProgressView(value: totalPaid, total: max(totalActual, 1))
                .tint(WewedColors.emerald)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.lg)
    }

    private func valueColumn(_ title: String, _ amount: Double) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
            Text("$\(Int(amount))")
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(WewedColors.textPrimaryLight)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

public struct ShadowPlannerContributionsView: View {
    @EnvironmentObject private var appState: AppState

    public init() {}

    public var body: some View {
        // Master plan Phase 8 closure round 3 §2 — a live failure (transport/permission/revocation)
        // must render distinctly from an authoritative empty ledger, never fall back to one silently.
        ProductionLoadView(
            id: 0,
            section: "Contributions",
            environment: appState.dataEnvironment,
            load: { try await appState.plannerRepository.getContributions() }
        ) { records in
            ContributionsListContent(records: records)
        }
        .navigationTitle("Contributions")
        .accessibilityIdentifier("planner-contributions-root")
    }
}

private struct ContributionsListContent: View {
    let records: [PlannerContributionRecord]

    private var totalValue: Double { records.reduce(0) { $0 + $1.value } }
    private var unverified: Int { records.filter { !$0.verified }.count }
    private var hasMonetaryValues: Bool { records.contains { $0.value > 0 } }

    var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.lg) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Contribution Position")
                        .font(.headline)
                    HStack {
                        VStack(alignment: .leading) {
                            Text(hasMonetaryValues ? "$\(Int(totalValue))" : "\(records.count)")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(WewedColors.emerald)
                            Text(hasMonetaryValues ? "recorded contribution value" : "memories, blessings & stories")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing) {
                            Text("\(unverified)")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(unverified > 0 ? WewedColors.warning : WewedColors.emerald)
                            Text("need verification")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .padding()
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                ForEach(records) { record in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(record.contributorLabel)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                            Spacer()
                            if record.value > 0 {
                                Text("$\(Int(record.value))")
                                    .font(.subheadline)
                                    .fontWeight(.bold)
                                    .foregroundColor(WewedColors.emerald)
                            }
                        }
                        Text(record.typeLabel)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        HStack {
                            Text(record.allocationLabel)
                                .font(.caption2)
                                .foregroundColor(WewedColors.goldDark)
                            Spacer()
                            Text(record.statusLabel)
                                .font(.caption2)
                                .fontWeight(.semibold)
                                .foregroundColor(record.verified ? WewedColors.emerald : WewedColors.warning)
                        }
                    }
                    .padding()
                    .background(Color.white)
                    .cornerRadius(WewedRadius.lg)
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
    }
}

public struct ShadowPlannerVendorsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var vendors: [PlannerVendorEngagement] = []

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.sm) {
                ForEach(vendors) { vendor in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(vendor.vendorName)
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                                Text(vendor.category)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Text(vendor.bookingStatus)
                                .font(.caption2)
                                .fontWeight(.semibold)
                                .foregroundColor(WewedColors.emerald)
                        }
                        HStack(spacing: 8) {
                            statusPill("Contract", vendor.contractStatus)
                            statusPill("Payment", vendor.paymentStatus)
                        }
                        Text("Next: \(vendor.nextAction)")
                            .font(.caption)
                            .foregroundColor(WewedColors.goldDark)
                    }
                    .padding()
                    .background(Color.white)
                    .cornerRadius(WewedRadius.lg)
                }

                // Master plan Phase 8 closure round 3 §3 — Contracts/Deal-Room, folded into this
                // EXISTING, already-authorized "Vendors" navigation entry rather than added as a new
                // Level-2 section: the locked cross-platform IA V2 navigation contract
                // (mobile/contracts/ia-v2-navigation.json, status AUTHORITATIVE) enumerates every
                // Level-2 section for Planner/Couple by name, and both platforms assert equality
                // against it in unit tests — adding a new entry there is a product/IA decision, not
                // the "wire existing UI to real data" mandate this closure item is scoped to.
                // `Vendor.id` and `ServiceEngagement.vendorId` are the same id space, so this is a
                // genuinely adjacent, not arbitrary, home for it. `PlannerVendorEngagement` above (the
                // `Vendor.contractStatus`/`paymentStatus` planning fields) and `ServiceEngagementSummary`
                // below (the managed-contract lifecycle) are rendered as two clearly separate,
                // distinctly-labelled lists from two distinct DTOs/repositories — never merged into
                // one model. Non-production shows nothing extra here: there is no Shadow/Fixture
                // contract data for this brand-new-this-phase domain, and inventing some would be
                // fabrication.
                if appState.dataEnvironment == .production {
                    Text("Contracts & Engagements")
                        .font(.headline)
                        .fontWeight(.bold)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, WewedSpacing.md)
                        .accessibilityIdentifier("planner-contracts-header")

                    ProductionLoadView(
                        id: 0,
                        section: "Contracts",
                        environment: appState.dataEnvironment,
                        load: { try await appState.contractsRepository.getServiceEngagements() }
                    ) { engagements in
                        if engagements.isEmpty {
                            Text("No managed service engagements recorded for this wedding.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        } else {
                            ForEach(engagements) { engagement in
                                ServiceEngagementCard(engagement: engagement)
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Vendors")
        .accessibilityIdentifier("planner-vendors-root")
        .task {
            vendors = (try? await appState.plannerRepository.getVendorEngagements()) ?? []
        }
    }

    private func statusPill(_ label: String, _ value: String) -> some View {
        Text("\(label): \(value)")
            .font(.caption2)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(WewedColors.gold.opacity(0.12))
            .cornerRadius(WewedRadius.pill)
    }
}

public struct ShadowPlannerSeatingView: View {
    @EnvironmentObject private var appState: AppState
    @State private var tables: [PlannerSeatingTable] = []

    public init() {}

    private var totalCapacity: Int { tables.reduce(0) { $0 + $1.capacity } }
    private var totalAssigned: Int { tables.reduce(0) { $0 + $1.assigned } }

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.lg) {
                HStack {
                    VStack(alignment: .leading) {
                        Text("\(totalAssigned) assigned")
                            .font(.title3)
                            .fontWeight(.bold)
                        Text("of \(totalCapacity) seats")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    Text("\(max(0, totalCapacity - totalAssigned)) available")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(WewedColors.emerald)
                }
                .padding()
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                ForEach(tables) { table in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text(table.name)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                            Spacer()
                            Text("\(table.assigned)/\(table.capacity)")
                                .font(.caption)
                                .fontWeight(.bold)
                        }
                        Text(table.zone)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        ProgressView(value: Double(table.assigned), total: Double(max(table.capacity, 1)))
                            .tint(table.assigned > table.capacity ? WewedColors.error : WewedColors.emerald)
                        if let attention = table.attentionLabel {
                            Text(attention)
                                .font(.caption2)
                                .foregroundColor(WewedColors.goldDark)
                        }
                    }
                    .padding()
                    .background(Color.white)
                    .cornerRadius(WewedRadius.lg)
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Seating")
        .accessibilityIdentifier("planner-seating-root")
        .task {
            tables = (try? await appState.plannerRepository.getSeatingTables()) ?? []
        }
    }
}

public struct ShadowPlannerTimelineView: View {
    @EnvironmentObject private var appState: AppState
    @State private var entries: [PlannerTimelineEntry] = []

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                ForEach(entries) { entry in
                    HStack(alignment: .top, spacing: 12) {
                        Text(entry.time)
                            .font(.subheadline)
                            .fontWeight(.bold)
                            .foregroundColor(WewedColors.gold)
                            .frame(width: 50, alignment: .leading)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(entry.title)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                            Text(entry.location)
                                .font(.caption)
                                .foregroundColor(.secondary)
                            if let vendor = entry.linkedVendor {
                                Text(vendor)
                                    .font(.caption2)
                                    .foregroundColor(WewedColors.emerald)
                            }
                        }
                        Spacer()
                        Text(entry.statusLabel)
                            .font(.caption2)
                            .fontWeight(.semibold)
                    }
                    .padding()
                    .background(Color.white)
                    .cornerRadius(WewedRadius.lg)
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Timeline")
        .accessibilityIdentifier("planner-timeline-root")
        .task {
            entries = (try? await appState.plannerRepository.getTimelineEntries()) ?? []
        }
    }
}


public struct ShadowPlannerDocumentsView: View {
    @EnvironmentObject private var appState: AppState

    public init() {}

    public var body: some View {
        // Master plan Phase 8 closure §3/round 3 §2 — ProductionPlannerDashboardRepository.getDocuments()
        // reads the real Vault catalog (`/api/native/wedding/vault`, the same `listWeddingVaultObjects`
        // engine the PWA uses). A genuinely fetched empty list is an honest "no documents recorded",
        // exactly like Budget/Seating/Timeline; a live failure (transport/permission/revocation) must
        // render as unavailable instead, never fall back to that same empty state. The managed-contract
        // lifecycle (Deal Room, versions, review/acceptance) is a separate, still-unwired domain — not
        // shown here at all, so it is never confused with this Vault listing.
        ProductionLoadView(
            id: 0,
            section: "Documents",
            environment: appState.dataEnvironment,
            load: { try await appState.plannerRepository.getDocuments() }
        ) { records in
            DocumentsListContent(records: records)
        }
        .navigationTitle("Documents")
        .accessibilityIdentifier("planner-documents-root")
    }
}

private struct DocumentsListContent: View {
    let records: [PlannerDocumentRecord]

    var body: some View {
        Group {
            if records.isEmpty {
                VStack(spacing: WewedSpacing.sm) {
                    Image(systemName: "doc.text")
                        .font(.title2)
                        .foregroundColor(WewedColors.gold)
                    Text("Documents")
                        .font(.title3)
                        .fontWeight(.semibold)
                    Text("No contracts or documents recorded for this wedding.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding()
            } else {
                ScrollView {
                    VStack(spacing: WewedSpacing.sm) {
                        ForEach(records) { record in
                            HStack {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(record.title)
                                        .font(.subheadline)
                                        .fontWeight(.semibold)
                                    Text(record.kind)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if let status = record.statusLabel {
                                    Text(status)
                                        .font(.caption2)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(WewedColors.emerald)
                                }
                            }
                            .padding()
                            .background(Color.white)
                            .cornerRadius(WewedRadius.lg)
                        }
                    }
                    .padding()
                }
                .background(WewedColors.ivory)
            }
        }
    }
}

/// Master plan Phase 8 closure round 3 §3 — mirrors Android's `ServiceEngagementCard`.
private struct ServiceEngagementCard: View {
    let engagement: ServiceEngagementSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(engagement.vendorName)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    Text(engagement.serviceCategory)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text(engagement.lifecycleStatus)
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundColor(WewedColors.emerald)
            }
            if let agreedAmount = engagement.agreedAmount {
                Text("Agreed: \(agreedAmount) \(engagement.currency)")
                    .font(.caption)
                    .foregroundColor(WewedColors.goldDark)
            }
            if engagement.contracts.isEmpty {
                Text("No contract drafted yet")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            } else {
                ForEach(engagement.contracts) { contract in
                    Text("\(contract.contractNumber) · \(contract.status) · v\(contract.currentVersionNumber)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.lg)
    }
}
