# wewed — Production Setup Guide

This guide covers everything you need to take wewed from dev to production:
Supabase backend, user accounts, photo storage, custom domain, and GitHub.

---

## Table of Contents
1. [Supabase Setup (Database + Storage + Auth)](#1-supabase-setup)
2. [Connect Prisma to Supabase PostgreSQL](#2-connect-prisma-to-supabase)
3. [Environment Variables](#3-environment-variables)
4. [User Accounts & Auth](#4-user-accounts--auth)
5. [Photo Uploads to Supabase Storage](#5-photo-uploads-to-supabase-storage)
6. [Comments & Profiles](#6-comments--profiles)
7. [Custom Domain](#7-custom-domain)
8. [GitHub Source Control](#8-github-source-control)
9. [Deploy to Vercel](#9-deploy-to-vercel)

---

## 1. Supabase Setup

Supabase replaces SQLite (local file DB), local filesystem (photo storage),
and the hardcoded admin password with a production-grade backend.

### Create a Supabase Project

1. Go to **https://supabase.com** → Sign up (free, no credit card needed)
2. Click **New Project**
3. Fill in:
   - **Name**: `wewed`
   - **Database Password**: Generate a strong password and SAVE it
   - **Region**: Choose the closest to your guests (e.g. `eu-west-1` for Europe, `af-south-1` for South Africa)
   - **Pricing Plan**: Free (500MB DB, 1GB storage, 50K auth users — plenty for a wedding)
4. Click **Create new project** — wait ~2 minutes for provisioning

### Get Your Project Credentials

Once the project is ready:

1. Go to **Project Settings** (gear icon, bottom left)
2. Click **API**
3. Copy these 3 values — you'll need them for `.env`:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOi...` (long string)
   - **service_role key**: `eyJhbGciOi...` (DIFFERENT long string — keep secret!)

### Get Your Database Connection String

1. Go to **Project Settings** → **Database**
2. Under **Connection string**, choose **URI**
3. Copy the **Transaction mode** URL (uses connection pooling — better for serverless):
   ```
   postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with the password you saved earlier.

---

## 2. Connect Prisma to Supabase

### Switch from SQLite to PostgreSQL

Edit `prisma/schema.prisma` — change the `provider`:

```prisma
datasource db {
  provider = "postgresql"   // ← change from "sqlite"
  url      = env("DATABASE_URL")
}
```

### Push the schema to Supabase

```bash
# Set DATABASE_URL to your Supabase connection string
export DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Create all tables in Supabase
bun run db:push

# Regenerate the Prisma client
bun run db:generate
```

This creates all 25+ tables (Couple, Wedding, Guest, MediaItem, Comment,
UserProfile, etc.) in your Supabase PostgreSQL database.

### Seed the flagship wedding

After the tables exist, seed Charity & Kudzie's content:

```bash
curl -X POST http://localhost:3000/api/wedding-content/seed
curl -X POST http://localhost:3000/api/onboarding
```

---

## 3. Environment Variables

Create a `.env.local` file (NEVER commit this to git):

```bash
# Database (Supabase PostgreSQL — use the pooling URL for production)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Supabase (public — safe for browser)
NEXT_PUBLIC_SUPABASE_URL="https://xxxxxxxxxxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi...your-anon-key..."

# Supabase service role (SECRET — server only, never expose to browser)
# Used for admin operations (bypassing RLS)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi...your-service-role-key..."

# Site URL (for auth redirects)
NEXT_PUBLIC_SITE_URL="https://wewed.app"
```

### For Vercel deployment

Add the same variables in **Vercel → Settings → Environment Variables**.

---

## 4. User Accounts & Auth

Supabase Auth handles user accounts. I've already created the API routes:

- `POST /api/auth/signup` — create account (email + password)
- `POST /api/auth/signin` — log in
- `POST /api/auth/signout` — log out
- `GET  /api/auth/me` — get current user

### Configure Auth Settings in Supabase

1. Go to **Authentication** → **Providers**
2. **Email** is enabled by default. Configure:
   - **Confirm email**: ON (recommended — users verify their email)
   - **Allow new users to sign up**: ON
3. (Optional) Enable **Google** or **Apple** OAuth for social login:
   - Click the provider → enter OAuth client ID/secret → save

### Set Auth Redirect URLs

In **Authentication** → **URL Configuration**:

- **Site URL**: `https://wewed.app` (your production domain)
- **Redirect URLs**: Add both:
  - `http://localhost:3000/api/auth/callback`
  - `https://wewed.app/api/auth/callback`

### User Profile Flow

When a user signs up:
1. Supabase creates an `auth.users` record
2. Our `/api/auth/signup` route ALSO creates a `UserProfile` row in the DB
   (mirrors the auth user, stores wewed-specific fields like `displayName`,
   `role`, `coupleId`)

The `UserProfile` model links to:
- `MediaItem` (photos they uploaded)
- `Message` (wall/capsule messages they posted)
- `Comment` (comments they wrote)

---

## 5. Photo Uploads to Supabase Storage

### Create the Storage Bucket

1. Go to **Storage** (left sidebar in Supabase dashboard)
2. Click **New bucket**
3. Configure:
   - **Name**: `wedding-media`
   - **Public**: ✅ YES (so photos are publicly viewable via URL)
   - **File size limit**: `10 MB`
   - **Allowed MIME types**:
     ```
     image/jpeg, image/png, image/webp, image/gif, video/mp4, video/webm
     ```
4. Click **Create bucket**

### How Uploads Work

The media upload flow (`/api/media` POST) now:

1. Checks if Supabase Storage is configured (env vars present)
2. If YES: uploads to Supabase Storage → saves the public URL to the DB
3. If NO: falls back to local filesystem (`public/uploads/`) — for dev

Files are stored at:
```
wedding-media/
  charity-and-kudzie/
    photos/
      uuid-123.jpg
      uuid-456.png
    videos/
      uuid-789.mp4
```

The public URL looks like:
```
https://xxxxxxxxxxxxx.supabase.co/storage/v1/object/public/wedding-media/charity-and-kudzie/photos/uuid-123.jpg
```

### Displaying Uploaded Photos

The photo gallery (`/api/media` GET) already returns all MediaItems from the DB,
including their `url` field. When the URL is a Supabase Storage URL, the photo
loads directly from Supabase's CDN (fast, globally distributed).

---

## 6. Comments & Profiles

### Comments API (already built)

- `GET /api/comments?targetType=media&targetId=xxx` — list comments
- `POST /api/comments` — add a comment (requires auth)

Comments can be attached to:
- `media` — photos/videos
- `contribution` — guest contributions
- `song` — songs in the songbook
- `section` — any page section

### User Profiles

Every authenticated user has a `UserProfile` with:
- `displayName` — shown on comments and contributions
- `avatarUrl` — profile picture
- `role` — `viewer`, `couple`, `planner`, or `admin`
- `coupleId` — links to a Couple record if this user IS a couple

### To add a comment UI to the photo gallery:

```tsx
// Example: fetching + displaying comments on a photo
const res = await fetch(`/api/comments?targetType=media&targetId=${photoId}`)
const { comments } = await res.json()

// Posting a comment
await fetch('/api/comments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    targetType: 'media',
    targetId: photoId,
    body: 'Beautiful photo! 🎉',
  }),
})
```

---

## 7. Custom Domain

### Option A: Vercel (recommended — easiest)

1. Deploy to Vercel (see section 9)
2. Go to **Vercel → Your Project → Settings → Domains**
3. Enter your domain: `wewed.app`
4. Vercel shows you the DNS records to add:
   - **A record** or **CNAME** pointing to Vercel
5. Go to your domain registrar (Namecheap, GoDaddy, Google Domains, etc.)
6. Add the DNS records Vercel showed you
7. Wait 5–30 minutes for DNS propagation
8. Vercel automatically provisions **HTTPS** (via Let's Encrypt)

### Option B: Custom hosting

If you're not using Vercel:
1. Point your domain's A record to your server's IP
2. Configure your web server (Nginx/Caddy) with SSL
3. Set `NEXT_PUBLIC_SITE_URL` to your domain

### Update Supabase Auth Redirect URLs

After getting your domain, update Supabase:
- **Authentication → URL Configuration → Site URL**: `https://wewed.app`
- **Redirect URLs**: add `https://wewed.app/api/auth/callback`

---

## 8. GitHub Source Control

### Initialize Git (if not already done)

```bash
# Check if git is initialized
git status

# If not, initialize it
git init
git add .
git commit -m "Initial commit: wewed wedding platform"
```

### Connect to GitHub

1. Go to **https://github.com/new**
2. Create a new repository:
   - **Repository name**: `wewed`
   - **Private** (recommended — your wedding code is private)
   - **Don't** initialize with README (you already have files)
3. Copy the remote URL GitHub shows you

### Push to GitHub

```bash
# Add the remote (replace with your URL)
git remote add origin https://github.com/YOUR_USERNAME/wewed.git

# Rename branch to 'main' if needed
git branch -M main

# Push
git push -u origin main
```

### .gitignore — Make sure these are NOT committed:

Verify your `.gitignore` includes:
```
.env
.env.local
.env.production
node_modules/
.next/
prisma/dev.db
db/*.db
upload/
public/uploads/
```

**Never commit `.env` files** — they contain your Supabase passwords and keys.

### Connect Vercel to GitHub (for auto-deploy)

1. Go to **https://vercel.com/new**
2. Import your GitHub repo
3. Vercel auto-detects Next.js — just add env vars and deploy
4. Every `git push` to `main` auto-deploys to production

---

## 9. Deploy to Vercel

### Steps

1. Push your code to GitHub (section 8)
2. Go to **https://vercel.com/new**
3. Import the `wewed` repo
4. Vercel auto-detects Next.js 16 — defaults are correct
5. **Add Environment Variables** (from section 3):
   - `DATABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` → `https://wewed.app`
6. Click **Deploy**
7. Wait ~2 minutes for build

### Post-deploy checklist

- [ ] Visit the deployed URL — page loads
- [ ] Test signup at `/api/auth/signup`
- [ ] Test photo upload (goes to Supabase Storage)
- [ ] Test content edits (saved to Supabase Postgres)
- [ ] Add custom domain (section 7)
- [ ] Update Supabase auth redirect URLs to production domain

---

## Quick Reference: What Was Built

| Feature | Status | Files |
|---------|--------|-------|
| Supabase client (browser) | ✅ Built | `src/lib/supabase/client.ts` |
| Supabase client (server) | ✅ Built | `src/lib/supabase/server.ts` |
| Supabase Storage helper | ✅ Built | `src/lib/supabase/storage.ts` |
| DB-backed content edits | ✅ Built | `src/lib/inline-content-db.ts` |
| Signup API | ✅ Built | `src/app/api/auth/signup/route.ts` |
| Signin API | ✅ Built | `src/app/api/auth/signin/route.ts` |
| Signout API | ✅ Built | `src/app/api/auth/signout/route.ts` |
| Current user API | ✅ Built | `src/app/api/auth/me/route.ts` |
| Comments API | ✅ Built | `src/app/api/comments/route.ts` |
| UserProfile model | ✅ Built | `prisma/schema.prisma` |
| Comment model | ✅ Built | `prisma/schema.prisma` |
| MediaItem.userId | ✅ Added | `prisma/schema.prisma` |
| Message.userId | ✅ Added | `prisma/schema.prisma` |
| Prisma → Postgres migration | ⏳ Pending | Change `provider` to `"postgresql"` |
| Connect Supabase env vars | ⏳ Pending | `.env.local` |
| Create Storage bucket | ⏳ Pending | Supabase dashboard |
| GitHub remote | ⏳ Pending | `git remote add origin ...` |
| Vercel deploy | ⏳ Pending | vercel.com |
| Custom domain | ⏳ Pending | Vercel + DNS |

---

## Next Steps (Priority Order)

1. **Create Supabase project** → get credentials (15 min)
2. **Set `.env.local`** with credentials (5 min)
3. **Switch Prisma to postgresql** + `bun run db:push` (5 min)
4. **Create Storage bucket** in Supabase dashboard (5 min)
5. **Test signup + photo upload** locally (10 min)
6. **Push to GitHub** (5 min)
7. **Deploy to Vercel** (10 min)
8. **Add custom domain** in Vercel (15 min — mostly DNS wait)
9. **Wire `useInlineContentDB`** into components (replace `useInlineContent` calls)
10. **Build login/signup UI** (client components using the auth APIs)
11. **Add comment UI** to photo gallery

The backend infrastructure is ready. The remaining work is UI integration —
swapping `useInlineContent` → `useInlineContentDB` in components, and building
login/signup/comment components that call the auth + comments APIs.
