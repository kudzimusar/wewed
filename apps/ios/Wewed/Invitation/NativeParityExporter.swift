import CryptoKit
import Foundation
import SwiftUI

/// wewed.parity.v1 evidence from the iOS app itself (QRO 01 §13–§15).
///
/// The record states what THIS app parsed from the real backend for the Guest it is presenting, so
/// the live parity checker can prove iOS, Android and desktop are presentations of the same Guest
/// authority — by identifiers, never by matching labels.
///
/// Never carries a secret: human text is SHA-256 of its normalized form (identical to the server's
/// `parityTextDigest`), the Wedding Pass is SHA-256 of the exact credential bytes, and no session,
/// cookie or invitation token is read. Export happens only in a DEBUG build, only in the
/// productionPreview lane, and only when `WEWED_PARITY_EXPORT_LABEL` is set.
public enum NativeParityRecord {
    public static let contract = "wewed.parity.v1"

    public static func sha256Hex(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    /// NFC, trimmed, internal whitespace collapsed, lowercased — then SHA-256. Mirrors
    /// `parityTextDigest` in src/lib/parity/wewed-parity-v1.ts.
    public static func textDigest(_ value: String?) -> String? {
        guard let value else { return nil }
        let normalized = value.precomposedStringWithCanonicalMapping
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .lowercased()
        return normalized.isEmpty ? nil : sha256Hex(normalized)
    }

    static func weddingDate(_ iso: String?) -> String? {
        guard let iso else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return nil }
        let day = DateFormatter()
        day.calendar = Calendar(identifier: .gregorian)
        day.timeZone = TimeZone(identifier: "UTC")
        day.locale = Locale(identifier: "en_US_POSIX")
        day.dateFormat = "yyyy-MM-dd"
        return day.string(from: date)
    }

    /// The Guest's own record. `passState`/`passSerial`/`passToken` describe the Pass the app
    /// obtained (the token is digested here and never stored).
    public static func guestRecord(
        label: String,
        baseUrl: String,
        commitSha: String,
        snapshot: GuestInvitationSnapshot,
        passState: String?,
        passSerial: String?,
        passToken: String?
    ) -> [String: Any] {
        let rsvpStatus: String = snapshot.attending == true ? "attending" : snapshot.attending == false ? "declined" : "pending"
        func value(_ v: Any?) -> Any { v ?? NSNull() }
        return [
            "contract": contract, "label": label, "role": "guest", "client": "ios",
            "baseUrl": baseUrl, "commitSha": commitSha,
            "accessUserId": NSNull(), "grantId": NSNull(), "membershipRole": NSNull(), "permissions": NSNull(),
            "weddingId": value(snapshot.weddingId), "coupleId": NSNull(),
            "weddingDate": value(weddingDate(snapshot.date)),
            "weddingTitleDigest": value(textDigest(snapshot.title)),
            "coupleNamesDigest": NSNull(),
            "venueDigest": value(textDigest(snapshot.venue)),
            "businessAccountId": NSNull(), "vendorId": NSNull(), "serviceEngagementId": NSNull(),
            "guestId": snapshot.guestId.isEmpty ? NSNull() : snapshot.guestId,
            "guestNameDigest": value(textDigest(snapshot.guestName)),
            "rsvpStatus": rsvpStatus,
            "partySize": value(snapshot.partySize),
            "tableId": value(snapshot.seatingTableId),
            "mealChoice": value(snapshot.mealChoice),
            "invitationStyle": value(snapshot.invitationCardStyle),
            "invitationMessageDigest": value(textDigest(snapshot.invitationCardMessage)),
            "passAvailability": value(passState),
            "passSerial": value(passSerial),
            "passDigest": value(passToken.map(sha256Hex)),
            "gateGrantId": NSNull(), "gateId": NSNull(), "capabilities": NSNull(),
        ]
    }
}

#if DEBUG
/// DEBUG-only writer. Output: `<Documents>/wewed-parity/<label>-ios.json`, retrieved with
/// `xcrun simctl get_app_container booted pro.wewed.app.dev data`.
enum NativeParityExporter {
    struct Request {
        let label: String
        let commitSha: String
        let allowPassRetrieval: Bool
    }

    static func request(environment: [String: String] = ProcessInfo.processInfo.environment) -> Request? {
        guard NativeServerOrigin.active.isPreview,
              let label = environment["WEWED_PARITY_EXPORT_LABEL"]?.trimmingCharacters(in: .whitespaces),
              label.range(of: #"^[A-Z][A-Z0-9_-]{0,15}$"#, options: .regularExpression) != nil,
              let sha = environment["WEWED_PARITY_COMMIT_SHA"]?.trimmingCharacters(in: .whitespaces),
              sha.range(of: #"^[0-9a-f]{7,40}$"#, options: .regularExpression) != nil
        else { return nil }
        // Inside the T-14 window a Pass retrieval can issue a credential (a write): opt-in only.
        return Request(label: label, commitSha: sha, allowPassRetrieval: environment["WEWED_PARITY_ALLOW_PASS_GET"] == "1")
    }

    static func exportGuest(snapshot: GuestInvitationSnapshot, coordinator: LiveGuestInvitationCoordinator, request: Request) async {
        var passState: String?
        var passSerial: String?
        var passToken: String?
        if request.allowPassRetrieval {
            do {
                let pass = try await coordinator.weddingPass(guestId: snapshot.guestId)
                passState = "active"
                passSerial = pass.passSerial
                passToken = pass.qrPayload
            } catch GuestSessionError.passUnavailable(let availability) {
                passState = availability.state.rawValue
            } catch {
                passState = nil
            }
        }
        let record = NativeParityRecord.guestRecord(
            label: request.label,
            baseUrl: NativeServerOrigin.active.origin.absoluteString,
            commitSha: request.commitSha,
            snapshot: snapshot,
            passState: passState,
            passSerial: passSerial,
            passToken: passToken
        )
        guard let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
              let data = try? JSONSerialization.data(withJSONObject: record, options: [.prettyPrinted, .sortedKeys])
        else { return }
        let directory = documents.appendingPathComponent("wewed-parity", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try? data.write(to: directory.appendingPathComponent("\(request.label)-ios.json"), options: .atomic)
    }
}
#endif

extension View {
    /// Exports the presented Guest's parity record in a DEBUG productionPreview launch that asked
    /// for it; compiles to nothing in Release.
    @ViewBuilder
    func nativeParityExport(state: LiveInvitationState, coordinator: LiveGuestInvitationCoordinator) -> some View {
        #if DEBUG
        onChange(of: state) { _, newState in
            guard case let .presenting(snapshot) = newState, let request = NativeParityExporter.request() else { return }
            Task { await NativeParityExporter.exportGuest(snapshot: snapshot, coordinator: coordinator, request: request) }
        }
        #else
        self
        #endif
    }
}
