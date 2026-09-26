#!/usr/bin/env python3
"""Single source of truth for which production columns may enter a Private Real UAT snapshot.

WHY THIS EXISTS
    The first extractor ran `SELECT *`. That exported real product data (which UAT needs) together
    with credential, rollback and request-forensics columns (which UAT must never hold): RSVP.token,
    Guest.contributionToken, Message.authorToken, ImportJob.rollbackToken/rollbackData/previewData,
    AuditEvent.ipAddress/userAgent, and so on. Authorization to read a table is not authorization to
    copy every column in it onto a laptop.

THE RULE
    Export all real product data required for UAT, but no credential / security / internal-control
    data merely because it exists.

Both the production extractor and the canonical snapshot builder import ALLOWED_FIELDS from here,
so the boundary is defined exactly once and cannot drift between the two paths.
"""

from __future__ import annotations

# Columns allowed into the UAT snapshot, per production table.
# Anything not listed here is dropped, including columns added to production later: the allowlist
# is closed by construction, so a new production column cannot silently reach a native snapshot.
ALLOWED_FIELDS: dict[str, list[str]] = {
    "Wedding": [
        "id", "slug", "title", "monogram", "tagline", "date", "venue", "venueCity",
        "venueCountry", "venueMapUrl", "primaryColor", "accentColor", "memoryColor",
        "backgroundColor", "lifecycle", "privacy", "canonSealed", "canonSealedAt",
        "subscriptionTier", "coupleId", "invitationCardStyle", "invitationCardMessage",
        "rsvpDeadline", "createdAt", "updatedAt",
    ],
    "Guest": [
        "id", "weddingId", "name", "email", "phone", "role", "roleDetail", "side",
        "seatingTableId", "tableNumber", "contributionStatus", "createdAt", "updatedAt",
    ],
    "RSVP": [
        "id", "guestId", "attending", "mealChoice", "plusOne", "plusOneName", "plusOneMeal",
        "kidsAttending", "kidsCount", "songRequests", "dietaryNotes", "message",
        "checkedIn", "checkedInAt", "createdAt", "updatedAt",
    ],
    "PlannerTask": [
        "id", "weddingId", "title", "description", "category", "status", "priority",
        "dueDate", "assignee", "order", "createdAt", "updatedAt",
    ],
    "BudgetItem": [
        "id", "weddingId", "category", "description", "notes", "currency", "estimatedCost",
        "actualCost", "paidAmount", "dueDate", "vendorId", "vendorName",
        "serviceEngagementId", "createdAt", "updatedAt",
    ],
    "GuestContribution": [
        "id", "weddingId", "guestId", "displayName", "relationship", "type", "message",
        "favoriteSong", "photoUrl", "privacy", "status", "moderatorNotes", "submittedAt",
        "reviewedAt", "wordCount", "charCount", "createdAt", "updatedAt",
    ],
    "SeatingTable": ["id", "weddingId", "name", "capacity", "position", "createdAt", "updatedAt"],
    "ProgrammeItem": [
        "id", "weddingId", "title", "description", "time", "duration", "location",
        "icon", "displayIcon", "order", "createdAt", "updatedAt",
    ],
    "Vendor": [
        "id", "weddingId", "name", "category", "description", "contact", "email", "phone",
        "website", "notes", "imageUrl", "rating", "planningRating", "featured",
        "contractStatus", "paymentStatus", "createdAt", "updatedAt",
    ],
    "ServiceEngagement": [
        "id", "weddingId", "vendorId", "serviceCategory", "serviceDescription", "serviceDate",
        "serviceLocation", "agreedAmount", "currency", "lifecycleStatus", "origin",
        "recordMode", "historicalBasis", "externalAgreementReference",
        "externalAgreementStatus", "createdAt", "updatedAt",
    ],
    "EngagementParty": [
        "id", "weddingId", "serviceEngagementId", "partyKind", "partyRole", "displayName",
        "legalName", "email", "phone", "authorityBasis", "status", "requiredForReview",
        "entityId", "createdAt", "updatedAt",
    ],
    "Song": [
        "id", "weddingId", "title", "artist", "phase", "moment", "order", "votes",
        "notes", "playedAt", "spotifyUrl", "appleUrl", "createdAt", "updatedAt",
    ],
    "WeddingContent": [
        "id", "weddingId", "section", "field", "value", "order", "metadata",
        "createdAt", "updatedAt",
    ],
    "ContentRevision": [
        "id", "weddingId", "section", "fieldKey", "value", "previousValue", "status",
        "publishedAt", "scheduledFor", "authorId", "createdAt", "updatedAt",
    ],
    "Message": [
        "id", "weddingId", "authorName", "content", "type", "isPublic", "revealedAt",
        "createdAt", "updatedAt",
    ],
    "QRDestination": [
        "id", "weddingId", "label", "type", "url", "isActive", "scanCount",
        "createdAt", "updatedAt",
    ],
    "ImportJob": [
        "id", "weddingId", "moduleKey", "fileName", "status", "totalRows", "createdCount",
        "updatedCount", "skippedCount", "errorCount", "performedBy", "templateVersion",
        "createdAt", "updatedAt",
    ],
    "AuditEvent": [
        "id", "weddingId", "action", "actorId", "resourceType", "resourceId", "createdAt",
    ],
    "PlannerEnquiry": [
        "id", "weddingId", "plannerProfileId", "status", "message", "plannerResponse",
        "services", "weddingStyles", "budgetBand", "guestCountMin", "guestCountMax",
        "location", "weddingDate", "sharedSummary", "respondedAt", "withdrawnAt",
        "createdAt", "updatedAt",
    ],
    # Column names below are the real production ones, confirmed against an authorized read.
    # `reviewNotes` and `reviewedByUserId` are internal moderation control and stay out.
    "PlannerProfile": [
        "id", "slug", "displayName", "headline", "bio", "yearsExperience", "serviceAreas",
        "services", "weddingStyles", "languages", "priceBand", "minimumGuestCount",
        "maximumGuestCount", "availabilityStatus", "portfolio", "packages", "faq",
        "verificationBadges", "profileDetails", "teamSize", "completedWeddings", "status",
        "submittedAt", "publishedAt", "lastProfileUpdate", "createdAt", "updatedAt",
    ],
    "PlannerEngagement": [
        "id", "weddingId", "plannerProfileId", "status", "scope", "startedAt", "endedAt",
        "createdAt", "updatedAt",
    ],
    "WeddingMembership": [
        "id", "weddingId", "role", "status", "invitedAt", "acceptedAt", "createdAt", "updatedAt",
    ],
    "MediaItem": [
        "id", "weddingId", "url", "thumbnailUrl", "caption", "kind", "section", "order",
        "createdAt", "updatedAt",
    ],
    "Contract": [
        "id", "weddingId", "vendorId", "title", "status", "currentVersionId",
        "createdAt", "updatedAt",
    ],
    "ContractVersion": [
        "id", "contractId", "versionNumber", "status", "summary", "createdAt", "updatedAt",
    ],
    "Comment": [
        "id", "weddingId", "resourceType", "resourceId", "authorName", "body",
        "createdAt", "updatedAt",
    ],
    "Notification": [
        "id", "weddingId", "kind", "title", "body", "readAt", "createdAt", "updatedAt",
    ],
    "VaultObject": [
        "id", "weddingId", "label", "kind", "status", "createdAt", "updatedAt",
    ],
    "VaultLink": [
        "id", "weddingId", "vaultObjectId", "resourceType", "resourceId", "createdAt", "updatedAt",
    ],
    "Reminder": [
        "id", "weddingId", "title", "dueAt", "status", "createdAt", "updatedAt",
    ],
}

