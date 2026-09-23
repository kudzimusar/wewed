import Foundation

/// Where a guest is in their live invitation entry.
///
/// Every state is one the UI must actually be able to show. There is deliberately no "failed
/// quietly" state: a guest whose entry did not work has to be told, because the alternative looks
/// identical to the app opening as whoever was already signed in.
public enum LiveInvitationState: Equatable, Sendable {
    case idle
    /// The credential is being exchanged. The card is not shown yet, and neither is the workspace.
    case exchanging
    /// The wedding's own authority has answered. Everything the card needs is in the snapshot, and
    /// the raw credential is gone.
    case presenting(GuestInvitationSnapshot)
    /// The invitation was refused. Fails closed: never falls back to the previously active guest.
    case refused(InvitationRejection?)
    /// The invitation is probably fine but Wewed could not be reached.
    ///
    /// Kept distinct from `refused` because they mean opposite things to a guest: one says "this
    /// link is not yours", the other says "try again in a moment".
    case unavailable(status: Int?)
}

/// What came back from answering.
public enum RsvpOutcome: Equatable, Sendable {
    /// Master plan Phase 9 — carries the full record the server actually stored.
    case saved(rsvp: GuestRsvpRecord)
    /// The card on screen belongs to a guest who is no longer the active one.
    ///
    /// Surfaced, never swallowed. The server refused to write Guest A's answer onto Guest B, and
    /// the guest needs to know their answer did not save rather than believing it did.
    case reopenRequired
    case childrenNotAllowed
    case unavailable(status: Int?)
}

/// What came back from preparing to edit the RSVP.
///
/// Ensures the RSVP form is populated with fresh server truth and bound to the active guest.
public enum RsvpEditorPreparation: Equatable, Sendable {
    case ready(snapshot: GuestInvitationSnapshot)
    case reopenRequired
    /// The refreshed snapshot named a different wedding or a different guest than the one
    /// currently presented.
    ///
    /// Not `reopenRequired`: the session was not revoked, and the presented card is not wrong.
    /// It means the server has moved on to someone else while this card was open. The binding
    /// captured at presentation time — `activeWeddingSlug` / `presentedGuestId` — is left
    /// completely untouched. There is no rebind, no retry, and no opening the replacement
    /// guest's editor: the presented card still belongs to the original guest, and an answer
    /// submitted after this result must still be attributed to them.
    case staleOrReplacedGuest
    case unavailable(status: Int?)
}

