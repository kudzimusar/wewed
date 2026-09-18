import SwiftUI

// MARK: - Core Planning Module Views

public struct PlannerTasksView: View {
    @EnvironmentObject private var appState: AppState
    @State private var tasks: [PlannerTask] = []
    @State private var selectedFilter = "All"

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.base) {
                Picker("Filter", selection: $selectedFilter) {
                    Text("All").tag("All")
                    Text("To Do").tag("To Do")
                    Text("In Progress").tag("In Progress")
                    Text("Blocked").tag("Blocked")
                    Text("Done").tag("Done")
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                VStack(spacing: WewedSpacing.sm) {
                    ForEach(filteredTasks) { task in
                        HStack {
                            Image(systemName: task.status == .done ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(task.status == .done ? WewedColors.success : WewedColors.gold)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(task.title)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                Text("\(task.category) • Priority: \(task.priority.title)")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                        }
                        .padding()
                        .background(Color.white)
                        .cornerRadius(WewedRadius.md)
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
        .background(WewedColors.ivory)
        .navigationTitle("Tasks Checklist")
        .task {
            if let items = try? await appState.repository.getTasks() {
                tasks = items
            }
        }
    }

    private var filteredTasks: [PlannerTask] {
        switch selectedFilter {
        case "To Do": return tasks.filter { $0.status == .todo }
        case "In Progress": return tasks.filter { $0.status == .inProgress }
        case "Blocked": return tasks.filter { $0.status == .blocked }
        case "Done": return tasks.filter { $0.status == .done }
        default: return tasks
        }
    }
}

public struct PlannerBudgetView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.lg) {
                VStack(spacing: 8) {
                    Text("Total Wedding Budget")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text("$25,000")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundColor(WewedColors.gold)
                    ProgressView(value: 18500, total: 25000)
                        .tint(WewedColors.emerald)
                        .padding(.horizontal, 40)
                    Text("$18,500 Allocated • $6,500 Remaining")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                VStack(alignment: .leading, spacing: 12) {
                    Text("Allocations by Category")
                        .font(.headline)
                    BudgetItemRow(category: "Venue & Catering", allocated: "$12,000", paid: "$8,000", status: "Partially Paid")
                    BudgetItemRow(category: "Photography & Video", allocated: "$3,500", paid: "$3,500", status: "Paid in Full")
                    BudgetItemRow(category: "Decor & Florals", allocated: "$3,000", paid: "$1,500", status: "Deposit Paid")
                    BudgetItemRow(category: "Music & Sound", allocated: "$1,500", paid: "$500", status: "Pending Balance")
                }
                .padding()
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Budget Allocation")
    }
}

private struct BudgetItemRow: View {
    let category: String
    let allocated: String
    let paid: String
    let status: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(category).font(.subheadline).fontWeight(.semibold)
                Text("Paid: \(paid) of \(allocated)").font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            Text(status)
                .font(.caption2)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(WewedColors.emerald.opacity(0.1))
                .foregroundColor(WewedColors.emerald)
                .cornerRadius(WewedRadius.pill)
        }
        .padding(.vertical, 4)
    }
}

public struct PlannerContributionsView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.base) {
                VStack(spacing: 6) {
                    Text("Cash Gifts & Funding Milestones")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text("$7,420")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundColor(WewedColors.emerald)
                    Text("28 verified guest contributions")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity)
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                VStack(alignment: .leading, spacing: 10) {
                    Text("Recent Contributions")
                        .font(.headline)
                    ContributionRow(contributor: "Tendai & Chipo Moyo", amount: "$300", note: "For your honeymoon in Victoria Falls!", time: "2 hours ago")
                    ContributionRow(contributor: "Blessing Sithole", amount: "$150", note: "Congratulations guys!", time: "Yesterday")
                    ContributionRow(contributor: "Anonymous Guest", amount: "$500", note: "Blessings on your union", time: "Sep 15")
                }
                .padding()
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Contributions")
    }
}

private struct ContributionRow: View {
    let contributor: String
    let amount: String
    let note: String
    let time: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(contributor).font(.subheadline).fontWeight(.semibold)
                Text(note).font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(amount).font(.subheadline).fontWeight(.bold).foregroundColor(WewedColors.emerald)
                Text(time).font(.caption2).foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 6)
    }
}

