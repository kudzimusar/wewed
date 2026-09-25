import Foundation
import SwiftUI

/// The Guest tabs, named to match the IA contract rather than reinvented.
public enum GuestSection: String, CaseIterable, Sendable {
    case home, invitation, pass, weddingDay, more

    var id: String {
        switch self {
        case .weddingDay: return "wedding_day"
        default: return rawValue
        }
    }

    var icon: String {
        switch self {
        case .home: return "house.fill"
        case .invitation: return "envelope.fill"
        case .pass: return "qrcode"
        case .weddingDay: return "sparkles"
        case .more: return "person.crop.circle.fill"
        }
    }

    var label: String {
        switch self {
        case .home: return "Home"
        case .invitation: return "Invitation"
        case .pass: return "Pass"
        case .weddingDay: return "Wedding Day"
        case .more: return "More"
        }
    }
}

/// The persistent experience an invitation-bound Guest lands in.
///
/// It reuses the Guest information architecture the app already defines — Home, Invitation, Pass,
/// Wedding Day, More — rather than inventing a second set of tab names. What it does *not* reuse is
/// the Shadow guest shell's implementation, which depends on the wedding graph, navigation context
/// and the full repository. Those are exactly the production surfaces this slice is not authorized
/// to switch on, so the live shell is built from the guest-authorized session alone.
///
/// This shell is reachable only after RSVP completion. Attending and declined Guests both retain
/// the persistent experience; venue admission remains attending-only.
public struct LiveGuestShellView: View {
    @Environment(\.openURL) private var openURL
    @State private var story = ""
    private let coordinator: LiveGuestInvitationCoordinator
    private let profile: LiveInvitationPresentation
    private let onOpenInvitation: () -> Void
    private let onForgetWedding: () -> Void

    private let section: GuestSection
    private let onSelect: (GuestSection) -> Void
    private let invitationContent: () -> AnyView

    public init(
        profile: LiveInvitationPresentation,
        coordinator: LiveGuestInvitationCoordinator,
        onOpenInvitation: @escaping () -> Void,
        section: GuestSection,
        onSelect: @escaping (GuestSection) -> Void,
        invitationContent: @escaping () -> AnyView,
        onForgetWedding: @escaping () -> Void
    ) {
        self.coordinator = coordinator
        self.section = section
        self.onSelect = onSelect
        self.invitationContent = invitationContent
        self.profile = profile
        self.onOpenInvitation = onOpenInvitation
        self.onForgetWedding = onForgetWedding
    }

    private var capabilities: Set<GuestCapability> {
        GuestCapabilityPolicy.capabilities(attending: profile.attending)
    }

    public var body: some View {
        ZStack {
            WeddingIdentityPalette.ivory.ignoresSafeArea()
            AccessibilityMarker("live-guest-shell", label: "Your wedding")

            VStack(spacing: 0) {
                if section == .invitation {
                    invitationContent()
                } else if section == .pass && profile.attending == true {
                    LiveIssuedGuestPassView(profile: profile, coordinator: coordinator)
                        .id(profile.guestId)
                } else if section == .weddingDay {
                    weddingDay
                } else if section == .more {
                    guestProfile
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            switch section {
                            case .home: home
                            case .pass: pass
                            default: EmptyView()
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(20)
                    }
                }

                Divider().foregroundStyle(WeddingIdentityPalette.hairline)
                HStack(spacing: 0) {
                    ForEach(GuestSection.allCases, id: \.self) { candidate in
                        Button {
                            if candidate == .invitation { onOpenInvitation() }
                            else { onSelect(candidate) }
                        } label: {
                            VStack(spacing: 4) {
                                Image(systemName: candidate.icon)
                                    .font(.system(size: 17))
                                Text(candidate.label)
                                    .font(.system(
                                        size: 11,
                                        weight: section == candidate ? .semibold : .regular
                                    ))
                                    .lineLimit(1)
                            }
                            .foregroundStyle(
                                section == candidate
                                    ? WeddingIdentityPalette.champagneDeep
                                    : WeddingIdentityPalette.muted
                            )
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 56)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("nav-guest-\(candidate.id)")
                        .accessibilityAddTraits(section == candidate ? .isSelected : [])
                    }
                }
                .background(WeddingIdentityPalette.ivorySoft)
            }
        }
    }