# Columns deliberately excluded, recorded so the decision is reviewable rather than implicit.
# The extractor asserts that none of these ever appears in an emitted row.
DENIED_FIELDS: dict[str, list[str]] = {
    "Guest": ["contributionToken"],
    "RSVP": ["token"],
    "Message": ["authorToken", "userId"],
    "ImportJob": ["rollbackToken", "rollbackData", "previewData", "fieldMapping", "errorReport"],
    "AuditEvent": ["ipAddress", "userAgent", "beforeValue", "afterValue"],
    "GuestContribution": ["contributionToken", "revisionHistory", "reviewedBy"],
    "ServiceEngagement": ["createdById", "recordedById"],
    "EngagementParty": ["userId", "createdById"],
    "PlannerEnquiry": [
        "createdByUserId", "respondedByUserId", "plannerBusinessAccountId",
        "coupleBusinessAccountId", "version",
    ],
    "PlannerTask": ["assigneeUserId"],
    "PlannerProfile": ["reviewNotes", "reviewedByUserId", "businessAccountId"],
}

# Any column whose name matches one of these is refused outright, in every table, even if a future
# edit mistakenly adds it to an allowlist. This is the backstop against credential leakage.
FORBIDDEN_NAME_FRAGMENTS = (
    "token", "password", "passwd", "secret", "apikey", "api_key", "privatekey", "private_key",
    "accesstoken", "access_token", "refreshtoken", "refresh_token", "sessionid", "session_id",
    "credential", "signingkey", "signing_key", "hash", "salt", "otp", "ipaddress", "ip_address",
    "useragent", "user_agent", "rollbackdata", "previewdata",
)