public struct PlannerVendorsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var vendors: [VendorPresence] = []

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.sm) {
                ForEach(vendors) { v in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(v.vendorName).font(.subheadline).fontWeight(.semibold)
                            Text("\(v.serviceCategory) • \(v.serviceArea)").font(.caption).foregroundColor(.secondary)
                        }
                        Spacer()
                        Text(v.state.title)
                            .font(.caption2)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(WewedColors.gold.opacity(0.15))
                            .foregroundColor(WewedColors.gold)
                            .cornerRadius(WewedRadius.pill)
                    }
                    .padding()
                    .background(Color.white)
                    .cornerRadius(WewedRadius.md)
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Vendors")
        .task {
            if let list = try? await appState.repository.getVendors() {
                vendors = list
            }
        }
    }
}

public struct PlannerTimelineView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                TimelineItemRow(time: "10:00", title: "Bridal Party Hair & Makeup", location: "Bridal Suite", status: "Completed")
                TimelineItemRow(time: "13:30", title: "Gates Open & Guest Arrival", location: "Main Gate", status: "Active Now")
                TimelineItemRow(time: "14:00", title: "Ceremony Begins", location: "Chapel Garden", status: "Upcoming")
                TimelineItemRow(time: "15:30", title: "Family & Bridal Portraits", location: "Estate Lawn", status: "Upcoming")
                TimelineItemRow(time: "17:00", title: "Reception Entrance & Dinner", location: "Jacaranda Ballroom", status: "Upcoming")
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Timeline & Run-Sheet")
    }
}

private struct TimelineItemRow: View {
    let time: String
    let title: String
    let location: String
    let status: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text(time)
                .font(.subheadline)
                .fontWeight(.bold)
                .foregroundColor(WewedColors.gold)
                .frame(width: 50, alignment: .leading)

            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline).fontWeight(.medium)
                Text(location).font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            Text(status)
                .font(.caption2)
                .foregroundColor(status == "Completed" ? WewedColors.success : (status == "Active Now" ? WewedColors.emerald : .secondary))
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
    }
}

public struct PlannerSeatingView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                SeatingTableRow(tableName: "Baobab", tableNumber: 1, capacity: 10, assigned: 10, status: "Full")
                SeatingTableRow(tableName: "Acacia", tableNumber: 2, capacity: 8, assigned: 8, status: "Full")
                SeatingTableRow(tableName: "Jacaranda", tableNumber: 8, capacity: 8, assigned: 7, status: "1 Seat Free")
                SeatingTableRow(tableName: "Marula", tableNumber: 9, capacity: 10, assigned: 8, status: "2 Seats Free")
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Seating & Floor Plan")
    }
}

private struct SeatingTableRow: View {
    let tableName: String
    let tableNumber: Int
    let capacity: Int
    let assigned: Int
    let status: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(tableName) — Table \(tableNumber)").font(.subheadline).fontWeight(.semibold)
                Text("\(assigned) of \(capacity) Guests Assigned").font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            Text(status)
                .font(.caption2)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.gray.opacity(0.1))
                .cornerRadius(WewedRadius.pill)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
    }
}

public struct PlannerGuestsBridgeView: View {
    @EnvironmentObject private var appState: AppState
    @State private var guests: [Guest] = []

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: WewedSpacing.sm) {
                ForEach(guests) { g in
                    GuestBridgeRow(guest: g)
                }
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Guest List Bridge")
        .task {
            if let list = try? await appState.repository.getGuests() {
                guests = list
            }
        }
    }
}

private struct GuestBridgeRow: View {
    let guest: Guest

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(guest.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text("Table \(guest.tableNumber ?? 0) • Party of \(guest.partySize)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            Text(guest.rsvpStatus.rawValue.capitalized)
                .font(.caption2)
                .foregroundColor(guest.rsvpStatus == .attending ? WewedColors.success : .secondary)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
    }
}

// MARK: - Planner Tools & Operational Destinations

public struct ClientProfileView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Tariro & Shadreck Musarurwa")
                        .font(.title2).fontWeight(.bold)
                    Text("Wedding Date: 24 October 2026 • Imba Manor, Harare")
                        .font(.subheadline).foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Contact & Relationship Details").font(.headline)
                    Text("Primary Contact: Tariro (+263 77 123 4567)").font(.subheadline)
                    Text("Email: couple@wewed.pro").font(.subheadline)
                    Text("Preferred Theme: Ivory Floral & Champagne Gold").font(.subheadline)
                    Text("Guest Estimate: 150 guests").font(.subheadline)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Client Profile")
    }
}

public struct CollaborationHubView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Planning Team Access & Roles").font(.headline)
                TeamMemberRow(name: "Kudzie Musar (Lead Planner)", role: "Owner / Full Access", status: "Active")
                TeamMemberRow(name: "Tariro (Bride)", role: "Couple / Co-Planner", status: "Active")
                TeamMemberRow(name: "Nyasha Chiweshe", role: "Day-Of Coordinator", status: "Active")
                TeamMemberRow(name: "Imba Manor Gate Team", role: "Usher / Scanner Only", status: "Assigned")
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Collaboration Hub")
    }
}

