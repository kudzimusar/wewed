-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Couple" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "partner1" TEXT NOT NULL,
    "partner2" TEXT NOT NULL,
    "surname" TEXT,
    "photo" TEXT,
    "userId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Couple_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wedding" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "monogram" TEXT,
    "tagline" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL,
    "venueCity" TEXT NOT NULL,
    "venueCountry" TEXT NOT NULL,
    "venueMapUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#BF9B5F',
    "accentColor" TEXT NOT NULL DEFAULT '#C0633F',
    "memoryColor" TEXT NOT NULL DEFAULT '#6B2D3A',
    "backgroundColor" TEXT NOT NULL DEFAULT '#FBF6EE',
    "lifecycle" TEXT NOT NULL DEFAULT 'before',
    "privacy" TEXT NOT NULL DEFAULT 'public',
    "canonSealed" BOOLEAN NOT NULL DEFAULT false,
    "canonSealedAt" TIMESTAMP(3),
    "subscriptionTier" TEXT NOT NULL DEFAULT 'free',
    "coupleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'guest',
    "roleDetail" TEXT,
    "side" TEXT,
    "tableNumber" INTEGER,
    "seatingTableId" TEXT,
    "contributionToken" TEXT,
    "contributionStatus" TEXT DEFAULT 'none',
    "weddingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RSVP" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "attending" BOOLEAN,
    "mealChoice" TEXT,
    "plusOne" BOOLEAN NOT NULL DEFAULT false,
    "plusOneName" TEXT,
    "plusOneMeal" TEXT,
    "kidsAttending" BOOLEAN NOT NULL DEFAULT false,
    "kidsCount" INTEGER NOT NULL DEFAULT 0,
    "songRequests" TEXT,
    "dietaryNotes" TEXT,
    "message" TEXT,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3),
    "guestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RSVP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "moment" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "spotifyUrl" TEXT,
    "appleUrl" TEXT,
    "playedAt" TIMESTAMP(3),
    "notes" TEXT,
    "weddingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "moment" TEXT,
    "isCurated" BOOLEAN NOT NULL DEFAULT false,
    "isHero" BOOLEAN NOT NULL DEFAULT false,
    "uploaderId" TEXT,
    "userId" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "weddingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorToken" TEXT,
    "userId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "revealedAt" TIMESTAMP(3),
    "weddingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "imageUrl" TEXT,
    "category" TEXT,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "weddingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "imageUrl" TEXT,
    "rating" DOUBLE PRECISION,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "weddingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeItem" (
    "id" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "weddingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kid" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "age" INTEGER,
    "photoUrl" TEXT,
    "coupleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" TIMESTAMP(3),
    "assignee" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "weddingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "actualCost" DOUBLE PRECISION,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "vendorId" TEXT,
    "dueDate" TIMESTAMP(3),
    "weddingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatingTable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 8,
    "position" TEXT,
    "weddingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatingTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "coupleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "templateVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'preview',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorReport" TEXT,
    "rollbackToken" TEXT,
    "rollbackData" TEXT,
    "fieldMapping" TEXT,
    "previewData" TEXT,
    "weddingId" TEXT NOT NULL,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentRevision" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "previousValue" TEXT,
    "weddingId" TEXT NOT NULL,
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSubmission" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "moderatorNotes" TEXT,
    "weddingId" TEXT NOT NULL,
    "authorId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "weddingId" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleSheetsConnection" (
    "id" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "spreadsheetName" TEXT,
    "sheetTab" TEXT,
    "moduleKey" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "weddingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleSheetsConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRDestination" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'website',
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "weddingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QRDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemePreference" (
    "id" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "userId" TEXT,
    "weddingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThemePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestContribution" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'memory',
    "displayName" TEXT NOT NULL,
    "relationship" TEXT,
    "message" TEXT NOT NULL,
    "photoUrl" TEXT,
    "favoriteSong" TEXT,
    "privacy" TEXT NOT NULL DEFAULT 'public',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "moderatorNotes" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "charCount" INTEGER NOT NULL DEFAULT 0,
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "revisionHistory" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeddingContent" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeddingContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "coupleId" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "marketingEmails" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "bannedAt" TIMESTAMP(3),
    "banReason" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'published',
    "flaggedAt" TIMESTAMP(3),
    "flagReason" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "hiddenBy" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "likedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Couple_slug_key" ON "Couple"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Wedding_slug_key" ON "Wedding"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_contributionToken_key" ON "Guest"("contributionToken");

-- CreateIndex
CREATE UNIQUE INDEX "RSVP_token_key" ON "RSVP"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RSVP_guestId_key" ON "RSVP"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GuestContribution_guestId_key" ON "GuestContribution"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "WeddingContent_weddingId_section_field_key" ON "WeddingContent"("weddingId", "section", "field");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_coupleId_key" ON "UserProfile"("coupleId");

-- CreateIndex
CREATE INDEX "Comment_targetType_targetId_idx" ON "Comment"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Comment_weddingId_status_idx" ON "Comment"("weddingId", "status");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- AddForeignKey
ALTER TABLE "Wedding" ADD CONSTRAINT "Wedding_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_seatingTableId_fkey" FOREIGN KEY ("seatingTableId") REFERENCES "SeatingTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RSVP" ADD CONSTRAINT "RSVP_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeItem" ADD CONSTRAINT "ProgrammeItem_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kid" ADD CONSTRAINT "Kid_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerTask" ADD CONSTRAINT "PlannerTask_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatingTable" ADD CONSTRAINT "SeatingTable_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSubmission" ADD CONSTRAINT "ContentSubmission_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSubmission" ADD CONSTRAINT "ContentSubmission_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleSheetsConnection" ADD CONSTRAINT "GoogleSheetsConnection_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRDestination" ADD CONSTRAINT "QRDestination_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThemePreference" ADD CONSTRAINT "ThemePreference_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestContribution" ADD CONSTRAINT "GuestContribution_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestContribution" ADD CONSTRAINT "GuestContribution_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingContent" ADD CONSTRAINT "WeddingContent_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
