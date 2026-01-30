# 434 MEDIA

Welcome to the 434 Media codebase. This document serves as a Standard Operating Procedure (SOP) for developers joining the team.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)
4. [Folder Structure](#folder-structure)
5. [Key Modules](#key-modules)
6. [Environment Variables](#environment-variables)
7. [Development Workflow](#development-workflow)
8. [Deployment](#deployment)
9. [Common Tasks](#common-tasks)

---

## Overview

434 Media is a full-stack Next.js application that serves as the central hub for:

- **Marketing Website** - Public-facing pages with i18n support (English/Spanish)
- **Blog Engine** - Content managed via Firestore with markdown support
- **Admin Dashboard** - Protected area for analytics, CRM, blog management, event management, and email lists
- **Multi-site Email Collection** - Centralized email signup system for multiple brand websites
- **Social Analytics** - Web, Instagram, LinkedIn, and Mailchimp analytics dashboards

### Connected Brands

This application manages data for multiple websites:
- 434 Media (primary)
- AIM Health R&D Summit (Academia Industry Military)
- SDOH (Social Determinants of Health)
- TXMX Boxing
- VemosVamos
- Digital Canvas
- The AMPD Project
- Salute to Troops 
- DEVSA TV
- And more...

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16 (App Router + Turbopack) |
| **Language** | TypeScript |
| **Database** | Firebase Firestore |
| **Authentication** | Google Workspace OAuth |
| **Styling** | Tailwind CSS | Motion/React | Lucide React |
| **Email Marketing** | Mailchimp | 
| **Bot Protection** | BotID (Vercel) |
| **Analytics** | Google Analytics, Meta Pixel |
| **Deployment** | Vercel |

---

## Getting Started

### Prerequisites

- Node.js v18+ 
- npm/yarn/pnpm
- Git
- Access to Google Cloud Console and Vercel

### 1. Clone & Install

```bash
git clone https://github.com/434media/next-434media.git
cd next-434media
npm install
```

### 2. Environment Setup

Copy the example environment file and fill in the values:

```bash
cp .env.example .env.local
```

See [Environment Variables](#environment-variables) section for required values.

### 3. Run Development Server

```bash
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000)

---

## Folder Structure

```
next-434media/
├── app/                              # Next.js App Router (main source)
│   ├── [lang]/                       # Internationalization routes
│   │   ├── layout.tsx                # Language-specific layout
│   │   ├── ClientLayout.tsx          # Client-side language provider
│   │   └── sdoh/                     # SDOH brand pages
│   │
│   ├── actions/                      # Server Actions
│   │   └── blog.ts                   # Blog CRUD operations
│   │
│   ├── admin/                        # Protected Admin Dashboard
│   │   ├── layout.tsx                # Admin auth wrapper
│   │   ├── page.tsx                  # Admin home
│   │   ├── analytics/                # Google Analytics dashboard
│   │   ├── analytics-instagram/      # Instagram metrics
│   │   ├── analytics-linkedin/       # LinkedIn metrics
│   │   ├── analytics-mailchimp/      # Email campaign stats
│   │   ├── analytics-web/            # Web analytics
│   │   ├── blog/                     # Blog post management
│   │   ├── crm/                      # Contact/lead management
│   │   ├── email-lists/              # Multi-site email signups
│   │   ├── events/                   # Events management
│   │   └── feed-form/                # Social feed submissions
│   │
│   ├── api/                          # API Routes
│   │   ├── admin/                    # Admin-only endpoints
│   │   │   └── email-lists-firestore/  # Firestore email lists
│   │   ├── auth/                     # Authentication
│   │   ├── blog/                     # Blog API
│   │   ├── contact-form/             # Contact form handler
│   │   ├── instagram/                # Instagram API proxy
│   │   ├── linkedin/                 # LinkedIn API proxy
│   │   ├── mailchimp/                # Mailchimp integration
│   │   ├── meta/                     # Meta Pixel tracking
│   │   ├── newsletter/               # 434Media newsletter signup
│   │   ├── sdoh-newsletter/          # SDOH newsletter signup
│   │   ├── txmx-newsletter/          # TXMX newsletter signup
│   │   ├── public/                   # Public API endpoints
│   │   │   └── email-signup/         # API key protected signup
│   │   └── og/                       # Open Graph image generation
│   │
│   ├── blog/                         # Public blog pages
│   │   ├── page.tsx                  # Blog listing
│   │   ├── BlogClientPage.tsx        # Client-side blog grid
│   │   └── [slug]/                   # Individual blog posts
│   │
│   ├── components/                   # Shared React Components
│   │   ├── analytics/                # Analytics display components
│   │   ├── blog/                     # Blog-specific components
│   │   ├── crm/                      # CRM components
│   │   ├── events/                   # Event display components
│   │   ├── instagram/                # Instagram feed components
│   │   ├── linkedin/                 # LinkedIn components
│   │   ├── mailchimp/                # Email stats components
│   │   ├── meta/                     # Meta tracking components
│   │   ├── sdoh/                     # SDOH brand components
│   │   ├── shopify/                  # E-commerce components
│   │   ├── txmx/                     # TXMX brand components
│   │   ├── Newsletter.tsx            # Newsletter signup form
│   │   ├── Footer.tsx                # Site footer
│   │   ├── Navmenu.tsx               # Navigation menu
│   │   └── combined-navbar.tsx       # Main navbar
│   │
│   ├── context/                      # React Context Providers
│   │   └── language-context.tsx      # i18n context
│   │
│   ├── dictionaries/                 # i18n Translation Files
│   │   ├── en.json                   # English translations
│   │   └── es.json                   # Spanish translations
│   │
│   ├── hooks/                        # Custom React Hooks
│   │   ├── use-horizontal-scroll.ts
│   │   ├── use-mobile.ts
│   │   └── use-toast.ts
│   │
│   ├── lib/                          # Core Business Logic
│   │   ├── firebase-admin.ts         # Firebase initialization
│   │   ├── firestore-blog.ts         # Blog Firestore operations
│   │   ├── firestore-crm.ts          # CRM Firestore operations
│   │   ├── firestore-email-signups.ts  # Email signup operations
│   │   ├── firestore-events.ts       # Events Firestore operations
│   │   ├── auth.ts                   # Authentication helpers
│   │   ├── dictionary.ts             # i18n dictionary loader
│   │   ├── google-analytics.ts       # GA data fetching
│   │   ├── mailchimp-config.ts       # Mailchimp setup
│   │   ├── instagram-config.ts       # Instagram API config
│   │   ├── linkedin-config.ts        # LinkedIn API config
│   │   ├── meta-conversions-api.ts   # Meta Pixel server-side
│   │   └── utils.ts                  # General utilities
│   │
│   ├── types/                        # TypeScript Type Definitions
│   │
│   ├── globals.css                   # Global styles
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Homepage
│   ├── robots.ts                     # robots.txt generator
│   └── sitemap.ts                    # sitemap.xml generator
│
├── public/                           # Static Assets
│   └── uploads/                      # Uploaded images
│
├── i18n-config.ts                    # Internationalization config
├── next.config.ts                    # Next.js configuration
├── tailwind.config.ts                # Tailwind CSS config
├── tsconfig.json                     # TypeScript config
└── package.json                      # Dependencies & scripts
```

---

## Key Modules

### Email Signup System

Centralized email collection across all brand websites:

| File | Purpose |
|------|---------|
| `lib/firestore-email-signups.ts` | Core CRUD operations for email signups |
| `api/newsletter/route.ts` | 434Media signup (BotID protected) |
| `api/sdoh-newsletter/route.ts` | SDOH signup (BotID protected) |
| `api/txmx-newsletter/route.ts` | TXMX signup (BotID protected) |
| `api/public/email-signup/route.ts` | External API (API key protected) |
| `admin/email-lists/page.tsx` | Admin UI for viewing/exporting emails |

**Flow:**
1. User submits email on any site
2. Saved to Firestore + Mailchimp
3. Tagged by source (AIM, SDOH, TXMX, etc.)
4. Viewable/exportable in admin dashboard

### Blog System

Firestore-based blog with markdown support:

| File | Purpose |
|------|---------|
| `lib/firestore-blog.ts` | Blog CRUD operations |
| `admin/blog/` | Blog post editor |
| `blog/[slug]/` | Public blog post pages |
| `components/blog/` | Blog UI components |

### CRM System

Contact and lead management:

| File | Purpose |
|------|---------|
| `lib/firestore-crm.ts` | CRM data operations |
| `admin/crm/` | CRM dashboard |
| `api/contact-form/` | Contact form handler |

### Analytics

Multi-platform analytics dashboards:

| Dashboard | Data Source |
|-----------|-------------|
| `admin/analytics/` | Google Analytics |
| `admin/analytics-instagram/` | Instagram API |
| `admin/analytics-linkedin/` | LinkedIn API |
| `admin/analytics-mailchimp/` | Mailchimp API |

---

## Environment Variables

Create `.env.local` with these values:

```bash
# CORE CONFIGURATION
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_PASSWORD=your-admin-password

# FIREBASE / FIRESTORE
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# MAILCHIMP
MAILCHIMP_API_KEY=xxxxxxxxxx-us1
MAILCHIMP_AUDIENCE_ID=xxxxxxxxxx

# SOCIAL MEDIA APIs
INSTAGRAM_ACCESS_TOKEN=your-long-lived-token
LINKEDIN_CLIENT_ID=xxxxxxxxxxxxx
LINKEDIN_CLIENT_SECRET=xxxxxxxxxxxxx
LINKEDIN_ACCESS_TOKEN=xxxxxxxxxxxxx

# GOOGLE ANALYTICS
GA_PROPERTY_ID=properties/xxxxxxxxx
GA_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# META / FACEBOOK
META_PIXEL_ID=xxxxxxxxxxxxx
META_ACCESS_TOKEN=xxxxxxxxxxxxx

# API SECURITY
EMAIL_SIGNUP_API_KEY=your-secure-random-key
```

---

## Development Workflow

### Scripts

```bash
npm run dev      # Start dev server with Turbopack
npm run build    # Production build
npm run start    # Run production build locally
npm run lint     # Run ESLint
```

### Git Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and commit**
   ```bash
   git commit -m "feat: add new feature"
   ```
   
   Commit prefixes:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation
   - `style:` - Formatting
   - `refactor:` - Code restructuring
   - `chore:` - Maintenance

3. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Merge after review**

---

## Deployment

### Vercel (Production)

The app auto-deploys to Vercel on push to `main`:

1. Push to `main` triggers build
2. Vercel runs `next build`
3. Deployed to production URL

### Environment Variables on Vercel

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add all variables from `.env.local`
3. Redeploy for changes to take effect

---

## Common Tasks

### Adding a New Newsletter Source

1. Create new API route in `app/api/[source]-newsletter/route.ts`
2. Copy pattern from `newsletter/route.ts`
3. Update `Source` field to match (e.g., "NewBrand")
4. Update `mailchimp_tags` array
5. Add source to `VALID_SOURCES` in `api/public/email-signup/route.ts`

### Creating an Admin Page

1. Create folder in `app/admin/your-page/`
2. Add `page.tsx` (automatically protected by admin layout)
3. Use existing component patterns from other admin pages

### Adding a New Firestore Collection

1. Create lib file: `app/lib/firestore-[collection].ts`
2. Follow pattern from `firestore-email-signups.ts`
3. Create API routes as needed
4. Add admin UI if required

### Working with i18n

1. Add translations to `app/dictionaries/en.json` and `es.json`
2. Use `getDictionary()` in server components
3. Use `useLanguage()` hook in client components
4. Access translations via dictionary object

---

## Need Help?

- Check existing code patterns in similar modules
- Review Firestore data structures in the Firebase Console
- Consult the team Slack channel

---

*Last updated: January 2026*