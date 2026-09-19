import Foundation

/// Least-privilege role policy. Mirrors Android `CapabilityPolicy` exactly;
/// the cross-platform tests assert the same matrix on both.
public enum CapabilityPolicy {
    private static let publicWeddingInfo: Set<Capability> = [.viewWeddingSummary, .viewProgramme]

    private static let weddingManagement: Set<Capability> = publicWeddingInfo.union([
        .viewPlanningDashboard,
        .viewTasks,
        .manageTasks,
        .viewBudget,
        .viewGuestRoster,
        .viewContributions,
        .viewContributorIdentity,
        .viewAllVendorEngagements,
        .viewVendorPresence,
        .viewSeating,
        .viewDocuments,
        .editWeddingDetails,
        .previewGuestPasses,
        .viewAdmissionSummary,
        .scanAdmission,
        .lookupAdmission
    ])

    private static let gateOperations: Set<Capability> = [.scanAdmission, .lookupAdmission, .viewAdmissionSummary]

    public static func capabilities(for role: AppRole) -> Set<Capability> {
        switch role {
        case .couple:
            return weddingManagement
        case .planner:
            return weddingManagement.union([.plannerWorkspace, .plannerActions, .postAnnouncement])
        case .coordinator:
            return publicWeddingInfo.union(gateOperations).union([.viewTasks, .viewVendorPresence, .postAnnouncement])
        case .vendor:
            return publicWeddingInfo.union([.viewOwnVendorEngagement, .updateOwnVendorPresence])
        case .usher:
            return publicWeddingInfo.union(gateOperations)
        case .guest:
            return publicWeddingInfo.union([.viewOwnInvitation, .respondOwnRsvp, .viewOwnPass])
        case .admin:
            return [.viewWeddingSummary, .adminSupport]
        }
    }

    public static func allows(_ role: AppRole, _ capability: Capability) -> Bool {
        capabilities(for: role).contains(capability)
    }
}
