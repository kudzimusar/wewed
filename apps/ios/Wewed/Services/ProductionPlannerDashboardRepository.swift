import Foundation

/// Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8.
///
/// Real production adapter for the Planner-dashboard-shaped domains. Backs BOTH a wedding-scoped
/// grant (Planner/Couple/Coordinator — `weddingId` set) and a zero-wedding Planner-portfolio grant
/// (`weddingId` nil): every method here degrades to an honest empty/placeholder answer for the
/// portfolio case rather than fabricating a wedding, matching master plan §9 ("A Planner portfolio
/// with zero weddings must still work... must not fabricate a wedding").
///
/// `getContributions` reads the SAME `loadContributionWorkspace` engine the PWA's
/// `/api/planner/contributions` uses (via `/api/native/wedding/contributions`) — never a
/// client-recomputed funding truth. `getDocuments` (Phase 8 closure §3) likewise reads the SAME
/// `listWeddingVaultObjects` catalog the PWA's `/api/vault` uses. The managed-contract lifecycle
/// (Deal Room, contract versions/review/acceptance) has no native repository or UI surface at all
/// yet — see docs/native-mobile/WEWED_NATIVE_PHASE8_FIELD_CLASSIFICATION.md for why that is
/// deliberately out of this pass's scope rather than approximated here. Each Planner destination
/// view (`Views/Planner/ShadowPlannerDestinations.swift`) calls its own single repository method
/// independently in its own `.task`, with no shared `try`/`catch` across sections, so a thrown
/// failure for one unwired domain only affects that one section, never
/// Tasks/Budget/Seating/Timeline/Vendors.
public struct ProductionPlannerDashboardRepository: PlannerDashboardRepositoryProtocol {
    private let client: NativeDomainApiClient
    private let sessionToken: String
    private let grantId: String

    public init(client: NativeDomainApiClient, sessionToken: String, grantId: String) {
        self.client = client
        self.sessionToken = sessionToken
        self.grantId = grantId
    }

    public func getDashboard() async throws -> PlannerDashboardSnapshot {
        guard case let .success(overview) = await client.overview(sessionToken: sessionToken, grantId: grantId) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        let wedding = overview.wwObject("wedding")
        let counts = overview.wwObject("counts")
        let modules: [PlannerModuleSummary]
        if let counts {
            modules = [
                PlannerModuleSummary(
                    id: "tasks", title: "Tasks",
                    value: "\(counts.wwInt("tasksDone") ?? 0) / \(counts.wwInt("tasksTotal") ?? 0)",
                    attention: nil, systemImage: "checklist"
                ),
                PlannerModuleSummary(
                    id: "budget", title: "Budget",
                    value: "\(wwFormatCurrency(counts.wwDouble("budgetPaidTotal") ?? 0)) / \(wwFormatCurrency(counts.wwDouble("budgetEstimatedTotal") ?? 0))",
                    attention: nil, systemImage: "creditcard.fill"
                ),
                PlannerModuleSummary(
                    id: "guests", title: "Guests",
                    value: "\(counts.wwInt("guestsAttending") ?? 0) / \(counts.wwInt("guestsTotal") ?? 0)",
                    attention: nil, systemImage: "person.3.fill"
                ),
                PlannerModuleSummary(
                    id: "vendors", title: "Vendors",
                    value: "\(counts.wwInt("vendorsTotal") ?? 0) booked",
                    attention: nil, systemImage: "storefront.fill"
                ),
                PlannerModuleSummary(
                    id: "timeline", title: "Timeline",
                    value: "\(counts.wwInt("timelineEntries") ?? 0) events",
                    attention: nil, systemImage: "calendar.badge.clock"
                ),
            ]
        } else {
            modules = []
        }

        return PlannerDashboardSnapshot(
            weddingId: wedding?.wwString("id") ?? overview.wwString("businessAccountId") ?? "",
            coupleNames: wedding?.wwString("coupleNames") ?? overview.wwString("businessName") ?? "",
            weddingDateLabel: wedding?.wwString("date") ?? "No wedding selected",
            lifecycle: wedding?.wwString("lifecycle") ?? "portfolio",
            plannerContext: overview.wwString("businessName") ?? "",
            readinessScore: nil,
            taskCompletionLabel: counts.map { "\($0.wwInt("tasksDone") ?? 0) / \($0.wwInt("tasksTotal") ?? 0)" } ?? "",
            attentionItems: [],
            modules: modules,
            recentActivity: [],
            sourceLabel: "Live Wewed production data"
        )
    }

    public func getBudgetLines() async throws -> [PlannerBudgetLine] {
        guard case let .success(root) = await client.budget(sessionToken: sessionToken, grantId: grantId) else { throw ProductionReadOnlyDomainError.unavailable }
        return (root.wwArray("data") ?? []).map { item in
            let estimated = item.wwDouble("estimatedCost") ?? 0
            let actual = item.wwDouble("actualCost") ?? estimated
            let paid = item.wwDouble("paidAmount") ?? 0
            return PlannerBudgetLine(
                id: item.wwRequiredString("id"),
                category: item.wwString("category") ?? "",
                vendorName: item.wwString("vendorName")?.wwNilIfBlank,
                estimated: estimated,
                actual: actual,
                paid: paid,
                dueDateLabel: item.wwString("dueDate")?.wwNilIfBlank,
                fundingLabel: "",
                statusLabel: paid >= actual ? "Paid" : "Balance due"
            )
        }
    }

