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

- **Marketing Website** — Public-facing pages with i18n support (English/Spanish)
- **Blog Engine** — Content managed via Firestore with markdown support
- **Admin Dashboard** — Protected area for analytics, CRM, blog/event management, and audiences
- **Sales Pipeline** — Audiences → Inbox → Leads → CRM funnel, with AI-assisted prospecting, outreach drafting, and web-grounded lead research
- **Content & AI Studio** — Social content calendar/board with an approve→schedule→post pipeline, plus in-app image/video generation
- **Multi-site Email Collection** — Centralized email signup system for multiple brand websites
- **Social Analytics** — Web, Instagram, and Mailchimp analytics dashboards

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
- DEVSA
- And more...

---

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16 (App Router + Turbopack) |
| **Language** | TypeScript |
| **Package Manager** | **pnpm only** (npm/yarn are not supported — see [Getting Started](#getting-started)) |
| **Database** | Firebase Firestore (client + Admin SDK) |
| **Authentication** | Firebase Auth + Google Workspace OAuth |
| **Styling** | Tailwind CSS v4 · Motion (Framer Motion) · Lucide React |
| **Email Marketing** | Mailchimp |
| **Transactional Email** | Resend (lead outreach, inbox replies, broadcasts) |
| **Bot Protection** | BotID (Vercel) |
| **Analytics** | Google Analytics 4 · Meta Conversions API |
| **AI** | Vercel AI Gateway (AI SDK v6) — one key across Anthropic, OpenAI, Google, etc. |
| **Prospecting** | Apollo (contact discovery + enrichment) |
| **Storage** | Vercel Blob (uploads + generated assets) |
| **Deployment** | Vercel |

---

## Getting Started

> **This repository is pnpm-only.** The package manager is pinned via the
> `packageManager` field and `engines`, and `package-lock.json` is gitignored.
> **Do not run `npm install`** — it will create a conflicting lockfile. Always
> use `pnpm`. Transitive-dependency security pins live in `pnpm.overrides` in
> `package.json`.

### Prerequisites

- **Node.js v20+**
- **pnpm v10+** (`corepack enable` will provide the pinned version automatically)
- Git
- Access to Google Cloud Console and Vercel

### 1. Clone & Install

```bash
git clone https://github.com/434media/next-434media.git
cd next-434media
pnpm install
```

### 2. Environment Setup

Create a `.env.local` file in the project root and populate it with the values
described in [Environment Variables](#environment-variables). (There is no
committed `.env.example`; pull the canonical set from the Vercel project, or ask
the team.)

### 3. Run Development Server

```bash
pnpm dev
```

App runs at [http://localhost:3000](http://localhost:3000)

---

## Folder Structure

> Note: only **routes** live under `app/`. Shared code (`components/`, `lib/`,
> `hooks/`, `types/`, `actions/`, `context/`, `dictionaries/`) lives at the
> **repository root** and is imported via the `@/` path alias.

```
next-434media/
├── app/                          # Next.js App Router — ROUTES ONLY
│   ├── [lang]/sdoh/              # i18n SDOH brand pages (en/es)
│   ├── admin/                    # Protected admin dashboard (see below)
│   ├── api/                      # Route handlers (REST + webhooks + cron)
│   ├── blog/                     # Public blog (listing + [slug])
│   ├── contact/  work/  shop/    # Public marketing routes
│   ├── search/  product/  sdoh/  # Storefront + brand routes
│   ├── layout.tsx                # Root layout
│   ├── page.tsx + HomeClient.tsx # Homepage (server page → client component)
│   ├── globals.css               # Global styles (Tailwind v4)
│   ├── robots.ts  sitemap.ts     # SEO generators
│   └── opengraph-image.tsx       # Social-card image generation (+ twitter-image)
│
├── actions/                      # Server Actions (blog.ts)
├── components/                   # Shared React components
│   ├── admin/  crm/  analytics/  # Dashboard UI
│   ├── instagram/                # Social analytics UI
│   ├── shopify/                  # Storefront / e-commerce UI
│   └── sdoh/  blog/  feed/  …
├── context/                      # React context (language, notifications)
├── dictionaries/                 # i18n translations (en.json, es.json)
├── hooks/                        # Custom hooks (useTeamMembers, useLeadHandlers, use-mobile, …)
├── lib/                          # Core business logic
│   ├── firebase-admin.ts         # Firebase Admin init
│   ├── firestore-*.ts            # Firestore data access (blog, crm, leads, events, …)
│   ├── ai-generate.ts            # Image/video generation via AI Gateway
│   ├── ai-gateway-*.ts           # Model registry + text generation
│   ├── google-analytics.ts       # GA4 data fetching
│   ├── mailchimp-*.ts            # Mailchimp config + analytics + tags
│   ├── meta-conversions-api.ts   # Meta server-side tracking
│   ├── prospecting/              # Apollo + ICP scoring + NL translator
│   └── seo/                      # Structured data (services, FAQ, brand)
├── types/                        # Shared TypeScript types
├── fonts/                        # Local .otf fonts (brand display + OG image rendering)
├── scripts/                      # Operational CLI scripts (send-broadcast)
├── public/                       # Static assets
│
├── i18n-config.ts                # Internationalization config
├── proxy.ts                      # Middleware (locale routing) — Next 16 "proxy"
├── next.config.ts                # Next.js configuration (BotID wrapper)
├── vercel.json                   # Cron schedules
├── pnpm-lock.yaml                # The ONLY lockfile (npm/yarn are not used)
├── package.json                  # Dependencies, scripts, pnpm.overrides
└── tsconfig.json                 # TypeScript config (@/ path alias)
```

### Admin dashboard routes (`app/admin/`)

```
analytics            analytics-web        analytics-instagram   analytics-portfolio
audiences            inbox                leads                 crm
content              blog                 events                feed-form
project-management   sops                 more-human-than-human (redirect)
```

---

## Key Modules

### Email Signup System

Centralized email collection across all brand websites:

| File | Purpose |
|------|---------|
| `lib/firestore-email-signups.ts` | Core CRUD operations for email signups |
| `app/api/newsletter/route.ts` | 434Media signup (BotID protected) |
| `app/api/sdoh-newsletter/route.ts` | SDOH signup (BotID protected) |
| `app/api/txmx-newsletter/route.ts` | TXMX signup (BotID protected) |
| `app/api/public/email-signup/route.ts` | External API (BotID + optional API key) |
| `app/admin/audiences/` | Admin UI for viewing/exporting cohorts |

**Flow:**
1. User submits email on any site
2. Saved to Firestore + Mailchimp
3. Tagged by source (AIM, SDOH, TXMX, etc.)
4. Viewable/exportable in the admin **Audiences** surface

### Blog System

Firestore-based blog with markdown support:

| File | Purpose |
|------|---------|
| `lib/firestore-blog.ts` | Blog CRUD operations |
| `actions/blog.ts` | Public read server actions (`getBlogPostsAction`, `getBlogPostBySlugAction`) |
| `app/admin/blog/` | Blog post editor (create/update/delete via `app/api/blog`) |
| `app/blog/[slug]/` | Public blog post pages |
| `components/blog/` | Blog UI components |

### Sales Pipeline (Audiences → Inbox → Leads → CRM)

The admin "Pipeline" section is a funnel of connected surfaces. Each page opens
with a dismissible "How it works" strip (`components/admin/HowItWorks.tsx`) that
explains where it sits in the funnel, and status indicators share a single
legend popover (`components/admin/LegendPopover.tsx`).

| Surface | File | Purpose |
|---------|------|---------|
| **Audiences** | `app/admin/audiences/` | Newsletter / Events / Lists cohorts → sync to Mailchimp → promote to leads |
| **Inbox** | `app/admin/inbox/` | Contact-form inquiries with a response-time queue (awaiting / oldest waiting / replied today) |
| **Leads** | `app/admin/leads/`, `components/crm/LeadsView.tsx` | Scored lead queue — priority/follow-up/all views, bulk actions, owner filter + sort, activity timeline |
| **Prospecting** | `app/admin/leads/prospect/` | NL-prompt outbound prospecting (Apollo + LLM ICP scoring), credit-budgeted |
| **CRM** | `app/admin/crm/`, `lib/firestore-crm.ts` | Clients, opportunities, tasks |

**Lead lifecycle:** capture (inbound form, audience promotion, or prospecting) →
fit score (`lib/score-lead.ts`) → AI outreach draft → send via Resend →
follow-up → convert to client. Every step appends to the lead's activity
timeline (`lib/firestore-leads.ts` `appendLeadActivity`).

**AI-assisted lead tooling** (all via the AI Gateway — see Tech Stack):
- **Outreach drafting** — `app/api/admin/leads/[id]/generate-draft` builds a
  tailored email from lead signals (engagement, tags, provenance) via
  `lib/lead-prompt.ts`.
- **Research & qualify** — `app/api/admin/leads/[id]/research` runs a web-grounded
  search model to produce a cited company summary + ICP-fit rationale. Stored as
  a **review-only** `lead.research` field; nothing is auto-applied to canonical
  fields, and a suggested HQ country is applied only on explicit click
  (the EU/UK/CA outreach-compliance gate is never driven by model output).
- **Prospecting translator** — `lib/prospecting/translator.ts` turns a free-form
  query into Apollo filters via forced tool-use.

> **Compliance:** 434media does not cold-outreach EU/UK/EEA/Switzerland/Canada
> (GDPR/CASL). The single source of truth is `EXCLUDED_COUNTRIES` in
> `lib/prospecting/scorer.ts`, enforced in the translator, scorer, and approval
> boundary.

### Content & AI Studio

| Surface | File | Purpose |
|---------|------|---------|
| **Content Calendar** | `app/admin/content/`, `components/crm/SocialCalendarView.tsx` | Board + calendar views of social posts; approve→schedule→mark-posted pipeline |
| **AI Studio** | `app/admin/content/studio/` | Generate images/video, reusable asset library, remix/upload references |
| **Generate panel** | `components/crm/GeneratePanel.tsx` | Shared generator (model picker with provider logos + pricing) used by Studio + the post drawer |
| **Generation backend** | `lib/ai-generate.ts`, `lib/ai-gateway-models.ts` | Image (sync) + video (async via `after()` + job polling) through the AI Gateway |

Image/video models (GPT Image, Nano Banana, Flux, Imagen, Veo, Kling, Seedance,
Grok) are exposed through a curated registry that live-enriches pricing and
availability from the Gateway's `/v1/models` endpoint. Generated assets are
saved to a reusable library (`lib/firestore-assets.ts`) and can be attached to
content posts, blog, or feed via a shared asset picker.

### Contact Form

| File | Purpose |
|------|---------|
| `app/api/contact-form/` | Public contact form handler (feeds the admin Inbox) |

### Analytics

Multi-platform analytics dashboards:

| Dashboard | Data Source |
|-----------|-------------|
| `app/admin/analytics/` · `analytics-web/` | Google Analytics 4 + Search Console |
| `app/admin/analytics-instagram/` | Instagram Graph API |
| `app/admin/analytics-portfolio/` | Cross-brand portfolio rollup |

---

## Environment Variables

Create `.env.local` in the project root. The values below are representative;
some integrations are configured **per brand** with a suffix (e.g.
`GA4_PROPERTY_ID_AIM`, `INSTAGRAM_ACCESS_TOKEN_TXMX`,
`SEARCH_CONSOLE_SITE_MAIN`). Pull the full canonical set from the Vercel project.

```bash
# CORE
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_PASSWORD=your-admin-password          # legacy guard on a few analytics/IG routes

# FIREBASE / FIRESTORE (Admin SDK — server)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# Firebase web SDK (client) — NEXT_PUBLIC_FIREBASE_* keys for auth

# MAILCHIMP
MAILCHIMP_API_KEY=xxxxxxxxxx-us1
MAILCHIMP_AUDIENCE_ID=xxxxxxxxxx
MAILCHIMP_WEBHOOK_SECRET=xxxxxxxxxx

# GOOGLE ANALYTICS 4 + SEARCH CONSOLE
GA4_PROPERTY_ID=xxxxxxxxx                    # per-brand: GA4_PROPERTY_ID_<BRAND>
GOOGLE_SERVICE_ACCOUNT_KEY={...json...}      # shared service-account credential
SEARCH_CONSOLE_SITE_MAIN=sc-domain:example.com

# SOCIAL APIs (per brand suffix)
INSTAGRAM_ACCESS_TOKEN_TXMX=your-long-lived-token

# META CONVERSIONS API
META_PIXEL_ID=xxxxxxxxxxxxx
META_ACCESS_TOKEN=xxxxxxxxxxxxx

# API SECURITY
EMAIL_SIGNUP_API_KEY=your-secure-random-key
CRON_SECRET=your-cron-secret                 # guards /api/cron/* (Vercel cron)

# AI GATEWAY (image/video generation, lead drafting + research)
AI_GATEWAY_API_KEY=your-vercel-ai-gateway-key
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token   # uploads + generated assets
# Optional model overrides (default to curated gateway slugs):
# ANTHROPIC_MODEL=anthropic/claude-opus-4.8        # outreach drafts
# TRANSLATOR_MODEL=anthropic/claude-sonnet-4.6     # prospecting query → filters
# RESEARCH_MODEL=openai/gpt-4o-mini-search-preview # web-grounded lead research

# PROSPECTING (Apollo)
APOLLO_API_KEY=your-apollo-key
# APOLLO_DAILY_CAP / APOLLO_MONTHLY_CAP — credit guards (optional)

# TRANSACTIONAL EMAIL (Resend — outreach, inbox replies, broadcasts)
RESEND_API_KEY=your-resend-key
RESEND_WEBHOOK_SECRET=your-resend-webhook-secret
```

> **AI note:** all AI features (lead drafting, prospecting translation, research,
> image/video generation) route through the **Vercel AI Gateway** with a single
> `AI_GATEWAY_API_KEY`. There is no longer a direct Anthropic SDK dependency.

---

## Development Workflow

### Scripts

```bash
pnpm dev      # Start dev server with Turbopack
pnpm build    # Production build
pnpm start    # Run production build locally
pnpm lint     # Run ESLint
```

Operational one-off tooling lives in `scripts/` and is run with `tsx`, e.g.
the consent-gated Resend broadcast (dry-run by default):

```bash
pnpm tsx scripts/send-broadcast.ts --audiences=<ids>          # dry run
pnpm tsx scripts/send-broadcast.ts --audiences=<ids> --apply  # send
```

### Git Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and commit** (Conventional Commits)
   ```bash
   git commit -m "feat: add new feature"
   ```

   Commit prefixes: `feat:` · `fix:` · `docs:` · `style:` · `refactor:` ·
   `chore:` · `security:`

3. **Push and open a PR**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Merge after review**

---

## Deployment

### Vercel (Production)

The app auto-deploys to Vercel on push to `main`:

1. Push to `main` triggers a build
2. Vercel runs `pnpm build`
3. Deployed to the production URL

Scheduled jobs (`app/api/cron/*`) are driven by the `crons` array in
`vercel.json` and authenticated with `CRON_SECRET`.

### Environment Variables on Vercel

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Ensure every key your feature uses is present (the canonical set lives here)
3. Redeploy for changes to take effect

---

## Common Tasks

### Adding a New Newsletter Source

1. Create a new API route in `app/api/[source]-newsletter/route.ts`
2. Copy the pattern from `app/api/newsletter/route.ts`
3. Update the `Source` field to match (e.g., "NewBrand")
4. Update the `mailchimp_tags` array (canonical taxonomy in `lib/mailchimp-tags.ts`)
5. Add the source to `VALID_SOURCES` in `app/api/public/email-signup/route.ts`

### Creating an Admin Page

1. Create a folder in `app/admin/your-page/`
2. Add `page.tsx` (automatically protected by the admin layout)
3. For interactivity, split into a server `page.tsx` + a `"use client"`
   companion component (e.g. `YourPageClient.tsx`) — see `app/work/` for the pattern
4. Reuse existing component patterns from other admin pages

### Adding a New Firestore Collection

1. Create a lib file at the repo root: `lib/firestore-[collection].ts`
2. Follow the pattern from `lib/firestore-email-signups.ts`
3. Create API routes as needed under `app/api/`
4. Add admin UI if required

### Working with i18n

1. Add translations to `dictionaries/en.json` and `dictionaries/es.json`
2. Use `getDictionary()` (from `lib/dictionary.ts`) in server components
3. Use the `useLanguage()` hook (from `context/language-context.tsx`) in client components
4. Locale routing is handled by `proxy.ts` + `i18n-config.ts`

---

## Need Help?

- Check existing code patterns in similar modules
- Review Firestore data structures in the Firebase Console
- Consult the team Slack channel

---

*Last updated: June 2026*