    /// The Guest's own wedding at a glance — the qualified Wewed wedding identity language,
    /// backed only by Guest-authorized session data.
    @ViewBuilder
    private var home: some View {
        guestHero

        Button(action: onOpenInvitation) {
            VStack(alignment: .leading, spacing: 7) {
                Text("MY DIGITAL INVITATION")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(WeddingIdentityPalette.champagneDeep)
                Text(profile.coupleNames)
                    .font(.system(size: 24, design: .serif))
                    .foregroundStyle(WeddingIdentityPalette.ink)
                Text("Open your interactive invitation →")
                    .font(.system(size: 14))
                    .foregroundStyle(WewedColors.emerald)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(WeddingIdentityPalette.champagne.opacity(0.20))
            .clipShape(RoundedRectangle(cornerRadius: 18))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("guest-home-digital-invitation")

        HStack(spacing: 10) {
            fact("RSVP", Self.rsvpLabel(profile.attending), "live-guest-rsvp-status")
            if capabilities.contains(.weddingPass) {
                fact("Wedding Pass", "Ready in Pass", "live-guest-pass-hint")
            }
        }

        fact("When", Self.formatWeddingDate(profile.weddingDate), "live-guest-date")
        fact("Where", [profile.venue, profile.venueCityCountry.isEmpty ? nil : profile.venueCityCountry]
                .compactMap { $0 }.joined(separator: " · "), "live-guest-venue")

        if capabilities.contains(.seating), let table = profile.tableName, !table.isEmpty {
            fact("Your table", table, "live-guest-table")
        }
    }

    private var guestHero: some View {
        ZStack(alignment: .bottomLeading) {
            WewedMediaImage(WewedAsset.heroWedding)
                .scaledToFill()
                .frame(maxWidth: .infinity)
                .frame(height: 350)
                .clipped()

            LinearGradient(
                colors: [.clear, Color.black.opacity(0.16), Color.black.opacity(0.82)],
                startPoint: .top,
                endPoint: .bottom
            )

            VStack(alignment: .leading, spacing: 8) {
                WeddingBrandMark()
                Spacer()
                Text(profile.coupleNames)
                    .font(.system(size: 36, design: .serif))
                    .italic()
                    .foregroundStyle(.white)
                    .accessibilityIdentifier("live-guest-couple")
                Text("YOUR WEDDING INVITATION")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(2.6)
                    .foregroundStyle(.white.opacity(0.90))
                Text(Self.formatWeddingDate(profile.weddingDate))
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(.white)

                TimelineView(.periodic(from: .now, by: 1)) { context in
                    if let countdown = Self.countdown(from: profile.weddingDate, now: context.date) {
                        HStack(spacing: 6) {
                            guestCountdownTile(countdown.days, "Days")
                            guestCountdownTile(countdown.hours, "Hours")
                            guestCountdownTile(countdown.minutes, "Mins")
                            guestCountdownTile(countdown.seconds, "Secs")
                        }
                        .padding(.top, 3)
                    }
                }

                Text("Welcome, \(profile.guestName)")
                    .font(.system(size: 14))
                    .foregroundStyle(.white.opacity(0.94))
                    .accessibilityIdentifier("live-guest-name")
            }
            .padding(17)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 350)
        .clipShape(RoundedRectangle(cornerRadius: 23))
        .overlay(
            RoundedRectangle(cornerRadius: 23)
                .stroke(WeddingIdentityPalette.champagne.opacity(0.35), lineWidth: 1)
        )
        .accessibilityIdentifier("live-guest-hero")
    }

    private func guestCountdownTile(_ value: Int, _ label: String) -> some View {
        VStack(spacing: 1) {
            Text("\(value)")
                .font(.system(size: 21, design: .serif))
            Text(label)
                .font(.system(size: 9))
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 7)
        .background(Color.black.opacity(0.46))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    /// The pass, or an honest statement of why there isn't one.
    @ViewBuilder
    private var pass: some View {
        Text("Wedding Pass")
            .font(.system(size: 22, design: .serif))
            .foregroundStyle(WeddingIdentityPalette.ink)

        if !capabilities.contains(.weddingPass) {
            if profile.attending == nil {
                fact("Not yet", "Available after you confirm attendance.", "live-guest-pass-pending")
            } else {
                fact("No venue admission pass is currently issued",
                     "Your invitation remains active. If your plans change, return to your invitation and update your RSVP.",
                     "live-guest-pass-declined")
                Button("Update RSVP in Invitation", action: onOpenInvitation)
                    .accessibilityIdentifier("live-guest-pass-change-rsvp")
            }
        } else {
            // Attending, but the credential comes from the Wedding Day issuer, which is not
            // reachable in production yet. Saying so beats rendering an empty QR frame.
            fact("Coming soon",
                 "Your pass will appear here once the couple's wedding-day check-in is live.",
                 "live-guest-pass-unavailable")
        }
    }

    /// Shared wedding-day information for answered Guests; venue-admission details stay attending-only.
    @ViewBuilder
    private var weddingDay: some View {
        if !capabilities.contains(.weddingDayProgramme) {
            IASectionList("Wedding Day", Self.formatWeddingDate(profile.weddingDate)) {
                IACard(
                    "Wedding Day details",
                    profile.attending == nil
                        ? "Confirm your attendance to see the day's plan."
                        : "The day's plan is for guests who are joining on the day.",
                    testId: "live-guest-day-locked"
                )
            }
        } else {
            LiveGuestDayDataView(
                profile: profile,
                coordinator: coordinator,
                capabilities: capabilities
            )
            .id(profile.guestId)
        }
    }

    /// The Guest's own profile. Presentation reuses approved Wewed IA cards while authority
    /// remains the live Guest Session and guest-scoped published wedding content.
    @ViewBuilder
    private var guestProfile: some View {
        IASectionList("My details", profile.coupleNames) {
            IACard(
                "My Digital Invitation",
                "Open the Ivory invitation and update your RSVP.",
                trailing: "Open",
                testId: "guest-profile-digital-invitation",
                onTap: onOpenInvitation
            )
            IACard("Name", profile.guestName, testId: "live-guest-profile-name")
            IACard("Wedding", profile.coupleNames, testId: "live-guest-profile-wedding")
            IACard(
                "RSVP",
                Self.rsvpLabel(profile.attending),
                status: profile.attending == true
                    ? "Attending"
                    : profile.attending == false ? "Not attending" : "Pending",
                testId: "live-guest-profile-rsvp"
            )
            if let meal = profile.mealChoice, !meal.isEmpty {
                IACard("Meal", meal, testId: "live-guest-profile-meal")
            }
            if profile.plusOne {
                IACard(
                    "Plus one",
                    profile.plusOneName ?? "Yes",
                    testId: "live-guest-profile-plus-one"
                )
            }
            if profile.kidsAttending {
                IACard(
                    "Children",
                    profile.kidsCount.map(String.init) ?? "Yes",
                    testId: "live-guest-profile-kids"
                )
            }
            if let dietary = profile.dietaryNotes, !dietary.isEmpty {
                IACard("Dietary / access", dietary, testId: "live-guest-profile-dietary")
            }
            if let message = profile.message, !message.isEmpty {
                IACard("Your message", message, testId: "live-guest-profile-message")
            }
            if let table = profile.tableName, !table.isEmpty {
                IACard("Table", table, testId: "live-guest-profile-table")
            }
            if !story.isEmpty {
                IACard("Our Story", story, testId: "guest-published-story")
            }
            IACard(
                "Couple Website",
                "Open the couple's public wedding site.",
                trailing: "Open",
                testId: "guest-profile-couple-site",
                onTap: {
                    guard let slug = profile.weddingSlug.addingPercentEncoding(
                        withAllowedCharacters: .alphanumerics
                    ), let url = URL(string: "https://wewed.pro/w/\(slug)") else { return }
                    openURL(url)
                }
            )
            IACard(
                "Forget this wedding on this device",
                "Removes this Guest relationship from this device. It does not affect your RSVP.",
                testId: "live-guest-forget-wedding",
                onTap: onForgetWedding
            )
        }
        .task(id: profile.guestId) {
            story = (try? await coordinator.publishedStory(slug: profile.weddingSlug)) ?? ""
        }
    }

    @ViewBuilder
    private func fact(_ label: String, _ value: String, _ identifier: String) -> some View {
        if !value.isEmpty {
            VStack(alignment: .leading, spacing: 2) {
                Text(label.uppercased())
                    .font(.system(size: 10))
                    .tracking(1.4)
                    .foregroundStyle(WeddingIdentityPalette.muted)
                Text(value)
                    .font(.system(size: 15))
                    .foregroundStyle(WeddingIdentityPalette.ink)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 6)
            .accessibilityIdentifier(identifier)
        }
    }

    static func rsvpLabel(_ attending: Bool?) -> String {
        switch attending {
        case .some(true): return "RSVP confirmed"
        case .some(false): return "Response recorded — not attending"
        case .none: return "Awaiting your reply"
        }
    }

    /// "23 December 2026" from whatever shape the graph returned.
    static func formatWeddingDate(_ raw: String?) -> String {
        let iso = String((raw ?? "").prefix(10))
        let parts = iso.split(separator: "-").map(String.init)
        guard parts.count >= 3, let monthIndex = Int(parts[1]), let day = Int(parts[2]),
              monthIndex >= 1, monthIndex <= 12 else { return raw ?? "" }
        let months = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"]
        return "\(day) \(months[monthIndex - 1]) \(parts[0])"
    }

    private static func countdown(
        from raw: String?,
        now: Date
    ) -> (days: Int, hours: Int, minutes: Int, seconds: Int)? {
        guard let target = weddingInstant(raw) else { return nil }
        var total = max(0, Int(target.timeIntervalSince(now)))
        let days = total / 86_400
        total %= 86_400
        let hours = total / 3_600
        total %= 3_600
        let minutes = total / 60
        let seconds = total % 60
        return (days, hours, minutes, seconds)
    }

    private static func weddingInstant(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        let iso = ISO8601DateFormatter()
        if let value = iso.date(from: raw) { return value }
        for format in ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm", "yyyy-MM-dd"] {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = format
            if let value = formatter.date(from: raw) { return value }
        }
        return nil
    }
}

private struct LiveIssuedGuestPassView: View {
    let profile: LiveInvitationPresentation
    let coordinator: LiveGuestInvitationCoordinator
    @State private var pass: WeddingPass?
    @State private var failed = false
    var body: some View {
        Group {
            if let pass { WeddingReferencePassView(pass: pass, showScanner: false) }
            else if failed { Text("Your Wedding Pass is unavailable. Please try again later.").accessibilityIdentifier("live-guest-pass-unavailable") }
            else { ProgressView("Loading Wedding Pass…") }
        }.task {
            do { pass = try await coordinator.weddingPass(guestId: profile.guestId) }
            catch is CancellationError { }
            catch { failed = true }
        }
    }
}

private struct LiveGuestDayDataView: View {
    let profile: LiveInvitationPresentation
    let coordinator: LiveGuestInvitationCoordinator
    let capabilities: Set<GuestCapability>
    @State private var day: GuestWeddingDay?
    @State private var failed = false

    var body: some View {
        IASectionList(
            "Wedding Day",
            [LiveGuestShellView.formatWeddingDate(profile.weddingDate), profile.venue ?? ""]
                .filter { !$0.isEmpty }
                .joined(separator: " · ")
        ) {
            if failed {
                IACard(
                    "Wedding Day unavailable",
                    "We couldn't load the day's details. Please try again.",
                    testId: "guest-day-unavailable"
                )
            } else if day == nil {
                HStack {
                    Spacer()
                    ProgressView().tint(WeddingIdentityPalette.champagneDeep)
                    Spacer()
                }
                .padding(.vertical, 24)
            }

            if let day {
                GuestPresentationSectionHeading("Programme", identifier: "guest-day-programme")
                if day.programme.isEmpty {
                    IACard("Programme", "No programme items have been published yet.")
                } else {
                    ForEach(day.programme, id: \.id) { item in
                        IACard(
                            item.title,
                            trailing: item.time,
                            testId: "guest-programme-\(item.id)"
                        )
                    }
                }

                if capabilities.contains(.announcements) {
                    GuestPresentationSectionHeading(
                        "Announcements",
                        identifier: "guest-day-announcements"
                    )
                    if day.announcements.isEmpty {
                        IACard("No announcements", "The wedding team has not posted an update.")
                    } else {
                        ForEach(day.announcements, id: \.id) { item in
                            IACard(
                                item.title ?? "Wedding update",
                                item.body,
                                testId: "guest-announcement-\(item.id)"
                            )
                        }
                    }
                }

                if capabilities.contains(.partyDetails) {
                    GuestPresentationSectionHeading("My Party", identifier: "guest-day-party")
                    ForEach(day.guest.household, id: \.attendeeKey) { member in
                        IACard(
                            member.attendeeName,
                            "Your wedding party",
                            testId: "guest-party-member-\(member.attendeeKey)"
                        )
                    }
                }

                GuestPresentationSectionHeading(
                    "Wedding details",
                    identifier: "guest-day-details"
                )
                IACard(
                    "Date",
                    LiveGuestShellView.formatWeddingDate(profile.weddingDate),
                    testId: "live-guest-day-date"
                )
                IACard(
                    "Venue",
                    [profile.venue, profile.venueCityCountry.isEmpty ? nil : profile.venueCityCountry]
                        .compactMap { $0 }
                        .joined(separator: " · "),
                    testId: "live-guest-day-venue"
                )
                if capabilities.contains(.seating), let table = day.guest.tableName {
                    IACard("My Table", table, testId: "guest-day-table")
                }
                if capabilities.contains(.checkInState) {
                    IACard(
                        "Admission",
                        day.guest.checkedIn ? "Checked in" : "Not yet checked in",
                        status: day.guest.checkedIn ? "Arrived" : "Wedding-day status",
                        testId: "guest-day-check-in"
                    )
                }
            }
        }
        .task(id: profile.guestId) {
            do {
                day = try await coordinator.weddingDay(guestId: profile.guestId)
                failed = false
            } catch is CancellationError {
            } catch {
                failed = true
            }
        }
    }
}

private struct GuestPresentationSectionHeading: View {
    let title: String
    let identifier: String

    init(_ title: String, identifier: String) {
        self.title = title
        self.identifier = identifier
    }

    var body: some View {
        Text(title)
            .font(.system(size: 17, weight: .semibold, design: .serif))
            .foregroundStyle(WeddingIdentityPalette.ink)
            .padding(.top, 8)
            .padding(.bottom, 2)
            .accessibilityIdentifier(identifier)
    }
}