private struct TeamMemberRow: View {
    let name: String
    let role: String
    let status: String

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.subheadline).fontWeight(.semibold)
                Text(role).font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            Text(status).font(.caption2).foregroundColor(WewedColors.success)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
    }
}

public struct PlannerOperationsView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Live Field Dispatch & Staff Roster").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                OperationTile(title: "Main Gate Check-In Station", detail: "2 Ushers Active • 82 Guests Admitted", status: "Operational")
                OperationTile(title: "Catering & Dietary Station", detail: "Chef briefed • 12 Special Diet meals ready", status: "On Schedule")
                OperationTile(title: "Audio & PA Systems", detail: "Garden chapel soundcheck completed", status: "Ready")
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Day-Of Operations")
    }
}

private struct OperationTile: View {
    let title: String
    let detail: String
    let status: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title).font(.subheadline).fontWeight(.semibold)
                Spacer()
                Text(status).font(.caption2).foregroundColor(WewedColors.emerald)
            }
            Text(detail).font(.caption).foregroundColor(.secondary)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
    }
}

public struct PlannerInvitationToolsView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Pass Provisioning & Physical QR Gateway").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                OperationTile(title: "Digital Passes Generated", detail: "150 of 150 passes issued with WW2 signatures", status: "100% Ready")
                OperationTile(title: "Physical Cards & QR Printed", detail: "Wax-sealed physical invitations linked", status: "Distributed")
                OperationTile(title: "Gate Scanner Trust Anchor", detail: "ECDSA Root Key Active: keyId #ww2-2026-prod", status: "Secure")
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Invitations & QR Tools")
    }
}

public struct EventCommandView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Event Command Center").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                OperationTile(title: "Current Milestone", detail: "Arrival & Welcome Drinks", status: "Phase 2 Active")
                OperationTile(title: "Live Attendance Pulse", detail: "82 Admitted (55% of guest allocation)", status: "Normal Flow")
                OperationTile(title: "Incident Log", detail: "0 critical escalations reported", status: "Clear")
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Event Command")
    }
}

public struct ReleaseCenterView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Handoff & Deliverable Release").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                OperationTile(title: "Master Seating Chart PDF", detail: "Exported & verified for venue manager", status: "Released")
                OperationTile(title: "Vendor Run-Sheet Dossier", detail: "Dispatched to photography, catering & sound", status: "Dispatched")
                OperationTile(title: "Gate Admission Audit Log", detail: "Archived with 82 verified audit records", status: "Pending Final Closeout")
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Release Centre")
    }
}

public struct WeddingBriefView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Wedding Brief & Aesthetic Directive").font(.headline)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Ceremonial Theme: Ivory Floral & Champagne Gold").font(.subheadline).fontWeight(.semibold)
                    Text("Key Elements: Botanical ivory stationery, gilded monograms, natural wood accents, warm lighting.").font(.caption).foregroundColor(.secondary)
                    Text("Music Style: Acoustic African gospel & soulful Afrobeats").font(.caption).foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.md)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Wedding Brief")
    }
}

public struct NotebookView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                NotebookNoteCard(title: "Meeting with Venue Coordinator", date: "Sep 14, 2026", preview: "Confirmed backup marquee in case of unexpected rain. Power generator check scheduled for 09:00.")
                NotebookNoteCard(title: "Cake Tasting Notes", date: "Sep 10, 2026", preview: "Selected 3-tier red velvet & champagne sponge with gold leaf accents.")
                NotebookNoteCard(title: "Usher Briefing Protocol", date: "Sep 05, 2026", preview: "Usher scanners will be paired at 12:00. Admittance stepper handles partial household entry.")
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Notebook")
    }
}

private struct NotebookNoteCard: View {
    let title: String
    let date: String
    let preview: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title).font(.subheadline).fontWeight(.semibold)
                Spacer()
                Text(date).font(.caption2).foregroundColor(.secondary)
            }
            Text(preview).font(.caption).foregroundColor(.secondary)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
    }
}

public struct MediaArchiveView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("High-Resolution Media Archive Vault").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                OperationTile(title: "Pre-Wedding Shoot & Story Assets", detail: "48 curated photos loaded", status: "Indexed")
                OperationTile(title: "Ceremonial Artwork Assets", detail: "Ivory tri-fold 3D textures & SVG monograms", status: "Optimized")
                OperationTile(title: "Live Wall Upload Vault", detail: "Guest photo submissions ready for moderation", status: "Active")
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Media Archive")
    }
}