    public func getContributions() async throws -> [PlannerContributionRecord] {
        // Master plan Phase 8 closure §11 — matches the established Budget/Seating/Timeline/Vendor
        // pattern: this repository is only ever consulted once a real wedding-scoped grant has
        // rendered a role shell (a Planner-portfolio grant never reaches this call at all — it stays
        // on the earlier no-role production branch), so a transport/permission failure here is a
        // genuine live-domain failure, never an honest "zero contributions" to fabricate.
        guard case let .success(root) = await client.contributions(sessionToken: sessionToken, grantId: grantId) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        return (root.wwArray("data") ?? []).map { item in
            let allocatedAmount = item.wwDouble("allocatedAmount") ?? 0
            let verificationState = item.wwString("verificationState") ?? ""
            let rawType = item.wwString("type") ?? ""
            let lowered = rawType.replacingOccurrences(of: "_", with: " ").lowercased()
            let typeLabel = lowered.isEmpty ? lowered : lowered.prefix(1).uppercased() + lowered.dropFirst()
            let statusLabel = [item.wwString("commitmentState"), item.wwString("fulfillmentState")]
                .compactMap { $0 }
                .filter { !$0.isEmpty }
                .joined(separator: " · ")
            return PlannerContributionRecord(
                id: item.wwRequiredString("id"),
                contributorLabel: item.wwObject("contributor")?.wwString("displayName") ?? "Unknown contributor",
                typeLabel: typeLabel,
                value: item.wwDouble("amount") ?? 0,
                statusLabel: statusLabel,
                allocationLabel: allocatedAmount > 0 ? "Allocated \(allocatedAmount)" : "Unallocated",
                verified: ["CONFIRMED_BY_USER", "EVIDENCE_ATTACHED", "RECONCILED"].contains(verificationState)
            )
        }
    }

    public func getVendorEngagements() async throws -> [PlannerVendorEngagement] {
        guard case let .success(array) = await client.vendors(sessionToken: sessionToken, grantId: grantId) else { throw ProductionReadOnlyDomainError.unavailable }
        return array.map { item in
            PlannerVendorEngagement(
                id: item.wwRequiredString("id"),
                vendorId: item.wwRequiredString("id"),
                vendorName: item.wwString("name") ?? "",
                category: item.wwString("category") ?? "",
                bookingStatus: "",
                contractStatus: item.wwString("contractStatus") ?? "",
                paymentStatus: item.wwString("paymentStatus") ?? "",
                nextAction: ""
            )
        }
    }

    public func getSeatingTables() async throws -> [PlannerSeatingTable] {
        guard case let .success(array) = await client.seating(sessionToken: sessionToken, grantId: grantId) else { throw ProductionReadOnlyDomainError.unavailable }
        return array.map { item in
            let capacity = item.wwInt("capacity") ?? 0
            let assigned = item.wwInt("assigned") ?? 0
            return PlannerSeatingTable(
                id: item.wwRequiredString("id"),
                name: item.wwString("name") ?? "",
                zone: "",
                capacity: capacity,
                assigned: assigned,
                attentionLabel: assigned < capacity ? "\(capacity - assigned) seats free" : nil
            )
        }
    }

    public func getTimelineEntries() async throws -> [PlannerTimelineEntry] {
        guard case let .success(array) = await client.timeline(sessionToken: sessionToken, grantId: grantId) else { throw ProductionReadOnlyDomainError.unavailable }
        return array.map { item in
            PlannerTimelineEntry(
                id: item.wwRequiredString("id"),
                time: item.wwString("time") ?? "",
                title: item.wwString("title") ?? "",
                location: item.wwString("location") ?? "",
                statusLabel: "",
                linkedVendor: nil
            )
        }
    }

    /// Master plan Phase 8 closure §3 — reads the SAME `listWeddingVaultObjects` catalog the PWA's
    /// `/api/vault` GET uses (via `/api/native/wedding/vault`), never a second document truth. Same
    /// live-failure-throws contract as `getContributions`: this is only ever consulted once a real
    /// wedding-scoped grant has rendered a role shell, so a transport/permission failure here is
    /// genuine, never an honest "no documents" to fabricate.
    public func getDocuments() async throws -> [PlannerDocumentRecord] {
        guard case let .success(array) = await client.vault(sessionToken: sessionToken, grantId: grantId) else {
            throw ProductionReadOnlyDomainError.unavailable
        }
        return array.map { item in
            let available = item.wwBool("available") ?? true
            return PlannerDocumentRecord(
                id: item.wwRequiredString("id"),
                title: item.wwString("displayName") ?? item.wwString("originalFilename") ?? "",
                kind: item.wwString("category") ?? "wedding_document",
                statusLabel: available ? nil : "Not yet available"
            )
        }
    }
}

private func wwFormatCurrency(_ amount: Double) -> String {
    "$\(Int(amount.rounded()))"
}