def assert_allowlist_is_safe() -> None:
    """Fail loudly if an allowlist entry would export credential or forensics material."""
    problems = []
    for table, fields in ALLOWED_FIELDS.items():
        for field in fields:
            flat = field.lower().replace("_", "")
            for fragment in FORBIDDEN_NAME_FRAGMENTS:
                if fragment.replace("_", "") in flat:
                    problems.append(f"{table}.{field} matches forbidden fragment '{fragment}'")
        overlap = set(fields) & set(DENIED_FIELDS.get(table, []))
        if overlap:
            problems.append(f"{table}: {sorted(overlap)} appear in both ALLOWED and DENIED")
    if problems:
        raise SystemExit("FAIL: unsafe UAT allowlist:\n  " + "\n  ".join(problems))


def select_columns(table: str) -> str:
    """Explicit column list for `SELECT <cols> FROM "<table>"` — never `SELECT *`."""
    fields = ALLOWED_FIELDS.get(table)
    if not fields:
        raise KeyError(f"No UAT allowlist defined for table '{table}'")
    return ", ".join(f'"{f}"' for f in fields)


def project(table: str, rows: list[dict]) -> list[dict]:
    """Reduce already-fetched rows to the allowlist, preserving column order."""
    fields = ALLOWED_FIELDS.get(table)
    if fields is None:
        raise KeyError(f"No UAT allowlist defined for table '{table}'")
    return [{f: row[f] for f in fields if f in row} for row in rows]


def audit_rows(table: str, rows: list[dict]) -> list[str]:
    """Return violations if any emitted row still carries a denied or forbidden column."""
    allowed = set(ALLOWED_FIELDS.get(table, []))
    denied = set(DENIED_FIELDS.get(table, []))
    violations = []
    for row in rows:
        for key in row:
            if key in denied:
                violations.append(f"{table}.{key} is explicitly denied")
            elif key not in allowed:
                violations.append(f"{table}.{key} is not on the allowlist")
            flat = key.lower().replace("_", "")
            for fragment in FORBIDDEN_NAME_FRAGMENTS:
                if fragment.replace("_", "") in flat:
                    violations.append(f"{table}.{key} matches forbidden fragment '{fragment}'")
        break  # columns are uniform per table; one row is enough
    return sorted(set(violations))


if __name__ == "__main__":
    assert_allowlist_is_safe()
    total = sum(len(v) for v in ALLOWED_FIELDS.values())
    print(f"PASS: {len(ALLOWED_FIELDS)} tables, {total} allowlisted columns, 0 unsafe entries.")
