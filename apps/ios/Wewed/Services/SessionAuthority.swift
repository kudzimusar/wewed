import Foundation

/// Accounts that can sign in to a Shadow build. Only couple is backed by a source relationship;
/// every other account is either the guest's own invitation or an explicit UAT overlay.
public enum ShadowAccount: String, CaseIterable, Sendable {
    case couple
    case planner
    case coupleAndPlanner = "couple_planner"
    case guest
    case vendor
    case usher
    case coordinator
    case admin

    public static func from(key raw: String?) -> ShadowAccount? {
        guard let raw else { return nil }
        let key = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().replacingOccurrences(of: "-", with: "_")
        return ShadowAccount(rawValue: key)
    }
}

public enum SessionAuthorityError: Error, Equatable, LocalizedError {
    case productionAuthenticationUnavailable
    case invitationTokenRequired
    case invitationNotRecognised
    case noVendorEngagement

    public var errorDescription: String? {
        switch self {
        case .productionAuthenticationUnavailable: return "Production sign-in is not available in this native build."
        case .invitationTokenRequired: return "A guest can only sign in with their own invitation link."
        case .invitationNotRecognised: return "This invitation link was not recognised."
        case .noVendorEngagement: return "There is no vendor engagement to scope a vendor session to."
        }
    }
}

/// Resolves who is signing in and exactly which roles they hold for which wedding.
/// UI never picks a role on its own; it can only choose among the grants returned here.
/// Mirrors Android `SessionAuthority`.
public enum SessionAuthority {
    public static let defaultGuestInvitationToken = "shadow-pending-guest"

    static let plannerOverlayNote =
        "Test access only. This planner's interest was accepted, but no planner engagement is recorded for this wedding."
    static let vendorOverlayNote =
        "Test access only. No vendor sign-in is recorded for this wedding; this session is limited to one vendor's own engagement."
    static let usherOverlayNote = "Test access only. Gate team sign-ins are not recorded for this wedding."
    static let coordinatorOverlayNote = "Test access only. No coordinator membership is recorded for this wedding."
    static let adminOverlayNote = "Test access only. Support access is read-only and every view is recorded in the audit log."

    public static func signIn(
        account: ShadowAccount,
        environment: NativeDataEnvironment,
        wedding: WeddingRepositoryProtocol,
        planner: PlannerDashboardRepositoryProtocol,
        invitationToken: String? = nil
    ) async throws -> AuthorizedSession {
        guard environment.allowsMutableNativeDevelopment else {
            throw SessionAuthorityError.productionAuthenticationUnavailable
        }
        if account == .guest {
            return try await signInWithInvitation(
                token: invitationToken ?? defaultGuestInvitationToken,
                environment: environment,
                wedding: wedding
            )
        }

        let record = try await wedding.getWedding()
        func overlay(_ role: AppRole, _ note: String, vendorId: String? = nil) -> RoleGrant {
            RoleGrant(
                role: role,
                weddingId: record.id,
                weddingTitle: record.coupleNames,
                provenance: .shadowTestOverlay,
                provenanceNote: note,
                vendorId: vendorId
            )
        }
        let coupleGrant = RoleGrant(
            role: .couple,
            weddingId: record.id,
            weddingTitle: record.coupleNames,
            provenance: environment == .privateRealShadow ? .sourceRecord : .sanitizedFixture,
            provenanceNote: "This account owns the wedding record."
        )

        switch account {
        case .couple:
            return AuthorizedSession(accountId: "couple:\(record.id)", displayName: record.coupleNames, grants: [coupleGrant])
        case .planner:
            return AuthorizedSession(
                accountId: "planner:\(record.id)",
                displayName: try await plannerDisplayName(planner),
                grants: [overlay(.planner, plannerOverlayNote)]
            )
        case .coupleAndPlanner:
            return AuthorizedSession(
                accountId: "couple-planner:\(record.id)",
                displayName: record.coupleNames,
                grants: [coupleGrant, overlay(.planner, plannerOverlayNote)]
            )
        case .vendor:
            guard let engagement = try await planner.getVendorEngagements().first(where: { !($0.vendorId ?? "").isEmpty }),
                  let vendorId = engagement.vendorId else {
                throw SessionAuthorityError.noVendorEngagement
            }
            return AuthorizedSession(
                accountId: "vendor:\(vendorId)",
                displayName: engagement.vendorName,
                grants: [overlay(.vendor, vendorOverlayNote, vendorId: vendorId)]
            )
        case .usher:
            return AuthorizedSession(accountId: "usher:\(record.id)", displayName: "Gate team", grants: [overlay(.usher, usherOverlayNote)])
        case .coordinator:
            return AuthorizedSession(accountId: "coordinator:\(record.id)", displayName: "Wedding-day coordinator", grants: [overlay(.coordinator, coordinatorOverlayNote)])
        case .admin:
            return AuthorizedSession(accountId: "admin:support", displayName: "Wewed support", grants: [overlay(.admin, adminOverlayNote)])
        case .guest:
            preconditionFailure("handled above")
        }
    }

    /// A guest proves who they are with their own invitation; the grant is pinned to that guest record.
    public static func signInWithInvitation(
        token: String,
        environment: NativeDataEnvironment,
        wedding: WeddingRepositoryProtocol
    ) async throws -> AuthorizedSession {
        guard environment.allowsMutableNativeDevelopment else {
            throw SessionAuthorityError.productionAuthenticationUnavailable
        }
        let trimmed = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw SessionAuthorityError.invitationTokenRequired }
        let record = try await wedding.getWedding()
        let invitation: InvitationContext
        do {
            invitation = try await wedding.resolveInvitation(weddingSlug: record.id, token: trimmed)
        } catch {
            throw SessionAuthorityError.invitationNotRecognised
        }
        guard let guestId = invitation.guestId else { throw SessionAuthorityError.invitationNotRecognised }
        return AuthorizedSession(
            accountId: "guest:\(guestId)",
            displayName: invitation.guestName,
            grants: [
                RoleGrant(
                    role: .guest,
                    weddingId: record.id,
                    weddingTitle: record.coupleNames,
                    provenance: .invitationToken,
                    provenanceNote: "Signed in with this guest's own invitation.",
                    guestId: guestId
                )
            ]
        )
    }

    private static func plannerDisplayName(_ planner: PlannerDashboardRepositoryProtocol) async throws -> String {
        let context = try await planner.getDashboard().plannerContext
        let name = context.components(separatedBy: " •").first?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return name.isEmpty ? "Planner" : name
    }
}