/// The one place the live invitation journey happens.
///
/// ```
/// InvitationEntry → identity exchange → guest-session snapshot → presentation → RSVP
/// ```
///
/// It exists so that live network behaviour is not scattered through views. Before this, a parsed
/// handoff was recognised and then never redeemed, and RSVP went to a Shadow repository — so the
/// parser tests passed while the app ignored the result. One coordinator makes that gap impossible
/// to reintroduce without deleting a method.
///
/// It holds no raw credential. The token is used once, by ``GuestSessionClient``, and the
/// coordinator only ever sees what the server said about the guest.
public actor LiveGuestInvitationCoordinator {

    public func publishedStory(slug: String) async throws -> String { try await client.publishedStory(slug: slug) }
    public func weddingDay(guestId: String) async throws -> GuestWeddingDay { try await client.loadWeddingDay(originGuestId: guestId) }
    public func weddingPass(guestId: String) async throws -> WeddingPass { try await client.loadWeddingPass(originGuestId: guestId) }

    private let client: GuestSessionClient

    /// The wedding of the card currently presented — the presentation, not the stored session.
    /// Set only when a card is actually presented; cleared the moment a new entry begins.
    private var activeWeddingSlug: String?

    /// The guest the presented card belongs to. It is what binds an answer to the right record.
    private var presentedGuestId: String?

    #if DEBUG
    public var testActiveWeddingSlug: String? { activeWeddingSlug }
    public var testPresentedGuestId: String? { presentedGuestId }
    #endif

    public init(client: GuestSessionClient) {
        self.client = client
    }

    /// Enters the invitation.
    ///
    /// A private link is exchanged; an opaque handoff is redeemed. Both end in the same place — a
    /// server-issued session and a snapshot read back from it — because after entry the two are
    /// indistinguishable and should be.
    public func enter(_ entry: InvitationEntry) async -> LiveInvitationState {
        // A new explicit entry ends the current presentation before anything else happens. The
        // binding names the card on screen, and from this moment that card is no longer what the
        // guest is acting on: if the new entry is refused or cannot reach Wewed, nothing may still
        // answer or refresh as the previously presented Guest (master plan §6.5).
        //
        // This clears the PRESENTATION only. The remembered secure session is untouched — the
        // client writes a session only after a new one is issued — so a refused Guest B never
        // deletes Guest A's session, and an explicit restore can bring A back.
        endPresentation()
        switch entry {
        case let .rejected(reason):
            return .refused(reason)
        case let .privateInvitation(weddingSlug, rsvpToken):
            return await exchange {
                try await self.client.exchangePrivateInvitation(weddingSlug: weddingSlug,
                                                                rsvpToken: rsvpToken)
            }
        case let .handoff(secret):
            // The path that used to be acknowledged and then dropped.
            return await exchange { try await self.client.redeemHandoff(secret) }
        }
    }

    /// Drops the presented-card binding. Never touches the stored session.
    private func endPresentation() {
        activeWeddingSlug = nil
        presentedGuestId = nil
    }

    /// Restores the guest this device already holds a session for, without any credential.
    public func restoreRememberedGuest() async -> LiveInvitationState {
        guard let slug = await client.activeSessionSlug() else { return .idle }
        return await load(slug)
    }

    private func exchange(
        _ block: () async throws -> GuestSessionIdentity
    ) async -> LiveInvitationState {
        do {
            let identity = try await block()
            return await load(identity.weddingSlug)
        } catch let error as GuestSessionError {
            switch error {
            // The server declined the credential. That is a refusal, and it must not restore
            // whoever was active before.
            case .unauthorized: return .refused(nil)
            case let .transport(status): return .unavailable(status: status)
            }
        } catch {
            return .unavailable(status: nil)
        }
    }

    private func load(_ weddingSlug: String) async -> LiveInvitationState {
        do {
            let snapshot = try await client.loadInvitation(weddingSlug: weddingSlug)
            activeWeddingSlug = snapshot.weddingSlug
            presentedGuestId = snapshot.guestId
            return .presenting(snapshot)
        } catch let error as GuestSessionError {
            switch error {
            case .unauthorized: return .refused(nil)
            case let .transport(status): return .unavailable(status: status)
            }
        } catch {
            return .unavailable(status: nil)
        }
    }

    /// Answers on behalf of the guest whose card is open.
    ///
    /// The binding is `presentedGuestId`, captured when the card was built — not whoever the
    /// session happens to name now. That is the whole point: if the session moved on while the card
    /// was open, the server returns `STALE_GUEST_CONTEXT` and the answer is not written to the
    /// wrong person.
    ///
    /// Master plan Phase 9 — `update` carries the full converged RSVP field set (attendance, meal,
    /// plus-one, children, dietary notes, message), not just attendance. `presentedGuestId` is
    /// untouched by this change: it remains captured only at presentation time, never at save time.
    public func answer(_ update: GuestRsvpUpdate) async -> RsvpOutcome {
        guard let slug = activeWeddingSlug,
              let guestId = presentedGuestId, !guestId.isEmpty
        else { return .reopenRequired }

        do {
            let result = try await client.saveRsvp(weddingSlug: slug,
                                                   originGuestId: guestId,
                                                   update: update)
            switch result {
            case let .saved(rsvp): return .saved(rsvp: rsvp)
            case .staleGuestContext, .notAuthorized: return .reopenRequired
            case .childrenNotAllowed: return .childrenNotAllowed
            case let .failed(status): return .unavailable(status: status)
            }
        } catch let error as GuestSessionError {
            if case let .transport(status) = error { return .unavailable(status: status) }
            return .reopenRequired
        } catch {
            return .unavailable(status: nil)
        }
    }

    /// Ends the Guest relationship on this device.
    ///
    /// Clears the stored session and the coordinator's own memory of who was presented, so nothing
    /// can answer on behalf of a guest who has been forgotten.
    public func forgetGuest() async {
        await client.clearSession()
        activeWeddingSlug = nil
        presentedGuestId = nil
    }

    /// Re-reads the card after an answer, so what is shown is what the server stored.
    public func refresh() async -> LiveInvitationState {
        guard let slug = activeWeddingSlug else { return .idle }
        return await load(slug)
    }

    /// Pre-open refresh before opening the RSVP editor.
    ///
    /// In accordance with Master Plan Phase 9: tapping RSVP / Update RSVP captures
    /// `expectedWeddingSlug` and `expectedGuestId` from the presentation binding before any
    /// network I/O, calls only `client.loadInvitation(expectedWeddingSlug)` — never `refresh()`,
    /// `load()`, or `restoreRememberedGuest()`, which mutate the binding as a side effect — and
    /// compares the refreshed snapshot's identity against what was captured *before* touching
    /// coordinator state.
    ///
    /// A session that was revoked or is unreachable fails closed as `.reopenRequired` /
    /// `.unavailable`. A session that is still valid but now names a different wedding or guest
    /// is a distinct case — `.staleOrReplacedGuest` — and never mutates `activeWeddingSlug` /
    /// `presentedGuestId`: the presented card still belongs to the guest it was captured for, and
    /// must go on behaving that way.
    public func prepareRsvpEditor() async -> RsvpEditorPreparation {
        guard let expectedWeddingSlug = activeWeddingSlug,
              let expectedGuestId = presentedGuestId,
              !expectedGuestId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return .reopenRequired
        }

        let refreshedSnapshot: GuestInvitationSnapshot
        do {
            refreshedSnapshot = try await client.loadInvitation(weddingSlug: expectedWeddingSlug)
        } catch let error as GuestSessionError {
            switch error {
            case .unauthorized:
                endPresentation()
                return .reopenRequired
            case let .transport(status):
                return .unavailable(status: status)
            }
        } catch {
            return .unavailable(status: nil)
        }

        if refreshedSnapshot.weddingSlug != expectedWeddingSlug || refreshedSnapshot.guestId != expectedGuestId {
            // Do not touch activeWeddingSlug / presentedGuestId here. They already name the
            // correct (original) guest, and the presented card is still theirs — the server has
            // simply moved on to someone else. No rebind, no retry, no clearing: an answer()
            // submitted right after this must still be attributed to the original guest.
            return .staleOrReplacedGuest
        }

        activeWeddingSlug = refreshedSnapshot.weddingSlug
        presentedGuestId = refreshedSnapshot.guestId
        return .ready(snapshot: refreshedSnapshot)
    }
}