public struct WewedAIWorkspaceView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Wewed AI Wedding Architect").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                OperationTile(title: "Timeline Optimization Engine", detail: "Calculated 15 min buffer between ceremony & photos", status: "Optimized")
                OperationTile(title: "Seating Arrangement Suggestions", detail: "Zero dietary conflicts across all 14 tables", status: "Balanced")
                OperationTile(title: "Speech & Vow Assistant", detail: "Groom & Best Man speaking drafts saved", status: "Ready")
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Wewed AI Workspace")
    }
}

// MARK: - Professional Planner Workspace Destinations

public struct PlannerPortfolioView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                PortfolioWeddingCard(couple: "Tariro & Shadreck", date: "24 Oct 2026", status: "Active • 37 Days", completion: 0.74)
                PortfolioWeddingCard(couple: "Ruvimbo & Farai", date: "12 Dec 2026", status: "Planning • 86 Days", completion: 0.42)
                PortfolioWeddingCard(couple: "Chido & Tinashe", date: "15 Jan 2027", status: "Scoping • 120 Days", completion: 0.15)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Planner Portfolio")
    }
}

private struct PortfolioWeddingCard: View {
    let couple: String
    let date: String
    let status: String
    let completion: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(couple).font(.headline)
                Spacer()
                Text(status).font(.caption2).foregroundColor(WewedColors.gold)
            }
            Text(date).font(.caption).foregroundColor(.secondary)
            ProgressView(value: completion)
                .tint(WewedColors.emerald)
            Text("\(Int(completion * 100))% Complete").font(.caption2).foregroundColor(.secondary)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
    }
}

public struct PlannerBookingsView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                BookingCard(client: "Tanaka & Rudo", service: "Full Wedding Planning", date: "Oct 02, 2026 at 14:00", status: "Confirmed")
                BookingCard(client: "Munyaradzi & Sarah", service: "Day-Of Coordination Consultation", date: "Oct 08, 2026 at 11:30", status: "Pending Deposit")
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Consultations & Bookings")
    }
}

private struct BookingCard: View {
    let client: String
    let service: String
    let date: String
    let status: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(client).font(.subheadline).fontWeight(.semibold)
                Spacer()
                Text(status).font(.caption2).foregroundColor(status == "Confirmed" ? WewedColors.emerald : WewedColors.warning)
            }
            Text(service).font(.caption).foregroundColor(.secondary)
            Text(date).font(.caption2).foregroundColor(WewedColors.gold)
        }
        .padding()
        .background(Color.white)
        .cornerRadius(WewedRadius.md)
    }
}

public struct ContractGovernanceView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Contract Governance & Legal Milestones").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                OperationTile(title: "Master Planning Agreement", detail: "Signed digitally by Kudzie Musar & Couple", status: "Executed")
                OperationTile(title: "Imba Manor Venue Lease", detail: "Deposit verified • Balance due 14 days prior", status: "Active")
                OperationTile(title: "Catering Service SLA", detail: "Minimum 140 covers guaranteed", status: "Locked")
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Contract Governance")
    }
}

public struct ContractIntelligenceView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Contract Intelligence & Risk Audit").font(.headline).frame(maxWidth: .infinity, alignment: .leading)
                OperationTile(title: "Force Majeure & Rain Contingency", detail: "Audited: Marquee provision covered under Clause 8.2", status: "Compliant")
                OperationTile(title: "Vendor Payment Milestone Guard", detail: "No advance payment released without signed milestone", status: "Protected")
                OperationTile(title: "Cancellation Terms", detail: "90-day grace period fully respected", status: "Low Risk")
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Contract Intelligence")
    }
}

public struct MarketplaceProfileView: View {
    public init() {}
    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Kudzie Musarurwa Events").font(.title2).fontWeight(.bold)
                    Text("Premium Wedding & Event Architect • Harare, Zimbabwe").font(.subheadline).foregroundColor(.secondary)
                    HStack(spacing: 4) {
                        Image(systemName: "star.fill").foregroundColor(WewedColors.gold)
                        Text("4.98 (42 Weddings Qualified)").font(.caption).fontWeight(.semibold)
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Service Offerings").font(.headline)
                    Text("• Full Wedding Architectural Design & Execution").font(.subheadline)
                    Text("• Day-Of Coordination & Gate Pass Management").font(.subheadline)
                    Text("• Luxury Stationery & Physical QR Integration").font(.subheadline)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white)
                .cornerRadius(WewedRadius.lg)
            }
            .padding()
        }
        .background(WewedColors.ivory)
        .navigationTitle("Marketplace Profile")
    }
}
